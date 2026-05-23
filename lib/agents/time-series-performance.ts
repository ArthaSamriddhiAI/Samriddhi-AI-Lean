/* Time-Series Performance, the return-evolution evidence layer.
 *
 * Skill: agents/time_series_performance.md
 * Placement: ADR-0028 (sibling to portfolio-risk-analytics and risk-reward-stats).
 *
 * SKELETON. The Layer-1 helpers are `// TODO T-5.06-impl` stubs; the orchestrator
 * shows the intended deterministic flow but is not yet functional. The follow-up
 * implementation task fills the helpers. Until then the pipeline wiring degrades
 * gracefully (see lib/agents/pipeline.ts, the time-series step is try/caught).
 *
 * Shape mirrors lib/agents/risk-reward-stats.ts:
 *   Layer 1: pure, deterministic. Trailing-window returns computed fresh at agent
 *   runtime from monthly_nav (funds) / monthly_prices (stocks), symmetric across
 *   the two; this is the justified ADR-0012 exception (see ADR-0028, T18).
 *   Benchmark resolution is read-through from tier_b_stats._meta.benchmark_index_id
 *   (ADR-0017), never reinvented. Cross-snapshot evolution diffs actual field
 *   values across the t_n / t_{n-1} pair (never trusts evolved_fields).
 *   Layer 2: templated rollup in the live pipeline; LLM rollup fixture-only (P23).
 */

import type { Snapshot, MutualFundRow, Nifty500Company } from "./snapshot-loader";
import type { StructuredHoldings, Holding } from "@/db/fixtures/structured-holdings";
import { type RiskRewardSentinel, buildPmsAifFrameworkNotice } from "./risk-reward-stats";

/* ----- Standard window set (computed at agent runtime, ADR-0028 / ADR-0012 exception) ----- */

export type TimeSeriesWindow = "1M" | "3M" | "6M" | "1Y" | "3Y" | "SI";
export const STANDARD_WINDOWS: readonly TimeSeriesWindow[] = ["1M", "3M", "6M", "1Y", "3Y", "SI"] as const;

/* ----- Sentinels: 8 inherited verbatim from risk-reward (ADR-0019) + 1 new ----- */

export type TimeSeriesSentinel =
  | RiskRewardSentinel
  | "no_prior_snapshot_available"; // reference snapshot absent (e.g. t0); evolution skipped, windows still compute

/* ----- Output shape (mirrors RiskRewardOutput; schema in schemas/time_series_performance_output.schema.json, follow-up) ----- */

export type WindowReturn = {
  window: TimeSeriesWindow;
  absolute_return: number | null;
  annualised_return: number | null; // null where the window does not justify annualisation
  sentinel: TimeSeriesSentinel | null; // e.g. insufficient_history when the window exceeds available history
};

export type BenchmarkRelativeReturn = {
  window: TimeSeriesWindow;
  alpha: number | null;
  benchmark_return: number | null;
};

export type InstrumentTimeSeries = {
  holding_ref: string;
  instrument_display_name: string;
  asset_class: string;
  sub_category: string;
  weight_pct: number;
  currency_basis: "INR" | "USD" | "native";
  source: "computed_runtime" | "sentinel";
  sentinel: TimeSeriesSentinel | null;
  benchmark_index_id: string | null;
  trailing_returns: WindowReturn[] | null;
  benchmark_relative: BenchmarkRelativeReturn[] | null;
};

export type SleeveTimeSeries = {
  sleeve: "Equity" | "Debt" | "Alternatives" | "Cash" | "portfolio";
  constituents: string[];
  evaluable_weight_pct: number;
  sentinelled_weight_pct: number;
  method: "weighted_rollup" | "single_holding_passthrough" | "sentinel";
  sentinel: TimeSeriesSentinel | null;
  trailing_returns: WindowReturn[] | null;
};

