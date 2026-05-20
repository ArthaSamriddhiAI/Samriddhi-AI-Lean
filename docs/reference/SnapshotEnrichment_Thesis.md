# Snapshot Data Enrichment, Product Thesis

**Status:** Final
**Scope:** Lean Samriddhi MVP, data-infrastructure workstream
**Position in Plan v6:** Capability Phase 2 (between A2 classification and risk-reward statistics)

---

## What this workstream does

Adds monthly-frequency time series data to the Lean Samriddhi MVP's 9 time-stepped snapshots (t0 through t8). Specifically:

1. **Stock monthly_prices** for all 500 Nifty 500 companies. 84 months of pre-t0 history at t0; extended by 3 months per snapshot through t8.
2. **Index series** for 16 canonical indices. 84 months at t0; extended forward per snapshot.
3. **FX series** for USD/INR. 84 months at t0; extended forward per snapshot.
4. **Tier B per-instrument stats** (vol, Sharpe, Sortino, beta, R-squared, tracking error, IR, max drawdown, Calmar) for all stocks and funds, computed at each snapshot.
5. **MF monthly_nav extension** by 3 months per snapshot (fixes a pre-existing freeze in the source data).
6. **rolling_metrics recomputation** at each snapshot t1..t8 off the extended monthly_nav.
7. **Period return scalar recomputation** (1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 15Y, MTD, YTD) at each snapshot t1..t8.

## What this workstream does NOT do

- **Does NOT restructure existing data.** File structure is identical to source. Existing top-level keys preserved.
- **Does NOT touch t0 rolling_metrics or period return scalars.** Source values preserved per Phase A audit (boundary discontinuity authorized).
- **Does NOT modify the quarterly engine.** Existing `generate_snapshots.py` continues to be the source of canonical quarterly returns; enrichment calibrates monthly series to compound to those quarterly values.
- **Does NOT add PMS NAV history or AIF return data.** Both stay sentinel-deferred per the foundation document.
- **Does NOT build the production data ingestion path.** This enriches the dev-phase synthetic snapshots only.

## Why this workstream exists

Three reasons that survived planner review:

1. **The diagnostic register is honest by design.** Sentinels exist for genuine limitations (PMS disclosure regime, AIF return data). For data that *could* be richer but isn't because of dev-phase shortcuts, sentinels are a worse fit; they undercut diagnostic claims that depend on the missing data. Bhatt, Imtiaz, Vikas demos all rest on concentrated direct-stock claims; without monthly stock data, those claims couldn't be supported by computable risk metrics.

2. **The architectural seam belongs upstream.** Per-instrument stats are logically snapshot-onboarding outputs, not case-time outputs. Reliance's Sharpe is Reliance's Sharpe regardless of which investor holds it; computing once at snapshot time and reading through for every case is cleaner than recomputing per investor per case. Doing enrichment first lets risk-reward consume pre-enriched per-instrument stats and remain thin.

3. **Cost is contained and bounded.** Stock-monthly synthesis, index-monthly synthesis, FX-monthly synthesis are bounded data-generation tasks. Unlike capability workstreams, scope creep risk is low.

## Architectural principle: richness, not restructuring

The single most important property of this enrichment is that existing data is preserved. Specifically:

- All top-level keys in source snapshots remain unchanged (`_meta`, `mf_funds`, `aif`, `pms`, `nifty500`, `unlisted_equity`, `industry_reports`, `macro`).
- Two new top-level blocks are added (`indices`, `fx`) where no existing structure exists for that data.
- All existing sub-fields on existing records are preserved unchanged at their original values.
- New sub-fields are added (`monthly_prices`, `tier_b_stats` on stocks; `tier_b_stats` on funds).
- The only field-level changes are: `monthly_nav` extended forward (the freeze fix), `rolling_metrics` and period return scalars recomputed at t1..t8 (per Phase A audit decision to accept boundary discontinuity at t0/t1).

This property is non-negotiable. Every existing consumer of snapshot data continues to read what it already reads; new consumers can opt into the richer fields.

## Calibration principle: monthly compounds to quarterly

