/* Live IC1 stub generation for the Sharma + Marcellus case.
 *
 * Fires the five IC1 sub-agents (Chair, Risk Assessor, Devil's Advocate,
 * Counterfactual Engine, Minutes Recorder) in live mode against the
 * existing Sharma S1 case fixture at db/fixtures/cases/c-2026-05-14-sharma-01.json.
 *
 * The Sharma case has ic1_deliberation.fires=true with all five roles in
 * sentinel state (status: "infrastructure_ready"). This script populates them.
 *
 * Execution steps:
 *   1. Load the Sharma fixture from disk.
 *   2. Reconstruct CaseAgentContext from investor + mandate data.
 *   3. Run runIC1Pipeline with stubKey set (so STUB_RECORD captures each
 *      role's response) and STUB_MODE=false (live mode).
 *   4. Update the fixture's ic1_deliberation block with the populated output.
 *   5. Write the updated fixture back to disk.
 *   6. Upsert the updated case into the DB so the UI can render immediately.
 *
 * IC1 sequencing (per orientation Q3, preserved in orchestrator):
 *   Step 1 (parallel): Chair + Risk Assessor
 *   Step 2:            Devil's Advocate (consumes Chair)
 *   Step 3:            Counterfactual Engine (consumes Risk Assessor)
 *   Step 4:            Minutes Recorder (consumes all four)
 *
 * Stubs recorded at:
 *   fixtures/stub-responses/c-2026-05-14-sharma-01/ic1_chair.json
 *   fixtures/stub-responses/c-2026-05-14-sharma-01/ic1_risk_assessor.json
 *   fixtures/stub-responses/c-2026-05-14-sharma-01/ic1_devils_advocate.json
 *   fixtures/stub-responses/c-2026-05-14-sharma-01/ic1_counterfactual_engine.json
 *   fixtures/stub-responses/c-2026-05-14-sharma-01/ic1_minutes_recorder.json
 *
 * Estimated spend: $2-4 (five sequential Opus 4.7 calls; IC1 skill files
 * declare Opus and there is no LEAN_RUNTIME_OVERRIDES entry for them).
 * Estimated runtime: 3-5 minutes wall-clock.
 *
 * Prerequisites:
 *   - STUB_MODE must NOT be set to true in Settings or env.
 *   - STUB_RECORD=true must be set in the environment (recorded by the
 *     script's process.env assignment below so no shell prefix needed).
 *   - npm run db:seed has been run (investor record must exist for ctx).
 *
 * Run via: npx tsx scripts/generate-sharma-ic1.ts
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { HOLDINGS_BY_INVESTOR } from "../db/fixtures/structured-holdings";
import { MANDATES_BY_INVESTOR } from "../db/fixtures/structured-mandates";
import type { Mandate } from "../db/fixtures/structured-mandates";
import { runIC1Pipeline } from "../lib/agents/ic1-pipeline";
import type { CaseAgentContext } from "../lib/agents/case/case-context";
import type { BriefingCaseContent } from "../lib/agents/case/briefing-case-content";
import type { CaseEvidenceVerdict } from "../lib/agents/case/case-verdict";
import type { GateResult } from "../lib/agents/case/governance/types";
import type { MaterialityOutput } from "../lib/agents/materiality";
import type { Proposal } from "../lib/agents/proposal";

/* Force STUB_RECORD on for this script's process so the harness records
 * each IC1 role's response to disk. We do NOT set STUB_MODE here; absent
 * a DB override, the default is false, so all five roles go live. */
process.env.STUB_RECORD = "true";

const CASE_FIXTURE_ID = "c-2026-05-14-sharma-01";
const ROOT = process.cwd();
const FIXTURE_PATH = path.join(ROOT, "db", "fixtures", "cases", `${CASE_FIXTURE_ID}.json`);
const ADVISOR_NAME = "Priya Nair";

type CaseFixtureOnDisk = {
  id: string;
  investorId: string;
  snapshotId: string;
  workflow: string;
  severity: string;
  headline: string;
  status: string | null;
  frozenAt: string;
  content: {
    briefing: BriefingCaseContent;
    gate_results: GateResult[];
    evidence_verdicts: CaseEvidenceVerdict[];
    proposal: Proposal;
    materiality: MaterialityOutput;
    ic1_deliberation: unknown;
    usage_summary: unknown;
  };
  tokenUsage: unknown;
  errorMessage: string | null;
  contextNote: string | null;
  stubbed?: boolean;
};

