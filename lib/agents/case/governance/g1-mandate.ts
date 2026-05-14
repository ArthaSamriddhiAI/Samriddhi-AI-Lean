/* G1, mandate compliance gate.
 *
 * Deterministic rule evaluation against the investor's structured mandate.
 * Reads:
 *   - Current allocation by asset class (computed from holdings)
 *   - Mandate bands (min/max per asset class)
 *   - Proposed action (target_category, source_of_funds, ticket_size_cr)
 *
 * Computes the post-action allocation by transferring the ticket between
 * the source-implied and target-implied asset classes (or adding to total
 * AUM for fresh_inflow), then evaluates each band against the new
 * allocation. Soft breaches (within 10pp of the band edge) surface as
 * requires_clarification; harder breaches surface as fail.
 *
 * Additional checks: wrapper count ceilings, position concentration
 * ceilings (target-position vs liquid AUM), instrument exclusions.
 *
 * If the investor has no mandate on record (mandateJson null after the
 * Slice 3 schema lift, before seeding), G1 outputs requires_clarification
 * with a structured gap citation; G1 does not invent a mandate.
 */

import type { StructuredHoldings } from "@/db/fixtures/structured-holdings";
import type { Mandate } from "@/db/fixtures/structured-mandates";
import type { Proposal, SourceOfFunds, TargetCategory } from "../../proposal";
import {
  failResult,
  passResult,
  requiresClarificationResult,
  type GateResult,
} from "./types";

type AssetClass = "Equity" | "Debt" | "Alternatives" | "Cash";

/* Source / target → asset class. Coarse mappings that cover the MVP
 * form's enums. Sub-category nuance (e.g., debt MF vs equity MF) is
 * intentionally not surfaced in the form; G1 uses these defaults and
 * the rationale string flags ambiguity when it matters. */
const SOURCE_ASSET_CLASS: Record<SourceOfFunds, AssetClass | "external"> = {
  fixed_deposits: "Debt",
  mutual_funds: "Equity",
  cash_balance: "Cash",
  existing_pms: "Equity",
  existing_aif: "Alternatives",
  fresh_inflow: "external",
};

const TARGET_ASSET_CLASS: Record<TargetCategory, AssetClass> = {
  pms: "Equity",
  aif: "Alternatives",
  mutual_fund: "Equity",
  listed_equity_direct: "Equity",
  unlisted_equity: "Equity",
  fixed_deposit: "Debt",
  bond_listed: "Debt",
  cash: "Cash",
  gold: "Alternatives",
  other: "Equity",
};

/* Threshold separating soft breach (requires_clarification) from hard
 * breach (fail). 10pp is the institutional industry-standard threshold
 * for advisor judgement vs gate block. Adjust per firm policy if needed. */
const HARD_BREACH_THRESHOLD_PP = 10;

function computeCurrentAllocation(holdings: StructuredHoldings): Record<AssetClass, number> {
  const out: Record<AssetClass, number> = { Equity: 0, Debt: 0, Alternatives: 0, Cash: 0 };
  for (const h of holdings.holdings) {
    out[h.assetClass] += h.valueCr;
  }
  return out;
}

function pct(value: number, total: number): number {
  return total === 0 ? 0 : (value / total) * 100;
}

