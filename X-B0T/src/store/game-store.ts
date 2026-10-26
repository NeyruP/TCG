import { create } from "zustand";
import { aiAnswerPending, applyAiStep } from "@/lib/game/ai";
import { abilityTargetNeed } from "@/lib/game/cards";
import { sfx, unlockAudio } from "@/lib/game/audio";
import * as engine from "@/lib/game/engine";
import { canAttack, canPlay, createMatch, createTutorialMatch } from "@/lib/game/engine";
import { aiSkillFrom, loadProgress, saveProgress, type Progress } from "@/lib/game/persist";
import type { AttackTarget, EffectTarget, Faction, GameState, Screen } from "@/lib/game/types";
import { XB, isMirror, type EngineFnName } from "@/lib/multiplayer/xb";

/**
 * Numa partida multiplayer a mesa na tela é uma cópia espelhada (ver lib/multiplayer):
 * a jogada vai para o multiplayer, que aplica na mesa verdadeira. No modo solo passa direto.
 */
function viaMp<F extends (state: GameState, ...args: never[]) => unknown>(name: EngineFnName, fn: F): F {
  const direto = fn as unknown as (state: GameState, ...args: unknown[]) => unknown;
  const roteado = (state: GameState, ...args: unknown[]) =>
    isMirror(state) && XB.mp?.mode ? XB.mp.act(name, args, state) : direto(state, ...args);
  return roteado as unknown as F;
}
const playCard = viaMp("playCard", engine.playCard);
const attack = viaMp("attack", engine.attack);
const activateAbility = viaMp("activateAbility", engine.activateAbility);
const answerCounter = viaMp("answerCounter", engine.answerCounter);
const answerPick = viaMp("answerPick", engine.answerPick);
const answerBomia = viaMp("answerBomia", engine.answerBomia);
const setPhase = viaMp("setPhase", engine.setPhase);
const endTurn = viaMp("endTurn", engine.endTurn);
const dismissReveal = viaMp("dismissReveal", engine.dismissReveal);
const resolveAll = viaMp("resolveAll", engine.resolveAll);

export interface DragState {
  cardId: string;
  from: "hand" | "field" | "leader";
  x: number;
  y: number;
}

/** "play": carta da mão esperando alvo. "ability": habilidade (H4kB0T) esperando alvo. */
export interface Targeting {
  cardId: string;
  mode: "play" | "ability";
}

interface GameStore {
  screen: Screen;
  progress: Progress;
  skill: number;
  state: GameState | null;
  selectedId: string | null;
  hoverId: string | null;
  targeting: Targeting | null;
  drag: DragState | null;
  toast: string | null;
  aiBusy: boolean;
  tutorialStep: number;
  result: "win" | "lose" | null;
  go: (s: Screen) => void;
  hydrate: () => void;
  startMatch: (faction: Faction, tutorial?: boolean) => void;
  hover: (id: string | null) => void;
  select: (id: string | null) => void;
  notify: (msg: string) => void;
  tryPlay: (cardId: string, target?: EffectTarget | null) => boolean;
  tryAttack: (attackerId: string, target: AttackTarget) => boolean;
  tryActivate: (cardId: string, target?: EffectTarget | null) => boolean;
  answerCounter: (counterId: string | null) => void;
  answerPick: (cardId: string | null) => void;
  answerBomia: (toLife: boolean) => void;
  toAttack: () => void;
  toMain: () => void;
  passTurn: () => void;
  setDrag: (d: DragState | null) => void;
  closeReveal: () => void;
  setTutorialStep: (n: number) => void;
  finishTutorial: () => void;
}

function bumpProgress(won: boolean, faction: Faction): Progress {
  const p = loadProgress();
  p.matchesPlayed += 1;
  if (won) p.matchesWon += 1;
  p.lastFaction = faction;
  saveProgress(p);
  return p;
}

/** Publica o estado; se a partida acabou, vai para a tela de resultado. */
function publish(state: GameState, extra: Partial<GameStore> = {}) {
  if (XB.mp && XB.on() && isMirror(state)) {
    XB.mp.publish(state, extra);
    return;
  }
  if (state.winner != null) {
    const won = state.winner === 0;
    const progress = bumpProgress(won, state.players[0].faction);
    if (won) sfx.win();
    else sfx.lose();
    useGame.setState({ state: { ...state }, ...extra, aiBusy: false });
    // Pequena pausa para os efeitos do golpe final aparecerem.
    window.setTimeout(() => {
      useGame.setState({
        progress,
        skill: aiSkillFrom(progress),
        result: won ? "win" : "lose",
        screen: "result",
      });
    }, 1100);
    return;
  }
  useGame.setState({ state: { ...state }, ...extra });
}

