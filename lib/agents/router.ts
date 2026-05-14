/* M0.Router, deterministic dispatch.
 *
 * Per m0_router.md §"Role", router operates deterministically in cluster 5/6
 * (today) and falls back to LLM in a future cluster. Slice 2 added the
 * diagnostic path; Slice 3 adds the proposed_action path. The deterministic
 * paths share an ApplicabilityVector shape so downstream consumers
 * (pipelines, S1 synthesis, Case Detail rendering) read both modes
 * uniformly.
 *
 * Activation rules per m0_router.md §"Applicability Vector Determination"
 * and principles_of_operation §3.1:
 *
 * Diagnostic mode (Slice 2):
 *   E1 if direct listed equity, MF (look-through equity), or PMS holdings
 *   E2 if listed equity exists (in practice == E1 for this slice)
 *   E3 always (mandatory unconditional)
 *   E4 on diagnostic, treating foundation §4 archetype profile as the
 *      character bible the skill cites (per Slice 2 Q2 approval)
 *   E5 if direct unlisted equity is in advisory scope (excludedHoldings
 *      are out of scope per foundation §3 and §4 conventions)
 *   E6 if PMS or AIF holdings exist
 *   E7 if mutual fund holdings exist
 *   M0.PortfolioRiskAnalytics activates independently on every diagnostic
 *   (principles §3.8)
 *
 * Proposed_action mode (Slice 3):
 *   E1 if the action's target or source involves listed equity look-through
 *      (PMS, MF, or direct listed)
 *   E2 follows E1
 *   E3 always
 *   E4 always on proposed_action (per skill)
 *   E5 if the action's target or source involves unlisted equity
 *   E6 if the action's target or source involves PMS or AIF
 *   E7 if the action's target or source involves MF specifically
 *   M0.IndianContext activates first (commit 3, blocked on Workstream C)
 *   M0.PortfolioRiskAnalytics activates on every proposed_action
 *
 * The Sharma + Marcellus reference case (target=pms, source=fixed_deposits)
 * produces e1/e2/e3/e4/e6=true, e5/e7=false, matching the
 * sharma_marcellus_evidence_verdicts.md activation profile.
 */

import type { StructuredHoldings, SubCategory } from "@/db/fixtures/structured-holdings";
import type { CaseIntent, DominantLens } from "@/lib/format/case-intent";
import { lensFor } from "@/lib/format/case-intent";
import {
  involvesMutualFund,
  involvesPmsOrAif,
  involvesUnlistedEquity,
  sourceInvolvesListedEquityLookThrough,
  targetInvolvesListedEquityLookThrough,
  type Proposal,
} from "./proposal";

export type CaseMode = "diagnostic" | "proposed_action" | "scenario" | "briefing";

export type ApplicabilityVector = {
  caseMode: CaseMode;
  /** Set for proposed_action mode; null for diagnostic. */
  caseIntent: CaseIntent | null;
  /** Set for proposed_action mode; null for diagnostic. */
  dominantLens: DominantLens | null;
  e1: boolean;
  e2: boolean;
  e3: boolean;
  e4: boolean;
  e5: boolean;
  e6: boolean;
  e7: boolean;
  /** M0.IndianContext activates first on proposed_action (per skill). False
   * on diagnostic (Slice 2 orientation Q1 kept it dormant there). */
  indianContext: boolean;
  portfolioRiskAnalytics: boolean;
  activated: string[];
  reasoning: string;
};

function hasListedEquity(holdings: StructuredHoldings): boolean {
  return holdings.holdings.some(
    (h) =>
      h.subCategory === "listed_large_cap" ||
      h.subCategory === "intl_us_etf" ||
      h.subCategory === "intl_us_individual",
  );
}

function hasMutualFund(holdings: StructuredHoldings): boolean {
  return holdings.holdings.some((h) => h.subCategory.startsWith("mf_"));
}

function hasPMS(holdings: StructuredHoldings): boolean {
  return holdings.holdings.some((h) => h.subCategory.startsWith("pms_"));
}

function hasAIF(holdings: StructuredHoldings): boolean {
  return holdings.holdings.some((h) => h.subCategory.startsWith("aif_"));
}

function hasUnlistedEquityInScope(holdings: StructuredHoldings): boolean {
  const inScope: SubCategory[] = ["unlisted_pre_ipo", "unlisted_family_business"];
  return holdings.holdings.some((h) => inScope.includes(h.subCategory));
}

