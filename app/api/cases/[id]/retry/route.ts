import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runDiagnosticPipeline } from "@/lib/agents/pipeline";

/* POST /api/cases/[id]/retry
 *
 * Simple retry per Slice 2 Q6 approval: reset the case to status=
 * "generating", clear errorMessage, kick off the pipeline from scratch.
 * No partial-step recovery, no exponential backoff. The full pipeline
 * re-runs; transient API errors typically clear on a second attempt.
 *
 * Smarter retry semantics (partial recovery, dependency-aware re-run)
 * are deferred to Slice 7 polish.
 */

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const c = await prisma.case.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: `Case not found: ${id}` }, { status: 404 });

  await prisma.case.update({
    where: { id },
    data: { status: "generating", errorMessage: null, headline: "Diagnostic in progress" },
  });

  void runDiagnosticPipeline({
    caseId: id,
    investorId: c.investorId,
    snapshotId: c.snapshotId,
  });

  return NextResponse.json({ id, status: "generating" });
}
