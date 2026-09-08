import type {
  AnswerRevealedView,
  RoundResultView,
  RoundView,
  TwistView,
} from "@poire/shared";
import { toPublicUser } from "../users/serializers.js";
import { getTwist } from "../../game/twists/registry.js";
import type { RoundWithRelations } from "./service.js";

/**
 * Vue d'un round filtree selon le role du demandeur.
 *
 * C'est LE point sensible de l'API : la vraie reponse et l'auteur de chaque
 * fausse reponse ne doivent jamais partir vers un parieur avant la resolution,
 * sinon lire la reponse HTTP suffit a gagner. Tout ce qui est confidentiel est
 * ajoute explicitement, jamais par diffusion de l'objet Prisma.
 */
export function toRoundView(round: RoundWithRelations, viewerId: string): RoundView {
  const isBluffeur = round.bluffeurId === viewerId;
  const isResolved = round.status === "RESOLVED";
  const twist = buildTwistView(round);

  const answersVisible = round.status === "BETTING" || isResolved;
  const myBets = round.bets
    .filter((b) => b.bettorId === viewerId)
    .map((b) => ({ answerId: b.answerId, isNoneOption: b.isNoneOption, amount: b.amount }));

  return {
    id: round.id,
    sessionId: round.sessionId,
    number: round.number,
    cardId: isResolved ? round.cardId : null,
    status: round.status,
    // Le mode reste cache aux parieurs tant que le round n'est pas resolu :
    // savoir qu'on est en FULL_BLUFF rendrait l'option « aucune » gratuite.
    mode: isBluffeur || isResolved ? round.mode : "STANDARD",
    stakeBudget: round.stakeBudget,
    allowNoneOption: round.allowNoneOption,
    deadlineAt: round.deadlineAt?.toISOString() ?? null,
    bluffeur: toPublicUser(round.bluffeur),
    myRole: isBluffeur ? "BLUFFEUR" : "BETTOR",
    participants: round.participants.map((p) => ({
      user: toPublicUser(p.user),
      role: p.role,
      hasSubmitted: p.hasSubmitted,
      // Le budget des autres n'a pas a circuler avant la resolution.
      budget: p.userId === viewerId || isResolved ? p.budget : 0,
    })),
    twist,
    card:
      isBluffeur && round.status === "WRITING"
        ? {
            question: round.card.question,
            trueAnswer: round.card.trueAnswer,
            theme: round.card.theme,
          }
        : null,
    answers: answersVisible
      ? round.answers.map((a) => ({ id: a.id, text: a.text, position: a.position }))
      : null,
    myBets: myBets.length > 0 ? myBets : null,
    result: isResolved ? buildResultView(round) : null,
  };
}

function buildTwistView(round: RoundWithRelations): TwistView | null {
  if (!round.twistCode) return null;
  const definition = getTwist(round.twistCode);
  if (!definition) return null;
  return {
    code: definition.code,
    label: definition.label,
    description: definition.description,
    activatedBy: round.twistActivatedBy ? toPublicUser(round.twistActivatedBy) : null,
  };
}

function buildResultView(round: RoundWithRelations): RoundResultView {
  const stored = (round.result ?? {}) as {
    deltas?: Record<string, number>;
    pointsAfter?: Record<string, number>;
  };

  const answers: AnswerRevealedView[] = round.answers.map((a) => ({
    id: a.id,
    text: a.text,
    position: a.position,
    isTrue: a.isTrue,
    origin: a.origin,
    author: a.author ? toPublicUser(a.author) : null,
    betsReceived: round.bets
      .filter((b) => b.answerId === a.id)
      .map((b) => ({ bettor: toPublicUser(b.bettor), amount: b.amount })),
  }));

  return {
    question: round.card.question,
    trueAnswerId: round.answers.find((a) => a.isTrue)?.id ?? null,
    answers,
    deltas: round.session.players.map((p) => ({
      user: toPublicUser(p.user),
      delta: stored.deltas?.[p.userId] ?? 0,
      pointsAfter: stored.pointsAfter?.[p.userId] ?? p.points,
      isEliminated: p.isEliminated,
    })),
  };
}
