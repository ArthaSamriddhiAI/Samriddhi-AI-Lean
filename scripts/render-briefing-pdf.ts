/* Render a case's briefing PDF to disk via @react-pdf/renderer.
 *
 * Usage: npx tsx scripts/render-briefing-pdf.ts <caseId> [outputPath]
 *
 * Mirrors what GET /api/cases/[id]/briefing.pdf does, but writes to a
 * file so the PDF can be opened by a reviewer or committed as a gate
 * artifact. Zero API cost; the case content is already in the database.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "../lib/prisma";
import { BriefingPDF } from "../components/pdf/BriefingPDF";
import type { BriefingContent } from "../lib/agents/s1-diagnostic";

function formatGeneratedAt(iso: string | undefined, fallback: Date): string {
  const d = iso ? new Date(iso) : fallback;
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date}, ${time} IST`;
}

function formatSnapshot(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

async function main() {
  const caseId = process.argv[2];
  if (!caseId) {
    console.error("usage: render-briefing-pdf.ts <caseId> [outputPath]");
    process.exit(1);
  }
  const outputPath = process.argv[3] ?? path.resolve(process.cwd(), `briefing-${caseId}.pdf`);

  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: { investor: true, snapshot: true },
  });
  if (!c) throw new Error(`Case not found: ${caseId}`);
  if (c.status !== "ready") throw new Error(`Case is not ready (status=${c.status})`);

  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  const advisorName = settings?.advisorName ?? "Priya Nair";
  const firmName = settings?.firmName ?? "Anand Rathi Wealth · UHNI desk";

  const parsed = JSON.parse(c.contentJson);
  const briefing = parsed.briefing as BriefingContent;
  const generatedAtIso = parsed.usage_summary?.generated_at as string | undefined;

  const pdfElement = BriefingPDF({
    briefing,
    investorName: c.investor.name,
    snapshotDate: formatSnapshot(c.snapshot.date),
    caseId: c.id,
    advisorName,
    firmName,
    generatedAt: formatGeneratedAt(generatedAtIso, c.frozenAt),
  });

  console.log(`[render-pdf] rendering ${caseId} -> ${outputPath}`);
  const t0 = Date.now();
  const buffer = await renderToBuffer(pdfElement);
  const dt = Date.now() - t0;
  await fs.writeFile(outputPath, buffer);
  console.log(`[render-pdf] done in ${dt} ms, ${(buffer.length / 1024).toFixed(1)} KB`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[render-pdf] error:", err);
  process.exit(1);
});
