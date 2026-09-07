import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * Chargement du paquet de cartes.
 *
 * Le contenu vit dans data/cards.json et non dans ce fichier : a plusieurs
 * centaines de cartes, un fichier TypeScript devient illisible, impossible a
 * relire en diff et penible a editer pour quelqu'un qui n'ecrit pas de code.
 */
export const cardSchema = z.object({
  question: z.string().trim().min(10, "Question trop courte."),
  trueAnswer: z.string().trim().min(1, "Reponse vide."),
  theme: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Thematique : minuscules et tirets uniquement."),
  difficulty: z.number().int().min(1).max(3),
  status: z.enum(["DRAFT", "VERIFIED", "REJECTED"]).default("DRAFT"),
  source: z.string().trim().min(1).nullable().default(null),
});

export type SeedCard = z.infer<typeof cardSchema>;

const DATA_PATH = fileURLToPath(new URL("./data/cards.json", import.meta.url));

export function loadCards(path: string = DATA_PATH): SeedCard[] {
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  const parsed = z.array(cardSchema).safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  carte #${i.path[0]} -> ${i.path.slice(1).join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`cards.json invalide :\n${details}`);
  }

  // Une question en double signifie qu'on peut la tirer deux fois dans le meme
  // salon : autant l'attraper au chargement plutot qu'en pleine partie.
  const seen = new Map<string, number>();
  for (const [index, card] of parsed.data.entries()) {
    const key = card.question.toLowerCase();
    const previous = seen.get(key);
    if (previous !== undefined) {
      throw new Error(`cards.json : question dupliquee (#${previous} et #${index})`);
    }
    seen.set(key, index);
  }
  return parsed.data;
}

export const SEED_CARDS: SeedCard[] = loadCards();

export function themeBreakdown(cards: SeedCard[] = SEED_CARDS): Record<string, number> {
  return cards.reduce<Record<string, number>>((acc, card) => {
    acc[card.theme] = (acc[card.theme] ?? 0) + 1;
    return acc;
  }, {});
}
