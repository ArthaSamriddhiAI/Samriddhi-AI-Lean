/* Verification script for the materiality threshold rule evaluator.
 * Run via: npx tsx scripts/_verify-materiality.ts
 *
 * Exercises both paths per orientation Q1:
 *   1. Sharma case content: fires=true with triggers {verdict_with_low_confidence,
 *      verdict_with_band_gaps, amplification_compound}.
 *   2. Synthetic clean small-ticket proposal: fires=false; reason names
 *      the deterministic state for the institutional audit trail.
 *
 * Throwaway: remove once Slice 4 lands and the orchestrator integration
 * carries the verification implicitly via the Sharma seed round-trip. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  evaluateMateriality,
  type MaterialityInput,
  type MaterialityTrigger,
} from "../lib/agents/materiality";
import type { CaseEvidenceVerdict } from "../lib/agents/case/case-verdict";
import type { GateResult } from "../lib/agents/case/governance/types";
import type { SynthesisVerdictSection } from "../lib/agents/case/briefing-case-content";

type Failure = { name: string; detail: string };
const failures: Failure[] = [];

function assert(cond: boolean, name: string, detail: string) {
  if (!cond) failures.push({ name, detail });
}

function setEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const item of b) if (!sa.has(item)) return false;
  return true;
}

/* ---------------------------------------------------------------- */
/* Test 1: Sharma case content; expect fires=true.                  */
/* ---------------------------------------------------------------- */

const sharmaPath = resolve(__dirname, "../db/fixtures/cases/c-2026-05-14-sharma-01.json");
const sharma = JSON.parse(readFileSync(sharmaPath, "utf-8")) as {
  content: {
    briefing: {
      section_2_synthesis_verdict: SynthesisVerdictSection;
    };
    gate_results: GateResult[];
    evidence_verdicts: CaseEvidenceVerdict[];
    proposal: { ticket_size_cr: number };
  };
};

const sharmaInput: MaterialityInput = {
  synthesis: sharma.content.briefing.section_2_synthesis_verdict,
  gates: sharma.content.gate_results,
  evidence: sharma.content.evidence_verdicts,
  ticketSizeCr: sharma.content.proposal.ticket_size_cr,
};
const sharmaOut = evaluateMateriality(sharmaInput);

console.log("--- Test 1: Sharma case ---");
console.log("fires:", sharmaOut.fires);
console.log("triggers:", sharmaOut.triggers);
console.log("reason:", sharmaOut.reason);

assert(sharmaOut.fires === true, "T1.fires", `expected true, got ${sharmaOut.fires}`);
const expectedSharmaTriggers: MaterialityTrigger[] = [
  "verdict_with_low_confidence",
  "verdict_with_band_gaps",
  "amplification_compound",
];
assert(
  setEqual(sharmaOut.triggers, expectedSharmaTriggers),
  "T1.triggers",
  `expected ${JSON.stringify(expectedSharmaTriggers)}, got ${JSON.stringify(sharmaOut.triggers)}`,
);
assert(
  /confidence 0\.78/.test(sharmaOut.reason),
  "T1.reason.confidence",
  `expected '0.78' in reason, got: ${sharmaOut.reason}`,
);
assert(
  /3 simultaneous G1 band gaps/.test(sharmaOut.reason),
  "T1.reason.bands",
  `expected '3 simultaneous G1 band gaps' in reason, got: ${sharmaOut.reason}`,
);
assert(
  /4 amplification flags/.test(sharmaOut.reason),
  "T1.reason.amplification",
  `expected '4 amplification flags' in reason, got: ${sharmaOut.reason}`,
);

/* ---------------------------------------------------------------- */
/* Test 2: synthetic clean small-ticket proposal; expect fires=false. */
/* ---------------------------------------------------------------- */

