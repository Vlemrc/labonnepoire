import { describe, expect, it } from "vitest";
import {
  allBettorsSubmitted,
  canResolve,
  evaluateSessionOutcome,
  nextBluffeur,
  normalizeAnswer,
  hasExpired,
  isAbandonedInWriting,
  validateBetDistribution,
  validateFakeAnswers,
} from "../src/game/stateMachine.js";
import { NEUTRAL_MODIFIERS } from "../src/game/types.js";
import type { RoundSnapshot, SessionPlayerSnapshot } from "../src/game/types.js";

const round = (overrides: Partial<RoundSnapshot> = {}): RoundSnapshot => ({
  id: "r1",
  status: "BETTING",
  mode: "STANDARD",
  bluffeurId: "b",
  stakeBudget: 10,
  allowNoneOption: false,
  deadlineAt: null,
  participants: [
    { userId: "b", role: "BLUFFEUR", hasSubmitted: true, budget: 0 },
    { userId: "a", role: "BETTOR", hasSubmitted: false, budget: 10 },
  ],
  ...overrides,
});

const player = (userId: string, points: number, turnOrder: number): SessionPlayerSnapshot => ({
  userId,
  points,
  isEliminated: points <= 0,
  turnOrder,
});

describe("validateFakeAnswers", () => {
  it("accepte deux fausses reponses distinctes en mode STANDARD", () => {
    expect(validateFakeAnswers([" Paris ", "Lyon"], "STANDARD", "Marseille")).toEqual([
      "Paris",
      "Lyon",
    ]);
  });

  it("exige trois fausses reponses en mode FULL_BLUFF", () => {
    expect(() => validateFakeAnswers(["a", "b"], "FULL_BLUFF", "c")).toThrow(/exactement 3/);
    expect(validateFakeAnswers(["a", "b", "c"], "FULL_BLUFF", "d")).toHaveLength(3);
  });

  it("refuse les doublons a la casse et aux accents pres", () => {
    expect(() => validateFakeAnswers(["Éléphant", "elephant"], "STANDARD", "Girafe")).toThrow(
      /differentes/,
    );
  });

  it("refuse une fausse reponse identique a la vraie", () => {
    expect(() => validateFakeAnswers(["  la TOUR eiffel", "Autre"], "STANDARD", "La Tour Eiffel"))
      .toThrow(/identique a la vraie/);
  });

  it("refuse une reponse vide", () => {
    expect(() => validateFakeAnswers(["   ", "Autre"], "STANDARD", "Vrai")).toThrow(/vide/);
  });

  it("normalise ponctuation et accents", () => {
    expect(normalizeAnswer("L'Hôtel-Dieu !")).toBe("l hotel dieu");
  });
});

describe("validateBetDistribution", () => {
  const ids = ["a1", "a2", "a3"];
  const opts = { allowNoneOption: false, modifiers: { ...NEUTRAL_MODIFIERS } };
  const line = (answerId: string | null, amount: number, isNoneOption = false) => ({
    answerId,
    amount,
    isNoneOption,
  });

  it("accepte une repartition 7/2/1 sur un budget de 10", () => {
    const out = validateBetDistribution(
      [line("a1", 7), line("a2", 2), line("a3", 1)],
      10,
      ids,
      opts,
    );
    expect(out).toHaveLength(3);
  });

  it("ignore les lignes a zero", () => {
    const out = validateBetDistribution([line("a1", 10), line("a2", 0)], 10, ids, opts);
    expect(out).toHaveLength(1);
  });

  it("refuse un total different du budget", () => {
    expect(() => validateBetDistribution([line("a1", 8)], 10, ids, opts)).toThrow(/exactement 10/);
    expect(() => validateBetDistribution([line("a1", 12)], 10, ids, opts)).toThrow(/exactement 10/);
  });

  it("refuse deux mises sur la meme reponse", () => {
    expect(() => validateBetDistribution([line("a1", 5), line("a1", 5)], 10, ids, opts)).toThrow(
      /une seule mise/i,
    );
  });

  it("refuse une mise sur une reponse inconnue", () => {
    expect(() => validateBetDistribution([line("a9", 10)], 10, ids, opts)).toThrow(/inconnue/);
  });

  it("refuse l'option « aucune » quand elle est desactivee", () => {
    expect(() => validateBetDistribution([line(null, 10, true)], 10, ids, opts)).toThrow(
      /n'est pas active/,
    );
  });

  it("accepte l'option « aucune » quand elle est active", () => {
    const out = validateBetDistribution([line(null, 10, true)], 10, ids, {
      ...opts,
      allowNoneOption: true,
    });
    expect(out[0]?.isNoneOption).toBe(true);
  });

  it("impose une seule cible sous le twist ALL_IN", () => {
    const allIn = {
      allowNoneOption: false,
      modifiers: { ...NEUTRAL_MODIFIERS, requireSingleAnswerBet: true },
    };
    expect(() => validateBetDistribution([line("a1", 5), line("a2", 5)], 10, ids, allIn)).toThrow(
      /une seule reponse/,
    );
    expect(validateBetDistribution([line("a1", 10)], 10, ids, allIn)).toHaveLength(1);
  });
});