export type CrossSnapshotEvolution = {
  available: boolean; // false => no_prior_snapshot_available
  sentinel: TimeSeriesSentinel | null; // "no_prior_snapshot_available" when available is false, else null
  current_snapshot_id: string;
  reference_snapshot_id: string | null;
  per_instrument: Array<{
    holding_ref: string;
    status: "computed" | "new_position_no_evolution" | "closed_position" | "field_missing_in_one_snapshot";
    nav_or_price_delta: number | null;
    return_between_snapshots: number | null;
  }>;
  per_sleeve: Array<{ sleeve: string; return_between_snapshots: number | null }>;
};

export type SnapshotContextPair = {
  current_snapshot_id: string;
  reference_snapshot_id: string | null;
  current_snapshot_date: string;
  reference_snapshot_date: string | null;
};

export type TimeSeriesRollup = {
  text: string;
  generation_method: "templated" | "llm_fallback";
};

export type TimeSeriesPerformanceOutput = {
  agent_id: "time_series_performance";
  case_id: string;
  as_of_date: string;
  snapshot_context: SnapshotContextPair;
  per_holding: InstrumentTimeSeries[];
  per_sleeve: SleeveTimeSeries[];
  portfolio: SleeveTimeSeries;
  cross_snapshot_evolution: CrossSnapshotEvolution;
  pms_aif_framework_notice: { applies: boolean; text: string | null };
  rollup: TimeSeriesRollup;
  reasoning_summary: string;
};

export type TimeSeriesPerformanceScope = {
  caseId: string;
  asOfDate: string;
  investor: { riskAppetite?: string; liquidityTier?: string };
};

/* ----- Layer 1 helpers (deterministic). Bodies are TODO T-5.06-impl stubs. ----- */

/* ----- Month-key + return helpers (deterministic, pure) ----- */

const WINDOW_MONTHS: Record<Exclude<TimeSeriesWindow, "SI">, number> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "1Y": 12,
  "3Y": 36,
};

function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

/* Subtract `months` from a "YYYY-MM" key, returning a "YYYY-MM" key. */
function monthKeyMinus(key: string, months: number): string {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) - months;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12 + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/* Largest key <= target ("nearest available prior month"): the gap-handling
 * rule is that a missing exact month falls back to the closest earlier month.
 * Returns null when no month at or before the target exists (series too short). */
function valueAsOf(
  series: Record<string, number>,
  sortedMonthKeys: string[],
  target: string,
): { key: string; value: number } | null {
  let lo = 0;
  let hi = sortedMonthKeys.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedMonthKeys[mid] <= target) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (ans < 0) return null;
  const k = sortedMonthKeys[ans];
  return { key: k, value: series[k] };
}

/* Pure. Works on either monthly_nav (funds) or monthly_prices (stocks); the
 * symmetry across instrument types is the whole point of the Option-B decision
 * (ADR-0028). asOfDate is an ISO date; its "YYYY-MM" prefix selects the end month.
 * A window whose start point predates the available history returns the
 * insufficient_history sentinel for that window (never a silent zero or null). */
