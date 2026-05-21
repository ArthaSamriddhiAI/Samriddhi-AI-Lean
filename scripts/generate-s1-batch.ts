/* Five-case Samriddhi 1 (proposed_action) batch.
 *
 * Generates the first five GENERATED Samriddhi 1 cases (the Sharma + Marcellus
 * fixture is structural scaffolding, not a generated case). Runs against the
 * enriched pipeline: E1/E2 receive data-grounded scope from the scope-builders
 * (ADR-0024); the rest of the proposed_action pipeline (E3/E4/E6/E7, G1/G2/G3,
 * S1.case_mode, A1, materiality, IC1) is unchanged.
 *
 * Run ONE case at a time for failure isolation and per-case commits:
 *   set -a; source .env; set +a; \
 *   env -u ANTHROPIC_BASE_URL -u ANTHROPIC_API_KEY STUB_RECORD=true \
 *     npx tsx scripts/generate-s1-batch.ts <investorId>
 *
 * Dry-run (Phase 1 gate; scratch case_id, no export, row deleted after):
 *   env -u ANTHROPIC_BASE_URL -u ANTHROPIC_API_KEY \
 *     npx tsx scripts/generate-s1-batch.ts <investorId> --dry-run
 *
 * Prereq: npm run db:seed (investors, snapshots, settings row). Live mode
 * (STUB_MODE=false). STUB_RECORD=true records the 16-file stub set per case
 * under fixtures/stub-responses/<caseId>/ as a byproduct (ADR-0024 / WA T-2).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { runProposedActionPipeline } from "../lib/agents/pipeline-case";
import type { Proposal } from "../lib/agents/proposal";

const ROOT = process.cwd();
const FIXTURE_DIR = path.join(ROOT, "db", "fixtures", "cases");

type BatchCase = {
  investorId: string;
  caseId: string;
  snapshotId: string;
  proposal: Proposal;
  contextNote: string;
};

/* Run order is failure-isolation order: clean pass first, engineered decline
 * last. Instrument selections are documented in ADR-0023. Marcellus is
 * deliberately avoided (over-used in the project); each PMS pick is distinct. */
