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

import type { Snapshot } from "./snapshot-loader";
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
  current_snapshot_id: string;
  reference_snapshot_id: string | null;
  per_instrument: Array<{ holding_ref: string; nav_or_price_delta: number | null; return_between_snapshots: number | null }>;
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

function rollupPortfolio(sleeveReturns: WindowReturn[][], sleeveWeights: number[]): WindowReturn[] {
  // TODO T-5.06-impl: portfolio TWR weighted across sleeves.
  throw new Error("TODO T-5.06-impl: rollupPortfolio");
}

function computeCrossSnapshotEvolution(
  currentSnapshot: Snapshot,
  referenceSnapshot: Snapshot,
  holdings: StructuredHoldings,
): CrossSnapshotEvolution {
  // TODO T-5.06-impl: diff actual NAV/price values across the pair (never trust
  // evolved_fields); compute per-instrument and per-sleeve return between snapshots.
  throw new Error("TODO T-5.06-impl: computeCrossSnapshotEvolution");
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

/* ----- Orchestrator (deterministic path). SKELETON: throws until helpers land. ----- */

export async function runTimeSeriesPerformanceDeterministic(
  currentSnapshot: Snapshot,
  referenceSnapshot: Snapshot | null, // null at t0 => no_prior_snapshot_available
  holdings: StructuredHoldings,
  scope: TimeSeriesPerformanceScope,
): Promise<TimeSeriesPerformanceOutput> {
  // Intended Layer-1 flow (helpers are TODO stubs; orchestration body not yet wired):
  //
  // for each evaluable holding, resolve the monthly series (monthly_nav | monthly_prices) and:
  //
  //   // Computed at agent runtime per ADR-0012 exception (see ADR-0028).
  //   // See T18 (tech debt log) for production deployment considerations
  //   // re: firm-specific data management layers.
  //   const trailing = computeTrailingWindowReturns(series, STANDARD_WINDOWS, scope.asOfDate);
  //
  // resolve the benchmark via tier_b_stats._meta.benchmark_index_id (ADR-0017),
  // computeBenchmarkRelative per window, rollupSleeve, rollupPortfolio, and
  // (when referenceSnapshot !== null) computeCrossSnapshotEvolution; otherwise
  // emit the no_prior_snapshot_available sentinel on the evolution block while
  // the trailing windows still compute.
  //
  // pms_aif_framework_notice is reused from risk-reward (verbatim four-thesis text):
  void buildPmsAifFrameworkNotice;
  void sentinelInstrument;
  void computeBenchmarkRelative;
  void rollupSleeve;
  void rollupPortfolio;
  void computeCrossSnapshotEvolution;
  void computeTrailingWindowReturns;
  void currentSnapshot;
  void referenceSnapshot;
  void holdings;
  void scope;

  throw new Error("TODO T-5.06-impl: runTimeSeriesPerformanceDeterministic orchestration");
}
