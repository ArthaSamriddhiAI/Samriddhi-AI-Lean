/* Verification script for Risk-Reward Statistics (Step 3 deterministic tests
 * + Step 2.9 regime validation). Run via:
 *   npx tsx scripts/_verify-risk-reward.ts
 *
 * Deterministic, no API spend (the templated rollup path only; the LLM
 * fallback is WA12-gated and never invoked here). Asserts and exits non-zero
 * on failure (the going-forward _verify-* convention).
 *
 * Regime narrative is sourced from scripts/_verify-snapshot-enrichment.ts and
 * ADR-0008 (the SNAPSHOT_TEST_AXIS_DESIGN.md the prompt names does not exist;
 * D4): RIL idiosyncratic beat -26% in 2027-10 lands at t6; bank shock -16% in
 * 2027-07 lands at t5. Bhatt (the canonical S2, "Shailesh") holds Reliance
 * and HDFC Bank directly and no SBI, so the SBI cluster-3 wrinkle does not
 * apply and no exclusion is needed. */

import { loadSnapshot } from "../lib/agents/snapshot-loader";
import { runRiskRewardDeterministic, PMS_AIF_FRAMEWORK_TEXT } from "../lib/agents/risk-reward-stats";
import { BHATT_HOLDINGS } from "../db/fixtures/structured-holdings";

type Failure = { name: string; detail: string };
const failures: Failure[] = [];
function assert(cond: boolean, name: string, detail: string) {
  if (!cond) failures.push({ name, detail });
  console.log(`  [${cond ? "PASS" : "FAIL"}] ${name}${cond ? "" : ` :: ${detail}`}`);
}

function run(snapshotId: string, snap: Awaited<ReturnType<typeof loadSnapshot>>) {
  return runRiskRewardDeterministic({
    caseId: `verify-${snapshotId}`,
    asOfDate: snapshotId,
    holdings: BHATT_HOLDINGS,
    snapshot: snap,
    investor: { riskAppetite: "Aggressive", liquidityTier: "secondary" },
  });
}

