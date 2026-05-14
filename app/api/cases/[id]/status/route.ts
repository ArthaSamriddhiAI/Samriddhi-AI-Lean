import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* GET /api/cases/[id]/status
 *
 * Polled by the generating screen while a case is mid-pipeline. Returns:
 *   { status: "generating" | "ready" | "failed" | null,
 *     errorMessage: string | null,
 *     headline: string }
 *
 * Cheap enough to poll every 1.5 s without strain on the dev DB.
 */

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const c = await prisma.case.findUnique({
    where: { id },
    select: { status: true, errorMessage: true, headline: true },
  });
  if (!c) return NextResponse.json({ error: `Case not found: ${id}` }, { status: 404 });
  return NextResponse.json({
    status: c.status,
    errorMessage: c.errorMessage ?? null,
    headline: c.headline,
  });
}
