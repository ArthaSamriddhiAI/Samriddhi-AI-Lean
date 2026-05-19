# Snapshot Enrichment Hand-Off Note

**Audience:** Downstream workstreams that consume snapshot data.
**Effective:** Post-merge of the enrichment PR.
**Source of truth:** `enrich_snapshots.py`, the 6 ADRs in `docs/decisions/`, and `SCHEMA_DIFF.md`.

This document declares what downstream consumers can now assume from enriched snapshots, and what they should NOT assume.

---

## What you can now assume

### Per-stock monthly_prices is always present and current

For every company in `nifty500.companies[]` with a positive `cmp_rs`:

```python
prices = snapshot['nifty500']['companies'][i]['monthly_prices']
# prices is a dict {YYYY-MM: float}
# spans from 2019-05 through to the snapshot's effective month
# At t0: ends at 2026-04
# At t5: ends at 2027-07
# At t8: ends at 2028-04
```

The synthesized prices compound exactly to the source `cmp_rs` at each snapshot date. Use these for:
- Rolling stat computations (vol, Sharpe, drawdown) at any window length up to 7 years.
- Index re-derivation if needed (though the `indices` block is already pre-derived).
- Time-series visualizations.

Limitations:
- Pre-t0 historical levels are synthetic, not real. Reliance's 2019-05 synthesized price is not Reliance's actual 2019-05 price. Use for return-based analyses, not absolute-level queries.
- 2 of 500 stocks may have edge-case sector mapping ('other_unmapped' default in `sector_map.json`). Tier B stats still compute fine.

### Per-MF monthly_nav extends to snapshot date

For every fund in `mf_funds[]` with sufficient source history:

```python
mn = snapshot['mf_funds'][i]['monthly_nav']
# dict {YYYY-MM: float}
# pre-t0 history preserved from source (back to 2006-05 for many funds)
# extension forward calibrated to compound to source NAV at each snapshot
```

By t8, monthly_nav ends at 2028-04 for all funds that had monthly_nav at t0. **The pre-existing freeze is fixed.**

### Tier B stats are pre-computed per instrument

For every stock and most funds:

```python
tier_b = snapshot['nifty500']['companies'][i]['tier_b_stats']  # for stocks
tier_b = snapshot['mf_funds'][i]['tier_b_stats']               # for funds
# Fields: vol_3y_annualized, vol_5y_annualized, sharpe_3y, sharpe_5y,
#         sortino_3y, sortino_5y, max_drawdown_3y, max_drawdown_5y,
#         calmar_3y, beta_3y, r_squared_3y, tracking_error_3y, information_ratio_3y
# Stocks also have _meta: sector, cap_tier, benchmark_index_id
```

If an instrument's monthly series doesn't span the required window:

```python
tier_b = {"data_window_insufficient": True, "reason": "..."}
```

Always check for this sentinel before reading individual fields.

**Risk-free rate convention:** Tier B Sharpe/Sortino use rf = 5.25% (repo rate at t0). Source flat `Sharpe` values use a different baseline; do not compare directly. See ADR-6 for details.

### Indices are pre-computed, 16 canonical

```python
indices = snapshot['indices']
# 16 canonical: nifty_50_tri, nifty_next_50_tri, nifty_100_tri,
#               nifty_midcap_150_tri, nifty_smallcap_250_tri, nifty_500_tri,
#               bse_sensex_tri, nifty_bank_tri, nifty_it_tri,
#               crisil_composite_bond, crisil_short_term_bond, crisil_dynamic_gilt,
#               nifty_10y_gsec, crisil_liquid, gold_inr, sp_500_tri_inr

vals = indices['nifty_50_tri']['monthly_values']
# dict {YYYY-MM: float}, spans full window same as stock monthly_prices
```

Use for:
- Computing fund betas vs declared benchmarks (when benchmark mapping is implemented; see "What you should NOT yet assume" below).
- Sector concentration analyses (Nifty Bank for bank exposure, Nifty IT for IT exposure).
- Relative-value views (Midcap vs Largecap performance, India vs US via S&P 500 INR).

