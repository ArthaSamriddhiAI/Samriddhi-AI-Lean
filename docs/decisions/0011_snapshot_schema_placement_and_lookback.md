# ADR-5: Schema Placement and Lookback Horizon

**Status:** Accepted
**Date:** Phase A audit + Phase B/C implementation
**Supersedes:** None
**Folds:** Original ADR-5 (lookback) + ADR-6 (schema placement)

## Context

The enrichment adds three categories of new data:
1. Stock monthly_prices (per-instrument series)
2. Index series (16 indices)
3. FX series (USD/INR)

Plus Tier B stats per-instrument, and extends existing `monthly_nav` forward.

Two related questions:
- Where in the snapshot JSON does each new piece of data live?
- How many months of pre-t0 history do we synthesize?

## Decision

### Lookback horizon: 84 months (7 years) pre-t0

Pre-t0 history spans 2019-05 through 2026-04 for synthesized series (stock monthly_prices, index series, FX series). Existing MF `monthly_nav` history (which goes back to 2006-05 for many funds) is preserved as-is at t0 and extended forward only.

**Rationale:**
- Source MF data carries `7Y` trailing return scalars. To make these recomputable off `monthly_nav` (in line with the freeze fix from ADR-1), the synthesis horizon must span at least 84 months.
- `10Y` and `15Y` source scalars exist for funds with that much history; they're recomputed when the existing MF `monthly_nav` extends back far enough, which it does for many funds (max source coverage: 241 months at t0, extending to 264 months at t8).
- For stocks, indices, and FX, 84 months is the deliberate honesty boundary. Going further (120 months for 10Y, 180 months for 15Y) means synthesizing further into the past, with proportionally less calibration discipline.
- Tier B stats explicitly compute 3Y and 5Y windows (36 and 60 months); 84 months supports both.

### Schema placement: additive sub-fields, two new top-level blocks

**Stock monthly_prices and Tier B:** sub-fields on existing per-company record.

```json
{
  "nifty500": {
    "companies": [
      {
        "sno": 1,
        "name": "Reliance Industries",
        "cmp_rs": 1315.10,
        "market_cap_rs_cr": 1779654.99,
        "pe": 22.4,
        // ... all 37 existing fields preserved ...
        "monthly_prices": {"2019-05": 809.63, "2019-06": 815.40, ..., "2026-04": 1315.10},
        "tier_b_stats": {
          "vol_3y_annualized": 0.245,
          "sharpe_3y": 0.43,
          "sortino_3y": 0.51,
          "max_drawdown_3y": -0.18,
          "max_drawdown_5y": -0.22,
          "beta_3y": 1.28,
          "r_squared_3y": 0.26,
          "tracking_error_3y": 0.18,
          "information_ratio_3y": 0.12,
          "calmar_3y": 0.74,
          "_meta": {
            "sector": "petroleum_refining",
            "cap_tier": "large",
            "benchmark_index_id": "nifty_50_tri"
          }
        }
      },
      // ... 499 more companies
    ]
  }
}
```

**MF Tier B:** new `tier_b_stats` sub-block on each fund record, parallel to existing scalar fields:

```json
{
  "mf_funds": [
    {
      "fund_name": "...",
      "Sharpe": 0.438053,            // source scalar, preserved
      "Sortino": 0.53,                // source scalar, preserved
      "Beta": 0.99,                   // source scalar, preserved
      // ... all existing fields preserved ...
      "tier_b_stats": {               // new: snapshot-recomputed
        "sharpe_3y": 0.52,
        "sortino_3y": 0.44,
        // ...
      }
    }
  ]
}
```

Existing flat scalars (`Sharpe`, `Sortino`, `Beta`, `Volatility`, `VaR`, etc.) are preserved unchanged at their source values. The new `tier_b_stats` block carries snapshot-recomputed values for parallel access. Downstream consumers can choose to read either; this preserves backward compatibility while enabling forward access.

**Indices:** new top-level `indices` block (no existing structure to extend).

```json
{
  "indices": {
    "nifty_50_tri": {
      "name": "Nifty 50 TRI",
      "category": "equity_largecap",
      "synthesis_method": "derive_from_constituents",
      "monthly_values": {"2019-05": 483.76, ..., "2026-04": 1000.00},
      "metadata": {...}
    },
    // ... 15 more indices
  }
}
```

**FX:** new top-level `fx` block.

```json
{
  "fx": {
    "usd_inr": {
      "monthly_values": {"2019-05": 68.187, ..., "2026-04": 94.787},
      "metadata": {...}
    },
    "eur_inr": null,
    "gbp_inr": null,
    "aed_inr": null
  }
}
```

### Snapshot metadata

New `snapshot_metadata.enrichment_*` fields added to track provenance:

```json
{
  "snapshot_metadata": {
    // ... existing fields preserved ...
    "enrichment_version": "0.2.0-phase-c-forward-extension",
    "enrichment_applied_at": "2026-05-19",
    "snapshot_id_enrichment": "t5_q3_2027"
  }
}
```

## Alternatives considered

**Lookback at 60 months (5 years) only.**
Simpler; covers 3Y and 5Y windows. Rejected because 7Y trailing fields exist in source and we want to recompute them honestly post-freeze-fix.

**Lookback at 120+ months (10Y).**
Considered. Rejected because the synthesis discipline (calibrating sectors and stocks to plausible long-run dynamics) is harder over longer horizons; 7 years is enough to support 3Y and 5Y stats and approximate the source's 7Y values.

**Indices and FX as sub-fields on `macro`.**
Considered. Rejected because `macro` is structured as `data_snapshot.dimensions[].indicators[]` (key-value-like) and doesn't naturally accommodate time series. Top-level blocks are cleaner.

**Tier B overwriting existing flat scalars (Sharpe, Sortino, etc.).**
Considered. Rejected because:
- Backwards compatibility: existing consumers read the flat scalars.
- Audit trail: keeping source values lets us diff source vs enrichment for validation.
- Boundary discontinuity: existing flat scalars use source formulas (unclear methodology in some cases); our recomputed values use documented methodology. Keeping them parallel makes the divergence transparent.

## Consequences

**Positive:**
- File structure stays identical for all existing fields; existing consumers see no change.
- New consumers read clean, additive sub-fields or new top-level blocks.
- Audit trail preserved (source vs enrichment values both visible).
- Forward expansion is trivial (add a new currency, new index, new Tier B stat: just add a key).

**Negative:**
- File size grows ~12-22% per snapshot. Total enriched payload ~115 MB across 9 snapshots vs 97 MB source. Acceptable given storage costs.
- Some redundancy (source flat `Sharpe` and recomputed `tier_b_stats.sharpe_3y` coexist; consumers must know which to read for their purpose). Documented in hand-off note.
