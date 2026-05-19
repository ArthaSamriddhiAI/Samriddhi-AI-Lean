# ADR-6: Tier B Pre-Computation at Snapshot-Onboarding Time

**Status:** Accepted
**Date:** Phase A audit + Phase B/C implementation
**Supersedes:** None
**Folds:** Original ADR-7 standalone

## Context

Tier B per-instrument risk-reward statistics (Sharpe, Sortino, beta, R-squared, tracking error, IR, max drawdown, Calmar, vol) are needed by downstream workstreams:
- Risk-reward statistics: portfolio-level Sharpe etc. aggregated from per-instrument stats.
- Time-series performance: rolling window analyses.
- Pairwise overlap: not directly, but benefits from consistent stat methodology.

Two architectural options:
1. Compute Tier B at case-time (in each case pipeline that needs it).
2. Compute Tier B at snapshot-onboarding time and embed in the snapshot JSON.

## Decision

**Tier B is pre-computed at snapshot-onboarding time and embedded in the snapshot JSON.**

Per-instrument stats are properties of the instrument, not properties of an investor or case. Reliance's 3Y Sharpe at snapshot t5 is identical regardless of which case is being analyzed. Computing once at snapshot time and reading through for every case is architecturally cleaner.

### Tier B fields per instrument

| Field | Window | Formula |
|---|---|---|
| `vol_3y_annualized` | 3Y | Stdev of monthly log returns * sqrt(12) |
| `vol_5y_annualized` | 5Y | Same, over 60-month window |
| `sharpe_3y` | 3Y | (Ann return - rf) / vol_3y; rf = 5.25% (repo rate at t0) |
| `sharpe_5y` | 5Y | Same |
| `sortino_3y` | 3Y | (Ann return - rf) / downside_vol; downside_vol uses only months below rf |
| `sortino_5y` | 5Y | Same |
| `beta_3y` | 3Y | Cov(instrument, benchmark) / Var(benchmark); benchmark per instrument |
| `r_squared_3y` | 3Y | Square of correlation with benchmark |
| `tracking_error_3y` | 3Y | Stdev of (instrument return - benchmark return) * sqrt(12) |
| `information_ratio_3y` | 3Y | (Ann instrument return - ann benchmark return) / tracking_error |
| `max_drawdown_3y` | 3Y | Max peak-to-trough decline over 36-month window |
| `max_drawdown_5y` | 5Y | Same over 60-month window |
| `calmar_3y` | 3Y | Annualized 3Y return / abs(max_drawdown_3y) |

Plus `_meta` block carrying the benchmark used, sector tag, and cap tier.

### Benchmark mapping for stocks

- Banking stocks (`sectors banks_private`, `banks_psu`) -> Nifty Bank TRI
- IT stocks (`it_services`, `it_products`) -> Nifty IT TRI
- Other large-cap stocks -> Nifty 50 TRI
- Mid-cap stocks -> Nifty Midcap 150 TRI
- Small-cap stocks -> Nifty Smallcap 250 TRI

Cap tiers: large (mcap >= 100,000 Cr), mid (25,000-100,000), small (< 25,000 or zero/broken).

### Benchmark mapping for funds

Phase B/C: not implemented (funds have no benchmark in Tier B). Per Phase A audit, 86.6% of funds have no source `Benchmark Index`; the canonical 16-index set is intended to cover this gap via a future `benchmark_resolution` mapping.

For now, funds get `beta_3y = None`, `r_squared_3y = None`, etc. Sharpe, Sortino, max drawdown, vol all computable without benchmark.

### Insufficient-data sentinel

If an instrument's monthly series doesn't span the full 36-month or 60-month window, the corresponding stats return `None` with a `data_window_insufficient` sentinel on the parent:

```json
{
  "tier_b_stats": {
    "data_window_insufficient": true,
    "reason": "monthly_nav_too_short"
  }
}
```

This affects ~183 MFs (10%) whose source `monthly_nav` has < 12 months.

## Alternatives considered

**Compute Tier B at case-time in each pipeline.**
Means every case pipeline that needs risk stats recomputes them. Architectural muddle: stat computation logic lives in multiple places, and changes to the formula propagate through multiple files. Rejected.

**Compute Tier B at snapshot time but in a separate companion file (not embedded in snapshot JSON).**
Means snapshot consumers must read two files; introduces sync risk between snapshot and companion file. Rejected.

**Tier B only for MFs (not stocks).**
The diagnostic claims for concentrated-direct-stock archetypes (Imtiaz IT-heavy, Vikas RIL-heavy, Surana direct equity) require per-stock Tier B. Rejected.

## Consequences

**Positive:**
- Single source of truth: every consumer reads the same pre-computed values.
- Risk-reward, time-series, and other downstream workstreams can be thin (just read tier_b_stats).
- Stats are computed exactly once per instrument per snapshot, then read N times.
- Sentinel-based handling for insufficient-data cases is explicit and consistent.

**Negative:**
- Snapshot file size grows. Each instrument gets ~13 fields in `tier_b_stats`; 500 stocks + 1773 MFs = ~30K Tier B values per snapshot. Negligible vs the monthly series sizes.
- Formula changes require regenerating all snapshots. Acceptable given snapshots are dev-phase artifacts.

## Source-data divergence note

Tier B Sharpe is computed using rf = 5.25% (repo rate at t0). The source data's existing `Sharpe` scalar uses an unclear RF baseline (the source values for liquid funds and overnight funds are implausibly negative, suggesting the source uses a very short-rate baseline that funds barely beat).

This means tier_b_stats.sharpe_3y will not match source `Sharpe` for most funds, especially in debt categories. **Within-category Sharpe correlation between source and Tier B remains high for equity categories** (Multi Cap 0.95, Equity Index 0.91, Flexi Cap 0.89, Large Cap 0.89). For debt and arbitrage funds, correlation is weak due to RF mismatch.

This is acceptable. Diagnostic claims are about relative ordering within a category, which Tier B preserves. Absolute Sharpe values diverge between source and Tier B, which is expected and documented.

If a downstream consumer cares about a specific Sharpe convention (e.g., using 91-day T-bill yield instead of repo as RF), it should specify which field it reads:
- `Sharpe` (source flat scalar): unknown RF baseline, treat as opaque
- `tier_b_stats.sharpe_3y` (snapshot-recomputed): 5.25% repo rate, documented
