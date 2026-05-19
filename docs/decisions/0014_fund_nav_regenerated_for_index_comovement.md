# ADR 0014: Fund monthly_nav regenerated for index co-movement (Option A; funds-only; supersedes ADR-0007 NAV preservation for funds)

## Context

The risk-reward pre-recompute sample (Step 3 sub-checkpoint) proved that recomputing fund benchmark-relative metrics (`beta_3y`, `r_squared_3y`, `tracking_error_3y`, `information_ratio_3y`) against the canonical 16 synthesised indices produces meaningless numbers: a Sensex ETF versus the synthesised Sensex TRI returned R-squared of about 0.01 even with correct calendar alignment. Root cause: stock `monthly_prices` and the canonical `indices` were synthesised together sharing market factors (ADR-0008, ADR-0009), so stock benchmark-relative stats are sane, but fund `monthly_nav` is source historical data preserved by ADR-0007 with no engineered relationship to the synthesised indices. Choosing the right benchmark (Step 3 Rulings A to D) is moot if computing against any synthesised index yields noise.

The product owner ruled to fix this end-to-end inside risk-reward: regenerate fund `monthly_nav` so it co-moves with the synthesised canonical indices, the same way stock prices already do. ADR-0007 deliberately preserved source `monthly_nav`; that posture rested on a methodology assumption (source NAV is comparable to synthesised indices) the data architecture does not support. This ADR supersedes that posture for the funds-only scope.

Two calibration options were surfaced at the Step 3a sample sub-checkpoint, because ADR-0012 computes `beta_3y`/`r_squared_3y` over the full fund-versus-index overlap (about 83 months) while `vol_3y`/`sharpe_3y`/`sortino_3y` use the trailing 36 months, so a single factor model cannot pin a full-overlap beta and the 36-month vol and the 36-month return all exactly. The owner chose **Option A**: preserve `vol_3y` and `sharpe_3y` as hard constraints, treat R-squared as a category-band secondary target, and let beta be a calibrated output.

## Decision

For every fund that resolves to a canonical-16 benchmark under the Step 3 rulings (category-clean, source-string, defensible-default, or tracked-index; not the Type-1 `benchmark_structurally_inapplicable`, Type-2 `benchmark_not_in_snapshot`, or `data_window_insufficient` funds), the index-overlap portion of `mf_funds[].monthly_nav` is regenerated as a single-factor series on the resolved benchmark `B`:

```
r_F[t] = alpha + beta * r_B[t] + e[t]
```

with `r_F`, `r_B` monthly log returns. The construction is exact, not iterative (the chosen calibration method, see below):

1. Let `w` be the trailing-36 calibration window. After the Bug 2 fix (the regenerated series ends at the last calendar-aligned month, no synthetic flat-carry month) `w` equals the tier_b 3y window exactly.
2. Targets from the existing tier_b: `target_var` from `vol_3y_annualized`; `target_mean` from the return implied by `sharpe_3y` at the documented 5.25% RF (ADR-0012); R-squared from a per-category target (passive and source-string about 0.985; active equity 0.80; aggressive hybrid 0.65; debt 0.55).
3. `beta = sqrt(R2 * target_var / var_B)` measured on `w`; residual target sd `= sqrt((1 - R2) * target_var)`.
4. Draw seeded unit noise (seed derived from `amfi_code`; fully deterministic). Regress it on `r_B` over `w` and subtract the OLS component so the residual is exactly orthogonal to `r_B` on `w`; then demean and rescale the residual on `w` to the exact residual sd. Apply the same affine map over the whole overlap so the single-factor process is consistent on the full window the calendar-aligned recompute reads.
5. `alpha = target_mean - beta * mean_B`.

On `w` this yields, exactly: `mean(r_F) = target_mean` and `var(r_F) = beta^2 var_B + var(e) = R2*target_var + (1-R2)*target_var = target_var`. So `vol_3y` and `sharpe_3y` are byte-identical pre to post, R-squared equals the category target, and beta is a calibrated output. Validation across the 10-fund sample: all 857 regenerated funds in t0 converge first pass with vol_3y and sharpe_3y preserved exactly.

**Chosen calibration method (residualize-and-standardize, not iteration).** An earlier draft used an iterate-until-converged loop (build, measure, rescale, repeat). The residualize-against-index plus standardize-on-the-calibration-window construction is superior and is the method shipped: realized mean and variance are exact by construction in a single pass, so there is no convergence loop and no convergence fragility on edge funds (low-vol debt, short-history). Exact preservation, not approximate.

Scope is strictly fund `monthly_nav`. Stock `monthly_prices`, the canonical `indices`, `fx`, and `rolling_metrics` are untouched. The regeneration holds across all nine snapshots t0..t8, respecting the ADR-0007 freeze-fix posture: the series extends to each snapshot's last calendar-aligned month, and the forward months use the same single-factor co-movement against the forward-extended index.

### Beta interpretation (read this before treating an elevated beta as a bug)