export const useGame = create<GameStore>((set, get) => ({
  screen: "home",
  progress: loadProgress(),
  skill: aiSkillFrom(loadProgress()),
  state: null,
  selectedId: null,
  hoverId: null,
  targeting: null,
  drag: null,
  toast: null,
  aiBusy: false,
  tutorialStep: 0,
  result: null,

  go: (screen) => set({ screen }),
  hydrate: () => {
    const progress = loadProgress();
    set({ progress, skill: aiSkillFrom(progress) });
  },

  startMatch: (faction, tutorial = false) => {
    unlockAudio();
    const aiFaction: Faction = faction === "magic" ? "machine" : "magic";
    const state = tutorial
      ? createTutorialMatch()
      : createMatch({ playerFaction: faction, aiFaction });
    set({
      state,
      screen: tutorial ? "tutorial" : "play",
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
  },

  hover: (id) => set({ hoverId: id }),
  select: (id) => set({ selectedId: id, targeting: null }),
  notify: (msg) => set({ toast: msg }),

  tryPlay: (cardId, target = null) => {
    const { state } = get();
    if (!state || get().aiBusy) return false;
    const r = playCard(state, 0, cardId, target);
    if (!r.ok) {
      set({ toast: r.error ?? "Jogada inválida." });
      sfx.error();
      return false;
    }
    sfx.play();
    if (state.stack.length) resolveAll(state);
    publish(state, { targeting: null, selectedId: null, toast: null });
    return true;
  },

  tryAttack: (attackerId, target) => {
    const { state, skill } = get();
    if (!state || get().aiBusy) return false;
    const r = attack(state, 0, attackerId, target);
    if (!r.ok) {
      set({ toast: r.error ?? "Ataque inválido." });
      sfx.error();
      return false;
    }
    // A máquina decide na hora se usa um Counter.
    if (!XB.on() && state.pending?.player === 1) aiAnswerPending(state, skill);
    const keep = canAttack(state, 0, attackerId) ? attackerId : null;
    publish(state, { selectedId: keep, targeting: null, toast: null });
    return true;
  },

  tryActivate: (cardId, target = null) => {
    const { state } = get();
    if (!state || get().aiBusy) return false;
    const unit = state.players[0].field.find((c) => c.id === cardId);
    if (unit && abilityTargetNeed(unit) !== "none" && !target) {
      set({ targeting: { cardId, mode: "ability" }, selectedId: cardId, toast: null });
      return false;
    }
    const r = activateAbility(state, 0, cardId, target);
    if (!r.ok) {
      set({ toast: r.error ?? "Não foi possível." });
      sfx.error();
      return false;
    }
    sfx.play();
    publish(state, { targeting: null, toast: null });
    return true;
  },

  answerCounter: (counterId) => {
    const { state } = get();
    if (!state) return;
    answerCounter(state, counterId);
    afterAnswer(state);
  },

  answerPick: (cardId) => {
    const { state } = get();
    if (!state) return;
    answerPick(state, cardId);
    afterAnswer(state);
  },

  answerBomia: (toLife) => {
    const { state } = get();
    if (!state) return;
    answerBomia(state, toLife);
    afterAnswer(state);
  },

  toAttack: () => {
    const { state } = get();
    if (!state || get().aiBusy) return;
    setPhase(state, "ATTACK");
    set({ state: { ...state }, targeting: null });
  },

  toMain: () => {
    const { state } = get();
    if (!state || get().aiBusy) return;
    setPhase(state, "MAIN");
    set({ state: { ...state }, targeting: null });
  },

  passTurn: () => {
    const store = get();
    const { state } = store;
    if (!state || store.aiBusy || state.active !== 0) return;
    if (state.pending) {
      set({ toast: "Responda à escolha na tela primeiro." });
      return;
    }
    endTurn(state);
    if (state.winner != null) {
      publish(state);
      return;
    }
    set({ state: { ...state }, aiBusy: true, selectedId: null, targeting: null });
    runAiLoop();
  },

  setDrag: (drag) => set({ drag }),
  closeReveal: () => {
    const { state } = get();
    if (!state) return;
    dismissReveal(state);
    set({ state: { ...state } });
  },
  setTutorialStep: (n) => set({ tutorialStep: n }),
  finishTutorial: () => {
    const progress = loadProgress();
    progress.tutorialDone = true;
    saveProgress(progress);
    set({ progress, screen: "setup" });
  },
}));

/** Depois que o jogador responde, a máquina continua o turno dela (se for o caso). */
function afterAnswer(state: GameState) {
  const { skill } = useGame.getState();
  if (!XB.on() && state.pending?.player === 1) aiAnswerPending(state, skill);
  publish(state);
  if (state.winner == null && state.active === 1) {
    useGame.setState({ aiBusy: true });
    runAiLoop();
  }
}

let aiTimer: number | null = null;

function runAiLoop() {
  if (aiTimer != null) window.clearTimeout(aiTimer);
  // Multiplayer: quem joga do outro lado é uma pessoa.
  if (XB.on()) {
    useGame.setState({ aiBusy: false });
    return;
  }
  const step = () => {
    aiTimer = null;
    const { state, skill } = useGame.getState();
    if (!state) return;
    if (state.winner != null) {
      publish(state);
      return;
    }
    if (state.active !== 1) {
      if (state.pending?.player === 1) aiAnswerPending(state, skill);
      publish(state, { aiBusy: false });
      return;
    }
    const status = applyAiStep(state, skill);
    if (status === "wait") {
      // Esperando o jogador (Counter / Bomia). afterAnswer retoma o loop.
      useGame.setState({ state: { ...state } });
      return;
    }
    if (status === "done") {
      publish(state, { aiBusy: false });
      return;
    }
    publish(state);
    if (state.winner != null) return;
    const delay = 650 + Math.random() * 400;
    aiTimer = window.setTimeout(step, delay);
  };
  aiTimer = window.setTimeout(step, 700);
}

export { canPlay, canAttack };
