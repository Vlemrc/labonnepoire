import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { app, as, resetDatabase, signUp, type TestPlayer } from "./helpers/api.js";
import request from "supertest";
import { rankPlayers } from "@poire/shared";

const THEMES = ["animaux", "histoire", "insolite", "mots-et-langues", "lois-et-traditions"];

async function setupSession(pseudos: string[], settings: Record<string, unknown> = {}) {
  const players: TestPlayer[] = [];
  for (const p of pseudos) players.push(await signUp(p));
  const [owner, ...others] = players as [TestPlayer, ...TestPlayer[]];

  const groupRes = await as(owner)
    .post("/groups")
    .send({ name: "Les copains", themes: THEMES, ...settings })
    .expect(201);
  const group = groupRes.body.group;

  for (const other of others) {
    await as(other).post("/groups/join").send({ code: group.code }).expect(200);
  }
  const sessionRes = await as(owner).post(`/groups/${group.id}/sessions`).expect(201);
  return { players, owner, group, session: sessionRes.body.session };
}

/** Le bluffeur est designe par le serveur : on le retrouve depuis la vue du round. */
function splitRoles(players: TestPlayer[], bluffeurId: string) {
  const bluffeur = players.find((p) => p.id === bluffeurId)!;
  const bettors = players.filter((p) => p.id !== bluffeurId);
  return { bluffeur, bettors };
}

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

/** Chaque joueur ecrit les mensonges de SA carte. */
async function writeAll(players: TestPlayer[], sessionId: string) {
  for (const player of players) {
    const view = await as(player).get(`/sessions/${sessionId}`).expect(200);
    const round = view.body.session.currentRound;
    if (!round || round.status !== "WRITING") continue;
    const fakes = round.mode === "FULL_BLUFF" ? ["A", "B", "C"] : ["A", "B"];
    await as(player).post(`/rounds/${round.id}/answers`).send({ answers: fakes }).expect(201);
  }
}

/**
 * Le joueur mise tout son capital sur une carte precise.
 *
 * On vise un roundId plutot que « la carte en cours » : des que le dernier
 * parieur a joue, la carte suivante s'ouvre, et un helper qui suivrait l'etat
 * courant ferait miser les joueurs restants sur la mauvaise carte.
 */
async function betAll(
  player: TestPlayer,
  roundId: string,
  pick: "first" | "spread" = "first",
) {
  const view = await as(player).get(`/rounds/${roundId}`).expect(200);
  const round = view.body.round;
  if (!round || round.status !== "BETTING" || round.myRole !== "BETTOR") return null;
  const budget = round.myBudget as number;
  const ids = (round.answers as { id: string }[]).map((a) => a.id);
  const bets =
    pick === "first" || budget < 3
      ? [{ answerId: ids[0], amount: budget }]
      : [
          { answerId: ids[0], amount: budget - 2 },
          { answerId: ids[1], amount: 1 },
          { answerId: ids[2], amount: 1 },
        ];
  await as(player).post(`/rounds/${roundId}/bets`).send({ bets }).expect(201);
  return roundId;
}

/**
 * Mise tout sur la vraie reponse : le capital ne bouge pas.
 * Indispensable des qu'un test doit traverser plusieurs cartes — miser a
 * l'aveugle finit par eliminer quelqu'un et termine la partie en cours de route.
 */
async function betOnTruth(player: TestPlayer, roundId: string) {
  const view = await as(player).get(`/rounds/${roundId}`).expect(200);
  const round = view.body.round;
  if (!round || round.status !== "BETTING" || round.myRole !== "BETTOR") return;
  const card = await prisma.card.findFirstOrThrow({ where: { rounds: { some: { id: roundId } } } });
  const good = (round.answers as { id: string; text: string }[]).find(
    (a) => a.text === card.trueAnswer,
  );
  const target = good ?? round.answers[0];
  await as(player)
    .post(`/rounds/${roundId}/bets`)
    .send({ bets: [{ answerId: target.id, amount: round.myBudget }] })
    .expect(201);
}

