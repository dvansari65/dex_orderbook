import dotenv from "dotenv";
import fs from "fs";
import path from "path";

let loaded = false;

const candidateEnvPaths = () => [
  process.env.INDEXER_ENV_PATH,
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "indexer/.env"),
  path.resolve(__dirname, "../.env"),
].filter((value): value is string => Boolean(value));

export const loadIndexerEnv = () => {
  if (loaded) return;

  const envPath = candidateEnvPaths().find((candidate) => fs.existsSync(candidate));
  dotenv.config(envPath ? { path: envPath } : undefined);
  loaded = true;
};

export const resolveDatabaseUrl = (): string => {
  loadIndexerEnv();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const parsed = new URL(databaseUrl);

  // Prisma/pg may prefer IPv6 for localhost. Force IPv4 for local dev.
  if (parsed.hostname === "localhost") {
    parsed.hostname = "127.0.0.1";
  }

  return parsed.toString();
};

export const isDatabaseConnectivityError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;

  const prismaError = error as { code?: string };
  return prismaError.code === "P1000" || prismaError.code === "P1001";
};
