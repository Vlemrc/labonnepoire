import { randomBytes, createHash } from "node:crypto";
import { GROUP_CODE_LENGTH } from "@poire/shared";

// Alphabet sans I, O, 0, 1 : un code de salon se lit et se dicte a l'oral.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateGroupCode(length = GROUP_CODE_LENGTH): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

export function generateAuthToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Les tokens ne sont jamais stockes en clair. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function pickRandom<T>(items: readonly T[]): T {
  if (items.length === 0) throw new Error("pickRandom: liste vide");
  return items[Math.floor(Math.random() * items.length)]!;
}
