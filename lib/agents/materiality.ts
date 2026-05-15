/* Materiality threshold rule evaluator.
 *
 * Deterministic function that decides whether IC1 deliberation activates
 * on a Samriddhi 1 (proposal-evaluation) case. Per Slice 4 orientation Q1,
 * IC1 fires when ANY of four conditions hold; otherwise materiality is
 * "not reached" and the case proceeds to advisor decision without
 * committee deliberation.
 *
 * No LLM; pure rule evaluation. The output is persisted on case.content
 * under `materiality`; the Outcome tab surfaces it both when fires=true
 * (activating IC1 deliberation) and when fires=false (institutional
 * audit-trail reason).
 *
 * The orchestrator (pipeline-case.ts) calls this only for Samriddhi 1
 * cases; Samriddhi 2 diagnostic cases never reach this evaluator per
 * the slice boundary.
 *
 * Severity-flag interpretation note: orientation Q1 references "severity
 * = flag or escalate in any E1-E7 output". The Samriddhi 1 evidence
 * verdict schema (case-verdict.ts) uses risk_level rather than a
 * severity field; the natural translation is risk_level ∈ {elevated,
 * high}. Recorded as an autonomous decision in BUILD_NOTES_SLICE_4.
 */

import type { CaseEvidenceVerdict, ActivatedVerdict } from "./case/case-verdict";
import type { GateResult } from "./case/governance/types";
import type { SynthesisVerdictSection } from "./case/briefing-case-content";

export type MaterialityTrigger =
  | "gate_blocked"
  | "verdict_with_severity_flag"
  | "verdict_with_low_confidence"
  | "verdict_with_band_gaps"
  | "ticket_size_threshold"
  | "amplification_compound";

export type MaterialityOutput = {
  fires: boolean;
  reason: string;
  triggers: MaterialityTrigger[];
};

export type MaterialityInput = {
  synthesis: SynthesisVerdictSection;
  gates: GateResult[];
  evidence: CaseEvidenceVerdict[];
  ticketSizeCr: number;
};

/* Thresholds locked in orientation Q1. */
export const MATERIALITY_TICKET_THRESHOLD_CR = 5;
export const MATERIALITY_LOW_CONFIDENCE_THRESHOLD = 0.8;
export const MATERIALITY_AMPLIFICATION_THRESHOLD = 3;
export const MATERIALITY_G1_BAND_GAP_THRESHOLD = 2;

const SEVERITY_RISK_LEVELS: ReadonlySet<ActivatedVerdict["risk_level"]> = new Set([
  "elevated",
  "high",
]);

const ELEVATED_VERDICTS: ReadonlySet<SynthesisVerdictSection["overall_verdict"]> = new Set([
  "requires_clarification",
  "negative",
]);

export function evaluateMateriality(input: MaterialityInput): MaterialityOutput {
  const triggers: MaterialityTrigger[] = [];
  const reasons: string[] = [];

  /* Condition 1: any governance gate failed (hard block escalates). */
  const failedGate = input.gates.find((g) => g.status === "fail");
  if (failedGate) {
    triggers.push("gate_blocked");
    reasons.push(
      `${gateLabel(failedGate.gate_id)} returned fail; hard block escalates to committee.`,
    );
  }

  /* Condition 2: verdict requires_clarification or stronger AND a
   * secondary signal (severity flag, low confidence, band gaps).
   * Each secondary signal is recorded as its own trigger so the
   * Outcome tab and Analyst Reports memo can name them specifically. */
  if (ELEVATED_VERDICTS.has(input.synthesis.overall_verdict)) {
    const verdictLabel = input.synthesis.overall_verdict.replace(/_/g, " ");
    const activatedAgents = input.evidence.filter(
      (e): e is ActivatedVerdict => e.activation_status === "activated",
    );
    const elevatedAgent = activatedAgents.find((a) => SEVERITY_RISK_LEVELS.has(a.risk_level));
    if (elevatedAgent) {
      triggers.push("verdict_with_severity_flag");
      reasons.push(
        `Verdict ${verdictLabel} with ${elevatedAgent.agent_id} at risk_level ${elevatedAgent.risk_level}.`,
      );
    }
    if (input.synthesis.confidence < MATERIALITY_LOW_CONFIDENCE_THRESHOLD) {
      triggers.push("verdict_with_low_confidence");
      reasons.push(
        `Verdict ${verdictLabel} at confidence ${input.synthesis.confidence.toFixed(2)} below ${MATERIALITY_LOW_CONFIDENCE_THRESHOLD.toFixed(2)} threshold.`,
      );
    }
    const g1Gate = input.gates.find((g) => g.gate_id === "g1_mandate");
    const g1BandGaps = g1Gate ? g1Gate.gaps.length : 0;
    if (g1BandGaps >= MATERIALITY_G1_BAND_GAP_THRESHOLD) {
      triggers.push("verdict_with_band_gaps");
      reasons.push(
        `Verdict ${verdictLabel} with ${g1BandGaps} simultaneous G1 band gaps.`,
      );
    }
  }

  /* Condition 3: ticket size institutional escalation threshold. */
  if (input.ticketSizeCr >= MATERIALITY_TICKET_THRESHOLD_CR) {
    triggers.push("ticket_size_threshold");
    reasons.push(
      `Ticket size Rs ${input.ticketSizeCr} Cr at or above the Rs ${MATERIALITY_TICKET_THRESHOLD_CR} Cr institutional escalation threshold.`,
    );
  }

  /* Condition 4: compound risk pattern in S1 amplification flags. */
  const ampFlagCount = input.synthesis.amplification_flags.length;
  if (ampFlagCount >= MATERIALITY_AMPLIFICATION_THRESHOLD) {
    triggers.push("amplification_compound");
    reasons.push(
      `${ampFlagCount} amplification flags in synthesis at or above the ${MATERIALITY_AMPLIFICATION_THRESHOLD}-flag compound-risk threshold.`,
    );
  }

  if (triggers.length === 0) {
    return {
      fires: false,
      reason: buildNegativeReason(input),
      triggers: [],
    };
  }

  return {
    fires: true,
    reason: reasons.join(" "),
    triggers,
  };
}

function buildNegativeReason(input: MaterialityInput): string {
  const gateSummary = input.gates
    .map((g) => `${gateLabel(g.gate_id)} ${g.status}`)
    .join(", ");
  return (
    `Materiality threshold not reached. ` +
    `Gates: ${gateSummary}. ` +
    `Verdict: ${input.synthesis.overall_verdict.replace(/_/g, " ")} at confidence ${input.synthesis.confidence.toFixed(2)}. ` +
    `Ticket: Rs ${input.ticketSizeCr} Cr. ` +
    `Amplification flags: ${input.synthesis.amplification_flags.length}.`
  );
}

function gateLabel(id: GateResult["gate_id"]): string {
  if (id === "g1_mandate") return "G1";
  if (id === "g2_sebi_regulatory") return "G2";
  return "G3";
}
