import { buildDeck, instantiate, leaderFor, targetNeedFor } from "./cards";
import type {
  AttackTarget,
  CardInstance,
  EffectTarget,
  Faction,
  FxEvent,
  GameState,
  PlayerState,
  StackItem,
} from "./types";

/** Máximo de personagens (unidades e fichas) no campo de cada jogador. */
export const MAX_FIELD = 6;
/** Mecha se autodestrói no fim do seu X-ésimo turno em campo. */
export const MECHA_TURNS = 3;
/** Bônus de defesa das cartas Counter (Assembleia / Firewall). */
export const COUNTER_BONUS = 3000;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function shuffle<T>(arr: T[], rand: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j] as T;
    arr[j] = tmp as T;
  }
}

let logSeq = 1;
let fxSeq = 1;

// ============================================================
// ATRIBUTOS
// ============================================================

export function isUnit(card: CardInstance): boolean {
  return card.cardType === "Comum" || card.cardType === "Especial" || card.cardType === "Ficha";
}

function onField(card: CardInstance, owner: PlayerState): boolean {
  return owner.field.some((c) => c.id === card.id);
}

export function atkTotal(card: CardInstance, owner: PlayerState): number {
  let base = card.attack + card.buffAtaque + card.tempAtk;
  if (owner.terrain?.defId === "biblioteca" && card.cardClass.includes("Mágico")) {
    base += 1000;
  }
  if (onField(card, owner) && owner.field.some((c) => c.defId === "servidor")) {
    const copies = owner.field.filter((c) => c.defId === card.defId).length;
    base += 1000 * (copies - 1);
  }
  return Math.max(0, base);
}

/** Defesa máxima (vida máxima) da carta, com bônus de equipamentos e terreno. */
export function defMax(card: CardInstance, owner: PlayerState): number {
  let d = card.defense + card.buffDefesa;
  if (owner.terrain?.defId === "oficina" && onField(card, owner)) d += 1000;
  return Math.max(0, d);
}

/** Defesa atual: defesa máxima menos o dano sofrido. */
export function defNow(card: CardInstance, owner: PlayerState): number {
  return defMax(card, owner) - card.damage;
}

/** Defesa do líder: ataques menores que ela não tiram vida (Rogen 5000, Bobo 0). */
export function leaderDefense(p: PlayerState): number {
  return p.leader.defense + p.leader.buffDefesa;
}

export function effectiveCost(card: CardInstance, p: PlayerState): number {
  if (p.leader.defId === "bobo") {
    return card.cost <= 4 ? 0 : Math.ceil(card.cost / 2);
  }
  return card.cost;
}

export function maxAttacks(card: CardInstance): number {
  return card.keywords.includes("DoubleAttack") ? 2 : 1;
}

function cloneCard(c: CardInstance): CardInstance {
  return { ...c, keywords: [...c.keywords] };
}

function clonePlayer(p: PlayerState): PlayerState {
  return {
    ...p,
    deck: p.deck.map(cloneCard),
    hand: p.hand.map(cloneCard),
    field: p.field.map(cloneCard),
    terrain: p.terrain ? cloneCard(p.terrain) : null,
    grave: p.grave.map(cloneCard),
    life: p.life.map(cloneCard),
    leader: cloneCard(p.leader),
  };
}

export function cloneState(s: GameState): GameState {
  return {
    ...s,
    players: [clonePlayer(s.players[0]), clonePlayer(s.players[1])],
    stack: s.stack.map((it) => ({
      ...it,
      card: cloneCard(it.card),
      target: it.target ? { ...it.target } : null,
    })),
    log: [...s.log],
    fx: [...s.fx],
    reveal: s.reveal ? { ...s.reveal, cards: s.reveal.cards.map(cloneCard) } : null,
    pending: s.pending ? { ...s.pending } : null,
  };
}

function log(state: GameState, text: string) {
  logSeq += 1;
  state.log = [...state.log.slice(-40), { id: logSeq, text, turn: state.turn }];
}

function fx(state: GameState, e: Omit<FxEvent, "id" | "at">) {
  fxSeq += 1;
  state.fx = [...state.fx.slice(-40), { ...e, id: fxSeq, at: Date.now() }];
}

function opp(i: 0 | 1): 0 | 1 {
  return i === 0 ? 1 : 0;
}

function findAnywhere(p: PlayerState, id: string): CardInstance | undefined {
  return (
    p.field.find((c) => c.id === id) ||
    p.hand.find((c) => c.id === id) ||
    (p.terrain?.id === id ? p.terrain : undefined) ||
    (p.leader.id === id ? p.leader : undefined)
  );
}