function computeTrailingWindowReturns(
  monthlySeries: Record<string, number>,
  windows: readonly TimeSeriesWindow[],
  asOfDate: string,
): WindowReturn[] {
  const keys = Object.keys(monthlySeries).sort();
  const asMonth = asOfDate.slice(0, 7);
  const insufficient = (w: TimeSeriesWindow): WindowReturn => ({
    window: w,
    absolute_return: null,
    annualised_return: null,
    sentinel: "insufficient_history",
  });

  const end = valueAsOf(monthlySeries, keys, asMonth);
  if (!end) return windows.map(insufficient);

  const out: WindowReturn[] = [];
  for (const w of windows) {
    let start: { key: string; value: number } | null;
    let years: number;
    if (w === "SI") {
      start = { key: keys[0], value: monthlySeries[keys[0]] };
      const [sy, sm] = keys[0].split("-").map(Number);
      const [ey, em] = end.key.split("-").map(Number);
      years = (ey * 12 + em - (sy * 12 + sm)) / 12;
    } else {
      const target = monthKeyMinus(end.key, WINDOW_MONTHS[w]);
      start = valueAsOf(monthlySeries, keys, target);
      years = WINDOW_MONTHS[w] / 12;
    }
    if (!start || start.key === end.key) {
      out.push(insufficient(w));
      continue;
    }
    // NAVs/prices are positive by construction; guard against bad data rather
    // than dividing by a non-positive base (data-quality guard).
    if (!(start.value > 0) || !Number.isFinite(end.value)) {
      out.push(insufficient(w));
      continue;
    }
    const abs = (end.value - start.value) / start.value;
    let ann: number | null;
    if (w === "1M" || w === "3M" || w === "6M") {
      ann = null; // period absolute returns; not annualised
    } else if (w === "1Y") {
      ann = abs; // a 12-month point-to-point return is already annual
    } else {
      ann = years > 0 ? Math.pow(1 + abs, 1 / years) - 1 : null; // 3Y, SI: compound-annualise over the span
    }
    out.push({
      window: w,
      absolute_return: round4(abs),
      annualised_return: ann === null ? null : round4(ann),
      sentinel: null,
    });
  }
  return out;
}

/* Simple alpha: instrumentReturn - benchmarkReturn, both already in INR (FX
 * translation happens upstream). Returns null when either input is null (e.g.
 * the benchmark could not be resolved); the caller emits benchmark_not_in_snapshot. */
function computeBenchmarkRelative(
  instrumentReturn: number | null,
  benchmarkReturn: number | null,
): number | null {
  if (instrumentReturn === null || benchmarkReturn === null) return null;
  return round4(instrumentReturn - benchmarkReturn);
}

/* Weighted rollup over a sleeve's constituents. For each window, weight-average
 * the instruments that carry a non-null return for that window, reweighting the
 * present set to sum to 1 (an instrument sentinelled or missing for a window is
 * dropped and the remainder reweighted). A window with no present instrument
 * carries insufficient_history. `weights` is aligned by index with
 * `instrumentReturns` (constituent i's weight as a fraction of the sleeve). */
function rollupSleeve(
  instrumentReturns: WindowReturn[][],
  weights: number[],
  sleeveDefinition: SleeveTimeSeries["sleeve"],
): WindowReturn[] {
  void sleeveDefinition; // sleeve name carried by the caller; retained for signature parity
  return STANDARD_WINDOWS.map((w) => {
    let presentWeight = 0;
    let absAcc = 0;
    let annAcc = 0;
    let annPresentWeight = 0;
    for (let i = 0; i < instrumentReturns.length; i++) {
      const wr = instrumentReturns[i]?.find((r) => r.window === w);
      if (!wr || wr.absolute_return === null) continue;
      presentWeight += weights[i];
      absAcc += weights[i] * wr.absolute_return;
      if (wr.annualised_return !== null) {
        annAcc += weights[i] * wr.annualised_return;
        annPresentWeight += weights[i];
      }
    }
    if (presentWeight === 0) {
      return { window: w, absolute_return: null, annualised_return: null, sentinel: "insufficient_history" };
    }
    const ann = annPresentWeight > 0 ? round4(annAcc / annPresentWeight) : null;
    return {
      window: w,
      absolute_return: round4(absAcc / presentWeight),
      annualised_return: ann,
      sentinel: null,
    };
  });
}

/* Portfolio TWR: the same weighted rollup as rollupSleeve, one level up over the
 * sleeves (sleeveWeights aligned by index with sleeveReturns). */
function rollupPortfolio(sleeveReturns: WindowReturn[][], sleeveWeights: number[]): WindowReturn[] {
  return rollupSleeve(sleeveReturns, sleeveWeights, "portfolio");
}

/* ----- Holding classification + snapshot row finding (mirrors risk-reward's
 * private matching convention). ----- */

