/* IC1.CounterfactualEngine sub-agent runner.
 *
 * Skill: agents/ic1_counterfactual_engine.md
 *
 * Per Slice 4 orientation Q3, the Counterfactual Engine fires in Step
 * 3, consuming the case context plus the Risk Assessor's specific
 * risks. It produces alternative paths that specifically address the
 * risks named.
 *
 * Per Slice 4 orientation Q4, the Counterfactual Engine's structured
 * alternative paths supersede S1's counterfactual_framing when IC1
 * fires. The Outcome tab's counterfactual section reads from this
 * payload when ic1_deliberation.fires=true (commit 6 lands the
 * supersession logic; this commit lands the producer).
 *
 * Per Slice 4 orientation Q5, the Counterfactual Engine consumes
 * IndianContext when available (for tax-optimized alternative paths)
 * and tolerates empty IndianContext via "context not yet available"
 * sentinels.
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
import type { RiskAssessorOutput } from "./risk-assessor";
import type { StructuredAlternative } from "./types";

export type CounterfactualEngineOutput = {
  framing: string[];
  alternative_paths: StructuredAlternative[];
};

export type CounterfactualEngineInput = {
  ctx: CaseAgentContext;
  synthesis: SynthesisVerdictSection;
  briefing: BriefingCaseContent;
  evidence: CaseEvidenceVerdict[];
  gates: GateResult[];
  materiality: MaterialityOutput;
  risk_assessor: RiskAssessorOutput;
};

function buildPrompt(input: CounterfactualEngineInput): string {
  return [
    "# IC1.CounterfactualEngine contribution request",
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
    "## Risk Assessor's evaluation and specific risks (your input)",
    "",
    "```json",
    JSON.stringify(input.risk_assessor, null, 2),
    "```",
    "",
    "## S1 synthesis verdict (including S1's existing counterfactual_framing)",
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
    "Produce a two-to-three paragraph framing of the alternative-paths question, and a structured list of alternative paths that specifically address the risks the Risk Assessor named. Your output supersedes S1's counterfactual_framing on the rendered Outcome tab when materiality fires.",
    "",
    "Where M0.IndianContext would have informed a tax-optimized alternative path, mark that path's description with the literal sentinel string `context_not_yet_available` instead of hallucinating IndianContext-driven content; the integration is pending Workstream C YAML curation per DEFERRED item 6.",
    "",
    "Return a single fenced JSON block with this exact shape:",
    "",
    "```json",
    "{",
    `  "framing": ["<paragraph 1>", "<paragraph 2>", "<optional paragraph 3>"],`,
    `  "alternative_paths": [`,
    `    { "label": "<short alternative name; sentence case>", "description": "<one-or-two-sentence description naming what changes and which risk it addresses; institutional voice>" }`,
    `  ]`,
    "}",
    "```",
    "",
    "## Discipline",
    "",
    "- Each alternative path addresses at least one of the Risk Assessor's specific risks; alternative paths that do not connect to a named risk are out of scope.",
    "- Alternatives are concrete, not abstract. \"Smaller ticket\" is weak; \"Rs 2.0-2.2 Cr ticket holding equity at the 70 percent ceiling and preserving debt above floor\" is strong.",
    "- Two-to-five paths is the right range. One reads as the synthesis re-stated; more than five reads as a kitchen sink.",
    "- Avoid duplicating S1's counterfactual_framing verbatim. Your shape carries more structure; use it.",
    "- Institutional voice. Calm, deterministic, no decision language. The Counterfactual Engine produces options; the Counterfactual Engine does not pick.",
    "- No prose outside the fenced JSON block.",
  ].join("\n");
}

function validateAlternatives(raw: unknown): StructuredAlternative[] {
  if (!Array.isArray(raw)) {
    throw new Error("IC1.CounterfactualEngine output.alternative_paths must be an array");
  }
  const out: StructuredAlternative[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      throw new Error("alternative_paths entries must be objects");
    }
    const a = item as Record<string, unknown>;
    if (typeof a.label !== "string" || a.label.trim().length === 0) {
      throw new Error("alternative_paths entry label missing or empty");
    }
    if (typeof a.description !== "string" || a.description.trim().length === 0) {
      throw new Error("alternative_paths entry description missing or empty");
    }
    out.push({ label: a.label, description: a.description });
  }
  return out;
}

function validate(raw: unknown): CounterfactualEngineOutput {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("IC1.CounterfactualEngine output is not an object");
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.framing) || o.framing.length === 0) {
    throw new Error("IC1.CounterfactualEngine output.framing must be a non-empty string array");
  }
  for (const p of o.framing) {
    if (typeof p !== "string" || p.trim().length === 0) {
      throw new Error("IC1.CounterfactualEngine output.framing entries must be non-empty strings");
    }
  }
  const alternative_paths = validateAlternatives(o.alternative_paths);
  return { framing: o.framing as string[], alternative_paths };
}

export function runIC1CounterfactualEngine(
  input: CounterfactualEngineInput,
  opts: { stubKey?: { caseFixtureId: string } } = {},
): Promise<AgentCallResult<CounterfactualEngineOutput>> {
  return callAgent<CounterfactualEngineOutput>({
    skillId: "ic1_counterfactual_engine",
    userPrompt: buildPrompt(input),
    validate,
    stubKey: opts.stubKey,
  });
}
