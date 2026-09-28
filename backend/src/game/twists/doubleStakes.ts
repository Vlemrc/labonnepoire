import type { TwistDefinition } from "./types.js";

export const doubleStakes: TwistDefinition = {
  code: "DOUBLE_STAKES",
  label: "Double ou rien",
  description: "Tout ce qui change de main sur cette carte compte double.",
  // Les parieurs engagent deja tout leur capital : il n'y a pas de budget a
  // doubler. On double donc les transferts, ce qui rend la carte deux fois
  // plus decisive sans toucher a la mise.
  apply: () => ({ transferMultiplier: 2 }),
};
