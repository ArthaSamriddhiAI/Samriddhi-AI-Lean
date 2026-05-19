# ADR-2: Stock Monthly Synthesis (Hybrid Two-Factor) and Narrative Beat Injection

**Status:** Accepted
**Date:** Phase B prototype + Phase C extension
**Supersedes:** None
**Folds:** Original ADR-2 (stock synthesis) + ADR-8 (narrative beat month-pinning)

## Context

The source `nifty500.companies[]` records carry per-stock `cmp_rs`, `market_cap_rs_cr`, fundamental metrics, and short-term returns (`return_3m_pct`, `return_6m_pct`), but no monthly price history. To support per-instrument Tier B stats (Sharpe, beta, vol, etc.) and to give index-derivation a constituent universe, monthly_prices must be synthesized for all 500 names across 84 months pre-t0 plus 24 months forward through t8.

The synthesis must:
1. Produce realistic distributional properties (sector-appropriate vol, plausible betas, realistic index dispersion).
2. Preserve the narrative beats from `SNAPSHOT_TEST_AXIS_DESIGN.md` at month-level resolution.
3. Be deterministic and reproducible.

## Decision

**Hybrid two-factor synthesis with surgical event injection per-month.**

### Synthesis model

For each stock, monthly return decomposes as:

```
r_stock(m) = w_market * r_market(m)
           + w_cap_tier * r_cap_tier(m)
           + w_sector * beta_to_sector * r_sector_idio(m)
           + r_stock_idio(m)
```

Where:
- `r_market(m)`: single shared market factor across all 500 stocks. Annual drift 11.5%, annual vol 16%. `w_market = 0.45`.
- `r_cap_tier(m)`: orthogonal factor per cap tier (large/mid/small) with separate drift and vol. Weights: large 0.20, mid 0.25, small 0.30. Drifts: large 11%, mid 15%, small 17%. Vols: large 14%, mid 18%, small 22%.
- `r_sector_idio(m)`: per-sector noise, orthogonal to market and cap-tier factors. Per-sector annual drift and vol parameters in `SECTOR_PARAMS` (57 sectors total).
- `r_stock_idio(m)`: per-stock independent noise. Default `idio_vol = 0.045`; ~25 bellwether stocks have explicit overrides (HDFC Bank 0.030, TCS 0.030, RIL 0.060, Vodafone Idea 0.140, etc.).

The two-factor structure (market + cap-tier) is essential. A single-factor model produces betas that skew low because sector idio dominates; with cap-tier as a second factor, stocks within a cap tier correlate strongly (giving cohesive cap-tier indices with realistic vol) while different sectors still have moderate cross-correlation.

### Walk-backward synthesis at t0

For the 84-month pre-t0 history, monthly returns are sampled forward in time, then prices are walked backward from `cmp_rs` (the anchor):

```
prices[months[-1]] = cmp_rs                              # t0 anchor
prices[months[i]]  = prices[months[i+1]] / (1 + r_stock(months[i+1]))   # walk backward
```

This ensures the synthesized price at t0 matches the source `cmp_rs` exactly. Pre-t0 historical levels are emergent; they will not match real-world historical prices for any specific stock, but they will produce realistic return distributions, beta values, and index-level behavior.

### Forward extension at t1..t8

For each subsequent snapshot, monthly_prices is extended by 3 months (one per month of the quarter) using the calibration approach from ADR-1: target the quarterly CMP from the existing engine, force narrative-beat months to their surgical deltas, distribute residual across the remaining months.

### Narrative beat month-pinning

