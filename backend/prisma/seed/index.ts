import { PrismaClient } from "@prisma/client";
import { SEED_CARDS, themeBreakdown } from "./cards.js";
import { listTwists } from "../../src/game/twists/registry.js";

const prisma = new PrismaClient();

async function main() {
  // Les cartes sont identifiees par leur question : re-seeder met a jour le
  // contenu existant au lieu de creer des doublons, et ne touche jamais au
  // statut d'une carte deja relue ni a son compteur de signalements.
  let created = 0;
  let updated = 0;
  for (const card of SEED_CARDS) {
    const existing = await prisma.card.findFirst({ where: { question: card.question } });
    if (existing) {
      await prisma.card.update({
        where: { id: existing.id },
        data: {
          trueAnswer: card.trueAnswer,
          theme: card.theme,
          difficulty: card.difficulty,
          ...(card.source ? { source: card.source } : {}),
        },
      });
      updated += 1;
    } else {
      await prisma.card.create({ data: card });
      created += 1;
    }
  }

  // Les cartes qui ne sont plus dans le fichier sortent du tirage, mais ne sont
  // jamais supprimees : des rounds joues y font reference et l'ecran de
  // resultats doit rester consultable.
  const retired = await prisma.card.updateMany({
    where: { question: { notIn: SEED_CARDS.map((c) => c.question) }, status: { not: "REJECTED" } },
    data: { status: "REJECTED" },
  });

  for (const twist of listTwists()) {
    await prisma.twist.upsert({
      where: { code: twist.code },
      update: { label: twist.label, description: twist.description, isActive: true },
      create: {
        code: twist.code,
        label: twist.label,
        description: twist.description,
        isActive: true,
      },
    });
  }

  const byStatus = await prisma.card.groupBy({ by: ["status"], _count: { _all: true } });
  console.log(
    `[seed] ${SEED_CARDS.length} cartes (${created} creees, ${updated} mises a jour, ${retired.count} retirees du tirage)`,
  );
  for (const [theme, count] of Object.entries(themeBreakdown()).sort()) {
    console.log(`[seed]   ${theme.padEnd(20)} ${count}`);
  }
  for (const s of byStatus) console.log(`[seed]   statut ${s.status}: ${s._count._all}`);
  console.log(`[seed] ${listTwists().length} twists`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