function buildContextSummary(mandate: Mandate, currentEquityPct: number): string {
  const eqBand = mandate.bands.find((b) => b.asset_class === "Equity");
  if (!eqBand) return "mandate bands not authored";
  return `risk_appetite: Aggressive; time_horizon: Over 5y; equity band ${eqBand.min_pct}-${eqBand.max_pct}% currently ${currentEquityPct.toFixed(1)}%; mandate review annual`;
}

function buildPortfolioScope(): string {
  return "Liquid AUM Rs 18 Cr across 8 holdings: 1 PMS, 1 AIF, 3 MF, 2 FD, 1 cash";
}

async function main() {
  console.log("Sharma IC1 live generation");
  console.log("==========================");
  console.log(`Case fixture: ${CASE_FIXTURE_ID}`);
  console.log(`STUB_RECORD: ${process.env.STUB_RECORD}`);
  console.log("");

  /* Step 1: load the fixture from disk. */
  console.log("Step 1: load fixture from disk");
  const raw = await fs.readFile(FIXTURE_PATH, "utf-8");
  const fixture = JSON.parse(raw) as CaseFixtureOnDisk;
  const { briefing, gate_results, evidence_verdicts, proposal, materiality } = fixture.content;
  console.log(`  materiality.fires: ${materiality.fires}`);
  console.log(`  materiality.triggers: ${(materiality as MaterialityOutput).triggers.join(", ")}`);

  if (!materiality.fires) {
    throw new Error("materiality.fires is false; IC1 deliberation would not activate for this case.");
  }

  /* Validate sentinel state of all five roles. */
  const ic1 = fixture.content.ic1_deliberation as Record<string, { status?: string }>;
  const roles = ["chair", "risk_assessor", "devils_advocate", "counterfactual_engine", "minutes_recorder"];
  for (const role of roles) {
    if (ic1[role]?.status !== "infrastructure_ready") {
      throw new Error(
        `IC1 role ${role} is not in sentinel state (status=${ic1[role]?.status}). ` +
        `Delete the existing stub at fixtures/stub-responses/${CASE_FIXTURE_ID}/ic1_${role}.json ` +
        `to force re-generation, or check the fixture manually.`,
      );
    }
  }
  console.log("  all five IC1 roles are in sentinel state; proceeding with live generation.");

  /* Step 2: load investor record and reconstruct CaseAgentContext. */
  console.log("\nStep 2: reconstruct CaseAgentContext from investor record");
  const investorRecord = await prisma.investor.findUnique({ where: { id: "sharma" } });
  if (!investorRecord) throw new Error("Sharma investor row not found. Run npm run db:seed first.");

  const holdings = HOLDINGS_BY_INVESTOR.sharma;
  const mandate = MANDATES_BY_INVESTOR.sharma;
  const currentEquityCr = holdings.holdings
    .filter((h) => h.assetClass === "Equity")
    .reduce((s, h) => s + h.valueCr, 0);
  const currentEquityPct = (currentEquityCr / holdings.totalLiquidAumCr) * 100;

  const ctx: CaseAgentContext = {
    caseId: CASE_FIXTURE_ID,
    asOfDate: "2026-04-02",
    investorName: investorRecord.name,
    investorMandate: buildContextSummary(mandate, currentEquityPct),
    portfolioScope: buildPortfolioScope(),
    proposal,
    indianContext: null,
  };
  console.log(`  investor: ${ctx.investorName}`);
  console.log(`  mandate: ${ctx.investorMandate}`);
  console.log(`  proposal: ${proposal.target_instrument}, Rs ${proposal.ticket_size_cr} Cr`);
  /* Suppress unused-variable warning for advisor name (used implicitly for context). */
  void ADVISOR_NAME;

  /* Step 3: run IC1 pipeline in live mode with stubKey so responses are
   * recorded. STUB_MODE is false (live), STUB_RECORD is true (records). */
  console.log("\nStep 3: run IC1 pipeline (live mode, 5 calls)");
  console.log("  Step 3a: Chair + Risk Assessor in parallel...");
  const t0 = Date.now();

  const result = await runIC1Pipeline(
    {
      ctx,
      synthesis: briefing.section_2_synthesis_verdict,
      briefing,
      evidence: evidence_verdicts,
      gates: gate_results,
      materiality: materiality as MaterialityOutput,
    },
    {
      /* Pass stubKey so the harness routes recordings to the correct
       * stub directory. STUB_MODE=false means shouldUseSentinel returns
       * false and all roles go live; STUB_RECORD=true means each
       * successful response is persisted. */
      stubKey: { caseFixtureId: CASE_FIXTURE_ID },
    },
  );

  const elapsedMs = Date.now() - t0;
  console.log(`\n  IC1 pipeline done in ${(elapsedMs / 1000).toFixed(1)}s`);

  const u = result.usage;
  const totalIn = u.ic1_chair_input + u.ic1_risk_assessor_input + u.ic1_devils_advocate_input + u.ic1_counterfactual_engine_input + u.ic1_minutes_recorder_input;
  const totalOut = u.ic1_chair_output + u.ic1_risk_assessor_output + u.ic1_devils_advocate_output + u.ic1_counterfactual_engine_output + u.ic1_minutes_recorder_output;
  console.log(`  total tokens: ${totalIn} in / ${totalOut} out`);
  console.log(`  chair: ${u.ic1_chair_input} in / ${u.ic1_chair_output} out`);
  console.log(`  risk_assessor: ${u.ic1_risk_assessor_input} in / ${u.ic1_risk_assessor_output} out`);
  console.log(`  devils_advocate: ${u.ic1_devils_advocate_input} in / ${u.ic1_devils_advocate_output} out`);
  console.log(`  counterfactual_engine: ${u.ic1_counterfactual_engine_input} in / ${u.ic1_counterfactual_engine_output} out`);
  console.log(`  minutes_recorder: ${u.ic1_minutes_recorder_input} in / ${u.ic1_minutes_recorder_output} out`);

  /* Verify all five roles are populated. */
  const deliberation = result.deliberation;
  if (!deliberation.fires) throw new Error("runIC1Pipeline returned fires=false; unexpected.");
  for (const role of roles) {
    const payload = deliberation[role as keyof typeof deliberation] as { status?: string } | undefined;
    if (!payload || payload.status !== "populated") {
      throw new Error(`IC1 role ${role} is not populated (status=${payload?.status}). Check errors above.`);
    }
  }
  console.log("  all five roles: populated");

  /* Step 4: update the fixture's ic1_deliberation block. */
  console.log("\nStep 4: update fixture ic1_deliberation");
  const updatedContent = {
    ...fixture.content,
    ic1_deliberation: deliberation,
  };
  const updatedFixture: CaseFixtureOnDisk = {
    ...fixture,
    content: updatedContent,
    frozenAt: new Date().toISOString(),
    contextNote: (fixture.contextNote ?? "") +
      ` IC1 populated ${new Date().toISOString().slice(0, 10)} via live generation (deferred workstream cleanup).`,
  };

  const outJson = JSON.stringify(updatedFixture, null, 2);
  await fs.writeFile(FIXTURE_PATH, outJson, "utf-8");
  console.log(`  wrote updated fixture: db/fixtures/cases/${CASE_FIXTURE_ID}.json (${outJson.length} chars)`);

  /* Step 5: upsert the updated case into the DB so the UI renders
   * immediately without requiring a full db:reset. */
  console.log("\nStep 5: upsert updated case into DB");
  await prisma.case.upsert({
    where: { id: CASE_FIXTURE_ID },
    update: {
      contentJson: JSON.stringify(updatedContent),
      contextNote: updatedFixture.contextNote,
      frozenAt: new Date(updatedFixture.frozenAt),
    },
    create: {
      id: updatedFixture.id,
      investorId: updatedFixture.investorId,
      snapshotId: updatedFixture.snapshotId,
      workflow: updatedFixture.workflow,
      severity: updatedFixture.severity,
      headline: updatedFixture.headline,
      status: updatedFixture.status,
      frozenAt: new Date(updatedFixture.frozenAt),
      contentJson: JSON.stringify(updatedContent),
      tokenUsageJson: updatedFixture.tokenUsage ? JSON.stringify(updatedFixture.tokenUsage) : null,
      errorMessage: updatedFixture.errorMessage,
      contextNote: updatedFixture.contextNote,
      stubbed: updatedFixture.stubbed ?? null,
    },
  });
  console.log("  DB upsert complete.");

  console.log("\nDone.");
  console.log(`  5 IC1 stub fixtures at fixtures/stub-responses/${CASE_FIXTURE_ID}/ic1_*.json`);
  console.log(`  Updated case fixture at db/fixtures/cases/${CASE_FIXTURE_ID}.json`);
  console.log(`  Live API tokens: ${totalIn} in / ${totalOut} out`);
  console.log(`  Wall-clock: ${(elapsedMs / 1000).toFixed(1)}s`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("FAILED:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
