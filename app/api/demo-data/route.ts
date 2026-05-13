import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { seedDatabase, clearDemoData } from "@/db/seed";

/* POST = reload demo data (re-runs the seed; idempotent via upsert).
 * DELETE = clear cases, investors, and snapshots. Settings row preserved. */

export async function POST() {
  const result = await seedDatabase();
  revalidatePath("/cases");
  revalidatePath("/investors");
  revalidatePath("/settings");
  return NextResponse.json(result);
}

export async function DELETE() {
  const result = await clearDemoData();
  revalidatePath("/cases");
  revalidatePath("/investors");
  revalidatePath("/settings");
  return NextResponse.json(result);
}
