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
import type { EvidenceSentinel } from "./case/sentinels";
// Client-weighted benchmark (T-5.14): equity cap granularity reuses the A3-era
// held-equity decomposition; no circular dependency (instrument-selection does
// not import risk-reward-stats).
import { decomposeHeldEquity, decomposeHeldDebt, buildInstrumentUniverse, type InstrumentUniverse } from "./instrument-selection";

export const RISK_FREE_ANN = 0.0525; // per ADR-0012 (repo rate at t0); not read from provenance (D2)

/* Risk-free rate abstraction (T-5.14). The static constant is the lean-MVP
 * convenience debt; the enterprise path is a time-varying rate series (the
 * 91-day T-bill for sharpe/sortino, the 10yr G-Sec for Jensen's). Both sharpe,
 * sortino, and Jensen's consume this, plus the per-holding tier_b recompute.
 * The constant is the degenerate flat series: fed constantRiskFree(RISK_FREE_ANN),
 * the computed numbers reproduce the static-R_f results exactly. */
export type RiskFree = {
  /** Annualised risk-free averaged over the given YYYY-MM months (sharpe/sortino numerator). */
  annual(months: string[]): number;
  /** Monthly log risk-free for a YYYY-MM (sortino downside threshold; Jensen's intercept). */
  monthlyLog(month: string): number;
};

export function constantRiskFree(annual: number): RiskFree {
  const mLog = Math.log(1 + annual) / 12;
  return { annual: () => annual, monthlyLog: () => mLog };
}

/* annualByMonth: YYYY-MM -> the annualised risk-free rate that month (e.g. the
 * 91-day T-bill yield). fallback covers months the series does not carry. */
export function seriesRiskFree(annualByMonth: Record<string, number>, fallback: number): RiskFree {
  return {
    annual: (months) => {
      const vals = months.map((m) => annualByMonth[m]).filter((v): v is number => typeof v === "number");
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : fallback;
    },
    monthlyLog: (m) => Math.log(1 + (annualByMonth[m] ?? fallback)) / 12,
  };
}

export const DEFAULT_RISK_FREE: RiskFree = constantRiskFree(RISK_FREE_ANN);

/* Sentinel taxonomy (ADR-0017 candidate; Checkpoint 1 approved) relocated to
 * ./case/sentinels.ts as the shared `EvidenceSentinel` union per ADR-0030. */

export const TIER_B_FIELDS = [
  "vol_3y_annualized", "vol_5y_annualized", "sharpe_3y", "sharpe_5y",
  "sortino_3y", "sortino_5y", "max_drawdown_3y", "max_drawdown_5y",
  "calmar_3y", "beta_3y", "r_squared_3y", "tracking_error_3y",
  "information_ratio_3y",
] as const;

export type TierBValues = Partial<Record<(typeof TIER_B_FIELDS)[number], number | null>>;

/* Sleeve and portfolio stats extend the read-through tier_b shape with Jensen's
 * alpha (the CAPM regression intercept against the client-weighted benchmark,
 * T-5.14). It is computed fresh at the sleeve and portfolio level and has no
 * per-holding read-through equivalent, so it lives only on SleeveStats. */
export type SleeveStatValues = TierBValues & { jensens_alpha_3y?: number | null };

/* The client-weighted benchmark for a sleeve or the portfolio: a holdings-
 * weighted blend of each evaluable holding's own benchmark, blended on returns
 * (base-invariant). Equity holdings decompose into cap tiers via
 * decomposeHeldEquity (ADR-0035); non-equity holdings use their read-through
 * benchmark_index_id. Replaces the single static benchmark id (T-5.14). */
export type BenchmarkBlend = {
  method: "client_weighted_blend";
  constituents: Array<{ index_id: string; weight_pct: number }>;
};

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
  sentinel: EvidenceSentinel | null;
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
  sentinel: EvidenceSentinel | null;
  /* The single static id is retired (T-5.14). benchmark_index_id is kept and
   * populated only when the blend has exactly one constituent (a readable
   * single-id case, e.g. a single-holding debt sleeve); else null. The full
   * weighted blend always lives in benchmark_blend when a benchmark is computed. */
  benchmark_index_id: string | null;
  benchmark_blend: BenchmarkBlend | null;
  /* Honest-coverage caption text (capability; render is T-5.09). Built from the
   * evaluable / sentinelled weight split. Null on the all-sentinelled path. */
  coverage_footnote: string | null;
  stats: SleeveStatValues | null;
};