describe("boucle de jeu : une manche, une carte par joueur", () => {
  it("distribue une carte a chacun et attend que tous aient ecrit", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);

    // Chaque joueur voit SA carte, avec la vraie reponse.
    const seen = new Set<string>();
    for (const player of players) {
      const view = await as(player).get(`/sessions/${session.id}`).expect(200);
      const round = view.body.session.currentRound;
      expect(round.status).toBe("WRITING");
      expect(round.myRole).toBe("BLUFFEUR");
      expect(round.card.trueAnswer).toBeTruthy();
      seen.add(round.id);
    }
    expect(seen.size).toBe(3); // trois cartes differentes

    // Tant qu'il en manque un, rien ne s'ouvre aux mises.
    await writeAll([players[0]!, players[1]!], session.id);
    const partial = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
    expect(partial.body.session.currentRound.status).not.toBe("BETTING");

    await writeAll([players[2]!], session.id);
    const ready = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
    expect(ready.body.session.currentRound.status).toBe("BETTING");
    expect(ready.body.session.cardsTotal).toBe(3);
  });

  it("enchaine les cartes une par une, avec un point de score entre chaque", async () => {
    // allowNoneOption desactive : sinon une carte peut tomber en mode « tout
    // est faux », ou miser sur la vraie reponse est impossible, ce qui elimine
    // un joueur et termine la partie au milieu du test.
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"], {
      startingPoints: 60,
      allowNoneOption: false,
    });
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    await writeAll(players, session.id);

    const played: string[] = [];
    for (let card = 0; card < 3; card++) {
      const before = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
      const round = before.body.session.currentRound;
      expect(round.status).toBe("BETTING");
      played.push(round.bluffeur.id);

      for (const player of players) await betOnTruth(player, round.id);

      const after = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
      expect(after.body.session.cardsLeft).toBe(2 - card);
    }
    // Chaque joueur a vu sa carte jouee, une fois.
    expect(new Set(played).size).toBe(3);
  });

  it("fait miser au parieur la totalite de son capital, qui evolue de carte en carte", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"], {
      startingPoints: 20,
      allowNoneOption: false,
    });
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    await writeAll(players, session.id);

    const view = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
    const round = view.body.session.currentRound;
    const bettor = players.find((p) => p.id !== round.bluffeur.id)!;
    const bettorView = await as(bettor).get(`/sessions/${session.id}`).expect(200);
    expect(bettorView.body.session.currentRound.myBudget).toBe(20);

    // Moitie sur la vraie, moitie a cote : il lui reste la moitie.
    const answers = bettorView.body.session.currentRound.answers as { id: string; text: string }[];
    const bluffeurView = await as(players.find((p) => p.id === round.bluffeur.id)!)
      .get(`/rounds/${round.id}`)
      .expect(200);
    const trueText = bluffeurView.body.round.result?.answers
      ? null
      : (await prisma.card.findFirstOrThrow({ where: { rounds: { some: { id: round.id } } } }))
          .trueAnswer;
    const good = answers.find((a) => a.text === trueText)!;
    const bad = answers.find((a) => a.text !== trueText)!;
    await as(bettor)
      .post(`/rounds/${round.id}/bets`)
      .send({ bets: [{ answerId: good.id, amount: 10 }, { answerId: bad.id, amount: 10 }] })
      .expect(201);

    const after = await as(bettor).get(`/sessions/${session.id}`).expect(200);
    const me = after.body.session.players.find((p: any) => p.userId === bettor.id);
    expect(me.points).toBe(10);
  });

  it("refuse une mise qui n'engage pas tout le capital", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"], { startingPoints: 20 });
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    await writeAll(players, session.id);

    const view = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
    const round = view.body.session.currentRound;
    const bettor = players.find((p) => p.id !== round.bluffeur.id)!;
    const bettorRound = (await as(bettor).get(`/sessions/${session.id}`)).body.session.currentRound;
    const res = await as(bettor)
      .post(`/rounds/${round.id}/bets`)
      .send({ bets: [{ answerId: bettorRound.answers[0].id, amount: 5 }] })
      .expect(400);
    expect(res.body.error.code).toBe("BUDGET_MISMATCH");
  });

  it("relance une manche une fois toutes les cartes jouees", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"], {
      startingPoints: 80,
      allowNoneOption: false,
    });
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    await writeAll(players, session.id);
    for (let i = 0; i < 2; i++) {
      const current = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session
        .currentRound;
      for (const p of players) await betOnTruth(p, current.id);
    }

    const done = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
    expect(done.body.session.cardsLeft).toBe(0);
    expect(done.body.session.manche).toBe(1);

    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    const next = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
    expect(next.body.session.manche).toBe(2);
    expect(next.body.session.currentRound.status).toBe("WRITING");
  });

  it("refuse d'ouvrir une manche tant que la precedente n'est pas finie", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"]);
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    const res = await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(409);
    expect(res.body.error.code).toBe("MANCHE_IN_PROGRESS");
  });
});

