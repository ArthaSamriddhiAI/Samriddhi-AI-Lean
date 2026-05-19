/* Read-only review surface for Risk-Reward Statistics (Step 4 / Step 6 data
 * review). Run via: npx tsx scripts/_print-risk-reward.ts [investor]
 *
 * Prints the full per-holding / per-sleeve / per-portfolio / rollup output
 * for one investor at t0, then a compact t0/t5/t6 regime table. Deterministic,
 * no API spend, writes no fixtures (the templated rollup path only). Default
 * investor is bhatt (the canonical S2, "Shailesh"). */

import { loadSnapshot } from "../lib/agents/snapshot-loader";
import { runRiskRewardDeterministic } from "../lib/agents/risk-reward-stats";
import { HOLDINGS_BY_INVESTOR } from "../db/fixtures/structured-holdings";

const inv = (process.argv[2] ?? "bhatt").toLowerCase();
const holdings = HOLDINGS_BY_INVESTOR[inv];
if (!holdings) {
  console.error(`unknown investor '${inv}'. known: ${Object.keys(HOLDINGS_BY_INVESTOR).join(", ")}`);
  process.exit(1);
}

const n = (x: number | null | undefined) => (x == null ? "  -  " : x.toFixed(4).padStart(7));

async function one(snapshotId: string) {
  const snap = await loadSnapshot(snapshotId);
  return runRiskRewardDeterministic({
    caseId: `print-${inv}-${snapshotId}`,
    asOfDate: snapshotId,
    holdings,
    snapshot: snap,
    investor: { riskAppetite: "Aggressive", liquidityTier: "secondary" },
  });
}

async function main() {
  const o = await one("t0_q2_2026");
  console.log(`\n=== Risk-Reward: ${inv} @ t0_q2_2026 ===`);
  console.log(`snapshot_context: ${JSON.stringify(o.snapshot_context)}  rf=${o.risk_free_rate}`);

  console.log(`\n-- per-holding (${o.per_holding.length}) --`);
  console.log("instrument".padEnd(40), "subcat".padEnd(22), "src/sentinel".padEnd(34), "sharpe3 vol3   beta3   maxdd3");
  for (const h of o.per_holding) {
    const tag = h.sentinel ? h.sentinel : h.source;
    const s = h.stats;
    console.log(
      h.holding_ref.slice(0, 39).padEnd(40),
      h.sub_category.padEnd(22),
      String(tag).padEnd(34),
      `${n(s?.sharpe_3y)} ${n(s?.vol_3y_annualized)} ${n(s?.beta_3y)} ${n(s?.max_drawdown_3y)}`,
    );
  }

  console.log(`\n-- per-sleeve --`);
  for (const sl of [...o.per_sleeve, o.portfolio]) {
    const s = sl.stats;
    console.log(
      sl.sleeve.padEnd(12),
      `method=${sl.method}`.padEnd(34),
      `eval=${sl.evaluable_weight_pct}% sent=${sl.sentinelled_weight_pct}% partial=${sl.partial_evaluation}`.padEnd(40),
      sl.sentinel ? `sentinel=${sl.sentinel}` : `sharpe3=${n(s?.sharpe_3y)} vol3=${n(s?.vol_3y_annualized)} beta3=${n(s?.beta_3y)} r2=${n(s?.r_squared_3y)} ir3=${n(s?.information_ratio_3y)} maxdd3=${n(s?.max_drawdown_3y)}`,
    );
  }

  console.log(`\n-- rollup --`);
  console.log(`generation_method=${o.rollup.generation_method} llm_fallback_trigger=${o.rollup.llm_fallback_trigger ?? "none"} is_synthetic_forward=${o.rollup.is_synthetic_forward}`);
  console.log(o.rollup.text);
  console.log(`\nreasoning_summary: ${o.reasoning_summary}`);

  console.log(`\n=== regime table (${inv}) t0 / t5 / t6 ===`);
  const o5 = await one("t5_q3_2027");
  const o6 = await one("t6_q4_2027");
  const pick = (oo: typeof o, ref: string, k: "max_drawdown_3y" | "sharpe_3y") =>
    oo.per_holding.find((h) => h.holding_ref === ref)?.stats?.[k] ?? null;
  console.log("metric".padEnd(36), "t0".padStart(9), "t5".padStart(9), "t6".padStart(9));
  console.log("Reliance max_drawdown_3y".padEnd(36), n(pick(o, "Reliance Industries", "max_drawdown_3y")), n(pick(o5, "Reliance Industries", "max_drawdown_3y")), n(pick(o6, "Reliance Industries", "max_drawdown_3y")));
  console.log("HDFC Bank max_drawdown_3y".padEnd(36), n(pick(o, "HDFC Bank", "max_drawdown_3y")), n(pick(o5, "HDFC Bank", "max_drawdown_3y")), n(pick(o6, "HDFC Bank", "max_drawdown_3y")));
  console.log("portfolio sharpe_3y".padEnd(36), n(o.portfolio.stats?.sharpe_3y), n(o5.portfolio.stats?.sharpe_3y), n(o6.portfolio.stats?.sharpe_3y));
  console.log("portfolio vol_3y".padEnd(36), n(o.portfolio.stats?.vol_3y_annualized), n(o5.portfolio.stats?.vol_3y_annualized), n(o6.portfolio.stats?.vol_3y_annualized));
  console.log("portfolio max_drawdown_3y".padEnd(36), n(o.portfolio.stats?.max_drawdown_3y), n(o5.portfolio.stats?.max_drawdown_3y), n(o6.portfolio.stats?.max_drawdown_3y));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