### FX (USD/INR) is pre-computed

```python
fx = snapshot['fx']['usd_inr']['monthly_values']
# dict {YYYY-MM: float}, spans full window
```

Other currencies (EUR/GBP/AED) are null-populated; add synthesis when needed.

### Period return scalars are recomputed at t1..t8

For every fund at t1..t8:

```python
fund['1M']    # decimal: last month return
fund['3M']    # decimal: 3-month return
fund['6M']    # decimal
fund['1Y']    # decimal: 1-year total return
fund['2Y']    # decimal: annualized
fund['3Y']    # decimal: annualized
fund['5Y']    # decimal: annualized
fund['7Y']    # PERCENTAGE: annualized * 100 (source convention)
fund['10Y']   # decimal: annualized
fund['15Y']   # decimal: annualized
fund['MTD']   # percentage
fund['YTD']   # percentage
```

At t0: source values preserved unchanged (boundary discontinuity per ADR-1).

### rolling_metrics is recomputed at t1..t8

For every fund at t1..t8 with sufficient history:

```python
rm = fund['rolling_metrics']
# Fields: max_drawdown, max_dd_recovery_months,
#         rolling_3y_pct_beat_cat, rolling_3y_avg_excess,
#         rolling_5y_pct_beat_cat, rolling_5y_avg_excess,
#         alpha_trend_slope, alpha_trend_direction (improving/stable/deteriorating),
#         regime_stability,
#         upside_capture_3y, downside_capture_3y,
#         rolling_ir_current
```

At t0: source values preserved unchanged.

---

## What you should NOT yet assume

### Fund Tier B betas are NOT populated

Phase B/C set `beta_3y`, `r_squared_3y`, `tracking_error_3y`, `information_ratio_3y` to `None` for funds because the benchmark-resolution mapping isn't implemented yet.

To populate these, a future workstream needs to:
1. Build the `benchmark_resolution` mapping (source `Benchmark Index` string -> canonical `index_id`).
2. Resolve funds without a source benchmark via cap-tier fallback (similar to stocks).
3. Recompute Tier B with the resolved benchmark.

This is deferred to risk-reward statistics workstream (which has the strongest need for it).

### Pre-t0 historical stock levels are NOT real

If your consumer queries "what was Reliance trading at in March 2020", the answer in the snapshot is a synthesized value, not historical reality. Do not present pre-t0 stock prices to the end user as historical facts.

### Source `Sharpe`, `Sortino`, `Beta` flat scalars use UNDOCUMENTED conventions

The source data's existing risk scalars (e.g., `mf_funds[].Sharpe`) come from an unknown methodology. Some values are implausible (overnight fund Sharpes of -11 to -18). Treat them as opaque source data. For diagnostic computations, prefer `tier_b_stats.sharpe_3y` etc.

### Some MFs in archetype holdings are not in source MF universe

Findings from Phase A audit: Axis Bluechip Fund, HDFC Index Fund Nifty 50 Plan, Kotak Emerging Equity Fund are referenced in archetype holdings ledger but absent from source `mf_funds[]`. Affects Lalitha, Mehra, Malhotra archetypes. The enrichment does not fix this; it's a cluster-3 fixture gap.

When a case pipeline encounters a missing MF reference, fall back to placeholder behavior (e.g., compute portfolio stats only on available holdings, sentinel the missing portion).

### Some source `market_cap_rs_cr` values are broken

Phase A audit found 5 companies with implausibly large mcaps (KPRMilIILtd, OneSource Speci, JSW Cement, Gallantt Ispat L, Choice Intl, all > 1.5M Cr) and ~19 companies with mcap = 0 (Vodafone Idea, IndusInd Bank, GMR Airports, etc.). These get classified as 'small' cap-tier by default. Edge effects on index constituent selection are minor (these stocks are excluded from the broken-mcap-filtered top-N selections).

### SBI escaped the bank shock in source

Phase C surfaced that the existing quarterly engine uses substring matching ('Bank' in name) to detect bank stocks for the shock; SBI doesn't match. Source SBI t5 cmp_rs went UP 10% instead of the design-doc-intended -18%. The enrichment honors source as canonical, so SBI's monthly extension at t5 shows a -18% surgical drop in July that's compensated by implausible May/June pumps to reach the source quarterly target.

