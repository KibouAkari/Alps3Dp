import "dotenv/config";

import { defineConfig, env } from "prisma/config";

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
    "postgresql://postgres:postgres@127.0.0.1:5432/alps3dp"
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  seed: "tsx prisma/seed.ts",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Fallback URL keeps prisma generate from crashing during first deploy.
    // Production should still set a real DATABASE_URL in Vercel env.
    url: resolveDatabaseUrl(),
  },
});