function isMF(sub: string): boolean {
  return sub.startsWith("mf_");
}
function isListed(sub: string): boolean {
  return sub.startsWith("listed_") || sub.startsWith("intl_");
}
function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function findFundRow(snapshot: Snapshot, instrument: string): MutualFundRow | undefined {
  const t = normName(instrument);
  if (!t) return undefined;
  return snapshot.mf_funds.find((f) => {
    const n = normName(f.fund_name ?? "");
    return n.length > 0 && (n.startsWith(t) || n.includes(t));
  });
}
function findStockRow(snapshot: Snapshot, instrument: string): Nifty500Company | undefined {
  const comps = snapshot.nifty500.companies;
  if (!comps) return undefined;
  const t = normName(instrument);
  if (!t) return undefined;
  return comps.find((c) => {
    const n = normName(c.name ?? "");
    return n.length > 0 && (n === t || n.startsWith(t) || t.startsWith(n));
  });
}
/* Point value used for cross-snapshot evolution: NAV for funds, cmp_rs for
 * stocks (the fields the snapshot actually evolves across t-keys; ADR-0028
 * diffs real values, never evolved_fields). */
function fundPoint(row: MutualFundRow | undefined): number | undefined {
  return typeof row?.NAV === "number" ? row.NAV : undefined;
}
function stockPoint(row: Nifty500Company | undefined): number | undefined {
  const v = row?.cmp_rs;
  return typeof v === "number" ? v : undefined;
}

function computeCrossSnapshotEvolution(
  currentSnapshot: Snapshot,
  referenceSnapshot: Snapshot,
  holdings: StructuredHoldings,
): CrossSnapshotEvolution {
  const curId = (currentSnapshot.snapshot_metadata?.snapshot_id as string | undefined) ?? "unknown";
  const refId = (referenceSnapshot.snapshot_metadata?.snapshot_id as string | undefined) ?? "unknown";
  const perInstrument: CrossSnapshotEvolution["per_instrument"] = [];
  const sleeveAcc: Record<string, { wsum: number; racc: number }> = {};

  for (const h of holdings.holdings) {
    const isFund = isMF(h.subCategory);
    const isStock = isListed(h.subCategory);
    if (!isFund && !isStock) continue; // PMS/AIF/FD/cash carry no evolvable point value

    const cRow = isFund ? findFundRow(currentSnapshot, h.instrument) : findStockRow(currentSnapshot, h.instrument);
    const rRow = isFund ? findFundRow(referenceSnapshot, h.instrument) : findStockRow(referenceSnapshot, h.instrument);
    if (!cRow && !rRow) continue; // not in either snapshot's universe; nothing to evolve

    if (cRow && !rRow) {
      perInstrument.push({ holding_ref: h.instrument, status: "new_position_no_evolution", nav_or_price_delta: null, return_between_snapshots: null });
      continue;
    }
    if (!cRow && rRow) {
      perInstrument.push({ holding_ref: h.instrument, status: "closed_position", nav_or_price_delta: null, return_between_snapshots: null });
      continue;
    }
    const cVal = isFund ? fundPoint(cRow as MutualFundRow) : stockPoint(cRow as Nifty500Company);
    const rVal = isFund ? fundPoint(rRow as MutualFundRow) : stockPoint(rRow as Nifty500Company);
    if (cVal === undefined || rVal === undefined || !(rVal > 0)) {
      perInstrument.push({ holding_ref: h.instrument, status: "field_missing_in_one_snapshot", nav_or_price_delta: null, return_between_snapshots: null });
      continue;
    }
    const ret = round4((cVal - rVal) / rVal);
    perInstrument.push({
      holding_ref: h.instrument,
      status: "computed",
      nav_or_price_delta: round4(cVal - rVal),
      return_between_snapshots: ret,
    });
    const acc = sleeveAcc[h.assetClass] ?? { wsum: 0, racc: 0 };
    acc.wsum += h.weightPct;
    acc.racc += h.weightPct * ret;
    sleeveAcc[h.assetClass] = acc;
  }

  const perSleeve = Object.entries(sleeveAcc).map(([sleeve, a]) => ({
    sleeve,
    return_between_snapshots: a.wsum > 0 ? round4(a.racc / a.wsum) : null,
  }));

  return {
    available: true,
    sentinel: null,
    current_snapshot_id: curId,
    reference_snapshot_id: refId,
    per_instrument: perInstrument,
    per_sleeve: perSleeve,
  };
}

