/* Risk-Reward Statistics, the return-evidence layer.
 *
 * Skill: agents/risk_reward_stats.md
 *
 * Two-layer shape, like A2 and M0.PortfolioRiskAnalytics:
 *
 *   Layer 1 (computeRiskReward): pure, deterministic. Per-holding stats are
 *   read-through from the snapshot's pre-computed tier_b_stats (ADR-0012,
 *   ADR-0014/0015 for funds); the contract is read-through, never recompute.
 *   Per-sleeve and per-portfolio stats are computed fresh on a synthesised
 *   market-value-weighted return series built from the evaluable
 *   constituents (weighted-average-of-Sharpes is statistically wrong and is
 *   never produced). No LLM, no Date.now in the computed values.
 *
 *   Layer 2 (the rollup): templated and deterministic for the common case;
 *   an enumerated set of edge cases routes to a strict LLM fallback with the
 *   generation method disclosed on the output. The LLM path is the only part
 *   that calls the model and is gated (WA12).
 *
 * Sibling to lib/agents/portfolio-risk-analytics.ts (the deterministic
 * feeder, M0.PortfolioAnalytics in skill nomenclature); the output sits
 * alongside PortfolioMetrics on the case and feeds Dimension 4 of the
 * interpretive verdict skill (agents/m0_portfolio_risk_analytics.md) when it
 * ships in cluster 7. Risk-reward ships data only; the renderer is untouched
 * (WA9).
 *
 * Risk-free rate is the documented 5.25% repo rate per ADR-0012 (the audit
 * confirmed no rf field exists in snapshot_metadata; D2). RF configurability
 * is product debt, deliberately not added.
 */

import type { Snapshot, MutualFundRow, TierBStats } from "./snapshot-loader";
import type { StructuredHoldings, Holding, AssetClass } from "@/db/fixtures/structured-holdings";
import { callAgent, type AgentUsage } from "./harness";
import { stripLongDashes } from "./a2-classification"; // reuse the WA7 sanitiser; do not redefine

export const RISK_FREE_ANN = 0.0525; // per ADR-0012 (repo rate at t0); not read from provenance (D2)

/* ----- Sentinel taxonomy (ADR-0017 candidate; Checkpoint 1 approved) ----- */

export type RiskRewardSentinel =
  | "opaque_wrapper" // AIF: no return data exists (foundation opaque-by-design)
  | "pms_disclosure_limited" // PMS: no monthly NAV; rolling stats not computable
  | "not_applicable_for_risk_reward" // FD, gold, savings: no return series
  | "insufficient_history" // tier_b data_window_insufficient
  | "benchmark_structurally_inapplicable" // fund design resists single-index comparison
  | "benchmark_not_in_snapshot" // comparator exists but not in the canonical 16
  | "currency_conversion_pending" // foreign-currency holding, FX series absent
  | "no_constituents_evaluable"; // sleeve where every constituent is sentinelled

export const TIER_B_FIELDS = [
  "vol_3y_annualized", "vol_5y_annualized", "sharpe_3y", "sharpe_5y",
  "sortino_3y", "sortino_5y", "max_drawdown_3y", "max_drawdown_5y",
  "calmar_3y", "beta_3y", "r_squared_3y", "tracking_error_3y",
  "information_ratio_3y",
] as const;

export type TierBValues = Partial<Record<(typeof TIER_B_FIELDS)[number], number | null>>;

export type SnapshotContext = {
  snapshot_id: string;
  snapshot_date: string;
  is_synthetic_forward: boolean;
  enrichment_version: string | null;
};

export type HoldingStats = {
  holding_ref: string;
  instrument_display_name: string;
  asset_class: string;
  sub_category: string;
  weight_pct: number;
  currency_basis: "INR" | "USD" | "native";
  source: "tier_b_read_through" | "sentinel";
  sentinel: RiskRewardSentinel | null;
  benchmark_index_id: string | null;
  stats: TierBValues | null;
};

export type SleeveStats = {
  sleeve: "Equity" | "Debt" | "Alternatives" | "Cash" | "portfolio";
  constituents: string[];
  evaluable_weight_pct: number;
  sentinelled_weight_pct: number;
  partial_evaluation: boolean;
  currency_basis: "INR";
  method: "synthesised_series" | "single_holding_passthrough" | "sentinel";
  sentinel: RiskRewardSentinel | null;
  benchmark_index_id: string | null;
  stats: TierBValues | null;
};