describe("resolution du round", () => {
  it("attend que tous les parieurs aient mise", () => {
    expect(allBettorsSubmitted(round())).toBe(false);
    expect(canResolve(round(), new Date())).toBe(false);
  });

  it("est resoluble des que tous ont mise", () => {
    const r = round({
      participants: [
        { userId: "b", role: "BLUFFEUR", hasSubmitted: true, budget: 0 },
        { userId: "a", role: "BETTOR", hasSubmitted: true, budget: 10 },
      ],
    });
    expect(canResolve(r, new Date())).toBe(true);
  });

  it("est resoluble apres la deadline meme si un joueur n'a pas mise", () => {
    const past = new Date("2026-01-01T00:00:00Z");
    const r = round({ deadlineAt: past });
    expect(canResolve(r, new Date("2026-01-02T00:00:00Z"))).toBe(true);
    expect(canResolve(r, new Date("2025-12-31T00:00:00Z"))).toBe(false);
  });

  it("n'est jamais resoluble en phase d'ecriture", () => {
    expect(canResolve(round({ status: "WRITING", deadlineAt: new Date(0) }), new Date())).toBe(false);
  });
});

describe("rotation du bluffeur", () => {
  const players = [player("p1", 20, 0), player("p2", 20, 1), player("p3", 20, 2)];

  it("commence par le premier joueur", () => {
    expect(nextBluffeur(players, null).userId).toBe("p1");
  });

  it("passe au suivant dans l'ordre", () => {
    expect(nextBluffeur(players, "p1").userId).toBe("p2");
    expect(nextBluffeur(players, "p2").userId).toBe("p3");
  });

  it("boucle en fin de tour", () => {
    expect(nextBluffeur(players, "p3").userId).toBe("p1");
  });

  it("saute les joueurs elimines", () => {
    const withDead = [player("p1", 20, 0), player("p2", 0, 1), player("p3", 20, 2)];
    expect(nextBluffeur(withDead, "p1").userId).toBe("p3");
  });

  it("boucle correctement quand l'ancien bluffeur vient d'etre elimine", () => {
    const withDead = [player("p1", 20, 0), player("p2", 0, 1), player("p3", 20, 2)];
    expect(nextBluffeur(withDead, "p2").userId).toBe("p3");
  });
});

describe("fin de partie", () => {
  it("continue tant que deux joueurs ont des points", () => {
    const out = evaluateSessionOutcome([player("p1", 5, 0), player("p2", 15, 1)]);
    expect(out.isFinished).toBe(false);
  });

  it("designe le survivant comme vainqueur", () => {
    const out = evaluateSessionOutcome([player("p1", 0, 0), player("p2", 20, 1)]);
    expect(out.isFinished).toBe(true);
    expect(out.winnerId).toBe("p2");
    expect(out.eliminatedIds).toEqual(["p1"]);
  });

  it("termine sans vainqueur si tout le monde tombe a zero", () => {
    const out = evaluateSessionOutcome([player("p1", 0, 0), player("p2", 0, 1)]);
    expect(out.isFinished).toBe(true);
    expect(out.winnerId).toBeNull();
  });
});

describe("expiration d'un round", () => {
  const past = new Date("2026-01-01T00:00:00Z");
  const later = new Date("2026-01-02T00:00:00Z");
  const earlier = new Date("2025-12-31T00:00:00Z");

  it("detecte un bluffeur qui a laisse filer la phase d'ecriture", () => {
    const r = round({ status: "WRITING", deadlineAt: past });
    expect(isAbandonedInWriting(r, later)).toBe(true);
    expect(isAbandonedInWriting(r, earlier)).toBe(false);
  });

  it("ne considere pas un round de mises comme abandonne a l'ecriture", () => {
    expect(isAbandonedInWriting(round({ deadlineAt: past }), later)).toBe(false);
  });

  it("ne considere jamais un round sans deadline comme expire", () => {
    expect(hasExpired(round({ deadlineAt: null }), later)).toBe(false);
    expect(isAbandonedInWriting(round({ status: "WRITING", deadlineAt: null }), later)).toBe(false);
  });
});