function buildActivatedList(v: {
  indianContext: boolean;
  e1: boolean;
  e2: boolean;
  e3: boolean;
  e4: boolean;
  e5: boolean;
  e6: boolean;
  e7: boolean;
}): string[] {
  const out: string[] = [];
  if (v.indianContext) out.push("m0_indian_context");
  if (v.e1) out.push("e1_listed_fundamental_equity");
  if (v.e2) out.push("e2_industry_business");
  if (v.e3) out.push("e3_macro_policy_news");
  if (v.e4) out.push("e4_behavioural_historical");
  if (v.e5) out.push("e5_unlisted_equity");
  if (v.e6) out.push("e6_pms_aif_sif");
  if (v.e7) out.push("e7_mutual_fund");
  return out;
}

export function route(holdings: StructuredHoldings): ApplicabilityVector {
  const caseMode: CaseMode = "diagnostic";
  const listed = hasListedEquity(holdings);
  const mf = hasMutualFund(holdings);
  const pms = hasPMS(holdings);
  const aif = hasAIF(holdings);
  const unlistedInScope = hasUnlistedEquityInScope(holdings);

  // E1 fires for direct listed equity, MF (look-through to listed equity),
  // or PMS (look-through). E2 follows the same listed-equity trigger.
  const e1 = listed || mf || pms;
  const e2 = e1;

  // E3 is mandatory unconditional.
  const e3 = true;

  // E4 activates on diagnostic given the foundation §4 profile provides
  // the character bible. Slice 2 Q2 approved.
  const e4 = caseMode === "diagnostic";

  const e5 = unlistedInScope;
  const e6 = pms || aif;
  const e7 = mf;
  const indianContext = false;
  const portfolioRiskAnalytics = true;

  const reasoning = [
    `case_mode=${caseMode}`,
    `listed_equity=${listed}`,
    `mf=${mf}`,
    `pms=${pms}`,
    `aif=${aif}`,
    `unlisted_in_scope=${unlistedInScope}`,
  ].join("; ");

  return {
    caseMode,
    caseIntent: null,
    dominantLens: null,
    e1,
    e2,
    e3,
    e4,
    e5,
    e6,
    e7,
    indianContext,
    portfolioRiskAnalytics,
    activated: buildActivatedList({ indianContext, e1, e2, e3, e4, e5, e6, e7 }),
    reasoning,
  };
}

/* Samriddhi 1 proposed_action routing. Activation is action-centric: the
 * target instrument category and the source of funds drive E1/E5/E6/E7.
 * E3 is mandatory; E4 always activates on proposed_action per skill. The
 * existing portfolio (holdings argument) is not currently consulted for
 * activation — the skill keeps proposed_action evidence focused on the
 * action's instruments, with portfolio context handled separately by
 * M0.PortfolioRiskAnalytics and S1 synthesis. The holdings argument is
 * retained in the signature so future activation rules that consider
 * existing exposure (e.g., "E7 fires if proposal exits an existing MF")
 * can land without a signature change. */
export function routeProposedAction(
  holdings: StructuredHoldings,
  proposal: Proposal,
): ApplicabilityVector {
  void holdings; // reserved for future activation rules; see comment above

  const caseMode: CaseMode = "proposed_action";
  const target = proposal.target_category;
  const source = proposal.source_of_funds;

  const listedLookThrough =
    targetInvolvesListedEquityLookThrough(target) ||
    sourceInvolvesListedEquityLookThrough(source);

  const e1 = listedLookThrough;
  const e2 = e1;
  const e3 = true;
  const e4 = true;
  const e5 = involvesUnlistedEquity(target);
  const e6 = involvesPmsOrAif(target, source);
  const e7 = involvesMutualFund(target, source);
  const indianContext = true;
  const portfolioRiskAnalytics = true;

  const reasoning = [
    `case_mode=${caseMode}`,
    `case_intent=${proposal.action_type}`,
    `target_category=${target}`,
    `source_of_funds=${source}`,
    `listed_look_through=${listedLookThrough}`,
    `pms_or_aif=${involvesPmsOrAif(target, source)}`,
    `mf=${involvesMutualFund(target, source)}`,
    `unlisted=${involvesUnlistedEquity(target)}`,
  ].join("; ");

  return {
    caseMode,
    caseIntent: proposal.action_type,
    dominantLens: lensFor(proposal.action_type),
    e1,
    e2,
    e3,
    e4,
    e5,
    e6,
    e7,
    indianContext,
    portfolioRiskAnalytics,
    activated: buildActivatedList({ indianContext, e1, e2, e3, e4, e5, e6, e7 }),
    reasoning,
  };
}