describe("etancheite de l'API", () => {
  it("refuse un pseudo de plus de 14 caracteres", async () => {
    await request(app).post("/auth/session").send({ pseudo: "a".repeat(14) }).expect(201);
    const r = await request(app).post("/auth/session").send({ pseudo: "a".repeat(15) }).expect(400);
    expect(r.body.error.details[0].message).toBe("Le pseudo fait au plus 14 caractères.");
  });

  it("ne revele jamais la vraie reponse a un parieur avant la resolution", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    await writeAll(players, session.id);

    const view = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
    const round = view.body.session.currentRound;
    const bettor = players.find((p) => p.id !== round.bluffeur.id)!;

    const seen = await as(bettor).get(`/rounds/${round.id}`).expect(200);
    const payload = JSON.stringify(seen.body);
    expect(payload).not.toContain('"isTrue"');
    expect(payload).not.toContain('"authorId"');
    expect(seen.body.round.card).toBeNull();
    expect(seen.body.round.result).toBeNull();
    // Le mode reste masque : savoir qu'on est en FULL_BLUFF rendrait l'option
    // « aucune de ces reponses » gratuite.
    expect(seen.body.round.mode).toBe("STANDARD");
  });

  it("ne montre pas la carte d'un joueur a un autre pendant l'ecriture", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"]);
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);

    const mine = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;
    const theirs = (await as(players[1]!).get(`/sessions/${session.id}`)).body.session.currentRound;
    expect(mine.id).not.toBe(theirs.id);

    // La carte de l'autre ne doit rien reveler.
    const peek = await as(players[0]!).get(`/rounds/${theirs.id}`).expect(200);
    expect(peek.body.round.card).toBeNull();
    expect(peek.body.round.myRole).toBe("BETTOR");
  });

  it("garde les mises secretes jusqu'a la resolution", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    await writeAll(players, session.id);

    const round = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;
    const bettors = players.filter((p) => p.id !== round.bluffeur.id);
    await betAll(bettors[0]!, round.id);

    const other = await as(bettors[1]!).get(`/rounds/${round.id}`).expect(200);
    expect(other.body.round.status).toBe("BETTING");
    expect(JSON.stringify(other.body)).not.toContain('"bettor"');
  });

  it("montre la question aux parieurs une fois les mises ouvertes, pas avant", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    const mine = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session;
    const other = mine.mancheCards.find((c: { bluffeur: { id: string } }) => c.bluffeur.id !== players[0]!.id);
    const early = await as(players[0]!).get(`/rounds/${other.roundId}`).expect(200);
    expect(early.body.round.question).toBeNull();

    await writeAll(players, session.id);
    const round = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;
    const bettor = players.find((p) => p.id !== round.bluffeur.id)!;
    const view = await as(bettor).get(`/rounds/${round.id}`).expect(200);
    expect(view.body.round.question).toEqual(expect.any(String));
    expect(view.body.round.card).toBeNull();
  });

  it("montre les mises en direct au seul auteur de la carte", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    // En bluff total il n'y a pas de vraie reponse a designer.
    await prisma.round.updateMany({ where: { sessionId: session.id }, data: { mode: "STANDARD" } });
    await writeAll(players, session.id);

    const round = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;
    const { bluffeur, bettors } = splitRoles(players, round.bluffeur.id);
    await betAll(bettors[0]!, round.id);

    const live = (await as(bluffeur).get(`/rounds/${round.id}`).expect(200)).body.round.liveBets;
    expect(live.trueAnswerId).toEqual(expect.any(String));
    expect(live.bets).toHaveLength(1);
    expect(live.bets[0].bettor.id).toBe(bettors[0]!.id);

    const peek = await as(bettors[1]!).get(`/rounds/${round.id}`).expect(200);
    expect(peek.body.round.liveBets).toBeNull();
  });

  it("indique qui n'a pas encore ecrit dans la manche", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    await writeAll([players[0]!], session.id);

    const cards = (await as(players[1]!).get(`/sessions/${session.id}`)).body.session.mancheCards;
    const writing = cards.filter((c: { status: string }) => c.status === "WRITING");
    expect(writing.map((c: { bluffeur: { id: string } }) => c.bluffeur.id).sort()).toEqual(
      [players[1]!.id, players[2]!.id].sort(),
    );
  });

  it("refuse l'acces a un joueur exterieur a la partie", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"]);
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    const round = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;
    const intrus = await signUp("Intrus");
    await as(intrus).get(`/rounds/${round.id}`).expect(403);
    await as(intrus).get(`/sessions/${session.id}`).expect(403);
  });

  it("exige un token valide", async () => {
    await request(app).get("/groups").expect(401);
    await request(app).get("/groups").set("Authorization", "Bearer nawak").expect(401);
  });
});

