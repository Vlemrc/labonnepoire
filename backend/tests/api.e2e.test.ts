import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { app, as, resetDatabase, signUp, type TestPlayer } from "./helpers/api.js";
import request from "supertest";

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

describe("boucle de jeu complete", () => {
  it("joue un round de bout en bout et met les scores a jour", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"]);
    const roundRes = await as(players[0]!).post(`/sessions/${session.id}/rounds`).expect(201);
    const { bluffeur, bettors } = splitRoles(players, roundRes.body.round.bluffeur.id);
    const roundId = roundRes.body.round.id;

    // Le bluffeur voit la carte, avec la vraie reponse.
    const bluffeurView = await as(bluffeur).get(`/rounds/${roundId}`).expect(200);
    expect(bluffeurView.body.round.card).not.toBeNull();
    expect(bluffeurView.body.round.card.trueAnswer).toBeTruthy();
    expect(bluffeurView.body.round.myRole).toBe("BLUFFEUR");

    const isFullBluff = bluffeurView.body.round.mode === "FULL_BLUFF";
    const fakes = isFullBluff ? ["Faux A", "Faux B", "Faux C"] : ["Faux A", "Faux B"];
    await as(bluffeur).post(`/rounds/${roundId}/answers`).send({ answers: fakes }).expect(201);

    // Le parieur voit 3 reponses melangees, sans savoir laquelle est vraie.
    const bettor = bettors[0]!;
    const betView = await as(bettor).get(`/rounds/${roundId}`).expect(200);
    expect(betView.body.round.status).toBe("BETTING");
    expect(betView.body.round.answers).toHaveLength(3);
    expect(betView.body.round.answers[0]).not.toHaveProperty("isTrue");
    expect(betView.body.round.card).toBeNull();

    const answers = betView.body.round.answers as { id: string; text: string }[];
    const budget = betView.body.round.stakeBudget;
    await as(bettor)
      .post(`/rounds/${roundId}/bets`)
      .send({
        bets: [
          { answerId: answers[0]!.id, amount: budget - 3 },
          { answerId: answers[1]!.id, amount: 2 },
          { answerId: answers[2]!.id, amount: 1 },
        ],
      })
      .expect(201);

    // Un seul parieur : le round se resout automatiquement.
    const resolved = await as(bettor).get(`/rounds/${roundId}`).expect(200);
    expect(resolved.body.round.status).toBe("RESOLVED");
    expect(resolved.body.round.result.answers.filter((a: any) => a.isTrue)).toHaveLength(
      isFullBluff ? 0 : 1,
    );

    const deltas = resolved.body.round.result.deltas as { delta: number }[];
    expect(deltas.reduce((s, d) => s + d.delta, 0)).toBe(0);

    const after = await as(bettor).get(`/sessions/${session.id}`).expect(200);
    const total = after.body.session.players.reduce((s: number, p: any) => s + p.points, 0);
    expect(total).toBe(40); // 2 joueurs x 20 points : le jeu est a somme nulle
  });

  it("enchaine les rounds en alternant le bluffeur", async () => {
    // Capital large : ce test verifie la rotation, pas l'elimination. Avec le
    // capital par defaut, un parieur qui mise tout a l'aveugle tombe a zero
    // avant le troisieme round et sort de la rotation.
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"], {
      startingPoints: 100,
    });

    const seenBluffeurs: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await as(players[0]!).post(`/sessions/${session.id}/rounds`).expect(201);
      const roundId = res.body.round.id;
      const bluffeur = players.find((p) => p.id === res.body.round.bluffeur.id)!;
      // Les parieurs sont ceux que le serveur a designes : un joueur elimine
      // en cours de partie ne participe plus au round.
      const bettorIds: string[] = res.body.round.participants
        .filter((p: any) => p.role === "BETTOR")
        .map((p: any) => p.user.id);
      const bettors = players.filter((p) => bettorIds.includes(p.id));
      seenBluffeurs.push(bluffeur.id);

      const view = await as(bluffeur).get(`/rounds/${roundId}`);
      const fakes =
        view.body.round.mode === "FULL_BLUFF" ? ["A", "B", "C"] : ["A", "B"];
      await as(bluffeur).post(`/rounds/${roundId}/answers`).send({ answers: fakes }).expect(201);

      for (const bettor of bettors) {
        const bv = await as(bettor).get(`/rounds/${roundId}`);
        const budget = bv.body.round.participants.find((p: any) => p.user.id === bettor.id).budget;
        const first = bv.body.round.answers[0].id;
        await as(bettor)
          .post(`/rounds/${roundId}/bets`)
          .send({ bets: [{ answerId: first, amount: budget }] })
          .expect(201);
      }
    }
    expect(new Set(seenBluffeurs).size).toBe(3);
  });
});