export type RiskRewardRollup = {
  text: string;
  generation_method: "templated" | "llm_fallback";
  llm_fallback_trigger: string | null;
  is_synthetic_forward: boolean;
  synthetic_forward_disclosure: string | null;
};

/* A static advisor-judgement pointer (not a verdict): when the portfolio
 * holds any PMS or AIF, the four-thesis framework from the first principles
 * section is surfaced verbatim. It is populated deterministically after
 * rollup generation on both paths; the LLM rollup never sees or writes it.
 * A future workstream that upgrades E6 to enforce the decision tree replaces
 * this static notice with structured per-holding thesis verdicts (P22). */
export type PmsAifFrameworkNotice = {
  applies: boolean;
  text: string | null;
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
  pms_aif_framework_notice: PmsAifFrameworkNotice;
  reasoning_summary: string;
};

export type RiskRewardInput = {
  caseId: string;
  asOfDate: string;
  holdings: StructuredHoldings;
  snapshot: Snapshot;
  investor: { riskAppetite?: string; liquidityTier?: string };
  /* Risk-free for sharpe/sortino/Jensen's. Defaults to the static RISK_FREE_ANN
   * constant (DEFAULT_RISK_FREE); pass a seriesRiskFree to use real G-Sec rates. */
  riskFree?: RiskFree;
};

/* ----- Client-weighted benchmark blend (T-5.14) -----
 *
 * The static per-sleeve benchmark map (Equity -> nifty_500_tri, Debt ->
 * crisil_composite_bond) and the static portfolio nifty_500_tri are retired.
 * Each sleeve and the portfolio are now benchmarked against a holdings-weighted
 * blend of their evaluable constituents' own benchmarks (buildBenchmarkBlend),
 * so an aggressive small-and-mid-heavy book is no longer compared against the
 * broad 500. Equity holdings contribute their cap-tier indices via the faithful
 * decomposeHeldEquity split; non-equity holdings contribute their read-through
 * benchmark_index_id. The cap-tier and international index ids: */
const EQUITY_CAP_INDEX = {
  domestic_large: "nifty_100_tri",
  domestic_mid: "nifty_midcap_150_tri",
  domestic_small: "nifty_smallcap_250_tri",
  international: "sp_500_tri_inr",
} as const;

/* Debt cell -> benchmark index id (the debt analogue of EQUITY_CAP_INDEX; T-5.14
 * Phase 3). decomposeHeldDebt resolves each held debt fund to a (credit, duration)
 * cell (ADR-0037); this maps the cell to its real / real-derived TR series in the
 * snapshot. High-grade-short and cash map to the superseded crisil_* keys (the
 * real Nifty Overnight level and the FIMMDA AAA-2Y conversion); the other cells to
 * the converted FIMMDA / G-Sec grid. Cells with no held fund, and cash / arbitrage
 * funds (which decompose to a null duration bucket), fall back to the read-through
 * benchmark id, so per-holding and sleeve resolve to the same series. */