const BATCH: BatchCase[] = [
  {
    investorId: "iyengar",
    caseId: "c-2026-05-21-iyengar-01",
    snapshotId: "t0_q2_2026",
    proposal: {
      action_type: "new_investment",
      target_category: "mutual_fund_debt",
      target_instrument: "ICICI Prudential Corporate Bond Fund",
      ticket_size_cr: 0.5,
      source_of_funds: "fixed_deposits",
      timeline: "this_year",
      rationale:
        "Advisor-initiated (Priya Nair). Deploy Rs 50 L from the September 2026 FD maturity into ICICI Prudential Corporate Bond Fund (AAA corporate debt) via a 6-month STP from a liquid fund. The late-cutting / early-pause rate cycle compresses FD reinvestment yields; a high-quality corporate bond fund offers a better-than-FD risk-adjusted return at a comparable conservative risk profile over the 3Y operational window and sits naturally alongside the existing Franklin India Corporate Debt holding. Tax treatment is a secondary consideration. The liquidity tier is preserved. Mrs. Iyengar consents to the recommendation; she has not historically initiated new product types.",
    },
    contextNote:
      "Samriddhi 1 proposal evaluation for Mrs. Lalitha Iyengar. Advisor-initiated conservative corporate-bond-fund deployment (Rs 50 L, 3Y) retuned from an equity-oriented hybrid to fit her Conservative mandate (ADR-0023); designed as the IC1-skip demonstration. Generated 2026-05-21 against the enriched E1/E2 pipeline (ADR-0024).",
  },
  {
    investorId: "surana",
    caseId: "c-2026-05-21-surana-01",
    snapshotId: "t0_q2_2026",
    proposal: {
      action_type: "new_investment",
      target_category: "mutual_fund_debt",
      target_instrument:
        "HDFC Short Term Debt Fund (lead of a Rs 5 Cr debt sleeve: Rs 2 Cr short-term debt MF, Rs 1 Cr AAA corporate bond MF, Rs 2 Cr NHAI/REC/PFC tax-free bond ladder)",
      ticket_size_cr: 5,
      source_of_funds: "cash_balance",
      timeline: "this_year",
      rationale:
        "Investor-initiated (self-directed, fee-only). Rs 5 Cr fresh allocation to a debt sleeve over 7Y to address the zero-debt design of the portfolio without crystallising LTCG on the concentrated Reliance position (which is deliberately not touched). Funded by cash reserves plus 12 months of incremental founder distribution. Rajiv brings an analytical performance spreadsheet to the meeting.",
    },
    contextNote:
      "Samriddhi 1 proposal evaluation for Rajiv Surana (Plan v8 canonical demo investor). Self-directed Rs 5 Cr debt/ballast sleeve (7Y); Reliance untouched. Generated 2026-05-21 against the enriched E1/E2 pipeline (ADR-0024).",
  },
  {
    investorId: "malhotra",
    caseId: "c-2026-05-21-malhotra-01",
    snapshotId: "t0_q2_2026",
    proposal: {
      action_type: "new_investment",
      target_category: "pms",
      target_instrument: "Stallion Asset Core Fund (PMS)",
      ticket_size_cr: 1,
      source_of_funds: "mutual_funds",
      timeline: "this_year",
      rationale:
        "Investor-initiated (Dr. Vikram Malhotra). Rs 1 Cr allocation to a quality-concentrated PMS (the household's first PMS), funded by a Rs 50 L partial trim of Mirae Asset Large Cap, Rs 30 L of SIP redirect over 12 months, and Rs 20 L of incremental household savings. Trigger: a peer cardiologist's PMS satisfaction signal and Dr. Shruti Malhotra's framing for more actively managed sophistication during the quarterly review.",
    },
    contextNote:
      "Samriddhi 1 proposal evaluation for Dr. Vikram and Dr. Shruti Malhotra. First-PMS allocation (Rs 1 Cr, 7Y), quality-concentrated. Generated 2026-05-21 against the enriched E1/E2 pipeline (ADR-0024).",
  },
  {
    investorId: "menon",
    caseId: "c-2026-05-21-menon-01",
    snapshotId: "t4_q2_2027",
    proposal: {
      action_type: "new_investment",
      target_category: "aif",
      target_instrument: "Vivriti Alpha Debt Fund (Cat II private credit AIF)",
      ticket_size_cr: 5,
      source_of_funds: "cash_balance",
      timeline: "this_year",
      rationale:
        "Advisor-initiated (Rohan Kapoor). Rs 5 Cr commitment to a Cat II private credit AIF as the next stage of Arjun Menon's structured deployment ramp-up (first-tranche deployment now roughly 14-16 months in). Horizon 8Y operational plus multi-vintage stewardship. Menon transitioned to Resident from RNOR in FY 2026-27 (conversion completed Q1 2027); this is clean Resident-side deployment, so no RNOR mechanics are load-bearing (NRI/RNOR/HUF case shapes are out of scope per product debt P1). Capital-call schedule must be reconciled with the Rs 12-14 Cr Sadashivanagar property reserve and the Rs 50 L parents-care fund.",
    },
    contextNote:
      "Samriddhi 1 proposal evaluation for Arjun Menon, set FY 2026-27 post-RNOR (snapshot t4_q2_2027). Rs 5 Cr Cat II private credit AIF commitment. RNOR mechanics out of scope (ref P1). Generated 2026-05-21 against the enriched E1/E2 pipeline (ADR-0024).",
  },
  {
    investorId: "bhatt",
    caseId: "c-2026-05-21-bhatt-01",
    snapshotId: "t0_q2_2026",
    proposal: {
      action_type: "new_investment",
      target_category: "pms",
      target_instrument: "ASK Indian Capital Goods & Infrastructure Portfolio (PMS)",
      ticket_size_cr: 2,
      source_of_funds: "fresh_inflow",
      timeline: "this_quarter",
      rationale:
        "Investor-initiated (Shailesh Bhatt), brought in good faith. A sector-thematic capital-goods PMS pitched through an Ahmedabad business-community peer (a fellow textile-exporter three years into the strategy). Rs 2 Cr allocation with NO exit from the existing four PMS positions; net effect is five PMS positions and wrapper-aggregate exposure rising from roughly 39% to roughly 45% of advisory liquid AUM. Daughter Aanchal (IIM-B finance) has expressed skepticism in a recent family conversation; Shailesh acknowledges her view but is proceeding because the peer has been in the strategy three years and it is working.",
    },
    contextNote:
      "Samriddhi 1 proposal evaluation for Shailesh Bhatt. Engineered-decline shape: 5th PMS, no exits, wrapper aggregate ~39% to ~45%, relationship-driven. Plausible because of who Bhatt is (revealed accumulation pattern), not engineered against him. Generated 2026-05-21 against the enriched E1/E2 pipeline (ADR-0024).",
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

/* Print the sanity-check surface: materiality, IC1, gates, synthesis verdict,
 * and the E1/E2 verdicts with their cited data points (the Shape B proof that
 * the agents cite snapshot figures rather than inventing them). */
function inspect(content: Record<string, unknown>): void {
  const c = content as any;
  const mat = c.materiality ?? {};
  const ic1 = c.ic1_deliberation ?? {};
  const sv = c.briefing?.section_2_synthesis_verdict ?? {};
  console.log(`  materiality.fires: ${mat.fires}  triggers: ${JSON.stringify(mat.triggers ?? [])}`);
  console.log(`  ic1.fires: ${ic1.fires}`);
  console.log(`  synthesis: ${sv.overall_verdict} (risk ${sv.overall_risk_level}, confidence ${sv.confidence})`);
  const gates = (c.gate_results ?? []) as Array<{ gate_id: string; status: string }>;
  console.log(`  gates: ${gates.map((g) => `${g.gate_id}=${g.status}`).join(", ")}`);
  const evidence = (c.evidence_verdicts ?? []) as Array<Record<string, any>>;
  for (const ev of evidence) {
    const id = ev.agent_id ?? ev.agentId ?? "";
    if (!`${id}`.includes("e1_") && !`${id}`.includes("e2_")) continue;
    const dps = ev.data_points_cited ?? ev.dataPointsCited ?? [];
    console.log(`  [${id}] status=${ev.activation_status ?? ev.status} confidence=${ev.confidence}`);
    if (Array.isArray(dps) && dps.length) {
      console.log(`     data_points_cited (${dps.length}): ${JSON.stringify(dps).slice(0, 600)}`);
    }
    const reasoning = ev.reasoning_paragraph ?? ev.reasoning ?? "";
    if (reasoning) console.log(`     reasoning: ${`${reasoning}`.slice(0, 300)}...`);
  }
}

async function runOne(entry: BatchCase, dryRun: boolean): Promise<boolean> {
  const { investorId, snapshotId, proposal, contextNote } = entry;
  const caseId = dryRun ? `scratch-dryrun-${investorId}` : entry.caseId;
  console.log(`\n[${dryRun ? "DRY-RUN" : "RUN"}] ${investorId} -> ${caseId} (snapshot ${snapshotId})`);
  console.log(`  proposal: ${proposal.target_category} "${proposal.target_instrument}" Rs ${proposal.ticket_size_cr} Cr`);

  await prisma.case.upsert({
    where: { id: caseId },
    update: { status: "generating", errorMessage: null, contentJson: JSON.stringify({ proposal }), severity: "info", headline: "Proposal evaluation in progress", snapshotId },
    create: {
      id: caseId,
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

  const t0 = Date.now();
  await runProposedActionPipeline({ caseId, investorId, snapshotId, proposal });
  const elapsedMs = Date.now() - t0;

  const c = await prisma.case.findUnique({ where: { id: caseId } });
  if (!c) throw new Error(`Case row missing after pipeline run: ${caseId}`);
  if (c.status === "failed") {
    console.error(`  FAILED (${(elapsedMs / 1000).toFixed(1)}s): ${c.errorMessage}`);
    if (dryRun) await prisma.case.delete({ where: { id: caseId } });
    return false;
  }

  const usage = c.tokenUsageJson ? JSON.parse(c.tokenUsageJson) : null;
  console.log(`  done in ${(elapsedMs / 1000).toFixed(1)}s | severity: ${c.severity}`);
  console.log(`  headline: ${c.headline}`);
  if (usage) console.log(`  usage_summary: ${JSON.stringify(usage).slice(0, 400)}`);
  inspect(JSON.parse(c.contentJson));

  if (dryRun) {
    await prisma.case.delete({ where: { id: caseId } });
    console.log("  dry-run: scratch case row deleted, no fixture exported.");
  } else {
    await prisma.case.update({ where: { id: caseId }, data: { contextNote } });
    const patched = await prisma.case.findUnique({ where: { id: caseId } });
    await exportFixture(patched as unknown as CaseRow);
  }
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const investorId = args.find((a) => !a.startsWith("--"));
  if (!investorId) {
    console.error(`Usage: npx tsx scripts/generate-s1-batch.ts <investorId> [--dry-run]`);
    console.error(`  investors: ${BATCH.map((b) => b.investorId).join(", ")}`);
    process.exit(2);
  }
  const entry = BATCH.find((b) => b.investorId === investorId);
  if (!entry) {
    console.error(`Unknown investor: ${investorId}. Known: ${BATCH.map((b) => b.investorId).join(", ")}`);
    process.exit(2);
  }
  const ok = await runOne(entry, dryRun);
  if (!ok) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("S1 BATCH RUN FAILED:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
