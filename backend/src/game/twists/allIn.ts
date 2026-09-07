import type { TwistDefinition } from "./types.js";

export const allIn: TwistDefinition = {
  code: "ALL_IN",
  label: "Tapis",
  description:
    "Interdit de repartir : chaque parieur doit poser la totalite de son budget sur une seule reponse.",
  apply: () => ({ requireSingleAnswerBet: true }),
};
