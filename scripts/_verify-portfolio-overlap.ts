/* Deterministic verification for portfolio-overlap (T-5.07). No API.
 *
 * Five synthetic, minimal portfolios (WA15) exercised against the real
 * snapshot t0_q2_2026 (for fund/wrapper disclosure lookup). Calls
 * runPortfolioOverlapDeterministic directly (not through the pipeline, no S1).
 * Asserts both the numeric/categorical output AND the resolution_layer field,
 * and asserts sentinels by name, per the amended ADR-0030 layer model.
 *
 * Cases:
 *   1. Known stock-level overlap — two clean 233-set funds (Aditya Birla ELSS
 *      Tax Saver x Focused) sharing four top-5 holdings; expected score 0.189
 *      on the stock_level layer (min-weight intersection, hand-verified).
 *   2. Opaque PMS pair — two PMS with no disclosure; resolves at categorical
 *      with limited_by: opaque_wrapper (annotation, not a voided pair).
 *   3. Single-holding sleeve — a lone Alternatives holding sentinels
 *      single_holding_sleeve_overlap while a populated Equity sleeve does not.
 *   4. Mixed-coverage — a 233-set fund (top-5 + cap) x a no-top-5 fund (cap
 *      only); falls back from stock_level to structural_similarity.
 *   5. Menon-shape — three holdings in three asset classes; every sleeve
 *      sentinels single_holding_sleeve_overlap and the portfolio sentinels
 *      insufficient_overlap_coverage (within-sleeve-only pairing, P33).
 *
 * Requires the snapshot suite at fixtures/snapshots/enriched/ (ADR-0027).
 * Run: npx tsx scripts/_verify-portfolio-overlap.ts  (exits non-zero on failure).
 */
import { loadSnapshot } from "@/lib/agents/snapshot-loader";
import { runPortfolioOverlapDeterministic } from "@/lib/agents/portfolio-overlap";
import type { StructuredHoldings, Holding } from "@/db/fixtures/structured-holdings";

const failures: string[] = [];
function assert(cond: boolean, name: string, detail = ""): void {
  if (!cond) failures.push(name);
  console.log(`  [${cond ? "PASS" : "FAIL"}] ${name}${cond ? "" : ` :: ${detail}`}`);
}

function portfolio(holdings: Holding[]): StructuredHoldings {
  return { totalLiquidAumCr: holdings.reduce((a, h) => a + h.valueCr, 0), holdings };
}

