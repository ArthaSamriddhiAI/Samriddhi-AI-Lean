/* IC1.DevilsAdvocate sub-agent runner.
 *
 * Skill: agents/ic1_devils_advocate.md
 *
 * Per Slice 4 orientation Q3, Devil's Advocate fires in Step 2,
 * consuming the case context plus the Chair's framing and central
 * deliberation question. It surfaces the structural counter-arguments
 * that push back on consensus reasoning.
 *
 * Scope distinction from A1 (Slice 4 scoping confirmation, Q3):
 *   A1 challenges what the synthesis says (questions for the advisor
 *     conversation with the investor).
 *   Devil's Advocate challenges what the committee should conclude
 *     (challenges the committee should resolve before approval).
 * The user prompt names this distinction explicitly so the model's
 * output does not duplicate A1's question framing.
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
import type { ChairOutput } from "./chair";
import type { StructuredBullet } from "./types";

export type DevilsAdvocateOutput = {
  position: string[];
  specific_challenges: StructuredBullet[];
};

export type DevilsAdvocateInput = {
  ctx: CaseAgentContext;
  synthesis: SynthesisVerdictSection;
  briefing: BriefingCaseContent;
  evidence: CaseEvidenceVerdict[];
  gates: GateResult[];
  materiality: MaterialityOutput;
  chair: ChairOutput;
};

function buildPrompt(input: DevilsAdvocateInput): string {
  return [
    "# IC1.DevilsAdvocate contribution request",
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
    "## Chair's framing and deliberation question (your input)",
    "",
    "```json",
    JSON.stringify(input.chair, null, 2),
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
    "Produce a two-to-three paragraph position that argues the strongest case against the proposal as currently framed, and a list of specific challenges the committee should resolve before approval. Each challenge is a discrete bullet with a short title and a one-or-two sentence body grounded in the chair's framing.",
    "",
    "Scope discipline: your contribution is distinct from A1's advisory challenges. A1 surfaces questions the synthesis should be ready to answer in the advisor's conversation with the investor. You surface the challenges the committee should resolve before approval. Do not duplicate A1's framing; complement it.",
    "",
    "Return a single fenced JSON block with this exact shape:",
    "",
    "```json",
    "{",
    `  "position": ["<paragraph 1>", "<paragraph 2>", "<optional paragraph 3>"],`,
    `  "specific_challenges": [`,
    `    { "title": "<short challenge headline; sentence case>", "body": "<one-or-two-sentence challenge stated as a position; institutional voice; cite specific evidence>" }`,
    `  ]`,
    "}",
    "```",
    "",
    "## Discipline",
    "",
    "- Argue the strongest case against, not a strawman. Surface concerns the rest of the pipeline may have under-weighted.",
    "- Cite specific evidence. \"The proposal stretches the mandate\" is weak; \"the proposal places three G1 bands simultaneously at or beyond boundary, indicating the ticket was sized against product attractiveness rather than against the architecture\" is strong.",
    "- Calibrate severity. Distinguish structural concerns from timing concerns from behavioural concerns.",
    "- Honor sub-role boundaries. The Risk Assessor handles stress-testing; the Counterfactual Engine evaluates alternatives; you provide adversarial framing.",
    "- Institutional voice. Calm, deterministic, no rhetoric. The Devil's Advocate argues; the Devil's Advocate does not decide.",
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

function validate(raw: unknown): DevilsAdvocateOutput {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("IC1.DevilsAdvocate output is not an object");
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.position) || o.position.length === 0) {
    throw new Error("IC1.DevilsAdvocate output.position must be a non-empty string array");
  }
  for (const p of o.position) {
    if (typeof p !== "string" || p.trim().length === 0) {
      throw new Error("IC1.DevilsAdvocate output.position entries must be non-empty strings");
    }
  }
  const specific_challenges = validateBullets(
    o.specific_challenges,
    "IC1.DevilsAdvocate output.specific_challenges",
  );
  return { position: o.position as string[], specific_challenges };
}

export function runIC1DevilsAdvocate(
  input: DevilsAdvocateInput,
  opts: { stubKey?: { caseFixtureId: string } } = {},
): Promise<AgentCallResult<DevilsAdvocateOutput>> {
  return callAgent<DevilsAdvocateOutput>({
    skillId: "ic1_devils_advocate",
    userPrompt: buildPrompt(input),
    validate,
    stubKey: opts.stubKey,
  });
}