// ============================================================
// PREPARAÇÃO DA PARTIDA
// ============================================================

export function makePlayer(
  name: string,
  faction: Faction,
  owner: 0 | 1,
  seed: number,
): PlayerState {
  const rand = rng(seed);
  const deck = buildDeck(faction, owner);
  shuffle(deck, rand);
  const leader = leaderFor(faction, owner);
  const life: CardInstance[] = [];
  for (let i = 0; i < leader.life; i++) {
    const top = deck.shift();
    if (top) life.push(top);
  }
  return {
    name,
    deck,
    hand: [],
    field: [],
    terrain: null,
    grave: [],
    life,
    energy: 2,
    leader,
    alive: true,
    faction,
  };
}

function drawInitialHand(p: PlayerState, size: number, rand: () => number) {
  p.hand = [];
  while (p.hand.length < size && p.deck.length) {
    p.hand.push(p.deck.shift() as CardInstance);
  }
  const hasNonEffect = () => p.hand.some((c) => c.cardType !== "Efeito");
  const hasAttacker = () => p.hand.some((c) => c.attack > 0);
  let attempts = 0;
  while ((!hasNonEffect() || !hasAttacker()) && attempts < 80 && p.deck.length) {
    attempts += 1;
    const swapIdx = p.deck.findIndex((dc) =>
      !hasNonEffect() ? dc.cardType !== "Efeito" : dc.attack > 0,
    );
    if (swapIdx < 0) break;
    const handIdx = p.hand.findIndex((h) => h.cardType === "Efeito");
    const hi = handIdx >= 0 ? handIdx : 0;
    const fromHand = p.hand[hi] as CardInstance;
    const fromDeck = p.deck.splice(swapIdx, 1)[0] as CardInstance;
    p.hand[hi] = fromDeck;
    p.deck.push(fromHand);
  }
  if (p.hand.length < size) {
    shuffle(p.deck, rand);
  }
}

export function createMatch(opts: {
  playerFaction: Faction;
  aiFaction: Faction;
  playerName?: string;
  aiName?: string;
  seed?: number;
  firstTurnNoAttack?: boolean;
}): GameState {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const p0 = makePlayer(opts.playerName ?? "Você", opts.playerFaction, 0, seed);
  const p1 = makePlayer(opts.aiName ?? "Máquina", opts.aiFaction, 1, seed + 17);
  drawInitialHand(p0, 5, rng(seed + 3));
  drawInitialHand(p1, 5, rng(seed + 9));
  const state: GameState = {
    players: [p0, p1],
    active: 0,
    turn: 1,
    phase: "NOT_STARTED",
    stack: [],
    winner: null,
    log: [],
    reveal: null,
    pending: null,
    fx: [],
    firstTurnNoAttack: opts.firstTurnNoAttack ?? true,
    lastAction: null,
  };
  log(state, "A mesa está pronta. Cinco cartas na mão, vidas viradas na Zona de Vida.");
  beginTurn(state);
  return state;
}

export function createTutorialMatch(): GameState {
  const state = createMatch({
    playerFaction: "magic",
    aiFaction: "magic",
    playerName: "Você",
    aiName: "Instrutor",
    seed: 2026,
    firstTurnNoAttack: false,
  });
  const p = state.players[0];
  const forced: CardInstance[] = [
    instantiate("marbo", 0),
    instantiate("estudante", 0),
    instantiate("helbo", 0),
    instantiate("professor", 0),
    instantiate("graduacao", 0),
  ];
  const leftover = p.hand;
  p.hand = forced;
  p.deck = leftover.concat(p.deck);
  p.energy = 3;
  return state;
}

// ============================================================
// TURNOS
// ============================================================

function draw(state: GameState, who: 0 | 1, n: number) {
  const p = state.players[who];
  for (let i = 0; i < n; i++) {
    if (!p.deck.length) break;
    const card = p.deck.shift() as CardInstance;
    p.hand.push(card);
    if (p.field.some((c) => c.defId === "bomia") && !state.pending) {
      state.pending = { kind: "bomia", player: who, card: cloneCard(card) };
    }
  }
}