const cleanInput: MaterialityInput = {
  synthesis: {
    overall_verdict: "positive",
    overall_risk_level: "low",
    confidence: 0.92,
    consensus_areas: ["All agents align on suitability."],
    conflict_areas: [],
    amplification_flags: [],
    narrative_paragraph:
      "A small ticket new-investment proposal into a vanilla MF clears every layer cleanly.",
    counterfactual_framing: "A smaller ticket would have the same shape with less impact.",
    escalation_recommended: false,
  },
  gates: [
    {
      gate_id: "g1_mandate",
      status: "pass",
      rationale: "All allocation bands within mandate.",
      breaches: [],
      gaps: [],
      rule_trace: {},
    },
    {
      gate_id: "g2_sebi_regulatory",
      status: "pass",
      rationale: "MF subject to standard SEBI MF regulations; no ticket minimum violation.",
      breaches: [],
      gaps: [],
      rule_trace: {},
    },
    {
      gate_id: "g3_action_permission",
      status: "pass",
      rationale: "Advisor has unrestricted action authority.",
      breaches: [],
      gaps: [],
      rule_trace: {},
    },
  ],
  evidence: [
    {
      agent_id: "e1_listed_fundamental_equity",
      activation_status: "activated",
      risk_level: "low",
      confidence: 0.88,
      drivers: ["Look-through book reads cleanly."],
      flags: [],
      reasoning_paragraph: "Sound fundamentals across the look-through.",
      data_points_cited: [],
    },
    {
      agent_id: "e7_mutual_fund",
      activation_status: "activated",
      risk_level: "low",
      confidence: 0.9,
      drivers: ["Fund is well-rated with consistent style."],
      flags: [],
      reasoning_paragraph: "MF screens at a quality vintage with low cost.",
      data_points_cited: [],
    },
  ],
  ticketSizeCr: 0.5,
};
const cleanOut = evaluateMateriality(cleanInput);

console.log("\n--- Test 2: clean small-ticket proposal ---");
console.log("fires:", cleanOut.fires);
console.log("triggers:", cleanOut.triggers);
console.log("reason:", cleanOut.reason);

assert(cleanOut.fires === false, "T2.fires", `expected false, got ${cleanOut.fires}`);
assert(cleanOut.triggers.length === 0, "T2.triggers", `expected [], got ${JSON.stringify(cleanOut.triggers)}`);
assert(
  /Materiality threshold not reached/.test(cleanOut.reason),
  "T2.reason.prefix",
  `expected 'Materiality threshold not reached' prefix, got: ${cleanOut.reason}`,
);
assert(
  /G1 pass, G2 pass, G3 pass/.test(cleanOut.reason),
  "T2.reason.gates",
  `expected 'G1 pass, G2 pass, G3 pass' in reason, got: ${cleanOut.reason}`,
);

/* ---------------------------------------------------------------- */
/* Test 3: gate fail short-circuit; expect fires=true with gate_blocked. */
/* ---------------------------------------------------------------- */

const gateFailInput: MaterialityInput = {
  ...cleanInput,
  gates: [
    {
      gate_id: "g2_sebi_regulatory",
      status: "fail",
      rationale: "Ticket below SEBI minimum for PMS.",
      breaches: ["Ticket Rs 0.3 Cr below SEBI PMS minimum of Rs 0.5 Cr."],
      gaps: [],
      rule_trace: {},
    },
    ...cleanInput.gates.filter((g) => g.gate_id !== "g2_sebi_regulatory"),
  ],
};
const gateFailOut = evaluateMateriality(gateFailInput);

console.log("\n--- Test 3: gate fail short-circuit ---");
console.log("fires:", gateFailOut.fires);
console.log("triggers:", gateFailOut.triggers);
console.log("reason:", gateFailOut.reason);

assert(gateFailOut.fires === true, "T3.fires", `expected true, got ${gateFailOut.fires}`);
assert(
  gateFailOut.triggers.includes("gate_blocked"),
  "T3.triggers.gate_blocked",
  `expected 'gate_blocked' in triggers, got ${JSON.stringify(gateFailOut.triggers)}`,
);

/* ---------------------------------------------------------------- */
/* Test 4: large-ticket clean proposal; expect fires=true with ticket_size_threshold. */
/* ---------------------------------------------------------------- */

const largeTicketInput: MaterialityInput = {
  ...cleanInput,
  ticketSizeCr: 5,
};
const largeTicketOut = evaluateMateriality(largeTicketInput);

console.log("\n--- Test 4: large-ticket clean proposal ---");
console.log("fires:", largeTicketOut.fires);
console.log("triggers:", largeTicketOut.triggers);
console.log("reason:", largeTicketOut.reason);

assert(largeTicketOut.fires === true, "T4.fires", `expected true, got ${largeTicketOut.fires}`);
assert(
  largeTicketOut.triggers.includes("ticket_size_threshold"),
  "T4.triggers.ticket_size",
  `expected 'ticket_size_threshold' in triggers, got ${JSON.stringify(largeTicketOut.triggers)}`,
);

/* ---------------------------------------------------------------- */
/* Final report. */
/* ---------------------------------------------------------------- */

console.log("");
if (failures.length === 0) {
  console.log("OK: all materiality assertions passed.");
  process.exit(0);
} else {
  console.error(`FAILED: ${failures.length} assertion(s) failed.`);
  for (const f of failures) {
    console.error(`  - ${f.name}: ${f.detail}`);
  }
  process.exit(1);
}
