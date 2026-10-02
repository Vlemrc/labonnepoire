import type { RoundMode, RoundModifiers } from "./types.js";

export interface ScoringAnswer {
  id: string;
  isTrue: boolean;
  /** null pour la vraie reponse : elle vient de la carte, pas d'un joueur. */
  authorId: string | null;
}

export interface ScoringBet {
  bettorId: string;
  answerId: string | null;
  isNoneOption: boolean;
  amount: number;
}

export interface ScoringPlayer {
  userId: string;
  points: number;
}

export interface ScoringInput {
  bluffeurId: string;
  mode: RoundMode;
  answers: ScoringAnswer[];
  bets: ScoringBet[];
  /** Etat AVANT resolution, bluffeur inclus. */
  players: ScoringPlayer[];
  /** Budget de mise effectif de chaque parieur, pour detecter les mises « tout sur la vraie ». */
  budgets: Record<string, number>;
  modifiers: RoundModifiers;
}

export interface ScoringOutcome {
  deltas: Record<string, number>;
  pointsAfter: Record<string, number>;
  eliminated: string[];
}

/**
 * Resolution d'un round.
 *
 * Invariant central : aucun point n'est cree. Ce qu'un menteur encaisse est
 * divise par le nombre de parieurs de la carte, le reste sort du jeu : la
 * masse totale ne fait que baisser, ce qui garantit qu'une partie se termine.
 *
 * - Mise sur la vraie reponse  -> le parieur la recupere, personne ne bouge.
 * - Mise sur une fausse        -> le parieur la perd ; son auteur en touche 1/N.
 * - Mise « aucune » correcte   -> le bluffeur verse la prime au parieur.
 * - Mise « aucune » incorrecte -> le parieur la perd ; le bluffeur en touche 1/N.
 *
 * N est le nombre de parieurs engages sur la carte.
 *
 * Fonction pure : aucun acces base, aucune date. Tout ce qui la concerne est
 * dans les arguments, ce qui la rend entierement testable.
 */
