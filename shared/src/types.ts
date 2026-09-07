// Types partages entre le backend et l'app mobile.
// Volontairement independants de Prisma : ce sont les contrats de l'API HTTP.

export type SessionStatus = "LOBBY" | "IN_PROGRESS" | "FINISHED";
export type RoundStatus = "WRITING" | "BETTING" | "RESOLVED" | "CANCELLED";
export type RoundMode = "STANDARD" | "FULL_BLUFF";
export type RoundRole = "BLUFFEUR" | "BETTOR";
export type AnswerOrigin = "CARD" | "PLAYER";

export interface AvatarConfig {
  base: string;
  skin: string;
  accessories: string[];
  background: string;
}

export interface PublicUser {
  id: string;
  pseudo: string;
  avatarConfig: AvatarConfig;
}

export interface GroupSettings {
  startingPoints: number;
  stakeBudget: number;
  themes: string[];
  allowNoneOption: boolean;
  twistsEnabled: boolean;
  roundDurationHours: number;
}

export interface GroupSummary extends GroupSettings {
  id: string;
  code: string;
  name: string;
  ownerId: string;
  members: PublicUser[];
  activeSessionId: string | null;
}

export interface SessionPlayerView {
  userId: string;
  pseudo: string;
  avatarConfig: AvatarConfig;
  points: number;
  isEliminated: boolean;
  turnOrder: number;
  twistCardUsed: boolean;
}

export interface SessionView {
  id: string;
  groupId: string;
  status: SessionStatus;
  currentRoundNumber: number;
  winnerId: string | null;
  players: SessionPlayerView[];
  currentRound: RoundView | null;
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
  number: number;
  /** Revele uniquement a la resolution : sert au signalement de carte. */
  cardId: string | null;
  status: RoundStatus;
  mode: RoundMode;
  stakeBudget: number;
  allowNoneOption: boolean;
  deadlineAt: string | null;
  bluffeur: PublicUser;
  /** Role du joueur qui fait la requete. */
  myRole: RoundRole;
  participants: RoundParticipantView[];
  twist: TwistView | null;
  /** Presente uniquement pour le bluffeur, pendant la phase WRITING. */
  card: { question: string; trueAnswer: string; theme: string } | null;
  /** Presente en phase BETTING (parieurs) : melangees, anonymes. */
  answers: AnswerPublicView[] | null;
  /** Ma propre repartition de mises, si deja soumise. */
  myBets: { answerId: string | null; isNoneOption: boolean; amount: number }[] | null;
  /** Presente uniquement quand status === RESOLVED. */
  result: RoundResultView | null;
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
