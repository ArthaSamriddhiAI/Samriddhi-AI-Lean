/* Unit test for decomposeHeldDebt (T-5.14 Task 4): classify held debt funds into
 * their duration-by-credit cell (ADR-0037) against the current snapshot. Pure
 * deterministic, cross-sectional only. No LLM call.
 *
 * Run: npx tsx scripts/_verify-held-debt.ts
 */
import { loadSnapshot } from "../lib/agents/snapshot-loader";
import { buildInstrumentUniverse, decomposeHeldDebt } from "../lib/agents/instrument-selection";
import type { Holding } from "@/db/fixtures/structured-holdings";

type Case = { name: string; credit: string | null; duration: string | null };

// Expected cells worked out from the classifier rules (gilt -> sovereign;
// Corporate Bond -> high_grade; Credit Risk -> credit_risk; duration funds use
// SOV-aware credit and the Duration metric: < 3y short, > 5y long, else medium).
const CASES: Case[] = [
  { name: "Aditya Birla Sun Life Government Securities Fund  - Growth - Regular Plan", credit: "sovereign", duration: "long" },
  { name: "Franklin India Corporate Debt Fund - Growth", credit: "high_grade", duration: "short" },
  { name: "DSP Credit Risk Fund - Regular Plan -Growth", credit: "credit_risk", duration: "short" },
  { name: "Aditya Birla Sun Life Liquid Fund - Growth", credit: "high_grade", duration: "short" },
  { name: "ICICI Prudential Long Term Bond Fund - Growth", credit: "sovereign", duration: "long" },
  { name: "DSP Short Term Fund - Regular Plan - Growth", credit: "high_grade", duration: "short" },
];

function holding(instrument: string): Holding {
  return { instrument, assetClass: "Debt", subCategory: "mf_corporate_debt", valueCr: 1, weightPct: 10 };
}

async function main() {
  const snap = await loadSnapshot("t0_q2_2026");
  const universe = buildInstrumentUniverse(snap);
  let fails = 0;
  const assert = (cond: boolean, label: string, detail: string) => {
    if (!cond) fails++;
    console.log(`  [${cond ? "PASS" : "FAIL"}] ${label}${cond ? "" : ` :: ${detail}`}`);
  };

  console.log("Probe A: known debt funds classify to the expected duration-by-credit cell");
  for (const c of CASES) {
    const d = decomposeHeldDebt(holding(c.name), universe);
    assert(
      d.matched && d.credit_bucket === c.credit && d.duration_bucket === c.duration,
      `${c.name.slice(0, 42)} -> (${c.credit}, ${c.duration})`,
      `matched=${d.matched} got=(${d.credit_bucket}, ${d.duration_bucket}) src=${d.duration_source}`,
    );
  }

  console.log("Probe B: an unmatched name returns matched=false with null buckets");
  const miss = decomposeHeldDebt(holding("Definitely Not A Real Fund XYZ 999"), universe);
  assert(!miss.matched && miss.credit_bucket === null && miss.duration_bucket === null,
    "unmatched -> matched=false, null cell", `matched=${miss.matched} cell=(${miss.credit_bucket},${miss.duration_bucket})`);

  console.log("Probe C: weight and a non-empty label are carried through");
  const one = decomposeHeldDebt(holding(CASES[0].name), universe);
  assert(one.weight_pct === 10 && one.type_label.length > 0,
    "weight_pct preserved and type_label populated", `w=${one.weight_pct} label="${one.type_label}"`);

  console.log("");
  if (fails === 0) { console.log("OK: decomposeHeldDebt classifies the snapshot debt universe correctly."); process.exit(0); }
  console.error(`FAILED: ${fails} assertion(s).`); process.exit(1);
}

main().catch((e) => { console.error("FAILED: unexpected error", e); process.exit(1); });
