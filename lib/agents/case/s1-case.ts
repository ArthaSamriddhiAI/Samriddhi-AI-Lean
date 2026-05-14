/* S1.case_mode synthesis.
 *
 * Skill: agents/s1_case_mode.md
 *
 * Per Slice 2 Q2 pattern (extended to Slice 3): the skill's authored
 * output schema is six-output synthesis (consensus, conflict, uncertainty,
 * mode-dominance, counterfactual, escalation). The lean MVP briefing is
 * the orientation Q1 seven-section structure. Use the skill prompt body
 * as the system prompt unchanged (voice, no-decision discipline, mandate
 * anchoring all apply); instruct the model at runtime to return five of
 * the seven sections (1, 2, 3, 6, 7 — those S1 owns), folding the skill's
 * six synthesis outputs into section 2's SynthesisVerdictSection shape.
 *
 * Sections 4 (governance) and 5 (advisory challenges) are added by the
 * orchestrator (commit 9): section 4 from G1/G2/G3 results
 * deterministically; section 5 from A1's output (commit 7).
 *
 * Output type: S1CaseOutput. Orchestrator merges with sections 4 and 5
 * to produce the full BriefingCaseContent.
 */

import { callAgent, type AgentCallResult } from "../harness";
import { formatCaseContextHeader, type CaseAgentContext } from "./case-context";
import type { CaseEvidenceVerdict, CaseRiskLevel } from "./case-verdict";
import type { GateResult } from "./governance/types";
import type {
  S1CaseOutput,
  OverallCaseVerdict,
  EvidenceSummaryItem,
} from "./briefing-case-content";

const OVERALL_VERDICTS: OverallCaseVerdict[] = [
  "positive",
  "positive_with_caveat",
  "neutral",
  "neutral_with_caveat",
  "negative",
  "requires_clarification",
];

const RISK_LEVELS: CaseRiskLevel[] = ["low", "moderate", "elevated", "high"];

export type S1CaseInput = {
  ctx: CaseAgentContext;
  evidence_verdicts: CaseEvidenceVerdict[];
  gate_results: GateResult[];
  generation_mode: "stub" | "live" | "hybrid";
};

