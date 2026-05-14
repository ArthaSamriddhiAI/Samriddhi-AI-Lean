import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCaseId } from "@/lib/case-id";
import { runDiagnosticPipeline } from "@/lib/agents/pipeline";

/* POST /api/cases
 *
 * Body: { investorId: string, snapshotId: string, contextNote?: string }
 *
 * Creates a case row in status="generating" and fires the diagnostic
 * pipeline as a background promise (fire-and-forget on the Node process,
 * appropriate for the local single-user demo). Returns immediately with
 * the case ID; the client polls /api/cases/[id]/status until status
 * flips to "ready" or "failed".
 */

type Body = {
  investorId?: string;
  snapshotId?: string;
  contextNote?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { investorId, snapshotId, contextNote } = body;
  if (!investorId || !snapshotId) {
    return NextResponse.json(
      { error: "investorId and snapshotId are required" },
      { status: 400 }
    );
  }

  const [investor, snapshot] = await Promise.all([
    prisma.investor.findUnique({ where: { id: investorId } }),
    prisma.snapshot.findUnique({ where: { id: snapshotId } }),
  ]);

  if (!investor) {
    return NextResponse.json({ error: `Investor not found: ${investorId}` }, { status: 404 });
  }
  if (!snapshot) {
    return NextResponse.json({ error: `Snapshot not found: ${snapshotId}` }, { status: 404 });
  }

  const id = await generateCaseId(investor.id);

  const created = await prisma.case.create({
    data: {
      id,
      investorId,
      snapshotId,
      workflow: "s2",
      severity: "info",
      headline: "Diagnostic in progress",
      status: "generating",
      contentJson: "{}",
      contextNote: contextNote ?? null,
    },
  });

  /* Fire the pipeline as a background promise. Acceptable for the
   * single-user local demo; a production deployment would queue this. */
  void runDiagnosticPipeline({
    caseId: created.id,
    investorId,
    snapshotId,
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
