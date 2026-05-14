import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* GET / PATCH the single-row settings record.
 *
 * Body shape for PATCH: any subset of { apiKey, modelChoice, advisorName, firmName }.
 * Plaintext API key storage is acceptable for this single-user local demo
 * per the approved orientation.
 */

export async function GET() {
  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  return NextResponse.json(setting);
}

type PatchBody = {
  apiKey?: string | null;
  modelChoice?: string;
  advisorName?: string;
  firmName?: string;
  tokenBudgetPerCase?: number;
};

export async function PATCH(request: Request) {
  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updated = await prisma.setting.upsert({
    where: { id: 1 },
    update: body,
    create: { id: 1, ...body },
  });
  return NextResponse.json(updated);
}
