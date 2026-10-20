import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Crosshair, Flame, Hourglass, Moon, Shield, Sword, Zap } from "lucide-react";
import type { CardInstance } from "@/lib/game/types";
import { cn } from "@/lib/utils";

export const CARD_RATIO = 63 / 88;

export type Size = "xs" | "sm" | "md" | "lg" | "xl";

const widths: Record<Size, string> = {
  xs: "w-10",
  sm: "w-16",
  md: "w-[5.75rem]",
  lg: "w-36",
  xl: "w-52",
};

const text: Record<Size, { name: string; stat: string; icon: string; badge: string }> = {
  xs: { name: "", stat: "text-[8px]", icon: "size-2", badge: "size-4 text-[9px]" },
  sm: { name: "", stat: "text-[9px]", icon: "size-2.5", badge: "size-5 text-[10px]" },
  md: { name: "text-[10.5px]", stat: "text-[9px]", icon: "size-2.5", badge: "size-5 text-[11px]" },
  lg: { name: "text-sm", stat: "text-[11px]", icon: "size-3", badge: "size-7 text-sm" },
  xl: { name: "text-base", stat: "text-xs", icon: "size-3.5", badge: "size-8 text-base" },
};

export interface CardStats {
  atk: number;
  def: number;
  defMax: number;
}

export function CardView({
  card,
  hidden,
  size = "md",
  lifted,
  selected,
  playable,
  ready,
  targetable,
  exhausted,
  dim,
  stats,
  cost,
  dense,
  anchor,
  className,
  onPointerDown,
  onClick,
  onEnter,
  onLeave,
  style,
}: {
  card?: CardInstance;
  hidden?: boolean;
  size?: Size;
  lifted?: boolean;
  selected?: boolean;
  playable?: boolean;
  /** Pode atacar agora. */
  ready?: boolean;
  /** Alvo válido do ataque/efeito escolhido. */
  targetable?: boolean;
  /** Já atacou neste turno. */
  exhausted?: boolean;
  dim?: boolean;
  stats?: CardStats;
  /** Custo efetivo (ex.: reduzido pelo Bobo). */
  cost?: number;
  /** Carta estreita: números compactos (4k) para não cortar. */
  dense?: boolean;
  /** Marca o elemento para a camada de efeitos (data-card-id). */
  anchor?: boolean;
  className?: string;
  onPointerDown?: (e: ReactPointerEvent) => void;
  onClick?: () => void;
  onEnter?: () => void;
  onLeave?: () => void;
  style?: CSSProperties;
}) {
  return (
    <div
      data-card-id={anchor && card ? card.id : undefined}
      className={cn("relative shrink-0 select-none touch-none", widths[size], className)}
      style={{ aspectRatio: `${CARD_RATIO}`, ...style }}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      role={onClick || onPointerDown ? "button" : undefined}
    >
      <div
        className={cn(
          "absolute inset-0 overflow-hidden rounded-[10px] border transition-[transform,box-shadow,filter,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          lifted ? "card-shadow-lift -translate-y-1" : "card-shadow",
          selected ? "border-accent ring-2 ring-accent" : "border-black/60",
          ready && !selected ? "ready-glow border-amber-300/80" : "",
          targetable ? "target-glow border-red-400" : "",
          playable && !selected && !ready ? "ring-2 ring-accent/60" : "",
          exhausted ? "brightness-[0.6] saturate-[0.4]" : "",
          dim ? "opacity-45" : "opacity-100",
        )}
      >
        {hidden || !card ? (
          <CardBack />
        ) : (
          <CardFace card={card} size={size} stats={stats} cost={cost} dense={dense} />
        )}
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <img src="cards/back.jpg" alt="Carta virada" className="h-full w-full object-cover" draggable={false} />
  );
}

function isUnitCard(card: CardInstance) {
  return card.cardType === "Comum" || card.cardType === "Especial" || card.cardType === "Ficha";
}

function typeLabel(card: CardInstance) {
  if (card.speed === "Counter") return "Counter";
  return card.cardType;
}

