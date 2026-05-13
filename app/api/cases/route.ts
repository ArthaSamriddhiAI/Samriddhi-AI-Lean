import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NEW_CASE_FIXTURE } from "@/lib/fixtures/new-case";
import { generateCaseId } from "@/lib/case-id";

/* POST /api/cases
 *
 * Body: { investorId: string, snapshotId: string, contextNote?: string }
 *
 * Creates a case row with the fixture content (Shailesh Bhatt diagnostic
 * stand-in per the orientation Q5 option a). Returns the created case ID.
 * Real LLM reasoning replaces the fixture in slice 2.
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
      workflow: NEW_CASE_FIXTURE.workflow,
      severity: NEW_CASE_FIXTURE.severity,
      headline: NEW_CASE_FIXTURE.headline,
      status: NEW_CASE_FIXTURE.status,
      contentJson: JSON.stringify({ fixture: NEW_CASE_FIXTURE.contentTag }),
      contextNote: contextNote ?? null,
    },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