| Snapshot | Event | Pinned month | Mechanism |
|---|---|---|---|
| t2 | quiet_it_cool | Spread (no single pinned month) | IT services and IT products sectors get a quarter-wide drag of -4% and -3% respectively, distributed across the 3 months |
| t3 | stress_rate_cut | 2026-12 | Long-duration gilt funds: +4.5% in Dec 2026; medium-duration +4%; corporate debt +2.5%; short-duration +2%; liquid +0.5%. Stocks unaffected (rate cut shows up in debt indices and bond funds, not directly in stocks) |
| t5 | stress_bank_shock | 2027-07 | banks_private: -16% in July (compounds to -18% quarterly); banks_psu: -18% in July; nbfc_financials: -10%; insurance: -5%. MFs with bank concentration in Top 5 Sectors take proportional drag |
| t6 | stress_ril_idio | 2027-10 | Reliance Industries: -26% in October (compounds to -28% quarterly); petroleum_refining sector: -10%; oil_gas_upstream: -6%; city_gas_distribution: -4%. MFs with RIL in Top 5 Holdings take proportional drag |
| t8 | quiet_smallcap_rally | 2028-03 | All small-cap stocks: +7% in March (peak month); mid-caps: +4% in March. Small-cap funds get +7% NAV boost in March; mid-cap funds get +3% |

For sectoral and cap-tier surgical events, every stock in the affected category gets the same per-month delta, with the calibration distributing the residual to land on the quarterly target. For RIL specifically, the override is at the ticker level (not the sector).

### Pre-t0 lookback horizon

**84 months (7 years) before t0.** Rationale: source MF data carries `7Y` trailing returns. To make these recomputable (as period scalars off monthly_nav, in line with the freeze fix from ADR-1), the synthesis horizon must span 84 months. Going beyond (e.g., 120 months for 10Y) would mean synthesizing into 2016, which makes the synthetic history harder to keep distributionally realistic. The 7Y horizon is the deliberate honesty boundary; 10Y and 15Y trailing fields are computed where the source `monthly_nav` extends back far enough (most funds have monthly_nav back to 2006-2016).

## Alternatives considered

**Pure sector-anchored synthetic (single factor, no cap-tier).**
Tested in Phase B prototype. Produces:
- Beta distribution skewed low (median 0.46, p25 -0.01); not realistic.
- Smallcap index annualized 8% vs realistic ~19%.
- Cross-sector correlations too low; bellwether betas vs Nifty 50 are weird (Maruti at 0.47, ITC at 0.85).

Rejected; the two-factor model fixes all three issues.

**Real-historical-anchor (use actual NSE price history, perturbed).**
Brings provenance complexity. Real historical data needs sourcing, calibration of perturbation magnitude, handling for stocks listed mid-window. The benefit (per-stock idiosyncrasy is "real") doesn't outweigh the cost for a dev-phase synthetic snapshot. Rejected.

**Daily-frequency synthesis.**
Considered briefly. Rejected because the slowest-cadence diagnostic consumer is "3Y annualized Sharpe" which is fine at monthly resolution; daily resolution would 30x the synthesis output and provide no diagnostic value.

## Consequences

**Positive:**
- Bellwether betas match expectations (HDFC Bank 1.10 vs Nifty Bank, TCS 1.16 vs Nifty IT, RIL 1.39 vs Nifty 50).
- Beta distribution centered at p25=0.62, p50=0.77, p75=0.99. Min 0.21, max 1.65. Realistic spread, no negatives.
- Index returns plausible (Nifty 50 +11.3% CAGR, Smallcap 250 +16.1% CAGR).
- Narrative beats land in their pinned months with exact quarterly compounding to design-doc validation probes.

**Negative:**
- Pre-t0 historical levels are not real (Reliance's 2019 synthesized price is not Reliance's actual 2019 price). For absolute-level queries (rare in the diagnostic), this is a limitation; for return-based stats (the common case), it doesn't matter.
- Index vols are systematically lower than real-world (Nifty 50 synthesized 9% ann vol vs real ~16%) because of central-limit compression across constituents. Diagnostic claims are about relative values within a snapshot, so absolute vol mismatch isn't material.
- 2 of 500 stocks have edge-case sector mapping defaults (`other_unmapped`) due to ambiguity in source names. Fixable by manual update to `sector_map.json` if needed.
