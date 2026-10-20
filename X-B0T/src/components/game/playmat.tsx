import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { BookOpen, Heart, Layers, ScrollText, SkipForward, Sparkles, Swords, Trash2, Zap } from "lucide-react";
import { skillLabel } from "@/lib/game/ai";
import { sfx } from "@/lib/game/audio";
import { hasActivated, targetNeedFor as needOf } from "@/lib/game/cards";
import {
  atkTotal,
  attackBlockReason,
  canAttack,
  defendersOf,
  defMax,
  defNow,
  effectiveCost,
  isUnit,
  leaderDefense,
  legalTargets,
  MAX_FIELD,
  playBlockReason,
} from "@/lib/game/engine";
import type { CardInstance, GameState, PlayerState } from "@/lib/game/types";

import { Button } from "@/components/ui/button";
import { useGame } from "@/store/game-store";
import { cn } from "@/lib/utils";
import { CardView, MiniPile, type CardStats } from "./card-view";
import { FxLayer } from "./fx-layer";

type DragFrom = "hand" | "field" | "leader";

function statsOf(card: CardInstance, owner: PlayerState): CardStats {
  const isLeader = card.id === owner.leader.id;
  return {
    atk: atkTotal(card, owner),
    def: isLeader ? leaderDefense(owner) : defNow(card, owner),
    defMax: isLeader ? leaderDefense(owner) : defMax(card, owner),
  };
}

function ownerOfCard(state: GameState, id: string): PlayerState | undefined {
  return state.players.find(
    (p) =>
      p.leader.id === id ||
      p.terrain?.id === id ||
      p.field.some((c) => c.id === id) ||
      p.hand.some((c) => c.id === id) ||
      p.grave.some((c) => c.id === id),
  );
}

function zoneAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const zone = el?.closest("[data-drop]") as HTMLElement | null;
  return zone?.dataset.drop ?? null;
}

