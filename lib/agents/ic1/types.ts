/* IC1 deliberation types, including per-role status discriminator.
 *
 * Per Slice 4 orientation Q2, the IC1Deliberation payload carries the
 * five sub-agent contributions (Chair, Devil's Advocate, Risk Assessor,
 * Counterfactual Engine, Minutes Recorder) in a simpler renderer-shaped
 * form than the skill files' authoring schemas. The orchestrator builds
 * this shape from the per-role outputs.
 *
 * Per-role status discriminator (Slice 4 scoping confirmation, sentinel
 * shape Option (a)): each role's payload carries
 *   status: "populated" | "infrastructure_ready"
 * so the Outcome tab and Analyst Reports memo can fork cleanly between
 * populated content and the pending state. Partial-state is handled
 * naturally: a deferred live-generation run that succeeds on 3 of 5
 * sub-agents persists 3 populated payloads and leaves the remaining 2
 * at infrastructure_ready until re-run.
 *
 * The top-level fires discriminator mirrors materiality.fires; when the
 * materiality evaluator returns fires=false, IC1Deliberation collapses
 * to just the audit-trail reason and no sub-agent payloads.
 */

export type IC1Role =
  | "ic1_chair"
  | "ic1_devils_advocate"
  | "ic1_risk_assessor"
  | "ic1_counterfactual_engine"
  | "ic1_minutes_recorder";

export type StructuredBullet = {
  title: string;
  body: string;
};

export type StructuredAlternative = {
  label: string;
  description: string;
};

export type ChairPayload =
  | { status: "populated"; framing: string[]; deliberation_question: string }
  | { status: "infrastructure_ready" };

export type DevilsAdvocatePayload =
  | { status: "populated"; position: string[]; specific_challenges: StructuredBullet[] }
  | { status: "infrastructure_ready" };

export type RiskAssessorPayload =
  | { status: "populated"; evaluation: string[]; specific_risks: StructuredBullet[] }
  | { status: "infrastructure_ready" };

export type CounterfactualEnginePayload =
  | { status: "populated"; framing: string[]; alternative_paths: StructuredAlternative[] }
  | { status: "infrastructure_ready" };

export type MinutesRecorderPayload =
  | { status: "populated"; summary: string[] }
  | { status: "infrastructure_ready" };

export type IC1Deliberation =
  | { fires: false; materiality_reason: string }
  | {
      fires: true;
      minutes_recorder: MinutesRecorderPayload;
      chair: ChairPayload;
      devils_advocate: DevilsAdvocatePayload;
      risk_assessor: RiskAssessorPayload;
      counterfactual_engine: CounterfactualEnginePayload;
    };

/* Convenience guards used by the orchestrator and renderer. */

export function isPopulated<T extends { status: string }>(
  payload: T,
): payload is T & { status: "populated" } {
  return payload.status === "populated";
}

export function isSentinel(payload: { status: string }): boolean {
  return payload.status === "infrastructure_ready";
}

export function sentinelChair(): ChairPayload {
  return { status: "infrastructure_ready" };
}
export function sentinelDevilsAdvocate(): DevilsAdvocatePayload {
  return { status: "infrastructure_ready" };
}
export function sentinelRiskAssessor(): RiskAssessorPayload {
  return { status: "infrastructure_ready" };
}
export function sentinelCounterfactualEngine(): CounterfactualEnginePayload {
  return { status: "infrastructure_ready" };
}
export function sentinelMinutesRecorder(): MinutesRecorderPayload {
  return { status: "infrastructure_ready" };
}
