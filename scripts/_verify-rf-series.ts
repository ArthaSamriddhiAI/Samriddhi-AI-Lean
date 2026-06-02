/* Degenerate-series test for the time-varying risk-free plumbing (T-5.14).
 *
 * The refactor lets sharpe / sortino / Jensen's consume a risk-free *series*
 * instead of the static RISK_FREE_ANN. The correctness guarantee is that the
 * constant fed as a FLAT series must reproduce the constant-rf numbers EXACTLY.
 * This asserts that, deterministically, across three archetypes. No LLM call.
 *
 * Run: npx tsx scripts/_verify-rf-series.ts
 */
import { loadSnapshot } from "../lib/agents/snapshot-loader";
import {
  computeRiskReward,
  seriesRiskFree,
  RISK_FREE_ANN,
  type RiskRewardInput,
} from "../lib/agents/risk-reward-stats";
import {
  BHATT_HOLDINGS,
  MALHOTRA_HOLDINGS,
  SURANA_HOLDINGS,
} from "../db/fixtures/structured-holdings";

const FIELDS = [
  "sharpe_3y", "sharpe_5y", "sortino_3y", "sortino_5y", "jensens_alpha_3y",
  "beta_3y", "r_squared_3y", "tracking_error_3y", "information_ratio_3y", "vol_3y_annualized",
] as const;

type Stats = Record<string, number | null | undefined> | null | undefined;

async function main() {
  const snap = await loadSnapshot("t0_q2_2026");

  // The degenerate series: RISK_FREE_ANN every month (a flat single-value series).
  const flatByMonth: Record<string, number> = {};
  for (let y = 2018; y <= 2029; y++) {
    for (let m = 1; m <= 12; m++) flatByMonth[`${y}-${String(m).padStart(2, "0")}`] = RISK_FREE_ANN;
  }
  const flat = seriesRiskFree(flatByMonth, RISK_FREE_ANN);

  let fails = 0;
  const cmp = (a: Stats, b: Stats, where: string) => {
    for (const f of FIELDS) {
      const av = a?.[f] ?? null;
      const bv = b?.[f] ?? null;
      if (av !== bv) { fails++; console.log(`  FAIL ${where}.${f}: constant=${av} flatSeries=${bv}`); }
    }
  };

  const cases: Array<[string, RiskRewardInput["holdings"]]> = [
    ["bhatt", BHATT_HOLDINGS], ["malhotra", MALHOTRA_HOLDINGS], ["surana", SURANA_HOLDINGS],
  ];
  for (const [name, holdings] of cases) {
    const base: RiskRewardInput = {
      caseId: `rf-${name}`, asOfDate: "2026-04-02", holdings, snapshot: snap, investor: {},
    };
    const constOut = computeRiskReward(base);                       // default constant rf
    const seriesOut = computeRiskReward({ ...base, riskFree: flat }); // flat series rf
    cmp(constOut.portfolio.stats, seriesOut.portfolio.stats, `${name} portfolio`);
    for (let i = 0; i < constOut.per_sleeve.length; i++) {
      cmp(constOut.per_sleeve[i].stats, seriesOut.per_sleeve[i].stats, `${name} sleeve[${constOut.per_sleeve[i].sleeve}]`);
    }
    const pb = constOut.portfolio.stats;
    console.log(`  ${name}: portfolio sharpe_3y=${pb?.sharpe_3y} sortino_3y=${pb?.sortino_3y} jensens_3y=${pb?.jensens_alpha_3y} beta_3y=${pb?.beta_3y} (constant == flat series)`);
  }

  console.log(
    fails === 0
      ? "\nOK: a flat seriesRiskFree reproduces constant rf EXACTLY across all stats and sleeves."
      : `\nFAILED: ${fails} field mismatch(es).`,
  );
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => { console.error("FAILED: unexpected error", e); process.exit(1); });