function buildPrompt(input: S1CaseInput): string {
  return [
    `# S1.case_mode Synthesis Request`,
    ``,
    `## Case context`,
    ``,
    formatCaseContextHeader(input.ctx),
    ``,
    `## Evidence verdicts (E1-E7)`,
    ``,
    `Each agent produced a verdict in the proposal-evaluation shape (activation_status, risk_level, drivers, flags, reasoning, data points). Non-activated agents carry a reason_for_non_activation string. Read the full bundle and synthesise; surface consensus, conflicts, and amplification. Do not average across domains.`,
    ``,
    "```json",
    JSON.stringify(input.evidence_verdicts, null, 2),
    "```",
    ``,
    `## Governance gate results (G1, G2, G3)`,
    ``,
    `Deterministic rule outputs. The synthesis must reflect any gate that did not return "pass": a fail surfaces as a structural blocker; a requires_clarification surfaces as an explicit clarification need with the specific gap cited.`,
    ``,
    "```json",
    JSON.stringify(input.gate_results, null, 2),
    "```",
    ``,
    `## Output schema (runtime override of the skill's authored shape)`,
    ``,
    `Return a single fenced JSON block with this exact shape. The skill's six synthesis outputs (consensus, conflict, uncertainty, mode-dominance, counterfactual, escalation) fold into section 2's SynthesisVerdictSection. The skill's voice and discipline apply: institutional register, declarative, evidence-grounded, no hedging, no decision language ("we recommend", "you should").`,
    ``,
    "```json",
    `{`,
    `  "section_1_proposal_summary": {`,
    `    "paragraph": "<one paragraph: who is the investor, what the action is, the amount, the timeline, the mandate context, the post-action portfolio framing. Avoid decision language.>"`,
    `  },`,
    `  "section_2_synthesis_verdict": {`,
    `    "overall_verdict": "<${OVERALL_VERDICTS.join(" | ")}>",`,
    `    "overall_risk_level": "<${RISK_LEVELS.join(" | ")}>",`,
    `    "confidence": <0.0-1.0>,`,
    `    "consensus_areas": ["<short strings naming where the evidence agents and gates broadly agree>"],`,
    `    "conflict_areas": ["<short strings naming where they materially disagree; cite the agents and the dimension>"],`,
    `    "amplification_flags": ["<short strings naming where two moderate concerns combine into one material concern>"],`,
    `    "narrative_paragraph": "<one paragraph synthesising the verdict; anchor in the mandate; cite specific evidence points; do not propose actions>",`,
    `    "counterfactual_framing": "<one or two sentences naming the structured alternative to the proposed action; not a recommendation>",`,
    `    "escalation_recommended": <true | false>`,
    `  },`,
    `  "section_3_evidence_summary": [`,
    `    {`,
    `      "agent_id": "<one of e1_listed_fundamental_equity, e2_industry_business, e3_macro_policy_news, e4_behavioural_historical, e5_unlisted_equity, e6_pms_aif_sif, e7_mutual_fund>",`,
    `      "activation_status": "<activated | not_activated>",`,
    `      "risk_level": "<low | moderate | elevated | high — only when activated>",`,
    `      "one_line_takeaway": "<single declarative sentence compressing the verdict for the briefing; full reasoning lives in the Analyst Reports tab>"`,
    `    }`,
    `  ],`,
    `  "section_6_talking_points": [`,
    `    { "number": "01", "title": "<short headline>", "body": "<conversation opener for the advisor; collegial voice; not a recommendation>" }`,
    `  ],`,
    `  "section_7_coverage_methodology_note": {`,
    `    "case_intent": "${input.ctx.proposal.action_type}",`,
    `    "dominant_lens": "<portfolio_shift | proposal_evaluation | context_dependent>",`,
    `    "agents_activated": ["<list of agent_ids that produced activated verdicts>"],`,
    `    "agents_not_activated": ["<list of agent_ids that produced non_activated verdicts>"],`,
    `    "data_sufficiency_notes": "<one paragraph on what the synthesis could and could not see; mention IndianContext integration state if relevant>",`,
    `    "generation_mode": "${input.generation_mode}",`,
    `    "generation_timestamp": "<ISO timestamp>"`,
    `  }`,
    `}`,
    "```",
    ``,
    `## Synthesis discipline`,
    ``,
    `- Consensus is NOT averaging. Different agents have different domains; weight by case_intent (for new_investment of a wrapper, E6 is dominant; for behavioural-driven cases, E4 weighted heavily).`,
    `- Surface conflicts honestly. If E1 reads positive and E4 reads cautionary on the same action, name both and the dimension of disagreement; do not paper over.`,
    `- Identify amplification. If E6 flags "equity_band_at_upper_boundary" AND E4 flags "wrapper_count_accumulation_pattern", the combination is materially more significant than either alone — surface as an amplification flag.`,
    `- Section 6 talking points open conversations; they are not recommendations. Match the foundation §6 voice ("Macro context broadly supports moving FD capital into equity, but the rate cycle has done most of its work" rather than "We recommend deploying to equity").`,
    `- Section 3 evidence summary compresses each verdict into one line. The Analyst Reports tab on the Case Detail screen carries the full verdict; the briefing carries the compressed roll-up.`,
    `- Section 7 generation_mode is "${input.generation_mode}"; copy verbatim. generation_timestamp is the current ISO timestamp.`,
    ``,
    `Respond with a single fenced JSON block. No prose outside the fence.`,
  ].join("\n");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x) => typeof x === "string");
}

