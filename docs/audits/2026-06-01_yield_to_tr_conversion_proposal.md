# Debt curves came back as yields: the reality, and how to get to TR benchmarks

**Date:** 2026-06-01
**Branch:** `features/client-weighted-benchmark` (code repo). Read-only audit-and-proposal; no conversion, no data change, no build, no spend. WA2, WA21, WA22, WA27, WA7, WA28 (the conversion-vs-repull and consistency handling are the primary's calls), WA5/WA8 (an approximation becomes documented debt). First-move: new dated `docs/audits/` file.

---

## 1. Confirmed: every debt benchmark in hand is a yield; no duration/credit TR levels were pulled

Grounded from the three files:

- **The FIMMDA corporate curves are yields** (`06 - Samriddhi_Debt_TopUp_Pull_Data_v0.3.xlsx`, 16 `BCOP...` cells matching the sizing audit: AAA at 1/2/3/5/7/10Y, AA 1/3/5Y, A 2/3Y, PSU 3/5Y, BBB 3Y, NBFC 2/3Y). Sample values are wobbling percentages, not growing levels: `BCOPAAA5` (AAA 5Y) reads 8.3 / 6.8 / 6.22 / 7.62 across 2019-05 / 2020-03 / 2022-01 / 2026-04; `BCOPA3` (A 3Y) reads 10.0 / 8.6 / 8.4 / 9.5, with A above AAA (a credit spread). Monthly, back to 2006.
- **The G-Sec curve is yields** (91-day plus 1/3/5/7/10/15/30yr). `10yr G-Sec` reads 7.03 / 6.14 / 6.68 / 7.01, a yield oscillating around 6 to 7 percent, not a level.
- **The Nifty Fixed Income TR debt indices were NOT pulled.** The v0.2 universe template lists them by name (Nifty Short/Medium/Long Duration Debt, Nifty AAA Corporate Bond, Nifty Corporate Bond, Nifty Banking & PSU, Nifty Credit Risk, Nifty Composite), but every one returns `#N/A Invalid Security`; the tickers did not resolve. The G-Sec TR series in v0.3 are bare `(HUNT: ...)` placeholders, also empty.
- **Cash and equity are fine as pulled.** Nifty Liquid resolves as a real TR level (4054.0, 3994.25, ...); Nifty Overnight likewise; all equity TRIs and the direct stocks are real levels (validated in the prior ingestion dry-run).

So uniformly the duration/credit debt benchmarks are yields, the cash floor and equity are real TR levels, and no TR-level debt curve exists in the pulls.

## 2. The convention the converted series must match (confirmed)

The benchmark consumption is total-return levels: the snapshot's debt indices live in `indices[id].monthly_values` as base-1000 growing levels, and `risk-reward-stats.ts` consumes them via log returns (`benchRelative`, `blendIndexReturns`). So whatever fills a debt cell must be a TR-level series in that same shape. A yield series cannot be dropped in as-is.

## 3. The risk-free side is unaffected (confirmed)

The 91-day and 10yr G-Sec yields feed `seriesRiskFree(annualByMonth, ...)` (Task 3) as annualised rates; that use wants yields and is correct as-pulled. The conversion question is only the benchmark use: the sovereign and corporate-credit cells that `decomposeHeldDebt`'s blend maps to.

## A correction that simplifies the consistency question (WA2)

The kickoff frames the existing 5 debt indices as real TR levels mixing with new derived ones. Grounded against the record: the existing 5 (`crisil_composite_bond` etc.) are **synthetic** (ADR-0009 `synthesize_duration_model`, Gaussian drift/vol), and under Option B they are **superseded** by the real pulls, not kept alongside. So there is no real-TR-versus-derived-TR mix to manage among the debt benchmarks; the choice is purely how to source the new debt-benchmark grid. That makes the consistency question (C) much cleaner.

---

## The proposal (options and tradeoffs; the primary picks)

### E first, because it changes the recommendation: the real TR levels are obtainable off-terminal

The cleanest path is not approximation. The Nifty Fixed Income **total-return** debt indices that came back `#N/A` on the Bloomberg terminal are **published by niftyindices.com directly** (the website, not the terminal ticker that failed), with monthly history and the exact duration-ladder and credit cuts the blend needs (Nifty AAA Corporate Bond TR, Nifty Credit Risk Bond TR, Nifty Composite Debt TR, the duration ladder, and gilt/G-Sec TR). CRISIL publishes its TR debt indices similarly. So **the primary can download the real TR levels from niftyindices.com / CRISIL in a browser**, sidestepping the failed Bloomberg ticker, and get exact levels that match the snapshot convention with no approximation and no debt entry. This is a sourcing step, not a terminal trip, and it is the believability-correct answer for a product whose USP is numbers an advisor trusts on sight.

**The FIMMDA BCOP yields remain useful** only if the blend later wants finer credit granularity (AAA vs AA vs A vs PSU vs NBFC) than the current three-tier classifier (sovereign / high_grade / credit_risk) produces. The three-tier blend does not need them; the Nifty AAA Corporate Bond TR, Nifty Credit Risk Bond TR, and a gilt TR cover the three credit tiers exactly.

### A. The conversion method (the pragmatic fallback, if no more sourcing)

If the primary prefers to convert rather than re-source, the standard yield-to-total-return for a par bond at each tenor T with monthly yield `y[t]`:

```
TR_return[t] = carry + price_change
  carry        = y[t-1] / 12                                  (one month's accrual at the prior yield)
  price_change = -ModDur(y, T) * dy[t]  +  0.5 * Conv(y, T) * dy[t]^2     (dy = y[t] - y[t-1])
TR_level[t]    = TR_level[t-1] * (1 + TR_return[t])            (base 1000 at the window start)
```

with `ModDur` and `Conv` the closed-form modified duration and convexity of a par bond (coupon = par yield) at tenor T. **Assumptions:** par bond at each tenor, a coupon frequency (annual or semi-annual), and the duration/convexity first/second-order approximation rather than a full reprice. **Sensitivity:** the result is most sensitive to `ModDur`, which scales the price-change term; but `ModDur` is not a free parameter, it is determined by `(y, T)`, so a stated-tenor curve gets the right duration. The residual error is second order (convexity, intra-month rate path, the exact coupon structure) and grows with tenor.

### B. Approximation quality

Good for beta, approximate for levels. Beta is about co-movement, and the conversion captures the dominant moves correctly (rates up to price down, the COVID flat-ness of high-grade, the credit-spread widening), with the right par-bond duration, so the benchmark vol and its correlation with the real fund NAV are well represented; beta lands close to what the official TR index would give. The exact cumulative **level** drifts from the official index by a small amount that grows with tenor (second-order accumulation), so a sophisticated advisor cross-checking the precise level of, say, a 10Y curve against the official CRISIL/Nifty TR index would see a few-percent divergence over multi-year windows. For the believability use (beta near 1, the relative read, the honest footnote), that is acceptable; for someone auditing the exact index level, it is visibly an approximation.

### C. Consistency

With the WA2 correction above, the debt grid under Option B is internally consistent either way: the synthetic 5 are superseded, the cash floor (Nifty Liquid/Overnight) stays a real TR level, and the duration/credit cells are sourced uniformly, either all real-downloaded TR (option E) or all yield-derived TR (option A). **Do not keep a mix.** If converting, convert every corporate/gilt cell with the one method and supersede the synthetic 5; if downloading, download the real TR for every corporate/gilt cell. Recommendation: prefer the uniform real download (E); if converting, convert uniformly and log the approximation as a data-debt entry. A cash-versus-short-duration edge (real-level cash bench beside a converted short bench) is benign because those are genuinely different benchmarks.

### D. Scope: only a couple of cells are exercised by the five cases

Via `decomposeHeldDebt`, the evaluable debt holdings across the five cases map to just two cells: Franklin India Corporate Debt (Iyengar) is high_grade x short, and the HDFC Arbitrage holding (Bhatt) is cash. So the five cases need exactly the AAA-short corporate cell (real or converted) plus the cash level (already real). The rest of the grid is universe future-proofing. Converting or downloading all of it is cheap; do the full grid for the universe, but validate against those two cells. Do not let the full 16-cell conversion gate the five-case re-fire.

### F. Storage in t0 (coupled to the method)

- **Keying is the contract.** The stored series ids must equal the values the `DEBT_CELL_INDEX` mapping in `decomposeHeldDebt`'s blend reads (`indices[DEBT_CELL_INDEX[cell]].monthly_values`). Propose a stable convention: corporate cells `<credit>_<tenor>_tr` (e.g. `aaa_3y_tr`, `aa_5y_tr`, `a_2y_tr`, `psu_3y_tr`), gilt `gsec_<tenor>_tr` (e.g. `gsec_10y_tr`), and the cash levels keep the Nifty ids. `DEBT_CELL_INDEX` then maps `(high_grade, short) -> aaa_2y_tr`, `(sovereign, long) -> gsec_10y_tr`, and so on. The ids and the mapping are authored together so the blend resolves cleanly.
- **Raw and derived: store both.** Keep the source yields (they are needed anyway: the 91-day and 10yr feed `seriesRiskFree`, and the yields are the reproducible source if the conversion is ever revised) and store the TR levels the blend consumes. Recommend the yields as the carried primitive and the TR as derived. (Under option E the "source" is the downloaded TR level; still store its provenance.)
- **Provenance in the data.** Mark each derived TR series with `_meta` recording it is computed, not the official index: `_meta: { basis: "total_return_level", derived_from: "yield", source: "FIMMDA BCOP / G-Sec yield", conversion: "par-bond yield-to-TR (ModDur + convexity)", base_value: 1000 }`; real-pulled levels (cash, equity, or option-E downloads) carry `_meta: { basis: "total_return_level", source: "niftyindices.com / Bloomberg" }`. This self-documents which series are real and which are computed, so no future reader asks why a series does not match the official index.
- **t0 and time-stepping.** Store the yields as the carried-forward primitive; the time-stepping evolves the yield curve forward (t1-t8) and re-derives the TR levels from it, so the structure is not a t0-only one-off. Under option E, the time-stepping carries the downloaded TR levels (or re-derives from a carried yield proxy); either way the storage (source plus `_meta`) is forward-carryable.

---

## Recommendation

Prefer **E (download the real Nifty/CRISIL TR debt indices from niftyindices.com)** for the cells the three-tier blend maps to: it gives exact levels, matches the convention, needs no approximation or debt entry, and is the believability-correct choice; the failed terminal ticker is not the only source. Keep the **A (par-bond conversion)** of the FIMMDA BCOP yields as the documented fallback if re-sourcing is unwanted, and as the only path if finer-than-three-tier credit granularity is ever needed. Either way, source the debt grid uniformly, store yields plus derived/real TR with `_meta` provenance, key the ids to the `DEBT_CELL_INDEX` contract, and right-size to the universe while validating against the two cells the five cases actually use. The conversion-vs-download call and the consistency handling are the primary's (WA28); if conversion is chosen, the approximation is a WA5/WA8 data-debt entry.

This audits and proposes; it converts nothing and changes nothing. The build stays parked at the Phase 2 stop.