(async () => {
  const snapshot = await loadSnapshot("t0_q2_2026");
  const run = (caseId: string, h: StructuredHoldings) =>
    runPortfolioOverlapDeterministic({ caseId, asOfDate: "2026-04-30", holdings: h, snapshot, investor: {} });

  // --- Case 1: known stock-level overlap (two clean 233-set funds) ---
  console.log("Case 1: known stock-level overlap (Aditya Birla ELSS Tax Saver x Focused)");
  const c1 = run("verify-overlap-1", portfolio([
    { instrument: "Aditya Birla Sun Life ELSS Tax Saver Fund", assetClass: "Equity", subCategory: "mf_active_large_cap", valueCr: 5, weightPct: 50 },
    { instrument: "Aditya Birla Sun Life Focused Fund", assetClass: "Equity", subCategory: "mf_active_flexi_cap", valueCr: 5, weightPct: 50 },
  ]));
  const p1 = c1.per_pair[0];
  assert(c1.per_pair.length === 1, "Case 1: exactly one within-sleeve (Equity) pair", `got ${c1.per_pair.length}`);
  assert(p1?.resolution_layer === "stock_level", "Case 1: resolves at stock_level", `got ${p1?.resolution_layer}`);
  assert(p1?.shared_holding_count === 4, "Case 1: four shared top-5 holdings (ICICI/Axis/SBI/Infosys; HDFC not shared)", `got ${p1?.shared_holding_count}`);
  assert(p1?.score === 0.189, "Case 1: min-weight intersection score 0.189", `got ${p1?.score}`);
  assert(p1?.limited_by === null, "Case 1: not limited by opacity", `got ${p1?.limited_by}`);

  // --- Case 2: opaque PMS pair (no disclosure -> categorical + opaque_wrapper) ---
  console.log("Case 2: opaque PMS pair");
  const c2 = run("verify-overlap-2", portfolio([
    { instrument: "Synthetic Opaque PMS Alpha", assetClass: "Equity", subCategory: "pms_growth_quality", valueCr: 5, weightPct: 50 },
    { instrument: "Synthetic Opaque PMS Beta", assetClass: "Equity", subCategory: "pms_value", valueCr: 5, weightPct: 50 },
  ]));
  const p2 = c2.per_pair[0];
  assert(p2?.resolution_layer === "categorical", "Case 2: opaque PMS pair resolves at categorical", `got ${p2?.resolution_layer}`);
  assert(p2?.limited_by === "opaque_wrapper", "Case 2: limited_by opaque_wrapper (annotation, not voided pair)", `got ${p2?.limited_by}`);
  assert(p2?.score === 0.5, "Case 2: categorical score 0.5 (same asset class, different sub-category)", `got ${p2?.score}`);

  // --- Case 3: single-holding sleeve sentinel ---
  console.log("Case 3: single-holding sleeve sentinel");
  const c3 = run("verify-overlap-3", portfolio([
    { instrument: "Aditya Birla Sun Life ELSS Tax Saver Fund", assetClass: "Equity", subCategory: "mf_active_large_cap", valueCr: 4, weightPct: 40 },
    { instrument: "Aditya Birla Sun Life Focused Fund", assetClass: "Equity", subCategory: "mf_active_flexi_cap", valueCr: 4, weightPct: 40 },
    { instrument: "Physical gold", assetClass: "Alternatives", subCategory: "physical_gold", valueCr: 2, weightPct: 20 },
  ]));
  const c3alt = c3.per_sleeve.find((s) => s.sleeve === "Alternatives");
  const c3eq = c3.per_sleeve.find((s) => s.sleeve === "Equity");
  assert(c3alt?.sentinel === "single_holding_sleeve_overlap", "Case 3: lone Alternatives sleeve sentinels single_holding_sleeve_overlap", `got ${c3alt?.sentinel}`);
  assert(c3eq?.sentinel === null && c3eq?.pair_count === 1, "Case 3: populated Equity sleeve has a pair and no sentinel", `sentinel=${c3eq?.sentinel} pairs=${c3eq?.pair_count}`);

  // --- Case 4: mixed-coverage resolution-layer fallback ---
  console.log("Case 4: mixed-coverage fallback (233-set Focused x no-top-5 Mirae)");
  const c4 = run("verify-overlap-4", portfolio([
    { instrument: "Aditya Birla Sun Life Focused Fund", assetClass: "Equity", subCategory: "mf_active_flexi_cap", valueCr: 5, weightPct: 50 },
    { instrument: "Mirae Asset Large Cap Fund", assetClass: "Equity", subCategory: "mf_active_large_cap", valueCr: 5, weightPct: 50 },
  ]));
  const p4 = c4.per_pair[0];
  assert(p4?.resolution_layer === "structural_similarity", "Case 4: stock_level unavailable on one side -> falls back to structural_similarity", `got ${p4?.resolution_layer}`);
  assert(p4?.shared_holdings === null && p4?.shared_holding_count === null, "Case 4: no stock-level shared list at the structural layer", `got ${JSON.stringify(p4?.shared_holdings)}`);
  assert(p4?.score === 0.909, "Case 4: cap-split structural similarity score 0.909", `got ${p4?.score}`);

  // --- Case 5: Menon-shape (three holdings, three asset classes) ---
  console.log("Case 5: Menon-shape, three holdings in three asset classes (P33)");
  const c5 = run("verify-overlap-5", portfolio([
    { instrument: "Bank savings account", assetClass: "Cash", subCategory: "savings", valueCr: 5, weightPct: 80 },
    { instrument: "HDFC Bank FD", assetClass: "Debt", subCategory: "bank_fd", valueCr: 0.7, weightPct: 12 },
    { instrument: "US listed equities", assetClass: "Equity", subCategory: "intl_us_individual", valueCr: 0.5, weightPct: 8 },
  ]));
  assert(c5.portfolio.evaluated_pair_count === 0, "Case 5: zero within-sleeve pairs", `got ${c5.portfolio.evaluated_pair_count}`);
  assert(c5.portfolio.sentinel === "insufficient_overlap_coverage", "Case 5: portfolio sentinels insufficient_overlap_coverage", `got ${c5.portfolio.sentinel}`);
  assert(
    c5.per_sleeve.length === 3 && c5.per_sleeve.every((s) => s.sentinel === "single_holding_sleeve_overlap"),
    "Case 5: every sleeve sentinels single_holding_sleeve_overlap",
    c5.per_sleeve.map((s) => `${s.sleeve}:${s.sentinel}`).join(", "),
  );

  console.log("");
  if (failures.length === 0) {
    console.log(`OK: all portfolio-overlap deterministic cases passed (5 cases).`);
    process.exit(0);
  } else {
    console.error(`FAILED: ${failures.length} assertion(s) failed: ${failures.join("; ")}`);
    process.exit(1);
  }
})();