describe("garde-fous de la boucle", () => {
  it("empeche d'ecrire les mensonges de la carte d'un autre", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"]);
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    const theirs = (await as(players[1]!).get(`/sessions/${session.id}`)).body.session.currentRound;

    const res = await as(players[0]!)
      .post(`/rounds/${theirs.id}/answers`)
      .send({ answers: ["A", "B"] })
      .expect(403);
    expect(res.body.error.code).toBe("NOT_BLUFFEUR");
  });

  it("empeche le proprietaire de la carte de miser dessus", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"]);
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    await writeAll(players, session.id);

    const round = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;
    const owner = players.find((p) => p.id === round.bluffeur.id)!;
    const ownerView = await as(owner).get(`/rounds/${round.id}`).expect(200);
    expect(ownerView.body.round.myRole).toBe("BLUFFEUR");

    const res = await as(owner)
      .post(`/rounds/${round.id}/bets`)
      .send({ bets: [{ answerId: ownerView.body.round.answers[0].id, amount: 20 }] })
      .expect(403);
    expect(res.body.error.code).toBe("NOT_BETTOR");
  });

  it("n'autorise qu'une seule carte twist par joueur et par partie", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"]);
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    const mine = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;

    const twisted = await as(players[0]!)
      .post(`/rounds/${mine.id}/twist`)
      .send({ code: "DOUBLE_STAKES" })
      .expect(200);
    expect(twisted.body.round.twist.code).toBe("DOUBLE_STAKES");

    const again = await as(players[0]!).post(`/rounds/${mine.id}/twist`).expect(409);
    expect(again.body.error.code).toBe("TWIST_ALREADY_ACTIVE");
  });

  it("DOUBLE_STAKES double ce qui change de main", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"], {
      startingPoints: 40,
      allowNoneOption: false,
    });
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);

    // Le twist est pose sur la premiere carte de la manche.
    const first = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;
    await as(players[0]!).post(`/rounds/${first.id}/twist`).send({ code: "DOUBLE_STAKES" }).expect(200);
    await writeAll(players, session.id);

    const round = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;
    const bettor = players.find((p) => p.id !== round.bluffeur.id)!;
    const card = await prisma.card.findFirstOrThrow({
      where: { rounds: { some: { id: round.id } } },
    });
    const view = (await as(bettor).get(`/rounds/${round.id}`)).body.round;
    const wrong = view.answers.find((a: any) => a.text !== card.trueAnswer)!;

    await as(bettor)
      .post(`/rounds/${round.id}/bets`)
      .send({ bets: [{ answerId: wrong.id, amount: view.myBudget }] })
      .expect(201);

    // 40 mises a cote, doubles : le parieur tombe a zero au lieu de perdre 40.
    const after = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
    const loser = after.body.session.players.find((p: any) => p.userId === bettor.id);
    expect(loser.points).toBe(0);
    expect(loser.isEliminated).toBe(true);
  });
});

