/* ===== X-B0T · Multiplayer (mesma máquina e online) =====
   As regras não mudam: existe uma mesa "verdadeira" (C), e cada jogador vê uma cópia
   espelhada em que ele é o jogador 0. As jogadas feitas na cópia são traduzidas para a
   mesa verdadeira. No modo solo, nada disso é usado. */
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { sfx, unlockAudio } from "@/lib/game/audio";
import { cardImage } from "@/lib/game/cards";
import {
  activateAbility,
  answerBomia,
  answerCounter,
  answerPick,
  attack,
  createMatch,
  dismissReveal,
  endTurn,
  playCard,
  resolveAll,
  setPhase,
} from "@/lib/game/engine";
import type { CardInstance, Faction, GameState } from "@/lib/game/types";
import { useGame } from "@/store/game-store";
import { XB, type EngineFnName, type MirrorView, type MpApi } from "./xb";

type Seat = 0 | 1;
type EngineFn = (state: GameState, ...args: unknown[]) => unknown;
interface Player {
  name: string;
  faction: Faction;
}

const O = {
  playCard,
  attack,
  activateAbility,
  answerCounter,
  answerPick,
  answerBomia,
  setPhase,
  endTurn,
  dismissReveal,
  resolveAll,
} as unknown as Record<EngineFnName, EngineFn>;
const COM_JOGADOR: Partial<Record<EngineFnName, 1>> = { playCard: 1, attack: 1, activateAbility: 1 };
const PERMITIDAS: Partial<Record<EngineFnName, 1>> = {
  playCard: 1,
  attack: 1,
  activateAbility: 1,
  answerCounter: 1,
  answerPick: 1,
  answerBomia: 1,
  setPhase: 1,
  endTurn: 1,
  dismissReveal: 1,
};

/** Nome de cada jogada na conexão: os mesmos da versão de arquivo único, para as duas jogarem juntas. */
const NO_FIO: Record<EngineFnName, string> = {
  playCard: "pf",
  attack: "xf",
  activateAbility: "hf",
  answerCounter: "kf",
  answerPick: "wf",
  answerBomia: "Sf",
  setPhase: "po",
  endTurn: "Ji",
  dismissReveal: "Mh",
  resolveAll: "Da",
};
const DO_FIO = Object.fromEntries(Object.entries(NO_FIO).map(([k, v]) => [v, k])) as Record<string, EngineFnName | undefined>;

type Msg =
  | { t: "hello"; name?: string; faction?: Faction; v?: number }
  | { t: "start"; seat: Seat; C: GameState; names?: [string, string] }
  | { t: "state"; C: GameState }
  | { t: "act"; fn: string; args: unknown[] }
  | { t: "toast"; msg: string }
  | { t: "rematch" }
  | { t: "bye" }
  | { t: "ping" }
  | { t: "full" };

interface Link {
  dc: RTCDataChannel;
  send(obj: Msg): void;
  close(): void;
}

interface Signal {
  ws: WebSocket;
  id: string;
  handlers: Record<string, (m: SignalMsg) => void>;
  aberto: boolean;
  hb?: number;
  send(type: string, dst: string, payload: unknown): void;
  close(): void;
}

interface SignalMsg {
  type: string;
  src: string;
  dst?: string;
  payload?: {
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    connectionId?: string;
  };
}

const MP = {
  mode: null as MpApi["mode"],
  /** mesa verdadeira (local e anfitrião); no convidado, a última recebida */
  C: null as GameState | null,
  /** meu lugar na mesa verdadeira (online) */
  seat: 0 as Seat,
  /** perspectiva mostrada (modo local) */
  curP: 0 as Seat,
  names: ["", ""] as [string, string],
  factions: ["magic", "machine"] as [Faction, Faction],
  /** conexão com o outro aparelho */
  link: null as Link | null,
  lastFx: 0,
  lastMsg: 0,
  resultTimer: null as number | null,
  pingTimer: undefined as number | undefined,
  bcTimer: null as number | null,
  bcPend: false,
  store: null as { startMatch: ReturnType<typeof useGame.getState>["startMatch"]; go: ReturnType<typeof useGame.getState>["go"] } | null,
  room: null as string | null,
  sig: null as Signal | null,
  me: null as Player | null,
  peer: null as Player | null,
  manualPc: null as RTCPeerConnection | null,
  localSetup: null as [string, string, Faction, Faction] | null,
  cortinaAberta: false,
  active() {
    return !!MP.mode && !!MP.C;
  },
};

// ---------- espelho ----------
// No arquivo único as cartas guardam a própria imagem inteira. Fora da tela isso só pesa:
// tiramos a imagem ao copiar/enviar e recolocamos pelo nome da carta.
const semImagem = (k: string, val: unknown) =>
  k === "image" && typeof val === "string" && val.length > 200 ? undefined : val;
function comImagem<T>(o: T): T {
  if (Array.isArray(o)) {
    for (const x of o) comImagem(x);
    return o;
  }
  if (o && typeof o === "object") {
    const rec = o as Record<string, unknown>;
    if (rec.defId && !("image" in rec)) rec.image = cardImage(String(rec.defId));
    for (const k in rec) {
      const x = rec[k];
      if (x && typeof x === "object") comImagem(x);
    }
  }
  return o;
}
const leve = (o: unknown) => JSON.stringify(o, semImagem);
const clone = <T>(o: T): T => comImagem(JSON.parse(leve(o)) as T);
const inv = <T extends number | null | undefined>(x: T): T => (x == null ? x : ((1 - x) as T));
function eachCard(v: GameState, fn: (c: CardInstance) => void) {
  for (const p of v.players) {
    fn(p.leader);
    if (p.terrain) fn(p.terrain);
    for (const z of [p.deck, p.hand, p.field, p.grave, p.life]) for (const c of z) fn(c);
  }
  if (v.reveal?.cards) v.reveal.cards.forEach(fn);
  if (v.pending) {
    if ("cards" in v.pending) v.pending.cards.forEach(fn);
    if ("card" in v.pending) fn(v.pending.card);
  }
  for (const s of v.stack) if (s.card) fn(s.card);
}
function view(C: GameState, p: Seat): MirrorView {
  const v = clone(C) as MirrorView;
  if (p === 1) {
    v.players.reverse();
    v.active = inv(v.active);
    if (v.winner != null) v.winner = inv(v.winner);
    if (v.pending) {
      v.pending.player = inv(v.pending.player);
      if ("attackerOwner" in v.pending) v.pending.attackerOwner = inv(v.pending.attackerOwner);
    }
    if (v.reveal) v.reveal.viewer = inv(v.reveal.viewer);
    for (const e of v.fx) if (e.side != null) e.side = inv(e.side);
    for (const s of v.stack) {
      s.controller = inv(s.controller);
      if (s.target && "player" in s.target) s.target.player = inv(s.target.player);
    }
    eachCard(v, (c) => {
      if (c && c.owner != null) c.owner = inv(c.owner);
    });
  }
  v.__mpP = p;
  return v;
}
function refreshInPlace(v: MirrorView) {
  if (!MP.C) return;
  const nv = view(MP.C, v.__mpP ?? 0);
  for (const k of Object.keys(v)) delete (v as unknown as Record<string, unknown>)[k];
  Object.assign(v, nv);
}

