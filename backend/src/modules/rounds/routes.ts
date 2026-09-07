import { Router } from "express";
import { z } from "zod";
import { requireAuth, currentUser } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { toRoundView } from "./serializers.js";
import {
  activateTwist,
  loadRound,
  resolveRoundAndScore,
  submitAnswers,
  submitBets,
} from "./service.js";

export const roundsRouter = Router();
roundsRouter.use(requireAuth);

const answersSchema = z.object({
  answers: z.array(z.string()).min(2).max(3),
});

const betsSchema = z.object({
  bets: z
    .array(
      z.object({
        answerId: z.string().nullable().optional(),
        isNoneOption: z.boolean().optional().default(false),
        amount: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(4),
});

const twistSchema = z.object({ code: z.string().optional() });

async function assertParticipant(roundId: string, userId: string) {
  const round = await loadRound(roundId);
  if (!round.participants.some((p) => p.userId === userId)) {
    throw new HttpError(403, "NOT_IN_ROUND", "Tu ne participes pas a ce round.");
  }
  return round;
}

roundsRouter.get("/:roundId", async (req, res) => {
  const userId = currentUser(req).id;
  const round = await assertParticipant(req.params.roundId, userId);
  res.json({ round: toRoundView(round, userId) });
});

/** Bluffeur : depose ses fausses reponses et ouvre la phase de mises. */
roundsRouter.post("/:roundId/answers", async (req, res) => {
  const userId = currentUser(req).id;
  const { answers } = answersSchema.parse(req.body);
  await assertParticipant(req.params.roundId, userId);
  const round = await submitAnswers(req.params.roundId, userId, answers);
  res.status(201).json({ round: toRoundView(round, userId) });
});

/** Parieur : repartit son budget. Les mises restent secretes jusqu'a la resolution. */
roundsRouter.post("/:roundId/bets", async (req, res) => {
  const userId = currentUser(req).id;
  const { bets } = betsSchema.parse(req.body);
  await assertParticipant(req.params.roundId, userId);
  const round = await submitBets(
    req.params.roundId,
    userId,
    bets.map((b) => ({
      answerId: b.answerId ?? null,
      isNoneOption: b.isNoneOption ?? false,
      amount: b.amount,
    })),
  );
  res.status(201).json({ round: toRoundView(round, userId) });
});

roundsRouter.post("/:roundId/twist", async (req, res) => {
  const userId = currentUser(req).id;
  const { code } = twistSchema.parse(req.body);
  await assertParticipant(req.params.roundId, userId);
  const round = await activateTwist(req.params.roundId, userId, code);
  res.json({ round: toRoundView(round, userId) });
});

/** Force la resolution : utile quand la deadline est passee et qu'un joueur traine. */
roundsRouter.post("/:roundId/resolve", async (req, res) => {
  const userId = currentUser(req).id;
  await assertParticipant(req.params.roundId, userId);
  const round = await resolveRoundAndScore(req.params.roundId);
  res.json({ round: toRoundView(round, userId) });
});