export function runG1(opts: {
  investorId: string;
  investorName: string;
  liquidAumCr: number;
  holdings: StructuredHoldings;
  mandate: Mandate | null;
  proposal: Proposal;
}): GateResult {
  if (!opts.mandate) {
    return requiresClarificationResult(
      "g1_mandate",
      `No structured mandate on record for ${opts.investorName}; G1 cannot evaluate band compliance.`,
      [
        "Investor.mandateJson is null. Populate the mandate before opening a proposed_action case for this investor.",
      ],
      { investor_id: opts.investorId, mandate_present: false },
    );
  }

  const currentByClass = computeCurrentAllocation(opts.holdings);
  const totalCurrent = currentByClass.Equity + currentByClass.Debt + currentByClass.Alternatives + currentByClass.Cash;

  /* Apply proposal as a transfer between asset classes (or as an inflow
   * for fresh_inflow). Result is the post-action absolute allocation in
   * Cr per class. */
  const postByClass: Record<AssetClass, number> = { ...currentByClass };
  const sourceClass = SOURCE_ASSET_CLASS[opts.proposal.source_of_funds];
  const targetClass = TARGET_ASSET_CLASS[opts.proposal.target_category];
  const ticket = opts.proposal.ticket_size_cr;

  let postTotal = totalCurrent;
  if (sourceClass === "external") {
    /* fresh_inflow adds to total AUM and to the target class. */
    postByClass[targetClass] += ticket;
    postTotal += ticket;
  } else {
    postByClass[sourceClass] -= ticket;
    postByClass[targetClass] += ticket;
  }

  /* Band-compliance check. */
  const breaches: string[] = [];
  const gaps: string[] = [];
  const trace: Record<string, unknown> = {
    current_allocation_pct: Object.fromEntries(
      (Object.entries(currentByClass) as [AssetClass, number][]).map(([k, v]) => [k, pct(v, totalCurrent)]),
    ),
    post_action_allocation_pct: Object.fromEntries(
      (Object.entries(postByClass) as [AssetClass, number][]).map(([k, v]) => [k, pct(v, postTotal)]),
    ),
    bands_evaluated: opts.mandate.bands.map((b) => ({ ...b })),
  };

  for (const band of opts.mandate.bands) {
    const postPct = pct(postByClass[band.asset_class], postTotal);
    const overage = postPct > band.max_pct ? postPct - band.max_pct : 0;
    const underage = postPct < band.min_pct ? band.min_pct - postPct : 0;
    if (overage > HARD_BREACH_THRESHOLD_PP) {
      breaches.push(
        `${band.asset_class} ceiling breach: post-action ${postPct.toFixed(1)}% vs band ${band.min_pct}-${band.max_pct}% (over by ${overage.toFixed(1)}pp).`,
      );
    } else if (overage > 0) {
      gaps.push(
        `${band.asset_class} sits ${overage.toFixed(1)}pp above the upper band (post-action ${postPct.toFixed(1)}% vs ceiling ${band.max_pct}%). Clarify whether this is acceptable headroom usage under the mandate.`,
      );
    } else if (underage > HARD_BREACH_THRESHOLD_PP) {
      breaches.push(
        `${band.asset_class} floor breach: post-action ${postPct.toFixed(1)}% vs band ${band.min_pct}-${band.max_pct}% (under by ${underage.toFixed(1)}pp).`,
      );
    } else if (underage > 0) {
      gaps.push(
        `${band.asset_class} sits ${underage.toFixed(1)}pp below the lower band (post-action ${postPct.toFixed(1)}% vs floor ${band.min_pct}%). Clarify whether the reduced allocation is intentional.`,
      );
    }
  }

  /* Wrapper-count ceilings. Counts post-action wrappers (existing PMS/AIF
   * holdings + 1 if the target is a new wrapper of the matching type). */
  const existingPmsCount = opts.holdings.holdings.filter((h) => h.subCategory.startsWith("pms_")).length;
  const existingAifCount = opts.holdings.holdings.filter((h) => h.subCategory.startsWith("aif_")).length;

  const addsPms = opts.proposal.target_category === "pms" && opts.proposal.action_type === "new_investment";
  const addsAif = opts.proposal.target_category === "aif" && opts.proposal.action_type === "new_investment";
  const postPmsCount = existingPmsCount + (addsPms ? 1 : 0);
  const postAifCount = existingAifCount + (addsAif ? 1 : 0);
  const postWrapperCount = postPmsCount + postAifCount;

  trace.post_action_wrapper_counts = {
    pms: postPmsCount,
    aif: postAifCount,
    total: postWrapperCount,
  };

  for (const ceiling of opts.mandate.wrapper_count_ceilings) {
    const actual =
      ceiling.wrapper_type === "pms"
        ? postPmsCount
        : ceiling.wrapper_type === "aif"
          ? postAifCount
          : postWrapperCount;
    if (actual > ceiling.max_count) {
      breaches.push(
        `${ceiling.wrapper_type} wrapper-count ceiling breach: post-action count ${actual} vs ceiling ${ceiling.max_count}.`,
      );
    }
  }

  /* Position concentration ceilings. */
  const ticketPctOfAum = pct(ticket, opts.liquidAumCr);
  trace.target_position_pct_of_liquid_aum = ticketPctOfAum;
  for (const conc of opts.mandate.position_concentration_ceilings) {
    if (conc.scope === "single_position" && ticketPctOfAum > conc.max_pct_of_liquid_aum) {
      const overage = ticketPctOfAum - conc.max_pct_of_liquid_aum;
      if (overage > HARD_BREACH_THRESHOLD_PP) {
        breaches.push(
          `Single-position concentration breach: target position ${ticketPctOfAum.toFixed(1)}% of liquid AUM vs ceiling ${conc.max_pct_of_liquid_aum}% (over by ${overage.toFixed(1)}pp).`,
        );
      } else {
        gaps.push(
          `Single-position concentration sits above the standard ceiling: target ${ticketPctOfAum.toFixed(1)}% of liquid AUM vs ceiling ${conc.max_pct_of_liquid_aum}%. Clarify whether the larger allocation is intentional.`,
        );
      }
    }
  }

  /* Instrument exclusions. Match against target_category and known
   * sub-categories where possible. The free-text target_instrument is
   * not pattern-matched at this gate; that would be a wider lift. */
  for (const excluded of opts.mandate.instrument_exclusions) {
    if (excluded === opts.proposal.target_category || excluded.includes(opts.proposal.target_category)) {
      breaches.push(
        `Instrument exclusion: ${opts.proposal.target_category} is excluded by mandate (listed exclusion: ${excluded}).`,
      );
    }
  }

  if (breaches.length > 0) {
    return failResult(
      "g1_mandate",
      `Mandate compliance breach: ${breaches.length} issue(s) at hard-breach threshold.`,
      breaches,
      trace,
    );
  }
  if (gaps.length > 0) {
    return requiresClarificationResult(
      "g1_mandate",
      `Mandate compliance: ${gaps.length} band(s) sit at or beyond boundary; advisor clarification warranted.`,
      gaps,
      trace,
    );
  }
  return passResult("g1_mandate", "Mandate compliance: all bands and ceilings within tolerance.", trace);
}