export function Playmat({ tutorial }: { tutorial?: boolean }) {
  const state = useGame((s) => s.state);
  const hoverId = useGame((s) => s.hoverId);
  const selectedId = useGame((s) => s.selectedId);
  const targeting = useGame((s) => s.targeting);
  const drag = useGame((s) => s.drag);
  const aiBusy = useGame((s) => s.aiBusy);
  const toast = useGame((s) => s.toast);
  const hover = useGame((s) => s.hover);
  const select = useGame((s) => s.select);
  const notify = useGame((s) => s.notify);
  const tryPlay = useGame((s) => s.tryPlay);
  const tryAttack = useGame((s) => s.tryAttack);
  const tryActivate = useGame((s) => s.tryActivate);
  const toAttack = useGame((s) => s.toAttack);
  const toMain = useGame((s) => s.toMain);
  const passTurn = useGame((s) => s.passTurn);
  const setDrag = useGame((s) => s.setDrag);
  const closeReveal = useGame((s) => s.closeReveal);
  const go = useGame((s) => s.go);
  const [dropZone, setDropZone] = useState<string | null>(null);
  const suppressClick = useRef(false);
  const handW = useHandCardWidth();
  const compact = useCompact();

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => useGame.setState({ toast: null }), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") useGame.setState({ targeting: null, selectedId: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!state) return null;
  const me = state.players[0];
  const foe = state.players[1];
  const myTurn = state.active === 0 && !aiBusy && !state.pending && state.winner == null;

  function findCard(id: string): CardInstance | undefined {
    for (const p of [me, foe]) {
      if (p.leader.id === id) return p.leader;
      if (p.terrain?.id === id) return p.terrain;
      const f = p.field.find((c) => c.id === id);
      if (f) return f;
      if (p === me) {
        const h = p.hand.find((c) => c.id === id);
        if (h) return h;
      }
      const g = p.grave.find((c) => c.id === id);
      if (g) return g;
    }
    return undefined;
  }

  // Atacante escolhido (carta sua selecionada que pode atacar agora).
  const attackerId =
    myTurn && !targeting && selectedId && canAttack(state, 0, selectedId) ? selectedId : null;
  const attackTargets = new Set<string>(
    attackerId
      ? legalTargets(state, 0, attackerId).map((t) => (t.kind === "leader" ? foe.leader.id : t.cardId))
      : [],
  );
  const effectTargets = new Set<string>();
  if (targeting) {
    const src = findCard(targeting.cardId);
    if (targeting.mode === "ability") {
      for (const p of [me, foe]) for (const c of p.field.filter(isUnit)) effectTargets.add(c.id);
    } else if (src) {
      const need = needOf(src);
      for (const c of me.field.filter(isUnit)) {
        if (need !== "estudante" || c.defId === "estudante") effectTargets.add(c.id);
      }
    }
  }
  // Brilham só as cartas que podem atacar E têm algum alvo válido.
  const readyIds = new Set<string>(
    myTurn
      ? [me.leader, ...me.field]
          .filter((c) => canAttack(state, 0, c.id) && legalTargets(state, 0, c.id).length > 0)
          .map((c) => c.id)
      : [],
  );

  const inspected =
    (hoverId && findCard(hoverId)) || (selectedId && findCard(selectedId)) || null;
  const inspectedOwner = inspected ? ownerOfCard(state, inspected.id) : undefined;

  // ---------- interações (clique) ----------

  function consumeSuppressed() {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  }

  function onMyCard(card: CardInstance) {
    if (consumeSuppressed()) return;
    if (targeting?.mode === "play") {
      tryPlay(targeting.cardId, { kind: "card", cardId: card.id });
      return;
    }
    if (targeting?.mode === "ability") {
      tryActivate(targeting.cardId, { kind: "card", cardId: card.id });
      return;
    }
    if (selectedId === card.id) {
      select(null);
      return;
    }
    select(card.id);
    if (myTurn && state!.phase === "ATTACK" && !hasActivated(card)) {
      const why = attackBlockReason(state!, 0, card.id);
      if (why) notify(why);
    }
  }

  function onEnemyCard(card: CardInstance, isLeader: boolean) {
    if (consumeSuppressed()) return;
    if (targeting?.mode === "ability" && !isLeader) {
      tryActivate(targeting.cardId, { kind: "card", cardId: card.id });
      return;
    }
    if (attackerId) {
      tryAttack(attackerId, isLeader ? { kind: "leader" } : { kind: "card", cardId: card.id });
      return;
    }
    select(card.id);
    if (myTurn && state!.phase === "ATTACK") {
      notify("Primeiro clique numa carta sua (ou no seu líder) para escolher quem ataca.");
    }
  }

  function onHandCard(card: CardInstance) {
    if (consumeSuppressed()) return;
    if (!myTurn) {
      select(card.id);
      return;
    }
    const why = playBlockReason(state!, 0, card.id);
    if (why) {
      select(card.id);
      notify(why);
      sfx.error();
      return;
    }
    if (needOf(card) !== "none") {
      useGame.setState({ targeting: { cardId: card.id, mode: "play" }, selectedId: card.id });
      return;
    }
    tryPlay(card.id);
  }

  // ---------- arrastar e soltar ----------

  function handleDrop(cardId: string, from: DragFrom, drop: string | null) {
    const st = useGame.getState();
    if (!st.state || st.aiBusy) return;
    if (from === "hand") {
      const card = st.state.players[0].hand.find((c) => c.id === cardId);
      if (!card) return;
      if (drop?.startsWith("ally-card:")) {
        tryPlay(cardId, needOf(card) === "none" ? null : { kind: "card", cardId: drop.slice(10) });
        return;
      }
      if (drop === "field" || drop?.startsWith("ally")) {
        const why = playBlockReason(st.state, 0, cardId);
        if (why) {
          notify(why);
          sfx.error();
          return;
        }
        if (needOf(card) !== "none") {
          useGame.setState({ targeting: { cardId, mode: "play" }, selectedId: cardId });
          return;
        }
        tryPlay(cardId);
      }
      return;
    }
    if (drop === "enemy-leader") {
      tryAttack(cardId, { kind: "leader" });
      return;
    }
    if (drop?.startsWith("enemy-card:")) {
      tryAttack(cardId, { kind: "card", cardId: drop.slice(11) });
    }
  }

  // Os ouvintes são registrados já no pointerdown (e não num efeito), para que
  // um clique rápido nunca "perca" o pointerup e deixe o arraste preso.
  const startDrag = (e: ReactPointerEvent, cardId: string, from: DragFrom) => {
    if (!myTurn || e.button !== 0) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let active = false;
    const move = (ev: PointerEvent) => {
      if (!active && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return;
      active = true;
      setDrag({ cardId, from, x: ev.clientX, y: ev.clientY });
      setDropZone(zoneAt(ev.clientX, ev.clientY));
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    const up = (ev: PointerEvent) => {
      cleanup();
      if (!active) return;
      setDrag(null);
      setDropZone(null);
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      handleDrop(cardId, from, zoneAt(ev.clientX, ev.clientY));
    };
    const cancel = () => {
      cleanup();
      setDrag(null);
      setDropZone(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  const targetingCard = targeting ? findCard(targeting.cardId) : undefined;
  const attacker = attackerId ? findCard(attackerId) : undefined;
  const hint = hintText(state, {
    myTurn,
    targeting,
    targetingCard,
    attacker,
    targetCount: attackTargets.size,
    readyCount: readyIds.size,
  });

  const selectedMine = selectedId ? me.field.find((c) => c.id === selectedId) : undefined;

  const foeLeader = (w: number) => (
    <LeaderBox
      player={foe}
      cardW={w}
      compact={compact}
      active={state.active === 1}
      enemy
      dropActive={dropZone === "enemy-leader"}
      targetable={attackTargets.has(foe.leader.id)}
      onEnter={() => hover(foe.leader.id)}
      onLeave={() => hover(null)}
      onClick={() => onEnemyCard(foe.leader, true)}
    />
  );
  const myLeader = (w: number) => (
    <LeaderBox
      player={me}
      cardW={w}
      compact={compact}
      active={state.active === 0}
      selected={selectedId === me.leader.id}
      ready={readyIds.has(me.leader.id)}
      onEnter={() => hover(me.leader.id)}
      onLeave={() => hover(null)}
      onPointerDown={(e) => startDrag(e, me.leader.id, "leader")}
      onClick={() => onMyCard(me.leader)}
    />
  );

  return (
    <div
      data-board
      className="felt relative flex h-dvh min-h-0 flex-col overflow-hidden pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]"
    >
      <TopBar tutorial={tutorial} compact={compact} onLeave={() => go("home")} />

      <div className="flex min-h-0 flex-1">
        <Inspector card={inspected} owner={inspectedOwner} />

        <main className="relative flex min-w-0 flex-1 flex-col px-1.5 sm:px-3">
          {/* Oponente: líder, mão virada e pilhas (no celular o líder vai para a linha do campo) */}
          {!compact && (
            <div className="flex shrink-0 items-center gap-3 py-1.5">
              {foeLeader(handW)}
              <OppHand count={foe.hand.length} />
            </div>
          )}

          <FieldRow
            player={foe}
            compact={compact}
            leading={compact ? (w) => foeLeader(w) : undefined}
            active={state.active === 1}
            enemy
            dropActive={dropZone}
            selectedId={selectedId}
            targets={targeting ? effectTargets : attackTargets}
            onHover={hover}
            onClick={(c) => onEnemyCard(c, false)}
          />

          <CenterLine hint={hint} compact={compact} />

          <FieldRow
            player={me}
            compact={compact}
            leading={compact ? (w) => myLeader(w) : undefined}
            active={state.active === 0}
            dropActive={dropZone}
            selectedId={selectedId}
            targets={effectTargets}
            ready={readyIds}
            onHover={hover}
            onPointerDown={(id, e) => startDrag(e, id, "field")}
            onClick={onMyCard}
          />

          {/* Você: líder e mão */}
          <div
            className={cn(
              "flex shrink-0 items-end gap-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
              compact ? "pt-0.5 pb-1" : "pt-1",
            )}
          >
            {!compact && myLeader(handW)}
            <HandRail
              state={state}
              cardW={handW}
              cards={me.hand}
              myTurn={myTurn}
              selectedId={selectedId}
              hoverId={hoverId}
              draggingId={drag?.cardId ?? null}
              onHover={hover}
              onPointerDown={(id, e) => startDrag(e, id, "hand")}
              onClick={onHandCard}
            />
          </div>
        </main>

        <ActionRail
          state={state}
          compact={compact}
          myTurn={myTurn}
          aiBusy={aiBusy}
          onMain={toMain}
          onAttack={toAttack}
          onEnd={passTurn}
          ability={selectedMine && hasActivated(selectedMine) ? selectedMine : undefined}
          onActivate={() => selectedMine && tryActivate(selectedMine.id)}
        />
      </div>

      {inspected && (
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 z-20 w-max -translate-x-1/2 xl:hidden",
            compact ? "top-0.5 max-w-[62%]" : "top-12 max-w-[60%]",
          )}
        >
          {compact ? (
            <p className="line-clamp-2 rounded-[10px] bg-surface/95 px-2.5 py-1 text-[10px] leading-snug text-fg/80 ring-1 ring-border">
              <b className="text-fg">{inspected.name}:</b> {inspected.ability}
            </p>
          ) : (
            <div className="rounded-[14px] bg-surface/95 p-2.5 ring-1 ring-border">
              <p className="font-display text-base leading-tight">{inspected.name}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-fg/75">{inspected.ability}</p>
            </div>
          )}
        </div>
      )}

      {drag && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[70%] rotate-3"
          style={{ left: drag.x, top: drag.y }}
        >
          <CardView card={findCard(drag.cardId)} size="md" lifted />
        </div>
      )}

      {targetingCard && (
        <div className={cn("absolute inset-x-0 z-30 flex justify-center px-3", compact ? "top-1" : "top-12")}>
          <div
            className={cn(
              "flex items-center gap-3 rounded-full bg-surface/95 py-1.5 pr-1.5 pl-4 ring-1 ring-accent/50",
              compact ? "text-xs" : "text-sm",
            )}
          >
            <span>
              {targeting?.mode === "ability"
                ? `Escolha a unidade que ${targetingCard.name} vai hackear`
                : `Escolha um aliado para ${targetingCard.name}`}
            </span>
            <Button size="sm" variant="ghost" onClick={() => select(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 z-40 flex justify-center px-4",
            compact ? "bottom-24" : "bottom-44",
          )}
        >
          <div
            className={cn(
              "max-w-md rounded-2xl bg-surface text-center ring-1 ring-amber-300/40 shadow-xl",
              compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm",
            )}
          >
            {toast}
          </div>
        </div>
      )}

      {state.reveal && state.reveal.viewer === 0 && !state.pending && (
        <button
          className="absolute inset-0 z-40 flex items-center justify-center bg-bg/75 px-4"
          onClick={closeReveal}
        >
          <div className={cn("max-w-xl rounded-[28px] bg-surface ring-1 ring-border", compact ? "p-4" : "p-6")}>
            <p className={cn("font-display", compact ? "text-xl" : "text-2xl")}>{state.reveal.title}</p>
            <p className="mt-1 text-sm text-muted">{state.reveal.reason}</p>
            <div className={cn("flex flex-wrap justify-center gap-3", compact ? "mt-2" : "mt-4")}>
              {state.reveal.cards.map((c) => (
                <CardView key={c.id} card={c} size={compact ? "md" : "lg"} />
              ))}
            </div>
            <p className={cn("text-center text-xs text-muted", compact ? "mt-2" : "mt-4")}>Toque para fechar</p>
          </div>
        </button>
      )}

      {state.pending && state.pending.player === 0 && <PendingDialog state={state} compact={compact} />}

      <FxLayer />
    </div>
  );
}

function hintText(
  state: GameState,
  ctx: {
    myTurn: boolean;
    targeting: { mode: "play" | "ability" } | null;
    targetingCard?: CardInstance;
    attacker?: CardInstance;
    targetCount: number;
    readyCount: number;
  },
): ReactNode {
  if (state.winner != null) return "Fim de partida.";
  if (state.pending) {
    return state.pending.player === 0 ? "Faça a sua escolha na janela." : "A máquina está decidindo…";
  }
  if (state.active !== 0) return "Vez da máquina — observe as jogadas dela.";
  if (!ctx.myTurn) return "Aguarde…";
  if (ctx.targeting && ctx.targetingCard) {
    return ctx.targeting.mode === "ability"
      ? `Clique na unidade que ${ctx.targetingCard.name} vai hackear (Esc cancela).`
      : `Clique num aliado seu para ${ctx.targetingCard.name} (Esc cancela).`;
  }
  if (ctx.attacker && ctx.targetCount === 0) {
    const foe = state.players[1];
    return (
      <>
        <b className="text-amber-200">{ctx.attacker.name}</b> não tem alvo: o ataque dele não supera a
        defesa {leaderDefense(foe)} de {foe.leader.name} e não há cartas inimigas em campo.
      </>
    );
  }
  if (ctx.attacker) {
    const guards = defendersOf(state.players[1]);
    return guards.length ? (
      <>
        <b className="text-amber-200">{ctx.attacker.name}</b> pronto! O Defensor{" "}
        <b>{guards.map((g) => g.name).join(", ")}</b> precisa ser atacado primeiro.
      </>
    ) : (
      <>
        <b className="text-amber-200">{ctx.attacker.name}</b> pronto! Clique no líder inimigo ou numa
        carta inimiga.
      </>
    );
  }
  if (state.firstTurnNoAttack && state.turn <= 2) {
    return "Primeira rodada: jogue suas cartas e monte seus Defensores. Os ataques começam no turno 3.";
  }
  if (ctx.readyCount) {
    return (
      <>
        Jogue cartas da mão ou clique numa carta sua <b className="text-amber-200">brilhando</b> para
        atacar ({ctx.readyCount} pronta{ctx.readyCount > 1 ? "s" : ""}).
      </>
    );
  }
  return "Jogue cartas da mão. Quando terminar, clique em Passar turno.";
}

function TopBar({
  tutorial,
  compact,
  onLeave,
}: {
  tutorial?: boolean;
  compact: boolean;
  onLeave: () => void;
}) {
  const state = useGame((s) => s.state)!;
  const skill = useGame((s) => s.skill);
  const me = state.players[0];
  const foe = state.players[1];
  const mine = state.active === 0;
  return (
    <header
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 border-b border-border/60",
        compact ? "px-3 py-1 text-[11px]" : "px-3 py-2 sm:px-5",
      )}
    >
      <button
        onClick={onLeave}
        className="font-display text-sm font-semibold tracking-[0.2em] text-muted uppercase hover:text-fg"
      >
        X-B0T
      </button>
      <div className="flex items-center gap-3 text-xs">
        <span className="tabular text-muted">Turno {state.turn}</span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 font-semibold",
            mine ? "bg-amber-300/15 text-amber-200" : "bg-red-400/15 text-red-300",
          )}
        >
          {mine ? "Sua vez" : "Vez da máquina"}
          <span className="hidden font-normal sm:inline"> · {phaseLabel(state.phase)}</span>
        </span>
        {!tutorial && !compact && (
          <span className="hidden text-muted md:inline">Máquina: {skillLabel(skill)}</span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className={compact ? "hidden" : "hidden sm:inline"}>Você</span>
        <ResourcePair life={me.life.length} energy={me.energy} />
        <span className="text-subtle">|</span>
        <span className={compact ? "hidden" : "hidden sm:inline"}>Máquina</span>
        <ResourcePair life={foe.life.length} energy={foe.energy} />
      </div>
    </header>
  );
}