export function beginTurn(state: GameState) {
  const p = state.players[state.active];
  state.phase = "BEGIN";
  for (const c of p.field) {
    c.jaAtacou = false;
    c.attacksUsed = 0;
    c.summonedThisTurn = false;
    c.usedActivated = false;
  }
  p.leader.jaAtacou = false;
  p.leader.attacksUsed = 0;

  const gain = state.turn >= 3 ? 2 : 1;
  p.energy += gain;
  fx(state, { kind: "energy", side: state.active, targetId: p.leader.id, amount: gain });

  for (const c of p.field) {
    const regen = c.defId === "gatorreta" ? 1 : c.defId === "lectrabo" ? 2 : 0;
    if (!regen) continue;
    p.energy += regen;
    fx(state, { kind: "energy", side: state.active, targetId: c.id, amount: regen });
    log(state, `${c.name} recupera ${regen} energia.`);
  }

  log(state, `${p.name} começa o turno ${state.turn}. +${gain} energia (${p.energy}).`);
  fx(state, { kind: "turn", side: state.active });
  draw(state, state.active, 1);
  state.phase = "MAIN";
  checkWinner(state);
}

export function setPhase(state: GameState, phase: "MAIN" | "ATTACK") {
  if (state.winner != null || state.pending) return;
  if (state.phase === phase) return;
  state.phase = phase;
  log(
    state,
    `${state.players[state.active].name} entra na fase de ${phase === "MAIN" ? "jogo" : "ataque"}.`,
  );
}

function endTurnCleanup(state: GameState) {
  const owner = state.active;
  const p = state.players[owner];
  for (const c of [...p.field]) {
    if (c.sacrificeEnd) {
      destroyUnit(state, owner, c, `${c.name} é consumido pelo Canalizar e vai para o descarte.`);
      continue;
    }
    if (c.countdown > 0) {
      c.countdown -= 1;
      if (c.countdown === 0) {
        destroyUnit(state, owner, c, `${c.name} se autodestrói.`);
      }
    }
  }
  for (const pl of state.players) {
    pl.leader.tempAtk = 0;
    for (const c of pl.field) c.tempAtk = 0;
  }
}

export function endTurn(state: GameState) {
  if (state.pending || state.winner != null) return;
  resolveAll(state);
  endTurnCleanup(state);
  state.phase = "END";
  state.active = opp(state.active);
  state.turn += 1;
  state.reveal = null;
  checkWinner(state);
  if (state.winner == null) beginTurn(state);
}

function checkWinner(state: GameState) {
  if (state.winner != null) return;
  for (const [i, p] of state.players.entries()) {
    if (!p.alive || p.life.length === 0) {
      p.alive = false;
      state.winner = opp(i as 0 | 1);
      state.pending = null;
      log(state, `${state.players[state.winner].name} vence a partida.`);
      return;
    }
  }
}

// ============================================================
// JOGAR CARTAS
// ============================================================

/** Motivo pelo qual a carta não pode ser jogada agora (ou null se pode). */
export function playBlockReason(
  state: GameState,
  player: 0 | 1,
  cardId: string,
): string | null {
  if (state.winner != null) return "A partida acabou.";
  if (state.pending) return "Responda à escolha na tela primeiro.";
  if (state.active !== player) return "Espere a sua vez.";
  if (state.phase !== "MAIN" && state.phase !== "ATTACK") return "Agora não é possível jogar cartas.";
  const p = state.players[player];
  const card = p.hand.find((c) => c.id === cardId);
  if (!card) return "Essa carta não está na mão.";
  if (card.speed === "Counter") {
    return `${card.name} é um Counter: ela é usada quando um aliado seu for atacado.`;
  }
  const cost = effectiveCost(card, p);
  if (p.energy < cost) return `Energia insuficiente: custa ${cost}, você tem ${p.energy}.`;
  if (isUnit(card) && p.field.length >= MAX_FIELD) {
    return `Campo cheio (máximo de ${MAX_FIELD} personagens).`;
  }
  const need = targetNeedFor(card);
  if (need === "ally-unit" && !p.field.some(isUnit)) {
    return `${card.name} precisa de um aliado seu em campo como alvo.`;
  }
  if (need === "estudante" && !p.field.some((c) => c.defId === "estudante")) {
    return "Graduação precisa de um Estudante de Magia em campo.";
  }
  return null;
}

export function canPlay(state: GameState, player: 0 | 1, cardId: string): boolean {
  return playBlockReason(state, player, cardId) === null;
}

