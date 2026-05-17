/* Piece 5: re-run the Sharma IC1 four-step deliberation against the
 * post-integration case context that now includes the M0.IndianContext
 * bundle.
 *
 * The Sharma IC1 was first populated during the deferred workstream
 * cleanup (DEFERRED item 12) with ctx.indianContext = null; the Risk
 * Assessor and Counterfactual Engine prompts emitted
 * `context_not_yet_available` sentinels in the IndianContext-dependent
 * fields. With M0.IndianContext wired (DEFERRED item 6), this re-run
 * gives all five sub-agents the populated bundle so they reason with
 * full context rather than around sentinels.
 *
 * recordStubIfMissing is idempotent (it never overwrites an existing
 * stub), so the five existing ic1_*.json stubs are deleted first to
 * force a fresh recording of the context-grounded responses. The Sharma
 * fixture is also refreshed with the indian_context bundle and the
 * YAML-grounded gate_results so disk state matches what pipeline-case.ts
 * now produces.
 *
 * Estimated spend: $2-4 (five sequential Opus 4.7 calls). Estimated
 * runtime: 3-5 minutes wall-clock.
 *
 * Prerequisites: STUB_MODE off (verified: .env.local STUB_MODE=false,
 * Setting.stubMode null), DB apiKey set, npm run db:seed has run.
 *
 * Run via: npx tsx scripts/regenerate-sharma-ic1-grounded.ts
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { HOLDINGS_BY_INVESTOR } from "../db/fixtures/structured-holdings";
import { MANDATES_BY_INVESTOR } from "../db/fixtures/structured-mandates";
import type { Mandate } from "../db/fixtures/structured-mandates";
import { runIC1Pipeline } from "../lib/agents/ic1-pipeline";
import { buildIndianContext } from "../lib/agents/m0-indian-context";
import { runG1 } from "../lib/agents/case/governance/g1-mandate";
import { runG2 } from "../lib/agents/case/governance/g2-sebi";
import { runG3 } from "../lib/agents/case/governance/g3-permission";
import type { CaseAgentContext } from "../lib/agents/case/case-context";
import type { BriefingCaseContent } from "../lib/agents/case/briefing-case-content";
import type { CaseEvidenceVerdict } from "../lib/agents/case/case-verdict";
import type { GateResult } from "../lib/agents/case/governance/types";
import type { MaterialityOutput } from "../lib/agents/materiality";
import type { Proposal } from "../lib/agents/proposal";

/* Force live mode and recording for this process. The base .env carries
 * the local dev convention STUB_MODE=true / STUB_RECORD=true; resolveStubMode
 * checks Setting.stubMode (null here) then process.env.STUB_MODE==="true".
 * Setting these here (module scope, before runIC1Pipeline resolves the
 * flag at runtime) guarantees the five roles go live and re-record,
 * regardless of .env or shell state. */
process.env.STUB_MODE = "false";
process.env.STUB_RECORD = "true";

const CASE_FIXTURE_ID = "c-2026-05-14-sharma-01";
const ROOT = process.cwd();
const FIXTURE_PATH = path.join(ROOT, "db", "fixtures", "cases", `${CASE_FIXTURE_ID}.json`);
const STUB_DIR = path.join(ROOT, "fixtures", "stub-responses", CASE_FIXTURE_ID);
const ADVISOR_NAME = "Priya Nair";
const AS_OF_DATE = "2026-04-02";
const IC1_ROLES = [
  "ic1_chair",
  "ic1_risk_assessor",
  "ic1_devils_advocate",
  "ic1_counterfactual_engine",
  "ic1_minutes_recorder",
];

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
    indian_context?: unknown;
    [k: string]: unknown;
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

