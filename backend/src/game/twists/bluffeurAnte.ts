import type { TwistDefinition } from "./types.js";

export const bluffeurAnte: TwistDefinition = {
  code: "BLUFFEUR_ANTE",
  label: "Prime au flair",
  description:
    "Le bluffeur met une prime en jeu : chaque parieur qui pose tout son budget sur la vraie reponse la lui prend.",
  apply: (ctx) => ({ bluffeurAnte: Math.max(1, Math.round(ctx.baseStakeBudget / 2)) }),
};
