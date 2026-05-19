# ADR 0015: Calendar-aligned benchmark recompute for funds (a scoped refinement of ADR-0012 tail-align)

## Context

ADR-0012 computes per-instrument benchmark-relative Tier B metrics (`beta_3y`, `r_squared_3y`, `tracking_error_3y`, `information_ratio_3y`) by tail-aligning two return series: `s = instrument_rets[-n:]`, `b = bench_rets[-n:]`, `n = min(len_s, len_b)`. For stocks this is correct: stock `monthly_prices` and the canonical `indices` were synthesised in the same enrichment pass over the same month range (ADR-0008, ADR-0009), so the two series end on the same calendar month and tail-align is exactly calendar alignment.

Funds are a different data shape. Fund `monthly_nav` is long source history (up to 241 months, back to 2006) while the canonical indices span about 84 months (2019-05 onward), and the fund series may end one month later than the index. Tail-aligning `[-n:]` then pairs calendar-misaligned months. The risk-reward sample proved the consequence: a Sensex ETF versus the synthesised Sensex TRI returned R-squared of about 0.01 under tail-align, mathematically impossible for a fund that tracks that index. Under calendar alignment the same series returned R-squared of about 0.98. ADR-0014 regenerates fund `monthly_nav` to co-move with the resolved index, but that co-movement is only observable if the recompute aligns the two series by calendar month rather than by tail position.

## Decision

For funds only, `beta_3y` / `r_squared_3y` / `tracking_error_3y` / `information_ratio_3y` are recomputed on the intersection of the fund's and the benchmark's monthly-return months (shared `YYYY-MM` keys), not on the tail of each series:

- `beta_3y`, `r_squared_3y`: computed over the full shared-month intersection (this mirrors ADR-0012's "full overlap for stocks" choice, simply made calendar-correct for the funds data shape).
- `tracking_error_3y`, `information_ratio_3y`: computed over the trailing 36 shared months.
- Formulas (covariance / variance for beta; squared correlation for R-squared; annualised stdev of the active return for tracking error; active annualised return over tracking error for information ratio), the 5.25% RF, and the 4-decimal rounding are unchanged from ADR-0012. Only the alignment changes.

The recompute writes the four metrics into each resolvable fund's `tier_b_stats` (the slots ADR-0012 left `null`) and stamps `tier_b_stats._meta.benchmark_index_id` plus `tier_b_stats._benchmark_resolution: "resolved"`. Non-resolvable funds keep the four metrics `null` and carry `tier_b_stats._benchmark_resolution` set to the partition sentinel (`benchmark_structurally_inapplicable` or `benchmark_not_in_snapshot`); `data_window_insufficient` funds are left exactly as ADR-0012 produced them. Stocks are untouched: their data shape still matches ADR-0012's assumption, so they retain the tail-align computation already in the snapshot.

## Alternatives Considered

- **Keep ADR-0012 tail-align for funds.** Rejected: it produces meaningless statistics (Sensex ETF R-squared about 0.01) for the funds data shape; this is the defect the workstream exists to fix.
- **Truncate fund `monthly_nav` to the index window so tail-align becomes calendar-align.** Rejected: it discards fund history other consumers may read and silently couples a recompute decision to the stored data shape; explicit calendar alignment in the estimator is clearer and local.
- **Generally supersede ADR-0012's tail-align everywhere (stocks too).** Rejected: stocks do not have the window-mismatch problem (co-synthesised with the indices), so changing their computation would be churn with no benefit and would risk perturbing the already-sane stock benchmark-relative values.

## Consequences

This is a refinement scoped to a specific data shape, not a general supersession of ADR-0012. ADR-0012's tail-align convention remains in force for stocks and remains the documented method there. For funds, calendar alignment satisfies the same underlying ADR-0012 principle ("compute over comparable windows") under the different data shape that ADR-0007 (source-preserved, now ADR-0014-regenerated fund NAV) plus synthesised indices produce. The recompute is deterministic and idempotent (it reads the regenerated NAV and the unchanged indices). It is implemented in `scripts/regenerate_fund_nav.py` (the `cal_metrics` helper and the `--recompute` mode) and guarded by the per-fund and aggregate assertions in the risk-reward verify scripts; `scripts/_verify-snapshot-enrichment.ts` and `scripts/_verify-loader-enriched.ts` stay green. A future production deployment with real fund NAV and real index data of matching span would not need the alignment refinement (tail-align and calendar-align coincide when spans match), so this ADR is dev-phase-scoped like ADR-0014.