describe("cas limites", () => {
  it("termine la partie quand un joueur tombe a zero", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"], {
      startingPoints: 20,
      allowNoneOption: false,
    });
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    await writeAll(players, session.id);

    const round = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;
    const bettor = players.find((p) => p.id !== round.bluffeur.id)!;
    const card = await prisma.card.findFirstOrThrow({
      where: { rounds: { some: { id: round.id } } },
    });
    const view = (await as(bettor).get(`/rounds/${round.id}`)).body.round;
    const wrong = view.answers.find((a: any) => a.text !== card.trueAnswer)!;

    await as(bettor)
      .post(`/rounds/${round.id}/bets`)
      .send({ bets: [{ answerId: wrong.id, amount: view.myBudget }] })
      .expect(201);

    const final = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
    expect(final.body.session.status).toBe("FINISHED");
    expect(final.body.session.winnerId).toBe(round.bluffeur.id);
  });

  it("elimine le joueur qui abandonne et poursuit a trois", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    await as(players[2]!).post(`/sessions/${session.id}/quit`).expect(200);

    const view = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
    expect(view.body.session.status).toBe("IN_PROGRESS");

    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    const after = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
    // Le joueur parti ne recoit plus de carte.
    expect(after.body.session.cardsTotal).toBe(2);
  });

  it("date chaque elimination, pour classer les perdants du dernier au premier", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    await as(players[2]!).post(`/sessions/${session.id}/quit`).expect(200);
    await new Promise((r) => setTimeout(r, 5));
    await as(players[1]!).post(`/sessions/${session.id}/quit`).expect(200);

    const view = (await as(players[0]!).get(`/sessions/${session.id}`).expect(200)).body.session;
    expect(view.status).toBe("FINISHED");
    const ranking = rankPlayers(view.players, view.winnerId).map((r) => [r.player.pseudo, r.rank]);
    expect(ranking).toEqual([
      ["Ana", 1],
      ["Bruno", 2],
      ["Cleo", 3],
    ]);
  });

  it("ne fait pas attendre les cartes suivantes sur un joueur a sec", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo", "Dora"], {
      allowNoneOption: false,
    });
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    // Pas de bluff total : miser sur la vraie reponse doit toujours etre sans risque.
    await prisma.round.updateMany({ where: { sessionId: session.id }, data: { mode: "STANDARD" } });
    await writeAll(players, session.id);

    // Premiere carte : un parieur mise tout sur un mensonge et tombe a zero.
    const first = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;
    const { bettors } = splitRoles(players, first.bluffeur.id);
    const [broke, ...others] = bettors as [TestPlayer, ...TestPlayer[]];
    const card = await prisma.card.findFirstOrThrow({ where: { rounds: { some: { id: first.id } } } });
    const view = (await as(broke).get(`/rounds/${first.id}`)).body.round;
    const lie = view.answers.find((a: { text: string }) => a.text !== card.trueAnswer)!;
    await as(broke)
      .post(`/rounds/${first.id}/bets`)
      .send({ bets: [{ answerId: lie.id, amount: view.myBudget }] })
      .expect(201);
    for (const p of others) await betOnTruth(p, first.id);

    // Son elimination est datee de la carte fatale, pour l'ecran de fin.
    const players_ = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.players;
    const out = players_.find((p: { userId: string }) => p.userId === broke.id);
    expect(out.eliminatedManche).toBe(1);
    expect(out.eliminatedCard).toBe(first.number);

    // Les cartes suivantes se resolvent sans lui.
    for (let i = 0; i < 3; i++) {
      const current = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;
      expect(current.status).toBe("BETTING");
      const seat = current.participants.find((p: { user: { id: string } }) => p.user.id === broke.id);
      if (seat.role === "BETTOR") expect(seat.hasSubmitted).toBe(true);
      for (const p of players) if (p.id !== broke.id) await betOnTruth(p, current.id);
      const done = await as(players[0]!).get(`/rounds/${current.id}`).expect(200);
      expect(done.body.round.status).toBe("RESOLVED");
    }
  });

  it("termine la partie quand il ne reste qu'un joueur", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"]);
    await as(players[1]!).post(`/sessions/${session.id}/quit`).expect(200);
    const view = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
    expect(view.body.session.status).toBe("FINISHED");
    expect(view.body.session.winnerId).toBe(players[0]!.id);
  });

  it("refuse de lancer une partie a un seul joueur", async () => {
    const owner = await signUp("Solo");
    const group = (
      await as(owner).post("/groups").send({ name: "Solo", themes: THEMES }).expect(201)
    ).body.group;
    const r = await as(owner).post(`/groups/${group.id}/sessions`).expect(409);
    expect(r.body.error.code).toBe("NOT_ENOUGH_PLAYERS");
  });

  it("est idempotent : rejoindre deux fois ne cree pas de doublon", async () => {
    const { players, group } = await setupSession(["Ana", "Bruno"]);
    const res = await as(players[1]!).post("/groups/join").send({ code: group.code }).expect(200);
    expect(res.body.group.members).toHaveLength(2);
  });
});