describe("etancheite de l'API", () => {
  it("ne revele jamais la vraie reponse a un parieur avant la resolution", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    const res = await as(players[0]!).post(`/sessions/${session.id}/rounds`).expect(201);
    const roundId = res.body.round.id;
    const { bluffeur, bettors } = splitRoles(players, res.body.round.bluffeur.id);

    const view = await as(bluffeur).get(`/rounds/${roundId}`);
    const trueAnswer = view.body.round.card.trueAnswer;
    const fakes = view.body.round.mode === "FULL_BLUFF" ? ["A", "B", "C"] : ["A", "B"];
    await as(bluffeur).post(`/rounds/${roundId}/answers`).send({ answers: fakes }).expect(201);

    const bettorView = await as(bettors[0]!).get(`/rounds/${roundId}`).expect(200);
    const payload = JSON.stringify(bettorView.body);
    expect(payload).not.toContain('"isTrue"');
    expect(payload).not.toContain('"authorId"');
    expect(bettorView.body.round.card).toBeNull();
    expect(bettorView.body.round.result).toBeNull();
    // Le mode est masque : sinon FULL_BLUFF trahirait que « aucune » est gagnant.
    expect(bettorView.body.round.mode).toBe("STANDARD");
    if (fakes.length === 2) expect(payload).toContain(trueAnswer);

    // Les mises des autres restent invisibles tant que le round n'est pas resolu.
    const answers = bettorView.body.round.answers;
    const budget = bettorView.body.round.participants.find(
      (p: any) => p.user.id === bettors[0]!.id,
    ).budget;
    await as(bettors[0]!)
      .post(`/rounds/${roundId}/bets`)
      .send({ bets: [{ answerId: answers[0].id, amount: budget }] })
      .expect(201);

    const otherView = await as(bettors[1]!).get(`/rounds/${roundId}`).expect(200);
    expect(otherView.body.round.status).toBe("BETTING");
    expect(otherView.body.round.myBets).toBeNull();
    expect(JSON.stringify(otherView.body)).not.toContain('"bettor"');
  });

  it("refuse l'acces a un joueur exterieur au round", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"]);
    const res = await as(players[0]!).post(`/sessions/${session.id}/rounds`).expect(201);
    const intrus = await signUp("Intrus");
    await as(intrus).get(`/rounds/${res.body.round.id}`).expect(403);
    await as(intrus).get(`/sessions/${session.id}`).expect(403);
  });

  it("exige un token valide", async () => {
    await request(app).get("/groups").expect(401);
    await request(app).get("/groups").set("Authorization", "Bearer nawak").expect(401);
  });
});

