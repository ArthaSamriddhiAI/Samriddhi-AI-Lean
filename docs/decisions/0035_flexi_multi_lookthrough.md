# ADR 0035: Flexi/multi-cap look-through and the diversified-equity option

## Status

Accepted, 2026-05. T-5.12 Finding 1 on `features/a3-so-what`, PR #11. Implemented in `lib/agents/instrument-selection.ts` (`decomposeHeldEquity`, the diversified-equity option in `buildEquityPlan`).

## Context

The equity framework (ADR-0033) allocates on a domestic cap-split. A flexi/multi/focused fund is not a single cap; it holds a blend. An earlier scoping excluded flexi/multi funds from selection, which the primary rejected: a system that cannot recommend Parag Parikh Flexi Cap is not credible. The look-through audit (`docs/audits/2026-05-30_lookthrough_intl_duration.md`) confirmed every equity fund's domestic cap split (`LargeCap/MidCap/SmallCap %`) is present for all 99 flexi/multi/focused funds and for every demo persona holding, and that international exposure inside a fund is not a labelled field, it is the residual after domestic cap and cash.

## Decision

Two complementary treatments, coherent across held funds and add-new candidates:

1. **Held-fund look-through (decompose for accounting).** Each held equity fund is decomposed into domestic large/mid/small (from the snapshot `LargeCap/MidCap/SmallCap %`) plus an international residual (`1 - domestic - cash`, ADR-0036) plus cash. The decomposition feeds the current-exposure side of the equity gap and retains the fund's diversified type-identity in narration (for example "Parag Parikh Flexi Cap, a flexi-cap with ~28% international exposure"). Direct listed equity is treated as domestic large-cap; PMS as domestic equity; pure-cap funds take their category.

2. **Add-new candidate treatment (recognize as identity, do not decompose into the ranking pools).** The cap-bucket ranking pools stay pure-cap-only (`Large Cap Fund` / `Mid Cap Fund` / `Small Cap Fund`), so the lexicographic quality-then-TER comparison stays valid (ranking a blended-TER flexi against a pure-cap fund is apples-to-oranges). Flexi/multi/focused funds are offered as a distinct "diversified equity" candidate with their look-through shown, and are top-up-eligible. They are not exploded into the cap pools.

**Missing-composition fallback (deterministic decline; the LLM inference is DEFERRED).** When a flexi/multi/focused fund lacks an explicit cap split, decline deterministically to "diversified, composition unavailable, advisor-select" rather than guess. The bounded-LLM inference originally contemplated for this case (ADR-0038) is DEFERRED: no flexi/multi/focused fund in the current universe lacks composition (all 99 carry it), and the only composition-missing equity funds are five pure small-caps whose cap is given by category. The decline branch carries an `ADR-0038` breadcrumb at the trigger point so a future investigator finds the deferred design where the condition fires.

## Consequences

- Parag Parikh and peers are recognized when held (decomposed, identity retained, international residual counted) and recommendable when adding (the diversified-equity option), without muddying the cap-bucket rankings.
- The decline path is unreachable for the current universe but exists as the honest deterministic fallback; the two-layer discipline stays pristine (no LLM produces an allocation-feeding number in v1).

## References

- `lib/agents/instrument-selection.ts` (`decomposeHeldEquity`, `buildEquityPlan`).
- ADR-0033 (the cap-split it fills); ADR-0036 (the international residual); ADR-0038 (the deferred inference component); the look-through audit; product debt P46 (the deferral trigger).