export type RiskRewardRollup = {
  text: string;
  generation_method: "templated" | "llm_fallback";
  llm_fallback_trigger: string | null;
  is_synthetic_forward: boolean;
  synthetic_forward_disclosure: string | null;
};

export type RiskRewardOutput = {
  agent_id: "risk_reward_stats";
  case_id: string;
  as_of_date: string;
  snapshot_context: SnapshotContext;
  risk_free_rate: number;
  per_holding: HoldingStats[];
  per_sleeve: SleeveStats[];
  portfolio: SleeveStats;
  rollup: RiskRewardRollup;
  reasoning_summary: string;
};

export type RiskRewardInput = {
  caseId: string;
  asOfDate: string;
  holdings: StructuredHoldings;
  snapshot: Snapshot;
  investor: { riskAppetite?: string; liquidityTier?: string };
};

/* ----- Sleeve benchmark mapping (reuses the canonical-16 ids) ----- */

const SLEEVE_BENCHMARK: Record<AssetClass, string | null> = {
  Equity: "nifty_500_tri",
  Debt: "crisil_composite_bond",
  Alternatives: null, // dominated by opaque AIF; sleeve sentinelled when no evaluable constituent
  Cash: null,
};

/* ----- Holding classification ----- */

function isPMS(sub: string): boolean {
  return sub.startsWith("pms_");
}
function isAIF(sub: string): boolean {
  return sub.startsWith("aif_");
}
function isMF(sub: string): boolean {
  return sub.startsWith("mf_");
}
function isListed(sub: string): boolean {
  return sub.startsWith("listed_") || sub.startsWith("intl_");
}
function isNotApplicable(sub: string): boolean {
  // FDs, gold, REIT, savings: no consumable return series in the snapshot.
  return (
    sub === "bank_fd" ||
    sub === "tax_free_bond" ||
    sub === "physical_gold" ||
    sub === "sovereign_gold_bond" ||
    sub === "reit" ||
    sub === "savings"
  );
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* MF look-through match: the seed uses the foundation's canonical fund name;
 * the snapshot fund_name may carry a "Regular Growth" or "Direct Growth"
 * suffix. Prefix/contains match on normalised names, as
 * portfolio-risk-analytics.findFundInSnapshot does (single source of truth
 * for the matching convention). */
function findFund(snapshot: Snapshot, instrument: string): MutualFundRow | undefined {
  const t = norm(instrument);
  if (!t) return undefined;
  return snapshot.mf_funds.find((f) => {
    const n = norm(f.fund_name ?? "");
    return n.length > 0 && (n.startsWith(t) || n.includes(t));
  });
}

type Nifty500Co = { name?: string; monthly_prices?: Record<string, number>; tier_b_stats?: TierBStats };

function findStock(snapshot: Snapshot, instrument: string): Nifty500Co | undefined {
  const n5 = snapshot.nifty500 as { companies?: Nifty500Co[] } | undefined;
  const comps = n5?.companies;
  if (!comps) return undefined;
  const t = norm(instrument);
  if (!t) return undefined;
  return comps.find((c) => {
    const n = norm(c.name ?? "");
    return n.length > 0 && (n === t || n.startsWith(t) || t.startsWith(n));
  });
}

function pickTierB(tb: TierBValues): TierBValues {
  const out: TierBValues = {};
  for (const k of TIER_B_FIELDS) out[k] = (tb as TierBValues)[k] ?? null;
  return out;
}

/* ----- Deterministic stat helpers (ADR-0012 formulas; ADR-0015 calendar
 * alignment for benchmark-relative). Log returns; sample variance ddof=1;
 * annualise by sqrt(12) / mean*12. ----- */

function logReturnsByMonth(series: Record<string, number>): Record<string, number> {
  const ks = Object.keys(series).sort();
  const out: Record<string, number> = {};
  for (let i = 1; i < ks.length; i++) {
    const p0 = series[ks[i - 1]];
    const p1 = series[ks[i]];
    if (p0 && p1 && p0 > 0 && p1 > 0) out[ks[i]] = Math.log(p1 / p0);
  }
  return out;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function sampleVar(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
}
function annReturn(rets: number[], window?: number): number | null {
  const r = window ? rets.slice(-window) : rets;
  if (r.length === 0) return null;
  return Math.exp(mean(r) * 12) - 1;
}
function annVol(rets: number[], window?: number): number | null {
  const r = window ? rets.slice(-window) : rets;
  if (r.length < 2) return null;
  return Math.sqrt(sampleVar(r)) * Math.sqrt(12);
}
function sharpe(rets: number[], window?: number): number | null {
  const ar = annReturn(rets, window);
  const av = annVol(rets, window);
  if (ar === null || av === null || av === 0) return null;
  return (ar - RISK_FREE_ANN) / av;
}
function sortino(rets: number[], window?: number): number | null {
  const r = window ? rets.slice(-window) : rets;
  if (r.length < 2) return null;
  const rfM = Math.log(1 + RISK_FREE_ANN) / 12;
  const down = r.filter((x) => x < rfM).map((x) => x - rfM);
  if (down.length === 0) return null;
  const dv = Math.sqrt(down.reduce((a, b) => a + b * b, 0) / down.length) * Math.sqrt(12);
  const ar = annReturn(r);
  if (dv === 0 || ar === null) return null;
  return (ar - RISK_FREE_ANN) / dv;
}
function maxDrawdown(series: Record<string, number>): number | null {
  const ks = Object.keys(series).sort();
  if (ks.length < 2) return null;
  let peak = series[ks[0]];
  let mdd = 0;
  for (const k of ks.slice(1)) {
    const v = series[k];
    if (v == null) continue;
    if (v > peak) peak = v;
    const dd = (v - peak) / peak;
    if (dd < mdd) mdd = dd;
  }
  return mdd;
}
function round4(x: number | null): number | null {
  return x == null ? null : Math.round(x * 1e4) / 1e4;
}

/* Calendar-aligned beta/r2/te/ir (ADR-0015): align on shared YYYY-MM keys,
 * beta/r2 over the full intersection, te/ir over the trailing 36. */
function benchRelative(
  navOrPrice: Record<string, number>,
  benchValues: Record<string, number>,
): { beta_3y: number | null; r_squared_3y: number | null; tracking_error_3y: number | null; information_ratio_3y: number | null } {
  const fr = logReturnsByMonth(navOrPrice);
  const br = logReturnsByMonth(benchValues);
  const common = Object.keys(fr).filter((m) => m in br).sort();
  const nil = { beta_3y: null, r_squared_3y: null, tracking_error_3y: null, information_ratio_3y: null };
  if (common.length < 12) return nil;
  const s = common.map((m) => fr[m]);
  const b = common.map((m) => br[m]);
  const ms = mean(s);
  const mb = mean(b);
  const n = common.length;
  const cov = s.reduce((acc, _, i) => acc + (s[i] - ms) * (b[i] - mb), 0) / (n - 1);
  const vb = sampleVar(b);
  const vs = sampleVar(s);
  if (vb === 0 || vs === 0) return nil;
  const beta = cov / vb;
  const r2 = (cov / Math.sqrt(vs * vb)) ** 2;
  const w = common.slice(-36);
  const sw = w.map((m) => fr[m]);
  const bw = w.map((m) => br[m]);
  const diffs = sw.map((x, i) => x - bw[i]);
  const te = Math.sqrt(sampleVar(diffs)) * Math.sqrt(12);
  const annS = Math.exp(mean(sw) * 12) - 1;
  const annB = Math.exp(mean(bw) * 12) - 1;
  const ir = te ? (annS - annB) / te : null;
  return {
    beta_3y: round4(beta),
    r_squared_3y: round4(r2),
    tracking_error_3y: round4(te),
    information_ratio_3y: ir == null ? null : round4(ir),
  };
}

/* ----- Layer 1: per-holding (read-through) ----- */

function holdingMonthlySeries(
  h: Holding,
  snapshot: Snapshot,
): { series: Record<string, number>; tb: TierBValues; benchId: string | null } | null {
  if (isMF(h.subCategory)) {
    const f = findFund(snapshot, h.instrument);
    if (!f || !f.monthly_nav || !f.tier_b_stats) return null;
    const tb = f.tier_b_stats as TierBValues & { data_window_insufficient?: boolean; _benchmark_resolution?: string; _meta?: { benchmark_index_id?: string } };
    return { series: f.monthly_nav, tb, benchId: f.tier_b_stats._meta?.benchmark_index_id ?? null };
  }
  if (isListed(h.subCategory)) {
    const c = findStock(snapshot, h.instrument);
    if (!c || !c.monthly_prices || !c.tier_b_stats) return null;
    return { series: c.monthly_prices, tb: c.tier_b_stats as TierBValues, benchId: c.tier_b_stats._meta?.benchmark_index_id ?? null };
  }
  return null;
}

function classifyHolding(h: Holding, snapshot: Snapshot): HoldingStats {
  const base = {
    holding_ref: h.instrument,
    instrument_display_name: h.instrument,
    asset_class: h.assetClass,
    sub_category: h.subCategory,
    weight_pct: h.weightPct,
    currency_basis: (h.subCategory.startsWith("intl_") ? "native" : "INR") as "INR" | "native",
  };
  const sentinel = (s: RiskRewardSentinel): HoldingStats => ({
    ...base, source: "sentinel", sentinel: s, benchmark_index_id: null, stats: null,
  });

  if (isAIF(h.subCategory)) return sentinel("opaque_wrapper");
  if (isPMS(h.subCategory)) return sentinel("pms_disclosure_limited");
  if (isNotApplicable(h.subCategory)) return sentinel("not_applicable_for_risk_reward");

  if (isMF(h.subCategory) || isListed(h.subCategory)) {
    const found = holdingMonthlySeries(h, snapshot);
    if (!found) return sentinel("not_applicable_for_risk_reward");
    const tb = found.tb as TierBValues & { data_window_insufficient?: boolean; _benchmark_resolution?: string };
    if (tb.data_window_insufficient) return sentinel("insufficient_history");
    if (tb._benchmark_resolution === "benchmark_structurally_inapplicable") {
      // self-stats still valid; only benchmark-relative is sentinelled
      const v = pickTierB(tb);
      v.beta_3y = null; v.r_squared_3y = null; v.tracking_error_3y = null; v.information_ratio_3y = null;
      return { ...base, source: "tier_b_read_through", sentinel: "benchmark_structurally_inapplicable", benchmark_index_id: null, stats: v };
    }
    if (tb._benchmark_resolution === "benchmark_not_in_snapshot") {
      const v = pickTierB(tb);
      v.beta_3y = null; v.r_squared_3y = null; v.tracking_error_3y = null; v.information_ratio_3y = null;
      return { ...base, source: "tier_b_read_through", sentinel: "benchmark_not_in_snapshot", benchmark_index_id: null, stats: v };
    }
    return {
      ...base,
      source: "tier_b_read_through",
      sentinel: null,
      benchmark_index_id: found.benchId,
      stats: pickTierB(tb),
    };
  }
  return sentinel("not_applicable_for_risk_reward");
}

/* ----- Layer 1: sleeve / portfolio (synthesised series) ----- */

function synthesiseSeries(
  constituents: Array<{ h: Holding; series: Record<string, number> }>,
): Record<string, number> {
  // Market-value weighted (valueCr), renormalised over the evaluable set.
  const totalVal = constituents.reduce((a, c) => a + c.h.valueCr, 0) || 1;
  const rets = constituents.map((c) => ({ w: c.h.valueCr / totalVal, r: logReturnsByMonth(c.series) }));
  const months = Array.from(
    new Set(rets.flatMap((x) => Object.keys(x.r))),
  ).sort();
  // index level 1000, compounding the weighted monthly return where every
  // constituent has that month (intersection keeps the weighting honest).
  const out: Record<string, number> = {};
  let lvl = 1000;
  for (const m of months) {
    const present = rets.filter((x) => m in x.r);
    if (present.length !== rets.length) continue; // strict intersection
    const wsum = present.reduce((a, x) => a + x.w, 0);
    const r = present.reduce((a, x) => a + (x.w / wsum) * x.r[m], 0);
    lvl = lvl * Math.exp(r);
    out[m] = lvl;
  }
  return out;
}

function aggregate(
  sleeve: SleeveStats["sleeve"],
  holdings: Holding[],
  snapshot: Snapshot,
  benchId: string | null,
): SleeveStats {
  const evaluable: Array<{ h: Holding; series: Record<string, number> }> = [];
  let evalWeight = 0;
  let sentWeight = 0;
  for (const h of holdings) {
    const cls = classifyHolding(h, snapshot);
    if (cls.source === "tier_b_read_through" && !["benchmark_structurally_inapplicable", "benchmark_not_in_snapshot"].includes(cls.sentinel ?? "")) {
      const found = holdingMonthlySeries(h, snapshot);
      if (found) {
        evaluable.push({ h, series: found.series });
        evalWeight += h.weightPct;
        continue;
      }
    }
    sentWeight += h.weightPct;
  }
  const constituents = holdings.map((h) => h.instrument);
  const baseEmpty: SleeveStats = {
    sleeve, constituents,
    evaluable_weight_pct: Math.round(evalWeight * 100) / 100,
    sentinelled_weight_pct: Math.round(sentWeight * 100) / 100,
    partial_evaluation: evaluable.length > 0 && evaluable.length < holdings.length,
    currency_basis: "INR",
    method: "sentinel", sentinel: "no_constituents_evaluable",
    benchmark_index_id: null, stats: null,
  };
  if (evaluable.length === 0) return baseEmpty;

  const series =
    evaluable.length === 1 ? evaluable[0].series : synthesiseSeries(evaluable);
  const lr = logReturnsByMonth(series);
  const ordered = Object.keys(lr).sort().map((m) => lr[m]);
  const stats: TierBValues = {
    vol_3y_annualized: round4(annVol(ordered, 36)),
    vol_5y_annualized: ordered.length >= 60 ? round4(annVol(ordered, 60)) : null,
    sharpe_3y: round4(sharpe(ordered, 36)),
    sharpe_5y: ordered.length >= 60 ? round4(sharpe(ordered, 60)) : null,
    sortino_3y: round4(sortino(ordered, 36)),
    sortino_5y: ordered.length >= 60 ? round4(sortino(ordered, 60)) : null,
    max_drawdown_3y: round4(maxDrawdown(Object.fromEntries(Object.keys(series).sort().slice(-36).map((m) => [m, series[m]])))),
    max_drawdown_5y: Object.keys(series).length >= 60 ? round4(maxDrawdown(Object.fromEntries(Object.keys(series).sort().slice(-60).map((m) => [m, series[m]])))) : null,
    calmar_3y: null,
    beta_3y: null, r_squared_3y: null, tracking_error_3y: null, information_ratio_3y: null,
  };
  const md3 = stats.max_drawdown_3y;
  const ar3 = annReturn(ordered, 36);
  stats.calmar_3y = md3 && md3 !== 0 && ar3 != null ? round4(ar3 / Math.abs(md3)) : null;
  if (benchId) {
    const bench = snapshot.indices?.[benchId]?.monthly_values;
    if (bench) {
      const br = benchRelative(series, bench);
      stats.beta_3y = br.beta_3y;
      stats.r_squared_3y = br.r_squared_3y;
      stats.tracking_error_3y = br.tracking_error_3y;
      stats.information_ratio_3y = br.information_ratio_3y;
    }
  }
  return {
    sleeve, constituents,
    evaluable_weight_pct: Math.round(evalWeight * 100) / 100,
    sentinelled_weight_pct: Math.round(sentWeight * 100) / 100,
    partial_evaluation: evaluable.length < holdings.length,
    currency_basis: "INR",
    method: evaluable.length === 1 ? "single_holding_passthrough" : "synthesised_series",
    sentinel: null,
    benchmark_index_id: benchId,
    stats,
  };
}

/* ----- Snapshot context + synthetic-forward derivation (D3, ADR-0019) ----- */

export function deriveSnapshotContext(snapshot: Snapshot): SnapshotContext {
  const sm = snapshot.snapshot_metadata ?? {};
  const evolution = (sm.evolution_type as string | undefined) ?? "baseline";
  return {
    snapshot_id: (sm.snapshot_id as string | undefined) ?? "unknown",
    snapshot_date: (sm.snapshot_date as string | undefined) ?? (sm.date as string | undefined) ?? "unknown",
    is_synthetic_forward: evolution !== "baseline",
    enrichment_version: (sm.enrichment_version as string | undefined) ?? null,
  };
}

const SYNTHETIC_FORWARD_DISCLOSURE =
  "Computed against a synthetic forward-projection snapshot; these figures are a regime-test artifact, not a forecast.";

/* ----- Layer 1 orchestration (pure, deterministic) ----- */

export function computeRiskReward(input: RiskRewardInput): Omit<RiskRewardOutput, "rollup" | "reasoning_summary"> {
  const { holdings, snapshot } = input;
  const ctx = deriveSnapshotContext(snapshot);
  const per_holding = holdings.holdings.map((h) => classifyHolding(h, snapshot));

  const sleeves: AssetClass[] = ["Equity", "Debt", "Alternatives", "Cash"];
  const per_sleeve: SleeveStats[] = [];
  for (const s of sleeves) {
    const hs = holdings.holdings.filter((h) => h.assetClass === s);
    if (hs.length === 0) continue;
    if (s === "Cash") {
      per_sleeve.push({
        sleeve: s, constituents: hs.map((h) => h.instrument),
        evaluable_weight_pct: 0,
        sentinelled_weight_pct: Math.round(hs.reduce((a, h) => a + h.weightPct, 0) * 100) / 100,
        partial_evaluation: false, currency_basis: "INR",
        method: "sentinel", sentinel: "not_applicable_for_risk_reward",
        benchmark_index_id: null, stats: null,
      });
      continue;
    }
    per_sleeve.push(aggregate(s, hs, snapshot, SLEEVE_BENCHMARK[s]));
  }

  const portfolio = aggregate(
    "portfolio",
    holdings.holdings.filter((h) => h.assetClass !== "Cash"),
    snapshot,
    "nifty_500_tri",
  );

  return {
    agent_id: "risk_reward_stats",
    case_id: input.caseId,
    as_of_date: input.asOfDate,
    snapshot_context: ctx,
    risk_free_rate: RISK_FREE_ANN,
    per_holding,
    per_sleeve,
    portfolio,
  };
}

/* ----- Layer 2: templated rollup + LLM-fallback triggers ----- */

export const LLM_FALLBACK_TRIGGERS = [
  "all_sentinelled_sleeve",
  "single_holding_sleeve",
  "negative_excess_return",
  "math_valid_but_confusing_sharpe",
  "every_sleeve_partial",
] as const;

export function detectLlmFallbackTrigger(
  layer1: Omit<RiskRewardOutput, "rollup" | "reasoning_summary">,
): (typeof LLM_FALLBACK_TRIGGERS)[number] | null {
  const sleeves = layer1.per_sleeve.filter((s) => s.sleeve !== "Cash");
  /* Tightened at Checkpoint 2: a sentinelled sleeve only forces the LLM
   * fallback when it is material (> 35% of portfolio weight), or when the
   * portfolio is mostly unevaluable (evaluable weight <= 40%). An incidental
   * small AIF-only Alternatives sleeve in an otherwise-evaluable portfolio
   * stays on the templated path (partial-evaluation language already
   * communicates the gap honestly). */
  const sentinelSleeveMaterial = sleeves.some(
    (s) => s.method === "sentinel" && s.evaluable_weight_pct + s.sentinelled_weight_pct > 35,
  );
  const portfolioMostlyUnevaluable = layer1.portfolio.evaluable_weight_pct <= 40;
  if (sentinelSleeveMaterial || portfolioMostlyUnevaluable) return "all_sentinelled_sleeve";
  if (sleeves.some((s) => s.method === "single_holding_passthrough")) return "single_holding_sleeve";
  const p = layer1.portfolio.stats;
  if (p && p.information_ratio_3y != null && p.information_ratio_3y < -0.5) return "negative_excess_return";
  if (p && p.sharpe_3y != null && p.sharpe_3y < 0) return "math_valid_but_confusing_sharpe";
  if (sleeves.length > 0 && sleeves.every((s) => s.partial_evaluation)) return "every_sleeve_partial";
  return null;
}

function fmtPct(x: number | null | undefined): string {
  return x == null ? "n/a" : `${(x * 100).toFixed(1)}%`;
}
function fmtNum(x: number | null | undefined): string {
  return x == null ? "n/a" : x.toFixed(2);
}

export function templatedRollup(
  layer1: Omit<RiskRewardOutput, "rollup" | "reasoning_summary">,
): string {
  const p = layer1.portfolio;
  const lead = [...layer1.per_sleeve]
    .filter((s) => s.sleeve !== "Cash" && s.stats)
    .sort((a, b) => b.evaluable_weight_pct - a.evaluable_weight_pct)[0];
  if (!p.stats) {
    return "Portfolio risk-reward statistics are not computable: every evaluable sleeve is sentinelled (opaque wrappers, disclosure-limited PMS, or non-applicable instruments). See per-holding sentinels for the specific reasons.";
  }
  const parts: string[] = [];
  parts.push(
    `Portfolio 3Y Sharpe ${fmtNum(p.stats.sharpe_3y)} at ${fmtPct(p.stats.vol_3y_annualized)} annualised volatility` +
      (p.stats.beta_3y != null ? `, beta ${fmtNum(p.stats.beta_3y)} versus Nifty 500 TRI (R-squared ${fmtNum(p.stats.r_squared_3y)})` : "") +
      `; max drawdown ${fmtPct(p.stats.max_drawdown_3y)}.`,
  );
  if (lead && lead.stats) {
    parts.push(
      `The ${lead.sleeve.toLowerCase()} sleeve (${fmtPct(lead.evaluable_weight_pct / 100)} evaluable) leads with 3Y Sharpe ${fmtNum(lead.stats.sharpe_3y)}` +
        (lead.partial_evaluation ? `, partial evaluation (${fmtPct(lead.sentinelled_weight_pct / 100)} sentinelled).` : "."),
    );
  }
  return parts.join(" ");
}

/* ----- Synthetic-forward runtime guard (hard rule, ADR-0019) ----- */

export function assertSyntheticForwardDisclosure(out: RiskRewardOutput): void {
  if (out.snapshot_context.is_synthetic_forward && !out.rollup.synthetic_forward_disclosure) {
    throw new Error(
      `Risk-reward output for case ${out.case_id} is on a synthetic-forward snapshot ` +
        `(${out.snapshot_context.snapshot_id}) but the rollup carries no synthetic-forward disclosure. ` +
        `This is a hard rule; no t1+ output may bypass the disclosure.`,
    );
  }
}

/* ----- Orchestrator (deterministic path; LLM fallback is WA12-gated and is
 * not invoked from the deterministic verify scripts) ----- */

export function runRiskRewardDeterministic(input: RiskRewardInput): RiskRewardOutput {
  const layer1 = computeRiskReward(input);
  const trigger = detectLlmFallbackTrigger(layer1);
  const text = templatedRollup(layer1);
  const disclosure = layer1.snapshot_context.is_synthetic_forward ? SYNTHETIC_FORWARD_DISCLOSURE : null;
  const rollupText = disclosure ? `${text} ${disclosure}` : text;
  const out: RiskRewardOutput = {
    ...layer1,
    rollup: {
      text: rollupText,
      generation_method: "templated",
      llm_fallback_trigger: trigger, // recorded even on the templated path so the gate is auditable
      is_synthetic_forward: layer1.snapshot_context.is_synthetic_forward,
      synthetic_forward_disclosure: disclosure,
    },
    reasoning_summary:
      "Per-holding figures are read-through from pre-computed tier_b_stats (ADR-0012/0014/0015); " +
      "sleeve and portfolio figures are computed on a market-value-weighted synthesised return series. " +
      "Sentinels mark instruments where risk-reward statistics are not computable by construction.",
  };
  assertSyntheticForwardDisclosure(out);
  return out;
}

/* ----- Layer 2 LLM fallback (WA12-gated: only invoked via the async
 * orchestrator, never from the deterministic path or the verify scripts) ----- */

type RollupPayload = { rollup_text: string };

function validateRollupPayload(parsed: unknown): RollupPayload {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("risk_reward_stats rollup output is not an object");
  }
  const o = parsed as Record<string, unknown>;
  if (typeof o.rollup_text !== "string" || o.rollup_text.trim() === "") {
    throw new Error("risk_reward_stats rollup output missing rollup_text");
  }
  return { rollup_text: o.rollup_text };
}

function sleeveDigest(s: SleeveStats) {
  return {
    sleeve: s.sleeve,
    method: s.method,
    evaluable_weight_pct: s.evaluable_weight_pct,
    sentinelled_weight_pct: s.sentinelled_weight_pct,
    sentinel: s.sentinel,
    stats: s.stats
      ? {
          sharpe_3y: s.stats.sharpe_3y,
          vol_3y_annualized: s.stats.vol_3y_annualized,
          beta_3y: s.stats.beta_3y,
          r_squared_3y: s.stats.r_squared_3y,
          information_ratio_3y: s.stats.information_ratio_3y,
          max_drawdown_3y: s.stats.max_drawdown_3y,
        }
      : null,
  };
}

function buildRollupPrompt(
  layer1: Omit<RiskRewardOutput, "rollup" | "reasoning_summary">,
  trigger: string,
): string {
  const sentinelCounts: Record<string, number> = {};
  for (const h of layer1.per_holding) {
    if (h.sentinel) sentinelCounts[h.sentinel] = (sentinelCounts[h.sentinel] ?? 0) + 1;
  }
  const digest = {
    edge_case_trigger: trigger,
    snapshot: layer1.snapshot_context,
    portfolio: sleeveDigest(layer1.portfolio),
    sleeves: layer1.per_sleeve.map(sleeveDigest),
    per_holding_sentinel_counts: sentinelCounts,
  };
  return [
    `# Risk-Reward Rollup Request (Layer 2 fallback)`,
    ``,
    `Layer 1 has computed every statistic deterministically. Your only job is`,
    `the rollup: one or two sentences characterising this portfolio's`,
    `risk-reward profile in the Samriddhi 2 diagnostic register. This case`,
    `routed to the fallback because of the edge case "${trigger}".`,
    ``,
    `Hard rules:`,
    `- Describe, do not recommend. No "should", "consider", "trim", "advise".`,
    `- No good or bad verdicts on a Sharpe value; state the number and its`,
    `  benchmark or sentinel context. Bucket-relative judgement is not yours.`,
    `- Cite the specific numbers in the digest; do not invent any value.`,
    `- When holdings are sentinelled, name what cannot be evaluated and why`,
    `  (opaque wrappers, disclosure-limited PMS, non-applicable instruments);`,
    `  the unevaluable share is itself the load-bearing observation.`,
    `- Use only commas, semicolons, colons, or periods. Never an em dash, en`,
    `  dash, or any long dash.`,
    `- Do not add a forecast or synthetic-forward caveat yourself; that`,
    `  disclosure is appended deterministically downstream.`,
    ``,
    `## Deterministic digest`,
    ``,
    "```json",
    JSON.stringify(digest, null, 2),
    "```",
    ``,
    `## Output`,
    ``,
    `Return exactly one fenced JSON block, no prose outside it:`,
    "```json",
    `{ "rollup_text": "<one or two sentences, cites the numbers, no recommendation language>" }`,
    "```",
  ].join("\n");
}

export type RiskRewardResult = { output: RiskRewardOutput; usage: AgentUsage | null };

/* Async orchestrator. Templated by default; the LLM fallback fires only when
 * an edge-case trigger is present. The synthetic-forward disclosure is always
 * appended deterministically (the model is instructed not to add it and is
 * not trusted to), so the runtime guard holds on both paths. */
export async function runRiskRewardStats(input: RiskRewardInput): Promise<RiskRewardResult> {
  const layer1 = computeRiskReward(input);
  const trigger = detectLlmFallbackTrigger(layer1);
  const disclosure = layer1.snapshot_context.is_synthetic_forward
    ? SYNTHETIC_FORWARD_DISCLOSURE
    : null;

  let baseText: string;
  let generation: "templated" | "llm_fallback";
  let usage: AgentUsage | null = null;

  if (trigger) {
    const res = await callAgent<RollupPayload>({
      skillId: "risk_reward_stats",
      userPrompt: buildRollupPrompt(layer1, trigger),
      validate: validateRollupPayload,
    });
    baseText = stripLongDashes(res.output.rollup_text);
    generation = "llm_fallback";
    usage = res.usage;
  } else {
    baseText = templatedRollup(layer1);
    generation = "templated";
  }

  const out: RiskRewardOutput = {
    ...layer1,
    rollup: {
      text: disclosure ? `${baseText} ${disclosure}` : baseText,
      generation_method: generation,
      llm_fallback_trigger: trigger,
      is_synthetic_forward: layer1.snapshot_context.is_synthetic_forward,
      synthetic_forward_disclosure: disclosure,
    },
    reasoning_summary:
      "Per-holding figures are read-through from pre-computed tier_b_stats (ADR-0012/0014/0015); " +
      "sleeve and portfolio figures are computed on a market-value-weighted synthesised return series. " +
      "Sentinels mark instruments where risk-reward statistics are not computable by construction.",
  };
  assertSyntheticForwardDisclosure(out);
  return { output: out, usage };
}
