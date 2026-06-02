/* Unit test for the T-5.16 whole-book look-through (Task 1) in
 * portfolio-risk-analytics.ts. Deterministic, against the current snapshot
 * structure (real cross-sectional data). No LLM call.
 *
 * Run: npx tsx scripts/_verify-look-through.ts
 */
import { loadSnapshot } from "../lib/agents/snapshot-loader";
import { computeMetrics } from "../lib/agents/portfolio-risk-analytics";
import { SURANA_HOLDINGS, BHATT_HOLDINGS } from "../db/fixtures/structured-holdings";

async function main() {
  const snap = await loadSnapshot("t0_q2_2026");
  const inv = { riskAppetite: "Aggressive", liquidityTier: "secondary" };
  let fails = 0;
  const assert = (c: boolean, label: string, detail = "") => {
    if (!c) fails++;
    console.log(`  [${c ? "PASS" : "FAIL"}] ${label}${c ? "" : " :: " + detail}`);
  };

  // Surana: direct equity (Reliance 20.3%, HDFC Bank 5.8%) + equity MFs + a PMS + intl ETF + gold + cash.
  const c = computeMetrics(SURANA_HOLDINGS, snap, inv).concentration;

  console.log("Probe A: direct equity rolls up at (at least) its full weight, source=direct");
  const ril = c.stockExposureLookThrough.find((s) => /reliance/i.test(s.stock));
  assert(!!ril && ril.weightPct >= 20 && ril.sources.includes("direct"),
    "Reliance present at >=20% with source 'direct'", JSON.stringify(ril));

  console.log("Probe B: look-through (MF / PMS) expands the per-stock roll-up beyond the direct names");
  // Note: the snapshot's MF Top 5 Holdings is sparse (the 220/1773 coverage gap),
  // so for these holdings PMS disclosure is the main look-through source; the
  // uncovered MF weight is honestly footnoted rather than fabricated.
  const directNames = SURANA_HOLDINGS.holdings.filter((h) => h.subCategory.startsWith("listed_")).length;
  const lookedThrough = c.stockExposureLookThrough.some((s) => s.sources.some((src) => src === "mf" || src === "pms"));
  assert(lookedThrough && c.stockExposureLookThrough.length > directNames,
    "MF/PMS look-through expands the per-stock roll-up beyond direct holdings", `stocks=${c.stockExposureLookThrough.length} direct=${directNames}`);

  console.log("Probe C: coverage is honest (covered tracked; footnote present iff uncovered > 0)");
  assert(c.lookThroughCoverage.stock.coveredWeightPct > 0, "some weight is stock-covered", `${c.lookThroughCoverage.stock.coveredWeightPct}`);
  assert(
    (c.lookThroughCoverage.stock.uncoveredWeightPct > 0) === (c.lookThroughCoverage.stock.footnote !== null),
    "stock footnote present exactly when uncovered > 0",
    `unc=${c.lookThroughCoverage.stock.uncoveredWeightPct} footnote=${c.lookThroughCoverage.stock.footnote}`,
  );

  console.log("Probe D: sector look-through populated; the MF-only field (A2 contract) still present");
  assert(c.sectorExposureLookThrough.length > 0, "unified sector look-through populated", `${c.sectorExposureLookThrough.length}`);
  assert(Array.isArray(c.sectorExposureMfLookThrough), "sectorExposureMfLookThrough (A2 field) preserved", "");

  console.log("Probe E: an opaque-heavy book (Bhatt: AIF + undisclosed/unmatched PMS) surfaces uncovered weight");
  const cb = computeMetrics(BHATT_HOLDINGS, snap, inv).concentration;
  assert(cb.lookThroughCoverage.stock.uncoveredWeightPct > 0 && cb.lookThroughCoverage.stock.footnote !== null,
    "Bhatt has uncovered weight with a footnote", `unc=${cb.lookThroughCoverage.stock.uncoveredWeightPct}% foot=${!!cb.lookThroughCoverage.stock.footnote}`);

  console.log("");
  console.log(`  Surana: stock-covered ${c.lookThroughCoverage.stock.coveredWeightPct}% / uncovered ${c.lookThroughCoverage.stock.uncoveredWeightPct}%, ${c.stockExposureLookThrough.length} distinct stocks, ${c.sectorExposureLookThrough.length} sectors`);
  console.log(`  Bhatt:  stock-covered ${cb.lookThroughCoverage.stock.coveredWeightPct}% / uncovered ${cb.lookThroughCoverage.stock.uncoveredWeightPct}%`);
  console.log(fails === 0 ? "OK: whole-book look-through rolls up across direct/MF/PMS and degrades honestly." : `FAILED: ${fails} assertion(s).`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => { console.error("FAILED: unexpected error", e); process.exit(1); });
