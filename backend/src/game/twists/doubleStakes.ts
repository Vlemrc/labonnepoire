import type { TwistDefinition } from "./types.js";

export const doubleStakes: TwistDefinition = {
  code: "DOUBLE_STAKES",
  label: "Double ou rien",
  description: "Le budget de mise des parieurs est double pour ce round.",
  apply: () => ({ stakeBudgetMultiplier: 2 }),
};
