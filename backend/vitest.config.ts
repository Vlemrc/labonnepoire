import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@bluff/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Les tests e2e partagent une base : les faire tourner en serie evite
    // qu'un fichier nettoie la base pendant qu'un autre joue un round.
    fileParallelism: false,
    // La premiere connexion Prisma peut prendre plusieurs secondes a froid :
    // le defaut de 5 s faisait echouer par intermittence le premier test e2e.
    testTimeout: 15_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://steiner@localhost:5432/bluff_party_test?schema=public",
    },
  },
});