function ResourcePair({ life, energy }: { life: number; energy: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex items-center gap-1">
        <Heart className="size-3.5 text-rose-400" />
        <span className="tabular text-fg">{life}</span>
      </span>
      <span className="flex items-center gap-1">
        <Zap className="size-3.5 text-yellow-300" />
        <span className="tabular text-fg">{energy}</span>
      </span>
    </span>
  );
}

function phaseLabel(p: string) {
  if (p === "MAIN") return "Fase principal";
  if (p === "ATTACK") return "Fase de ataque";
  if (p === "BEGIN") return "Início";
  return p;
}

function Inspector({ card, owner }: { card: CardInstance | null; owner?: PlayerState }) {
  const unit = card && (isUnit(card) || card.cardType === "Líder");
  const stats = card && owner && unit ? statsOf(card, owner) : undefined;
  return (
    <aside className="hidden w-56 shrink-0 flex-col gap-3 overflow-y-auto border-r border-border/60 p-3 xl:flex 2xl:w-64 2xl:p-4">
      {card ? (
        <>
          <CardView card={card} size="xl" stats={stats} className="w-full max-w-60 self-center" />
          <div>
            <p className="font-display text-2xl leading-tight">{card.name}</p>
            <p className="mt-1 text-[11px] tracking-wide text-muted uppercase">
              {card.speed === "Counter" ? "Counter" : card.cardType} · {card.cardClass}
              {card.attackStyle ? ` · ${card.attackStyle}` : ""}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-fg/85">{card.ability}</p>
            <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs tabular">
              {card.cost > 0 && <InfoCell label="Custo" value={`${card.cost} ⚡`} />}
              {stats && <InfoCell label="Ataque" value={stats.atk} />}
              {stats && (
                <InfoCell
                  label="Defesa"
                  value={stats.def < stats.defMax ? `${stats.def} / ${stats.defMax}` : stats.def}
                />
              )}
              {card.cardType === "Líder" && <InfoCell label="Vidas" value={owner?.life.length ?? card.life} />}
              {card.counter > 0 && <InfoCell label="Counter" value={`+${card.counter}`} />}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-3 text-sm text-muted">
          <p>Passe o cursor sobre uma carta para ver os detalhes.</p>
          <p>
            <b className="text-fg/90">Jogar:</b> clique numa carta da mão ou arraste para o seu campo.
          </p>
          <p>
            <b className="text-fg/90">Atacar:</b> clique numa carta sua que esteja brilhando e depois no
            alvo (ou arraste até ele).
          </p>
        </div>
      )}
    </aside>
  );
}

function InfoCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-1.5 ring-1 ring-border">
      <p className="text-[10px] tracking-wide text-muted uppercase">{label}</p>
      <p className="font-semibold text-fg">{value}</p>
    </div>
  );
}

function LeaderBox({
  player,
  cardW,
  compact,
  active,
  enemy,
  selected,
  ready,
  targetable,
  dropActive,
  onEnter,
  onLeave,
  onPointerDown,
  onClick,
}: {
  player: PlayerState;
  cardW: number;
  compact?: boolean;
  active: boolean;
  enemy?: boolean;
  selected?: boolean;
  ready?: boolean;
  targetable?: boolean;
  dropActive?: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onPointerDown?: (e: ReactPointerEvent) => void;
  onClick?: () => void;
}) {
  const lives = player.life.length;
  return (
    <div className={cn("flex shrink-0 items-center", compact ? "gap-1.5" : "gap-2.5")}>
      <div
        data-drop={enemy ? "enemy-leader" : undefined}
        className={cn("rounded-[12px] p-0.5", dropActive ? "bg-red-500/25 ring-2 ring-red-400" : "")}
      >
        <CardView
          card={player.leader}
          size="md"
          style={{ width: cardW }}
          dense={cardW < 90}
          anchor
          stats={statsOf(player.leader, player)}
          selected={selected}
          ready={ready}
          targetable={targetable}
          exhausted={active && player.leader.jaAtacou}
          onEnter={onEnter}
          onLeave={onLeave}
          onPointerDown={onPointerDown}
          onClick={onClick}
        />
      </div>
      {compact ? (
        <div className="flex flex-col gap-1 text-[11px] font-semibold tabular">
          <span className="flex items-center gap-0.5 text-rose-200" title="Vidas">
            <Heart className="size-3 fill-rose-500 text-rose-400" />
            {lives}
          </span>
          <span className="flex items-center gap-0.5 text-yellow-200" title="Energia">
            <Zap className="size-3" />
            {player.energy}
          </span>
          {enemy && (
            <span className="flex items-center gap-0.5 text-muted" title="Cartas na mão">
              <Layers className="size-3" />
              {player.hand.length}
            </span>
          )}
        </div>
      ) : (
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] tracking-wide text-muted uppercase">{enemy ? "Máquina" : "Você"}</p>
        <div className="flex max-w-[5.5rem] flex-wrap gap-0.5" title={`${lives} vida(s)`}>
          {lives <= 8 ? (
            Array.from({ length: lives }, (_, i) => (
              <Heart key={i} className="size-3.5 fill-rose-500 text-rose-400" />
            ))
          ) : (
            <span className="flex items-center gap-1 text-sm font-semibold">
              <Heart className="size-3.5 fill-rose-500 text-rose-400" /> {lives}
            </span>
          )}
          {lives === 0 && <span className="text-xs text-red-400">sem vidas</span>}
        </div>
        <span
          className="flex w-fit items-center gap-1 rounded-full bg-yellow-300/10 px-2 py-0.5 text-xs font-semibold text-yellow-200 ring-1 ring-yellow-300/30"
          title="Energia"
        >
          <Zap className="size-3" />
          <span className="tabular">{player.energy}</span>
        </span>
      </div>
      )}
    </div>
  );
}

