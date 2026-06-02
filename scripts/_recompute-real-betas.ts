/* T-5.14 Option B: the deterministic recompute at the real-betas validation gate.
 * Runs computeRiskReward (the deterministic Layer 1 ONLY; no agent, no LLM, no API)
 * over the real-data t0 snapshot and the prior synthetic snapshot, and surfaces the
 * corrected portfolio/sleeve betas, Jensen's, the four benchmark-relative stats, and
 * the COVID drawdowns side by side. Also runs the time-varying 91-day T-Bill risk-free
 * through the seriesRiskFree socket to show it shifts only sharpe/sortino (beta is
 * R_f-invariant). Read-only; writes nothing.
 *
 * Run: npx tsx scripts/_recompute-real-betas.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  computeRiskReward, seriesRiskFree, RISK_FREE_ANN, type RiskRewardInput,
} from "../lib/agents/risk-reward-stats";
import { HOLDINGS_BY_INVESTOR } from "../db/fixtures/structured-holdings";

const DIR = path.resolve(process.cwd(), "fixtures/snapshots/enriched");
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));

const f3 = (v: number | null | undefined) => (v == null ? "  --  " : (v >= 0 ? " " : "") + v.toFixed(3));
const pct = (v: number | null | undefined) => (v == null ? "  --  " : (v * 100).toFixed(1) + "%");

function row(label: string, real: any, synth: any) {
  console.log(
    `    ${label.padEnd(11)} | beta ${f3(real?.beta_3y)} vs ${f3(synth?.beta_3y)}` +
    ` | jensen ${f3(real?.jensens_alpha_3y)} vs ${f3(synth?.jensens_alpha_3y)}` +
    ` | TE ${f3(real?.tracking_error_3y)} | IR ${f3(real?.information_ratio_3y)}` +
    ` | maxDD ${pct(real?.max_drawdown_3y)} vs ${pct(synth?.max_drawdown_3y)}`,
  );
}

async function main() {
  // The canonical filename now holds the landed real t0 (data-repo v2.0.0). The
  // synthetic baseline is preserved at the data repo's v1.0.0-frozen tag and is no
  // longer on disk; drop a copy at snapshot_t0_q2_2026_synthetic.json to get the
  // before/after columns, otherwise this recomputes the real betas alone.
  const real = load("snapshot_t0_q2_2026.json");
  const synth = (() => { try { return load("snapshot_t0_q2_2026_synthetic.json"); } catch { return null; } })();

  // time-varying risk-free from the new snapshot's 91-day T-Bill yields
  const tb = (real.debt_yield_primitives?.tbill_91d_yield?.annualised_yield_pct ?? {}) as Record<string, number>;
  const rfByMonth: Record<string, number> = {};
  for (const [m, v] of Object.entries(tb)) rfByMonth[m] = v / 100;
  const rfSeries = seriesRiskFree(rfByMonth, RISK_FREE_ANN);
  const rfMonths = Object.keys(rfByMonth).sort();
  console.log(`Time-varying 91-day T-Bill R_f: ${rfMonths.length} months, ` +
    `${(rfByMonth[rfMonths[0]] * 100).toFixed(2)}% (${rfMonths[0]}) .. ${(rfByMonth[rfMonths.at(-1)!] * 100).toFixed(2)}% (${rfMonths.at(-1)})\n`);

  for (const [name, holdings] of Object.entries(HOLDINGS_BY_INVESTOR)) {
    const baseR: RiskRewardInput = { caseId: name, asOfDate: "2026-04-02", holdings: holdings as any, snapshot: real, investor: {} };
    const r = computeRiskReward(baseR);
    const s = synth ? computeRiskReward({ ...baseR, snapshot: synth }) : null;
    const rTV = computeRiskReward({ ...baseR, riskFree: rfSeries });

    const pr = r.portfolio.stats, ps = s?.portfolio.stats ?? null;
    console.log(`=== ${name} === (evaluable ${r.portfolio.evaluable_weight_pct}% / sentinelled ${r.portfolio.sentinelled_weight_pct}%)`);
    row("PORTFOLIO", pr, ps);
    for (let i = 0; i < r.per_sleeve.length; i++) {
      const sl = r.per_sleeve[i];
      const ss = s?.per_sleeve.find((x) => x.sleeve === sl.sleeve);
      if (sl.stats) row(sl.sleeve, sl.stats, ss?.stats ?? null);
    }
    // World A benchmark blend (portfolio) + time-varying sharpe delta
    const blend = r.portfolio.benchmark_blend;
    if (blend) {
      const top = blend.constituents.slice(0, 5).map((c) => `${c.index_id} ${c.weight_pct}%`).join(", ");
      console.log(`    blend: ${top}${blend.constituents.length > 5 ? ", ..." : ""}`);
    }
    console.log(`    sharpe_3y const ${f3(pr?.sharpe_3y)} -> tvar ${f3(rTV.portfolio.stats?.sharpe_3y)}  |  ` +
      `sortino_3y const ${f3(pr?.sortino_3y)} -> tvar ${f3(rTV.portfolio.stats?.sortino_3y)}  (beta unchanged: ${f3(rTV.portfolio.stats?.beta_3y)})`);
    console.log("");
  }
  console.log("Deterministic recompute complete. No agent ran; no API credits spent.");
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
