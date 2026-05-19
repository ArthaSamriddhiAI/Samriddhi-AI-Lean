# ADR-3: Index Synthesis Methodology and Canonical Index Set

**Status:** Accepted
**Date:** Phase A audit + Phase B implementation
**Supersedes:** None
**Folds:** Original ADR-3 (synthesis methodology) + ADR-9 (index set)

## Context

The source snapshot data carries fund-level `Benchmark Index` strings but no actual index time series. To support tracking-error, beta, R-squared, and information-ratio computations for both stocks and funds, monthly index series are needed.

Two questions:
1. Which indices ship in the canonical set?
2. How are the series computed?

## Decision

### Canonical index set: 16 indices

Driven by diagnostic-narrative needs (banks, IT, petroleum sectors and broad/cap-tier indices) plus the most-used source benchmarks, plus debt and commodity indices the existing MF universe needs.

| ID | Display Name | Category | Synthesis Method |
|---|---|---|---|
| nifty_50_tri | Nifty 50 TRI | equity_largecap | derive_from_constituents |
| nifty_next_50_tri | Nifty Next 50 TRI | equity_largecap | derive_from_constituents |
| nifty_100_tri | Nifty 100 TRI | equity_largecap | derive_from_constituents |
| nifty_midcap_150_tri | Nifty Midcap 150 TRI | equity_midcap | derive_from_constituents |
| nifty_smallcap_250_tri | Nifty Smallcap 250 TRI | equity_smallcap | derive_from_constituents |
| nifty_500_tri | Nifty 500 TRI | equity_broad | derive_from_constituents |
| bse_sensex_tri | BSE Sensex TRI | equity_largecap | derive_from_constituents |
| nifty_bank_tri | Nifty Bank TRI | equity_sector_banks | derive_from_constituents |
| nifty_it_tri | Nifty IT TRI | equity_sector_it | derive_from_constituents |
| crisil_composite_bond | CRISIL Composite Bond Index | debt_composite | synthesize_duration_model |
| crisil_short_term_bond | CRISIL Short Term Bond Index | debt_short_duration | synthesize_duration_model |
| crisil_dynamic_gilt | CRISIL Dynamic Gilt Index | debt_gilt_dynamic | synthesize_duration_model |
| nifty_10y_gsec | Nifty 10 Year Benchmark G-Sec | debt_gilt_long | synthesize_duration_model |
| crisil_liquid | CRISIL Liquid Debt Index | debt_liquid | synthesize_duration_model |
| gold_inr | Domestic Price of Gold | commodity_gold | synthesize_macro_anchored |
| sp_500_tri_inr | S&P 500 TRI (INR) | equity_intl_us | synthesize_correlated |

### Synthesis methodology by index type

**Derive-from-constituents (9 indices):**
Market-cap-weighted average of constituent monthly returns from the synthesized Nifty 500 universe. Constituent selection per index:
- nifty_50_tri: top 50 by mcap
- nifty_next_50_tri: ranks 51-100
- nifty_100_tri: top 100
- nifty_midcap_150_tri: all `mid` cap tier
- nifty_smallcap_250_tri: all `small` cap tier
- nifty_500_tri: all positive-mcap companies
- bse_sensex_tri: top 30
- nifty_bank_tri: sectors `banks_private` + `banks_psu`
- nifty_it_tri: sectors `it_services` + `it_products`

For TRI variants, a 1.5% annualized dividend uplift (0.00125 monthly) is added to the weighted average return. Indices are base-indexed at 1000.0 at the start of the synthesis window.

**Synthesize_duration_model (5 debt indices):**
Per-month returns drawn from Gaussian with index-specific annual drift and vol:
- crisil_composite_bond: drift 7.5%, vol 1.2% monthly
- crisil_short_term_bond: drift 7.0%, vol 0.5%
- crisil_dynamic_gilt: drift 7.5%, vol 2.5%
- nifty_10y_gsec: drift 7.2%, vol 2.0%
- crisil_liquid: drift 6.5%, vol 0.2%

For the rate-cut narrative beat at t3 (Dec 2026), gilt and bond indices get explicit positive deltas in Dec 2026 (gilt +4.5%, composite +2.5%, short-term +1.5%).

**Synthesize_macro_anchored (gold_inr):**
Drift 10.5%, vol 4.0% monthly. Reflects long-run gold-in-INR drift.

**Synthesize_correlated (sp_500_tri_inr):**
Drift 11.0%, vol 4.5% monthly. Independent synthesis; not correlated to Indian market factor (a future enhancement could correlate via shared global risk-on/off factor).

### Schema placement

New top-level `indices` block:

```json
{
  "indices": {
    "<index_id>": {
      "name": "...",
      "category": "...",
      "synthesis_method": "...",
      "monthly_values": {"YYYY-MM": 1234.56, ...},
      "metadata": {
        "base_value": 1000.0,
        "base_month": "2019-05",
        "currency": "INR"
      }
    }
  }
}
```

## Alternatives considered

**Source-benchmark enumeration (ship every index referenced in `Benchmark Index` across 1773 funds).**
Phase A audit found 86.6% of funds have no benchmark named, and the 238 that do span 198 distinct strings due to spelling/spacing variation. Enumeration approach fails. Rejected.

**Real historical data for indices.**
If stocks are synthesized but indices use real history, the index will not equal the market-cap-weighted return of its constituents in our snapshot. That inconsistency would silently break downstream consumers. Rejected.

**Derive ALL indices from constituents (no synthesized debt indices).**
Debt indices have no constituent universe in our snapshot. Rejected.

## Consequences

**Positive:**
- Index series are mathematically consistent with the synthesized stock universe (no contradiction between Nifty 50 return and weighted Nifty 50 constituent returns).
- Narrative beats land in indices automatically when they land in constituents (bank shock in July 2027 appears in Nifty Bank TRI because its constituents have -16% to -18% that month).
- 16 indices is a manageable set that covers all current and likely future fixture needs.

**Negative:**
- Synthesized debt indices drift without external anchoring; their t8 levels are emergent. No design-doc probe pins them, so any plausible drift is acceptable.
- TRI uplift is a flat 1.5% across indices and across time; real-world dividend yields vary by index and over time. Not material at the diagnostic level.
- S&P 500 (INR) is not correlated to the Indian market factor in our synthesis. If a future fixture needs realistic India-US correlation, this synthesis would need to introduce a shared global factor.

## Future considerations

If a future fixture needs an additional index (e.g., Nifty Auto, Nifty Pharma, Nifty Realty, MSCI India, India VIX), add to `CANONICAL_INDICES` in `enrich_snapshots.py` with appropriate synthesis method. The 16-index set is the minimum viable; expansion is straightforward.
