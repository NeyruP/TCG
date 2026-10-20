// Sem cartas de Energia: a energia vem só do ganho passivo por turno e de efeitos.
export type CardType =
  | "Líder"
  | "Comum"
  | "Especial"
  | "Efeito"
  | "Terreno"
  | "Item"
  | "Ficha";

// "Counter" só pode ser usada quando um aliado for alvo de um ataque.
export type CardSpeed = "Instant" | "Sorcery" | "Counter";
export type Faction = "magic" | "machine";
export type Phase = "NOT_STARTED" | "BEGIN" | "MAIN" | "ATTACK" | "END";
export type Keyword = "Defender" | "Haste" | "DoubleAttack";

export interface CardDef {
  defId: string;
  name: string;
  cardType: CardType;
  attack: number;
  defense: number;
  cost: number;
  /** Bônus de defesa (Counter: +1000/+2000) quando a carta é atacada. */
  counter: number;
  ability: string;
  cardClass: string;
  attackStyle: string | null;
  life: number;
  speed: CardSpeed;
  keywords: Keyword[];
  image: string;
  faction: Faction | "neutral";
}

export interface CardInstance extends CardDef {
  id: string;
  owner: 0 | 1;
  jaAtacou: boolean;
  attacksUsed: number;
  summonedThisTurn: boolean;
  buffAtaque: number;
  buffDefesa: number;
  /** Bônus de ataque que acaba no fim do turno (Overclock). */
  tempAtk: number;
  /** Dano acumulado: a defesa atual é a defesa máxima menos o dano. */
  damage: number;
  /** Mecha: turnos restantes antes de se autodestruir (0 = sem contador). */
  countdown: number;
  sacrificeEnd: boolean;
  usedActivated: boolean;
}

export interface StackItem {
  card: CardInstance;
  controller: 0 | 1;
  target: EffectTarget | null;
}

export type EffectTarget =
  | { kind: "card"; cardId: string }
  | { kind: "player"; player: 0 | 1; part: "leader" }
  | { kind: "opponent-deck"; player: 0 | 1; index?: number };

export type AttackTarget = { kind: "leader" } | { kind: "card"; cardId: string };

export interface PlayerState {
  name: string;
  deck: CardInstance[];
  hand: CardInstance[];
  field: CardInstance[];
  terrain: CardInstance | null;
  grave: CardInstance[];
  life: CardInstance[];
  energy: number;
  leader: CardInstance;
  alive: boolean;
  faction: Faction;
}

/** Decisões que pausam o jogo até o jogador (ou a máquina) responder. */
export type PendingDecision =
  | {
      kind: "counter";
      player: 0 | 1;
      attackerOwner: 0 | 1;
      attackerId: string;
      targetId: string;
      options: string[];
      rogenAfter: boolean;
    }
  | {
      kind: "pick";
      player: 0 | 1;
      title: string;
      reason: string;
      cards: CardInstance[];
    }
  | { kind: "bomia"; player: 0 | 1; card: CardInstance };

export type FxKind =
  | "attack"
  | "damage"
  | "shield"
  | "destroy"
  | "leader-hit"
  | "heal"
  | "buff"
  | "energy"
  | "life"
  | "turn";

/** Eventos visuais (dano, cura, destruição…) consumidos pela camada de efeitos. */
export interface FxEvent {
  id: number;
  at: number;
  kind: FxKind;
  side?: 0 | 1;
  targetId?: string;
  fromId?: string;
  amount?: number;
  text?: string;
  card?: CardInstance;
}

export interface GameState {
  players: [PlayerState, PlayerState];
  active: 0 | 1;
  turn: number;
  phase: Phase;
  stack: StackItem[];
  winner: 0 | 1 | null;
  log: LogEntry[];
  reveal: RevealEvent | null;
  pending: PendingDecision | null;
  fx: FxEvent[];
  /** Regra da primeira rodada: ninguém ataca nos turnos 1 e 2. */
  firstTurnNoAttack: boolean;
  lastAction: string | null;
}

export interface LogEntry {
  id: number;
  text: string;
  turn: number;
}

export interface RevealEvent {
  viewer: 0 | 1;
  title: string;
  cards: CardInstance[];
  reason: string;
}

export type TargetNeed = "ally-unit" | "estudante" | "any-unit" | "none";

export type Screen = "home" | "rules" | "tutorial" | "setup" | "play" | "result";
