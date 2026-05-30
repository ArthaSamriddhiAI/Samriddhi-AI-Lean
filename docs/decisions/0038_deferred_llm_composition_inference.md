# ADR 0038: DEFERRED, bounded LLM inference of a missing fund composition

## Status

**Deferred (designed, not built), 2026-05.** T-5.12 Finding 1 on `features/a3-so-what`, PR #11. No code implements this; the only trace in code is an `ADR-0038` breadcrumb comment at the deterministic-decline branch in `decomposeHeldEquity` (`lib/agents/instrument-selection.ts`). Build only when the trigger condition below fires.

## Context

The flexi/multi look-through (ADR-0035) needs a domestic cap split for each held equity fund. Where the snapshot lacks one, the question was whether to let the LLM infer the split from the fund's name and known style (a bounded, single-purpose use) or to decline deterministically.

This would be the ONE ring-fenced violation of the two-layer discipline (ADR's elsewhere): Layer 2 is voice-only and never produces a number that feeds allocation; here it would produce three percentages that do. The exception was contemplated precisely because a look-through number is a soft estimate, not a hard portfolio fact, and a labelled "estimated" composition might beat a blanket "advisor-select" decline.

**Why it is deferred (the premise did not hold).** The trigger does not occur in the current universe. The look-through audit established that all 99 flexi/multi/focused funds carry an explicit `LargeCap/MidCap/SmallCap %`, and the only equity funds missing a composition are five pure small-caps whose cap is given by category (no inference needed). So the component would have no input to act on; a test for it cannot be constructed from real data, which is itself the evidence that it has no present purpose. Building it now would be speculative complexity on the two-layer discipline's one exception. The primary's ruling: do C (deterministic decline now, this ADR as the deferred design, the breadcrumb in code, the debt entry with the trigger).

## Decision (the design, for when it is needed)

If a future universe contains a flexi/multi/focused fund with NO explicit cap split AND that fund is material to a real recommendation, build a bounded inference component under these five guardrails:

1. **Ring-fenced single purpose.** Infers exactly one thing: the domestic large/mid/small split (three numbers summing to the domestic portion) of a named fund. It touches nothing else and is the only sanctioned place Layer 2 produces an allocation-feeding number.
2. **Labelled and discounted.** The output is always surfaced as an estimate ("estimated composition, not disclosed by the fund"), never as a disclosed fact, and the narration must not present it with the confidence of a snapshot number.
3. **Deterministic floor.** It runs ONLY when the deterministic path has no answer (no explicit split, category does not pin the cap). Where the snapshot or category gives the split, the deterministic value always wins; the LLM is never consulted.
4. **Bounded and validated.** The output is range-checked (each cap 0 to 100, the three plus the international residual and cash sum to 100) and rejected back to the deterministic decline if it fails; the LLM cannot emit an out-of-range or non-summing split into the plan.
5. **Auditable.** The inference, its inputs, and the fact that it ran are logged, so an advisor can see a number was estimated rather than observed.

If, when the trigger fires, the deterministic decline ("diversified, composition unavailable, advisor-select") still reads as adequate, prefer keeping the decline and not building this at all. The exception is a last resort, not a default.

## Consequences

- The two-layer discipline stays pristine in v1: no LLM produces an allocation-feeding number anywhere.
- The design is captured so a future investigator who hits the trigger does not re-derive it under time pressure or build it unbounded.
- The cost of deferral is the deterministic decline's bluntness, which is currently free (the decline branch is unreachable in this universe).

## Trigger condition (when to revisit)

Build this when BOTH hold: (a) a flexi/multi/focused fund with no explicit `LargeCap/MidCap/SmallCap %` enters the universe, and (b) that fund is held by or recommended to a real investor such that the deterministic "advisor-select" decline is materially worse than a labelled estimate. Until both hold, this stays deferred. Recorded as product debt P46.

## References

- `lib/agents/instrument-selection.ts` (`decomposeHeldEquity`, the `ADR-0038` breadcrumb at the decline branch).
- ADR-0035 (the look-through that would consume this); the look-through audit (the coverage finding that makes the trigger absent today); product debt P46 (the deferral and trigger).