async function main() {
  const s0 = await loadSnapshot("t0_q2_2026");
  const out0 = run("t0_q2_2026", s0);

  console.log("Probe A: sentinel taxonomy on the canonical S2 (Bhatt)");
  const byRef = new Map(out0.per_holding.map((h) => [h.holding_ref, h]));
  const pms = out0.per_holding.find((h) => h.sub_category.startsWith("pms_"));
  assert(pms?.sentinel === "pms_disclosure_limited" && pms?.stats === null,
    "PMS holding -> pms_disclosure_limited, stats null", `${pms?.sentinel}`);
  const aif = out0.per_holding.find((h) => h.sub_category.startsWith("aif_"));
  assert(aif?.sentinel === "opaque_wrapper" && aif?.stats === null,
    "AIF holding -> opaque_wrapper, stats null", `${aif?.sentinel}`);
  const fd = byRef.get("HDFC Bank FD");
  assert(fd?.sentinel === "not_applicable_for_risk_reward",
    "HDFC Bank FD -> not_applicable_for_risk_reward", `${fd?.sentinel}`);

  console.log("Probe B: per-holding read-through correctness");
  const mf = out0.per_holding.find(
    (h) => h.sub_category.startsWith("mf_") && h.source === "tier_b_read_through",
  );
  assert(!!mf && typeof mf.stats?.sharpe_3y === "number",
    "an MF holding reads through numeric sharpe_3y", `${mf?.holding_ref} ${mf?.stats?.sharpe_3y}`);
  // read-through must equal the snapshot's stored value (no recompute)
  if (mf) {
    const f = s0.mf_funds.find((x) => {
      const n = (x.fund_name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const t = mf.holding_ref.toLowerCase().replace(/[^a-z0-9]/g, "");
      return n.startsWith(t) || n.includes(t);
    });
    const stored = f?.tier_b_stats?.sharpe_3y;
    assert(stored != null && mf.stats?.sharpe_3y === stored,
      "read-through sharpe_3y equals the snapshot stored value (no recompute)",
      `out=${mf.stats?.sharpe_3y} stored=${stored}`);
  }
  const ril = byRef.get("Reliance Industries");
  assert(ril?.source === "tier_b_read_through" && typeof ril?.stats?.beta_3y === "number",
    "Reliance reads through numeric beta_3y (stock benchmark-relative)", `${ril?.stats?.beta_3y}`);

  console.log("Probe C: sleeve / portfolio aggregation");
  const eq = out0.per_sleeve.find((s) => s.sleeve === "Equity");
  assert(!!eq && eq.stats != null && eq.method === "synthesised_series",
    "Equity sleeve computes a synthesised-series stat block", `${eq?.method}`);
  assert(!!eq && eq.partial_evaluation === true && eq.sentinelled_weight_pct > 0,
    "Equity sleeve is partial-evaluation (PMS weight sentinelled)",
    `eval=${eq?.evaluable_weight_pct} sent=${eq?.sentinelled_weight_pct}`);
  const alt = out0.per_sleeve.find((s) => s.sleeve === "Alternatives");
  assert(!!alt && alt.method === "sentinel" && alt.sentinel === "no_constituents_evaluable",
    "Alternatives sleeve (AIF only) -> no_constituents_evaluable", `${alt?.method}/${alt?.sentinel}`);
  assert(out0.portfolio.stats != null && typeof out0.portfolio.stats.sharpe_3y === "number",
    "portfolio carries a numeric synthesised Sharpe", `${out0.portfolio.stats?.sharpe_3y}`);
  assert(out0.risk_free_rate === 0.0525, "risk_free_rate is the documented 5.25% (ADR-0012)",
    `${out0.risk_free_rate}`);

  console.log("Probe D: rollup + synthetic-forward disclosure");
  assert(out0.rollup.generation_method === "templated" && /Sharpe/.test(out0.rollup.text),
    "t0 rollup is templated and cites Sharpe", out0.rollup.text.slice(0, 80));
  assert(out0.snapshot_context.is_synthetic_forward === false &&
    out0.rollup.synthetic_forward_disclosure === null,
    "t0 (baseline) is not synthetic-forward, no disclosure", `${out0.snapshot_context.is_synthetic_forward}`);
  const s5 = await loadSnapshot("t5_q3_2027");
  const out5 = run("t5_q3_2027", s5);
  assert(out5.snapshot_context.is_synthetic_forward === true &&
    !!out5.rollup.synthetic_forward_disclosure &&
    out5.rollup.text.includes(out5.rollup.synthetic_forward_disclosure),
    "t5 is synthetic-forward and the disclosure is plumbed into the rollup",
    `${out5.snapshot_context.is_synthetic_forward}`);

  console.log("Probe E: regime validation (Bhatt across t0/t5/t6)");
  const s6 = await loadSnapshot("t6_q4_2027");
  const out6 = run("t6_q4_2027", s6);
  const rilDD = (o: typeof out0) =>
    o.per_holding.find((h) => h.holding_ref === "Reliance Industries")?.stats?.max_drawdown_3y ?? null;
  const hdfcDD = (o: typeof out0) =>
    o.per_holding.find((h) => h.holding_ref === "HDFC Bank")?.stats?.max_drawdown_3y ?? null;
  const dd0 = rilDD(out0), dd6 = rilDD(out6);
  assert(dd0 != null && dd6 != null && dd6 < dd0,
    "Reliance max_drawdown_3y is deeper at t6 than t0 (RIL idio beat -26% 2027-10)",
    `t0=${dd0} t6=${dd6}`);
  const hd0 = hdfcDD(out0), hd5 = hdfcDD(out5);
  assert(hd0 != null && hd5 != null && hd5 < hd0,
    "HDFC Bank max_drawdown_3y is deeper at t5 than t0 (bank shock -16% 2027-07)",
    `t0=${hd0} t5=${hd5}`);
  const sh0 = out0.portfolio.stats?.sharpe_3y ?? null;
  const sh6 = out6.portfolio.stats?.sharpe_3y ?? null;
  assert(sh0 != null && sh6 != null && sh6 <= sh0,
    "Bhatt portfolio Sharpe_3y at t6 <= t0 (cumulative regime stress)",
    `t0=${sh0} t6=${sh6}`);
  const hasSBI = BHATT_HOLDINGS.holdings.some((h) => /sbi/i.test(h.instrument));
  assert(!hasSBI, "Bhatt has no SBI holding (cluster-3 SBI wrinkle does not apply)", `${hasSBI}`);

  console.log("Probe F: pms_aif_framework_notice (four-thesis framework)");
  const fw = out0.pms_aif_framework_notice;
  assert(
    fw.applies === true && fw.text === PMS_AIF_FRAMEWORK_TEXT,
    "Bhatt (holds PMS + AIF) -> framework notice applies with verbatim text",
    `applies=${fw.applies} textMatch=${fw.text === PMS_AIF_FRAMEWORK_TEXT}`,
  );

  console.log("");
  if (failures.length === 0) {
    console.log("OK: all risk-reward deterministic + regime probes passed.");
    process.exit(0);
  } else {
    console.error(`FAILED: ${failures.length} assertion(s) failed.`);
    for (const f of failures) console.error(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FAILED: unexpected error", e);
  process.exit(1);
});
