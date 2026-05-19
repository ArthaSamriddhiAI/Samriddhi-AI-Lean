# ADR-4: FX Synthesis

**Status:** Accepted
**Date:** Phase B implementation
**Supersedes:** None
**Folds:** Original ADR-4 standalone

## Context

The source data carries USD/INR as a single spot value in `macro.data_snapshot.dimensions[].indicators[]` (94.787 at t0). No monthly FX history exists.

Future-proofing for foreign-currency holdings (LRS-routed brokerage, GIFT City IFSC, ADRs/GDRs, foreign-currency funds) requires monthly FX time series. The current S2 fixture set has no foreign-currency holdings, so this doesn't bite today; but the schema needs the series anyway, and the synthesis must be consistent with the rest of the snapshot.

## Decision

**Synthesize USD/INR monthly series anchored to the existing spot value at each snapshot.**

### Methodology

At t0:
- Anchor: source spot value `94.787` at the snapshot date.
- Walk backward 84 months using monthly returns sampled from Gaussian(monthly_drift, monthly_vol).
- Monthly drift: 3.0% / 12 = 0.25%/month (INR depreciation; the long-run pattern).
- Monthly vol: 6.0% / sqrt(12) = 1.73% / month.

At t1..t8:
- Target spot: read from source snapshot's `macro.data_snapshot.dimensions[].indicators[]`.
- Calibrated forward extension per ADR-1: 3 monthly returns compound exactly to the target spot.

### Schema placement

New top-level `fx` block:

```json
{
  "fx": {
    "usd_inr": {
      "monthly_values": {"YYYY-MM": 94.787, ...},
      "metadata": {
        "t_spot": 94.787,
        "synthesis_method": "drift_plus_gaussian_vol",
        "annual_drift_pct": 3.0,
        "annual_vol_pct": 6.0
      }
    },
    "eur_inr": null,
    "gbp_inr": null,
    "aed_inr": null
  }
}
```

USD/INR is populated; EUR, GBP, AED reserved as null for future fixtures.

### Other currencies

Out of scope for this enrichment. The schema slots exist but are null-populated. When a future fixture needs EUR/INR, GBP/INR, or AED/INR, add synthesis in `enrich_snapshots.py` with parameters appropriate to each currency pair's long-run drift and vol.

## Alternatives considered

**Real RBI reference rate history.**
RBI publishes daily USD/INR reference rates back decades. Using real history would mean: at t8 (April 2028), the USD/INR series would show whatever actually happened in real life from 2019 onward.

Rejected because:
1. Real history doesn't align with the synthetic narrative beats (rate cut at t3, bank shock at t5, etc.). The macro environment in our snapshot is synthetic; real FX history wouldn't match.
2. Real history for forward months (post-2025) doesn't exist when the snapshot is generated. The snapshot covers 2026-2028.

**Single value for all months (carry the spot value forward unchanged).**
The simplest possible approach. Rejected because it eliminates any FX volatility from analyses; tracking error and currency-hedged vs unhedged analyses would produce identical results, which is wrong.

## Consequences

**Positive:**
- FX series is internally consistent with the rest of the synthetic snapshot.
- Schema is future-proofed; adding other currencies is a parameter change, not a schema change.
- USD/INR vol is realistic (6% annualized matches roughly the long-run vol of the actual rate).

**Negative:**
- The source data has USD/INR unchanged at 84.2 from t4 onward (the existing engine doesn't evolve macro USD/INR past t3). Our calibration faithfully reproduces this: monthly USD/INR oscillates within each quarter from t4-t8 but ends at exactly 84.2 at every quarter end. This is a "freeze" in the macro side that we don't fix (out of scope; doesn't affect any S2 fixture today). Documented for future reference if/when a foreign-currency fixture surfaces.

## Future considerations

If foreign-currency holdings become part of a fixture, the synthesis needs:
1. Currency-pair-specific drift and vol parameters.
2. Possibly cross-correlation between currency pairs (USD/INR and EUR/INR are not independent).
3. Calibration against any macro events affecting FX (RBI intervention, capital controls, etc.).

None of this is needed for the current scope; flagging for awareness.