function CardFace({
  card,
  size,
  stats,
  cost,
  dense,
}: {
  card: CardInstance;
  size: Size;
  stats?: CardStats;
  cost?: number;
  dense?: boolean;
}) {
  const t = text[size];
  const leader = card.cardType === "Líder";
  const unit = isUnitCard(card);
  const compact = size === "xs" || size === "sm";
  const atk = stats?.atk ?? card.attack + card.buffAtaque + card.tempAtk;
  const def = stats?.def ?? card.defense + card.buffDefesa - card.damage;
  const max = stats?.defMax ?? card.defense + card.buffDefesa;
  const shownCost = cost ?? card.cost;
  const discounted = cost != null && cost < card.cost;
  const damaged = unit && def < max;
  const atkUp = unit || leader ? atk > card.attack : false;

  return (
    <div className="relative h-full w-full bg-ink">
      {card.image ? (
        <img src={card.image} alt={card.name} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <TokenFace card={card} />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent via-40% to-black/85" />

      {!leader && (card.cost > 0 || discounted) && size !== "xs" && (
        <span
          title={discounted ? `Custo original ${card.cost}` : undefined}
          className={cn(
            "absolute top-1 left-1 flex items-center justify-center rounded-full font-bold tabular shadow-md ring-1 ring-black/50",
            t.badge,
            discounted ? "bg-ok text-bg" : "bg-accent text-accent-fg",
          )}
        >
          {shownCost}
        </span>
      )}

      {!compact && <StatusIcons card={card} iconClass={t.icon} />}

      {!compact && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 px-1 pb-1.5 text-left">
          <p className={cn("truncate font-semibold leading-tight text-white drop-shadow", t.name)}>
            {card.name}
          </p>
          {unit || leader ? (
            <div className="flex items-center justify-between gap-0.5">
              <Stat kind="atk" n={atk} up={atkUp} compact={dense} className={t.stat} icon={t.icon} />
              <Stat kind="def" n={def} hurt={damaged} compact={dense} className={t.stat} icon={t.icon} />
            </div>
          ) : (
            <p className={cn("tracking-wide text-white/70 uppercase", t.stat)}>{typeLabel(card)}</p>
          )}
        </div>
      )}

      {compact && (unit || leader) && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 p-0.5">
          <Stat kind="atk" n={atk} compact className={t.stat} icon={t.icon} />
          <Stat kind="def" n={def} hurt={damaged} compact className={t.stat} icon={t.icon} />
        </div>
      )}

      {damaged && max > 0 && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/70">
          <div
            className={cn("h-full", def / max > 0.5 ? "bg-amber-400" : "bg-red-500")}
            style={{ width: `${Math.max(4, (def / max) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function StatusIcons({ card, iconClass }: { card: CardInstance; iconClass: string }) {
  const icons: { key: string; node: ReactNode; title: string; tone: string }[] = [];
  if (card.keywords.includes("Defender")) {
    icons.push({ key: "def", node: <Shield className={iconClass} />, title: "Defensor", tone: "bg-sky-600" });
  }
  if (card.keywords.includes("Haste")) {
    icons.push({ key: "haste", node: <Zap className={iconClass} />, title: "Apressado", tone: "bg-amber-600" });
  }
  if (card.keywords.includes("DoubleAttack")) {
    icons.push({ key: "x2", node: <span className="text-[9px] leading-none font-bold">×2</span>, title: "Ataque duplo", tone: "bg-amber-700" });
  }
  if (card.countdown > 0) {
    icons.push({
      key: "cd",
      node: (
        <span className="flex items-center gap-0.5 text-[9px] leading-none font-bold">
          <Hourglass className={iconClass} />
          {card.countdown}
        </span>
      ),
      title: `Autodestrói em ${card.countdown} turno(s)`,
      tone: "bg-red-700",
    });
  }
  if (card.sacrificeEnd) {
    icons.push({ key: "sac", node: <Flame className={iconClass} />, title: "Vai para o descarte no fim do turno", tone: "bg-red-600" });
  }
  if (card.summonedThisTurn) {
    icons.push({ key: "zz", node: <Moon className={iconClass} />, title: "Acabou de entrar: ataca no próximo turno", tone: "bg-slate-600" });
  }
  if (!icons.length) return null;
  return (
    <div className="absolute top-1 right-1 flex flex-col items-end gap-0.5">
      {icons.map((i) => (
        <span
          key={i.key}
          title={i.title}
          className={cn("flex min-h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-white shadow ring-1 ring-black/40", i.tone)}
        >
          {i.node}
        </span>
      ))}
    </div>
  );
}

export function formatStat(n: number, compact?: boolean) {
  if (!compact || n < 1000) return String(n);
  const k = n / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

function Stat({
  n,
  kind,
  hurt,
  up,
  compact,
  className,
  icon,
}: {
  n: number;
  kind: "atk" | "def";
  hurt?: boolean;
  up?: boolean;
  compact?: boolean;
  className?: string;
  icon: string;
}) {
  const Icon = kind === "atk" ? Sword : Shield;
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 rounded px-[3px] py-px leading-none font-bold tabular shadow-sm ring-1 ring-black/40",
        kind === "atk" && (up ? "bg-orange-500 text-white" : "bg-danger text-white"),
        kind === "def" && (hurt ? "bg-amber-400 text-black" : "bg-ok text-black"),
        className,
      )}
    >
      {!compact && <Icon className={icon} />}
      {formatStat(n, compact)}
    </span>
  );
}

function TokenFace({ card }: { card: CardInstance }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center gap-1 px-2 pt-2"
      style={{ background: "linear-gradient(160deg, #3a3220 0%, #15130e 60%, #2a2214 100%)" }}
    >
      <p className="text-[8px] tracking-[0.18em] text-amber-200/60 uppercase">{card.cardType}</p>
      <Crosshair className="mt-[12%] size-1/2 text-amber-300/70" strokeWidth={1.4} />
    </div>
  );
}

export function MiniPile({
  count,
  label,
  facedown,
  top,
}: {
  count: number;
  label: string;
  facedown?: boolean;
  top?: CardInstance;
}) {
  return (
    <div className="flex flex-col items-center gap-1" title={`${label}: ${count}`}>
      <div className="relative">
        {count > 1 && (
          <div className="absolute top-0.5 left-0.5 h-full w-full rounded-[10px] bg-black/40" />
        )}
        <CardView card={top} hidden={facedown || !top} size="sm" dim={count === 0} />
        <span className="absolute -right-1.5 -bottom-1.5 min-w-5 rounded-full bg-surface px-1 text-center text-[10px] font-semibold tabular ring-1 ring-border">
          {count}
        </span>
      </div>
      <span className="text-[9px] tracking-wide text-muted uppercase">{label}</span>
    </div>
  );
}
