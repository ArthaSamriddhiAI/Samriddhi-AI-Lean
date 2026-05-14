/* Case decision capture types for Samriddhi 1.
 *
 * The Slice 3 MVP captures the advisor's decision on the case record
 * with no downstream effect (no actioning, no notifications). Future
 * slices may add actioning surfaces; the shape stays additive.
 */

export type DecisionAction =
  | "approve"
  | "approve_with_conditions"
  | "reject"
  | "defer";

export type CaseDecision = {
  action: DecisionAction;
  rationale: string;
  capturedAt: string;
};

export const DECISION_LABELS: Record<DecisionAction, string> = {
  approve: "Approve",
  approve_with_conditions: "Approve with conditions",
  reject: "Reject",
  defer: "Defer",
};
