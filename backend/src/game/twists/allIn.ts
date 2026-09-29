import type { TwistDefinition } from "./types.js";

export const allIn: TwistDefinition = {
  code: "ALL_IN",
  label: "Tapis",
  description:
    "Interdit de répartir : chaque parieur doit poser la totalité de son budget sur une seule réponse.",
  apply: () => ({ requireSingleAnswerBet: true }),
};