describe("suppression du salon", () => {
  it("laisse le createur supprimer le salon, meme en pleine partie", async () => {
    const { players, owner, group, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    await as(owner).post(`/sessions/${session.id}/manches`).expect(201);

    await as(owner).delete(`/groups/${group.id}`).expect(204);

    await as(owner).get(`/groups/${group.id}`).expect(403);
    const list = await as(players[1]!).get("/groups").expect(200);
    expect(list.body.groups).toHaveLength(0);
    expect(await prisma.round.count({ where: { sessionId: session.id } })).toBe(0);
  });

  it("supprime le salon quand le dernier membre le quitte", async () => {
    const { players, group } = await setupSession(["Ana", "Bruno"]);
    await as(players[1]!).post(`/groups/${group.id}/leave`).expect(200);
    const left = await as(players[0]!).post(`/groups/${group.id}/leave`).expect(200);

    expect(left.body.group).toBeNull();
    expect(await prisma.group.count({ where: { id: group.id } })).toBe(0);
  });

  it("confie le salon au plus ancien membre quand l'hote s'en va", async () => {
    const { players, owner, group } = await setupSession(["Ana", "Bruno", "Cleo"]);
    const res = await as(owner).post(`/groups/${group.id}/leave`).expect(200);

    expect(res.body.group.ownerId).toBe(players[1]!.id);
    expect(res.body.group.members.map((m: { id: string }) => m.id)).not.toContain(owner.id);
    const list = await as(owner).get("/groups").expect(200);
    expect(list.body.groups).toHaveLength(0);
  });

  it("fait abandonner la partie en cours a celui qui quitte le salon", async () => {
    const { players, session, group } = await setupSession(["Ana", "Bruno", "Cleo"]);
    await as(players[2]!).post(`/groups/${group.id}/leave`).expect(200);

    const view = (await as(players[0]!).get(`/sessions/${session.id}`).expect(200)).body.session;
    expect(view.status).toBe("IN_PROGRESS");
    expect(view.players.find((p: { userId: string }) => p.userId === players[2]!.id).isEliminated).toBe(true);
  });

  it("refuse la suppression a un simple membre", async () => {
    const { players, group } = await setupSession(["Ana", "Bruno"]);
    const r = await as(players[1]!).delete(`/groups/${group.id}`).expect(403);
    expect(r.body.error.code).toBe("NOT_OWNER");
  });
});

describe("depart definitif d'un joueur", () => {
  it("quitte tous ses salons, rend l'hote et libere son siege", async () => {
    const { players, owner, group, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    const other = await as(owner)
      .post("/groups")
      .send({ name: "Solo", themes: THEMES })
      .expect(201);

    await as(owner).delete("/auth/session").expect(204);

    const view = await as(players[1]!).get(`/groups/${group.id}`).expect(200);
    expect(view.body.group.ownerId).toBe(players[1]!.id);
    expect(view.body.group.members.map((m: { id: string }) => m.id)).not.toContain(owner.id);
    const seat = (await as(players[1]!).get(`/sessions/${session.id}`).expect(200)).body.session
      .players.find((p: { userId: string }) => p.userId === owner.id);
    expect(seat.isEliminated).toBe(true);
    // Seul membre de son autre salon : celui-ci disparait avec lui.
    expect(await prisma.group.count({ where: { id: other.body.group.id } })).toBe(0);
  });

  it("rend son token inutilisable sans effacer son compte", async () => {
    const ana = await signUp("Ana");
    await as(ana).delete("/auth/session").expect(204);

    await as(ana).get("/auth/me").expect(401);
    expect(await prisma.user.count({ where: { id: ana.id } })).toBe(1);
  });
});

describe("gestion du paquet de cartes", () => {
  /** Ne laisse que `keep` cartes jouables, pour rendre les tirages deterministes. */
  async function shrinkDeck(theme: string, keep: number) {
    const kept = await prisma.card.findMany({
      where: { theme },
      take: keep,
      orderBy: { id: "asc" },
    });
    await prisma.card.updateMany({
      where: { id: { notIn: kept.map((c) => c.id) } },
      data: { status: "REJECTED" },
    });
    return kept;
  }

  async function cardsOfManche(sessionId: string) {
    const rounds = await prisma.round.findMany({ where: { sessionId }, select: { cardId: true } });
    return rounds.map((r) => r.cardId);
  }

  it("distribue des cartes differentes aux joueurs d'une meme manche", async () => {
    await shrinkDeck("animaux", 6);
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"], {
      themes: ["animaux"],
    });
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);

    const cards = await cardsOfManche(session.id);
    expect(cards).toHaveLength(3);
    expect(new Set(cards).size).toBe(3);
  });

  it("ne sert jamais deux fois la meme carte au meme salon", async () => {
    await shrinkDeck("animaux", 4);
    const players = [await signUp("Ana"), await signUp("Bruno")];
    const group = (
      await as(players[0]!).post("/groups").send({ name: "Salon", themes: ["animaux"] }).expect(201)
    ).body.group;
    await as(players[1]!).post("/groups/join").send({ code: group.code }).expect(200);

    const s1 = (await as(players[0]!).post(`/groups/${group.id}/sessions`).expect(201)).body.session;
    await as(players[0]!).post(`/sessions/${s1.id}/manches`).expect(201);
    const first = await cardsOfManche(s1.id);

    await as(players[1]!).post(`/sessions/${s1.id}/quit`).expect(200);
    const s2 = (await as(players[0]!).post(`/groups/${group.id}/sessions`).expect(201)).body.session;
    await as(players[0]!).post(`/sessions/${s2.id}/manches`).expect(201);
    const second = await cardsOfManche(s2.id);

    expect(second.some((c) => first.includes(c))).toBe(false);
  });

  it("recycle le paquet plutot que de bloquer quand il est epuise", async () => {
    await shrinkDeck("animaux", 2);
    const { players, session } = await setupSession(["Ana", "Bruno"], {
      themes: ["animaux"],
      allowNoneOption: false,
    });
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    await writeAll(players, session.id);

    const current = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;
    for (const p of players) await betOnTruth(p, current.id);
    const next = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;
    for (const p of players) await betOnTruth(p, next.id);

    // Le paquet est vide : la manche suivante doit quand meme s'ouvrir.
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
  });

  it("ne propose pas une thematique entierement retiree du tirage", async () => {
    await prisma.card.updateMany({ where: { theme: "animaux" }, data: { status: "REJECTED" } });
    const themes = (await request(app).get("/cards/themes").expect(200)).body.themes;
    expect(themes.map((t: any) => t.theme)).not.toContain("animaux");
  });
});

