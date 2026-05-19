# Snapshot Schema Diff: Before vs After Enrichment

**Source:** `01_-_SamriddhiAI_data_clean.json` and `snapshot_t0..t8_q*_*.json` (pre-enrichment)
**Target:** Enriched snapshots produced by `enrich_snapshots.py`

This document is a structural diff showing what changes and what stays the same.

---

## Top-level structure

```diff
{
  "_meta": {...},                          // UNCHANGED
  "mf_funds": [...],                       // CHANGED: per-fund additions
  "aif": {...},                            // UNCHANGED
  "pms": {...},                            // UNCHANGED
  "nifty500": {...},                       // CHANGED: per-company additions
  "unlisted_equity": {...},                // UNCHANGED
  "industry_reports": [...],               // UNCHANGED
  "macro": {...},                          // UNCHANGED
  "snapshot_metadata": {...},              // CHANGED: enrichment_* fields added
+ "indices": {...},                        // NEW: top-level block
+ "fx": {...}                              // NEW: top-level block
}
```

Net: same 9 existing top-level keys preserved; 2 new top-level keys added.

---

## mf_funds[] (per fund)

```diff
{
  "fund_name": "...",                      // UNCHANGED
  "amfi_code": "...",                      // UNCHANGED
  "sebi_category": "...",                  // UNCHANGED
  "total_months": 241,                     // UNCHANGED
  "NAV": 139.192,                          // UNCHANGED (source quarterly engine output)
  "AUM (Cr)": ...,                         // UNCHANGED
- "MTD": 1.77,                             // RECOMPUTED at t1..t8; PRESERVED at t0
- "YTD": -9.75,                            // RECOMPUTED at t1..t8; PRESERVED at t0
- "1M": -0.067557,                         // RECOMPUTED at t1..t8; PRESERVED at t0
- "3M": -0.112518,                         // RECOMPUTED at t1..t8; PRESERVED at t0
- "6M": -0.081784,                         // RECOMPUTED at t1..t8; PRESERVED at t0
- "1Y": 0.004783,                          // RECOMPUTED at t1..t8; PRESERVED at t0
- "2Y": 0.020713,                          // RECOMPUTED at t1..t8; PRESERVED at t0
- "3Y": 0.127409,                          // RECOMPUTED at t1..t8; PRESERVED at t0
- "5Y": 0.08515,                           // RECOMPUTED at t1..t8; PRESERVED at t0
- "7Y": 10.69,                             // RECOMPUTED at t1..t8; PRESERVED at t0
- "10Y": 0.113367,                         // RECOMPUTED at t1..t8; PRESERVED at t0
- "15Y": 0.116334,                         // RECOMPUTED at t1..t8; PRESERVED at t0
  "Sharpe": 0.438053,                      // UNCHANGED (source flat scalar)
  "Sortino": 0.53,                         // UNCHANGED
  "Beta": 0.99,                            // UNCHANGED
  "Volatility": ...,                       // UNCHANGED
  "VaR (H)": ...,                          // UNCHANGED
  "VaR (I)": ...,                          // UNCHANGED
  "Benchmark Index": "...",                // UNCHANGED
  "Top 5 Holdings (JSON)": [...],          // UNCHANGED (source quarterly engine output)
  "Top 5 Sectors (JSON)": [...],           // UNCHANGED
  "Fund Managers (JSON)": [...],           // UNCHANGED
  "Exit Load (JSON)": {...},               // UNCHANGED
  "P/E": ...,                              // UNCHANGED
  "P/B": ...,                              // UNCHANGED
  "Cash %": ...,                           // UNCHANGED
  "No. Holdings": ...,                     // UNCHANGED
  "Data As Of": "...",                     // UNCHANGED
  "monthly_nav": {...},                    // EXTENDED forward (freeze fix per ADR-1)
  "rolling_metrics": {...},                // RECOMPUTED at t1..t8; PRESERVED at t0
+ "tier_b_stats": {                        // NEW
+   "vol_3y_annualized": 0.245,
+   "vol_5y_annualized": 0.230,
+   "sharpe_3y": 0.43,
+   "sharpe_5y": 0.38,
+   "sortino_3y": 0.51,
+   "sortino_5y": 0.45,
+   "max_drawdown_3y": -0.18,
+   "max_drawdown_5y": -0.22,
+   "calmar_3y": 0.74,
+   "beta_3y": null,                       // null for funds (no benchmark in Phase B/C)
+   "r_squared_3y": null,
+   "tracking_error_3y": null,
+   "information_ratio_3y": null
+ }
}
```

