/* Authorized WA12 re-fire of the five committed t0 s2 diagnostic cases against
 * real t0 (data-repo v2.0.0), confirmed scope A: bhatt, iyengar, malhotra, menon,
 * surana (Sharma excluded; its s2 was archived).
 *
 * Runs runDiagnosticPipeline per case (forcing regeneration), exports each fixture,
 * and computes the real cost from the PER-AGENT token usage recorded by the
 * executed run (HARD BOUNDARY: every number comes from executed code, never from
 * generation). Current tiering KEPT: e1-e5/e7 Sonnet 4.6, e6/s1/a3 Opus 4.8, a2
 * Haiku 4.5. Stops if the cumulative cost trends materially above the ~$4.2-4.5
 * estimate, or on any case failure.
 *
 * Run: npx tsx scripts/refire-real-t0.ts
 * Prereq: DB seeded; settings.apiKey present; STUB_MODE=false; real t0 in the load path.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { runDiagnosticPipeline } from "../lib/agents/pipeline";
import { loadSnapshot } from "../lib/agents/snapshot-loader";

const FIXTURE_DIR = path.join(process.cwd(), "db", "fixtures", "cases");
const SNAPSHOT_ID = "t0_q2_2026";
const COST_CAP_USD = 6.0; // stop-and-surface guard (materially above the ~$4.2-4.5 estimate)

const CASES = [
  { caseId: "c-2026-05-14-bhatt-01", investorId: "bhatt" },
  { caseId: "c-2026-05-15-iyengar-01", investorId: "iyengar" },
  { caseId: "c-2026-05-15-malhotra-01", investorId: "malhotra" },
  { caseId: "c-2026-05-15-menon-01", investorId: "menon" },
  { caseId: "c-2026-05-15-surana-01", investorId: "surana" },
];

// Per-agent model rates [$/M input, $/M output], matching skill-loader LEAN_RUNTIME_OVERRIDES.
const SONNET: [number, number] = [3, 15];
const OPUS: [number, number] = [5, 25];
const HAIKU: [number, number] = [1, 5];
const AGENT_RATE: Record<string, [number, number]> = {
  e1: SONNET, e2: SONNET, e3: SONNET, e4: SONNET, e5: SONNET, e7: SONNET,
  e6: OPUS, s1: OPUS, a3: OPUS, a2: HAIKU,
};

type AgentUsage = { inputTokens: number; outputTokens: number };

function costOf(perAgent: Record<string, AgentUsage>): { usd: number; lines: string[] } {
  let usd = 0;
  const lines: string[] = [];
  for (const [agent, u] of Object.entries(perAgent)) {
    const rate = AGENT_RATE[agent] ?? SONNET;
    const c = (u.inputTokens / 1e6) * rate[0] + (u.outputTokens / 1e6) * rate[1];
    usd += c;
    lines.push(`      ${agent.padEnd(3)} ${String(u.inputTokens).padStart(7)} in / ${String(u.outputTokens).padStart(6)} out  $${c.toFixed(3)}`);
  }
  return { usd, lines };
}

async function exportFixture(c: any): Promise<void> {
  const fixture = {
    id: c.id, investorId: c.investorId, snapshotId: c.snapshotId, workflow: c.workflow,
    severity: c.severity, headline: c.headline, status: c.status,
    frozenAt: c.frozenAt.toISOString(),
    content: c.contentJson ? JSON.parse(c.contentJson) : null,
    tokenUsage: c.tokenUsageJson ? JSON.parse(c.tokenUsageJson) : null,
    errorMessage: c.errorMessage, contextNote: c.contextNote,
  };
  await fs.mkdir(FIXTURE_DIR, { recursive: true });
  await fs.writeFile(path.join(FIXTURE_DIR, `${c.id}.json`), JSON.stringify(fixture, null, 2), "utf-8");
}

async function main() {
  // Safety: refuse to spend unless the load path resolves to REAL t0.
  const snap: any = await loadSnapshot(SNAPSHOT_ID);
  const realMarker = snap?.snapshot_metadata?.real_data_build?.version;
  if (!realMarker) {
    console.error("ABORT: snapshot does not carry real_data_build; the load path is not real t0. Not spending.");
    process.exit(1);
  }
  console.log(`Re-fire: ${CASES.length} cases against ${SNAPSHOT_ID} (real t0, build=${realMarker}). Cost cap $${COST_CAP_USD}.\n`);

  let totalUsd = 0, totalIn = 0, totalOut = 0;
  for (let i = 0; i < CASES.length; i++) {
    const { caseId, investorId } = CASES[i];
    console.log(`[${i + 1}/${CASES.length}] ${investorId} (${caseId}) ...`);
    // Force regeneration: reset the row to generating (override the skip-if-ready path).
    await prisma.case.upsert({
      where: { id: caseId },
      update: { status: "generating", errorMessage: null, contentJson: "{}", headline: "Re-fire in progress", severity: "info" },
      create: { id: caseId, investorId, snapshotId: SNAPSHOT_ID, workflow: "s2", severity: "info", headline: "Re-fire in progress", status: "generating", contentJson: "{}" },
    });

    const t0 = Date.now();
    await runDiagnosticPipeline({ caseId, investorId, snapshotId: SNAPSHOT_ID });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    const c = await prisma.case.findUnique({ where: { id: caseId } });
    if (!c) throw new Error(`Case row missing after run: ${caseId}`);
    if (c.status === "failed") {
      console.error(`  FAILED (${elapsed}s): ${c.errorMessage}`);
      console.error("STOPPING on failure (not continuing the spend).");
      await prisma.$disconnect();
      process.exit(1);
    }

    const usage = c.tokenUsageJson ? JSON.parse(c.tokenUsageJson) : null;
    const { usd, lines } = costOf(usage?.per_agent ?? {});
    totalUsd += usd;
    totalIn += usage?.total_input_tokens ?? 0;
    totalOut += usage?.total_output_tokens ?? 0;
    console.log(`  done ${elapsed}s | severity ${c.severity} | ${usage?.total_input_tokens ?? "?"} in / ${usage?.total_output_tokens ?? "?"} out | case $${usd.toFixed(3)} | cumulative $${totalUsd.toFixed(2)}`);
    lines.forEach((l) => console.log(l));
    await exportFixture(c);
    console.log(`  exported db/fixtures/cases/${caseId}.json\n`);

    if (totalUsd > COST_CAP_USD) {
      console.error(`STOP: cumulative $${totalUsd.toFixed(2)} exceeded the cap $${COST_CAP_USD} (materially above estimate). Surfacing before spending further.`);
      await prisma.$disconnect();
      process.exit(2);
    }
  }

  console.log(`=== Re-fire complete: ${CASES.length} cases | ${totalIn} in / ${totalOut} out | TOTAL $${totalUsd.toFixed(2)} (est. ~$4.2-4.5) ===`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error("FAILED:", e); await prisma.$disconnect(); process.exit(1); });
