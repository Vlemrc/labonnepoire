import type { SessionPlayerView } from "./types.js";

export interface RankedPlayer {
  player: SessionPlayerView;
  /** 1 pour le vainqueur. Des joueurs tombes sur la meme carte partagent un rang. */
  rank: number;
}

/**
 * Classement de fin de partie : le vainqueur, puis les perdants du dernier
 * elimine au premier. Tomber plus tard, c'est avoir mieux resiste.
 *
 * Les parties d'avant l'enregistrement de l'instant d'elimination n'ont pas
 * d'eliminatedAt : ces joueurs passent apres, departages par leurs points.
 */
export function rankPlayers(players: SessionPlayerView[], winnerId: string | null): RankedPlayer[] {
  const time = (p: SessionPlayerView) => (p.eliminatedAt ? Date.parse(p.eliminatedAt) : null);
  const standing = (p: SessionPlayerView) => (p.userId === winnerId ? 0 : p.isEliminated ? 2 : 1);

  const sorted = [...players].sort((a, b) => {
    const byStanding = standing(a) - standing(b);
    if (byStanding !== 0) return byStanding;
    const ta = time(a);
    const tb = time(b);
    if (ta !== tb) {
      if (ta === null) return 1;
      if (tb === null) return -1;
      return tb - ta;
    }
    return b.points - a.points;
  });

  const tied = (a: SessionPlayerView, b: SessionPlayerView) =>
    standing(a) === standing(b) && time(a) === time(b) && (time(a) !== null || a.points === b.points);

  const ranked: RankedPlayer[] = [];
  sorted.forEach((player, index) => {
    const previous = ranked[index - 1];
    const rank = previous && tied(previous.player, player) ? previous.rank : index + 1;
    ranked.push({ player, rank });
  });
  return ranked;
}
