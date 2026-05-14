/* Governance gate result shape.
 *
 * The three gates G1 (mandate compliance), G2 (SEBI / regulatory), and G3
 * (action permission filter) are deterministic per the EGA framework
 * locked in Slice 3 orientation Q2. No LLM in the gate evaluation; the
 * gate output is rule-based against the mandate, SEBI tables, and firm
 * permission policy.
 *
 * Three outcomes:
 *   pass:                   all rules cleared; action passes the gate
 *   fail:                   a hard breach exists; action is blocked at
 *                           this gate (advisor cannot proceed without
 *                           amending the action)
 *   requires_clarification: a soft breach or insufficient data; advisor
 *                           judgement required; the gate output cites
 *                           the specific gap or borderline condition
 *
 * The verdict surface (S1.case_mode synthesis) reads these results and
 * shapes the case verdict accordingly. The Case Detail Outcome tab
 * renders each gate as a pill (GATE PASSED / GATE BLOCKED / REQUIRES
 * CLARIFICATION) with the one-line rationale; the audit-grade detail
 * (breaches, gaps) is on hover or in the Analyst Reports tab.
 */

export type GateId = "g1_mandate" | "g2_sebi_regulatory" | "g3_action_permission";

export type GateStatus = "pass" | "fail" | "requires_clarification";

export type GateResult = {
  gate_id: GateId;
  status: GateStatus;
  /** One-line summary suitable for the Case Detail pill subtitle. */
  rationale: string;
  /** Specific breaches that fired (for "fail" status). Empty otherwise. */
  breaches: string[];
  /** Specific gaps or borderline conditions that warrant clarification
   * (for "requires_clarification" status). Empty otherwise. */
  gaps: string[];
  /** Structured rule-evaluation trace for audit. JSON-friendly. */
  rule_trace: Record<string, unknown>;
};

export function passResult(
  gateId: GateId,
  rationale: string,
  trace: Record<string, unknown> = {},
): GateResult {
  return { gate_id: gateId, status: "pass", rationale, breaches: [], gaps: [], rule_trace: trace };
}

export function failResult(
  gateId: GateId,
  rationale: string,
  breaches: string[],
  trace: Record<string, unknown> = {},
): GateResult {
  return { gate_id: gateId, status: "fail", rationale, breaches, gaps: [], rule_trace: trace };
}

export function requiresClarificationResult(
  gateId: GateId,
  rationale: string,
  gaps: string[],
  trace: Record<string, unknown> = {},
): GateResult {
  return {
    gate_id: gateId,
    status: "requires_clarification",
    rationale,
    breaches: [],
    gaps,
    rule_trace: trace,
  };
}
