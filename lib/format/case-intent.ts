/* Canonical case_intent enumeration and lens mapping.
 *
 * Slice 3 single source of truth for case_intent values referenced by the
 * Samriddhi 1 proposal-evaluation pipeline (router, S1.case_mode synthesis,
 * Case Detail rendering). The router skill (agents/m0_router.md §"Mode
 * Mapping" and §"case_intent Enumeration") declares the canonical set and
 * the dominant_lens mapping; this module mirrors that contract at the
 * TypeScript level so call sites stay typed.
 *
 * Slice 3 commit 2a folds these values into foundation.md as part of the
 * "diagnostic-only" amendment.
 *
 * The four user-facing values for the proposal capture form (per the
 * orientation Q2 lock) are rebalance_proposal, new_investment,
 * exit_position, restructure. The broader skill enum is preserved here
 * for forward compatibility; the form (commit 10) exposes only the four.
 */

/* The dominant_lens determines the analytical posture downstream:
 *
 *   portfolio_shift: action modifies the existing portfolio composition.
 *     Evidence and synthesis read the action against existing holdings,
 *     mandate bands, and concentration baselines.
 *
 *   proposal_evaluation: action adds a discrete new position. Evidence
 *     and synthesis read the new instrument on its own merits plus the
 *     marginal portfolio effect.
 *
 *   context_dependent: lens depends on whether proceeds are redeployed
 *     (portfolio_shift) or exit is one-way (proposal_evaluation). Caller
 *     resolves at form-capture time or via a follow-up. */
export type DominantLens = "portfolio_shift" | "proposal_evaluation" | "context_dependent";

/* Union of the orientation's four form values and the router skill's
 * larger enumeration. Tax_loss_harvesting, liquidity_mobilisation, etc.,
 * are not exposed in the Slice 3 form but are accepted by the router for
 * future workflows that bypass the form (e.g., C0 conversational intake). */
export type CaseIntent =
  | "rebalance_proposal"
  | "new_investment"
  | "exit_position"
  | "restructure"
  | "product_evaluation"
  | "asset_allocation_change"
  | "tax_loss_harvesting"
  | "liquidity_mobilisation"
  | "mandate_review_response"
  | "other";

/* The four values exposed by the Slice 3 proposal capture form (commit
 * 10). Kept as a separate constant so the form's dropdown options stay
 * in sync with this module without duplicating the literal list. */
export const FORM_CASE_INTENTS: readonly CaseIntent[] = [
  "rebalance_proposal",
  "new_investment",
  "exit_position",
  "restructure",
] as const;

/* Mapping per the router skill §"Mode Mapping" and the Slice 3 scoping
 * response D. */
const LENS_MAP: Record<CaseIntent, DominantLens> = {
  rebalance_proposal: "portfolio_shift",
  new_investment: "proposal_evaluation",
  exit_position: "context_dependent",
  restructure: "portfolio_shift",
  product_evaluation: "proposal_evaluation",
  asset_allocation_change: "portfolio_shift",
  tax_loss_harvesting: "portfolio_shift",
  liquidity_mobilisation: "portfolio_shift",
  mandate_review_response: "portfolio_shift",
  other: "context_dependent",
};

export function lensFor(intent: CaseIntent): DominantLens {
  return LENS_MAP[intent];
}

/* Human-readable labels for UI rendering. */
const LABEL_MAP: Record<CaseIntent, string> = {
  rebalance_proposal: "Rebalance proposal",
  new_investment: "New investment",
  exit_position: "Exit position",
  restructure: "Restructure",
  product_evaluation: "Product evaluation",
  asset_allocation_change: "Asset allocation change",
  tax_loss_harvesting: "Tax-loss harvesting",
  liquidity_mobilisation: "Liquidity mobilisation",
  mandate_review_response: "Mandate review response",
  other: "Other",
};

export function labelFor(intent: CaseIntent): string {
  return LABEL_MAP[intent];
}
