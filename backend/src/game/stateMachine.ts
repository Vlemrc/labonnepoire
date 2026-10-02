import {
  ANSWERS_PER_ROUND,
  FAKE_ANSWERS_FULL_BLUFF,
  FAKE_ANSWERS_STANDARD,
} from "@poire/shared";
import { GameRuleError } from "./errors.js";
import type {
  RoundMode,
  RoundModifiers,
  RoundSnapshot,
  RoundStatus,
  SessionPlayerSnapshot,
} from "./types.js";

export function expectedFakeAnswerCount(mode: RoundMode): number {
  return mode === "FULL_BLUFF" ? FAKE_ANSWERS_FULL_BLUFF : FAKE_ANSWERS_STANDARD;
}

/** Normalisation pour comparer des reponses saisies a la main. */
export function normalizeAnswer(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Toutes les cartes d'une manche ont-elles recu leurs mensonges ?
 *
 * Les joueurs ecrivent en parallele ; la manche ne demarre que lorsque le
 * dernier a soumis. C'est ce qui remplace l'ancienne suite de rounds joues
 * l'un apres l'autre, et divise par autant le nombre de temps d'attente.
 */
export function allCardsWritten(statuses: RoundStatus[]): boolean {
  return statuses.length > 0 && statuses.every((s) => s !== "WRITING");
}

export function assertCanSubmitAnswers(round: RoundSnapshot, userId: string): void {
  if (round.status !== "WRITING") {
    throw new GameRuleError("ROUND_NOT_WRITING", "La phase d'écriture est terminée.");
  }
  if (round.bluffeurId !== userId) {
    throw new GameRuleError("NOT_BLUFFEUR", "Seul le bluffeur peut écrire les réponses.", 403);
  }
  const me = round.participants.find((p) => p.userId === userId);
  if (me?.hasSubmitted) {
    throw new GameRuleError("ALREADY_SUBMITTED", "Tes réponses sont déjà enregistrées.");
  }
}

/**
 * Valide les fausses reponses du bluffeur. Rejette les doublons et toute
 * reponse trop proche de la vraie : sinon le bluffeur pourrait proposer deux
 * variantes de la bonne reponse et rendre le round ingagnable.
 */
export function validateFakeAnswers(
  texts: string[],
  mode: RoundMode,
  trueAnswer: string,
): string[] {
  const expected = expectedFakeAnswerCount(mode);
  const cleaned = texts.map((t) => t.trim());

  if (cleaned.length !== expected) {
    throw new GameRuleError(
      "WRONG_ANSWER_COUNT",
      `Il faut exactement ${expected} fausses réponses.`,
      400,
    );
  }
  for (const text of cleaned) {
    if (text.length === 0) {
      throw new GameRuleError("EMPTY_ANSWER", "Une réponse ne peut pas être vide.", 400);
    }
    if (text.length > 200) {
      throw new GameRuleError("ANSWER_TOO_LONG", "Une réponse fait au plus 200 caractères.", 400);
    }
  }

  const normalized = cleaned.map(normalizeAnswer);
  if (new Set(normalized).size !== normalized.length) {
    throw new GameRuleError("DUPLICATE_ANSWER", "Les fausses réponses doivent être différentes.", 400);
  }
  if (mode === "STANDARD" && normalized.includes(normalizeAnswer(trueAnswer))) {
    throw new GameRuleError(
      "ANSWER_MATCHES_TRUTH",
      "Une fausse réponse est identique à la vraie réponse.",
      400,
    );
  }
  return cleaned;
}

export function assertCanSubmitBets(round: RoundSnapshot, userId: string): void {
  if (round.status !== "BETTING") {
    throw new GameRuleError("ROUND_NOT_BETTING", "Les mises ne sont pas ouvertes.");
  }
  const me = round.participants.find((p) => p.userId === userId);
  if (!me || me.role !== "BETTOR") {
    throw new GameRuleError("NOT_BETTOR", "Tu n'es pas parieur sur ce round.", 403);
  }
  if (me.hasSubmitted) {
    throw new GameRuleError("ALREADY_SUBMITTED", "Tes mises sont déjà enregistrées.");
  }
  if (me.budget <= 0) {
    throw new GameRuleError("NO_BUDGET", "Tu n'as plus de points à miser.");
  }
}

export interface BetLine {
  answerId: string | null;
  isNoneOption: boolean;
  amount: number;
}

/**
 * Valide une repartition de mises.
 *
 * Le budget d'un parieur est la TOTALITE de son capital, et il doit l'engager
 * entierement : on avance de carte en carte avec ce qu'il reste. Autoriser une
 * mise partielle reviendrait a offrir une option sans risque.
 */
export function validateBetDistribution(
  lines: BetLine[],
  budget: number,
  answerIds: string[],
  options: { allowNoneOption: boolean; modifiers: RoundModifiers },
): BetLine[] {
  const positive = lines.filter((l) => l.amount !== 0);

  for (const line of positive) {
    if (!Number.isInteger(line.amount) || line.amount < 0) {
      throw new GameRuleError("INVALID_AMOUNT", "Une mise est un nombre entier positif.", 400);
    }
    if (line.isNoneOption) {
      if (!options.allowNoneOption) {
        throw new GameRuleError(
          "NONE_OPTION_DISABLED",
          "L'option « aucune de ces réponses » n'est pas active sur ce round.",
          400,
        );
      }
      if (line.answerId) {
        throw new GameRuleError("INVALID_BET", "Une mise « aucune » ne vise pas de réponse.", 400);
      }
      continue;
    }
    if (!line.answerId || !answerIds.includes(line.answerId)) {
      throw new GameRuleError("UNKNOWN_ANSWER", "Mise sur une réponse inconnue.", 400);
    }
  }

  const targets = positive.map((l) => (l.isNoneOption ? "__NONE__" : l.answerId));
  if (new Set(targets).size !== targets.length) {
    throw new GameRuleError("DUPLICATE_BET", "Une seule mise par réponse.", 400);
  }

  const total = positive.reduce((s, l) => s + l.amount, 0);
  if (total !== budget) {
    throw new GameRuleError(
      "BUDGET_MISMATCH",
      `Il faut répartir exactement ${budget} points (${total} répartis).`,
      400,
    );
  }

  if (options.modifiers.requireSingleAnswerBet && positive.length !== 1) {
    throw new GameRuleError(
      "SINGLE_BET_REQUIRED",
      "Tapis : tout le budget doit aller sur une seule réponse.",
      400,
    );
  }

  return positive;
}

export function allBettorsSubmitted(round: RoundSnapshot): boolean {
  const bettors = round.participants.filter((p) => p.role === "BETTOR");
  return bettors.length > 0 && bettors.every((p) => p.hasSubmitted);
}

/** Un round est resoluble des que tous ses parieurs ont mise. */
export function canResolve(round: RoundSnapshot): boolean {
  return round.status === "BETTING" && allBettorsSubmitted(round);
}

/** Le prochain bluffeur est le joueur actif suivant dans l'ordre du tour. */
export function nextBluffeur(
  players: SessionPlayerSnapshot[],
  previousBluffeurId: string | null,
): SessionPlayerSnapshot {
  const active = players
    .filter((p) => !p.isEliminated)
    .sort((a, b) => a.turnOrder - b.turnOrder);
  if (active.length === 0) {
    throw new GameRuleError("NO_ACTIVE_PLAYER", "Plus aucun joueur actif.");
  }
  if (!previousBluffeurId) return active[0]!;

  const previous = players.find((p) => p.userId === previousBluffeurId);
  if (!previous) return active[0]!;
  // Premier joueur actif strictement apres l'ancien bluffeur, sinon on boucle.
  return active.find((p) => p.turnOrder > previous.turnOrder) ?? active[0]!;
}

export interface SessionOutcome {
  isFinished: boolean;
  winnerId: string | null;
  eliminatedIds: string[];
}

/** La partie s'arrete des qu'il ne reste qu'un joueur avec des points. */
export function evaluateSessionOutcome(players: SessionPlayerSnapshot[]): SessionOutcome {
  const eliminatedIds = players.filter((p) => p.points <= 0).map((p) => p.userId);
  const survivors = players.filter((p) => p.points > 0);

  if (survivors.length === 1) {
    return { isFinished: true, winnerId: survivors[0]!.userId, eliminatedIds };
  }
  if (survivors.length === 0) {
    return { isFinished: true, winnerId: null, eliminatedIds };
  }
  return { isFinished: false, winnerId: null, eliminatedIds };
}

/** Positions melangees, figees a la fin de la phase d'ecriture. */
export function shufflePositions(count: number): number[] {
  const positions = Array.from({ length: count }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j]!, positions[i]!];
  }
  return positions;
}

export const ANSWER_COUNT = ANSWERS_PER_ROUND;