// ---------- jogadas feitas na mesa espelhada ----------
function act(name: EngineFnName, vargs: unknown[], v: MirrorView): unknown {
  const p = v.__mpP ?? 0;
  const cargs = COM_JOGADOR[name] ? [p === 0 ? vargs[0] : 1 - (vargs[0] as number), ...vargs.slice(1)] : vargs;
  if (MP.mode === "guest") {
    if (name === "resolveAll") return undefined;
    let res: unknown;
    try {
      const tmp = clone(v);
      delete tmp.__mpP;
      res = O[name](tmp, ...vargs);
    } catch {
      res = { ok: false, error: "Jogada inválida." };
    }
    if (res && (res as { ok?: boolean }).ok === false) return res;
    send({ t: "act", fn: NO_FIO[name], args: cargs });
    return res;
  }
  if (!MP.C) return COM_JOGADOR[name] ? { ok: false, error: "Partida encerrada." } : undefined;
  const quem: Seat = MP.mode === "local" ? p : MP.seat;
  if (name !== "resolveAll" && !autorizado(name, cargs, quem)) {
    return COM_JOGADOR[name] ? { ok: false, error: "Espere a sua vez." } : undefined;
  }
  let res: unknown;
  try {
    res = O[name](MP.C, ...cargs);
  } catch {
    res = COM_JOGADOR[name] ? { ok: false, error: "Jogada inválida." } : undefined;
  }
  if (name === "playCard" && (res as { ok?: boolean })?.ok && MP.C.stack.length) resolveAll(MP.C);
  refreshInPlace(v);
  if (MP.mode === "host") broadcast();
  return res;
}
function autorizado(fn: EngineFnName, args: unknown[], lugar: Seat): boolean {
  const C = MP.C;
  if (!C || C.winner != null) return false;
  if (COM_JOGADOR[fn]) return args[0] === lugar;
  if (fn === "answerCounter" || fn === "answerPick" || fn === "answerBomia") {
    return !!C.pending && C.pending.player === lugar;
  }
  if (fn === "setPhase" || fn === "endTurn") return C.active === lugar && !C.pending;
  if (fn === "dismissReveal") return !!C.reveal && C.reveal.viewer === lugar;
  return false;
}

/** Publicação do estado durante uma partida multiplayer (substitui a do modo solo). */
function publicar(r: MirrorView, extra: object) {
  if (r.winner != null) {
    useGame.setState({ state: { ...r }, ...extra, aiBusy: false });
    if (!MP.resultTimer) {
      const ganhei = r.winner === 0;
      (MP.mode === "local" || ganhei ? sfx.win : sfx.lose)();
      MP.resultTimer = window.setTimeout(() => {
        MP.resultTimer = null;
        useGame.setState({ result: ganhei ? "win" : "lose", screen: "result" });
      }, 1300);
    }
    return;
  }
  useGame.setState({ state: { ...r }, ...extra });
}

// ---------- textos da tela ----------
function nomes() {
  const st = useGame.getState().state;
  return { eu: st ? st.players[0].name : "", outro: st ? st.players[1].name : "" };
}
function texto(s: string): string {
  const { eu, outro } = nomes();
  switch (s) {
    case "Vez da máquina":
      return `Vez de ${outro}`;
    case "A máquina está decidindo…":
      return `${outro} está decidindo…`;
    case "Vez da máquina — observe as jogadas dela.":
      return `Vez de ${outro} — observe as jogadas.`;
    case "Máquina":
      return outro;
    case "Você":
      return MP.mode === "local" ? eu : "Você";
    case "Sua vez":
      return MP.mode === "local" ? `Vez de ${eu}` : "Sua vez";
    case "Vitória":
    case "Derrota":
      return "Fim de jogo";
    default:
      return s;
  }
}
function resTitle(ganhei: boolean): string {
  const C = MP.C;
  const w = C && C.winner != null ? MP.names[C.winner] : "";
  if (MP.mode === "local") return `${w} venceu!`;
  return ganhei ? "Você venceu!" : `${w} venceu`;
}
function resText(ganhei: boolean): string {
  if (MP.mode === "local") return "Boa partida! Toque em Revanche para jogar de novo.";
  return ganhei ? "A mesa é sua. Quer dar revanche?" : "Foi por pouco? Peça revanche.";
}

const api: MpApi = {
  get mode() {
    return MP.mode;
  },
  set mode(m) {
    MP.mode = m;
  },
  active: () => MP.active(),
  t: texto,
  resTitle,
  resText,
  act,
  publish: publicar,
};

// ---------- começar / sair ----------
const sorteia = (): Seat => (Math.random() < 0.5 ? 0 : 1);
function montarMesa(nomesSeat: [string, string], faccoesSeat: [Faction, Faction]) {
  MP.names = nomesSeat;
  MP.factions = faccoesSeat;
  return createMatch({
    playerFaction: faccoesSeat[0],
    aiFaction: faccoesSeat[1],
    playerName: nomesSeat[0],
    aiName: nomesSeat[1],
    seed: Math.floor(Math.random() * 1e9),
  });
}
function entrarNaMesa(p: Seat) {
  if (!MP.store) {
    const s = useGame.getState();
    MP.store = { startMatch: s.startMatch, go: s.go };
    useGame.setState({ startMatch: () => revanche(), go: (tela) => sairPara(tela) });
  }
  if (MP.resultTimer) window.clearTimeout(MP.resultTimer);
  MP.resultTimer = null;
  unlockAudio();
  useGame.setState({
    state: view(MP.C as GameState, p),
    screen: "play",
    selectedId: null,
    targeting: null,
    drag: null,
    toast: null,
    aiBusy: false,
    tutorialStep: 0,
    result: null,
    hoverId: null,
  });
  sfx.draw();
}
function comecarLocal(n0: string, n1: string, f0: Faction, f1: Faction) {
  MP.mode = "local";
  const s = sorteia(); // quem fica com o lugar 0 (começa)
  const ns: [string, string] = s === 0 ? [n0, n1] : [n1, n0];
  const fs: [Faction, Faction] = s === 0 ? [f0, f1] : [f1, f0];
  MP.localSetup = [n0, n1, f0, f1];
  MP.C = montarMesa(ns, fs);
  MP.curP = 0;
  entrarNaMesa(0);
  cortina(0, `${ns[0]} começa`);
}
function revanche() {
  if (MP.mode === "local" && MP.localSetup) {
    const [a, b, fa, fb] = MP.localSetup;
    comecarLocal(a, b, fa, fb);
    return;
  }
  if (MP.mode === "host") {
    if (!MP.link) {
      useGame.setState({ toast: "O outro jogador não está conectado." });
      return;
    }
    novaPartidaOnline();
    return;
  }
  if (MP.mode === "guest") {
    send({ t: "rematch" });
    useGame.setState({ toast: "Pedido de revanche enviado." });
  }
}
function sairPara(tela: Parameters<ReturnType<typeof useGame.getState>["go"]>[0]) {
  encerrar(true);
  if (MP.store) useGame.setState(MP.store);
  MP.store = null;
  useGame.getState().go(tela === "setup" ? "home" : tela);
}
function encerrar(avisar: boolean) {
  if (avisar && MP.link) {
    try {
      send({ t: "bye" });
    } catch {
      /* canal já caiu */
    }
  }
  MP.mode = null;
  MP.C = null;
  MP.lastFx = 0;
  if (MP.resultTimer) window.clearTimeout(MP.resultTimer);
  MP.resultTimer = null;
  fecharLink();
  fecharSinal();
  removerCortina();
  removerAviso();
}

