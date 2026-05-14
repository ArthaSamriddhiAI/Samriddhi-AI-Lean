import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCaseId } from "@/lib/case-id";
import { runDiagnosticPipeline } from "@/lib/agents/pipeline";
import { runProposedActionPipeline } from "@/lib/agents/pipeline-case";
import type { Proposal } from "@/lib/agents/proposal";

/* POST /api/cases
 *
 * Body for Samriddhi 2 (diagnostic):
 *   { workflow?: "s2", investorId, snapshotId, contextNote? }
 *
 * Body for Samriddhi 1 (proposed_action):
 *   { workflow: "s1", investorId, snapshotId, proposal }
 *   where proposal = { action_type, target_category, target_instrument,
 *                      ticket_size_cr, source_of_funds, timeline, rationale }
 *
 * Creates a case row in status="generating" and fires the appropriate
 * pipeline as a background promise (fire-and-forget on the Node process,
 * appropriate for the local single-user demo). Returns the case ID
 * immediately; the client polls /api/cases/[id]/status until status
 * flips to "ready" or "failed".
 */

type Body = {
  workflow?: "s1" | "s2";
  investorId?: string;
  snapshotId?: string;
  contextNote?: string;
  proposal?: Partial<Proposal>;
};

function validateProposal(p: Partial<Proposal> | undefined): { ok: true; value: Proposal } | { ok: false; error: string } {
  if (!p) return { ok: false, error: "proposal is required for workflow=s1" };
  if (!p.action_type) return { ok: false, error: "proposal.action_type is required" };
  if (!p.target_category) return { ok: false, error: "proposal.target_category is required" };
  if (!p.target_instrument || !p.target_instrument.trim()) return { ok: false, error: "proposal.target_instrument is required" };
  if (typeof p.ticket_size_cr !== "number" || p.ticket_size_cr <= 0) return { ok: false, error: "proposal.ticket_size_cr must be a positive number" };
  if (!p.source_of_funds) return { ok: false, error: "proposal.source_of_funds is required" };
  if (!p.timeline) return { ok: false, error: "proposal.timeline is required" };
  return {
    ok: true,
    value: {
      action_type: p.action_type,
      target_category: p.target_category,
      target_instrument: p.target_instrument.trim(),
      ticket_size_cr: p.ticket_size_cr,
      source_of_funds: p.source_of_funds,
      timeline: p.timeline,
      rationale: p.rationale ?? null,
    },
  };
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workflow = body.workflow ?? "s2";
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

  if (workflow === "s1") {
    const validation = validateProposal(body.proposal);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const proposal = validation.value;

    const created = await prisma.case.create({
      data: {
        id,
        investorId,
        snapshotId,
        workflow: "s1",
        severity: "info",
        headline: "Proposal evaluation in progress",
        status: "generating",
        contentJson: JSON.stringify({ proposal }),
        contextNote: proposal.rationale ?? null,
      },
    });

    /* Fire the proposed_action pipeline as a background promise. */
    void runProposedActionPipeline({
      caseId: created.id,
      investorId,
      snapshotId,
      proposal,
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  }

  /* Samriddhi 2 diagnostic (default). */
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

  void runDiagnosticPipeline({
    caseId: created.id,
    investorId,
    snapshotId,
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
