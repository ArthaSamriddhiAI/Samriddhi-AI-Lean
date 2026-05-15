/* Five-case Samriddhi 2 diagnostic batch.
 *
 * Generates diagnostic cases for the five remaining investors:
 * Malhotra, Iyengar, Menon, Surana, and Sharma (Samriddhi 2, distinct
 * from the existing Sharma S1 case at c-2026-05-14-sharma-01).
 *
 * Each case follows the same pipeline as the Shailesh Bhatt case
 * (scripts/gate-1-shailesh.ts) from Slice 2: M0 routes, deterministic
 * metrics compute, evidence agents run in parallel (restored by the
 * deferred workstream cleanup commit), S1 in diagnostic mode synthesises
 * the seven-section briefing using Sonnet (also restored in that commit).
 *
 * Cases run serially (one investor at a time) to keep DB writes clean
 * and errors surfaced per-investor. Evidence agents within each case
 * run in parallel via the restored Promise.all dispatch.
 *
 * After a successful pipeline run, the case is exported to
 * db/fixtures/cases/<caseId>.json in the same CaseFixture shape that
 * db/seed.ts loads on npm run db:seed. The export is inline here to
 * avoid a second script invocation.
 *
 * Fixed case IDs (date 2026-05-15, the run date) so the fixtures are
 * committed as stable references. The Sharma S2 case uses id suffix
 * "-s2-01" to distinguish it from the Sharma S1 case on 2026-05-14.
 *
 * Run via: npx tsx scripts/generate-s2-batch.ts
 * Prereq: npm run db:seed (investors, snapshots, settings row must exist)
 *
 * Estimated spend: $5-10 across five cases at Sonnet pricing for evidence
 * agents and S1 (both now on Sonnet via the LEAN_RUNTIME_OVERRIDES revert).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { runDiagnosticPipeline } from "../lib/agents/pipeline";

const ROOT = process.cwd();
const FIXTURE_DIR = path.join(ROOT, "db", "fixtures", "cases");
const SNAPSHOT_ID = "t0_q2_2026";

type BatchCase = {
  investorId: string;
  caseId: string;
  contextNote: string;
};

const BATCH: BatchCase[] = [
  {
    investorId: "malhotra",
    caseId: "c-2026-05-15-malhotra-01",
    contextNote: "Samriddhi 2 diagnostic for Dr. Vikram and Dr. Shruti Malhotra. Generated in deferred workstream cleanup (2026-05-15). Parallel evidence-agent dispatch; S1 on Sonnet 4.6.",
  },
  {
    investorId: "iyengar",
    caseId: "c-2026-05-15-iyengar-01",
    contextNote: "Samriddhi 2 diagnostic for Mrs. Lalitha Iyengar. Generated in deferred workstream cleanup (2026-05-15). Parallel evidence-agent dispatch; S1 on Sonnet 4.6.",
  },
  {
    investorId: "menon",
    caseId: "c-2026-05-15-menon-01",
    contextNote: "Samriddhi 2 diagnostic for Arjun Menon. Generated in deferred workstream cleanup (2026-05-15). Parallel evidence-agent dispatch; S1 on Sonnet 4.6.",
  },
  {
    investorId: "surana",
    caseId: "c-2026-05-15-surana-01",
    contextNote: "Samriddhi 2 diagnostic for Rajiv Surana. Generated in deferred workstream cleanup (2026-05-15). Parallel evidence-agent dispatch; S1 on Sonnet 4.6.",
  },
  {
    investorId: "sharma",
    caseId: "c-2026-05-15-sharma-s2-01",
    contextNote: "Samriddhi 2 diagnostic for Sharma family. Separate from the Sharma S1 (proposal evaluation) case at c-2026-05-14-sharma-01. Generated in deferred workstream cleanup (2026-05-15). Parallel evidence-agent dispatch; S1 on Sonnet 4.6.",
  },
];

type CaseRow = {
  id: string;
  investorId: string;
  snapshotId: string;
  workflow: string;
  severity: string;
  headline: string;
  status: string | null;
  frozenAt: Date;
  contentJson: string;
  tokenUsageJson: string | null;
  errorMessage: string | null;
  contextNote: string | null;
  stubbed: boolean | null;
};

async function exportFixture(c: CaseRow): Promise<void> {
  const content = c.contentJson ? JSON.parse(c.contentJson) : null;
  const tokenUsage = c.tokenUsageJson ? JSON.parse(c.tokenUsageJson) : null;

  const fixture = {
    id: c.id,
    investorId: c.investorId,
    snapshotId: c.snapshotId,
    workflow: c.workflow,
    severity: c.severity,
    headline: c.headline,
    status: c.status,
    frozenAt: c.frozenAt.toISOString(),
    content,
    tokenUsage,
    errorMessage: c.errorMessage,
    contextNote: c.contextNote,
  };

  await fs.mkdir(FIXTURE_DIR, { recursive: true });
  const outPath = path.join(FIXTURE_DIR, `${c.id}.json`);
  const json = JSON.stringify(fixture, null, 2);
  await fs.writeFile(outPath, json, "utf-8");
  console.log(`  exported fixture: db/fixtures/cases/${c.id}.json (${json.length} chars)`);
}

async function runBatchCase(entry: BatchCase, index: number, total: number): Promise<boolean> {
  const { investorId, caseId, contextNote } = entry;
  console.log(`\n[${ index + 1 }/${total}] Starting case for ${investorId} (${caseId})`);

  /* Upsert the case row so re-runs are idempotent: if the case already
   * exists and is ready, skip generation but still re-export the fixture. */
  const existing = await prisma.case.findUnique({ where: { id: caseId } });
  if (existing?.status === "ready") {
    console.log(`  ${caseId} already ready; re-exporting fixture.`);
    await exportFixture(existing as CaseRow);
    return true;
  }

  /* Create (or reset) the case row in generating state. */
  await prisma.case.upsert({
    where: { id: caseId },
    update: { status: "generating", errorMessage: null, contentJson: "{}", headline: "Diagnostic in progress", severity: "info" },
    create: {
      id: caseId,
      investorId,
      snapshotId: SNAPSHOT_ID,
      workflow: "s2",
      severity: "info",
      headline: "Diagnostic in progress",
      status: "generating",
      contentJson: "{}",
      contextNote,
    },
  });

  const t0 = Date.now();
  await runDiagnosticPipeline({ caseId, investorId, snapshotId: SNAPSHOT_ID });
  const elapsedMs = Date.now() - t0;

  const c = await prisma.case.findUnique({ where: { id: caseId } });
  if (!c) throw new Error(`Case row missing after pipeline run: ${caseId}`);

  if (c.status === "failed") {
    console.error(`  FAILED (${(elapsedMs / 1000).toFixed(1)}s): ${c.errorMessage}`);
    return false;
  }

  /* Patch contextNote onto the row (pipeline.ts does not write it). */
  await prisma.case.update({ where: { id: caseId }, data: { contextNote } });
  const patched = await prisma.case.findUnique({ where: { id: caseId } });
  if (!patched) throw new Error(`Case row missing after contextNote patch: ${caseId}`);

  const usage = patched.tokenUsageJson ? JSON.parse(patched.tokenUsageJson) as { total_input_tokens: number; total_output_tokens: number } : null;
  console.log(
    `  done in ${(elapsedMs / 1000).toFixed(1)}s | severity: ${patched.severity} | ` +
    `tokens: ${usage?.total_input_tokens ?? "?"} in / ${usage?.total_output_tokens ?? "?"} out`,
  );

  await exportFixture(patched as unknown as CaseRow);
  return true;
}

async function main() {
  console.log("Samriddhi 2 five-case batch generation");
  console.log("=======================================");
  console.log(`Snapshot: ${SNAPSHOT_ID} (t0 baseline)`);
  console.log(`Cases: ${BATCH.map((b) => b.investorId).join(", ")}`);
  console.log("");

  const results: { investorId: string; ok: boolean }[] = [];
  for (let i = 0; i < BATCH.length; i++) {
    const ok = await runBatchCase(BATCH[i], i, BATCH.length);
    results.push({ investorId: BATCH[i].investorId, ok });
    if (!ok) {
      console.error(`\nAborting batch: ${BATCH[i].investorId} case failed. Fix and re-run.`);
      break;
    }
  }

  console.log("\nBatch summary");
  console.log("-------------");
  for (const r of results) {
    console.log(`  ${r.investorId}: ${r.ok ? "ok" : "FAILED"}`);
  }
  const allOk = results.every((r) => r.ok) && results.length === BATCH.length;
  if (allOk) {
    console.log(`\nAll ${BATCH.length} cases generated. Run npm run db:reset to verify round-trip.`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("BATCH FAILED:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
