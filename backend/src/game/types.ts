export type RoundStatus = "WRITING" | "BETTING" | "RESOLVED" | "CANCELLED";
export type RoundMode = "STANDARD" | "FULL_BLUFF";
export type RoundRole = "BLUFFEUR" | "BETTOR";

/**
 * Tous les leviers qu'un twist peut actionner sur un round.
 * Ajouter un levier ici = tous les twists en beneficient, sans toucher au moteur.
 */
export interface RoundModifiers {
  /** Multiplie le budget de mise distribue aux parieurs. */
  stakeBudgetMultiplier: number;
  /** Multiplie les points qui changent de main a la resolution. */
  transferMultiplier: number;
  /** Interdit de repartir : tout le budget sur une seule reponse. */
  requireSingleAnswerBet: boolean;
  /** Prime que le bluffeur verse a chaque parieur ayant tout mise sur la vraie reponse. */
  bluffeurAnte: number;
  /** Multiplicateur du gain d'un pari « aucune de ces reponses » reussi. */
  noneBonusMultiplier: number;
}

export const NEUTRAL_MODIFIERS: RoundModifiers = {
  stakeBudgetMultiplier: 1,
  transferMultiplier: 1,
  requireSingleAnswerBet: false,
  bluffeurAnte: 0,
  noneBonusMultiplier: 1,
};

export interface RoundParticipantSnapshot {
  userId: string;
  role: RoundRole;
  hasSubmitted: boolean;
  budget: number;
}

export interface RoundSnapshot {
  id: string;
  status: RoundStatus;
  mode: RoundMode;
  bluffeurId: string;
  stakeBudget: number;
  allowNoneOption: boolean;
  deadlineAt: Date | null;
  participants: RoundParticipantSnapshot[];
}

export interface SessionPlayerSnapshot {
  userId: string;
  points: number;
  isEliminated: boolean;
  turnOrder: number;
}

/**
 * Probabilite qu'un round soit joue en mode FULL_BLUFF (aucune reponse vraie),
 * quand le salon a active l'option « aucune de ces reponses ».
 *
 * Ce mode est volontairement CACHE et non declenche par un twist : si les
 * parieurs savaient que le round est un FULL_BLUFF, l'option « aucune »
 * deviendrait un choix gratuit. Ils voient exactement la meme interface dans
 * les deux cas, seul le bluffeur sait.
 */
export const FULL_BLUFF_PROBABILITY = 0.15;
