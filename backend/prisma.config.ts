// Prisma 7: connection URLs live here — not in schema.prisma
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use DIRECT_URL for CLI (db push / migrate / pull) to bypass Supabase PgBouncer.
    // Falls back to DATABASE_URL if DIRECT_URL is unset.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