describe("garde-fous de la boucle", () => {
  it("empeche un parieur d'ecrire les fausses reponses", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"]);
    const res = await as(players[0]!).post(`/sessions/${session.id}/rounds`).expect(201);
    const { bettors } = splitRoles(players, res.body.round.bluffeur.id);
    const r = await as(bettors[0]!)
      .post(`/rounds/${res.body.round.id}/answers`)
      .send({ answers: ["A", "B"] })
      .expect(403);
    expect(r.body.error.code).toBe("NOT_BLUFFEUR");
  });

  it("refuse une repartition de mises qui ne fait pas le budget", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"]);
    const res = await as(players[0]!).post(`/sessions/${session.id}/rounds`).expect(201);
    const roundId = res.body.round.id;
    const { bluffeur, bettors } = splitRoles(players, res.body.round.bluffeur.id);
    const view = await as(bluffeur).get(`/rounds/${roundId}`);
    const fakes = view.body.round.mode === "FULL_BLUFF" ? ["A", "B", "C"] : ["A", "B"];
    await as(bluffeur).post(`/rounds/${roundId}/answers`).send({ answers: fakes }).expect(201);

    const bv = await as(bettors[0]!).get(`/rounds/${roundId}`);
    const r = await as(bettors[0]!)
      .post(`/rounds/${roundId}/bets`)
      .send({ bets: [{ answerId: bv.body.round.answers[0].id, amount: 3 }] })
      .expect(400);
    expect(r.body.error.code).toBe("BUDGET_MISMATCH");
  });

  it("refuse de lancer un round tant que le precedent n'est pas resolu", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"]);
    await as(players[0]!).post(`/sessions/${session.id}/rounds`).expect(201);
    const r = await as(players[0]!).post(`/sessions/${session.id}/rounds`).expect(409);
    expect(r.body.error.code).toBe("ROUND_IN_PROGRESS");
  });

  it("n'autorise qu'une seule carte twist par joueur et par partie", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"]);
    const res = await as(players[0]!).post(`/sessions/${session.id}/rounds`).expect(201);
    const roundId = res.body.round.id;
    const twisted = await as(players[0]!)
      .post(`/rounds/${roundId}/twist`)
      .send({ code: "DOUBLE_STAKES" })
      .expect(200);
    expect(twisted.body.round.twist.code).toBe("DOUBLE_STAKES");

    const again = await as(players[0]!).post(`/rounds/${roundId}/twist`).expect(409);
    expect(again.body.error.code).toBe("TWIST_ALREADY_ACTIVE");
  });

  it("DOUBLE_STAKES double effectivement le budget distribue", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"], { stakeBudget: 5 });
    const res = await as(players[0]!).post(`/sessions/${session.id}/rounds`).expect(201);
    const roundId = res.body.round.id;
    const { bluffeur, bettors } = splitRoles(players, res.body.round.bluffeur.id);

    await as(bettors[0]!).post(`/rounds/${roundId}/twist`).send({ code: "DOUBLE_STAKES" }).expect(200);
    const view = await as(bluffeur).get(`/rounds/${roundId}`);
    const fakes = view.body.round.mode === "FULL_BLUFF" ? ["A", "B", "C"] : ["A", "B"];
    await as(bluffeur).post(`/rounds/${roundId}/answers`).send({ answers: fakes }).expect(201);

    const bv = await as(bettors[0]!).get(`/rounds/${roundId}`);
    const me = bv.body.round.participants.find((p: any) => p.user.id === bettors[0]!.id);
    expect(me.budget).toBe(10);
  });

  it("plafonne le budget de mise au capital restant du parieur", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"], { startingPoints: 6, stakeBudget: 10 });
    const res = await as(players[0]!).post(`/sessions/${session.id}/rounds`).expect(201);
    const roundId = res.body.round.id;
    const { bluffeur, bettors } = splitRoles(players, res.body.round.bluffeur.id);
    const view = await as(bluffeur).get(`/rounds/${roundId}`);
    const fakes = view.body.round.mode === "FULL_BLUFF" ? ["A", "B", "C"] : ["A", "B"];
    await as(bluffeur).post(`/rounds/${roundId}/answers`).send({ answers: fakes }).expect(201);

    const bv = await as(bettors[0]!).get(`/rounds/${roundId}`);
    const me = bv.body.round.participants.find((p: any) => p.user.id === bettors[0]!.id);
    expect(me.budget).toBe(6);
  });
});