function validate(raw: unknown): S1CaseOutput {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("S1.case_mode output is not an object");
  }
  const o = raw as Record<string, unknown>;
  const required = [
    "section_1_proposal_summary",
    "section_2_synthesis_verdict",
    "section_3_evidence_summary",
    "section_6_talking_points",
    "section_7_coverage_methodology_note",
  ];
  for (const k of required) {
    if (!(k in o)) throw new Error(`S1.case_mode output missing required field: ${k}`);
  }

  const s1 = o.section_1_proposal_summary as Record<string, unknown>;
  if (typeof s1?.paragraph !== "string" || s1.paragraph.trim().length === 0) {
    throw new Error("section_1_proposal_summary.paragraph missing or empty");
  }

  const s2 = o.section_2_synthesis_verdict as Record<string, unknown>;
  if (typeof s2?.overall_verdict !== "string" || !OVERALL_VERDICTS.includes(s2.overall_verdict as OverallCaseVerdict)) {
    throw new Error(`section_2_synthesis_verdict.overall_verdict invalid: ${s2?.overall_verdict}`);
  }
  if (typeof s2?.overall_risk_level !== "string" || !RISK_LEVELS.includes(s2.overall_risk_level as CaseRiskLevel)) {
    throw new Error(`section_2_synthesis_verdict.overall_risk_level invalid: ${s2?.overall_risk_level}`);
  }
  if (typeof s2?.confidence !== "number" || s2.confidence < 0 || s2.confidence > 1) {
    throw new Error(`section_2_synthesis_verdict.confidence invalid: ${s2?.confidence}`);
  }
  if (!isStringArray(s2?.consensus_areas) || !isStringArray(s2?.conflict_areas) || !isStringArray(s2?.amplification_flags)) {
    throw new Error("section_2_synthesis_verdict consensus / conflict / amplification arrays must be string arrays");
  }
  if (typeof s2?.narrative_paragraph !== "string" || s2.narrative_paragraph.trim().length === 0) {
    throw new Error("section_2_synthesis_verdict.narrative_paragraph missing or empty");
  }
  if (typeof s2?.counterfactual_framing !== "string") {
    throw new Error("section_2_synthesis_verdict.counterfactual_framing missing");
  }
  if (typeof s2?.escalation_recommended !== "boolean") {
    throw new Error("section_2_synthesis_verdict.escalation_recommended must be boolean");
  }

  if (!Array.isArray(o.section_3_evidence_summary)) {
    throw new Error("section_3_evidence_summary must be an array");
  }
  for (const item of o.section_3_evidence_summary as unknown[]) {
    const e = item as Record<string, unknown>;
    if (typeof e.agent_id !== "string" || typeof e.activation_status !== "string" || typeof e.one_line_takeaway !== "string") {
      throw new Error("section_3_evidence_summary item shape invalid");
    }
  }

  if (!Array.isArray(o.section_6_talking_points)) {
    throw new Error("section_6_talking_points must be an array");
  }

  const s7 = o.section_7_coverage_methodology_note as Record<string, unknown>;
  if (typeof s7?.case_intent !== "string" || typeof s7?.dominant_lens !== "string") {
    throw new Error("section_7_coverage_methodology_note case_intent / dominant_lens missing");
  }
  if (typeof s7?.generation_mode !== "string") {
    throw new Error("section_7_coverage_methodology_note generation_mode missing");
  }

  return o as unknown as S1CaseOutput;
}

export function runS1Case(
  input: S1CaseInput,
  opts: { stubKey?: { caseFixtureId: string } } = {},
): Promise<AgentCallResult<S1CaseOutput>> {
  return callAgent<S1CaseOutput>({
    skillId: "s1_case_mode",
    userPrompt: buildPrompt(input),
    validate,
    stubKey: opts.stubKey,
  });
}

/* Helper: build section 3 from raw evidence verdicts deterministically.
 * S1 authors the one_line_takeaway via LLM; this helper is for cases
 * where the orchestrator wants a fallback when stubs are missing the
 * compressed roll-up. Not used in the LLM path, retained for the
 * deterministic fallback in commit 9's stub-parsing logic. */
export function buildEvidenceSummaryFallback(
  verdicts: CaseEvidenceVerdict[],
): EvidenceSummaryItem[] {
  return verdicts.map((v) => {
    if (v.activation_status === "activated") {
      const driverSummary = v.drivers[0] ?? "see Analyst Reports tab";
      return {
        agent_id: v.agent_id,
        activation_status: "activated",
        risk_level: v.risk_level,
        one_line_takeaway: `${v.risk_level} risk: ${driverSummary}`,
      };
    }
    return {
      agent_id: v.agent_id,
      activation_status: "not_activated",
      one_line_takeaway: v.reason_for_non_activation.split(".")[0] + ".",
    };
  });
}
