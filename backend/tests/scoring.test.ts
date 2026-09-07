import { describe, expect, it } from "vitest";
import { resolveRound, type ScoringInput } from "../src/game/scoring.js";
import { NEUTRAL_MODIFIERS } from "../src/game/types.js";
import { resolveModifiers } from "../src/game/twists/registry.js";

const BLUFFEUR = "u-bluffeur";
const ALICE = "u-alice";
const BOB = "u-bob";

function baseInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    bluffeurId: BLUFFEUR,
    mode: "STANDARD",
    answers: [
      { id: "a-true", isTrue: true, authorId: null },
      { id: "a-fake1", isTrue: false, authorId: BLUFFEUR },
      { id: "a-fake2", isTrue: false, authorId: BLUFFEUR },
    ],
    bets: [],
    players: [
      { userId: BLUFFEUR, points: 20 },
      { userId: ALICE, points: 20 },
    ],
    budgets: { [ALICE]: 10 },
    modifiers: { ...NEUTRAL_MODIFIERS },
    ...overrides,
  };
}

const bet = (bettorId: string, answerId: string | null, amount: number, isNoneOption = false) => ({
  bettorId,
  answerId,
  isNoneOption,
  amount,
});

describe("resolveRound — regles de base", () => {
  it("rend sa mise au parieur qui a tout mis sur la vraie reponse", () => {
    const out = resolveRound(baseInput({ bets: [bet(ALICE, "a-true", 10)] }));
    expect(out.deltas[ALICE]).toBe(0);
    expect(out.deltas[BLUFFEUR]).toBe(0);
    expect(out.pointsAfter[ALICE]).toBe(20);
  });

  it("transfere au bluffeur la mise posee sur une fausse reponse", () => {
    const out = resolveRound(baseInput({ bets: [bet(ALICE, "a-fake1", 10)] }));
    expect(out.deltas[ALICE]).toBe(-10);
    expect(out.deltas[BLUFFEUR]).toBe(10);
  });

  it("gere une repartition 7/2/1", () => {
    const out = resolveRound(
      baseInput({
        bets: [bet(ALICE, "a-true", 7), bet(ALICE, "a-fake1", 2), bet(ALICE, "a-fake2", 1)],
      }),
    );
    expect(out.deltas[ALICE]).toBe(-3);
    expect(out.deltas[BLUFFEUR]).toBe(3);
    expect(out.pointsAfter[ALICE]).toBe(17);
    expect(out.pointsAfter[BLUFFEUR]).toBe(23);
  });

  it("reste a somme nulle avec plusieurs parieurs", () => {
    const out = resolveRound(
      baseInput({
        players: [
          { userId: BLUFFEUR, points: 20 },
          { userId: ALICE, points: 20 },
          { userId: BOB, points: 20 },
        ],
        budgets: { [ALICE]: 10, [BOB]: 10 },
        bets: [
          bet(ALICE, "a-fake1", 6),
          bet(ALICE, "a-true", 4),
          bet(BOB, "a-fake2", 10),
        ],
      }),
    );
    expect(out.deltas[ALICE]).toBe(-6);
    expect(out.deltas[BOB]).toBe(-10);
    expect(out.deltas[BLUFFEUR]).toBe(16);
    expect(Object.values(out.deltas).reduce((s, d) => s + d, 0)).toBe(0);
  });

  it("cible l'auteur de la fausse reponse, pas systematiquement le bluffeur", () => {
    // Cas prevu pour le mode equipes : une fausse reponse ecrite par un tiers.
    const out = resolveRound(
      baseInput({
        players: [
          { userId: BLUFFEUR, points: 20 },
          { userId: ALICE, points: 20 },
          { userId: BOB, points: 20 },
        ],
        answers: [
          { id: "a-true", isTrue: true, authorId: null },
          { id: "a-fake1", isTrue: false, authorId: BOB },
          { id: "a-fake2", isTrue: false, authorId: BLUFFEUR },
        ],
        bets: [bet(ALICE, "a-fake1", 10)],
      }),
    );
    expect(out.deltas[BOB]).toBe(10);
    expect(out.deltas[BLUFFEUR]).toBe(0);
  });

  it("elimine le joueur qui tombe a zero", () => {
    const out = resolveRound(
      baseInput({
        players: [
          { userId: BLUFFEUR, points: 20 },
          { userId: ALICE, points: 8 },
        ],
        budgets: { [ALICE]: 8 },
        bets: [bet(ALICE, "a-fake1", 8)],
      }),
    );
    expect(out.pointsAfter[ALICE]).toBe(0);
    expect(out.eliminated).toEqual([ALICE]);
  });

  it("refuse une mise sur une reponse inexistante", () => {
    expect(() => resolveRound(baseInput({ bets: [bet(ALICE, "a-inconnue", 10)] }))).toThrow(
      /reponse inconnue/,
    );
  });
});