function OppHand({ count }: { count: number }) {
  const shown = Math.min(count, 8);
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center" title={`${count} carta(s) na mão`}>
      {Array.from({ length: shown }, (_, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -26, zIndex: i }}>
          <CardView hidden size="sm" />
        </div>
      ))}
      <span className="ml-2 flex items-center gap-1 text-xs text-muted">
        <Layers className="size-3.5" />
        <span className="tabular">{count}</span>
      </span>
    </div>
  );
}

function Piles({ player, compact }: { player: PlayerState; compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex shrink-0 flex-col gap-1 text-[10px] font-semibold text-muted tabular">
        <span className="flex items-center gap-1" title="Baralho">
          <Layers className="size-3" />
          {player.deck.length}
        </span>
        <span className="flex items-center gap-1" title="Descarte">
          <Trash2 className="size-3" />
          {player.grave.length}
        </span>
      </div>
    );
  }
  return (
    <div className="flex shrink-0 items-start gap-2.5">
      <MiniPile count={player.deck.length} label="Baralho" facedown />
      <MiniPile count={player.grave.length} label="Descarte" top={player.grave[player.grave.length - 1]} />
    </div>
  );
}

function TerrainSlot({
  card,
  compact,
  onHover,
}: {
  card: CardInstance | null;
  compact?: boolean;
  onHover: (id: string | null) => void;
}) {
  if (compact) {
    if (!card) return null;
    return (
      <CardView
        card={card}
        size="xs"
        anchor
        className="card-enter"
        onEnter={() => onHover(card.id)}
        onLeave={() => onHover(null)}
      />
    );
  }
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      {card ? (
        <CardView
          card={card}
          size="sm"
          anchor
          className="card-enter"
          onEnter={() => onHover(card.id)}
          onLeave={() => onHover(null)}
        />
      ) : (
        <div
          className="flex w-16 items-center justify-center rounded-[10px] border border-dashed border-border-strong/60 text-center text-[9px] leading-tight text-subtle"
          style={{ aspectRatio: `${63 / 88}` }}
        >
          sem
          <br />
          terreno
        </div>
      )}
      <span className="text-[9px] tracking-wide text-muted uppercase">Terreno</span>
    </div>
  );
}