// ---------- modo na mesma máquina: cortina para trocar de jogador ----------
function desejado(): Seat {
  const C = MP.C;
  if (!C || C.winner != null) return MP.curP;
  return C.pending ? C.pending.player : C.active;
}
function vigiarVez() {
  useGame.subscribe((st) => {
    if (MP.mode !== "local" || !MP.C || st.screen !== "play" || MP.cortinaAberta) return;
    const quer = desejado();
    if (quer !== MP.curP) {
      const pend = MP.C.pending;
      const motivo =
        pend && pend.kind === "counter" && pend.player === quer
          ? `${MP.names[quer]}, uma carta sua está sendo atacada. Decida se usa um Counter.`
          : `Vez de ${MP.names[quer]}`;
      window.setTimeout(() => cortina(quer, motivo), 450);
      MP.cortinaAberta = true;
    }
  });
}
function cortina(p: Seat, titulo: string) {
  removerCortina();
  MP.cortinaAberta = true;
  const el = document.createElement("div");
  el.className = "xb-ov felt";
  el.id = "xb-cortina";
  el.innerHTML = `<div class="xb-box xb-center"><p class="xb-kicker">Troca de jogador</p>
      <h2 class="xb-h">${esc(titulo)}</h2>
      <p class="xb-p">Só ${esc(MP.names[p])} deve olhar a tela agora.</p>
      <button class="xb-btn xb-pri" data-a="ok">Sou ${esc(MP.names[p])} — mostrar a mesa</button></div>`;
  (el.querySelector("[data-a=ok]") as HTMLButtonElement).onclick = () => {
    MP.curP = p;
    MP.cortinaAberta = false;
    removerCortina();
    if (MP.C) {
      useGame.setState({ state: view(MP.C, p), selectedId: null, targeting: null, drag: null, toast: null, hoverId: null });
    }
  };
  document.body.appendChild(el);
}
function removerCortina() {
  document.getElementById("xb-cortina")?.remove();
  MP.cortinaAberta = false;
}

// ---------- online: mensagens ----------
function send(m: Msg) {
  if (MP.link) MP.link.send(m);
}
function broadcast() {
  if (MP.mode !== "host" || !MP.link || !MP.C) return;
  MP.bcPend = true;
  if (!MP.bcTimer) MP.bcTimer = window.setTimeout(enviarMesa, 15);
}
function enviarMesa() {
  MP.bcTimer = null;
  if (!MP.bcPend || !MP.link || !MP.C) return;
  if (MP.link.dc.bufferedAmount > 1e6) {
    MP.bcTimer = window.setTimeout(enviarMesa, 80);
    return;
  }
  MP.bcPend = false;
  send({ t: "state", C: MP.C });
}
function mostrarParaMim() {
  if (!MP.C) return;
  const v = view(MP.C, MP.seat);
  if (MP.mode === "guest") {
    // relógio do outro aparelho: re-carimba os efeitos novos
    const agora = Date.now();
    for (const e of v.fx) if (e.id > MP.lastFx) e.at = agora;
    for (const e of v.fx) MP.lastFx = Math.max(MP.lastFx, e.id);
  }
  publicar(v, {});
}
function novaPartidaOnline() {
  if (!MP.me || !MP.peer) return;
  const s = sorteia(); // lugar do anfitrião
  const ns = ["", ""] as [string, string];
  const fs = ["magic", "machine"] as [Faction, Faction];
  ns[s] = MP.me.name;
  fs[s] = MP.me.faction;
  ns[1 - s] = MP.peer.name;
  fs[1 - s] = MP.peer.faction;
  MP.seat = s;
  MP.C = montarMesa(ns, fs);
  send({ t: "start", seat: (1 - s) as Seat, C: MP.C, names: ns });
  entrarNaMesa(s);
}
function aoReceber(m: Msg, link?: Link) {
  if (MP.mode === "host" && link && link !== MP.link) {
    // conexão nova: só vale depois do "hello"
    if (!m || m.t !== "hello") return;
    const emJogo = MP.C && MP.C.winner == null && MP.peer;
    if (emJogo && m.name !== MP.peer?.name) {
      link.send({ t: "full" });
      window.setTimeout(() => link.close(), 400);
      return;
    }
    usarLink(link);
  }
  MP.lastMsg = Date.now();
  if (m.t === "ping") return;
  if (m.t === "bye") {
    avisoFim(`${MP.peer?.name || "O outro jogador"} saiu da partida.`);
    return;
  }
  if (MP.mode === "host") {
    if (m.t === "hello") {
      removerAviso();
      if (MP.C && MP.C.winner == null && MP.peer && m.name === MP.peer.name) {
        // voltou depois de cair
        send({ t: "start", seat: (1 - MP.seat) as Seat, C: MP.C, names: MP.names });
        return;
      }
      let nome = String(m.name || "Convidado").slice(0, 14);
      if (nome === MP.me?.name) nome = nome.slice(0, 12) + " 2";
      MP.peer = { name: nome, faction: m.faction === "machine" ? "machine" : "magic" };
      fecharLobby();
      novaPartidaOnline();
      return;
    }
    const fn = m.t === "act" ? DO_FIO[m.fn] : undefined;
    if (m.t === "act" && fn && PERMITIDAS[fn] && MP.C) {
      const args = Array.isArray(m.args) ? m.args : [];
      const lugar = (1 - MP.seat) as Seat;
      if (autorizado(fn, args, lugar)) {
        try {
          const res = O[fn](MP.C, ...args) as { ok?: boolean; error?: string } | undefined;
          if (fn === "playCard" && res?.ok && MP.C.stack.length) resolveAll(MP.C);
          if (res && res.ok === false) send({ t: "toast", msg: res.error ?? "Jogada inválida." });
        } catch {
          send({ t: "toast", msg: "Jogada inválida." });
        }
        mostrarParaMim();
      }
      broadcast();
      return;
    }
    if (m.t === "rematch") {
      if (!MP.C || MP.C.winner != null) novaPartidaOnline();
      return;
    }
  }
  if (MP.mode === "guest") {
    if (m.t === "start") {
      removerAviso();
      fecharLobby();
      MP.seat = m.seat;
      MP.C = m.C;
      MP.names = m.names || MP.names;
      MP.lastFx = 0;
      MP.peer = { name: MP.names[1 - MP.seat] ?? "", faction: MP.factions[1 - MP.seat] ?? "magic" };
      entrarNaMesa(MP.seat);
      for (const e of MP.C.fx) MP.lastFx = Math.max(MP.lastFx, e.id);
      return;
    }
    if (m.t === "state") {
      MP.C = m.C;
      if (useGame.getState().screen === "play") mostrarParaMim();
      return;
    }
    if (m.t === "toast") {
      useGame.setState({ toast: m.msg });
      return;
    }
    if (m.t === "full") {
      const st = lobby?.querySelector(".xb-st");
      const ir = lobby?.querySelector("[data-a=ir]") as HTMLButtonElement | null | undefined;
      if (st) st.textContent = "";
      if (ir) ir.disabled = false;
      erroLobby("Essa sala já está com dois jogadores.");
      MP.room = null;
      encerrar(false);
    }
  }
}

