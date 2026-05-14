/* Proposal shape for Samriddhi 1 proposed_action cases.
 *
 * Captures the structured form fields per Slice 3 orientation Q2 (locked
 * in the scoping response):
 *   - action_type (case_intent enum)
 *   - target_category (drives router activation)
 *   - target_instrument (free-text instrument name, captured for agent context)
 *   - ticket_size_cr (rupee crores)
 *   - source_of_funds
 *   - timeline
 *   - rationale (optional, captured but not router-consequential)
 *
 * Commit 10 builds the proposal capture form that produces this shape.
 * Commit 2 (this commit) only defines the type and the router activation
 * logic; the form lands later in the slice cadence.
 */

import type { CaseIntent } from "@/lib/format/case-intent";

/* Categorised target. Drives evidence-agent activation; the router branches
 * on this to decide E1/E5/E6/E7. The free-text target_instrument carries
 * the specific instrument name for agent-context use (e.g., "Marcellus
 * Consistent Compounder PMS"). */
export type TargetCategory =
  | "pms"
  | "aif"
  | "mutual_fund"
  | "listed_equity_direct"
  | "unlisted_equity"
  | "fixed_deposit"
  | "bond_listed"
  | "cash"
  | "gold"
  | "other";

/* Where the capital comes from. Matters for activation when an existing
 * wrapper is being unwound (e.g., source=existing_pms triggers E6 even
 * if the target isn't a wrapper) and for narrative framing in S1. */
export type SourceOfFunds =
  | "fixed_deposits"
  | "mutual_funds"
  | "cash_balance"
  | "existing_pms"
  | "existing_aif"
  | "fresh_inflow";

export type Timeline =
  | "immediate"
  | "this_quarter"
  | "this_year"
  | "opportunistic";

export type Proposal = {
  action_type: CaseIntent;
  target_category: TargetCategory;
  /** Free-text instrument name, e.g. "Marcellus Consistent Compounder PMS". */
  target_instrument: string;
  ticket_size_cr: number;
  source_of_funds: SourceOfFunds;
  timeline: Timeline;
  /** Optional advisor rationale, captured on the case but not pipeline-consequential. */
  rationale: string | null;
};

/* Helpers for router activation. Centralised here so the activation
 * rules read declaratively in router.ts. */

export function targetInvolvesListedEquityLookThrough(target: TargetCategory): boolean {
  return target === "pms" || target === "mutual_fund" || target === "listed_equity_direct";
}

export function sourceInvolvesListedEquityLookThrough(source: SourceOfFunds): boolean {
  return source === "mutual_funds" || source === "existing_pms";
}

export function involvesPmsOrAif(target: TargetCategory, source: SourceOfFunds): boolean {
  return (
    target === "pms" ||
    target === "aif" ||
    source === "existing_pms" ||
    source === "existing_aif"
  );
}

export function involvesMutualFund(target: TargetCategory, source: SourceOfFunds): boolean {
  return target === "mutual_fund" || source === "mutual_funds";
}

export function involvesUnlistedEquity(target: TargetCategory): boolean {
  return target === "unlisted_equity";
}