export function playCard(
  state: GameState,
  player: 0 | 1,
  cardId: string,
  target: EffectTarget | null,
): { ok: boolean; error?: string } {
  const reason = playBlockReason(state, player, cardId);
  if (reason) return { ok: false, error: reason };
  const p = state.players[player];
  const idx = p.hand.findIndex((c) => c.id === cardId);
  const card = p.hand[idx] as CardInstance;
  const need = targetNeedFor(card);
  if (need !== "none") {
    const t = target?.kind === "card" ? p.field.find((c) => c.id === target.cardId) : undefined;
    if (!t || !isUnit(t)) return { ok: false, error: "Escolha um aliado seu em campo." };
    if (need === "estudante" && t.defId !== "estudante") {
      return { ok: false, error: "Graduação só funciona em Estudante de Magia." };
    }
  }
  const cost = effectiveCost(card, p);
  p.energy -= cost;
  p.hand.splice(idx, 1);
  card.owner = player;

  if (card.cardType === "Efeito") {
    const item: StackItem = { card, controller: player, target };
    state.stack.push(item);
    log(state, `${p.name} usa ${card.name}.`);
    state.lastAction = "stack";
    return { ok: true };
  }

  if (card.cardType === "Terreno") {
    if (p.terrain) {
      p.grave.push(p.terrain);
      log(state, `${p.terrain.name} sai de campo.`);
    }
    p.terrain = card;
    log(state, `${p.name} coloca o terreno ${card.name}.`);
    fx(state, { kind: "buff", targetId: card.id, text: "Terreno ativo" });
    checkDeaths(state);
    state.lastAction = "terrain";
    return { ok: true };
  }

  if (card.cardType === "Item") {
    if (target?.kind === "card") applyItem(state, player, card, target.cardId);
    p.grave.push(card);
    state.lastAction = "item";
    return { ok: true };
  }

  card.jaAtacou = false;
  card.attacksUsed = 0;
  card.summonedThisTurn = !card.keywords.includes("Haste");
  if (card.defId === "mecha") card.countdown = MECHA_TURNS;
  p.field.push(card);
  log(state, `${p.name} joga ${card.name} no campo.`);
  state.lastAction = "summon";

  if (card.defId === "rodote") {
    const o = state.players[opp(player)];
    state.reveal = {
      viewer: player,
      title: `${card.name} prevê o baralho`,
      cards: o.deck.slice(0, 3).map(cloneCard),
      reason: `As próximas cartas de ${o.name}.`,
    };
  }
  if (card.defId === "helbo") {
    p.energy += 1;
    fx(state, { kind: "energy", side: player, targetId: card.id, amount: 1 });
    log(state, `${card.name} recupera 1 energia.`);
  }
  return { ok: true };
}

function applyItem(state: GameState, player: 0 | 1, item: CardInstance, cardId: string) {
  const p = state.players[player];
  const t = p.field.find((c) => c.id === cardId);
  if (!t) return;
  if (item.defId === "tomo") {
    if (!t.cardClass.includes("Mágico")) t.cardClass = `${t.cardClass}, Mágico`;
    log(state, `${item.name} concede a classe Mágico a ${t.name}.`);
    fx(state, { kind: "buff", targetId: t.id, text: "+ classe Mágico" });
  } else if (item.defId === "chave") {
    t.buffDefesa += 1000;
    log(state, `${t.name} é equipado com ${item.name}: +1000 DEF.`);
    fx(state, { kind: "heal", targetId: t.id, amount: 1000, text: "+1000 DEF" });
  }
}