// ---------- canal de dados (WebRTC) ----------
const PEDACO = 16000;
function embrulharCanal(dc: RTCDataChannel, aoFechar?: () => void): Link {
  const partes: Record<string, string[]> = {};
  const link: Link = {
    dc,
    send(obj) {
      if (dc.readyState !== "open") return;
      const s = leve(obj);
      try {
        enviar(s);
      } catch {
        /* fila cheia ou canal caindo: o próximo envio leva a mesa atualizada */
      }
    },
    close() {
      try {
        dc.close();
      } catch {
        /* já fechado */
      }
    },
  };
  function enviar(s: string) {
    if (s.length <= PEDACO) {
      dc.send(s);
      return;
    }
    const id = Math.random().toString(36).slice(2, 8);
    const n = Math.ceil(s.length / PEDACO);
    for (let i = 0; i < n; i++) dc.send(JSON.stringify({ __c: id, i, n, d: s.slice(i * PEDACO, (i + 1) * PEDACO) }));
  }
  dc.onmessage = (e) => {
    let m: Msg & { __c?: string; i?: number; n?: number; d?: string };
    try {
      m = JSON.parse(String(e.data));
    } catch {
      return;
    }
    if (m && m.__c) {
      const b = partes[m.__c] || (partes[m.__c] = []);
      b[m.i ?? 0] = m.d ?? "";
      if (b.filter((x) => x != null).length < (m.n ?? 0)) return;
      delete partes[m.__c];
      try {
        m = JSON.parse(b.join(""));
      } catch {
        return;
      }
    }
    if (m && "C" in m && m.C) comImagem(m.C);
    aoReceber(m, link);
  };
  dc.onclose = () => {
    if (MP.link === link) {
      MP.link = null;
      aoFechar?.();
    }
  };
  return link;
}
function usarLink(link: Link) {
  fecharLink();
  MP.link = link;
  MP.lastMsg = Date.now();
  window.clearInterval(MP.pingTimer);
  MP.pingTimer = window.setInterval(() => {
    if (!MP.link) return;
    send({ t: "ping" });
    if (Date.now() - MP.lastMsg > 15000) {
      const l = MP.link;
      MP.link = null;
      l.close();
      quedaDeConexao();
    }
  }, 4000);
}
function fecharLink() {
  window.clearInterval(MP.pingTimer);
  const l = MP.link;
  MP.link = null;
  if (l) l.close();
}
function quedaDeConexao() {
  if (!MP.mode) return;
  const outro = MP.peer?.name || "o outro jogador";
  if (MP.mode === "guest" && MP.room) {
    avisoEspera("Conexão perdida. Tentando voltar à sala…");
    reconectarConvidado(0);
    return;
  }
  if (MP.mode === "host" && MP.sig) {
    avisoEspera(`A conexão com ${outro} caiu. Esperando ${outro} voltar…`);
    return;
  }
  avisoFim("A conexão caiu.");
}

function iceConfig(): RTCConfiguration {
  const q = new URLSearchParams(location.search);
  if (q.get("ice") === "none") return { iceServers: [] };
  return {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: ["turn:eu-0.turn.peerjs.com:3478", "turn:us-0.turn.peerjs.com:3478"],
        username: "peerjs",
        credential: "peerjsp",
      },
    ],
  };
}

