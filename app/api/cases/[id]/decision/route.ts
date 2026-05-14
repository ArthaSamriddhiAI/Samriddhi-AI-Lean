import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { CaseDecision, DecisionAction } from "@/lib/format/case-decision";

/* PUT /api/cases/[id]/decision
 *
 * Body: { action: "approve" | "approve_with_conditions" | "reject" | "defer",
 *         rationale: string }
 *
 * Persists an advisor decision on the case record. MVP scope: no
 * downstream effect (no actioning, no notifications). The decision is
 * versionless — saving overwrites prior decisions; the audit trail is
 * the contentJson freeze and the rationale text.
 */

const ACTIONS: DecisionAction[] = ["approve", "approve_with_conditions", "reject", "defer"];

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  let body: { action?: string; rationale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.action || !ACTIONS.includes(body.action as DecisionAction)) {
    return NextResponse.json({ error: `action must be one of: ${ACTIONS.join(", ")}` }, { status: 400 });
  }
  if (typeof body.rationale !== "string") {
    return NextResponse.json({ error: "rationale must be a string" }, { status: 400 });
  }

  const decision: CaseDecision = {
    action: body.action as DecisionAction,
    rationale: body.rationale,
    capturedAt: new Date().toISOString(),
  };

  const updated = await prisma.case.update({
    where: { id },
    data: { decisionJson: JSON.stringify(decision) },
  });

  return NextResponse.json({ id: updated.id, decision }, { status: 200 });
}
