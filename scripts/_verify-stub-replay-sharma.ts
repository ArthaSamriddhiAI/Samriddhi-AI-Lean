/* Watch item 3: STUB_MODE replay integrity for the post-integration
 * Sharma IC1. Read-only, zero API spend.
 *
 * Forces STUB_MODE=true / STUB_RECORD=false, loads the Sharma fixture,
 * and replays runIC1Pipeline against the five re-recorded stubs. A clean
 * pass means: all five roles populate from disk (not sentinel) and zero
 * context_not_yet_available sentinels. The replay reports the RECORDED
 * token counts (the harness echoes stub.usage so live and replay usage
 * rollups stay symmetric); a positive figure here confirms the stubs
 * were read, not that an SDK call happened.
 *
 * Run via: npx tsx scripts/_verify-stub-replay-sharma.ts
 */

process.env.STUB_MODE = "true";
process.env.STUB_RECORD = "false";

import { promises as fs } from "node:fs";
import path from "node:path";
import { runIC1Pipeline } from "../lib/agents/ic1-pipeline";
import type { CaseAgentContext } from "../lib/agents/case/case-context";
import type { IndianContextSummary } from "../lib/agents/m0-indian-context";
import type { BriefingCaseContent } from "../lib/agents/case/briefing-case-content";
import type { CaseEvidenceVerdict } from "../lib/agents/case/case-verdict";
import type { GateResult } from "../lib/agents/case/governance/types";
import type { MaterialityOutput } from "../lib/agents/materiality";
import type { Proposal } from "../lib/agents/proposal";
import { prisma } from "../lib/prisma";

const CASE_FIXTURE_ID = "c-2026-05-14-sharma-01";

async function main() {
  const fixturePath = path.join(
    process.cwd(),
    "db",
    "fixtures",
    "cases",
    `${CASE_FIXTURE_ID}.json`,
  );
  const fx = JSON.parse(await fs.readFile(fixturePath, "utf-8"));
  const c = fx.content as {
    proposal: Proposal;
    indian_context: IndianContextSummary;
    briefing: BriefingCaseContent;
    evidence_verdicts: CaseEvidenceVerdict[];
    gate_results: GateResult[];
    materiality: MaterialityOutput;
  };

  const ctx: CaseAgentContext = {
    caseId: CASE_FIXTURE_ID,
    asOfDate: "2026-04-02",
    investorName: "Sharma family",
    investorMandate: "equity band 50-70%",
    portfolioScope: "Liquid AUM Rs 18 Cr",
    proposal: c.proposal,
    indianContext: c.indian_context,
  };

  const r = await runIC1Pipeline(
    {
      ctx,
      synthesis: c.briefing.section_2_synthesis_verdict,
      briefing: c.briefing,
      evidence: c.evidence_verdicts,
      gates: c.gate_results,
      materiality: c.materiality,
    },
    { stubKey: { caseFixtureId: CASE_FIXTURE_ID } },
  );

  const roles = [
    "chair",
    "risk_assessor",
    "devils_advocate",
    "counterfactual_engine",
    "minutes_recorder",
  ] as const;
  const d = r.deliberation as Record<string, { status?: string }> & {
    fires: boolean;
  };
  const statuses = Object.fromEntries(roles.map((k) => [k, d[k]?.status]));
  const sentinels =
    (JSON.stringify(r.deliberation).match(/context_not_yet_available/g) || [])
      .length;
  const liveTokens =
    r.usage.ic1_chair_input +
    r.usage.ic1_risk_assessor_input +
    r.usage.ic1_devils_advocate_input +
    r.usage.ic1_counterfactual_engine_input +
    r.usage.ic1_minutes_recorder_input;

  console.log("STUB_MODE replay of Sharma IC1");
  console.log(`  fires=${d.fires}`);
  console.log(`  statuses=${JSON.stringify(statuses)}`);
  console.log(`  context_not_yet_available sentinels=${sentinels}`);
  console.log(
    `  replay reports recorded tokens=${liveTokens} (echoed from stubs; >0 confirms disk read)`,
  );

  const allPopulated = roles.every((k) => d[k]?.status === "populated");
  const pass = d.fires && allPopulated && sentinels === 0 && liveTokens > 0;
  console.log(
    pass
      ? "STUB_MODE REPLAY INTEGRITY: PASS"
      : "STUB_MODE REPLAY INTEGRITY: FAIL",
  );
  if (!pass) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("FAILED:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
