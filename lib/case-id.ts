import { prisma } from "./prisma";

/* Generate a case ID in the wireframe's format: c-YYYY-MM-DD-{investorSlug}-{NN}.
 * NN is the per-investor-per-day sequence number, two-digit zero-padded. */
export async function generateCaseId(investorSlug: string, today: Date = new Date()): Promise<string> {
  const dateStr = today.toISOString().slice(0, 10);
  const prefix = `c-${dateStr}-${investorSlug}-`;
  const existingCount = await prisma.case.count({
    where: { id: { startsWith: prefix } },
  });
  const seq = String(existingCount + 1).padStart(2, "0");
  return `${prefix}${seq}`;
}
