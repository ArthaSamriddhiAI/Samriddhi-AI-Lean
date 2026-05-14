/* GET /api/cases/[id]/briefing.pdf
 *
 * Renders the case's BriefingContent as a PDF via @react-pdf/renderer
 * server-side and streams the binary back. The Export briefing button
 * in the Case Detail toolbar points here; the file downloads as
 * "briefing-<caseId>.pdf".
 *
 * Returns 404 for missing cases, 409 if the case is not status="ready".
 */

import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { BriefingPDF } from "@/components/pdf/BriefingPDF";
import type { BriefingContent } from "@/lib/agents/s1-diagnostic";
import { transformRupeesDeep } from "@/lib/format/rupees";

type Params = { params: Promise<{ id: string }> };

function formatGeneratedAt(iso: string | undefined, fallback: Date): string {
  const d = iso ? new Date(iso) : fallback;
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date}, ${time} IST`;
}

function formatSnapshot(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const c = await prisma.case.findUnique({
    where: { id },
    include: { investor: true, snapshot: true },
  });
  if (!c) return new Response(`Case not found: ${id}`, { status: 404 });
  if (c.status !== "ready") {
    return new Response(`Case is not ready (status=${c.status})`, { status: 409 });
  }

  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  const advisorName = settings?.advisorName ?? "Priya Nair";
  const firmName = settings?.firmName ?? "Anand Rathi Wealth · UHNI desk";

  let briefing: BriefingContent;
  let generatedAtIso: string | undefined;
  try {
    const parsed = JSON.parse(c.contentJson);
    briefing = transformRupeesDeep(parsed.briefing as BriefingContent);
    generatedAtIso = parsed.usage_summary?.generated_at as string | undefined;
  } catch {
    return new Response("Case content malformed", { status: 500 });
  }

  const pdfElement = BriefingPDF({
    briefing,
    investorName: c.investor.name,
    snapshotDate: formatSnapshot(c.snapshot.date),
    caseId: c.id,
    advisorName,
    firmName,
    generatedAt: formatGeneratedAt(generatedAtIso, c.frozenAt),
    stubbed: c.stubbed,
  });

  const buffer = await renderToBuffer(pdfElement);

  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="briefing-${c.id}.pdf"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
