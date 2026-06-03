import "dotenv/config";

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Fallback URL keeps prisma generate from crashing during first deploy.
    // Production should still set a real DATABASE_URL in Vercel env.
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/alps3dp",
  },
});
