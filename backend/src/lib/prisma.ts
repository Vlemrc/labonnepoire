import { PrismaClient } from "@prisma/client";
import { isProd } from "../config/env.js";

export const prisma = new PrismaClient({
  log: isProd ? ["error"] : ["warn", "error"],
});

export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
