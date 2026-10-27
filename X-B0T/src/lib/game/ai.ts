import { targetNeedFor } from "./cards";
import {
  activateAbility,
  activateBlockReason,
  answerBomia,
  answerCounter,
  answerPick,
  atkTotal,
  attack,
  canAttack,
  canPlay,
  COUNTER_BONUS,
  defendersOf,
  defNow,
  effectiveCost,
  endTurn,
  isUnit,
  legalTargets,
  playCard,
  resolveAll,
  setPhase,
  unitsOn,
} from "./engine";
import type {
  AttackTarget,
  CardInstance,
  EffectTarget,
  GameState,
  PlayerState,
} from "./types";

export function skillLabel(skill: number): string {
  if (skill <= 1) return "Aprendiz";
  if (skill <= 3) return "Estudante";
  if (skill <= 5) return "Técnico";
  if (skill <= 7) return "Veterano";
  return "Mestre";
}

function rand() {
  return Math.random();
}

function pick<T>(arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(rand() * arr.length)];
}

function missChance(skill: number) {
  return Math.max(0.08, 0.55 - skill * 0.05);
}

function bestTarget(card: CardInstance, me: PlayerState): EffectTarget | null {
  const need = targetNeedFor(card);
  if (need === "none") return null;
  const units = unitsOn(me);
  if (need === "estudante") {
    const t = units.find((c) => c.defId === "estudante");
    return t ? { kind: "card", cardId: t.id } : null;
  }
  if (card.defId === "reiniciar") {
    const t = [...units].sort((a, b) => b.damage - a.damage || b.attack - a.attack)[0];
    return t ? { kind: "card", cardId: t.id } : null;
  }
  if (card.defId === "canalizar") {
    const t = units.find((c) => !c.summonedThisTurn && !c.jaAtacou);
    return t ? { kind: "card", cardId: t.id } : null;
  }
  const t = [...units].sort((a, b) => defNow(a, me) - defNow(b, me))[0];
  return t ? { kind: "card", cardId: t.id } : null;
}

type AiStep =
  | { type: "answer" }
  | { type: "wait" }
  | { type: "play"; cardId: string; target: EffectTarget | null }
  | { type: "activate"; cardId: string; target: EffectTarget | null }
  | { type: "phase-attack" }
  | { type: "attack"; attackerId: string; target: AttackTarget }
  | { type: "end" };

function mainPhaseStep(state: GameState, skill: number): AiStep | null {
  const me = state.players[1];
  const you = state.players[0];
  const miss = missChance(skill);
  const playable = me.hand.filter((c) => canPlay(state, 1, c.id));

  const terrain = playable.find(
    (c) => c.cardType === "Terreno" && c.defId !== me.terrain?.defId,
  );
  if (terrain && skill >= 1) return { type: "play", cardId: terrain.id, target: null };

  const units = playable.filter(isUnit);
  // Com o líder frágil e sem Defensor em campo, a prioridade é se proteger.
  if (me.life.length <= 2 && !defendersOf(me).length) {
    const guard = units.find((c) => c.keywords.includes("Defender"));
    if (guard) return { type: "play", cardId: guard.id, target: null };
  }
  if (units.length && (me.field.length < 2 || rand() > miss * 0.6)) {
    const ranked = [...units].sort((a, b) => {
      const va = a.attack / Math.max(1, effectiveCost(a, me));
      const vb = b.attack / Math.max(1, effectiveCost(b, me));
      return skill >= 3 ? vb - va : va - vb;
    });
    const choice = skill >= 5 ? ranked[0]! : pick(ranked)!;
    return { type: "play", cardId: choice.id, target: null };
  }

  for (const card of playable) {
    if (card.cardType === "Item" && skill >= 2) {
      const target = bestTarget(card, me);
      if (target) return { type: "play", cardId: card.id, target };
    }
    if (card.defId === "graduacao") {
      const target = bestTarget(card, me);
      if (target) return { type: "play", cardId: card.id, target };
    }
    if (card.defId === "reiniciar" && skill >= 3 && unitsOn(me).some((u) => u.damage >= 2000)) {
      return { type: "play", cardId: card.id, target: bestTarget(card, me) };
    }
    if (card.defId === "restaurar") {
      const hurt = unitsOn(me).reduce((n, u) => n + Math.min(3000, u.damage), 0);
      if (hurt >= 2000) return { type: "play", cardId: card.id, target: null };
    }
    if (card.defId === "overclock" && skill >= 2) {
      const ready = [me.leader, ...me.field].filter((c) => canAttack(state, 1, c.id));
      if (ready.length >= 2) return { type: "play", cardId: card.id, target: null };
    }
    if (card.defId === "anular" && skill >= 3 && rand() > 0.5) {
      return { type: "play", cardId: card.id, target: null };
    }
    if (card.defId === "canalizar" && skill >= 4 && rand() > 0.5) {
      const target = bestTarget(card, me);
      if (target) return { type: "play", cardId: card.id, target };
    }
  }

  for (const unit of me.field) {
    if (activateBlockReason(state, 1, unit.id)) continue;
    if (unit.defId === "lectrabo") return { type: "activate", cardId: unit.id, target: null };
    if (unit.defId === "engibot") return { type: "activate", cardId: unit.id, target: null };
    if (unit.defId === "estudante" && skill >= 3 && rand() > 0.4) {
      return { type: "activate", cardId: unit.id, target: null };
    }
    if (unit.defId === "hackbot" && skill >= 2 && !you.field.some((c) => c.defId === "mabo")) {
      // Enfraquece o atacante inimigo com mais ATK do que DEF.
      const prey = [...unitsOn(you)]
        .filter((c) => c.attack - c.defense >= 2000)
        .sort((a, b) => b.attack - b.defense - (a.attack - a.defense))[0];
      if (prey) return { type: "activate", cardId: unit.id, target: { kind: "card", cardId: prey.id } };
    }
  }

  // Iniciante às vezes "esquece" jogadas, mas nunca deixa o campo vazio.
  if (rand() < miss * 0.5 && playable.length && skill <= 2 && me.field.length >= 2) {
    return { type: "end" };
  }
  return null;
}