Beta values for equity funds in the regenerated NAV run elevated relative to typical real-world expectations because the synthesised canonical indices use a tighter volatility envelope than real historical index data would show. Given Option A's preservation of each fund's own `vol_3y`, and given the algebraic identity `beta = sqrt(R-squared) * (vol_fund / vol_index)`, beta floats upward to maintain variance consistency. The qualitative signal (R-squared-controlled co-movement) is the load-bearing piece; absolute beta values in dev-phase data are not directly interpretable in real-world terms. Production data with real historical index volatility would yield beta values in conventional ranges.

### Sortino limitation (accepted)

Sortino ratios for ultra-low-vol fund categories (Liquid, Overnight, Arbitrage) are numerically unstable by definition; downside deviation approaches zero, making the ratio sensitive to small differences in the downside distribution. Pre-regeneration and post-regeneration Sortino values for these categories may differ materially without representing any real change in fund quality. The diagnostic vocabulary does not lean on intra-low-vol-category Sortino comparisons; the limitation is accepted and tracked as `PRODUCT_DEBT_LOG.md` P16.

### Regime-narrative consequence

Hand-placed regime beats in fund `monthly_nav` are replaced by index-anchored beats that propagate to funds via calibrated co-movement. The narrative is preserved with a single source of truth (the index). Regime probes assert at the index (the source) and at the funds (the propagation destination). This pattern applies forward: future regime beats place at the index; fund response derives by construction.

Concretely, `scripts/_verify-snapshot-enrichment.ts` Probe 4 (the rate-cut beat) was refactored mid-workstream: it previously asserted +4.5% Nov->Dec 2026 directly in gilt-fund `monthly_nav`; it now asserts the +4.5% beat at the gilt index (`crisil_dynamic_gilt`, `nifty_10y_gsec`, the post-ADR-0014 source of truth) and asserts the beta-scaled propagation at the funds (median +1.5% to +2.5%, at least 80% positive). This is an architectural improvement (single source of truth), not a degraded test. Probes 1, 2, 3, 5 (stock `monthly_prices`) are unaffected because Step 3a does not touch stock prices.

## Alternatives Considered

- **Option B (beta and R-squared are the hard target; relax Sharpe).** Rejected by the owner: it overwrites the canonical `sharpe_3y`/`vol_3y` values the rest of the system already consumes (A2 calibration, the M0.PortfolioRiskAnalytics rubric, case fixtures, regime-validation tests), enlarging blast radius for no load-bearing gain.
- **Option C (per-fund joint solve over the (beta, sigma, alpha) triple with tolerance optimisation and a flag-and-rule path for infeasible funds).** The methodologically richer "preserve canonical stats AND pin benchmark-relative metrics" approach. Deferred for shipping efficiency and tracked as `PRODUCT_DEBT_LOG.md` P15; future pickup is the model-portfolio workstream (if its corridors require tightly-pinned beta) or a dedicated calibration-refinement workstream.
- **Sentinel all fund benchmark-relative metrics; ship self-computed Sharpe/vol only.** Honest but materially weakens the diagnostic for fund-heavy archetypes (risk-reward's load-bearing claim). Rejected by the owner.
- **Reopen the snapshot-enrichment workstream to regenerate fund NAV there.** Loses context across a handoff and sets the wrong precedent; the owner chose to empower the downstream workstream to fix the upstream data problem it found. Rejected.

## Consequences

**Positive:** fund `beta_3y`/`r_squared_3y`/`tracking_error_3y`/`information_ratio_3y` become meaningful after the ADR-0015 recompute (a Sensex ETF reads R-squared about 0.99; an active equity fund reads a high but consistent R-squared). `vol_3y` and `sharpe_3y` are preserved byte-identically, so S1 narrative, A2 classification, the M0.PortfolioRiskAnalytics rubric, and every other consumer of the snapshot's canonical numbers are unaffected. Deterministic and replayable (per-`amfi_code` seed); re-running produces byte-identical output.

**Negative:** source-history fidelity for funds is intentionally traded away (a query for a fund's real 2020 NAV path now returns a synthesised path, as pre-t0 stock prices already are under ADR-0007). Accepted for a dev-phase artifact: production replaces the regeneration with real fund NAV and real index data, and the `benchmark_resolution` mapping persists as the configurable artifact the model-portfolio workstream can override. `sortino_3y`/`max_drawdown_3y` are not hard-pinned (Option A pins vol and Sharpe only); they stay close for normal-vol funds and are documented-unstable for ultra-low-vol categories (P16). Beta runs elevated for equity in dev-phase data (see the beta-interpretation note; not a bug).

**Supersession:** supersedes ADR-0007's source-NAV-preservation posture for funds only. ADR-0007 remains in force for everything else (quarterly-to-monthly calibration, the freeze fix, stock and FX synthesis). The recompute methodology is ADR-0015 (calendar-aligned, a deliberate refinement of ADR-0012's tail-align for the funds data shape).
