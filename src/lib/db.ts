// Shared Prisma client. Falls back through the various connection-string env var
// names that different Vercel Postgres/Prisma integrations expose, and reuses a
// single client instance in development to survive Next.js hot reloads.
import { PrismaClient } from "@prisma/client";

function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.Alps3Dp_DATABASE_URL ||
    process.env.Alps3Dp_PRISMA_DATABASE_URL ||
    process.env.Alps3Dp_POSTGRES_URL ||
    process.env.PRISMA_DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ""
  );
}

const resolvedDatabaseUrl = resolveDatabaseUrl();
if (!process.env.DATABASE_URL && resolvedDatabaseUrl) {
  process.env.DATABASE_URL = resolvedDatabaseUrl;
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Reuse the client across hot reloads in dev; Next.js would otherwise create a
// new PrismaClient (and new connection pool) on every file change.
export const db =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