For diagnostic claims about "bank sector concentration in t5", **use sector aggregates via `tier_b_stats._meta.sector == 'banks_psu' or 'banks_private'`** rather than relying on individual name detection.

---

## Common patterns for consumers

### Computing portfolio-level Sharpe from holdings

```python
# Suppose holdings = [{'instrument_id': 'INF...', 'weight': 0.15}, ...]
# For each MF holding, look up tier_b_stats.sharpe_3y
# For each stock holding, look up nifty500.companies[name].tier_b_stats.sharpe_3y
# Weight-average for the portfolio
```

### Detecting freeze in snapshot

```python
mn = fund['monthly_nav']
last_month = sorted(mn.keys())[-1]
snapshot_date = snapshot['snapshot_metadata']['snapshot_date']  # e.g. '2027-07-01'
expected_month = snapshot_date[:7]  # '2027-07'
if last_month < expected_month:
    # freeze still present, enrichment didn't apply
    log_warning(f"Snapshot has frozen monthly_nav: ends {last_month}, expected {expected_month}")
```

If freeze is detected after merge, regenerate the enriched snapshot.

### Reading index series for benchmark beta

```python
fund_sebi_cat = fund['sebi_category']  # e.g. 'Large Cap Fund'
# Map cap to index (see ADR-3 for the full mapping)
if 'Large Cap' in fund_sebi_cat:
    bench_id = 'nifty_50_tri'
elif 'Mid Cap' in fund_sebi_cat:
    bench_id = 'nifty_midcap_150_tri'
elif 'Small Cap' in fund_sebi_cat:
    bench_id = 'nifty_smallcap_250_tri'
# ...
bench_series = snapshot['indices'][bench_id]['monthly_values']
# Compute fund beta vs bench_series from fund['monthly_nav']
```

### Detecting narrative beats in monthly_prices

```python
# At t6, RIL should show ~-26% in 2027-10
ril_mp = snapshot['nifty500']['companies'][ril_idx]['monthly_prices']
sep = ril_mp['2027-09']
oct = ril_mp['2027-10']
ret = oct / sep - 1
# ret should be roughly -0.26 (compounds to -0.28 quarterly)
```

---

## Workstream-specific hand-offs

### Risk-reward statistics (next to resume)

- Reads `tier_b_stats` per instrument; aggregates to portfolio level.
- Needs to build benchmark_resolution mapping (deferred from Phase B/C).
- Trade-off 3 and Trade-off 4 sections of risk-reward thesis are now obsolete; the upstream constraints they describe have been resolved.

### Time-series performance

- Reads `monthly_nav` and `monthly_prices` directly for rolling analyses.
- Index series available for relative-performance views.
- No additional enrichment needed.

### Pairwise overlap

- Unaffected (operates on Holdings, not market data).

### House view

- Index series available for relative-value views.
- Can construct cross-asset comparisons (Nifty 50 vs CRISIL Composite Bond, Gold vs Equity).

---

## Versioning

The enrichment script versions are tracked in `snapshot_metadata.enrichment_version`. Phase B/C/D produces `0.2.0-phase-c-forward-extension`. Future enrichment passes (Tier B benchmark resolution, additional indices, etc.) will bump the version.

If a downstream consumer needs to know which enrichment version a snapshot was processed with, read `snapshot_metadata.enrichment_version`.

---

## Outstanding items surfaced to planning chat (closure note)

1. Missing MFs in source MF universe (Axis Bluechip, HDFC Index Fund Nifty 50 Plan, Kotak Emerging Equity)
2. Broken `market_cap_rs_cr` values (5 stocks > 1.5M Cr, ~19 stocks = 0)
3. Existing engine's bank-shock detection misses SBI (substring matching gap)
4. Source data's risk scalars (`Sharpe`, etc.) use unclear methodology

All four are cluster-3 source-data quality issues, out of scope for this workstream. Surface in closure note for separate cleanup pass.
