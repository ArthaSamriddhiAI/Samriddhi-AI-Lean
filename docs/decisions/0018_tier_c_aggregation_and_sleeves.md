# ADR 0018: Tier C aggregation (synthesised sleeve series) and sleeve definitions

## Context

Per-holding statistics are read-through from `tier_b_stats`. Sleeve-level and portfolio-level statistics are the real case-time computation risk-reward owns. The thesis is explicit that a sleeve Sharpe is not the weighted average of its holdings' Sharpes (statistically wrong); it must be computed on the sleeve's own return series.

## Decision

**Sleeves are the `Holding.assetClass` partition** (Equity, Debt, Alternatives, Cash), reusing the partition `portfolio-risk-analytics.ts` already applies; risk-reward does not redefine sleeves. The Cash sleeve is `not_applicable_for_risk_reward` (savings carries no return series).

**Tier C aggregation** synthesises a market-value-weighted monthly return series from the sleeve's evaluable constituents: each constituent's monthly return series (fund `monthly_nav`, stock `monthly_prices`) is weighted by `valueCr`, renormalised over the evaluable set, and summed over the strict month-intersection; the series compounds from a base level. The full 13-metric Tier B set is then computed fresh on that synthesised series (ADR-0012 formulas, RF 5.25%, calendar-aligned benchmark per ADR-0015; sleeve benchmark is `nifty_500_tri` for Equity, `crisil_composite_bond` for Debt, none for Alternatives). The portfolio record aggregates all non-Cash evaluable holdings the same way against `nifty_500_tri`.

Edge cases: a single-holding evaluable sleeve uses `method: "single_holding_passthrough"` (the holding's own series, no synthesis); a sleeve with no evaluable constituents is sentinelled `no_constituents_evaluable`; a sleeve with some sentinelled holdings is `partial_evaluation: true` and discloses `evaluable_weight_pct` / `sentinelled_weight_pct` so the consumer sees what the statistics cover.

## Alternatives Considered

- **Weighted-average of holding Sharpes.** Rejected: statistically wrong (ignores covariance); the thesis names this an anti-pattern.
- **Equal-weight or AUM-band weighting.** Rejected: market value (`valueCr`) is the investor's actual exposure.
- **Union of months (not intersection) for the weighted return.** Rejected: a month where only some constituents have data would silently re-weight; the strict intersection keeps the weighting honest (the trailing windows that the 3Y/5Y stats read are well inside the common span).

## Consequences

Sleeve and portfolio statistics are covariance-correct and computed on real synthesised series. Partial-evaluation is explicit (the unevaluable share is disclosed, not hidden), which is itself diagnostically load-bearing for complexity-heavy portfolios. Currency is INR at aggregation (Trade-off 7; current S2 fixtures hold no foreign-currency instruments, so conversion is identity today and the seam is built for later). Implemented in `lib/agents/risk-reward-stats.ts` (`synthesiseSeries`, `aggregate`); covered by `_verify-risk-reward.ts` (synthesised-series, single-holding, partial-evaluation, all-sentinelled cases).
