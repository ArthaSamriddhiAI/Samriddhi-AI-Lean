/* M0.Router, deterministic dispatch for Slice 2.
 *
 * Per m0_router.md §"Role", router operates deterministically in cluster 5/6
 * (today) and falls back to LLM in a future cluster. Slice 2 uses the
 * deterministic path exclusively; case_mode is always 'diagnostic'.
 *
 * Activation rules per m0_router.md §"Applicability Vector Determination"
 * and principles_of_operation §3.1:
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
 * M0.IndianContext is skipped in Slice 2 per orientation Q1.
 */

import type { StructuredHoldings, SubCategory } from "@/db/fixtures/structured-holdings";

export type CaseMode = "diagnostic" | "proposed_action" | "scenario" | "briefing";

export type ApplicabilityVector = {
  caseMode: CaseMode;
  e1: boolean;
  e2: boolean;
  e3: boolean;
  e4: boolean;
  e5: boolean;
  e6: boolean;
  e7: boolean;
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
  const portfolioRiskAnalytics = true;

  const activated: string[] = [];
  if (e1) activated.push("e1_listed_fundamental_equity");
  if (e2) activated.push("e2_industry_business");
  if (e3) activated.push("e3_macro_policy_news");
  if (e4) activated.push("e4_behavioural_historical");
  if (e5) activated.push("e5_unlisted_equity");
  if (e6) activated.push("e6_pms_aif_sif");
  if (e7) activated.push("e7_mutual_fund");

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
    e1,
    e2,
    e3,
    e4,
    e5,
    e6,
    e7,
    portfolioRiskAnalytics,
    activated,
    reasoning,
  };
}
