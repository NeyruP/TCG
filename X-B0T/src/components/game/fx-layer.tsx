import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { sfx } from "@/lib/game/audio";
import type { CardInstance, FxEvent } from "@/lib/game/types";
import { XB } from "@/lib/multiplayer/xb";
import { cn } from "@/lib/utils";
import { useGame } from "@/store/game-store";

type Tone = "dmg" | "heal" | "buff" | "energy" | "gold" | "shield" | "life";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Float {
  key: number;
  x: number;
  y: number;
  text: string;
  tone: Tone;
  big?: boolean;
  delay: number;
}
interface Burst {
  key: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  slash?: boolean;
}
interface Ghost {
  key: number;
  rect: Rect;
  card: CardInstance;
}

const TONES: Record<Tone, string> = {
  dmg: "text-red-400",
  heal: "text-emerald-300",
  buff: "text-sky-300",
  energy: "text-yellow-300",
  gold: "text-amber-300",
  shield: "text-cyan-200",
  life: "text-pink-300",
};

let keySeq = 1;

function liveRect(id: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function liveEl(id?: string): HTMLElement | null {
  if (!id) return null;
  return document.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
}

function shake(el: HTMLElement | null, delay: number, strong = false) {
  if (!el?.animate) return;
  const d = strong ? 9 : 6;
  el.animate(
    [
      { transform: "translateX(0)", filter: "none" },
      { transform: `translateX(-${d}px) rotate(-2deg)`, filter: "brightness(1.9) sepia(1) hue-rotate(-50deg) saturate(5)" },
      { transform: `translateX(${d - 1}px) rotate(1.5deg)`, filter: "brightness(1.4) sepia(0.6) hue-rotate(-50deg) saturate(3)" },
      { transform: "translateX(-3px)", filter: "none" },
      { transform: "translateX(0)", filter: "none" },
    ],
    { duration: 420, delay, easing: "ease-out" },
  );
}

/**
 * Camada de efeitos visuais. Lê os eventos `state.fx` gerados pelo motor e
 * mostra o que aconteceu em cima da carta certa: investida do atacante,
 * impacto, números de dano/cura flutuando, carta se despedaçando e o flash na
 * tela quando um líder perde vida.
 */
export function FxLayer() {
  const state = useGame((s) => s.state);
  const [floats, setFloats] = useState<Float[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [flash, setFlash] = useState<{ key: number; tone: "hurt" | "hit" } | null>(null);
  const [banner, setBanner] = useState<{ key: number; mine: boolean; text: string } | null>(null);
  const seen = useRef(0);
  const rects = useRef(new Map<string, Rect>());

  useLayoutEffect(() => {
    if (!state) return;
    const now = Date.now();
    const fresh = state.fx.filter((e) => e.id > seen.current);
    if (fresh.length) seen.current = fresh[fresh.length - 1]!.id;
    const perTarget = new Map<string, number>();

    const rectOf = (id?: string) => (id ? liveRect(id) ?? rects.current.get(id) ?? null : null);
    const addFloat = (e: FxEvent, text: string, tone: Tone, base: number, big = false) => {
      const r = rectOf(e.targetId);
      if (!r) return;
      const n = perTarget.get(e.targetId!) ?? 0;
      perTarget.set(e.targetId!, n + 1);
      const f: Float = {
        key: keySeq++,
        x: r.x + r.w / 2,
        y: r.y + r.h * 0.4,
        text,
        tone,
        big,
        delay: base + n * 160,
      };
      setFloats((xs) => [...xs, f]);
      window.setTimeout(() => setFloats((xs) => xs.filter((x) => x.key !== f.key)), 1500 + f.delay);
    };
    const addBurst = (id: string | undefined, color: string, delay: number, slash = false) => {
      const r = rectOf(id);
      if (!r) return;
      const b: Burst = {
        key: keySeq++,
        x: r.x + r.w / 2,
        y: r.y + r.h / 2,
        size: Math.max(r.w, r.h) * 1.1,
        color,
        delay,
        slash,
      };
      setBursts((xs) => [...xs, b]);
      window.setTimeout(() => setBursts((xs) => xs.filter((x) => x.key !== b.key)), 800 + delay);
    };
    const later = (fn: () => void, ms: number) => window.setTimeout(fn, ms);

    for (const e of fresh) {
      if (now - e.at > 1500) continue;
      switch (e.kind) {
        case "attack": {
          const el = liveEl(e.fromId);
          const to = rectOf(e.targetId);
          const from = el?.getBoundingClientRect();
          if (el?.animate && to && from) {
            const dx = (to.x + to.w / 2 - (from.left + from.width / 2)) * 0.55;
            const dy = (to.y + to.h / 2 - (from.top + from.height / 2)) * 0.55;
            el.animate(
              [
                { transform: "translate(0, 0)", zIndex: 40 },
                { transform: `translate(${dx}px, ${dy}px) scale(1.12)`, offset: 0.45, zIndex: 40 },
                { transform: "translate(0, 0)", zIndex: 40 },
              ],
              { duration: 440, easing: "cubic-bezier(0.3, 0.7, 0.4, 1)" },
            );
          }
          sfx.attack();
          break;
        }
        case "damage": {
          addBurst(e.targetId, "rgb(239 68 68 / 0.55)", 170, true);
          addFloat(e, `-${e.amount}`, "dmg", 190, true);
          shake(liveEl(e.targetId), 190);
          later(sfx.hit, 180);
          break;
        }
        case "shield": {
          addBurst(e.targetId, "rgb(103 232 249 / 0.4)", 160);
          addFloat(e, e.text ?? "Bloqueou!", "shield", 200);
          later(sfx.block, 180);
          break;
        }
        case "destroy": {
          const r = rectOf(e.targetId);
          if (r && e.card) {
            const g: Ghost = { key: keySeq++, rect: r, card: e.card };
            setGhosts((xs) => [...xs, g]);
            window.setTimeout(() => setGhosts((xs) => xs.filter((x) => x.key !== g.key)), 1300);
          }
          addFloat(e, "DESTRUÍDO", e.side === 0 ? "dmg" : "gold", 420, true);
          later(sfx.destroy, 300);
          break;
        }
        case "leader-hit": {
          const mine = e.side === 0;
          addBurst(e.targetId, mine ? "rgb(239 68 68 / 0.6)" : "rgb(251 191 36 / 0.55)", 170, true);
          addFloat(e, `-${e.amount ?? 1} ♥`, mine ? "dmg" : "gold", 200, true);
          shake(liveEl(e.targetId), 200, true);
          later(() => {
            setFlash({ key: keySeq++, tone: mine ? "hurt" : "hit" });
            if (mine) {
              document.querySelector<HTMLElement>("[data-board]")?.animate?.(
                [
                  { transform: "translate(0, 0)" },
                  { transform: "translate(-7px, 3px)" },
                  { transform: "translate(6px, -3px)" },
                  { transform: "translate(-4px, 2px)" },
                  { transform: "translate(0, 0)" },
                ],
                { duration: 380, easing: "ease-out" },
              );
              sfx.hurt();
            } else {
              sfx.strike();
            }
          }, 190);
          break;
        }
        case "heal":
          addFloat(e, e.text ?? `+${e.amount}`, "heal", 60, true);
          addBurst(e.targetId, "rgb(52 211 153 / 0.35)", 40);
          later(sfx.heal, 40);
          break;
        case "buff":
          addFloat(e, e.text ?? "", "buff", 60);
          later(sfx.buff, 40);
          break;
        case "energy":
          addFloat(e, `+${e.amount} ⚡`, "energy", 450);
          break;
        case "life":
          addFloat(e, `+${e.amount ?? 1} ♥`, "life", 60, true);
          later(sfx.heal, 40);
          break;
        case "turn":
          if (state.winner == null) {
            // O texto é fixado agora: no multiplayer a perspectiva da mesa pode trocar durante a faixa.
            const mine = e.side === 0;
            const b = { key: keySeq++, mine, text: XB.t(mine ? "Sua vez" : "Vez da máquina") };
            setBanner(b);
            window.setTimeout(() => setBanner((cur) => (cur?.key === b.key ? null : cur)), 1500);
          }
          break;
      }
    }

    const next = new Map<string, Rect>();
    document.querySelectorAll<HTMLElement>("[data-card-id]").forEach((el) => {
      const r = el.getBoundingClientRect();
      next.set(el.dataset.cardId as string, { x: r.left, y: r.top, w: r.width, h: r.height });
    });
    rects.current = next;
  }, [state]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {flash && (
        <div
          key={flash.key}
          className="fx-flash"
          onAnimationEnd={() => setFlash(null)}
          style={{
            background:
              flash.tone === "hurt"
                ? "radial-gradient(ellipse at center, transparent 40%, rgb(220 38 38 / 0.6) 100%)"
                : "radial-gradient(ellipse at 50% 0%, rgb(251 191 36 / 0.45), transparent 60%)",
          }}
        />
      )}

      {ghosts.map((g) => (
        <div
          key={g.key}
          className="fx-ghost overflow-hidden rounded-[10px] border border-black/60"
          style={{ left: g.rect.x, top: g.rect.y, width: g.rect.w, height: g.rect.h }}
        >
          {g.card.image ? (
            <img src={g.card.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[#2a2214]" />
          )}
        </div>
      ))}

      {bursts.map((b) =>
        b.slash ? (
          <div key={b.key}>
            {[-38, 52].map((rot) => (
              <div
                key={rot}
                className="fx-slash"
                style={
                  {
                    left: b.x,
                    top: b.y,
                    width: b.size,
                    animationDelay: `${b.delay}ms`,
                    background: "linear-gradient(90deg, transparent, #fff 45%, rgb(248 113 113) 60%, transparent)",
                    "--rot": `${rot}deg`,
                  } as CSSProperties
                }
              />
            ))}
            <div
              className="fx-impact"
              style={{
                left: b.x,
                top: b.y,
                width: b.size,
                height: b.size,
                animationDelay: `${b.delay}ms`,
                background: `radial-gradient(circle, ${b.color} 0%, transparent 65%)`,
              }}
            />
          </div>
        ) : (
          <div
            key={b.key}
            className="fx-impact"
            style={{
              left: b.x,
              top: b.y,
              width: b.size,
              height: b.size,
              animationDelay: `${b.delay}ms`,
              background: `radial-gradient(circle, ${b.color} 0%, transparent 65%)`,
            }}
          />
        ),
      )}

      {floats.map((f) => (
        <div
          key={f.key}
          className={cn(
            "fx-float font-display font-bold tabular",
            f.big ? "text-3xl sm:text-4xl" : "text-lg sm:text-xl",
            TONES[f.tone],
          )}
          style={{ left: f.x, top: f.y, animationDelay: `${f.delay}ms` }}
        >
          {f.text}
        </div>
      ))}

      {banner && (
        <div
          key={banner.key}
          className={cn(
            "fx-banner absolute top-1/2 left-1/2 rounded-full px-8 py-3 font-display text-3xl font-bold uppercase ring-1 backdrop-blur-sm sm:text-5xl",
            banner.mine
              ? "bg-black/55 text-amber-200 ring-amber-300/40"
              : "bg-black/55 text-red-300 ring-red-400/40",
          )}
        >
          {banner.text}
        </div>
      )}
    </div>
  );
}
