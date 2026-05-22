import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

/* Singleton pattern so Next.js dev hot-reload does not spawn one client per
 * reload and exhaust SQLite's connection cap. In production a single instance
 * lives for the lifetime of the server process. */

/* Serverless-safe SQLite on Vercel. The serverless runtime filesystem is
 * read-only, so SQLite cannot open/journal the bundled prisma/dev.db there.
 * On a cold start we copy the bundled DB (included via next.config's
 * outputFileTracingIncludes) into the writable /tmp and point Prisma at it.
 * Gated to Vercel only — local dev keeps using DATABASE_URL from .env against
 * prisma/dev.db exactly as before, so `npm run dev` is unaffected. */
function resolveDatasourceUrl(): string | undefined {
  if (process.env.VERCEL !== "1") return undefined; // local/dev: use DATABASE_URL
  const tmpDb = "/tmp/dev.db";
  if (!fs.existsSync(tmpDb)) {
    const bundled = path.join(process.cwd(), "prisma", "dev.db");
    try {
      fs.copyFileSync(bundled, tmpDb);
    } catch (err) {
      console.error("[prisma] failed to copy bundled dev.db to /tmp:", err);
      throw err;
    }
  }
  return `file:${tmpDb}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const datasourceUrl = resolveDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
