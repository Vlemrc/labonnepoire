import type { AvatarConfig, SessionView } from "@poire/shared";
import { toRoundView } from "../rounds/serializers.js";
import type { RoundWithRelations } from "../rounds/service.js";
import type { SessionWithRelations } from "./service.js";

export function toSessionView(session: SessionWithRelations, viewerId: string): SessionView {
  const current = session.rounds[0];
  return {
    id: session.id,
    groupId: session.groupId,
    status: session.status,
    currentRoundNumber: session.currentRoundNumber,
    winnerId: session.winnerId,
    players: session.players.map((p) => ({
      userId: p.userId,
      pseudo: p.user.pseudo,
      avatarConfig: p.user.avatarConfig as unknown as AvatarConfig,
      points: p.points,
      isEliminated: p.isEliminated,
      turnOrder: p.turnOrder,
      twistCardUsed: p.twistCardUsed,
    })),
    currentRound: current
      ? toRoundView(
          // La requete session charge le round avec les memes relations, mais
          // sans `session` : on la reinjecte pour reutiliser le meme serializer.
          { ...current, session } as unknown as RoundWithRelations,
          viewerId,
        )
      : null,
  };
}
