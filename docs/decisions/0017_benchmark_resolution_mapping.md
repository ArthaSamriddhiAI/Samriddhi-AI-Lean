# ADR 0017: benchmark_resolution mapping for funds (source-string-first, cap-tier fallback, two-sentinel partition)

## Context

86.6% of the 1,773 funds carry no source `Benchmark Index` string, and (per the Step 1 audit) no fund had any benchmark-relative Tier B metric pre-computed. Risk-reward owns building the mapping from a fund to a canonical-16 benchmark so beta / R-squared / tracking error / information ratio can be recomputed (ADR-0015) against the regenerated NAV (ADR-0014). The owner ruled the mapping at the Step 3 sub-checkpoint (Rulings A-D).

## Decision

Each fund resolves through an ordered cascade, implemented in `scripts/regenerate_fund_nav.py` `resolve()`:

1. **Source-string** (Ruling D / B): if the fund's source `Benchmark Index` string normalises to one of the 16 canonical indices, use it. (131 of the 238 source strings do; the other 107 name non-canonical indices.)
2. **Tracked-index detector** (Ruling B): for Index Funds / ETFs / passive, detect a canonical-16 index from the fund name (a Sensex ETF resolves to `bse_sensex_tri`, beta about 1, R-squared about 1).
3. **Category-clean** (Ruling D): Large Cap to `nifty_50_tri`, Mid Cap to `nifty_midcap_150_tri`, Small Cap to `nifty_smallcap_250_tri`, Liquid/Overnight/MoneyMarket/Arbitrage to `crisil_liquid`, Gilt to `crisil_dynamic_gilt`, Gilt-10y-constant to `nifty_10y_gsec`.
4. **Defensible-default** (Ruling C): broad active equity (Flexi/Multi/Large&Mid/Focused/Value/Contra/DivYield/ELSS) and Aggressive Hybrid to `nifty_500_tri`; accrual debt (Corporate Bond/Short/UltraShort/Low Duration/Floater/Banking&PSU/Credit Risk) to `crisil_short_term_bond`; duration debt (Dynamic Bond/Medium/Medium-to-Long) to `crisil_composite_bond`; Long Duration to `nifty_10y_gsec`.
5. **Sentinel** otherwise, partitioned (Ruling A): `benchmark_structurally_inapplicable` (multi-asset, dynamic allocation, retirement, conservative hybrid, children's, equity savings; single-index comparison is the wrong measurement, model-portfolio territory) versus `benchmark_not_in_snapshot` (smart-beta, sector ex Bank/IT, target-maturity debt, non-US international, commodity ex-gold; the comparator exists but is not in the canonical 16, snapshot-data-extension territory). Genuinely ambiguous funds default to `benchmark_not_in_snapshot` (the conservative classification).

Large Cap maps to `nifty_50_tri` (cross-surface consistency with the stock-side `_resolve_bench_id`, ADR-0012) rather than the SEBI-purist `nifty_100_tri`.

## Alternatives Considered

- **Per-fund ruling across all 1,773.** Infeasible to present and maintain; the owner chose per-category-with-sub-cuts plus spot-rule for outliers.
- **Force every fund onto a nearest canonical-16 benchmark (no sentinels).** Rejected: it produces misleading beta/R-squared for the ~44% that track non-canonical indices; the two-sentinel partition is the honest move (DD3 records the canonical-set gap).
- **Single `benchmark_resolution_pending` sentinel.** Rejected at Ruling A: the two failure modes route to different downstream owners (model-portfolio versus snapshot-data-extension), so they are distinguished.

## Consequences

921 funds resolve at t0 rising to 943 by t4+, each with `_meta.benchmark_index_id` and `_benchmark_resolution: "resolved"`; about 130 are `benchmark_structurally_inapplicable`, about 510-700 `benchmark_not_in_snapshot`, the rest history-sentinelled. The mapping is deterministic and is the configurable artifact the model-portfolio workstream can override (a fund's house-view benchmark may differ from the defensible default). Cross-references ADR-0014 (regeneration), ADR-0015 (recompute), and `PRODUCT_DEBT_LOG.md` DD3.
