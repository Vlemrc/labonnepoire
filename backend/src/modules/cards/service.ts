import { prisma } from "../../lib/prisma.js";
import { GameRuleError } from "../../game/errors.js";
import { HttpError } from "../../middleware/error.js";

/**
 * Nombre de signalements a partir duquel une carte sort automatiquement du
 * tirage. Les joueurs reperent les cartes fausses bien mieux qu'une relecture
 * en amont : autant leur laisser retirer le contenu douteux sans intervention.
 */
export const REPORT_THRESHOLD = 3;

export async function reportCard(cardId: string, userId: string, reason?: string) {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) throw new HttpError(404, "CARD_NOT_FOUND", "Carte introuvable.");

  // On ne peut signaler qu'une carte qu'on a reellement vue en jeu, sinon
  // n'importe qui pourrait vider le paquet.
  const played = await prisma.roundParticipant.findFirst({
    where: { userId, round: { cardId } },
  });
  if (!played) {
    throw new HttpError(403, "CARD_NOT_PLAYED", "Tu n'as pas joue cette carte.");
  }

  const already = await prisma.cardReport.findUnique({
    where: { cardId_userId: { cardId, userId } },
  });
  if (already) {
    throw new GameRuleError("ALREADY_REPORTED", "Tu as deja signale cette carte.");
  }

  const [, updated] = await prisma.$transaction([
    prisma.cardReport.create({ data: { cardId, userId, reason: reason ?? null } }),
    prisma.card.update({
      where: { id: cardId },
      data: { reportCount: { increment: 1 } },
    }),
  ]);

  if (updated.reportCount >= REPORT_THRESHOLD && updated.status !== "REJECTED") {
    return prisma.card.update({ where: { id: cardId }, data: { status: "REJECTED" } });
  }
  return updated;
}