export function resolveTop(state: GameState) {
  const inst = state.stack.pop();
  if (!inst) return;
  const controllerIdx = inst.controller;
  const controller = state.players[controllerIdx];
  const card = inst.card;
  const target = inst.target;

  // Mabo: o líder fica imune a efeitos do adversário.
  if (target?.kind === "player" && target.part === "leader" && target.player !== controllerIdx) {
    const guarded = state.players[target.player].field.some((c) => c.defId === "mabo");
    if (guarded) {
      controller.grave.push(card);
      log(state, `Mabo protege o líder e anula ${card.name}.`);
      fx(state, { kind: "shield", targetId: state.players[target.player].leader.id, text: "Imune!" });
      return;
    }
  }

  const ally = target?.kind === "card" ? controller.field.find((c) => c.id === target.cardId) : undefined;

  switch (card.defId) {
    case "anular": {
      const o = state.players[opp(controllerIdx)];
      const top = o.deck.slice(0, 3);
      const hit = top.findIndex((c) => c.cardType === "Efeito");
      state.reveal = {
        viewer: controllerIdx,
        title: "Anular",
        cards: top.map(cloneCard),
        reason:
          hit >= 0
            ? `${top[hit]!.name} foi enviada para o descarte de ${o.name}.`
            : "Nenhuma carta de Efeito no topo do baralho inimigo.",
      };
      if (hit >= 0) {
        const gone = o.deck.splice(hit, 1)[0] as CardInstance;
        o.grave.push(gone);
        log(state, `${card.name} anula ${gone.name} do topo do baralho de ${o.name}.`);
      } else {
        log(state, `${card.name} não encontrou carta de Efeito no topo.`);
      }
      break;
    }
    case "graduacao": {
      if (ally) {
        ally.buffAtaque += 2000;
        log(state, `${ally.name} se gradua: +2000 ATK.`);
        fx(state, { kind: "buff", targetId: ally.id, text: "+2000 ATK" });
      }
      break;
    }
    case "canalizar": {
      if (ally) {
        ally.buffAtaque += 6000;
        ally.sacrificeEnd = true;
        log(state, `${ally.name} canaliza poder: +6000 ATK, vai para o descarte no fim do turno.`);
        fx(state, { kind: "buff", targetId: ally.id, text: "+6000 ATK" });
      }
      break;
    }
    case "overclock": {
      for (const u of [controller.leader, ...controller.field.filter(isUnit)]) {
        u.tempAtk += 2000;
        fx(state, { kind: "buff", targetId: u.id, text: "+2000 ATK" });
      }
      log(state, `${card.name}: todas as cartas de ${controller.name} ganham +2000 ATK neste turno.`);
      break;
    }
    case "restaurar": {
      let healed = 0;
      for (const u of controller.field) {
        if (u.damage <= 0) continue;
        const amount = Math.min(3000, u.damage);
        u.damage -= amount;
        healed += 1;
        fx(state, { kind: "heal", targetId: u.id, amount });
      }
      log(
        state,
        healed
          ? `${card.name} recupera a defesa de ${healed} carta(s) aliada(s).`
          : `${card.name}: nenhuma carta aliada estava danificada.`,
      );
      break;
    }
    case "reiniciar": {
      if (ally) {
        const healed = ally.damage;
        ally.damage = 0;
        ally.buffAtaque += 2000;
        log(state, `${ally.name} é reiniciado: defesa total e +2000 ATK permanente.`);
        if (healed > 0) fx(state, { kind: "heal", targetId: ally.id, amount: healed });
        fx(state, { kind: "buff", targetId: ally.id, text: "+2000 ATK" });
      }
      break;
    }
    default:
      break;
  }

  controller.grave.push(card);
}

export function resolveAll(state: GameState) {
  while (state.stack.length) resolveTop(state);
}

// ============================================================
// HABILIDADES ATIVÁVEIS (Estudante, Engibot, H4kB0T)
// ============================================================

export function activateBlockReason(
  state: GameState,
  player: 0 | 1,
  cardId: string,
): string | null {
  if (state.winner != null) return "A partida acabou.";
  if (state.pending) return "Responda à escolha na tela primeiro.";
  if (state.active !== player) return "Espere a sua vez.";
  const p = state.players[player];
  const unit = p.field.find((c) => c.id === cardId);
  if (!unit) return "Unidade não encontrada no seu campo.";
  if (unit.usedActivated) return `A habilidade de ${unit.name} já foi usada neste turno.`;
  if (unit.defId === "estudante") {
    if (p.energy < 2) return "Precisa de 2 energias.";
    if (!p.deck.some((c) => c.defId === "tomo")) return "Não há Tomo da Sabedoria no baralho.";
    return null;
  }
  if (unit.defId === "engibot") {
    if (p.field.length >= MAX_FIELD) return `Campo cheio (máximo de ${MAX_FIELD} personagens).`;
    return null;
  }
  if (unit.defId === "hackbot") {
    const any = state.players.some((pl) => pl.field.some(isUnit));
    return any ? null : "Não há unidades em campo para alterar.";
  }
  return `${unit.name} não tem habilidade ativável.`;
}