describe("signalement des cartes", () => {
  /** Ouvre une manche et rend la carte distribuee au premier joueur. */
  async function playedCard() {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    const mine = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;
    const round = await prisma.round.findUniqueOrThrow({
      where: { id: mine.id },
      select: { cardId: true },
    });
    return { players, cardId: round.cardId };
  }

  it("accepte le signalement d'un joueur qui a vu la carte", async () => {
    const { players, cardId } = await playedCard();
    const res = await as(players[0]!)
      .post(`/cards/${cardId}/report`)
      .send({ reason: "La reponse est fausse" })
      .expect(201);
    expect(res.body.card.reportCount).toBe(1);
    expect(res.body.card.status).toBe("DRAFT");
  });

  it("refuse le signalement d'un joueur qui n'a pas joue la carte", async () => {
    const { cardId } = await playedCard();
    const intrus = await signUp("Intrus");
    const res = await as(intrus).post(`/cards/${cardId}/report`).expect(403);
    expect(res.body.error.code).toBe("CARD_NOT_PLAYED");
  });

  it("refuse un second signalement du meme joueur", async () => {
    const { players, cardId } = await playedCard();
    await as(players[0]!).post(`/cards/${cardId}/report`).expect(201);
    const res = await as(players[0]!).post(`/cards/${cardId}/report`).expect(409);
    expect(res.body.error.code).toBe("ALREADY_REPORTED");
  });

  it("retire automatiquement une carte du tirage au troisieme signalement", async () => {
    const { players, cardId } = await playedCard();
    await as(players[0]!).post(`/cards/${cardId}/report`).expect(201);
    await as(players[1]!).post(`/cards/${cardId}/report`).expect(201);
    const res = await as(players[2]!).post(`/cards/${cardId}/report`).expect(201);
    expect(res.body.card.status).toBe("REJECTED");
  });
});