describe("cas limites", () => {
  it("termine la partie et designe un vainqueur quand un joueur tombe a zero", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno"], {
      startingPoints: 10,
      stakeBudget: 10,
      allowNoneOption: false, // garantit un round STANDARD : la vraie reponse est presente
    });
    const res = await as(players[0]!).post(`/sessions/${session.id}/rounds`).expect(201);
    const roundId = res.body.round.id;
    const { bluffeur, bettors } = splitRoles(players, res.body.round.bluffeur.id);

    const view = await as(bluffeur).get(`/rounds/${roundId}`);
    expect(view.body.round.mode).toBe("STANDARD");
    const trueAnswer = view.body.round.card.trueAnswer;
    await as(bluffeur).post(`/rounds/${roundId}/answers`).send({ answers: ["A", "B"] }).expect(201);

    // Le parieur mise tout sur une reponse qu'on sait fausse : il tombe a zero.
    const bv = await as(bettors[0]!).get(`/rounds/${roundId}`);
    const wrong = bv.body.round.answers.find((a: any) => a.text !== trueAnswer);
    await as(bettors[0]!)
      .post(`/rounds/${roundId}/bets`)
      .send({ bets: [{ answerId: wrong.id, amount: 10 }] })
      .expect(201);

    const final = await as(bluffeur).get(`/sessions/${session.id}`).expect(200);
    expect(final.body.session.status).toBe("FINISHED");
    expect(final.body.session.winnerId).toBe(bluffeur.id);
    const loser = final.body.session.players.find((p: any) => p.userId === bettors[0]!.id);
    expect(loser.points).toBe(0);
    expect(loser.isEliminated).toBe(true);
  });

  it("elimine le joueur qui abandonne et poursuit la partie a trois", async () => {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    await as(players[2]!).post(`/sessions/${session.id}/quit`).expect(200);

    const view = await as(players[0]!).get(`/sessions/${session.id}`).expect(200);
    expect(view.body.session.status).toBe("IN_PROGRESS");
    const quitter = view.body.session.players.find((p: any) => p.userId === players[2]!.id);
    expect(quitter.isEliminated).toBe(true);

    // Le joueur parti n'est plus designe comme bluffeur ni comme parieur.
    const res = await as(players[0]!).post(`/sessions/${session.id}/rounds`).expect(201);
    const ids = res.body.round.participants.map((p: any) => p.user.id);
    expect(ids).not.toContain(players[2]!.id);
    expect(ids).toHaveLength(2);
  });

  it("termine la partie quand il ne reste qu'un joueur apres des abandons", async () => {
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

describe("gestion du paquet de cartes", () => {
  /** Ne laisse que `keep` cartes jouables, pour rendre les tirages deterministes. */
  async function shrinkDeck(theme: string, keep: number) {
    const kept = await prisma.card.findMany({ where: { theme }, take: keep, orderBy: { id: "asc" } });
    await prisma.card.updateMany({
      where: { id: { notIn: kept.map((c) => c.id) } },
      data: { status: "REJECTED" },
    });
    return kept;
  }

  it("ne sert jamais deux fois la meme carte au meme salon, meme d'une partie a l'autre", async () => {
    const kept = await shrinkDeck("animaux", 2);
    const players = [await signUp("Ana"), await signUp("Bruno")];
    const group = (
      await as(players[0]!).post("/groups").send({ name: "Salon", themes: ["animaux"] }).expect(201)
    ).body.group;
    await as(players[1]!).post("/groups/join").send({ code: group.code }).expect(200);

    const s1 = (await as(players[0]!).post(`/groups/${group.id}/sessions`).expect(201)).body.session;
    const r1 = await as(players[0]!).post(`/sessions/${s1.id}/rounds`).expect(201);
    const card1 = await prisma.round.findUniqueOrThrow({
      where: { id: r1.body.round.id },
      select: { cardId: true },
    });

    // Fin de la partie, puis nouvelle partie dans le MEME salon.
    await as(players[1]!).post(`/sessions/${s1.id}/quit`).expect(200);
    const s2 = (await as(players[0]!).post(`/groups/${group.id}/sessions`).expect(201)).body.session;
    const r2 = await as(players[0]!).post(`/sessions/${s2.id}/rounds`).expect(201);
    const card2 = await prisma.round.findUniqueOrThrow({
      where: { id: r2.body.round.id },
      select: { cardId: true },
    });

    expect(card2.cardId).not.toBe(card1.cardId);
    expect(kept.map((c) => c.id)).toContain(card2.cardId);
  });

  it("recycle le paquet plutot que de bloquer la partie quand il est epuise", async () => {
    await shrinkDeck("animaux", 1);
    const players = [await signUp("Ana"), await signUp("Bruno")];
    const group = (
      await as(players[0]!).post("/groups").send({ name: "Salon", themes: ["animaux"] }).expect(201)
    ).body.group;
    await as(players[1]!).post("/groups/join").send({ code: group.code }).expect(200);

    const s1 = (await as(players[0]!).post(`/groups/${group.id}/sessions`).expect(201)).body.session;
    await as(players[0]!).post(`/sessions/${s1.id}/rounds`).expect(201);
    await as(players[1]!).post(`/sessions/${s1.id}/quit`).expect(200);

    const s2 = (await as(players[0]!).post(`/groups/${group.id}/sessions`).expect(201)).body.session;
    await as(players[0]!).post(`/sessions/${s2.id}/rounds`).expect(201);
  });

  it("ne propose pas une thematique entierement retiree du tirage", async () => {
    await prisma.card.updateMany({ where: { theme: "animaux" }, data: { status: "REJECTED" } });
    const themes = (await request(app).get("/cards/themes").expect(200)).body.themes;
    expect(themes.map((t: any) => t.theme)).not.toContain("animaux");
  });
});

describe("signalement des cartes", () => {
  async function playedRound() {
    const { players, session } = await setupSession(["Ana", "Bruno", "Cleo"]);
    const res = await as(players[0]!).post(`/sessions/${session.id}/rounds`).expect(201);
    const card = await prisma.round.findUniqueOrThrow({
      where: { id: res.body.round.id },
      select: { cardId: true },
    });
    return { players, cardId: card.cardId };
  }

  it("accepte le signalement d'un joueur qui a vu la carte", async () => {
    const { players, cardId } = await playedRound();
    const res = await as(players[0]!)
      .post(`/cards/${cardId}/report`)
      .send({ reason: "La reponse est fausse" })
      .expect(201);
    expect(res.body.card.reportCount).toBe(1);
    expect(res.body.card.status).toBe("DRAFT");
  });

  it("refuse le signalement d'un joueur qui n'a pas joue la carte", async () => {
    const { cardId } = await playedRound();
    const intrus = await signUp("Intrus");
    const res = await as(intrus).post(`/cards/${cardId}/report`).expect(403);
    expect(res.body.error.code).toBe("CARD_NOT_PLAYED");
  });

  it("refuse un second signalement du meme joueur", async () => {
    const { players, cardId } = await playedRound();
    await as(players[0]!).post(`/cards/${cardId}/report`).expect(201);
    const res = await as(players[0]!).post(`/cards/${cardId}/report`).expect(409);
    expect(res.body.error.code).toBe("ALREADY_REPORTED");
  });

  it("retire automatiquement une carte du tirage au troisieme signalement", async () => {
    const { players, cardId } = await playedRound();
    await as(players[0]!).post(`/cards/${cardId}/report`).expect(201);
    await as(players[1]!).post(`/cards/${cardId}/report`).expect(201);
    const res = await as(players[2]!).post(`/cards/${cardId}/report`).expect(201);
    expect(res.body.card.status).toBe("REJECTED");

    const card = await prisma.card.findUniqueOrThrow({ where: { id: cardId } });
    expect(card.status).toBe("REJECTED");
  });
});
