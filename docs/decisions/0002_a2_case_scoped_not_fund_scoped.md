# ADR 0002: A2 verdicts are case-scoped, not fund-scoped

## Context

The same instrument (a Marcellus PMS, an HDFC Bank holding) can appear in two different investors' portfolios. A natural-seeming optimisation is to compute a verdict per fund once and reuse it. The product thesis explicitly rejects this: a Marcellus PMS at 8% with a clean thesis is not the same verdict as the same Marcellus PMS at 22% crowding out the model portfolio's quality sleeve. The verdict is about fit in this portfolio for this investor, not about the holding's intrinsic merit. Fit is contextual; merit travels.

## Decision

A2 runs per case. `classifyHoldings` takes that case's holdings, that case's M0 metrics, and that case's evidence bundle, and produces verdicts scoped to that case only. There is no fund-level verdict cache, no cross-case verdict table, and no static firm-published rating for a holding. Each case produces its verdicts fresh against the specific investor's context.

## Alternatives Considered

- **Fund-scoped verdict cache keyed by instrument.** Rejected: it would erase the position-weight, wrapper-aggregate, sector-aggregate, liquidity-tier, and mandate context that makes the verdict meaningful. It would also produce contradictions when the same fund sits at different weights in different portfolios.
- **Hybrid: a fund-level base verdict adjusted per case.** Rejected as false economy: nearly every driver in the rubric is portfolio-relative, so the "base" would carry almost no signal and the adjustment layer would re-implement the per-case logic anyway.

## Consequences

A2 cost scales with cases, not with the universe of funds; this is acceptable (Layer 1 is free, Layer 2 is one call per case). Cross-case aggregation, multi-investor rollups, and a firm-published holding rating are explicitly out of scope and would each require a separate, deliberately designed surface. Any future "why did Marcellus get Discuss here but Maintain there" question is answered by the two cases' driver lists, which is the intended audit behaviour.
