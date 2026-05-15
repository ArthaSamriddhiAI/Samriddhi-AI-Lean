/* IC1.Chair sub-agent runner.
 *
 * Skill: agents/ic1_chair.md
 *
 * Per Slice 4 orientation Q3, the Chair fires in Step 1 (in parallel with
 * the Risk Assessor). It receives the case context, gates, evidence,
 * synthesis, and materiality output; it produces the framing paragraphs
 * and the single central deliberation question that anchors the rest of
 * the deliberation.
 *
 * The skill body is the system prompt; the user prompt here projects the
 * case context into the role's framing input and asks for the
 * orientation-Q2 renderer shape (not the skill's richer authoring
 * schema). The skill's voice is preserved via the system prompt; the
 * user prompt constrains output to what the Outcome tab and Analyst
 * Reports memo will render.
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

export type ChairOutput = {
  framing: string[];
  deliberation_question: string;
};

export type ChairInput = {
  ctx: CaseAgentContext;
  synthesis: SynthesisVerdictSection;
  briefing: BriefingCaseContent;
  evidence: CaseEvidenceVerdict[];
  gates: GateResult[];
  materiality: MaterialityOutput;
};

function buildPrompt(input: ChairInput): string {
  return [
    "# IC1.Chair contribution request",
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
    "## S1 synthesis verdict (under deliberation)",
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
    "## Evidence verdicts (the bundle synthesis consumed)",
    "",
    "```json",
    JSON.stringify(input.evidence, null, 2),
    "```",
    "",
    "## Your output (renderer shape)",
    "",
    "Produce two-to-three paragraphs of framing that set up the deliberation, and a single central deliberation question per the IC1.Chair skill's Output 1 discipline. Do not include the chair's note, deliberation sequence, outcome, or confidence here; those belong to the Minutes Recorder. This response is the framing input the rest of the committee deliberates against.",
    "",
    "Return a single fenced JSON block with this exact shape:",
    "",
    "```json",
    "{",
    `  "framing": ["<paragraph 1>", "<paragraph 2>", "<optional paragraph 3>"],`,
    `  "deliberation_question": "<one single sentence ending in a question mark; specific to this case; captures the decision tension>"`,
    "}",
    "```",
    "",
    "## Discipline",
    "",
    "- Specificity: the framing names the specific tensions surfaced by the materiality assessment and the synthesis (mandate-fit vs product-fit, behavioural pattern vs structural soundness, etc.). Generic framing reads as boilerplate; ground in the actual evidence.",
    "- Single deliberation question: not multi-part. If the case has multiple tensions, pick the central one and frame the others as part of the framing paragraphs.",
    "- Institutional voice. Calm, deterministic, no decision language. The chair frames; the chair does not decide.",
    "- No prose outside the fenced JSON block.",
  ].join("\n");
}

function validate(raw: unknown): ChairOutput {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("IC1.Chair output is not an object");
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.framing) || o.framing.length === 0) {
    throw new Error("IC1.Chair output.framing must be a non-empty string array");
  }
  for (const p of o.framing) {
    if (typeof p !== "string" || p.trim().length === 0) {
      throw new Error("IC1.Chair output.framing entries must be non-empty strings");
    }
  }
  if (
    typeof o.deliberation_question !== "string" ||
    o.deliberation_question.trim().length === 0
  ) {
    throw new Error("IC1.Chair output.deliberation_question must be a non-empty string");
  }
  return {
    framing: o.framing as string[],
    deliberation_question: o.deliberation_question,
  };
}

export function runIC1Chair(
  input: ChairInput,
  opts: { stubKey?: { caseFixtureId: string } } = {},
): Promise<AgentCallResult<ChairOutput>> {
  return callAgent<ChairOutput>({
    skillId: "ic1_chair",
    userPrompt: buildPrompt(input),
    validate,
    stubKey: opts.stubKey,
  });
}