const DEBT_CELL_INDEX: Record<string, string> = {
  "high_grade|short": "crisil_short_term_bond",
  "high_grade|medium": "aaa_5y_tr",
  "high_grade|long": "aaa_10y_tr",
  "sovereign|short": "gsec_1y_tr",
  "sovereign|medium": "gsec_5y_tr",
  "sovereign|long": "gsec_10y_tr",
  "credit_risk|short": "a_2y_tr",
  "credit_risk|medium": "a_3y_tr",
  "credit_risk|long": "bbb_3y_tr",
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
/* months is aligned by index with rets (the sorted YYYY-MM keys of the return
 * series); rf supplies the risk-free. Constant rf reproduces the prior numbers
 * exactly (annual() ignores months, monthlyLog() is flat). */
function sharpe(rets: number[], months: string[], window: number | undefined, rf: RiskFree): number | null {
  const ar = annReturn(rets, window);
  const av = annVol(rets, window);
  if (ar === null || av === null || av === 0) return null;
  const wm = window ? months.slice(-window) : months;
  return (ar - rf.annual(wm)) / av;
}
function sortino(rets: number[], months: string[], window: number | undefined, rf: RiskFree): number | null {
  const r = window ? rets.slice(-window) : rets;
  const wm = window ? months.slice(-window) : months;
  if (r.length < 2) return null;
  // Per-month downside threshold (constant rf => identical to the prior flat rfM).
  const down = r.map((x, i) => x - rf.monthlyLog(wm[i])).filter((d) => d < 0);
  if (down.length === 0) return null;
  const dv = Math.sqrt(down.reduce((a, b) => a + b * b, 0) / down.length) * Math.sqrt(12);
  const ar = annReturn(r);
  if (dv === 0 || ar === null) return null;
  return (ar - rf.annual(wm)) / dv;
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

/* Calendar-aligned beta/r2/te/ir + Jensen's alpha (ADR-0015; T-5.14 adds the
 * CAPM intercept). Align on shared YYYY-MM keys; beta/r2/Jensen's over the full
 * intersection, te/ir over the trailing 36. Jensen's alpha is the CAPM
 * regression intercept against the same benchmark and window as beta, with R_f
 * the documented RISK_FREE_ANN constant (the same R_f sharpe/sortino use; the
 * time-varying crisil_liquid path is logged future-state debt). Because the
 * benchmark is composition-matched, portfolio beta sits near 1 and R_f enters
 * Jensen's only through the (1 - beta) term, so simple excess minus Jensen's
 * equals (beta - 1)(benchmark - R_f); the signal lives where beta departs 1. */
function benchRelative(
  navOrPrice: Record<string, number>,
  benchValues: Record<string, number>,
  rf: RiskFree,
): { beta_3y: number | null; r_squared_3y: number | null; tracking_error_3y: number | null; information_ratio_3y: number | null; jensens_alpha_3y: number | null } {
  const fr = logReturnsByMonth(navOrPrice);
  const br = logReturnsByMonth(benchValues);
  const common = Object.keys(fr).filter((m) => m in br).sort();
  const nil = { beta_3y: null, r_squared_3y: null, tracking_error_3y: null, information_ratio_3y: null, jensens_alpha_3y: null };
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
  // Jensen's alpha (CAPM intercept), same regression/benchmark/window as beta.
  // Monthly intercept alpha_m = (ms - rfM) - beta*(mb - rfM); annualised on the
  // file's exp(mean*12)-1 convention (annReturn). rfM is the mean monthly risk-free
  // over the regression window (constant rf => the flat monthly RISK_FREE_ANN).
  const rfM = common.reduce((acc, m) => acc + rf.monthlyLog(m), 0) / common.length;
  const alphaM = (ms - rfM) - beta * (mb - rfM);
  const jensens = Math.exp(alphaM * 12) - 1;
  return {
    beta_3y: round4(beta),
    r_squared_3y: round4(r2),
    tracking_error_3y: round4(te),
    information_ratio_3y: ir == null ? null : round4(ir),
    jensens_alpha_3y: round4(jensens),
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
  const sentinel = (s: EvidenceSentinel): HoldingStats => ({
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

/* ----- Client-weighted benchmark blend (T-5.14) ----- */

/* Per-holding benchmark index weights (fractions summing to ~1 within the
 * holding). Equity holdings decompose into cap tiers via decomposeHeldEquity
 * (the faithful large/mid/small split, ADR-0035), mapping each tier to its
 * cap-tier index; the fractions are renormalised over the holding's own equity
 * exposure (a hybrid's debt residual is excluded by decompose per ADR-0036, so
 * it is benchmarked on its equity-cap blend, a documented minor approximation).
 * Non-equity holdings, and equity holdings whose composition decompose declines,
 * fall back to the read-through benchmark_index_id (asset-class agnostic). */
function holdingBenchmarkWeights(
  h: Holding,
  snapshot: Snapshot,
  universe: InstrumentUniverse,
): Record<string, number> {
  if (h.assetClass === "Equity") {
    const comp = decomposeHeldEquity(h, universe);
    const parts: Array<[string, number]> = [
      [EQUITY_CAP_INDEX.domestic_large, comp.domestic_large_pct],
      [EQUITY_CAP_INDEX.domestic_mid, comp.domestic_mid_pct],
      [EQUITY_CAP_INDEX.domestic_small, comp.domestic_small_pct],
      [EQUITY_CAP_INDEX.international, comp.international_pct],
    ];
    const sum = parts.reduce((a, [, v]) => a + v, 0);
    if (sum > 0) {
      const out: Record<string, number> = {};
      for (const [idx, v] of parts) if (v > 0) out[idx] = (out[idx] ?? 0) + v / sum;
      return out;
    }
  }
  if (h.assetClass === "Debt") {
    // Resolve the held debt fund's (credit, duration) cell to its TR series (T-5.14
    // Phase 3). Cash-like debt (arbitrage / liquid / overnight) reads through to its
    // cash benchmark (crisil_liquid): decomposeHeldDebt would mis-route an arbitrage
    // fund to a credit cell on a spurious credit_risk read, but its authoritative
    // resolution is the cash floor. Only genuine duration/credit funds take a cell.
    const benchId = holdingMonthlySeries(h, snapshot)?.benchId;
    if (benchId !== "crisil_liquid") {
      const dc = decomposeHeldDebt(h, universe);
      if (dc.credit_bucket && dc.duration_bucket) {
        const idx = DEBT_CELL_INDEX[`${dc.credit_bucket}|${dc.duration_bucket}`];
        if (idx && snapshot.indices?.[idx]?.monthly_values) return { [idx]: 1 };
      }
    }
  }
  // Non-equity, or equity/debt with no usable composition: read-through benchmark id.
  const found = holdingMonthlySeries(h, snapshot);
  return found?.benchId ? { [found.benchId]: 1 } : {};
}

/* Blend index monthly_values on returns (base-invariant; the equity TRIs are
 * terminal-normalised and the debt/intl series start-normalised under uniform
 * metadata, so a level blend would be wrong). Same recipe as synthesiseSeries:
 * compound the weighted monthly log-return from an index level of 1000 over the
 * strict month intersection. Null when no constituent series is usable. */
function blendIndexReturns(
  weights: Record<string, number>,
  snapshot: Snapshot,
): Record<string, number> | null {
  const entries = Object.entries(weights)
    .map(([idx, w]) => ({ w, mv: snapshot.indices?.[idx]?.monthly_values }))
    .filter((e): e is { w: number; mv: Record<string, number> } => !!e.mv)
    .map((e) => ({ w: e.w, r: logReturnsByMonth(e.mv) }));
  if (entries.length === 0) return null;
  const months = Array.from(new Set(entries.flatMap((e) => Object.keys(e.r)))).sort();
  const out: Record<string, number> = {};
  let lvl = 1000;
  for (const m of months) {
    const present = entries.filter((e) => m in e.r);
    if (present.length !== entries.length) continue; // strict intersection
    const wsum = present.reduce((a, e) => a + e.w, 0);
    if (wsum <= 0) continue;
    const r = present.reduce((a, e) => a + (e.w / wsum) * e.r[m], 0);
    lvl = lvl * Math.exp(r);
    out[m] = lvl;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/* The composition-matched benchmark for an evaluable set: each holding's own
 * benchmark, weighted by market value (valueCr) renormalised over the set, the
 * same weighting synthesiseSeries uses for the portfolio series. Equity splits
 * into cap tiers; non-equity uses its read-through index. Returns the blended
 * monthly series plus the BenchmarkBlend descriptor, or null when nothing
 * resolves (then beta/Jensen's stay null, as with a missing static benchmark). */
function buildBenchmarkBlend(
  evaluable: Array<{ h: Holding; series: Record<string, number> }>,
  snapshot: Snapshot,
  universe: InstrumentUniverse,
): { series: Record<string, number>; blend: BenchmarkBlend } | null {
  const totalVal = evaluable.reduce((a, c) => a + c.h.valueCr, 0) || 1;
  const indexWeight: Record<string, number> = {};
  for (const { h } of evaluable) {
    const wH = h.valueCr / totalVal;
    const hw = holdingBenchmarkWeights(h, snapshot, universe);
    for (const [idx, frac] of Object.entries(hw)) indexWeight[idx] = (indexWeight[idx] ?? 0) + wH * frac;
  }
  // Keep only indices present in the snapshot, then renormalise the weights.
  const present = Object.entries(indexWeight).filter(([idx]) => snapshot.indices?.[idx]?.monthly_values);
  const wsum = present.reduce((a, [, w]) => a + w, 0);
  if (wsum <= 0) return null;
  const normed: Record<string, number> = {};
  for (const [idx, w] of present) normed[idx] = w / wsum;
  const series = blendIndexReturns(normed, snapshot);
  if (!series) return null;
  const constituents = Object.entries(normed)
    .map(([index_id, w]) => ({ index_id, weight_pct: Math.round(w * 1000) / 10 }))
    .sort((a, b) => b.weight_pct - a.weight_pct);
  return { series, blend: { method: "client_weighted_blend", constituents } };
}

/* Honest-coverage caption (capability; render is T-5.09). Built from the
 * evaluable / sentinelled weight split; null when nothing is sentinelled. */
function buildCoverageFootnote(evalPct: number, sentPct: number): string | null {
  if (sentPct <= 0) return null;
  return (
    `Benchmark blend covers ${evalPct}% of weight; ${sentPct}% is sentinelled ` +
    `(opaque wrappers, disclosure-limited PMS, international, or non-applicable ` +
    `instruments) and excluded from the blend.`
  );
}

function aggregate(
  sleeve: SleeveStats["sleeve"],
  holdings: Holding[],
  snapshot: Snapshot,
  universe: InstrumentUniverse,
  rf: RiskFree,
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
  const evalPct0 = Math.round(evalWeight * 100) / 100;
  const sentPct0 = Math.round(sentWeight * 100) / 100;
  const baseEmpty: SleeveStats = {
    sleeve, constituents,
    evaluable_weight_pct: evalPct0,
    sentinelled_weight_pct: sentPct0,
    partial_evaluation: evaluable.length > 0 && evaluable.length < holdings.length,
    currency_basis: "INR",
    method: "sentinel", sentinel: "no_constituents_evaluable",
    benchmark_index_id: null, benchmark_blend: null,
    coverage_footnote: buildCoverageFootnote(evalPct0, sentPct0),
    stats: null,
  };
  if (evaluable.length === 0) return baseEmpty;

  const series =
    evaluable.length === 1 ? evaluable[0].series : synthesiseSeries(evaluable);
  const lr = logReturnsByMonth(series);
  const orderedMonths = Object.keys(lr).sort();
  const ordered = orderedMonths.map((m) => lr[m]);
  const stats: SleeveStatValues = {
    vol_3y_annualized: round4(annVol(ordered, 36)),
    vol_5y_annualized: ordered.length >= 60 ? round4(annVol(ordered, 60)) : null,
    sharpe_3y: round4(sharpe(ordered, orderedMonths, 36, rf)),
    sharpe_5y: ordered.length >= 60 ? round4(sharpe(ordered, orderedMonths, 60, rf)) : null,
    sortino_3y: round4(sortino(ordered, orderedMonths, 36, rf)),
    sortino_5y: ordered.length >= 60 ? round4(sortino(ordered, orderedMonths, 60, rf)) : null,
    max_drawdown_3y: round4(maxDrawdown(Object.fromEntries(Object.keys(series).sort().slice(-36).map((m) => [m, series[m]])))),
    max_drawdown_5y: Object.keys(series).length >= 60 ? round4(maxDrawdown(Object.fromEntries(Object.keys(series).sort().slice(-60).map((m) => [m, series[m]])))) : null,
    calmar_3y: null,
    beta_3y: null, r_squared_3y: null, tracking_error_3y: null, information_ratio_3y: null,
    jensens_alpha_3y: null,
  };
  const md3 = stats.max_drawdown_3y;
  const ar3 = annReturn(ordered, 36);
  stats.calmar_3y = md3 && md3 !== 0 && ar3 != null ? round4(ar3 / Math.abs(md3)) : null;
  // Client-weighted benchmark: blend each evaluable holding's own benchmark,
  // then regress the sleeve/portfolio series against it (beta + Jensen's alpha).
  const blended = buildBenchmarkBlend(evaluable, snapshot, universe);
  if (blended) {
    const br = benchRelative(series, blended.series, rf);
    stats.beta_3y = br.beta_3y;
    stats.r_squared_3y = br.r_squared_3y;
    stats.tracking_error_3y = br.tracking_error_3y;
    stats.information_ratio_3y = br.information_ratio_3y;
    stats.jensens_alpha_3y = br.jensens_alpha_3y;
  }
  const blend = blended?.blend ?? null;
  const evalPct = Math.round(evalWeight * 100) / 100;
  const sentPct = Math.round(sentWeight * 100) / 100;
  return {
    sleeve, constituents,
    evaluable_weight_pct: evalPct,
    sentinelled_weight_pct: sentPct,
    partial_evaluation: evaluable.length < holdings.length,
    currency_basis: "INR",
    method: evaluable.length === 1 ? "single_holding_passthrough" : "synthesised_series",
    sentinel: null,
    // A true blend sets benchmark_index_id null; a single-constituent blend keeps
    // the readable id (e.g. a single-holding debt sleeve). The full weighted
    // blend always lives in benchmark_blend.
    benchmark_index_id: blend && blend.constituents.length === 1 ? blend.constituents[0].index_id : null,
    benchmark_blend: blend,
    coverage_footnote: buildCoverageFootnote(evalPct, sentPct),
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

/* Deterministic-append disclosure (T-5.14). The composition-matched benchmark
 * pulls portfolio beta structurally toward 1 (matched composition means matched
 * market sensitivity), so a near-1 portfolio beta is the feature working, not a
 * null result; the believable signal is at the sleeve and holding level and in
 * the residual distance from 1. Appended deterministically on the templated path
 * (the LLM is not trusted to add it), mirroring the synthetic-forward disclosure
 * seam. Fires whenever the portfolio carries a computed beta. */
const STRUCTURAL_BETA_NOTE =
  "The benchmark is blended to match the portfolio's own composition, so a portfolio-level beta near 1 is structural by design; the risk-reward signal is at the sleeve and holding level, and in the residual distance from 1.";

/* ----- Layer 1 orchestration (pure, deterministic) ----- */

export function computeRiskReward(input: RiskRewardInput): Omit<RiskRewardOutput, "rollup" | "reasoning_summary" | "pms_aif_framework_notice"> {
  const { holdings, snapshot } = input;
  const ctx = deriveSnapshotContext(snapshot);
  const per_holding = holdings.holdings.map((h) => classifyHolding(h, snapshot));
  // Built once per case; aggregate() reuses it for the held-equity cap decomposition.
  const universe = buildInstrumentUniverse(snapshot);
  const rf = input.riskFree ?? DEFAULT_RISK_FREE;

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
        benchmark_index_id: null, benchmark_blend: null, coverage_footnote: null,
        stats: null,
      });
      continue;
    }
    per_sleeve.push(aggregate(s, hs, snapshot, universe, rf));
  }

  const portfolio = aggregate(
    "portfolio",
    holdings.holdings.filter((h) => h.assetClass !== "Cash"),
    snapshot,
    universe,
    rf,
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
  layer1: Omit<RiskRewardOutput, "rollup" | "reasoning_summary" | "pms_aif_framework_notice">,
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
  layer1: Omit<RiskRewardOutput, "rollup" | "reasoning_summary" | "pms_aif_framework_notice">,
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
      (p.stats.beta_3y != null
        ? `, beta ${fmtNum(p.stats.beta_3y)} versus a composition-matched benchmark blend (R-squared ${fmtNum(p.stats.r_squared_3y)}, Jensen's alpha ${fmtPct(p.stats.jensens_alpha_3y)})`
        : "") +
      `; max drawdown ${fmtPct(p.stats.max_drawdown_3y)}.`,
  );
  if (lead && lead.stats) {
    parts.push(
      `The ${lead.sleeve.toLowerCase()} sleeve (${fmtPct(lead.evaluable_weight_pct / 100)} evaluable) leads with 3Y Sharpe ${fmtNum(lead.stats.sharpe_3y)}` +
        (lead.stats.beta_3y != null ? `, beta ${fmtNum(lead.stats.beta_3y)} versus its sleeve blend` : "") +
        (lead.partial_evaluation ? `; partial evaluation (${fmtPct(lead.sentinelled_weight_pct / 100)} sentinelled).` : "."),
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

/* Four-thesis framework notice (first principles section). Verbatim and
 * deterministic; identical on both rollup paths. Fires on the presence of any
 * PMS or AIF holding, regardless of its sentinel/evaluation state. */
export const PMS_AIF_FRAMEWORK_TEXT =
  "PMS and AIF holdings are justified under one of four theses: (1) the mutual fund envelope is a constraint requiring concentration, illiquidity, or mandate personalisation; (2) access to non-public-market asset classes (PE, VC, structured credit, pre-IPO); (3) a specific market-neutral hedging need for concentrated India-equity wealth; (4) customisation pooled vehicles cannot deliver, such as sector exclusion, gain/loss timing, or ESG/religious constraints. The current diagnostic does not evaluate the holdings against these theses; advisor judgement applies.";

export function buildPmsAifFrameworkNotice(holdings: Holding[]): PmsAifFrameworkNotice {
  const applies = holdings.some((h) => isPMS(h.subCategory) || isAIF(h.subCategory));
  return { applies, text: applies ? PMS_AIF_FRAMEWORK_TEXT : null };
}

export function runRiskRewardDeterministic(input: RiskRewardInput): RiskRewardOutput {
  const layer1 = computeRiskReward(input);
  const trigger = detectLlmFallbackTrigger(layer1);
  const text = templatedRollup(layer1);
  const structural = layer1.portfolio.stats?.beta_3y != null ? STRUCTURAL_BETA_NOTE : null;
  const disclosure = layer1.snapshot_context.is_synthetic_forward ? SYNTHETIC_FORWARD_DISCLOSURE : null;
  const rollupText = [text, structural, disclosure].filter(Boolean).join(" ");
  const out: RiskRewardOutput = {
    ...layer1,
    rollup: {
      text: rollupText,
      generation_method: "templated",
      llm_fallback_trigger: trigger, // recorded even on the templated path so the gate is auditable
      is_synthetic_forward: layer1.snapshot_context.is_synthetic_forward,
      synthetic_forward_disclosure: disclosure,
    },
    pms_aif_framework_notice: buildPmsAifFrameworkNotice(input.holdings.holdings),
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
          jensens_alpha_3y: s.stats.jensens_alpha_3y,
          information_ratio_3y: s.stats.information_ratio_3y,
          max_drawdown_3y: s.stats.max_drawdown_3y,
        }
      : null,
  };
}

function buildRollupPrompt(
  layer1: Omit<RiskRewardOutput, "rollup" | "reasoning_summary" | "pms_aif_framework_notice">,
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

  const structural = layer1.portfolio.stats?.beta_3y != null ? STRUCTURAL_BETA_NOTE : null;
  const out: RiskRewardOutput = {
    ...layer1,
    rollup: {
      text: [baseText, structural, disclosure].filter(Boolean).join(" "),
      generation_method: generation,
      llm_fallback_trigger: trigger,
      is_synthetic_forward: layer1.snapshot_context.is_synthetic_forward,
      synthetic_forward_disclosure: disclosure,
    },
    pms_aif_framework_notice: buildPmsAifFrameworkNotice(input.holdings.holdings),
    reasoning_summary:
      "Per-holding figures are read-through from pre-computed tier_b_stats (ADR-0012/0014/0015); " +
      "sleeve and portfolio figures are computed on a market-value-weighted synthesised return series. " +
      "Sentinels mark instruments where risk-reward statistics are not computable by construction.",
  };
  assertSyntheticForwardDisclosure(out);
  return { output: out, usage };
}
