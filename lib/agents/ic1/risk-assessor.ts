/* IC1.RiskAssessor sub-agent runner.
 *
 * Skill: agents/ic1_risk_assessor.md
 *
 * Per Slice 4 orientation Q3, the Risk Assessor fires in Step 1 (in
 * parallel with the Chair). It evaluates structural and concentration
 * risk on the proposal and produces an evaluation alongside specific
 * named risks.
 *
 * Per Slice 4 orientation Q5, the Risk Assessor consumes M0.IndianContext
 * output when available (for tax-amplified risk readings) and tolerates
 * empty IndianContext by emitting "context not yet available" sentinels
 * in the relevant places. Today the IndianContext is null per the Slice
 * 3 soft-dependency; the prompt instructs the model to acknowledge that
 * explicitly rather than hallucinate IndianContext-driven readings.
 */

import { callAgent, type AgentCallResult } from "../harness";
import {
  formatCaseContextHeader,
  type CaseAgentContext,
} from "../case/case-context";
import type { CaseEvidenceVerdict } from "../case/case-verdict";
import type { GateResult } from "../case/governance/types";
import type {
  BriefingCaseContent,
  SynthesisVerdictSection,
} from "../case/briefing-case-content";
import type { MaterialityOutput } from "../materiality";
import type { StructuredBullet } from "./types";

export type RiskAssessorOutput = {
  evaluation: string[];
  specific_risks: StructuredBullet[];
};

export type RiskAssessorInput = {
  ctx: CaseAgentContext;
  synthesis: SynthesisVerdictSection;
  briefing: BriefingCaseContent;
  evidence: CaseEvidenceVerdict[];
  gates: GateResult[];
  materiality: MaterialityOutput;
};

function buildPrompt(input: RiskAssessorInput): string {
  return [
    "# IC1.RiskAssessor contribution request",
    "",
    "## Case context",
    "",
    formatCaseContextHeader(input.ctx),
    "",
    "## Materiality assessment (why IC1 is activated)",
    "",
    "```json",
    JSON.stringify(input.materiality, null, 2),
    "```",
    "",
    "## S1 synthesis verdict",
    "",
    "```json",
    JSON.stringify(input.synthesis, null, 2),
    "```",
    "",
    "## Governance gate results",
    "",
    "```json",
    JSON.stringify(input.gates, null, 2),
    "```",
    "",
    "## Evidence verdicts",
    "",
    "```json",
    JSON.stringify(input.evidence, null, 2),
    "```",
    "",
    "## Your output (renderer shape)",
    "",
    `Produce a two-to-three paragraph evaluation that names the structural, concentration, and timing risks the committee should weigh. Surface specific risks as discrete bullets each with a short title and a one-or-two sentence body. ${
      input.ctx.indianContext
        ? "Where the INDIAN CONTEXT block in the case context informs a tax-amplified or regulatory-driven risk reading (surcharge interaction, lock-in or liquidity-window exposure, structure eligibility, a time-aware regulatory event), ground that bullet in the cited entry. Treat any framing flagged confidence=indicative as practitioner practice, not authoritative."
        : "Where M0.IndianContext would have informed a tax-amplified or regulatory-driven risk reading, mark that bullet's body with the literal sentinel string `context_not_yet_available` instead of hallucinating IndianContext-driven content; the integration is pending Workstream C YAML curation per DEFERRED item 6."
    }`,
    "",
    "Return a single fenced JSON block with this exact shape:",
    "",
    "```json",
    "{",
    `  "evaluation": ["<paragraph 1>", "<paragraph 2>", "<optional paragraph 3>"],`,
    `  "specific_risks": [`,
    `    { "title": "<short risk name; sentence case>", "body": "<one-or-two-sentence description; cite specific evidence or gate; institutional voice>" }`,
    `  ]`,
    "}",
    "```",
    "",
    "## Discipline",
    "",
    "- Specific risks only, no boilerplate. Each bullet anchors in a specific evidence flag, gate gap, or stress-test scenario.",
    "- Calibrate. Distinguish structural risks (mandate breach trajectories, concentration creation) from cycle-positioning risks (FMCG softness, NIM compression) from manager-specific risks (capacity decay, key-person dependency).",
    "- Acknowledge what is not yet quantifiable. If a stress test would require data not in the bundle, name the data gap rather than speculate.",
    "- Institutional voice. Calm, deterministic, no decision language. The Risk Assessor evaluates; the Risk Assessor does not decide.",
    "- No prose outside the fenced JSON block.",
  ].join("\n");
}

function validateBullets(raw: unknown, ownerLabel: string): StructuredBullet[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${ownerLabel} must be an array`);
  }
  const out: StructuredBullet[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      throw new Error(`${ownerLabel} entries must be objects`);
    }
    const b = item as Record<string, unknown>;
    if (typeof b.title !== "string" || b.title.trim().length === 0) {
      throw new Error(`${ownerLabel} entry title missing or empty`);
    }
    if (typeof b.body !== "string" || b.body.trim().length === 0) {
      throw new Error(`${ownerLabel} entry body missing or empty`);
    }
    out.push({ title: b.title, body: b.body });
  }
  return out;
}

function validate(raw: unknown): RiskAssessorOutput {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("IC1.RiskAssessor output is not an object");
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.evaluation) || o.evaluation.length === 0) {
    throw new Error("IC1.RiskAssessor output.evaluation must be a non-empty string array");
  }
  for (const p of o.evaluation) {
    if (typeof p !== "string" || p.trim().length === 0) {
      throw new Error("IC1.RiskAssessor output.evaluation entries must be non-empty strings");
    }
  }
  const specific_risks = validateBullets(o.specific_risks, "IC1.RiskAssessor output.specific_risks");
  return { evaluation: o.evaluation as string[], specific_risks };
}

export function runIC1RiskAssessor(
  input: RiskAssessorInput,
  opts: { stubKey?: { caseFixtureId: string } } = {},
): Promise<AgentCallResult<RiskAssessorOutput>> {
  return callAgent<RiskAssessorOutput>({
    skillId: "ic1_risk_assessor",
    userPrompt: buildPrompt(input),
    validate,
    stubKey: opts.stubKey,
  });
}
