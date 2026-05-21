/* Verification: G1 models `mutual_fund_debt` as Debt and `mutual_fund` as
 * Equity (ADR-0025). Deterministic, no API, no DB.
 * Run via: npx tsx scripts/_verify-g1-target-class.ts
 *
 * Setup: a synthetic investor at the equity-band ceiling. Adding a Rs 1 Cr
 * fresh-inflow position modeled as Equity (`mutual_fund`) breaches the equity
 * ceiling; modeled as Debt (`mutual_fund_debt`) does not. */

import { runG1 } from "../lib/agents/case/governance/g1-mandate";
import { MANDATES_BY_INVESTOR } from "../db/fixtures/structured-mandates";
import type { StructuredHoldings } from "../db/fixtures/structured-holdings";
import type { Proposal, TargetCategory } from "../lib/agents/proposal";

const failures: string[] = [];
function assert(cond: boolean, name: string) {
  if (!cond) failures.push(name);
}

const mandate = MANDATES_BY_INVESTOR.iyengar; // equity band 25-45%, debt 45-65%
const holdings: StructuredHoldings = {
  totalLiquidAumCr: 10,
  holdings: [
    { instrument: "Equity MF", assetClass: "Equity", subCategory: "mf_active_large_cap", valueCr: 4.5, weightPct: 45 },
    { instrument: "Debt MF", assetClass: "Debt", subCategory: "mf_corporate_debt", valueCr: 4.5, weightPct: 45 },
    { instrument: "Cash", assetClass: "Cash", subCategory: "savings", valueCr: 1, weightPct: 10 },
  ],
};

function mk(target: TargetCategory): Proposal {
  return {
    action_type: "new_investment",
    target_category: target,
    target_instrument: "Test fund",
    ticket_size_cr: 1,
    source_of_funds: "fresh_inflow",
    timeline: "this_quarter",
    rationale: null,
  };
}

const eqGap = /equity sits .*above the upper band/i;

const g1Equity = runG1({ investorId: "t", investorName: "Test", liquidAumCr: 10, holdings, mandate, proposal: mk("mutual_fund") });
const g1Debt = runG1({ investorId: "t", investorName: "Test", liquidAumCr: 10, holdings, mandate, proposal: mk("mutual_fund_debt") });

const equityFlagsEquity = (g1Equity.gaps ?? []).some((g) => eqGap.test(g)) || (g1Equity.breaches ?? []).some((b) => eqGap.test(b));
const debtFlagsEquity = (g1Debt.gaps ?? []).some((g) => eqGap.test(g)) || (g1Debt.breaches ?? []).some((b) => eqGap.test(b));

console.log("mutual_fund      -> equity-ceiling flag:", equityFlagsEquity);
console.log("mutual_fund_debt -> equity-ceiling flag:", debtFlagsEquity);

assert(equityFlagsEquity, "mutual_fund modeled as Equity (equity ceiling flagged)");
assert(!debtFlagsEquity, "mutual_fund_debt modeled as Debt (no equity ceiling flag)");

if (failures.length) {
  console.error(`\nFAIL: ${failures.length} assertion(s): ${failures.join("; ")}`);
  process.exit(1);
}
console.log("PASS: G1 target-class mapping correct (mutual_fund=Equity, mutual_fund_debt=Debt).");
