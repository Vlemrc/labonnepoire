import type { RoundModifiers } from "../types.js";

export interface TwistContext {
  /** Nombre de parieurs dans le round. */
  bettorCount: number;
  /** Capital du bluffeur au moment ou la carte se joue. */
  bluffeurPoints: number;
}

export interface TwistDefinition {
  code: string;
  label: string;
  description: string;
  /**
   * Modificateurs appliques au round. Ne retourner que ce qui change :
   * le reste est complete par NEUTRAL_MODIFIERS.
   */
  apply(ctx: TwistContext): Partial<RoundModifiers>;
}