export function resolveRound(input: ScoringInput): ScoringOutcome {
  const { bluffeurId, answers, bets, players, budgets, modifiers } = input;

  const deltas: Record<string, number> = {};
  for (const p of players) deltas[p.userId] = 0;
  const pointsBefore = new Map(players.map((p) => [p.userId, p.points]));

  const ensureKnown = (userId: string) => {
    if (!(userId in deltas)) {
      throw new Error(`resolveRound: joueur inconnu dans cette partie (${userId})`);
    }
  };
  ensureKnown(bluffeurId);

  const answerById = new Map(answers.map((a) => [a.id, a]));
  const trueAnswer = answers.find((a) => a.isTrue) ?? null;
  /** En mode FULL_BLUFF aucune des reponses proposees n'est vraie. */
  const noneOptionIsCorrect = trueAnswer === null;

  const mult = modifiers.transferMultiplier;

  // Ce que chaque menteur a pris aux parieurs, avant division : il ne touche
  // que sa part, 1/N, une fois toutes les pertes comptees.
  const taken: Record<string, number> = {};
  const credit = (userId: string, amount: number) => {
    taken[userId] = (taken[userId] ?? 0) + amount;
  };
  const voters = new Set(bets.filter((b) => b.amount > 0).map((b) => b.bettorId)).size;

  // --- Phase 1 : les transferts sortants des parieurs. ---------------------
  // La mise est bornee par le capital, mais un multiplicateur de transfert
  // (twist « Double ou rien ») peut la depasser : on plafonne donc chaque
  // sortie a ce qu'il reste reellement, sinon un joueur finirait avec un
  // capital negatif.
  const takeFrom = (userId: string, wanted: number): number => {
    const available = Math.max(0, (pointsBefore.get(userId) ?? 0) + deltas[userId]!);
    return Math.min(wanted, available);
  };

  for (const bet of bets) {
    ensureKnown(bet.bettorId);
    if (bet.amount <= 0) continue;

    if (bet.isNoneOption) {
      if (noneOptionIsCorrect) continue; // traite en phase 2 (le bluffeur paie)
      const loss = takeFrom(bet.bettorId, Math.round(bet.amount * mult));
      deltas[bet.bettorId]! -= loss;
      credit(bluffeurId, loss);
      continue;
    }

    const answer = bet.answerId ? answerById.get(bet.answerId) : undefined;
    if (!answer) {
      throw new Error(`resolveRound: mise sur une reponse inconnue (${bet.answerId})`);
    }
    if (answer.isTrue) continue; // le parieur recupere simplement sa mise

    const beneficiary = answer.authorId ?? bluffeurId;
    ensureKnown(beneficiary);
    const loss = takeFrom(bet.bettorId, Math.round(bet.amount * mult));
    deltas[bet.bettorId]! -= loss;
    credit(beneficiary, loss);
  }

  for (const [userId, amount] of Object.entries(taken)) {
    deltas[userId]! += Math.floor(amount / Math.max(1, voters));
  }

  // --- Phase 2 : les obligations du bluffeur. ------------------------------
  // Elles viennent apres, pour que le bluffeur puisse payer avec ce qu'il vient
  // d'encaisser. Si son capital ne suffit pas, elles sont reduites au prorata
  // plutot que servies dans l'ordre d'arrivee (sinon le resultat dependrait de
  // l'ordre d'insertion des mises en base).
  const obligations: { to: string; amount: number }[] = [];

  if (noneOptionIsCorrect) {
    for (const bet of bets) {
      if (!bet.isNoneOption || bet.amount <= 0) continue;
      const gain = Math.round(bet.amount * modifiers.noneBonusMultiplier * mult);
      if (gain > 0) obligations.push({ to: bet.bettorId, amount: gain });
    }
  }

  if (modifiers.bluffeurAnte > 0 && trueAnswer) {
    const stakedOnTrue = new Map<string, number>();
    const stakedTotal = new Map<string, number>();
    for (const bet of bets) {
      stakedTotal.set(bet.bettorId, (stakedTotal.get(bet.bettorId) ?? 0) + bet.amount);
      if (bet.answerId === trueAnswer.id) {
        stakedOnTrue.set(bet.bettorId, (stakedOnTrue.get(bet.bettorId) ?? 0) + bet.amount);
      }
    }
    for (const [bettorId, onTrue] of [...stakedOnTrue].sort((a, b) => a[0].localeCompare(b[0]))) {
      const budget = budgets[bettorId] ?? 0;
      const total = stakedTotal.get(bettorId) ?? 0;
      // « Tout mise sur la vraie » : il a engage tout son budget, et uniquement la.
      if (budget > 0 && onTrue === budget && total === budget) {
        obligations.push({ to: bettorId, amount: modifiers.bluffeurAnte });
      }
    }
  }

  if (obligations.length > 0) {
    const available = Math.max(0, (pointsBefore.get(bluffeurId) ?? 0) + deltas[bluffeurId]!);
    const requested = obligations.reduce((s, o) => s + o.amount, 0);
    const paid = payProRata(obligations, Math.min(requested, available));
    for (const [userId, amount] of paid) {
      if (amount <= 0) continue;
      ensureKnown(userId);
      deltas[userId]! += amount;
      deltas[bluffeurId]! -= amount;
    }
  }

  // --- Etat final ----------------------------------------------------------
  const pointsAfter: Record<string, number> = {};
  const eliminated: string[] = [];
  for (const p of players) {
    const after = p.points + deltas[p.userId]!;
    pointsAfter[p.userId] = after;
    if (after <= 0) eliminated.push(p.userId);
  }

  assertNoPointCreated(deltas);
  return { deltas, pointsAfter, eliminated };
}

/**
 * Repartit `budget` entre des obligations au prorata, en entiers.
 * Le reliquat des arrondis va aux plus grosses obligations (puis ordre stable),
 * pour que la somme distribuee soit exactement `budget`.
 */
function payProRata(
  obligations: { to: string; amount: number }[],
  budget: number,
): Map<string, number> {
  const result = new Map<string, number>();
  const requested = obligations.reduce((s, o) => s + o.amount, 0);
  if (requested <= 0 || budget <= 0) return result;

  if (budget >= requested) {
    for (const o of obligations) result.set(o.to, (result.get(o.to) ?? 0) + o.amount);
    return result;
  }

  const shares = obligations.map((o) => {
    const exact = (o.amount * budget) / requested;
    const floor = Math.floor(exact);
    return { to: o.to, floor, remainder: exact - floor, amount: o.amount };
  });
  let distributed = shares.reduce((s, x) => s + x.floor, 0);
  const order = [...shares].sort(
    (a, b) => b.remainder - a.remainder || b.amount - a.amount || a.to.localeCompare(b.to),
  );
  let i = 0;
  while (distributed < budget && order.length > 0) {
    order[i % order.length]!.floor += 1;
    distributed += 1;
    i += 1;
  }
  for (const s of shares) result.set(s.to, (result.get(s.to) ?? 0) + s.floor);
  return result;
}

function assertNoPointCreated(deltas: Record<string, number>): void {
  const sum = Object.values(deltas).reduce((s, d) => s + d, 0);
  if (sum > 0) {
    throw new Error(`resolveRound: des points ont ete crees (total = ${sum})`);
  }
}