/* Sentinel-emission helper, matching the risk-reward pattern. */
function sentinelInstrument(h: Holding, sentinel: TimeSeriesSentinel): InstrumentTimeSeries {
  return {
    holding_ref: h.instrument,
    instrument_display_name: h.instrument,
    asset_class: h.assetClass,
    sub_category: h.subCategory,
    weight_pct: h.weightPct,
    currency_basis: h.subCategory.startsWith("intl_") ? "native" : "INR",
    source: "sentinel",
    sentinel,
    benchmark_index_id: null,
    trailing_returns: null,
    benchmark_relative: null,
  };
}

/* ----- Classification + benchmark resolution + format helpers ----- */

const SLEEVES: Array<Exclude<SleeveTimeSeries["sleeve"], "portfolio">> = ["Equity", "Debt", "Alternatives", "Cash"];

function isPMS(sub: string): boolean {
  return sub.startsWith("pms_");
}
function isAIF(sub: string): boolean {
  return sub.startsWith("aif_");
}
function isIntl(sub: string): boolean {
  return sub.startsWith("intl_");
}
function isNotApplicable(sub: string): boolean {
  return (
    sub === "bank_fd" || sub === "tax_free_bond" || sub === "physical_gold" ||
    sub === "sovereign_gold_bond" || sub === "reit" || sub === "savings"
  );
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
function fmtPct(x: number | null | undefined): string {
  return x == null ? "n/a" : `${(x * 100).toFixed(1)}%`;
}

/* Read-through benchmark resolution (ADR-0017): consume tier_b_stats._meta.
 * benchmark_index_id / _benchmark_resolution; never reinvent the mapping. */
function resolveBenchmark(row: MutualFundRow | Nifty500Company | undefined): { benchId: string | null; sentinel: TimeSeriesSentinel | null } {
  const tb = row?.tier_b_stats;
  const res = tb?._benchmark_resolution;
  if (res === "benchmark_structurally_inapplicable") return { benchId: null, sentinel: "benchmark_structurally_inapplicable" };
  if (res === "benchmark_not_in_snapshot") return { benchId: null, sentinel: "benchmark_not_in_snapshot" };
  const benchId = tb?._meta?.benchmark_index_id ?? null;
  if (!benchId) return { benchId: null, sentinel: "benchmark_not_in_snapshot" };
  return { benchId, sentinel: null };
}

/* Structural sentinel for an unevaluable holding, or null if evaluable
 * (MF / domestic listed). Inherited from risk-reward (ADR-0019). */
function classify(h: Holding): TimeSeriesSentinel | null {
  if (isAIF(h.subCategory)) return "opaque_wrapper";
  if (isPMS(h.subCategory)) return "pms_disclosure_limited";
  if (isIntl(h.subCategory)) return "currency_conversion_pending";
  if (isNotApplicable(h.subCategory)) return "not_applicable_for_risk_reward";
  return null;
}

/* ----- Orchestrator (deterministic path) ----- */

export async function runTimeSeriesPerformanceDeterministic(
  currentSnapshot: Snapshot,
  referenceSnapshot: Snapshot | null, // null at t0 => no_prior_snapshot_available
  holdings: StructuredHoldings,
  scope: TimeSeriesPerformanceScope,
): Promise<TimeSeriesPerformanceOutput> {
  const sm = currentSnapshot.snapshot_metadata ?? {};
  const refSm = referenceSnapshot?.snapshot_metadata ?? null;
  const snapshot_context: SnapshotContextPair = {
    current_snapshot_id: (sm.snapshot_id as string | undefined) ?? "unknown",
    reference_snapshot_id: refSm ? ((refSm.snapshot_id as string | undefined) ?? "unknown") : null,
    current_snapshot_date: (sm.snapshot_date as string | undefined) ?? (sm.date as string | undefined) ?? scope.asOfDate,
    reference_snapshot_date: refSm ? ((refSm.snapshot_date as string | undefined) ?? (refSm.date as string | undefined) ?? null) : null,
  };

  const per_holding: InstrumentTimeSeries[] = [];
  type Evaluable = { h: Holding; trailing: WindowReturn[] };
  const evalBySleeve: Record<string, Evaluable[]> = {};

  for (const h of holdings.holdings) {
    const sent = classify(h);
    if (sent) {
      per_holding.push(sentinelInstrument(h, sent));
      continue;
    }
    const isFund = isMF(h.subCategory);
    const row = isFund ? findFundRow(currentSnapshot, h.instrument) : findStockRow(currentSnapshot, h.instrument);
    const series = isFund
      ? (row as MutualFundRow | undefined)?.monthly_nav
      : (row as Nifty500Company | undefined)?.monthly_prices;
    if (!row || !series || Object.keys(series).length === 0) {
      per_holding.push(sentinelInstrument(h, "not_applicable_for_risk_reward"));
      continue;
    }

    // Computed at agent runtime per ADR-0012 exception (see ADR-0028).
    // See T18 (tech debt log) for production deployment considerations
    // re: firm-specific data management layers.
    const trailing = computeTrailingWindowReturns(series, STANDARD_WINDOWS, scope.asOfDate);

    const { benchId, sentinel: benchSent } = resolveBenchmark(row);
    const benchSeries = benchId ? currentSnapshot.indices?.[benchId]?.monthly_values : undefined;
    const benchTrailing = benchSeries ? computeTrailingWindowReturns(benchSeries, STANDARD_WINDOWS, scope.asOfDate) : null;
    const benchmark_relative: BenchmarkRelativeReturn[] = STANDARD_WINDOWS.map((w) => {
      const ir = trailing.find((r) => r.window === w)?.absolute_return ?? null;
      const br = benchTrailing?.find((r) => r.window === w)?.absolute_return ?? null;
      return { window: w, alpha: benchId ? computeBenchmarkRelative(ir, br) : null, benchmark_return: br };
    });

    per_holding.push({
      holding_ref: h.instrument,
      instrument_display_name: h.instrument,
      asset_class: h.assetClass,
      sub_category: h.subCategory,
      weight_pct: h.weightPct,
      currency_basis: "INR",
      source: "computed_runtime",
      sentinel: benchSent, // self-returns valid; benchmark-relative reflects this sentinel
      benchmark_index_id: benchId,
      trailing_returns: trailing,
      benchmark_relative,
    });
    (evalBySleeve[h.assetClass] ??= []).push({ h, trailing });
  }

  const per_sleeve: SleeveTimeSeries[] = [];
  const sleeveReturnsForPortfolio: WindowReturn[][] = [];
  const sleeveValueWeights: number[] = [];
  for (const sleeve of SLEEVES) {
    const hs = holdings.holdings.filter((h) => h.assetClass === sleeve);
    if (hs.length === 0) continue;
    const evals = evalBySleeve[sleeve] ?? [];
    const evalWeight = evals.reduce((a, e) => a + e.h.weightPct, 0);
    const sentWeight = hs.reduce((a, h) => a + h.weightPct, 0) - evalWeight;
    const constituents = hs.map((h) => h.instrument);
    if (evals.length === 0) {
      per_sleeve.push({
        sleeve, constituents,
        evaluable_weight_pct: round2(evalWeight), sentinelled_weight_pct: round2(sentWeight),
        method: "sentinel", sentinel: "no_constituents_evaluable", trailing_returns: null,
      });
      continue;
    }
    const totalVal = evals.reduce((a, e) => a + e.h.valueCr, 0) || 1;
    const weights = evals.map((e) => e.h.valueCr / totalVal);
    const sleeveReturns = rollupSleeve(evals.map((e) => e.trailing), weights, sleeve);
    per_sleeve.push({
      sleeve, constituents,
      evaluable_weight_pct: round2(evalWeight), sentinelled_weight_pct: round2(sentWeight),
      method: evals.length === 1 ? "single_holding_passthrough" : "weighted_rollup",
      sentinel: null, trailing_returns: sleeveReturns,
    });
    sleeveReturnsForPortfolio.push(sleeveReturns);
    sleeveValueWeights.push(totalVal);
  }

  const portfolioTotal = sleeveValueWeights.reduce((a, b) => a + b, 0) || 1;
  const portfolio: SleeveTimeSeries =
    sleeveReturnsForPortfolio.length === 0
      ? {
          sleeve: "portfolio", constituents: holdings.holdings.map((h) => h.instrument),
          evaluable_weight_pct: 0, sentinelled_weight_pct: 100,
          method: "sentinel", sentinel: "no_constituents_evaluable", trailing_returns: null,
        }
      : {
          sleeve: "portfolio", constituents: holdings.holdings.map((h) => h.instrument),
          evaluable_weight_pct: round2(per_sleeve.reduce((a, s) => a + s.evaluable_weight_pct, 0)),
          sentinelled_weight_pct: round2(per_sleeve.reduce((a, s) => a + s.sentinelled_weight_pct, 0)),
          method: "weighted_rollup", sentinel: null,
          trailing_returns: rollupPortfolio(sleeveReturnsForPortfolio, sleeveValueWeights.map((w) => w / portfolioTotal)),
        };

  const cross_snapshot_evolution: CrossSnapshotEvolution = referenceSnapshot
    ? computeCrossSnapshotEvolution(currentSnapshot, referenceSnapshot, holdings)
    : { available: false, sentinel: "no_prior_snapshot_available", current_snapshot_id: snapshot_context.current_snapshot_id, reference_snapshot_id: null, per_instrument: [], per_sleeve: [] };

  const notice = buildPmsAifFrameworkNotice(holdings.holdings);

  const p3y = portfolio.trailing_returns?.find((r) => r.window === "3Y");
  const rollupText = !portfolio.trailing_returns
    ? "Time-series performance is not computable: every evaluable sleeve is sentinelled (opaque wrappers, disclosure-limited PMS, or non-applicable instruments)."
    : `Portfolio 3Y annualised return ${fmtPct(p3y?.annualised_return)} (absolute ${fmtPct(p3y?.absolute_return)})` +
      (cross_snapshot_evolution.available
        ? `; evolution measured ${snapshot_context.reference_snapshot_id} to ${snapshot_context.current_snapshot_id}.`
        : `; no prior snapshot for cross-snapshot evolution (${snapshot_context.current_snapshot_id} is the baseline).`);

  return {
    agent_id: "time_series_performance",
    case_id: scope.caseId,
    as_of_date: scope.asOfDate,
    snapshot_context,
    per_holding,
    per_sleeve,
    portfolio,
    cross_snapshot_evolution,
    pms_aif_framework_notice: notice,
    rollup: { text: rollupText, generation_method: "templated" },
    reasoning_summary:
      "Trailing-window returns (1M/3M/6M/1Y/3Y/SI) computed at agent runtime from monthly_nav (funds) and monthly_prices (stocks); " +
      "benchmark-relative alpha against the read-through benchmark (tier_b_stats._meta.benchmark_index_id, ADR-0017); " +
      "sleeve and portfolio rollups are market-value weighted; cross-snapshot evolution diffs NAV/cmp_rs across the snapshot pair. " +
      "Sentinels mark instruments where returns are not computable by construction.",
  };
}
