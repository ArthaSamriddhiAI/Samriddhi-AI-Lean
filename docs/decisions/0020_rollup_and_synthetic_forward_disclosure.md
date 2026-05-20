# ADR 0020: Rollup design (templated default + LLM fallback) and synthetic-forward disclosure

## Context

The rollup is the human-readable one-or-two-sentence characterisation the briefing layer consumes. It must be replay-safe for the common case but graceful where templates read awkwardly. Separately, eight of the nine demo snapshots are synthetic forward-projections, and any number computed against them must not be mistaken for a forecast.

## Decision

**Rollup: templated default plus LLM fallback.** The common case uses a deterministic templated rollup (replay-safe, no API). An enumerated set of edge cases routes to a strict LLM fallback (`callAgent` against the `risk_reward_stats` skill), with the generation method (`templated` / `llm_fallback`) and the trigger recorded on the output. The five triggers: all-sentinelled / mostly-unevaluable sleeve, single-holding sleeve, negative-excess-return (IR materially negative), mathematically-valid-but-confusing Sharpe (negative Sharpe), every-sleeve-partial. The first trigger was tightened at Checkpoint 2: it fires only when a sentinelled sleeve exceeds 35% of portfolio weight or portfolio evaluable weight is at most 40%, so an incidental small AIF-only sleeve does not force the LLM path. The LLM is instructed to describe not recommend, cite only the deterministic digest, and use no long dashes (WA7); `stripLongDashes` is applied to its output regardless (the model is not trusted to comply).

**Synthetic-forward disclosure (hard rule).** `is_synthetic_forward` is derived as `snapshot_metadata.evolution_type !== "baseline"` (the audit confirmed no stored flag exists; t0 is the only baseline). When true, a fixed disclosure sentence is appended to the rollup deterministically (on both the templated and LLM paths, so the model cannot omit it), and a pre-persist runtime guard (`assertSyntheticForwardDisclosure`) throws if any t1+ output lacks the disclosure.

## Alternatives Considered

- **LLM-generate every rollup.** Rejected: not replay-safe and unnecessary API spend on the common case.
- **Template every rollup.** Rejected: templates understate the story for the cases where the gap structure or the underperformance is the headline (the LLM version of the Bhatt rollup was materially better, reviewed and approved at Checkpoint 2).
- **Trust the model to add the synthetic-forward caveat.** Rejected: the disclosure is a hard rule; appending it deterministically and guarding at runtime is the guarantee.
- **Add an `is_synthetic_forward` field to the snapshot.** Rejected: out of risk-reward scope (snapshot-data territory) and unnecessary; deriving it from `evolution_type` is sufficient.

## Consequences

Common-case rollups are deterministic and replayable; edge cases get graceful LLM narration with full method disclosure (the audit-replay caveat: LLM-fallback text may drift if the model is updated, made visible by `generation_method`). All 6 S2 demo fixtures trigger the fallback (the seed is deliberately complexity-heavy; audit doc section 11). No t1+ output can bypass the synthetic-forward disclosure. Implemented in `lib/agents/risk-reward-stats.ts` (`templatedRollup`, `detectLlmFallbackTrigger`, `buildRollupPrompt`, `runRiskRewardStats`, `assertSyntheticForwardDisclosure`). Option C (a richer joint-solve calibration that would change beta behaviour) is deferred as `PRODUCT_DEBT_LOG.md` P15.
