import type { GameState } from "@/lib/game/types";

/** Funções do motor que o multiplayer intercepta quando a mesa na tela é uma cópia espelhada. */
export type EngineFnName =
  | "playCard"
  | "attack"
  | "activateAbility"
  | "answerCounter"
  | "answerPick"
  | "answerBomia"
  | "setPhase"
  | "endTurn"
  | "dismissReveal"
  | "resolveAll";

/** Mesa mostrada a um jogador: cópia da mesa verdadeira em que ele é sempre o jogador 0. */
export type MirrorView = GameState & { __mpP?: 0 | 1 };

export interface MpApi {
  /** "local" (mesmo celular), "host" (anfitrião) ou "guest" (convidado). */
  mode: "local" | "host" | "guest" | null;
  active(): boolean;
  t(s: string): string;
  resTitle(won: boolean): string;
  resText(won: boolean): string;
  act(name: EngineFnName, args: unknown[], view: MirrorView): unknown;
  publish(view: MirrorView, extra: object): void;
}

/**
 * Ponte entre a interface e o multiplayer. Sem partida multiplayer tudo passa
 * direto (XB.on() é falso e XB.t devolve o texto como está).
 */
export const XB = {
  mp: null as MpApi | null,
  on(): boolean {
    return !!XB.mp?.active();
  },
  t(s: string): string {
    return XB.on() && XB.mp ? XB.mp.t(s) : s;
  },
  openLobby: () => {},
  /** Fecha o menu Multiplayer se estiver aberto (botão "voltar" do Android). */
  closeLobby: (): boolean => false,
};

export function isMirror(s: GameState): s is MirrorView & { __mpP: 0 | 1 } {
  return (s as MirrorView).__mpP != null;
}
