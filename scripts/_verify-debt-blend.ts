/* Unit test for the T-5.14 Phase 3 debt-blend wiring: decomposeHeldDebt resolves
 * each held debt fund to a (credit, duration) cell, and holdingBenchmarkWeights
 * maps that cell to its TR series via DEBT_CELL_INDEX (cash / arbitrage funds fall
 * back to the read-through id). Asserts against the real-data snapshot. No LLM.
 *
 * Run: npx tsx scripts/_verify-debt-blend.ts
 */
import fs from "node:fs";
import path from "node:path";
import { computeRiskReward, type RiskRewardInput } from "../lib/agents/risk-reward-stats";
import { decomposeHeldDebt, buildInstrumentUniverse } from "../lib/agents/instrument-selection";
import { IYENGAR_HOLDINGS, BHATT_HOLDINGS } from "../db/fixtures/structured-holdings";

// The canonical filename holds the landed real t0 (data-repo v2.0.0).
const snap = JSON.parse(fs.readFileSync(
  path.resolve(process.cwd(), "fixtures/snapshots/enriched/snapshot_t0_q2_2026.json"), "utf8"));
const universe = buildInstrumentUniverse(snap);

let fails = 0;
const assert = (c: boolean, label: string, detail = "") => {
  if (!c) fails++;
  console.log(`  [${c ? "PASS" : "FAIL"}] ${label}${c ? "" : " :: " + detail}`);
};

const find = (h: any, re: RegExp) => h.holdings.find((x: any) => re.test(x.instrument));

// 1) Franklin India Corporate Debt -> high_grade x short -> crisil_short_term_bond (real-derived AAA-2Y)
const franklin = find(IYENGAR_HOLDINGS, /Franklin India Corporate Debt/);
const fdc = decomposeHeldDebt(franklin, universe);
assert(fdc.credit_bucket === "high_grade" && fdc.duration_bucket === "short",
  "Franklin Corporate Debt decomposes to (high_grade, short)", JSON.stringify(fdc));

const iy = computeRiskReward({ caseId: "iy", asOfDate: "2026-04-02", holdings: IYENGAR_HOLDINGS, snapshot: snap, investor: {} } as RiskRewardInput);
const iyDebt = iy.per_sleeve.find((s) => s.sleeve === "Debt");
const iyIds = (iyDebt?.benchmark_blend?.constituents ?? []).map((c) => c.index_id);
assert(iyIds.includes("crisil_short_term_bond"),
  "Iyengar Debt sleeve blends to crisil_short_term_bond (the AAA-short cell)", JSON.stringify(iyIds));
assert(iyDebt?.stats?.beta_3y != null, "Iyengar Debt sleeve has a computed beta on real data", `${iyDebt?.stats?.beta_3y}`);

// 2) HDFC Arbitrage is cash-like: decomposeHeldDebt reads it as credit_risk/short, but
//    its authoritative benchmark is the cash floor, so the cash-gate routes it to
//    crisil_liquid (real overnight), NOT a credit cell.
const arb = find(BHATT_HOLDINGS, /HDFC Arbitrage/);
const adc = decomposeHeldDebt(arb, universe);
console.log(`    (HDFC Arbitrage decomposes to ${adc.credit_bucket}/${adc.duration_bucket}; cash-gated to crisil_liquid)`);

const bh = computeRiskReward({ caseId: "bh", asOfDate: "2026-04-02", holdings: BHATT_HOLDINGS, snapshot: snap, investor: {} } as RiskRewardInput);
const bhDebt = bh.per_sleeve.find((s) => s.sleeve === "Debt");
const bhIds = (bhDebt?.benchmark_blend?.constituents ?? []).map((c) => c.index_id);
assert(bhIds.includes("crisil_liquid") && !bhIds.includes("a_2y_tr"),
  "Bhatt Debt sleeve cash-gates HDFC Arbitrage to crisil_liquid (not a credit cell)", JSON.stringify(bhIds));

// 3) every DEBT_CELL_INDEX target the cases hit resolves to a real series in the snapshot
for (const id of ["crisil_short_term_bond", "crisil_liquid"]) {
  const mv = snap.indices?.[id]?.monthly_values;
  assert(mv && Object.keys(mv).length >= 60, `${id} has a real >=60-month series`, `${mv ? Object.keys(mv).length : 0}`);
}

console.log(fails === 0
  ? "\nOK: debt holdings resolve through decomposeHeldDebt -> DEBT_CELL_INDEX (with cash fallback) to real series."
  : `\nFAILED: ${fails} assertion(s).`);
process.exit(fails === 0 ? 0 : 1);