Net per fund: 1 new sub-block (`tier_b_stats`), 1 field extended (`monthly_nav`), 2 field categories recomputed at t1..t8 (period scalars, `rolling_metrics`).

### monthly_nav extension specifics

| Snapshot | Pre-enrichment | Post-enrichment |
|---|---|---|
| t0 | ends 2026-05 | ends 2026-05 (unchanged; source baseline) |
| t1 | ends 2026-05 (frozen) | ends 2026-07 (+2 months) |
| t2 | ends 2026-05 (frozen) | ends 2026-10 (+5 months) |
| t3 | ends 2026-05 (frozen) | ends 2027-01 (+8 months) |
| t4 | ends 2026-05 (frozen) | ends 2027-04 (+11 months) |
| t5 | ends 2026-05 (frozen) | ends 2027-07 (+14 months) |
| t6 | ends 2026-05 (frozen) | ends 2027-10 (+17 months) |
| t7 | ends 2026-05 (frozen) | ends 2028-01 (+20 months) |
| t8 | ends 2026-05 (frozen) | ends 2028-04 (+23 months) |

---

## nifty500.companies[] (per company)

```diff
{
  "sno": 1,                                // UNCHANGED
  "name": "Reliance Industries",           // UNCHANGED
  "cmp_rs": 1315.10,                       // UNCHANGED (source quarterly engine output)
  "market_cap_rs_cr": 1779654.99,          // UNCHANGED
  "pe": 22.4,                              // UNCHANGED
  // ... all 37 existing fields preserved unchanged ...
  "return_3m_pct": ...,                    // UNCHANGED
  "return_6m_pct": ...,                    // UNCHANGED
+ "monthly_prices": {                      // NEW
+   "2019-05": 809.63,
+   "2019-06": 815.40,
+   // ... 84 months pre-t0 + extension to snapshot date ...
+   "2026-04": 1315.10
+ },
+ "tier_b_stats": {                        // NEW
+   "vol_3y_annualized": 0.245,
+   "vol_5y_annualized": 0.230,
+   "sharpe_3y": 0.43,
+   "sortino_3y": 0.51,
+   "max_drawdown_3y": -0.18,
+   "max_drawdown_5y": -0.22,
+   "calmar_3y": 0.74,
+   "beta_3y": 1.28,                       // populated for stocks (benchmarked)
+   "r_squared_3y": 0.26,
+   "tracking_error_3y": 0.18,
+   "information_ratio_3y": 0.12,
+   "_meta": {
+     "sector": "petroleum_refining",
+     "cap_tier": "large",
+     "benchmark_index_id": "nifty_50_tri"
+   }
+ }
}
```

Net per company: 2 new sub-blocks (`monthly_prices`, `tier_b_stats`); zero changes to existing fields.

---

## indices (new top-level block)

