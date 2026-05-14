/* Samriddhi 1 briefing content shape (seven sections).
 *
 * Mirrors Slice 3 orientation Q1's seven-section structure. The shape is
 * the same as Slice 2's diagnostic briefing in layout discipline but
 * carries verdict-shaped content. The case-detail screen renders this;
 * the briefing PDF renders this; Case.contentJson persists this.
 *
 * Ownership split between S1 and orchestrator:
 *   S1.case_mode authors sections 1, 2, 3, 6, 7 (LLM synthesis).
 *   Orchestrator builds section 4 from gate results (deterministic).
 *   Orchestrator pastes section 5 from A1 output (separate LLM call).
 *
 * The full BriefingCaseContent is what gets persisted; S1CaseOutput is
 * the strict subset S1's LLM call produces, before the orchestrator
 * merges in sections 4 and 5.
 */

import type { CaseRiskLevel } from "./case-verdict";
import type { CaseIntent, DominantLens } from "@/lib/format/case-intent";
import type { GateResult } from "./governance/types";

/* Overall verdict on the proposal. Maps to advisor-facing decision posture:
 *   positive               — the action is defensible end-to-end; proceed
 *   positive_with_caveat   — defensible with specific considerations to raise
 *   neutral                — no clear signal either way; advisor judgement
 *   neutral_with_caveat    — neutral with specific considerations
 *   negative               — the action is not defensible on current evidence
 *   requires_clarification — synthesis cannot conclude without specific input
 */
export type OverallCaseVerdict =
  | "positive"
  | "positive_with_caveat"
  | "neutral"
  | "neutral_with_caveat"
  | "negative"
  | "requires_clarification";

export type ProposalSummarySection = {
  paragraph: string;
};

export type SynthesisVerdictSection = {
  overall_verdict: OverallCaseVerdict;
  overall_risk_level: CaseRiskLevel;
  /** 0.0–1.0 */
  confidence: number;
  /** Where the evidence agents and gates broadly agree. */
  consensus_areas: string[];
  /** Where the evidence agents materially disagree. Honest surfacing,
   * not averaging. */
  conflict_areas: string[];
  /** Where two moderate concerns combine into one material concern. */
  amplification_flags: string[];
  /** Narrative paragraph tying the synthesis together. Institutional
   * voice, no decision language, anchored in the mandate. */
  narrative_paragraph: string;
  /** Structured counterfactual framing per the s1_case_mode skill
   * Output 5. */
  counterfactual_framing: string;
  /** True when synthesis surfaces a structural concern S1 cannot
   * resolve at its layer (mandate vs evidence contradiction, data
   * gap, agent escalation cascade). Per the skill Output 6. */
  escalation_recommended: boolean;
};

export type EvidenceSummaryItem = {
  agent_id: string;
  activation_status: "activated" | "not_activated";
  /** Set for activated agents. */
  risk_level?: CaseRiskLevel;
  /** S1-authored one-line takeaway compressing the verdict for the
   * briefing. The full verdict lives in the Analyst Reports tab. */
  one_line_takeaway: string;
};

export type GovernanceStatusItem = {
  gate_id: GateResult["gate_id"];
  status: GateResult["status"];
  /** One-line subtitle the Case Detail pill renders. Pulled verbatim
   * from the gate result's rationale field. */
  rationale: string;
};

export type AdvisoryChallengeItem = {
  category: "counter_argument" | "stress_test" | "edge_case";
  title: string;
  body: string;
};

export type TalkingPoint = {
  number: string;
  title: string;
  body: string;
};

export type CoverageMethodologyNote = {
  case_intent: CaseIntent;
  dominant_lens: DominantLens;
  agents_activated: string[];
  agents_not_activated: string[];
  data_sufficiency_notes: string;
  generation_mode: "stub" | "live" | "hybrid";
  generation_timestamp: string;
};

/* What S1.case_mode's LLM call produces. Sections S1 owns. */
export type S1CaseOutput = {
  section_1_proposal_summary: ProposalSummarySection;
  section_2_synthesis_verdict: SynthesisVerdictSection;
  section_3_evidence_summary: EvidenceSummaryItem[];
  section_6_talking_points: TalkingPoint[];
  section_7_coverage_methodology_note: CoverageMethodologyNote;
};

/* Full seven-section briefing. The orchestrator assembles by merging
 * S1CaseOutput with sections 4 (governance, deterministic from gate
 * results) and 5 (advisory challenges, A1 output). */
export type BriefingCaseContent = S1CaseOutput & {
  section_4_governance_status: GovernanceStatusItem[];
  section_5_advisory_challenges: AdvisoryChallengeItem[];
};
