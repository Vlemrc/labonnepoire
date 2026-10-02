// Types partages entre le backend et l'app mobile.
// Volontairement independants de Prisma : ce sont les contrats de l'API HTTP.

import type { AvatarId } from "./constants.js";

export type SessionStatus = "LOBBY" | "IN_PROGRESS" | "FINISHED";
export type RoundStatus = "WRITING" | "PENDING" | "BETTING" | "RESOLVED" | "CANCELLED";
export type RoundMode = "STANDARD" | "FULL_BLUFF";
export type RoundRole = "BLUFFEUR" | "BETTOR";
export type AnswerOrigin = "CARD" | "PLAYER";

export interface PublicUser {
  id: string;
  pseudo: string;
  avatar: AvatarId;
}

export interface GroupSettings {
  startingPoints: number;
  themes: string[];
  allowNoneOption: boolean;
  twistsEnabled: boolean;
}

export interface GroupSummary extends GroupSettings {
  id: string;
  code: string;
  name: string;
  ownerId: string;
  members: PublicUser[];
  activeSessionId: string | null;
  /** Derniere partie, si elle est terminee et qu'aucune autre n'a ete lancee depuis. */
  lastFinishedSessionId: string | null;
}

export interface SessionPlayerView {
  userId: string;
  pseudo: string;
  avatar: AvatarId;
  points: number;
  isEliminated: boolean;
  /** Instant de l'elimination (ISO) : ordonne les perdants sur l'ecran de fin. */
  eliminatedAt: string | null;
  eliminatedManche: number | null;
  /** Carte fatale dans sa manche ; nulle pour un abandon. */
  eliminatedCard: number | null;
  turnOrder: number;
  twistCardUsed: boolean;
}

export interface SessionView {
  id: string;
  groupId: string;
  status: SessionStatus;
  currentRoundNumber: number;
  /** Manche en cours : une carte par joueur, ecrites en parallele. */
  manche: number;
  /** Cartes de la manche encore a jouer, celle en cours comprise. */
  cardsLeft: number;
  cardsTotal: number;
  winnerId: string | null;
  players: SessionPlayerView[];
  currentRound: RoundView | null;
  /**
   * Les cartes de la manche, une par joueur. Pendant l'ecriture, une carte en
   * WRITING signale un joueur qui n'a pas encore ecrit ses mensonges.
   */
  mancheCards: { roundId: string; number: number; status: RoundStatus; bluffeur: PublicUser }[];
}

/** Une reponse telle qu'elle est vue par un parieur AVANT resolution : rien ne fuite. */
export interface AnswerPublicView {
  id: string;
  text: string;
  position: number;
}

/** Une reponse APRES resolution : tout est revele. */
export interface AnswerRevealedView extends AnswerPublicView {
  isTrue: boolean;
  origin: AnswerOrigin;
  author: PublicUser | null;
  betsReceived: { bettor: PublicUser; amount: number }[];
}

export interface RoundParticipantView {
  user: PublicUser;
  role: RoundRole;
  hasSubmitted: boolean;
  budget: number;
}

export interface RoundView {
  id: string;
  sessionId: string;
  manche: number;
  number: number;
  /** Revele uniquement a la resolution : sert au signalement de carte. */
  cardId: string | null;
  status: RoundStatus;
  mode: RoundMode;
  /** Jetons que CE joueur doit repartir : la totalite de son capital. */
  myBudget: number;
  allowNoneOption: boolean;
  bluffeur: PublicUser;
  /** Role du joueur qui fait la requete. */
  myRole: RoundRole;
  participants: RoundParticipantView[];
  twist: TwistView | null;
  /** Presente uniquement pour le bluffeur, pendant la phase WRITING. */
  card: { question: string; trueAnswer: string; theme: string } | null;
  /**
   * La question, sans la reponse : visible de tous des l'ouverture des mises,
   * et toujours pour le bluffeur.
   */
  question: string | null;
  /**
   * Les mises recues, en direct : uniquement pour le bluffeur pendant BETTING.
   * Il ne mise pas sur sa propre carte, les voir ne lui donne aucun avantage.
   */
  liveBets: {
    trueAnswerId: string | null;
    bets: { bettor: PublicUser; answerId: string | null; isNoneOption: boolean; amount: number }[];
  } | null;
  /** Presente en phase BETTING (parieurs) : melangees, anonymes. */
  answers: AnswerPublicView[] | null;
  /** Ma propre repartition de mises, si deja soumise. */
  myBets: { answerId: string | null; isNoneOption: boolean; amount: number }[] | null;
  /** Presente quand status vaut RESOLVED ou CANCELLED. */
  result: RoundResultView | null;
  /** Pourquoi le round a ete annule, le cas echeant. */
  cancelReason: "PLAYER_LEFT" | null;
}

export interface RoundResultView {
  question: string;
  trueAnswerId: string | null;
  answers: AnswerRevealedView[];
  deltas: { user: PublicUser; delta: number; pointsAfter: number; isEliminated: boolean }[];
}

export interface TwistView {
  code: string;
  label: string;
  description: string;
  activatedBy: PublicUser | null;
}

export interface BetInput {
  answerId?: string | null;
  isNoneOption?: boolean;
  amount: number;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}