function attackStep(state: GameState, skill: number): AiStep {
  const me = state.players[1];
  const you = state.players[0];
  const miss = missChance(skill);

  const attackers = [me.leader, ...me.field].filter(
    (c) => canAttack(state, 1, c.id) && legalTargets(state, 1, c.id).length > 0,
  );
  if (!attackers.length) return { type: "end" };
  const attacker =
    skill >= 4
      ? [...attackers].sort((a, b) => atkTotal(b, me) - atkTotal(a, me))[0]!
      : pick(attackers)!;
  const atk = atkTotal(attacker, me);

  const targets = legalTargets(state, 1, attacker.id);
  const cardTargets = targets
    .filter((t): t is { kind: "card"; cardId: string } => t.kind === "card")
    .map((t) => you.field.find((c) => c.id === t.cardId)!)
    .filter(Boolean);
  const leaderOpen = targets.some((t) => t.kind === "leader");

  const killable = cardTargets.filter((d) => atk >= defNow(d, you) + d.counter);
  if (killable.length && (skill >= 3 || !leaderOpen) && rand() > miss) {
    const prey = [...killable].sort((a, b) => atkTotal(b, you) - atkTotal(a, you))[0]!;
    return { type: "attack", attackerId: attacker.id, target: { kind: "card", cardId: prey.id } };
  }
  if (leaderOpen) return { type: "attack", attackerId: attacker.id, target: { kind: "leader" } };
  if (cardTargets.length && (killable.length || defendersOf(you).length || skill < 3)) {
    const wall = [...cardTargets].sort((a, b) => defNow(a, you) - defNow(b, you))[0]!;
    return { type: "attack", attackerId: attacker.id, target: { kind: "card", cardId: wall.id } };
  }
  return { type: "end" };
}

export function nextAiStep(state: GameState, skill: number): AiStep {
  if (state.pending) {
    return state.pending.player === 1 ? { type: "answer" } : { type: "wait" };
  }
  if (state.active !== 1) return { type: "end" };
  if (state.phase === "MAIN") return mainPhaseStep(state, skill) ?? { type: "phase-attack" };
  if (state.phase === "ATTACK") return attackStep(state, skill);
  return { type: "end" };
}

/** A máquina responde a uma decisão pendente dela (Counter, Rogen, Bomia). */
export function aiAnswerPending(state: GameState, skill: number) {
  const pend = state.pending;
  if (!pend || pend.player !== 1) return;
  const me = state.players[1];
  if (pend.kind === "counter") {
    const you = state.players[pend.attackerOwner];
    const attacker =
      you.leader.id === pend.attackerId ? you.leader : you.field.find((c) => c.id === pend.attackerId);
    const target = me.field.find((c) => c.id === pend.targetId);
    let use: string | null = null;
    if (attacker && target && skill >= 1 && rand() > missChance(skill)) {
      const atk = atkTotal(attacker, you);
      const def = defNow(target, me) + target.counter;
      if (atk >= def && atk < def + COUNTER_BONUS) use = pend.options[0] ?? null;
    }
    answerCounter(state, use);
    return;
  }
  if (pend.kind === "pick") {
    const best = [...pend.cards].sort(
      (a, b) => Number(isUnit(b)) - Number(isUnit(a)) || b.attack - a.attack,
    )[0];
    answerPick(state, best?.id ?? null);
    return;
  }
  answerBomia(state, me.hand.length >= 3);
}

/**
 * Executa um passo da máquina. "wait" = esperando o jogador decidir
 * (ex.: usar um Counter). Se uma jogada falhar, a máquina avança de fase
 * para nunca ficar presa em loop.
 */
export function applyAiStep(state: GameState, skill: number): "continue" | "wait" | "done" {
  const step = nextAiStep(state, skill);
  switch (step.type) {
    case "answer":
      aiAnswerPending(state, skill);
      return "continue";
    case "wait":
      return "wait";
    case "play": {
      const r = playCard(state, 1, step.cardId, step.target);
      if (r.ok && state.stack.length) resolveAll(state);
      if (!r.ok) setPhase(state, "ATTACK");
      return "continue";
    }
    case "activate": {
      const r = activateAbility(state, 1, step.cardId, step.target);
      if (!r.ok) setPhase(state, "ATTACK");
      return "continue";
    }
    case "phase-attack":
      setPhase(state, "ATTACK");
      return "continue";
    case "attack": {
      const r = attack(state, 1, step.attackerId, step.target);
      if (!r.ok) {
        endTurn(state);
        return "done";
      }
      return "continue";
    }
    case "end":
      if (state.stack.length) {
        resolveAll(state);
        return "continue";
      }
      if (state.active === 1) endTurn(state);
      return "done";
  }
}
