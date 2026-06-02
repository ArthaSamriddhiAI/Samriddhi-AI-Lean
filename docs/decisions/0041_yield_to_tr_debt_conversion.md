# ADR 0041: Yield-to-total-return debt conversion and synthetic-debt supersession

## Status

Accepted. Implemented in `scripts/build_real_t0.py` (the conversion and supersession) and `lib/agents/risk-reward-stats.ts` (the `DEBT_CELL_INDEX` blend wiring), as part of the T-5.14 real-data t0 foundation.

## Context

The client-weighted (World A) benchmark blends each evaluable holding's own benchmark, so a held debt fund must resolve to a debt benchmark series. The snapshot consumes benchmarks as total-return (TR) level series in `indices[id].monthly_values` (the risk-reward layer takes log returns of them), and the five debt indices that shipped in the synthetic baseline (`crisil_composite_bond`, `crisil_short_term_bond`, `crisil_dynamic_gilt`, `nifty_10y_gsec`, `crisil_liquid`) were fabricated by ADR-0009's `synthesize_duration_model` (Gaussian drift and vol), not real.

The real-data pull returned the duration and credit debt curves as YIELDS, not TR levels: the FIMMDA BCOP corporate-credit curves (AAA 3M to 10Y, AA, A, PSU, BBB, NBFC) and the G-Sec curve (91-day T-Bill, 1 to 30Y) are annualised yields. The Nifty Fixed Income TR debt indices were requested but came back `#N/A Invalid Security` on the terminal, and the CRISIL Short Term and CRISIL Liquid tickers came back `#N/A` as well. The only real debt TR level that resolved is the Nifty 1D Overnight index (`NIFTY1D`). A yield series cannot drop into a TR-level slot; it must be converted.

(The published `LIX15` "Liquid 15" index resolved but is the wrong instrument for the cash floor: it printed roughly -37% in March 2020, impossible for overnight or liquid paper, so it is an instrument mismatch and is discarded; `NIFTY1D` is the correct overnight cash benchmark and is used.)

## Decision

**Par-bond yield-to-TR conversion.** Each fixed-tenor yield curve is converted to a TR-level series, base 1000 at the window start, by the standard par-bond total-return decomposition:

```
TR_return[t] = carry + price_change
  carry        = y[t-1] / 12                                  (one month accrual at the prior yield)
  price_change = -ModDur(y, T) * dy  +  0.5 * Conv(y, T) * dy^2     (dy = y[t] - y[t-1])
TR_level[t]    = TR_level[t-1] * (1 + TR_return[t])
```

`ModDur` and `Conv` are the modified duration and convexity of a par bond (coupon equals the par yield) at the stated tenor `T`, computed from a closed-form par-bond pricer (a central numerical derivative of price with respect to yield, equivalent to the closed forms). The conversion is applied uniformly across the corporate-credit and gilt grid; the cash floor (`NIFTY1D`) is a real TR level and is not converted.

**Supersede the five synthetic debt indices in place.** Rather than keep a synthetic-plus-real mix, the five ADR-0009 indices are replaced on their existing keys so held debt funds resolve to real data through their stored `benchmark_index_id` with no remapping: `crisil_liquid` becomes the real Nifty 1D Overnight (cash); `crisil_short_term_bond` becomes the converted FIMMDA AAA 2Y (high-grade short); `crisil_composite_bond`, `crisil_dynamic_gilt`, and `nifty_10y_gsec` become the converted FIMMDA AAA 5Y and G-Sec 10Y. No synthetic debt series remain.

**`DEBT_CELL_INDEX` contract.** The blend resolves a held debt fund to a benchmark via `decomposeHeldDebt` (ADR-0037's 2D credit-by-duration classification), then `DEBT_CELL_INDEX[(credit, duration)]` maps the cell to its TR series: `(high_grade, short)` to `crisil_short_term_bond`, `(sovereign, *)` to the `gsec_*_tr` ladder, `(credit_risk, *)` to the converted A/BBB cells, and so on. Cash-like funds (arbitrage, liquid, overnight) are cash-gated: `decomposeHeldDebt` can read an arbitrage fund as `credit_risk` on a spurious signal, so a fund whose authoritative read-through benchmark is the cash floor (`crisil_liquid`) reads through to it rather than taking a credit cell. This keeps per-holding and sleeve resolution consistent.

**Store both the yields and the derived TR.** The source yields are preserved as the carried primitive in `debt_yield_primitives` (they are the reproducible source and the 91-day T-Bill yield also feeds the time-varying risk-free socket), and each superseded index carries `_meta` provenance marking it real-pulled or derived-from-yield with the conversion noted.

## Alternatives considered

- **Option E, re-source the official Nifty / CRISIL TR debt indices** (from niftyindices.com / CRISIL, off the terminal that returned `#N/A`). This is the believability-correct choice: exact official levels, no approximation, no data-debt. It was the prior audit's recommendation. Rejected for this landing because the primary directed the conversion path (Option A) to avoid a re-source, with the gate cells sourced as real-derived (FIMMDA AAA 2Y) and real (Nifty Overnight). Re-sourcing remains open as a future believability upgrade that would retire the approximation below.
- **Keep a synthetic-plus-real mix** (convert only the cells the cases exercise, leave the rest synthetic). Rejected: a mix is internally inconsistent and undermines the real-data foundation; the grid is sourced uniformly.
- **Pull the FIMMDA total-return variant instead of yields.** Not available in the pull; the TR tickers did not resolve, which is why the conversion exists.

## Consequences

- **Beta-faithful, approximate for exact levels (data-debt, WA5/WA8).** The conversion captures co-movement correctly (rates up to price down, the COVID flat-ness of high-grade, credit-spread widening) with the right par-bond duration, so benchmark vol and its correlation with the real fund NAV are well represented and beta lands close to what the official TR index would give. The exact cumulative LEVEL drifts from the official index by a small amount that grows with tenor (second-order accumulation): a few percent over multi-year windows for the longer tenors. For the believability use (beta near 1, the relative read, the honest footnote) this is acceptable; for an advisor auditing the precise level of a long curve it is visibly an approximation. This is the logged data-debt; Option E removes it.
- **Validation.** The converted high-grade and gilt series pass the inverted-COVID gut-check (roughly flat in March 2020, gilt up on the flight to safety), while equity shows the real crash. The two debt cells the five cases exercise (AAA-short, cash) resolve to real-derived and real series respectively.
- **The blend wiring is complete.** `decomposeHeldDebt` plus `DEBT_CELL_INDEX` resolves every held debt fund to a TR series, unit-tested in `scripts/_verify-debt-blend.ts`.

## References

- ADR-0009 (synthetic index synthesis; the five debt indices this supersedes).
- ADR-0037 (debt 2D credit-by-duration; `decomposeHeldDebt`, the cell classifier the blend uses).
- ADR-0020 (synthetic-forward disclosure; the successors t1..t8 remain synthetic-forward pending real re-derivation).
- `docs/audits/2026-06-01_yield_to_tr_conversion_proposal.md` (the conversion method and the Option A vs Option E tradeoff).
- `docs/audits/2026-06-01_fimmda_debt_cell_sizing.md` (the debt cells the universe occupies).
- Data repo `docs/methodology/real_t0_v2_provenance.md` (the data-side provenance pointer to this ADR).