describe("cartes sans echeance — seul un depart debloque la manche", () => {
  it("attend indefiniment le joueur qui n'a pas ecrit", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    await writeAll([players[0]!, players[1]!], session.id);

    const view = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
    const statuses = await prisma.round.findMany({ where: { sessionId: session.id } });
    expect(statuses.some((r) => r.status === "BETTING")).toBe(false);
    expect(view.body.session.status).toBe("IN_PROGRESS");
  });

  it("annule la carte du joueur qui part sans ecrire, et laisse la manche avancer", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    await writeAll([players[0]!, players[1]!], session.id);
    const silent = (await as(players[2]!).get(`/sessions/${session.id}`)).body.session.currentRound;

    await as(players[2]!).post(`/sessions/${session.id}/quit`).expect(200);

    const cancelled = await as(players[0]!).get(`/rounds/${silent.id}`).expect(200);
    expect(cancelled.body.round.status).toBe("CANCELLED");
    expect(cancelled.body.round.cancelReason).toBe("PLAYER_LEFT");
    expect(cancelled.body.round.result).toBeNull();

    const view = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
    expect(view.body.session.currentRound.status).toBe("BETTING");
  });

  it("resout la carte quand le dernier parieur attendu s'en va", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"], {
      allowNoneOption: false,
    });
    await as(players[0]!).post(`/sessions/${session.id}/manches`).expect(201);
    await writeAll(players, session.id);

    const round = (await as(players[0]!).get(`/sessions/${session.id}`)).body.session.currentRound;
    const { bettors } = splitRoles(players, round.bluffeur.id);
    const [stays, leaves] = bettors as [TestPlayer, TestPlayer];
    await betOnTruth(stays, round.id);

    await as(leaves).post(`/sessions/${session.id}/quit`).expect(200);

    const done = await as(stays).get(`/rounds/${round.id}`).expect(200);
    expect(done.body.round.status).toBe("RESOLVED");
    const view = await as(stays).get(`/sessions/${session.id}`).expect(200);
    expect(view.body.session.currentRound.id).not.toBe(round.id);
    expect(view.body.session.currentRound.status).toBe("BETTING");
  });
});