export function activateAbility(
  state: GameState,
  player: 0 | 1,
  cardId: string,
  target: EffectTarget | null = null,
): { ok: boolean; error?: string } {
  const reason = activateBlockReason(state, player, cardId);
  if (reason) return { ok: false, error: reason };
  const p = state.players[player];
  const unit = p.field.find((c) => c.id === cardId) as CardInstance;

  if (unit.defId === "estudante") {
    const idx = p.deck.findIndex((c) => c.defId === "tomo");
    p.energy -= 2;
    unit.usedActivated = true;
    const item = p.deck.splice(idx, 1)[0] as CardInstance;
    p.hand.push(item);
    log(state, `${unit.name} busca ${item.name} no baralho.`);
    fx(state, { kind: "buff", targetId: unit.id, text: "Buscou o Tomo" });
    return { ok: true };
  }

  if (unit.defId === "engibot") {
    const token = instantiate("torreta", player);
    token.summonedThisTurn = true;
    p.field.push(token);
    unit.usedActivated = true;
    log(state, `${unit.name} constrói uma Torreta.`);
    state.lastAction = "summon";
    return { ok: true };
  }

  // H4kB0T: troca ATK e DEF base de uma unidade alvo.
  if (target?.kind !== "card") return { ok: false, error: "Escolha a unidade alvo." };
  const ownerIdx = state.players.findIndex((pl) => pl.field.some((c) => c.id === target.cardId));
  const t = ownerIdx >= 0 ? state.players[ownerIdx]!.field.find((c) => c.id === target.cardId) : undefined;
  if (!t || !isUnit(t)) return { ok: false, error: "Escolha uma unidade em campo." };
  const a = t.attack;
  t.attack = t.defense;
  t.defense = a;
  unit.usedActivated = true;
  log(state, `${unit.name} hackeia ${t.name}: ATK ${t.attack} / DEF ${t.defense}.`);
  fx(state, { kind: "buff", targetId: t.id, text: "ATK ⇄ DEF" });
  checkDeaths(state);
  return { ok: true };
}

// ============================================================
// ATAQUES
// ============================================================

export function defendersOf(p: PlayerState): CardInstance[] {
  return p.field.filter((c) => isUnit(c) && c.keywords.includes("Defender"));
}

/** Motivo pelo qual a carta não pode atacar agora (ou null se pode). */
export function attackBlockReason(
  state: GameState,
  player: 0 | 1,
  attackerId: string,
): string | null {
  if (state.winner != null) return "A partida acabou.";
  if (state.pending) return "Responda à escolha na tela primeiro.";
  if (state.active !== player) return "Espere a sua vez para atacar.";
  if (state.phase !== "MAIN" && state.phase !== "ATTACK") return "Agora não é possível atacar.";
  if (state.firstTurnNoAttack && state.turn <= 2) {
    return "Na primeira rodada (turnos 1 e 2) ninguém ataca. Monte o seu campo — os ataques começam no turno 3!";
  }
  const p = state.players[player];
  const isLeader = p.leader.id === attackerId;
  const c = isLeader ? p.leader : p.field.find((x) => x.id === attackerId);
  if (!c) return "Escolha uma carta sua do campo ou o seu líder para atacar.";
  if (!isLeader && !isUnit(c)) return `${c.name} não é um personagem.`;
  if (c.summonedThisTurn) {
    return `${c.name} acabou de entrar em campo e só ataca no próximo turno (cartas com Apressado atacam na hora).`;
  }
  if (c.attacksUsed >= maxAttacks(c)) return `${c.name} já atacou neste turno.`;
  if (atkTotal(c, p) <= 0) return `${c.name} não tem poder de ataque.`;
  return null;
}

export function canAttack(state: GameState, player: 0 | 1, attackerId: string): boolean {
  return attackBlockReason(state, player, attackerId) === null;
}

/** Motivo pelo qual o alvo não pode ser atacado (regra do Defensor). */
export function targetBlockReason(
  state: GameState,
  player: 0 | 1,
  target: AttackTarget,
  attackerId?: string,
): string | null {
  const o = state.players[opp(player)];
  const guards = defendersOf(o);
  const names = guards.map((g) => g.name).join(", ");
  if (target.kind === "card") {
    const d = o.field.find((c) => c.id === target.cardId);
    if (!d || !isUnit(d)) return "Esse alvo não pode ser atacado.";
    if (guards.length && !d.keywords.includes("Defender")) {
      return `Derrote primeiro o Defensor (${names}).`;
    }
    return null;
  }
  if (guards.length) return `${names} protege o líder. Derrote os Defensores primeiro.`;
  const p = state.players[player];
  const attacker = attackerId ? findAttacker(p, attackerId) : undefined;
  if (attacker && atkTotal(attacker, p) < leaderDefense(o)) {
    return `${attacker.name} (ATK ${atkTotal(attacker, p)}) não supera a defesa ${leaderDefense(o)} de ${o.leader.name}. Ataque uma carta ou fortaleça o ataque.`;
  }
  return null;
}

export function legalTargets(state: GameState, player: 0 | 1, attackerId?: string): AttackTarget[] {
  const o = state.players[opp(player)];
  const all: AttackTarget[] = [
    { kind: "leader" },
    ...o.field.filter(isUnit).map((c) => ({ kind: "card" as const, cardId: c.id })),
  ];
  return all.filter((t) => targetBlockReason(state, player, t, attackerId) === null);
}

