import type { AvatarId, SessionView } from "@poire/shared";
import { DEFAULT_AVATAR } from "@poire/shared";
import { toRoundView } from "../rounds/serializers.js";
import type { RoundWithRelations } from "../rounds/service.js";
import type { SessionWithRelations } from "./service.js";

export function toSessionView(session: SessionWithRelations, viewerId: string): SessionView {
  // On ne garde que la manche la plus recente.
  const manche = session.rounds[0]?.manche ?? 0;
  const rounds = session.rounds.filter((r) => r.manche === manche);

  /**
   * La carte a montrer depend du demandeur. Tant qu'il n'a pas ecrit ses
   * mensonges, c'est la sienne ; ensuite c'est celle qui se joue, la meme pour
   * tout le monde ; a defaut, la derniere resolue.
   */
  const current =
    rounds.find((r) => r.status === "WRITING" && r.bluffeurId === viewerId) ??
    rounds.find((r) => r.status === "BETTING") ??
    [...rounds].reverse().find((r) => r.status === "RESOLVED" || r.status === "CANCELLED") ??
    rounds.find((r) => r.status === "WRITING");
  return {
    id: session.id,
    groupId: session.groupId,
    status: session.status,
    currentRoundNumber: session.currentRoundNumber,
    winnerId: session.winnerId,
    players: session.players.map((p) => ({
      userId: p.userId,
      pseudo: p.user.pseudo,
      avatar: (p.user.avatar as AvatarId) ?? DEFAULT_AVATAR,
      points: p.points,
      isEliminated: p.isEliminated,
      turnOrder: p.turnOrder,
      twistCardUsed: p.twistCardUsed,
    })),
    manche,
    // Nombre de cartes encore a jouer dans la manche, cette carte comprise.
    cardsLeft: rounds.filter((r) => r.status !== "RESOLVED" && r.status !== "CANCELLED").length,
    cardsTotal: rounds.length,
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