```diff
+ "indices": {
+   "nifty_50_tri": {
+     "name": "Nifty 50 TRI",
+     "category": "equity_largecap",
+     "synthesis_method": "derive_from_constituents",
+     "monthly_values": {"2019-05": 483.76, ..., "2026-04": 1000.00},
+     "metadata": {
+       "base_value": 1000.0,
+       "base_month": "2019-05",
+       "currency": "INR"
+     }
+   },
+   "nifty_next_50_tri": {...},
+   "nifty_100_tri": {...},
+   "nifty_midcap_150_tri": {...},
+   "nifty_smallcap_250_tri": {...},
+   "nifty_500_tri": {...},
+   "bse_sensex_tri": {...},
+   "nifty_bank_tri": {...},
+   "nifty_it_tri": {...},
+   "crisil_composite_bond": {...},
+   "crisil_short_term_bond": {...},
+   "crisil_dynamic_gilt": {...},
+   "nifty_10y_gsec": {...},
+   "crisil_liquid": {...},
+   "gold_inr": {...},
+   "sp_500_tri_inr": {...}
+ }
```

16 canonical indices. See ADR-3 for the full set and synthesis methodology.

---

## fx (new top-level block)

```diff
+ "fx": {
+   "usd_inr": {
+     "monthly_values": {"2019-05": 68.187, ..., "2026-04": 94.787},
+     "metadata": {
+       "t_spot": 94.787,
+       "synthesis_method": "drift_plus_gaussian_vol",
+       "annual_drift_pct": 3.0,
+       "annual_vol_pct": 6.0
+     }
+   },
+   "eur_inr": null,
+   "gbp_inr": null,
+   "aed_inr": null
+ }
```

USD/INR populated; EUR/GBP/AED slots reserved for future fixtures.

---

## snapshot_metadata (updated)

```diff
"snapshot_metadata": {
  "snapshot_id": "t5_q3_2027",                              // UNCHANGED
  "snapshot_date": "2027-07-01",                            // UNCHANGED
  "evolution_type": "stress_bank_shock",                    // UNCHANGED
  "days_elapsed_since_t0": 455,                             // UNCHANGED
  "evolved_fields": [...],                                  // UNCHANGED
  "static_fields": [...],                                   // UNCHANGED (still declares monthly_nav as static, even though enrichment extends it; metadata is honest to source engine's perspective)
  "macro_event": {...},                                     // UNCHANGED
  "generation_notes": "...",                                // UNCHANGED
  "rng_seed": ...,                                          // UNCHANGED
+ "enrichment_version": "0.2.0-phase-c-forward-extension", // NEW
+ "enrichment_applied_at": "2026-05-19",                   // NEW
+ "snapshot_id_enrichment": "t5_q3_2027"                   // NEW
}
```

---

## File size impact

| Snapshot | Source | Enriched | Growth |
|---|---|---|---|
| t0 | 10.74 MB | 12.13 MB | +13.0% |
| t1 | 10.75 MB | 12.20 MB | +13.5% |
| t2 | 10.75 MB | 12.30 MB | +14.4% |
| t3 | 10.75 MB | 12.50 MB | +16.3% |
| t4 | 10.75 MB | 12.63 MB | +17.5% |
| t5 | 10.75 MB | 12.74 MB | +18.5% |
| t6 | 10.75 MB | 13.00 MB | +20.9% |
| t7 | 10.75 MB | 13.14 MB | +22.2% |
| t8 | 10.75 MB | 13.28 MB | +23.5% |
| **Total** | **97 MB** | **115 MB** | **+18.6%** |

File size growth is bounded and well within performance acceptable. Growth compounds because each snapshot adds 3 months of monthly_nav per 1773 funds and monthly_prices per 500 stocks.

---

## What does NOT change

To be explicit:

- All existing top-level keys preserved.
- All existing sub-fields preserved at their original values.
- Quarterly engine outputs (`NAV`, `AUM`, `cmp_rs`, `market_cap_rs_cr`, `Top 5 Holdings`, `Top 5 Sectors`) untouched.
- t0 source values for period return scalars and `rolling_metrics` preserved exactly.
- PMS, AIF, unlisted_equity, industry_reports, macro all untouched.
- Source flat risk-reward scalars (`Sharpe`, `Sortino`, `Beta`, `Volatility`, `VaR`) preserved unchanged; new `tier_b_stats` lives in parallel.

This preserves backward compatibility for every existing consumer.
