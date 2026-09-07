import { NEUTRAL_MODIFIERS, type RoundModifiers } from "../types.js";
import type { TwistContext, TwistDefinition } from "./types.js";
import { allIn } from "./allIn.js";
import { bluffeurAnte } from "./bluffeurAnte.js";
import { doubleStakes } from "./doubleStakes.js";

/**
 * Table des twists. Pour en ajouter un :
 *   1. creer un fichier exportant un TwistDefinition
 *   2. l'ajouter a ce tableau
 *   3. l'ajouter au seed (table Twist) pour qu'il soit proposable en jeu
 * Aucune autre modification du moteur n'est necessaire.
 */
export const TWISTS: readonly TwistDefinition[] = [
  doubleStakes,
  allIn,
  bluffeurAnte,
];

const BY_CODE = new Map(TWISTS.map((t) => [t.code, t]));

export function getTwist(code: string): TwistDefinition | null {
  return BY_CODE.get(code) ?? null;
}

export function listTwists(): readonly TwistDefinition[] {
  return TWISTS;
}

/** Resout les modificateurs effectifs d'un round. `code` null = round normal. */
export function resolveModifiers(code: string | null, ctx: TwistContext): RoundModifiers {
  if (!code) return { ...NEUTRAL_MODIFIERS };
  const twist = getTwist(code);
  if (!twist) return { ...NEUTRAL_MODIFIERS };
  return { ...NEUTRAL_MODIFIERS, ...twist.apply(ctx) };
}
