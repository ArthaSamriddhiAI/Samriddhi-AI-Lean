/* Verification script for the IC1 sentinel-on-missing-stub branch.
 * Run via: STUB_MODE=true npx tsx scripts/_verify-ic1-sentinel.ts
 *
 * The Slice 4 close ships without IC1 stubs on disk for the Sharma case
 * (Option A funding-aware posture). This script confirms that with
 * STUB_MODE active and no IC1 stub fixtures present, the orchestrator
 * short-circuits each of the five sub-agent roles to
 * { status: "infrastructure_ready" } and reports zero usage end-to-end,
 * without throwing on the missing stubs.
 *
 * Also asserts that materiality.fires=true on the Sharma case content
 * (the precondition for IC1 invocation; commit 1 verified the rule
 * evaluator in isolation, this script verifies its integration with
 * the orchestrator).
 *
 * Throwaway; remove once the wrap-up confirms the slice closes cleanly. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateMateriality } from "../lib/agents/materiality";
import { runIC1Pipeline } from "../lib/agents/ic1-pipeline";
import type { CaseEvidenceVerdict } from "../lib/agents/case/case-verdict";
import type { GateResult } from "../lib/agents/case/governance/types";
import type {
  BriefingCaseContent,
  SynthesisVerdictSection,
} from "../lib/agents/case/briefing-case-content";
import type { CaseAgentContext } from "../lib/agents/case/case-context";
import type { Proposal } from "../lib/agents/proposal";

type Failure = { name: string; detail: string };
const failures: Failure[] = [];

function assert(cond: boolean, name: string, detail: string) {
  if (!cond) failures.push({ name, detail });
}

if (process.env.STUB_MODE !== "true") {
  console.error("STUB_MODE must be set to 'true' for this verification.");
  process.exit(1);
}

async function main() {

const sharmaPath = resolve(__dirname, "../db/fixtures/cases/c-2026-05-14-sharma-01.json");
const sharma = JSON.parse(readFileSync(sharmaPath, "utf-8")) as {
  content: {
    briefing: BriefingCaseContent & {
      section_2_synthesis_verdict: SynthesisVerdictSection;
    };
    gate_results: GateResult[];
    evidence_verdicts: CaseEvidenceVerdict[];
    proposal: Proposal;
  };
};

const synthesis = sharma.content.briefing.section_2_synthesis_verdict;
const materiality = evaluateMateriality({
  synthesis,
  gates: sharma.content.gate_results,
  evidence: sharma.content.evidence_verdicts,
  ticketSizeCr: sharma.content.proposal.ticket_size_cr,
});

console.log("--- Materiality on Sharma case ---");
console.log("fires:", materiality.fires);
console.log("triggers:", materiality.triggers);

assert(
  materiality.fires === true,
  "materiality.fires",
  `expected true (Sharma is the canonical material case); got ${materiality.fires}`,
);

const ctx: CaseAgentContext = {
  caseId: sharma.content.proposal.target_instrument,
  asOfDate: "2026-04-02",
  investorName: "Sharma",
  investorMandate: "(verify script placeholder, not used in sentinel path)",
  portfolioScope: "(verify script placeholder, not used in sentinel path)",
  proposal: sharma.content.proposal,
  indianContext: null,
};

/* Use a non-existent case-fixture id so no IC1 stubs are found on disk
 * regardless of the slice's actual fixture state. The shouldUseSentinel
 * helper checks per-agent stub paths; missing → sentinel cascade. */
const result = await runIC1Pipeline(
  {
    ctx,
    synthesis,
    briefing: sharma.content.briefing,
    evidence: sharma.content.evidence_verdicts,
    gates: sharma.content.gate_results,
    materiality,
  },
  { stubKey: { caseFixtureId: "test-no-ic1-stubs" } },
);

console.log("\n--- IC1 pipeline output ---");
console.log("deliberation.fires:", result.deliberation.fires);
if (result.deliberation.fires) {
  console.log("chair.status:", result.deliberation.chair.status);
  console.log("devils_advocate.status:", result.deliberation.devils_advocate.status);
  console.log("risk_assessor.status:", result.deliberation.risk_assessor.status);
  console.log("counterfactual_engine.status:", result.deliberation.counterfactual_engine.status);
  console.log("minutes_recorder.status:", result.deliberation.minutes_recorder.status);
}
console.log("usage totals:", result.usage);

assert(
  result.deliberation.fires === true,
  "deliberation.fires",
  `expected true (materiality fires); got ${result.deliberation.fires}`,
);

if (result.deliberation.fires) {
  for (const [role, payload] of [
    ["chair", result.deliberation.chair],
    ["devils_advocate", result.deliberation.devils_advocate],
    ["risk_assessor", result.deliberation.risk_assessor],
    ["counterfactual_engine", result.deliberation.counterfactual_engine],
    ["minutes_recorder", result.deliberation.minutes_recorder],
  ] as const) {
    assert(
      payload.status === "infrastructure_ready",
      `${role}.status`,
      `expected 'infrastructure_ready' (stub missing); got '${payload.status}'`,
    );
  }
}

const totalTokens =
  result.usage.ic1_chair_input +
  result.usage.ic1_chair_output +
  result.usage.ic1_devils_advocate_input +
  result.usage.ic1_devils_advocate_output +
  result.usage.ic1_risk_assessor_input +
  result.usage.ic1_risk_assessor_output +
  result.usage.ic1_counterfactual_engine_input +
  result.usage.ic1_counterfactual_engine_output +
  result.usage.ic1_minutes_recorder_input +
  result.usage.ic1_minutes_recorder_output;
assert(
  totalTokens === 0,
  "usage.total_tokens",
  `expected 0 across all roles (sentinel path); got ${totalTokens}`,
);

console.log("");
if (failures.length === 0) {
  console.log("OK: IC1 sentinel cascade verified against Sharma case content.");
  process.exit(0);
} else {
  console.error(`FAILED: ${failures.length} assertion(s) failed.`);
  for (const f of failures) console.error(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}

}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
