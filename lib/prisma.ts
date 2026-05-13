import { PrismaClient } from "@prisma/client";

/* Singleton pattern so Next.js dev hot-reload does not spawn one client per
 * reload and exhaust SQLite's connection cap. In production a single instance
 * lives for the lifetime of the server process. */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
