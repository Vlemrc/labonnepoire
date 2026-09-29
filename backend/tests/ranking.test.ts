import { describe, expect, it } from "vitest";
import { rankPlayers, type SessionPlayerView } from "@poire/shared";

function player(pseudo: string, over: Partial<SessionPlayerView> = {}): SessionPlayerView {
  return {
    userId: pseudo,
    pseudo,
    avatar: "alien",
    points: 0,
    isEliminated: true,
    eliminatedAt: null,
    eliminatedManche: null,
    eliminatedCard: null,
    turnOrder: 0,
    twistCardUsed: false,
    ...over,
  };
}

const at = (minute: number) => new Date(Date.UTC(2026, 8, 29, 18, minute)).toISOString();

describe("rankPlayers", () => {
  it("place le vainqueur en tete puis les perdants du dernier elimine au premier", () => {
    const ranked = rankPlayers(
      [
        player("Ana", { eliminatedAt: at(1) }),
        player("Live", { isEliminated: false, points: 4 }),
        player("Ines", { eliminatedAt: at(9) }),
      ],
      "Live",
    );
    expect(ranked.map((r) => [r.player.pseudo, r.rank])).toEqual([
      ["Live", 1],
      ["Ines", 2],
      ["Ana", 3],
    ]);
  });

  it("donne le meme rang aux joueurs tombes sur la meme carte", () => {
    const ranked = rankPlayers(
      [
        player("Live", { isEliminated: false, points: 4 }),
        player("Margot", { eliminatedAt: at(1) }),
        player("Hugo", { eliminatedAt: at(1) }),
        player("Ines", { eliminatedAt: at(2) }),
      ],
      "Live",
    );
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 3]);
  });

  it("classe par points les joueurs d'une partie anterieure, sans instant d'elimination", () => {
    const ranked = rankPlayers(
      [player("A", { points: 0 }), player("B", { isEliminated: false, points: 7 }), player("C", { isEliminated: false, points: 3 })],
      null,
    );
    expect(ranked.map((r) => r.player.pseudo)).toEqual(["B", "C", "A"]);
  });
});