async function main() {
  console.log("Sharma IC1 re-run, M0.IndianContext-grounded");
  console.log("============================================");
  console.log(`Case fixture: ${CASE_FIXTURE_ID}`);
  console.log(`STUB_RECORD=${process.env.STUB_RECORD}, STUB_MODE=${process.env.STUB_MODE ?? "(unset -> false)"}\n`);

  /* Step 1: load fixture. */
  const fixture = JSON.parse(await fs.readFile(FIXTURE_PATH, "utf-8")) as CaseFixtureOnDisk;
  const { briefing, evidence_verdicts, proposal, materiality } = fixture.content;
  if (!materiality.fires) {
    throw new Error("materiality.fires is false; IC1 would not activate.");
  }
  console.log(`Step 1: fixture loaded. materiality.fires=${materiality.fires}`);

  /* Step 2: reconstruct ctx WITH the real M0.IndianContext bundle. */
  const investorRecord = await prisma.investor.findUnique({ where: { id: "sharma" } });
  if (!investorRecord) throw new Error("Sharma investor row not found. Run npm run db:seed first.");
  const holdings = HOLDINGS_BY_INVESTOR.sharma;
  const mandate = MANDATES_BY_INVESTOR.sharma;
  const currentEquityCr = holdings.holdings
    .filter((h) => h.assetClass === "Equity")
    .reduce((s, h) => s + h.valueCr, 0);
  const currentEquityPct = (currentEquityCr / holdings.totalLiquidAumCr) * 100;

  const indianContext = await buildIndianContext({
    caseId: CASE_FIXTURE_ID,
    asOfDate: AS_OF_DATE,
    investorStructureLine: investorRecord.structureLine,
    proposalCategory: proposal.target_category,
    proposalInstrument: proposal.target_instrument,
    ticketSizeCr: proposal.ticket_size_cr,
  });
  console.log(
    `Step 2: ctx.indianContext built (${indianContext.citations.length} citations, ${indianContext.indicative_flags.length} indicative, ${indianContext.applicable_regulatory_changes.length} regulatory events).`,
  );

  const ctx: CaseAgentContext = {
    caseId: CASE_FIXTURE_ID,
    asOfDate: AS_OF_DATE,
    investorName: investorRecord.name,
    investorMandate: buildContextSummary(mandate, currentEquityPct),
    portfolioScope: "Liquid AUM Rs 18 Cr across 8 holdings: 1 PMS, 1 AIF, 3 MF, 2 FD, 1 cash",
    proposal,
    indianContext,
  };

  /* Step 3: refresh gate_results YAML-grounded (verdicts unchanged; G2
   * now sebi_001-cited) so the fixture is internally consistent with the
   * post-integration pipeline and IC1 reasons over the grounded gates. */
  const g1 = runG1({
    investorId: "sharma",
    investorName: investorRecord.name,
    liquidAumCr: holdings.totalLiquidAumCr,
    holdings,
    mandate,
    proposal,
  });
  const g2 = await runG2({ proposal });
  const g3 = runG3({ proposal, advisorName: ADVISOR_NAME });
  const gateResults: GateResult[] = [g1, g2, g3];
  console.log(`Step 3: gates re-grounded: ${gateResults.map((g) => `${g.gate_id}=${g.status}`).join(", ")}`);

  /* Step 4: delete the five existing IC1 stubs so the context-grounded
   * responses are recorded fresh (recordStubIfMissing never overwrites). */
  for (const role of IC1_ROLES) {
    const p = path.join(STUB_DIR, `${role}.json`);
    try {
      await fs.unlink(p);
      console.log(`Step 4: deleted stale stub ${role}.json`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      console.log(`Step 4: ${role}.json absent (nothing to delete)`);
    }
  }

  /* Step 5: run IC1 pipeline live (STUB_MODE off -> all five go live;
   * STUB_RECORD on -> each response recorded fresh). */
  console.log("\nStep 5: running IC1 pipeline live (5 Opus 4.7 calls)...");
  const t0 = Date.now();
  const result = await runIC1Pipeline(
    {
      ctx,
      synthesis: briefing.section_2_synthesis_verdict,
      briefing,
      evidence: evidence_verdicts,
      gates: gateResults,
      materiality,
    },
    { stubKey: { caseFixtureId: CASE_FIXTURE_ID } },
  );
  const elapsedMs = Date.now() - t0;
  const u = result.usage;
  const totalIn =
    u.ic1_chair_input + u.ic1_risk_assessor_input + u.ic1_devils_advocate_input +
    u.ic1_counterfactual_engine_input + u.ic1_minutes_recorder_input;
  const totalOut =
    u.ic1_chair_output + u.ic1_risk_assessor_output + u.ic1_devils_advocate_output +
    u.ic1_counterfactual_engine_output + u.ic1_minutes_recorder_output;
  console.log(`  done in ${(elapsedMs / 1000).toFixed(1)}s; ${totalIn} in / ${totalOut} out tokens`);

  const deliberation = result.deliberation;
  if (!deliberation.fires) throw new Error("runIC1Pipeline returned fires=false; unexpected.");
  const roleKeys = ["chair", "risk_assessor", "devils_advocate", "counterfactual_engine", "minutes_recorder"] as const;
  for (const role of roleKeys) {
    const payload = deliberation[role] as { status?: string } | undefined;
    if (!payload || payload.status !== "populated") {
      throw new Error(`IC1 role ${role} not populated (status=${payload?.status}).`);
    }
  }
  console.log("  all five roles populated.");

  /* Step 6: assert the IndianContext sentinels are gone from the two
   * roles that previously emitted them. */
  const raSentinels = JSON.stringify(deliberation.risk_assessor).match(/context_not_yet_available/g)?.length ?? 0;
  const cfSentinels = JSON.stringify(deliberation.counterfactual_engine).match(/context_not_yet_available/g)?.length ?? 0;
  console.log(`Step 6: sentinel check -> risk_assessor=${raSentinels}, counterfactual_engine=${cfSentinels}`);
  if (raSentinels > 0 || cfSentinels > 0) {
    throw new Error(
      `IndianContext sentinels still present (risk_assessor=${raSentinels}, counterfactual_engine=${cfSentinels}). ` +
        `The grounded re-run should not emit context_not_yet_available.`,
    );
  }
  console.log("  no context_not_yet_available sentinels remain.");

  /* Step 7: write the refreshed fixture (indian_context + grounded gates
   * + new deliberation). */
  const updatedContent = {
    ...fixture.content,
    gate_results: gateResults,
    indian_context: indianContext,
    ic1_deliberation: deliberation,
  };
  const nowIso = new Date().toISOString();
  const updatedFixture: CaseFixtureOnDisk = {
    ...fixture,
    content: updatedContent,
    frozenAt: nowIso,
    contextNote:
      (fixture.contextNote ?? "") +
      ` IC1 re-run ${nowIso.slice(0, 10)} M0.IndianContext-grounded (DEFERRED item 6); gate_results re-grounded to sebi_boundaries; indian_context bundle attached.`,
  };
  await fs.writeFile(FIXTURE_PATH, JSON.stringify(updatedFixture, null, 2), "utf-8");
  console.log(`Step 7: fixture written: db/fixtures/cases/${CASE_FIXTURE_ID}.json`);

  /* Step 8: upsert into the DB so the UI renders the grounded state. */
  await prisma.case.upsert({
    where: { id: CASE_FIXTURE_ID },
    update: {
      contentJson: JSON.stringify(updatedContent),
      contextNote: updatedFixture.contextNote,
      frozenAt: new Date(nowIso),
    },
    create: {
      id: updatedFixture.id,
      investorId: updatedFixture.investorId,
      snapshotId: updatedFixture.snapshotId,
      workflow: updatedFixture.workflow,
      severity: updatedFixture.severity,
      headline: updatedFixture.headline,
      status: updatedFixture.status,
      frozenAt: new Date(nowIso),
      contentJson: JSON.stringify(updatedContent),
      tokenUsageJson: updatedFixture.tokenUsage ? JSON.stringify(updatedFixture.tokenUsage) : null,
      errorMessage: updatedFixture.errorMessage,
      contextNote: updatedFixture.contextNote,
      stubbed: updatedFixture.stubbed ?? null,
    },
  });
  console.log("Step 8: DB upsert complete.");

  console.log("\nDone.");
  console.log(`  5 IC1 stubs re-recorded at fixtures/stub-responses/${CASE_FIXTURE_ID}/ic1_*.json`);
  console.log(`  Live tokens: ${totalIn} in / ${totalOut} out; wall-clock ${(elapsedMs / 1000).toFixed(1)}s`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("FAILED:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