The existing quarterly engine (`generate_snapshots.py`) produces canonical quarterly NAV, CMP, AUM values for each snapshot. The monthly series we add is calibrated such that the three monthly returns within each quarter compound *exactly* to the quarterly return implied by the existing engine.

This produces zero tolerance by construction. There is no possibility of disagreement between the canonical quarterly value and what the monthly series implies.

The trade-off: when the existing engine produces an unusual quarterly value (e.g., source data missed applying the bank shock to SBI), the monthly series will show implausible-looking intra-quarter moves to balance to the target. We documented these cases as out-of-scope findings to surface to planning chat alongside other cluster-3 cleanup items; the enrichment honors the source engine as canonical.

## Stock synthesis methodology: hybrid two-factor

Per stock, monthly returns compose as:

```
r_stock = w_market * r_market
        + w_cap_tier * r_cap_tier
        + w_sector * beta_to_sector * r_sector_idio
        + r_stock_idio
```

Where:
- `r_market`: single shared market factor across all stocks (annual drift 11.5%, annual vol 16%)
- `r_cap_tier`: orthogonal factor per cap tier (large/mid/small) with separate drift and vol
- `r_sector_idio`: per-sector noise, orthogonal to market and cap-tier
- `r_stock_idio`: per-stock idio noise

This is a classic two-factor decomposition. The market factor gives realistic cross-sector correlation (and therefore realistic index vol). The cap-tier factor gives realistic within-tier cohesion (small-cap stocks correlate strongly with the smallcap index because they all load on the small-cap factor). Sector idio gives sector-specific dispersion. Stock idio gives the residual.

Per-stock parameters: most stocks have default `(beta_to_sector=1.0, idio_vol=0.045)`. Bellwethers (HDFC Bank, ICICI Bank, TCS, etc.) have explicit overrides matching known market reality.

## Narrative beat preservation

The 9 snapshots encode 5 narrative beats per `SNAPSHOT_TEST_AXIS_DESIGN.md`:

| Snapshot | Event | Pinned month |
|---|---|---|
| t2 | IT cool | spread across quarter |
| t3 | RBI rate cut 50 bps | 2026-12 |
| t5 | Bank sector shock | 2027-07 |
| t6 | RIL idiosyncratic | 2027-10 |
| t8 | Smallcap rally peak | 2028-03 |

Each surgical event has a specific within-quarter month assigned. The monthly extension forces the event delta into that month, with the other months in the quarter absorbing the residual to land on the quarterly target.

Validated probes from the design doc match exactly to 2 decimal places:
- RIL t5→t6: design -28.0%, produced -28.00%
- RIL t7→t8: design +16.2%, produced +16.24%
- HDFC Bank Jun→Jul 2027: produced -16% (compounds to -18% quarterly target)
- Long-duration gilt Nov→Dec 2026: produced +4.50% (per rate-cut design spec)

## What gets fixed by this enrichment

The source snapshots have a pre-existing freeze: `monthly_nav` ends at 2026-05 in every snapshot from t0 through t8, even though the quarterly `NAV` field moves through 8 quarters of evolution. By t8 (April 2028), reading `monthly_nav['2027-07']` returned `None` even though the snapshot was supposed to reflect post-bank-shock state.

This enrichment closes that gap as a side effect of extending the monthly series forward. After enrichment, every snapshot's `monthly_nav` ends at the snapshot date, and rolling computations off the monthly series produce values that reflect the snapshot's actual point in time.

## File size and performance

Enrichment grows each snapshot by 12% to 22% (12.13 MB to 13.28 MB enriched, vs 10.74 MB source). Total payload across 9 snapshots: ~115 MB enriched vs 97 MB source. Synthesis runs in approximately 90 seconds end-to-end on a laptop for the full t0..t8 sequence.

## Downstream consumers

After this enrichment lands, the following workstreams can safely assume the richer schema:

- **Risk-reward statistics:** reads pre-computed `tier_b_stats` per instrument; no recomputation required at case time.
- **Time-series performance:** reads monthly_prices, monthly_nav, indices.monthly_values directly for rolling analyses.
- **Pairwise overlap:** unaffected (operates on Holdings, not market data).
- **House view:** consumes index series for relative-value views.

See `docs/workstreams/snapshot_enrichment_handoff.md` for the formal hand-off contract.
