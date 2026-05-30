# ADR 0036: International equity as its own sub-sleeve, with residual counting

## Status

Accepted, 2026-05. T-5.12 Finding 1 on `features/a3-so-what`, PR #11. Implemented in `lib/agents/instrument-selection.ts` (the `international` bucket in `buildEquityPlan`, the residual in `decomposeHeldEquity`).

## Context

The equity framework (ADR-0033) carries an explicit international allocation (10/15/20 per cent of the equity sleeve by tier). The look-through audit established that the holdings taxonomy tags overseas exposure (`intl_us_etf`, `intl_us_individual`) but classifies it `assetClass: "Equity"` undifferentiated; that a dedicated international universe exists (66 funds: FoFs Overseas, Global ETFs, Sectoral-Foreign, 26 eligible); and that international exposure inside a domestic fund is not a labelled field, only a residual.

## Decision

**International is its own equity sub-sleeve**, alongside the domestic cap-split rather than inside it (a different geography, not a point on the domestic cap axis). Its candidates come from the dedicated international universe (`FoFs Overseas`, `ETFs- Global`, `Sectoral- Foreign Equity`), ranked by the same funnel (ADR-0034). The universe is mixed broad-and-thematic (Nasdaq-100, US bluechip, but also gold-mining and single-country); the funnel surfaces the eligible best by cost and risk-adjusted consistency, and the advisor chooses.

**Residual counting (the honest, more-complex accounting).** The international target is satisfied by dedicated international holdings AND by the international residual within held domestic funds (for example Parag Parikh's ~28 per cent overseas, inferred as `1 - domestic-cap - cash`). The international gap = target minus (dedicated international holdings + international residuals in held funds), so an investor who already holds a fund like Parag Parikh is not double-allocated international. The residual is inferred (no labelled field exists, confirmed by audit); the inference is "whatever is not domestic-cap and not cash".

## Consequences

- An investor's existing international exposure, whether explicit (a US ETF) or embedded (a flexi fund's overseas sleeve), counts toward the target, so the deploy fills only the true gap (demonstrated: Menon's US-equity holding reduces his international gap; Surana's Parag Parikh residual plus his Vanguard ETF count toward his).
- The inferred residual is imprecise (no labelled field; the kind of international is unknown), which is accepted; the narration states international exposure honestly without over-claiming its composition.

## References

- `lib/agents/instrument-selection.ts` (the international bucket and residual).
- ADR-0033 (the international target); ADR-0035 (the flexi decomposition the residual rides on); the look-through audit Section B.
