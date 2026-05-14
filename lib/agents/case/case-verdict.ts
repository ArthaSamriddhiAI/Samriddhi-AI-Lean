/* Samriddhi 1 evidence-agent verdict shape.
 *
 * Mirrors the structure documented in
 * db/fixtures/raw/sharma_marcellus_evidence_verdicts.md (lifted in
 * Slice 3 commit 9). Each activated evidence agent (E1, E2, E3, E4,
 * E6 for Sharma; E5 and E7 not activated) produces a verdict in this
 * shape; the synthesis layer (S1.case_mode) consumes a bundle of these
 * and the case-detail screen renders them stacked in the Analyst
 * Reports tab.
 *
 * The shape is intentionally simpler than the Slice 2 diagnostic
 * agent outputs (per-stock-verdict arrays, metric family scores,
 * framework classifications). Proposed_action evaluation is
 * verdict-shaped at the agent level; the diagnostic shape is
 * analytics-shaped. They share the skill body via skill-loader; only
 * the output schema differs.
 */

export type CaseRiskLevel = "low" | "moderate" | "elevated" | "high";

export type CaseAgentId =
  | "e1_listed_fundamental_equity"
  | "e2_industry_business"
  | "e3_macro_policy_news"
  | "e4_behavioural_historical"
  | "e5_unlisted_equity"
  | "e6_pms_aif_sif"
  | "e7_mutual_fund";

export type ActivatedVerdict = {
  agent_id: CaseAgentId;
  activation_status: "activated";
  risk_level: CaseRiskLevel;
  /** Confidence band 0.0–1.0. */
  confidence: number;
  drivers: string[];
  flags: string[];
  reasoning_paragraph: string;
  data_points_cited: string[];
};

export type NonActivatedVerdict = {
  agent_id: CaseAgentId;
  activation_status: "not_activated";
  reason_for_non_activation: string;
};

export type CaseEvidenceVerdict = ActivatedVerdict | NonActivatedVerdict;

/* Validators reject malformed payloads at the harness boundary so the
 * downstream code path can rely on the discriminated-union invariant. */

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x) => typeof x === "string");
}

const RISK_LEVELS = new Set<CaseRiskLevel>(["low", "moderate", "elevated", "high"]);

export function validateActivatedVerdict(
  raw: unknown,
  expectedAgentId: CaseAgentId,
): ActivatedVerdict {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`Verdict for ${expectedAgentId} is not an object`);
  }
  const obj = raw as Record<string, unknown>;
  if (obj.activation_status !== "activated") {
    throw new Error(
      `Verdict for ${expectedAgentId} expected activation_status="activated", got "${obj.activation_status}"`,
    );
  }
  if (typeof obj.risk_level !== "string" || !RISK_LEVELS.has(obj.risk_level as CaseRiskLevel)) {
    throw new Error(`Verdict for ${expectedAgentId} has invalid risk_level "${obj.risk_level}"`);
  }
  if (typeof obj.confidence !== "number" || obj.confidence < 0 || obj.confidence > 1) {
    throw new Error(
      `Verdict for ${expectedAgentId} has invalid confidence ${JSON.stringify(obj.confidence)}; expected 0.0–1.0`,
    );
  }
  if (!isStringArray(obj.drivers)) {
    throw new Error(`Verdict for ${expectedAgentId} drivers is not a string array`);
  }
  if (!isStringArray(obj.flags)) {
    throw new Error(`Verdict for ${expectedAgentId} flags is not a string array`);
  }
  if (typeof obj.reasoning_paragraph !== "string" || obj.reasoning_paragraph.trim().length === 0) {
    throw new Error(`Verdict for ${expectedAgentId} reasoning_paragraph missing or empty`);
  }
  if (!isStringArray(obj.data_points_cited)) {
    throw new Error(`Verdict for ${expectedAgentId} data_points_cited is not a string array`);
  }
  return {
    agent_id: expectedAgentId,
    activation_status: "activated",
    risk_level: obj.risk_level as CaseRiskLevel,
    confidence: obj.confidence,
    drivers: obj.drivers,
    flags: obj.flags,
    reasoning_paragraph: obj.reasoning_paragraph,
    data_points_cited: obj.data_points_cited,
  };
}

export function validateNonActivatedVerdict(
  raw: unknown,
  expectedAgentId: CaseAgentId,
): NonActivatedVerdict {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`Non-activated verdict for ${expectedAgentId} is not an object`);
  }
  const obj = raw as Record<string, unknown>;
  if (obj.activation_status !== "not_activated") {
    throw new Error(
      `Verdict for ${expectedAgentId} expected activation_status="not_activated", got "${obj.activation_status}"`,
    );
  }
  if (typeof obj.reason_for_non_activation !== "string" || obj.reason_for_non_activation.trim().length === 0) {
    throw new Error(`Non-activated verdict for ${expectedAgentId} reason_for_non_activation missing or empty`);
  }
  return {
    agent_id: expectedAgentId,
    activation_status: "not_activated",
    reason_for_non_activation: obj.reason_for_non_activation,
  };
}
