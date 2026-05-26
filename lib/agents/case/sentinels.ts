/**
 * Shared evidence-sentinel taxonomy.
 *
 * Renamed from `RiskRewardSentinel` (previously in lib/agents/risk-reward-stats.ts)
 * and relocated here per ADR-0030. Both `risk-reward-stats.ts` and
 * `time-series-performance.ts` import this type. T-5.07 (portfolio-overlap)
 * adds the two final members.
 *
 * See ADR-0019 (sentinel taxonomy, do not mix) for the discipline this protects.
 * Originating context: ADR-0017 candidate; Checkpoint 1 approved.
 */
export type EvidenceSentinel =
  | "opaque_wrapper" // AIF: no return data exists (foundation opaque-by-design)
  | "pms_disclosure_limited" // PMS: no monthly NAV; rolling stats not computable
  | "not_applicable_for_risk_reward" // FD, gold, savings: no return series
  | "insufficient_history" // tier_b data_window_insufficient
  | "benchmark_structurally_inapplicable" // fund design resists single-index comparison
  | "benchmark_not_in_snapshot" // comparator exists but not in the canonical 16
  | "currency_conversion_pending" // foreign-currency holding, FX series absent
  | "no_constituents_evaluable" // sleeve where every constituent is sentinelled
  | "no_prior_snapshot_available" // reference snapshot absent (e.g. t0); evolution skipped, windows still compute
  | "insufficient_overlap_coverage" // T-5.07: fewer than two holdings in the comparison set carry evaluable overlap data
  | "single_holding_sleeve_overlap"; // T-5.07: sleeve contains only one holding; no intra-sleeve pair to compare