// ---------- servidor de sinalização (protocolo do PeerJS, servidor público 0.peerjs.com) ----------
function servidor() {
  const q = new URLSearchParams(location.search);
  const h = q.get("peer");
  return h ? { url: `${q.get("insecure") ? "ws" : "wss"}://${h}/peerjs` } : { url: "wss://0.peerjs.com:443/peerjs" };
}
function abrirSinal(id: string): Promise<Signal> {
  return new Promise((ok, falha) => {
    const token = Math.random().toString(36).slice(2);
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${servidor().url}?key=peerjs&id=${encodeURIComponent(id)}&token=${token}&version=1.5.4`);
    } catch {
      falha("sem-servidor");
      return;
    }
    const sig: Signal = {
      ws,
      id,
      handlers: {},
      aberto: false,
      send(type, dst, payload) {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type, dst, payload }));
      },
      close() {
        window.clearInterval(sig.hb);
        try {
          ws.close();
        } catch {
          /* já fechado */
        }
      },
    };
    const t = window.setTimeout(() => {
      if (!sig.aberto) {
        sig.close();
        falha("sem-servidor");
      }
    }, 12000);
    ws.onmessage = (e) => {
      let m: SignalMsg;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (m.type === "OPEN") {
        sig.aberto = true;
        window.clearTimeout(t);
        sig.hb = window.setInterval(() => {
          if (ws.readyState === 1) ws.send('{"type":"HEARTBEAT"}');
        }, 5000);
        ok(sig);
        return;
      }
      if (m.type === "ID-TAKEN") {
        window.clearTimeout(t);
        sig.close();
        falha("ocupado");
        return;
      }
      if (m.type === "ERROR" || m.type === "INVALID-KEY") {
        window.clearTimeout(t);
        sig.close();
        falha("sem-servidor");
        return;
      }
      sig.handlers[m.type]?.(m);
    };
    ws.onerror = () => {
      if (!sig.aberto) {
        window.clearTimeout(t);
        falha("sem-servidor");
      }
    };
    ws.onclose = () => {
      window.clearInterval(sig.hb);
      sig.aberto = false;
    };
  });
}
function fecharSinal() {
  MP.sig?.close();
  MP.sig = null;
}
const ALFA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const novoCodigo = () => Array.from({ length: 5 }, () => ALFA[Math.floor(Math.random() * ALFA.length)]).join("");
const idSala = (c: string) => "xb0t-sala-" + c.toLowerCase();

async function criarSala(me: Player): Promise<string> {
  let sig: Signal | null = null;
  let codigo = "";
  for (let i = 0; i < 4 && !sig; i++) {
    codigo = novoCodigo();
    try {
      sig = await abrirSinal(idSala(codigo));
    } catch (e) {
      if (e !== "ocupado") throw e;
    }
  }
  if (!sig) throw "sem-servidor";
  const s = sig;
  MP.mode = "host";
  MP.sig = s;
  MP.room = codigo;
  MP.me = me;
  MP.C = null;
  MP.peer = null;
  const pcs: Record<string, { pc: RTCPeerConnection; fila: RTCIceCandidateInit[]; pronto?: boolean }> = {};
  s.handlers.OFFER = async (m) => {
    const cid = m.payload?.connectionId;
    if (!cid || !m.payload?.sdp) return;
    const pc = new RTCPeerConnection(iceConfig());
    pcs[cid] = { pc, fila: [] };
    pc.onicecandidate = (e) => {
      if (e.candidate) s.send("CANDIDATE", m.src, { candidate: e.candidate.toJSON(), connectionId: cid, type: "data" });
    };
    pc.ondatachannel = (e) => {
      const dc = e.channel;
      dc.onopen = () => {
        embrulharCanal(dc, () => quedaDeConexao());
      };
    };
    await pc.setRemoteDescription(m.payload.sdp);
    for (const c of pcs[cid].fila) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* candidato inválido */
      }
    }
    pcs[cid].pronto = true;
    const ans = await pc.createAnswer();
    await pc.setLocalDescription(ans);
    s.send("ANSWER", m.src, { sdp: pc.localDescription?.toJSON(), connectionId: cid, type: "data" });
  };
  s.handlers.CANDIDATE = async (m) => {
    const x = m.payload?.connectionId ? pcs[m.payload.connectionId] : undefined;
    if (!x || !m.payload?.candidate) return;
    if (x.pronto) {
      try {
        await x.pc.addIceCandidate(m.payload.candidate);
      } catch {
        /* candidato inválido */
      }
    } else x.fila.push(m.payload.candidate);
  };
  return codigo;
}

function conectarSala(codigo: string, me: Player): Promise<void> {
  return new Promise((ok, falha) => {
    void (async () => {
      let sig: Signal;
      try {
        sig = await abrirSinal("xb0t-j-" + Math.random().toString(36).slice(2, 10));
      } catch (e) {
        falha(e);
        return;
      }
      const destino = idSala(codigo);
      const cid = "dc_" + Math.random().toString(36).slice(2, 10);
      const pc = new RTCPeerConnection(iceConfig());
      const fila: RTCIceCandidateInit[] = [];
      const meus: RTCIceCandidateInit[] = [];
      let pronto = false;
      let feito = false;
      let ofertaFoi = false;
      const dc = pc.createDataChannel("xb0t", { ordered: true });
      const fim = (erro: string | null) => {
        if (feito) return;
        feito = true;
        window.clearTimeout(t);
        sig.close();
        if (erro) {
          try {
            pc.close();
          } catch {
            /* já fechado */
          }
          falha(erro);
        }
      };
      const t = window.setTimeout(() => fim("sem-resposta"), 20000);
      const mandaCand = (c: RTCIceCandidateInit) => sig.send("CANDIDATE", destino, { candidate: c, connectionId: cid, type: "data" });
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const c = e.candidate.toJSON();
        if (ofertaFoi) mandaCand(c);
        else meus.push(c);
      };
      sig.handlers.ANSWER = async (m) => {
        if (!m.payload || m.payload.connectionId !== cid || !m.payload.sdp) return;
        await pc.setRemoteDescription(m.payload.sdp);
        pronto = true;
        for (const c of fila) {
          try {
            await pc.addIceCandidate(c);
          } catch {
            /* candidato inválido */
          }
        }
      };
      sig.handlers.CANDIDATE = async (m) => {
        if (!m.payload || m.payload.connectionId !== cid || !m.payload.candidate) return;
        if (pronto) {
          try {
            await pc.addIceCandidate(m.payload.candidate);
          } catch {
            /* candidato inválido */
          }
        } else fila.push(m.payload.candidate);
      };
      sig.handlers.EXPIRE = () => fim("sala-nao-existe");
      sig.handlers.LEAVE = () => fim("sala-nao-existe");
      dc.onopen = () => {
        fim(null);
        MP.mode = "guest";
        MP.room = codigo;
        MP.me = me;
        usarLink(embrulharCanal(dc, () => quedaDeConexao()));
        send({ t: "hello", name: me.name, faction: me.faction, v: 1 });
        ok();
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sig.send("OFFER", destino, {
        sdp: pc.localDescription?.toJSON(),
        connectionId: cid,
        type: "data",
        label: "xb0t",
        serialization: "json",
        reliable: true,
      });
      ofertaFoi = true;
      meus.splice(0).forEach(mandaCand);
    })();
  });
}
function reconectarConvidado(tentativa: number) {
  if (MP.mode !== "guest" || MP.link || !MP.room || !MP.me) return;
  if (tentativa > 20) {
    avisoFim("Não foi possível voltar à sala.");
    return;
  }
  const modo = MP.mode;
  conectarSala(MP.room, MP.me)
    .then(() => removerAviso())
    .catch(() => {
      MP.mode = modo;
      window.setTimeout(() => reconectarConvidado(tentativa + 1), 3000);
    });
}

// ---------- modo sem servidor: convite e resposta por código ----------
async function comprimir(txt: string): Promise<string> {
  try {
    const cs = new CompressionStream("deflate-raw");
    const buf = await new Response(new Blob([txt]).stream().pipeThrough(cs)).arrayBuffer();
    let bin = "";
    new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
    return "XB1." + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return "XB0." + btoa(unescape(encodeURIComponent(txt)));
  }
}
async function descomprimir(code: string): Promise<string> {
  code = (code || "").trim().replace(/\s+/g, "");
  if (code.startsWith("XB0.")) return decodeURIComponent(escape(atob(code.slice(4))));
  if (!code.startsWith("XB1.")) throw "codigo";
  let b64 = code.slice(4).replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const ds = new DecompressionStream("deflate-raw");
  return await new Response(new Blob([u]).stream().pipeThrough(ds)).text();
}
function esperarIce(pc: RTCPeerConnection): Promise<void> {
  return new Promise((ok) => {
    if (pc.iceGatheringState === "complete") return ok();
    const t = window.setTimeout(ok, 4000);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") {
        window.clearTimeout(t);
        ok();
      }
    });
  });
}
async function manualCriarConvite(me: Player): Promise<string> {
  const pc = new RTCPeerConnection(iceConfig());
  const dc = pc.createDataChannel("xb0t", { ordered: true });
  MP.mode = "host";
  MP.me = me;
  MP.C = null;
  MP.peer = null;
  MP.manualPc = pc;
  dc.onopen = () => {
    embrulharCanal(dc, () => quedaDeConexao());
  };
  await pc.setLocalDescription(await pc.createOffer());
  await esperarIce(pc);
  return comprimir(JSON.stringify({ type: "offer", sdp: pc.localDescription?.sdp, n: me.name, f: me.faction }));
}
async function manualAceitarResposta(code: string) {
  const d = JSON.parse(await descomprimir(code));
  if (d.type !== "answer" || !MP.manualPc) throw "codigo";
  await MP.manualPc.setRemoteDescription({ type: "answer", sdp: d.sdp });
}
async function manualResponder(code: string, me: Player): Promise<string> {
  const d = JSON.parse(await descomprimir(code));
  if (d.type !== "offer") throw "codigo";
  const pc = new RTCPeerConnection(iceConfig());
  MP.manualPc = pc;
  pc.ondatachannel = (e) => {
    const dc = e.channel;
    const abre = () => {
      MP.mode = "guest";
      MP.me = me;
      MP.room = null;
      usarLink(embrulharCanal(dc, () => quedaDeConexao()));
      send({ t: "hello", name: me.name, faction: me.faction, v: 1 });
    };
    if (dc.readyState === "open") abre();
    else dc.onopen = abre;
  };
  await pc.setRemoteDescription({ type: "offer", sdp: d.sdp });
  await pc.setLocalDescription(await pc.createAnswer());
  await esperarIce(pc);
  return comprimir(JSON.stringify({ type: "answer", sdp: pc.localDescription?.sdp }));
}

// ---------- telas (lobby) ----------
const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const lerLS = (k: string, d: string) => {
  try {
    return localStorage.getItem(k) || d;
  } catch {
    return d;
  }
};
const gravarLS = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* modo privado */
  }
};
let lobby: HTMLDivElement | null = null;
function abrirLobby() {
  fecharLobby();
  lobby = document.createElement("div");
  lobby.className = "xb-ov felt";
  lobby.id = "xb-lobby";
  document.body.appendChild(lobby);
  telaInicio();
}
function fecharLobby() {
  lobby?.remove();
  lobby = null;
}
function voltarDoLobby(): boolean {
  if (!lobby) return false;
  if (!MP.C) encerrar(false); // cancela a sala ou o convite que estava esperando
  fecharLobby();
  return true;
}
function render(html: string, liga?: (root: HTMLDivElement) => void) {
  if (!lobby) return;
  lobby.innerHTML = `<div class="xb-box">${html}</div>`;
  liga?.(lobby);
}
const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;
function erroLobby(msg: string) {
  const e = lobby?.querySelector(".xb-err") as HTMLElement | null | undefined;
  if (e) {
    e.textContent = msg;
    e.hidden = false;
  }
}
const FAC: Record<Faction, string> = { magic: "Arcana · Rogen", machine: "Oficina · Bobo" };
function seletorFaccao(nome: string, atual: string) {
  return `<div class="xb-seg" data-seg="${nome}">${(["magic", "machine"] as Faction[])
    .map((f) => `<button class="xb-btn xb-segb ${f === atual ? "xb-on" : ""}" data-f="${f}">${FAC[f]}</button>`)
    .join("")}</div>`;
}
function ligarSeletores(root: ParentNode) {
  root.querySelectorAll(".xb-seg").forEach((seg) =>
    seg.querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        seg.querySelectorAll("button").forEach((x) => x.classList.remove("xb-on"));
        b.classList.add("xb-on");
      };
    }),
  );
}
const faccaoDe = (root: ParentNode, nome: string): Faction => {
  const b = root.querySelector(`[data-seg="${nome}"] .xb-on`) as HTMLElement | null;
  return b?.dataset.f === "machine" ? "machine" : "magic";
};
const nomeLimpo = (s: string, d: string) => String(s || "").trim().slice(0, 14) || d;
const ERROS: Record<string, string> = {
  "sem-servidor": "Não consegui falar com o servidor de salas. Confira a internet ou use o modo sem servidor.",
  "sala-nao-existe": "Sala não encontrada. Confira o código com quem criou.",
  "sem-resposta": "A sala não respondeu. Peça para quem criou deixar o jogo aberto e tente de novo.",
  codigo: "Esse código não parece certo. Copie de novo, inteiro.",
};

function telaInicio() {
  encerrar(false);
  render(
    `<p class="xb-kicker">X-B0T</p><h2 class="xb-h">Multiplayer</h2>
      <p class="xb-p">Jogue contra outra pessoa na mesma máquina ou pela internet.</p>
      <div class="xb-col">
        <button class="xb-btn xb-pri" data-a="local">Na mesma máquina</button>
        <button class="xb-btn" data-a="criar">Criar sala online</button>
        <button class="xb-btn" data-a="entrar">Entrar numa sala</button>
        <button class="xb-btn xb-ghost" data-a="manual">Online sem servidor (por código)</button>
        <button class="xb-btn xb-ghost" data-a="voltar">Voltar</button>
      </div>`,
    (r) => {
      $(r, "[data-a=local]").onclick = telaLocal;
      $(r, "[data-a=criar]").onclick = () => telaOnline("criar");
      $(r, "[data-a=entrar]").onclick = () => telaOnline("entrar");
      $(r, "[data-a=manual]").onclick = telaManual;
      $(r, "[data-a=voltar]").onclick = fecharLobby;
    },
  );
}
function telaLocal() {
  render(
    `<p class="xb-kicker">Na mesma máquina</p><h2 class="xb-h">Quem vai jogar?</h2>
      <div class="xb-two"><div class="xb-col"><label class="xb-l">Jogador 1<input class="xb-in" id="xb-n1" maxlength="14" value="${esc(lerLS("xb-n1", "Jogador 1"))}"></label>
      ${seletorFaccao("f1", "magic")}</div>
      <div class="xb-col"><label class="xb-l">Jogador 2<input class="xb-in" id="xb-n2" maxlength="14" value="${esc(lerLS("xb-n2", "Jogador 2"))}"></label>
      ${seletorFaccao("f2", "machine")}</div></div>
      <p class="xb-p xb-small">Quem começa é sorteado. Entre os turnos, o jogo pede para trocar de jogador, para um não ver a mão do outro.</p>
      <div class="xb-row"><button class="xb-btn xb-pri" data-a="ir">Começar</button><button class="xb-btn xb-ghost" data-a="voltar">Voltar</button></div>`,
    (r) => {
      ligarSeletores(r);
      $(r, "[data-a=voltar]").onclick = telaInicio;
      $(r, "[data-a=ir]").onclick = () => {
        const n1 = nomeLimpo($<HTMLInputElement>(r, "#xb-n1").value, "Jogador 1");
        let n2 = nomeLimpo($<HTMLInputElement>(r, "#xb-n2").value, "Jogador 2");
        if (n2 === n1) n2 = n2 + " 2";
        gravarLS("xb-n1", n1);
        gravarLS("xb-n2", n2);
        const f1 = faccaoDe(r, "f1");
        const f2 = faccaoDe(r, "f2");
        fecharLobby();
        comecarLocal(n1, n2, f1, f2);
      };
    },
  );
}
function telaOnline(tipo: "criar" | "entrar", codigo = "") {
  const criar = tipo === "criar";
  render(
    `<p class="xb-kicker">${criar ? "Criar sala" : "Entrar numa sala"}</p>
      <h2 class="xb-h">${criar ? "Você cria, o outro entra" : codigo ? "Você foi convidado: digite seu nome" : "Digite o código da sala"}</h2>
      <label class="xb-l">Seu nome<input class="xb-in" id="xb-nome" maxlength="14" value="${esc(lerLS("xb-nome", ""))}" placeholder="Seu nome"></label>
      ${seletorFaccao("f", lerLS("xb-fac", "magic"))}
      ${criar ? "" : `<label class="xb-l">Código da sala<input class="xb-in xb-code" id="xb-cod" maxlength="5" autocapitalize="characters" autocomplete="off" placeholder="ABCDE" value="${esc(codigo)}"></label>`}
      <p class="xb-err" hidden></p><p class="xb-p xb-small xb-st"></p>
      <div class="xb-row"><button class="xb-btn xb-pri" data-a="ir">${criar ? "Criar sala" : "Entrar"}</button><button class="xb-btn xb-ghost" data-a="voltar">Voltar</button></div>`,
    (r) => {
      ligarSeletores(r);
      $(r, "[data-a=voltar]").onclick = telaInicio;
      const st = $(r, ".xb-st");
      const ir = $<HTMLButtonElement>(r, "[data-a=ir]");
      ir.onclick = async () => {
        const me: Player = {
          name: nomeLimpo($<HTMLInputElement>(r, "#xb-nome").value, criar ? "Anfitrião" : "Convidado"),
          faction: faccaoDe(r, "f"),
        };
        gravarLS("xb-nome", me.name);
        gravarLS("xb-fac", me.faction);
        $(r, ".xb-err").hidden = true;
        ir.disabled = true;
        st.textContent = "Conectando…";
        try {
          if (criar) {
            const c = await criarSala(me);
            telaSalaCriada(c);
          } else {
            const c = ($<HTMLInputElement>(r, "#xb-cod").value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
            if (c.length !== 5) throw "codigo";
            st.textContent = "Procurando a sala…";
            await conectarSala(c, me);
            st.textContent = "Conectado! Esperando a partida começar…";
          }
        } catch (e) {
          ir.disabled = false;
          st.textContent = "";
          erroLobby(ERROS[String(e)] || "Não foi possível conectar.");
          MP.mode = null;
          fecharSinal();
        }
      };
    },
  );
}
/** Link do site que abre direto na sala (no app Android e no arquivo aberto do computador não há link). */
function linkDaSala(codigo: string): string | null {
  if (Capacitor.isNativePlatform() || !location.protocol.startsWith("http")) return null;
  const u = new URL(location.href);
  u.hash = "";
  u.searchParams.set("sala", codigo);
  return u.toString();
}
function telaSalaCriada(codigo: string) {
  const link = linkDaSala(codigo);
  render(
    `<p class="xb-kicker">Sala criada</p><h2 class="xb-h">Código da sala</h2>
      <p class="xb-bigcode">${codigo}</p>
      <p class="xb-p">${
        link
          ? "Mande o link para o outro jogador: ele abre, digita o nome e entra direto na sala. Quem já está no jogo pode usar Multiplayer → Entrar numa sala e digitar o código."
          : "Mande esse código para o outro jogador. Ele abre o X-B0T, toca em Multiplayer → Entrar numa sala e digita o código."
      }</p>
      <div class="xb-row"><button class="xb-btn xb-pri" data-a="share">${link ? "Compartilhar link" : "Compartilhar código"}</button><button class="xb-btn" data-a="copy">${link ? "Copiar link" : "Copiar"}</button></div>
      <p class="xb-p xb-small">Esperando o outro jogador… Deixe esta tela aberta.</p>
      <div class="xb-row"><button class="xb-btn xb-ghost" data-a="voltar">Cancelar</button></div>`,
    (r) => {
      const msg = link
        ? `Bora jogar X-B0T! Entre na minha sala: ${link}`
        : `Bora jogar X-B0T! Abra o jogo, toque em Multiplayer → Entrar numa sala e digite o código ${codigo}`;
      $(r, "[data-a=copy]").onclick = (e) => copiar(link ?? codigo, e.target as HTMLElement);
      $(r, "[data-a=share]").onclick = (e) => compartilhar(msg, e.target as HTMLElement);
      $(r, "[data-a=voltar]").onclick = telaInicio;
    },
  );
}
function telaManual() {
  render(
    `<p class="xb-kicker">Online sem servidor</p><h2 class="xb-h">Convite por código</h2>
      <p class="xb-p">Funciona sem o servidor de salas: vocês trocam dois códigos longos (por WhatsApp, por exemplo). Na mesma rede Wi-Fi funciona até sem internet.</p>
      <label class="xb-l">Seu nome<input class="xb-in" id="xb-nome" maxlength="14" value="${esc(lerLS("xb-nome", ""))}" placeholder="Seu nome"></label>
      ${seletorFaccao("f", lerLS("xb-fac", "magic"))}
      <div class="xb-col"><button class="xb-btn xb-pri" data-a="host">Criar convite</button><button class="xb-btn" data-a="guest">Recebi um convite</button>
      <button class="xb-btn xb-ghost" data-a="voltar">Voltar</button></div>`,
    (r) => {
      ligarSeletores(r);
      const me = (): Player => {
        const m: Player = { name: nomeLimpo($<HTMLInputElement>(r, "#xb-nome").value, "Jogador"), faction: faccaoDe(r, "f") };
        gravarLS("xb-nome", m.name);
        gravarLS("xb-fac", m.faction);
        return m;
      };
      $(r, "[data-a=voltar]").onclick = telaInicio;
      $(r, "[data-a=host]").onclick = () => telaManualHost(me());
      $(r, "[data-a=guest]").onclick = () => telaManualGuest(me());
    },
  );
}
function telaManualHost(me: Player) {
  render(
    `<p class="xb-kicker">Passo 1 de 2</p><h2 class="xb-h">Mande este convite</h2>
      <textarea class="xb-in xb-ta" id="xb-conv" readonly>Gerando…</textarea>
      <div class="xb-row"><button class="xb-btn xb-pri" data-a="share">Compartilhar</button><button class="xb-btn" data-a="copy">Copiar</button></div>
      <p class="xb-kicker" style="margin-top:14px">Passo 2 de 2</p>
      <label class="xb-l">Cole aqui a resposta do outro jogador<textarea class="xb-in xb-ta" id="xb-resp" placeholder="XB1…"></textarea></label>
      <p class="xb-err" hidden></p><p class="xb-p xb-small xb-st"></p>
      <div class="xb-row"><button class="xb-btn xb-pri" data-a="ir">Conectar</button><button class="xb-btn xb-ghost" data-a="voltar">Cancelar</button></div>`,
    async (r) => {
      $(r, "[data-a=voltar]").onclick = telaInicio;
      const ta = $<HTMLTextAreaElement>(r, "#xb-conv");
      try {
        ta.value = await manualCriarConvite(me);
      } catch {
        erroLobby("Não foi possível criar o convite neste aparelho.");
        return;
      }
      $(r, "[data-a=copy]").onclick = (e) => copiar(ta.value, e.target as HTMLElement);
      $(r, "[data-a=share]").onclick = (e) => compartilhar(ta.value, e.target as HTMLElement);
      $(r, "[data-a=ir]").onclick = async () => {
        $(r, ".xb-err").hidden = true;
        try {
          await manualAceitarResposta($<HTMLTextAreaElement>(r, "#xb-resp").value);
          $(r, ".xb-st").textContent = "Conectando…";
        } catch {
          erroLobby(ERROS.codigo as string);
        }
      };
    },
  );
}
function telaManualGuest(me: Player) {
  render(
    `<p class="xb-kicker">Passo 1 de 2</p><h2 class="xb-h">Cole o convite</h2>
      <textarea class="xb-in xb-ta" id="xb-conv" placeholder="XB1…"></textarea>
      <p class="xb-err" hidden></p>
      <div class="xb-row"><button class="xb-btn xb-pri" data-a="gerar">Gerar resposta</button><button class="xb-btn xb-ghost" data-a="voltar">Cancelar</button></div>
      <div id="xb-passo2" hidden><p class="xb-kicker" style="margin-top:14px">Passo 2 de 2</p><h2 class="xb-h">Mande esta resposta</h2>
      <textarea class="xb-in xb-ta" id="xb-resp" readonly></textarea>
      <div class="xb-row"><button class="xb-btn xb-pri" data-a="share">Compartilhar</button><button class="xb-btn" data-a="copy">Copiar</button></div>
      <p class="xb-p xb-small">Quando o outro jogador colar a resposta, a partida começa sozinha.</p></div>`,
    (r) => {
      $(r, "[data-a=voltar]").onclick = telaInicio;
      $(r, "[data-a=gerar]").onclick = async (ev) => {
        const btn = ev.target as HTMLButtonElement;
        $(r, ".xb-err").hidden = true;
        btn.disabled = true;
        try {
          const resp = await manualResponder($<HTMLTextAreaElement>(r, "#xb-conv").value, me);
          $<HTMLTextAreaElement>(r, "#xb-resp").value = resp;
          $(r, "#xb-passo2").hidden = false;
          $(r, "[data-a=copy]").onclick = (e) => copiar(resp, e.target as HTMLElement);
          $(r, "[data-a=share]").onclick = (e) => compartilhar(resp, e.target as HTMLElement);
        } catch {
          btn.disabled = false;
          erroLobby(ERROS.codigo as string);
        }
      };
    },
  );
}
async function copiar(txt: string, btn?: HTMLElement) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(txt);
    ok = true;
  } catch {
    /* sem permissão: tenta o jeito antigo */
  }
  if (!ok) {
    const t = document.createElement("textarea");
    t.value = txt;
    document.body.appendChild(t);
    t.select();
    try {
      ok = document.execCommand("copy");
    } catch {
      /* navegador sem suporte */
    }
    t.remove();
  }
  if (btn) {
    const o = btn.textContent;
    btn.textContent = ok ? "Copiado!" : "Selecione e copie";
    window.setTimeout(() => (btn.textContent = o), 1600);
  }
}
async function compartilhar(txt: string, btn?: HTMLElement) {
  // No app Android a WebView não tem navigator.share: usa o menu de compartilhar do sistema.
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({ text: txt, dialogTitle: "Compartilhar com o outro jogador" });
      return;
    } catch {
      /* cancelado ou sem app para compartilhar: copia */
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ text: txt });
      return;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
  }
  void copiar(txt, btn);
}

// ---------- avisos sobre a partida (queda, saída) ----------
function avisoEspera(msg: string) {
  removerAviso();
  const el = document.createElement("div");
  el.className = "xb-ov xb-dim";
  el.id = "xb-aviso";
  el.innerHTML = `<div class="xb-box xb-center"><p class="xb-kicker">Online</p><h2 class="xb-h">${esc(msg)}</h2>
      <div class="xb-spin"></div><button class="xb-btn xb-ghost" data-a="sair">Sair da partida</button></div>`;
  $(el, "[data-a=sair]").onclick = () => sairPara("home");
  document.body.appendChild(el);
}
function avisoFim(msg: string) {
  removerAviso();
  const el = document.createElement("div");
  el.className = "xb-ov xb-dim";
  el.id = "xb-aviso";
  el.innerHTML = `<div class="xb-box xb-center"><p class="xb-kicker">Online</p><h2 class="xb-h">${esc(msg)}</h2>
      <button class="xb-btn xb-pri" data-a="sair">Voltar ao menu</button></div>`;
  $(el, "[data-a=sair]").onclick = () => sairPara("home");
  document.body.appendChild(el);
  fecharLink();
  fecharSinal();
}
function removerAviso() {
  document.getElementById("xb-aviso")?.remove();
}

/** Liga o multiplayer: chamado uma vez ao abrir o jogo. */
export function initMultiplayer() {
  XB.mp = api;
  XB.openLobby = abrirLobby;
  XB.closeLobby = voltarDoLobby;
  vigiarVez();
  // Link de sala (?sala=ABCDE): abre direto na tela de entrar, com o código preenchido.
  const q = new URLSearchParams(location.search);
  const sala = (q.get("sala") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  if (sala) {
    q.delete("sala");
    const resto = q.toString();
    history.replaceState(null, "", location.pathname + (resto ? `?${resto}` : "") + location.hash);
    abrirLobby();
    telaOnline("entrar", sala);
  }
  if (import.meta.env.DEV) {
    // teste automatizado (só lê o estado)
    (window as unknown as { __xbmp: unknown }).__xbmp = { MP, view, O };
  }
}