function FieldRow({
  player,
  compact,
  leading,
  active,
  enemy,
  dropActive,
  selectedId,
  targets,
  ready,
  onHover,
  onPointerDown,
  onClick,
}: {
  player: PlayerState;
  compact?: boolean;
  /** No celular, o líder fica no começo da linha do campo. */
  leading?: (cardW: number) => ReactNode;
  /** É o turno deste jogador (só então "já atacou" escurece a carta). */
  active: boolean;
  enemy?: boolean;
  dropActive: string | null;
  selectedId: string | null;
  targets: Set<string>;
  ready?: Set<string>;
  onHover: (id: string | null) => void;
  onPointerDown?: (id: string, e: ReactPointerEvent) => void;
  onClick?: (card: CardInstance) => void;
}) {
  const cards = player.field;
  const unitsRef = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(unitsRef);
  // As cartas do campo se ajustam ao espaço livre (largura e altura) sem quebrar linha.
  const n = Math.max(cards.length, 1);
  const byH = (h - (compact ? 4 : 16)) * RATIO;
  const byW = (w - 10 * (n - 1)) / n;
  const cardW = Math.floor(Math.max(54, Math.min(124, byH, byW)));
  const size = cardW >= 80 ? "md" : "sm";
  return (
    <div
      data-drop={enemy ? undefined : "field"}
      className={cn(
        "relative flex min-h-0 flex-1 items-center rounded-[18px] ring-1 transition-colors",
        compact ? "gap-1.5 px-1.5 py-1" : "gap-3 px-3 py-2",
        enemy ? "bg-red-950/10" : "bg-emerald-950/10",
        !enemy && dropActive === "field" ? "bg-accent/10 ring-accent/50" : "ring-border/60",
      )}
    >
      {leading?.(Math.min(cardW, 72))}
      <TerrainSlot card={player.terrain} compact={compact} onHover={onHover} />
      <div
        ref={unitsRef}
        className={cn(
          "relative flex min-w-0 flex-1 items-center justify-center self-stretch",
          compact ? "gap-1.5" : "gap-2.5 pb-3",
        )}
      >
        {cards.length === 0 && (
          <span className="text-[11px] tracking-wide text-subtle uppercase">
            {enemy ? "Campo inimigo vazio" : "Arraste cartas para o seu campo"}
          </span>
        )}
        {cards.map((c) => {
          const zone = enemy ? `enemy-card:${c.id}` : `ally-card:${c.id}`;
          return (
            <div
              key={c.id}
              data-drop={zone}
              className={cn("card-enter rounded-[12px]", dropActive === zone ? "ring-2 ring-red-400" : "")}
            >
              <CardView
                card={c}
                size={size}
                style={{ width: cardW }}
                dense={cardW < 90}
                anchor
                stats={statsOf(c, player)}
                selected={selectedId === c.id}
                ready={ready?.has(c.id)}
                targetable={targets.has(c.id)}
                exhausted={active && c.jaAtacou}
                onEnter={() => onHover(c.id)}
                onLeave={() => onHover(null)}
                onPointerDown={onPointerDown ? (e) => onPointerDown(c.id, e) : undefined}
                onClick={onClick ? () => onClick(c) : undefined}
              />
            </div>
          );
        })}
        {!compact && (
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[9px] tracking-wide text-subtle uppercase tabular">
            Personagens {cards.length}/{MAX_FIELD}
          </span>
        )}
      </div>
      <Piles player={player} compact={compact} />
    </div>
  );
}

function CenterLine({ hint, compact }: { hint: ReactNode; compact?: boolean }) {
  return (
    <div className={cn("flex shrink-0 items-center gap-3", compact ? "py-0.5" : "py-1.5")}>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border-strong" />
      <p
        className={cn(
          "max-w-[82%] text-center leading-snug text-fg/85",
          compact ? "truncate text-[10px]" : "text-[11px] sm:text-xs",
        )}
      >
        {hint}
      </p>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border-strong" />
    </div>
  );
}

const RATIO = 63 / 88;