/** Counters que o defensor pode pagar agora. */
export function counterOptions(state: GameState, defender: 0 | 1): CardInstance[] {
  const p = state.players[defender];
  return p.hand.filter((c) => c.speed === "Counter" && effectiveCost(c, p) <= p.energy);
}

export function receiveDamage(state: GameState, player: 0 | 1, amount: number) {
  const p = state.players[player];
  for (let i = 0; i < amount; i++) {
    if (!p.life.length) {
      p.alive = false;
      break;
    }
    const lifeCard = p.life.shift() as CardInstance;
    p.hand.push(lifeCard);
    log(state, `${p.name} perde uma vida. ${lifeCard.name} vai para a mão.`);
  }
  fx(state, { kind: "leader-hit", side: player, targetId: p.leader.id, amount });
  checkWinner(state);
}

function destroyUnit(state: GameState, ownerIdx: 0 | 1, card: CardInstance, text: string) {
  const p = state.players[ownerIdx];
  p.field = p.field.filter((c) => c.id !== card.id);
  fx(state, { kind: "destroy", side: ownerIdx, targetId: card.id, card: cloneCard(card) });
  if (card.cardType !== "Ficha") {
    card.damage = 0;
    card.tempAtk = 0;
    card.sacrificeEnd = false;
    card.countdown = 0;
    p.grave.push(card);
  }
  log(state, text);
}

/** Destrói unidades cuja defesa atual chegou a 0 (dano ≥ vida). */
function checkDeaths(state: GameState) {
  for (const idx of [0, 1] as const) {
    const p = state.players[idx];
    for (const c of [...p.field]) {
      if (isUnit(c) && defNow(c, p) <= 0) {
        destroyUnit(state, idx, c, `${c.name} não resiste e é destruído.`);
      }
    }
  }
}

function findAttacker(p: PlayerState, id: string): CardInstance | undefined {
  return p.leader.id === id ? p.leader : p.field.find((c) => c.id === id);
}

function resolveCombat(
  state: GameState,
  attackerOwner: 0 | 1,
  attackerId: string,
  targetId: string,
  counterId: string | null,
) {
  const p = state.players[attackerOwner];
  const defIdx = opp(attackerOwner);
  const o = state.players[defIdx];
  const attacker = findAttacker(p, attackerId);
  const defender = o.field.find((c) => c.id === targetId);
  if (!attacker || !defender) return;

  let shield = defender.counter;
  if (counterId) {
    const ci = o.hand.findIndex((c) => c.id === counterId && c.speed === "Counter");
    const counterCard = ci >= 0 ? o.hand[ci] : undefined;
    if (counterCard && effectiveCost(counterCard, o) <= o.energy) {
      o.energy -= effectiveCost(counterCard, o);
      o.hand.splice(ci, 1);
      o.grave.push(counterCard);
      shield += COUNTER_BONUS;
      log(state, `${o.name} responde com ${counterCard.name}: ${defender.name} +${COUNTER_BONUS} DEF.`);
      fx(state, { kind: "shield", targetId: defender.id, text: `${counterCard.name} +${COUNTER_BONUS}` });
    }
  }

  const atk = atkTotal(attacker, p);
  const now = defNow(defender, o);
  if (atk >= now + shield) {
    fx(state, { kind: "damage", side: defIdx, targetId: defender.id, amount: atk });
    destroyUnit(state, defIdx, defender, `${attacker.name} (${atk}) destrói ${defender.name} (${now + shield}).`);
    return;
  }
  const dmg = Math.max(0, atk - shield);
  defender.damage += dmg;
  if (dmg > 0) {
    fx(state, { kind: "damage", side: defIdx, targetId: defender.id, amount: dmg });
    log(
      state,
      `${attacker.name} causa ${dmg} de dano em ${defender.name} (defesa ${defNow(defender, o)}).`,
    );
  } else {
    fx(state, { kind: "shield", targetId: defender.id, text: "Bloqueou!" });
    log(state, `${defender.name} bloqueia todo o ataque de ${attacker.name}.`);
  }
}

/** Habilidade do Rogen: olha 5 do topo e escolhe 1 para a mão. */
function triggerRogen(state: GameState, player: 0 | 1) {
  const p = state.players[player];
  if (p.leader.defId !== "rogen" || p.energy < 3 || !p.deck.length || state.winner != null) return;
  state.pending = {
    kind: "pick",
    player,
    title: "Habilidade de Rogen",
    reason: "Escolha 1 carta para a mão. As outras vão para o fundo do baralho.",
    cards: p.deck.slice(0, 5).map(cloneCard),
  };
}

