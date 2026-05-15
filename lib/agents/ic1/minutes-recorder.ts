/* IC1.MinutesRecorder sub-agent runner.
 *
 * Skill: agents/ic1_minutes_recorder.md
 *
 * Per Slice 4 orientation Q3, the Minutes Recorder fires last (Step 4),
 * consuming all four prior contributions (Chair, Devil's Advocate,
 * Risk Assessor, Counterfactual Engine). It produces the consolidated
 * executive summary that renders as the default-visible block on the
 * Outcome tab; per-role contributions expand from below.
 *
 * Two-to-three paragraphs is the orientation target. The summary
 * synthesises the deliberation rather than transcribing it.
 */

import { callAgent, type AgentCallResult } from "../harness";
import {
  formatCaseContextHeader,
  type CaseAgentContext,
} from "../case/case-context";
import type {
  BriefingCaseContent,
  SynthesisVerdictSection,
} from "../case/briefing-case-content";
import type { MaterialityOutput } from "../materiality";
import type { ChairOutput } from "./chair";
import type { DevilsAdvocateOutput } from "./devils-advocate";
import type { RiskAssessorOutput } from "./risk-assessor";
import type { CounterfactualEngineOutput } from "./counterfactual-engine";

export type MinutesRecorderOutput = {
  summary: string[];
};

export type MinutesRecorderInput = {
  ctx: CaseAgentContext;
  synthesis: SynthesisVerdictSection;
  briefing: BriefingCaseContent;
  materiality: MaterialityOutput;
  chair: ChairOutput;
  devils_advocate: DevilsAdvocateOutput;
  risk_assessor: RiskAssessorOutput;
  counterfactual_engine: CounterfactualEngineOutput;
};

function buildPrompt(input: MinutesRecorderInput): string {
  return [
    "# IC1.MinutesRecorder contribution request",
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
    "## Chair's framing",
    "",
    "```json",
    JSON.stringify(input.chair, null, 2),
    "```",
    "",
    "## Risk Assessor's evaluation",
    "",
    "```json",
    JSON.stringify(input.risk_assessor, null, 2),
    "```",
    "",
    "## Devil's Advocate's position",
    "",
    "```json",
    JSON.stringify(input.devils_advocate, null, 2),
    "```",
    "",
    "## Counterfactual Engine's alternative paths",
    "",
    "```json",
    JSON.stringify(input.counterfactual_engine, null, 2),
    "```",
    "",
    "## Your output (renderer shape)",
    "",
    "Produce two or three paragraphs that consolidate the deliberation into the executive read. This summary renders by default on the Outcome tab; the per-role contributions expand from below. The summary should:",
    "  - Name the central deliberation question (from the Chair) in the first paragraph.",
    "  - Synthesise the Risk Assessor's evaluation, the Devil's Advocate's position, and the Counterfactual Engine's alternative paths into one institutional read; do not list them as separate transcripts.",
    "  - Where the sub-roles diverge materially, acknowledge the divergence explicitly.",
    "",
    "Return a single fenced JSON block with this exact shape:",
    "",
    "```json",
    "{",
    `  "summary": ["<paragraph 1>", "<paragraph 2>", "<optional paragraph 3>"]`,
    "}",
    "```",
    "",
    "## Discipline",
    "",
    "- Synthesise, do not transcribe. The summary integrates positions; it does not list them.",
    "- Two-to-three paragraphs. A single paragraph reads as too thin; four or more dilutes the executive register.",
    "- Institutional voice. Calm, deterministic, no decision language. The Minutes Recorder records; the Minutes Recorder does not decide.",
    "- No prose outside the fenced JSON block.",
  ].join("\n");
}

function validate(raw: unknown): MinutesRecorderOutput {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("IC1.MinutesRecorder output is not an object");
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.summary) || o.summary.length === 0) {
    throw new Error("IC1.MinutesRecorder output.summary must be a non-empty string array");
  }
  for (const p of o.summary) {
    if (typeof p !== "string" || p.trim().length === 0) {
      throw new Error("IC1.MinutesRecorder output.summary entries must be non-empty strings");
    }
  }
  return { summary: o.summary as string[] };
}

export function runIC1MinutesRecorder(
  input: MinutesRecorderInput,
  opts: { stubKey?: { caseFixtureId: string } } = {},
): Promise<AgentCallResult<MinutesRecorderOutput>> {
  return callAgent<MinutesRecorderOutput>({
    skillId: "ic1_minutes_recorder",
    userPrompt: buildPrompt(input),
    validate,
    stubKey: opts.stubKey,
  });
}