describe("resolveRound — option « aucune de ces reponses »", () => {
  it("fait perdre la mise en mode STANDARD, ou la vraie reponse est presente", () => {
    const out = resolveRound(baseInput({ bets: [bet(ALICE, null, 10, true)] }));
    expect(out.deltas[ALICE]).toBe(-10);
    expect(out.deltas[BLUFFEUR]).toBe(10);
  });

  it("paie le parieur en mode FULL_BLUFF quand aucune reponse n'est vraie", () => {
    const out = resolveRound(
      baseInput({
        mode: "FULL_BLUFF",
        answers: [
          { id: "a-f1", isTrue: false, authorId: BLUFFEUR },
          { id: "a-f2", isTrue: false, authorId: BLUFFEUR },
          { id: "a-f3", isTrue: false, authorId: BLUFFEUR },
        ],
        bets: [bet(ALICE, null, 10, true)],
      }),
    );
    expect(out.deltas[ALICE]).toBe(10);
    expect(out.deltas[BLUFFEUR]).toBe(-10);
  });

  it("plafonne la prime au capital reel du bluffeur", () => {
    const out = resolveRound(
      baseInput({
        mode: "FULL_BLUFF",
        answers: [
          { id: "a-f1", isTrue: false, authorId: BLUFFEUR },
          { id: "a-f2", isTrue: false, authorId: BLUFFEUR },
          { id: "a-f3", isTrue: false, authorId: BLUFFEUR },
        ],
        players: [
          { userId: BLUFFEUR, points: 4 },
          { userId: ALICE, points: 20 },
        ],
        bets: [bet(ALICE, null, 10, true)],
      }),
    );
    expect(out.deltas[BLUFFEUR]).toBe(-4);
    expect(out.deltas[ALICE]).toBe(4);
    expect(out.pointsAfter[BLUFFEUR]).toBe(0);
    expect(out.eliminated).toEqual([BLUFFEUR]);
  });

  it("repartit la prime au prorata quand le bluffeur ne peut pas tout payer", () => {
    const out = resolveRound(
      baseInput({
        mode: "FULL_BLUFF",
        answers: [
          { id: "a-f1", isTrue: false, authorId: BLUFFEUR },
          { id: "a-f2", isTrue: false, authorId: BLUFFEUR },
          { id: "a-f3", isTrue: false, authorId: BLUFFEUR },
        ],
        players: [
          { userId: BLUFFEUR, points: 5 },
          { userId: ALICE, points: 20 },
          { userId: BOB, points: 20 },
        ],
        budgets: { [ALICE]: 10, [BOB]: 10 },
        bets: [bet(ALICE, null, 10, true), bet(BOB, null, 10, true)],
      }),
    );
    expect(out.deltas[BLUFFEUR]).toBe(-5);
    expect(out.deltas[ALICE]! + out.deltas[BOB]!).toBe(5);
    expect(Object.values(out.deltas).reduce((s, d) => s + d, 0)).toBe(0);
  });
});

describe("resolveRound — twists", () => {
  it("DOUBLE_STAKES ne touche pas la resolution, seulement le budget", () => {
    const mods = resolveModifiers("DOUBLE_STAKES", { bettorCount: 1, baseStakeBudget: 10 });
    expect(mods.stakeBudgetMultiplier).toBe(2);
    expect(mods.transferMultiplier).toBe(1);
  });

  it("BLUFFEUR_ANTE paie le parieur qui a tout mise sur la vraie reponse", () => {
    const mods = resolveModifiers("BLUFFEUR_ANTE", { bettorCount: 1, baseStakeBudget: 10 });
    const out = resolveRound(baseInput({ modifiers: mods, bets: [bet(ALICE, "a-true", 10)] }));
    expect(out.deltas[ALICE]).toBe(5);
    expect(out.deltas[BLUFFEUR]).toBe(-5);
  });

  it("BLUFFEUR_ANTE ne paie pas une mise repartie, meme majoritairement bonne", () => {
    const mods = resolveModifiers("BLUFFEUR_ANTE", { bettorCount: 1, baseStakeBudget: 10 });
    const out = resolveRound(
      baseInput({ modifiers: mods, bets: [bet(ALICE, "a-true", 9), bet(ALICE, "a-fake1", 1)] }),
    );
    expect(out.deltas[ALICE]).toBe(-1);
    expect(out.deltas[BLUFFEUR]).toBe(1);
  });

  it("un code de twist inconnu retombe sur des modificateurs neutres", () => {
    expect(resolveModifiers("N_IMPORTE_QUOI", { bettorCount: 1, baseStakeBudget: 10 })).toEqual(
      NEUTRAL_MODIFIERS,
    );
  });
});

describe("resolveRound — forfaits", () => {
  it("transfere au bluffeur le budget d'un parieur qui n'a pas mise a temps", () => {
    const out = resolveRound(
      baseInput({
        bets: [],
        forfeits: [{ bettorId: ALICE, amount: 10 }],
      }),
    );
    expect(out.deltas[ALICE]).toBe(-10);
    expect(out.deltas[BLUFFEUR]).toBe(10);
  });

  it("combine forfaits et mises reelles en gardant la somme nulle", () => {
    const out = resolveRound(
      baseInput({
        players: [
          { userId: BLUFFEUR, points: 20 },
          { userId: ALICE, points: 20 },
          { userId: BOB, points: 6 },
        ],
        budgets: { [ALICE]: 10, [BOB]: 6 },
        bets: [bet(ALICE, "a-true", 10)],
        forfeits: [{ bettorId: BOB, amount: 6 }],
      }),
    );
    expect(out.deltas[ALICE]).toBe(0);
    expect(out.deltas[BOB]).toBe(-6);
    expect(out.deltas[BLUFFEUR]).toBe(6);
    expect(out.pointsAfter[BOB]).toBe(0);
    expect(out.eliminated).toEqual([BOB]);
    expect(Object.values(out.deltas).reduce((s, d) => s + d, 0)).toBe(0);
  });
});