export function attack(
  state: GameState,
  player: 0 | 1,
  attackerId: string,
  target: AttackTarget,
): { ok: boolean; error?: string } {
  const reason = attackBlockReason(state, player, attackerId);
  if (reason) return { ok: false, error: reason };
  const tReason = targetBlockReason(state, player, target, attackerId);
  if (tReason) return { ok: false, error: tReason };

  const p = state.players[player];
  const defIdx = opp(player);
  const o = state.players[defIdx];
  const attacker = findAttacker(p, attackerId) as CardInstance;
  const isLeader = attacker.id === p.leader.id;

  state.phase = "ATTACK";
  attacker.attacksUsed += 1;
  attacker.jaAtacou = attacker.attacksUsed >= maxAttacks(attacker);
  state.lastAction = "attack";
  const rogen = isLeader && attacker.defId === "rogen";

  if (target.kind === "leader") {
    fx(state, { kind: "attack", side: player, fromId: attacker.id, targetId: o.leader.id });
    log(state, `${attacker.name} ataca o líder ${o.leader.name}.`);
    receiveDamage(state, defIdx, 1);
    if (rogen) triggerRogen(state, player);
    return { ok: true };
  }

  const defender = o.field.find((c) => c.id === target.cardId) as CardInstance;
  fx(state, { kind: "attack", side: player, fromId: attacker.id, targetId: defender.id });
  log(state, `${attacker.name} ataca ${defender.name}.`);
  const options = counterOptions(state, defIdx);
  if (options.length) {
    state.pending = {
      kind: "counter",
      player: defIdx,
      attackerOwner: player,
      attackerId: attacker.id,
      targetId: defender.id,
      options: options.map((c) => c.id),
      rogenAfter: rogen,
    };
    return { ok: true };
  }
  resolveCombat(state, player, attacker.id, defender.id, null);
  if (rogen) triggerRogen(state, player);
  return { ok: true };
}

// ============================================================
// RESPOSTAS ÀS DECISÕES PENDENTES
// ============================================================

export function answerCounter(state: GameState, counterId: string | null) {
  const pend = state.pending;
  if (!pend || pend.kind !== "counter") return;
  state.pending = null;
  resolveCombat(state, pend.attackerOwner, pend.attackerId, pend.targetId, counterId);
  if (pend.rogenAfter) triggerRogen(state, pend.attackerOwner);
}

export function answerPick(state: GameState, cardId: string | null) {
  const pend = state.pending;
  if (!pend || pend.kind !== "pick") return;
  state.pending = null;
  const p = state.players[pend.player];
  if (!cardId) {
    log(state, `${p.name} olha o topo do baralho e não pega nenhuma carta.`);
    return;
  }
  const looked = new Set(pend.cards.map((c) => c.id));
  const top = p.deck.filter((c) => looked.has(c.id));
  const rest = p.deck.filter((c) => !looked.has(c.id));
  const chosen = top.find((c) => c.id === cardId);
  if (!chosen) return;
  p.hand.push(chosen);
  p.deck = rest.concat(top.filter((c) => c.id !== cardId));
  log(state, `${p.leader.name} usa a habilidade e busca ${pend.player === 1 ? "uma carta" : chosen.name}.`);
  fx(state, { kind: "buff", targetId: p.leader.id, text: "+1 carta" });
}

export function answerBomia(state: GameState, toLife: boolean) {
  const pend = state.pending;
  if (!pend || pend.kind !== "bomia") return;
  state.pending = null;
  const p = state.players[pend.player];
  if (!toLife) return;
  const i = p.hand.findIndex((c) => c.id === pend.card.id);
  if (i < 0) return;
  const card = p.hand.splice(i, 1)[0] as CardInstance;
  p.life.push(card);
  log(state, `Bomia: ${p.name} coloca a carta comprada na Zona de Vida.`);
  fx(state, { kind: "life", side: pend.player, targetId: p.leader.id, amount: 1 });
}

// ============================================================
// UTILITÁRIOS
// ============================================================

export function dismissReveal(state: GameState) {
  state.reveal = null;
}

export function unitsOn(p: PlayerState) {
  return p.field.filter(isUnit);
}

export function findCard(state: GameState, id: string): CardInstance | undefined {
  for (const p of state.players) {
    const hit = findAnywhere(p, id);
    if (hit) return hit;
  }
  return undefined;
}
