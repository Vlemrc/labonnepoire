import { PrismaClient } from "@prisma/client";
import { SEED_CARDS } from "./cards.js";
import { listTwists } from "../../src/game/twists/registry.js";

const prisma = new PrismaClient();

async function main() {
  // Les cartes sont identifiees par leur question : re-seeder ne cree pas de doublon.
  let created = 0;
  for (const card of SEED_CARDS) {
    const existing = await prisma.card.findFirst({ where: { question: card.question } });
    if (existing) {
      await prisma.card.update({ where: { id: existing.id }, data: card });
    } else {
      await prisma.card.create({ data: card });
      created += 1;
    }
  }

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

  const themes = await prisma.card.groupBy({ by: ["theme"], _count: { _all: true } });
  console.log(`[seed] ${SEED_CARDS.length} cartes traitees (${created} nouvelles)`);
  for (const t of themes) console.log(`[seed]   ${t.theme}: ${t._count._all} cartes`);
  console.log(`[seed] ${listTwists().length} twists`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
