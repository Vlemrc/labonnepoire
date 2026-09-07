import { config as loadDotenv } from "dotenv";
import { z } from "zod";

// Charge backend/.env en local. En production (Railway), les variables sont
// injectees par la plateforme et ce fichier n'existe pas : dotenv est alors
// silencieux, il n'ecrase jamais une variable deja definie.
loadDotenv();

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().default("*"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Configuration invalide :\n${details}`);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