function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 600, h: 160 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** Tela baixa (celular deitado): a mesa usa o layout compacto. */
export function useCompact() {
  const calc = () => window.innerHeight < 520;
  const [compact, setCompact] = useState(calc);
  useEffect(() => {
    const on = () => setCompact(calc());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return compact;
}

/** Largura das cartas da mão e dos líderes, proporcional à altura da janela. */
function useHandCardWidth() {
  const calc = () => {
    const h = window.innerHeight;
    if (h < 520) return Math.round(Math.min(68, Math.max(52, h * 0.18)));
    return Math.round(Math.min(112, Math.max(70, h * 0.13)));
  };
  const [w, setW] = useState(calc);
  useEffect(() => {
    const on = () => setW(calc());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

function HandRail({
  state,
  cards,
  myTurn,
  selectedId,
  hoverId,
  draggingId,
  onHover,
  onPointerDown,
  onClick,
  cardW,
}: {
  state: GameState;
  cards: CardInstance[];
  cardW: number;
  myTurn: boolean;
  selectedId: string | null;
  hoverId: string | null;
  draggingId: string | null;
  onHover: (id: string | null) => void;
  onPointerDown: (id: string, e: ReactPointerEvent) => void;
  onClick: (card: CardInstance) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { w: width } = useSize(ref);
  const me = state.players[0];
  const n = cards.length;
  const cardH = Math.round(cardW / RATIO);
  // O leque se ajusta à largura disponível: sem sobreposição quando cabe.
  const step = n <= 1 ? 0 : Math.min(cardW + 8, (width - cardW - 8) / (n - 1));
  const total = cardW + step * Math.max(0, n - 1);
  const mid = (n - 1) / 2;

  return (
    <div
      ref={ref}
      className="relative min-w-0 flex-1"
      style={{ height: cardH + 10 }}
    >
      {n === 0 && (
        <p className="absolute inset-0 flex items-center justify-center text-xs text-subtle">Mão vazia</p>
      )}
      {cards.map((card, i) => {
        const up = hoverId === card.id || selectedId === card.id;
        const rot = n > 1 ? (i - mid) * Math.min(3, 14 / n) : 0;
        const playable = myTurn && playBlockReason(state, 0, card.id) === null;
        return (
          <div
            key={card.id}
            className="absolute bottom-1 origin-bottom transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              left: `calc(50% - ${total / 2}px + ${i * step}px)`,
              transform: up
                ? "translateY(-26px) scale(1.08)"
                : `rotate(${rot}deg) translateY(${Math.abs(i - mid) * 1.5}px)`,
              zIndex: up ? 40 : 10 + i,
              opacity: draggingId === card.id ? 0.35 : 1,
            }}
          >
            <CardView
              card={card}
              size="md"
              style={{ width: cardW }}
              dense={cardW < 90}
              anchor
              cost={effectiveCost(card, me)}
              lifted={up}
              selected={selectedId === card.id}
              playable={playable}
              dim={myTurn && !playable}
              onEnter={() => onHover(card.id)}
              onLeave={() => onHover(null)}
              onPointerDown={(e) => onPointerDown(card.id, e)}
              onClick={() => onClick(card)}
            />
          </div>
        );
      })}
    </div>
  );
}

function ActionRail({
  state,
  compact,
  myTurn,
  aiBusy,
  onMain,
  onAttack,
  onEnd,
  ability,
  onActivate,
}: {
  state: GameState;
  compact: boolean;
  myTurn: boolean;
  aiBusy: boolean;
  onMain: () => void;
  onAttack: () => void;
  onEnd: () => void;
  ability?: CardInstance;
  onActivate: () => void;
}) {
  const phase = state.phase;
  const noAttackYet = state.firstTurnNoAttack && state.turn <= 2;
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [state.log.length]);

  if (compact) {
    // Celular: coluna estreita com ícone + rótulo curto, sem histórico.
    const btn = "h-auto w-full flex-col gap-0.5 rounded-[10px] px-1 py-1.5 text-[10px] leading-none";
    return (
      <aside className="flex w-[4.25rem] shrink-0 flex-col justify-end gap-1.5 border-l border-border/60 p-1.5">
        <p className="text-center text-[9px] leading-tight text-muted">
          {aiBusy ? "Máquina pensando…" : myTurn ? "Sua vez" : "Aguarde"}
        </p>
        <Button
          variant={phase === "MAIN" ? "primary" : "secondary"}
          className={btn}
          disabled={!myTurn}
          onClick={onMain}
        >
          <BookOpen className="size-4" />
          Jogar
        </Button>
        <Button
          variant={phase === "ATTACK" ? "primary" : "secondary"}
          className={btn}
          disabled={!myTurn || noAttackYet}
          onClick={onAttack}
        >
          <Swords className="size-4" />
          {noAttackYet ? "Turno 3" : "Atacar"}
        </Button>
        {ability && (
          <Button
            variant="secondary"
            className={btn}
            disabled={!myTurn || ability.usedActivated}
            onClick={onActivate}
          >
            <Sparkles className="size-4" />
            <span className="tracking-tight">Habilidade</span>
          </Button>
        )}
        <Button variant="danger" className={btn} disabled={!myTurn} onClick={onEnd}>
          <SkipForward className="size-4" />
          Passar
        </Button>
      </aside>
    );
  }

  return (
    <aside className="flex w-[4.75rem] shrink-0 flex-col gap-2 border-l border-border/60 p-2 sm:w-44 sm:p-3 2xl:w-52">
      <div className="hidden min-h-0 flex-1 flex-col sm:flex">
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] tracking-wide text-muted uppercase">
          <ScrollText className="size-3" /> Histórico
        </p>
        <div ref={logRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-[11px] leading-snug">
          {state.log.slice(-30).map((l) => (
            <p key={l.id} className="text-fg/70">
              <span className="mr-1 text-subtle tabular">{l.turn}</span>
              {l.text}
            </p>
          ))}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <p className="hidden text-[11px] tracking-wide text-muted uppercase sm:block">
          {aiBusy ? "A máquina pensa…" : myTurn ? "Suas ações" : "Aguarde"}
        </p>
        <Button
          variant={phase === "MAIN" ? "primary" : "secondary"}
          size="sm"
          disabled={!myTurn}
          onClick={onMain}
          title="Fase principal: jogar cartas"
        >
          <BookOpen className="size-4" />
          <span className="hidden sm:inline">Jogar cartas</span>
        </Button>
        <Button
          variant={phase === "ATTACK" ? "primary" : "secondary"}
          size="sm"
          disabled={!myTurn || noAttackYet}
          onClick={onAttack}
          title={noAttackYet ? "Na primeira rodada ninguém ataca" : "Fase de ataque"}
        >
          <Swords className="size-4" />
          <span className="hidden sm:inline">{noAttackYet ? "Ataque no turno 3" : "Atacar"}</span>
        </Button>
        {ability && (
          <Button variant="secondary" size="sm" disabled={!myTurn || ability.usedActivated} onClick={onActivate}>
            <Sparkles className="size-4" />
            <span className="hidden sm:inline">Habilidade</span>
          </Button>
        )}
        <Button variant="danger" size="sm" disabled={!myTurn} onClick={onEnd}>
          Passar turno
        </Button>
      </div>
    </aside>
  );
}

// ============================================================
// Janela de decisões (Counter, Rogen, Bomia)
// ============================================================

function PendingDialog({ state, compact }: { state: GameState; compact: boolean }) {
  const answerCounter = useGame((s) => s.answerCounter);
  const answerPick = useGame((s) => s.answerPick);
  const answerBomia = useGame((s) => s.answerBomia);
  const pend = state.pending!;
  const cardSize = compact ? "md" : "lg";
  const gapTop = compact ? "mt-2" : "mt-5";
  const title = cn("mt-1 font-display", compact ? "text-xl" : "text-3xl");
  const me = state.players[0];

  let body: ReactNode = null;
  if (pend.kind === "counter") {
    const foe = state.players[pend.attackerOwner];
    const attacker =
      foe.leader.id === pend.attackerId ? foe.leader : foe.field.find((c) => c.id === pend.attackerId);
    const target = me.field.find((c) => c.id === pend.targetId);
    // Um botão por tipo de carta (duas Assembleias fazem a mesma coisa).
    const options = pend.options
      .map((id) => me.hand.find((c) => c.id === id))
      .filter((c): c is CardInstance => !!c)
      .filter((c, i, all) => all.findIndex((o) => o.defId === c.defId) === i);
    if (attacker && target) {
      const atk = atkTotal(attacker, foe);
      const def = defNow(target, me) + target.counter;
      const outcome = (bonus: number) =>
        atk >= def + bonus ? "é destruído" : atk - target.counter - bonus > 0 ? `sofre ${atk - target.counter - bonus} de dano` : "bloqueia tudo";
      body = (
        <>
          <p className="text-[11px] tracking-[0.2em] text-red-300 uppercase">Você está sendo atacado</p>
          <h2 className={title}>
            {attacker.name} ataca {target.name}!
          </h2>
          <p className="mt-2 text-sm text-fg/80">
            Ataque <b className="text-red-300">{atk}</b> contra defesa <b className="text-emerald-300">{def}</b>
            {target.counter > 0 ? ` (inclui Counter +${target.counter})` : ""}. Sem reação,{" "}
            {target.name} {outcome(0)}.
          </p>
          <div className={cn(gapTop, "flex flex-wrap items-end justify-center gap-4")}>
            <div className="flex flex-col items-center gap-1">
              <CardView card={attacker} size={cardSize} stats={statsOf(attacker, foe)} />
              <span className="text-xs text-red-300">Atacante</span>
            </div>
            <Swords className={cn("size-8 text-red-400", compact ? "mb-12" : "mb-24")} />
            <div className="flex flex-col items-center gap-1">
              <CardView card={target} size={cardSize} stats={statsOf(target, me)} />
              <span className="text-xs text-emerald-300">Seu aliado</span>
            </div>
          </div>
          <div className={cn(gapTop, "flex flex-wrap justify-center gap-2")}>
            {options.map((c) => (
              <Button key={c.id} onClick={() => answerCounter(c.id)}>
                Usar {c.name} ({effectiveCost(c, me)} ⚡) — {target.name} {outcome(3000)}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => answerCounter(null)}>
              Não usar
            </Button>
          </div>
        </>
      );
    }
  } else if (pend.kind === "pick") {
    body = (
      <>
        <p className="text-[11px] tracking-[0.2em] text-amber-200 uppercase">Habilidade do líder</p>
        <h2 className={title}>{pend.title}</h2>
        <p className="mt-2 text-sm text-fg/80">{pend.reason}</p>
        <div className={cn(gapTop, "flex flex-wrap justify-center gap-3")}>
          {pend.cards.map((c) => (
            <button
              key={c.id}
              className="rounded-[12px] transition-transform hover:-translate-y-1"
              onClick={() => answerPick(c.id)}
            >
              <CardView card={c} size={cardSize} />
            </button>
          ))}
        </div>
        <div className={cn(gapTop, "flex justify-center")}>
          <Button variant="secondary" onClick={() => answerPick(null)}>
            Não pegar nenhuma
          </Button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-[11px] tracking-[0.2em] text-pink-300 uppercase">Efeito da Bomia</p>
        <h2 className={title}>Você comprou {pend.card.name}</h2>
        <p className="mt-2 text-sm text-fg/80">
          Pode colocar a carta virada na sua Zona de Vida (+1 vida) em vez de ficar com ela na mão.
        </p>
        <div className={cn(gapTop, "flex justify-center")}>
          <CardView card={pend.card} size={cardSize} />
        </div>
        <div className={cn(gapTop, "flex flex-wrap justify-center gap-2")}>
          <Button onClick={() => answerBomia(true)}>
            <Heart className="size-4" /> Zona de Vida (+1 vida)
          </Button>
          <Button variant="secondary" onClick={() => answerBomia(false)}>
            Ficar na mão
          </Button>
        </div>
      </>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-[2px]">
      <div
        className={cn(
          "max-h-[96dvh] w-full overflow-y-auto rounded-[28px] bg-surface text-center ring-1 ring-border shadow-2xl",
          compact ? "max-w-3xl p-3" : "max-w-2xl p-6",
        )}
      >
        {body}
      </div>
    </div>
  );
}
