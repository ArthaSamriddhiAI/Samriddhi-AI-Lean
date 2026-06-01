# Do the cases need t1-t8, and must time-stepping precede the re-fire?

**Date:** 2026-06-02
**Branch:** `features/client-weighted-benchmark` (code repo). Read-only dependency-and-sequencing audit; no agent run, no re-fire, no data or code change, no spend. WA2/WA21 (grounded against code, read sites quoted), WA22 (versioned `docs/audits/` deliverable), WA12 (this sequences the only spend), WA16, WA28 (the sequencing call is the primary's), WA27, WA7. First-move: new dated `docs/audits/` file.

---

## Bottom line

**Time-stepping t1-t8 from real t0 is POST-LANDING CLEANUP, not a prerequisite for the re-fire.** The five cases run at t0 and read only t0; the single cross-snapshot surface (the time-series-performance agent) is an unimplemented skeleton that ships data only and is never rendered, and at t0 it has no prior to read. So the cases both RUN and SHINE on real t0 alone. The re-fire can proceed against real t0 once t0 is landed; t1-t8 re-derivation is a separate required-for-consistency thread that becomes a hard prerequisite only when the time-series capability (T-5.06-impl) is actually implemented and rendered.

One adjacent prerequisite that IS on the re-fire path, distinct from t1-t8, is flagged at the end: the loader still points `t0_q2_2026` at the synthetic file, so real t0 must be promoted before the re-fire reads real data.

---

## 1. Mechanical: case generation reads only t0

**The five cases are all seeded at t0.** Each case fixture carries `"snapshotId": "t0_q2_2026"` (e.g. `db/fixtures/cases/c-2026-05-21-surana-01.json`), and the seed threads it through verbatim (`db/seed.ts:472`, `snapshotId: fixture.snapshotId`; the snapshot registry at `db/seed.ts:54-58` maps `t0_q2_2026` to `fixtures/snapshots/enriched/snapshot_t0_q2_2026.json`). The re-fire re-runs these same five cases, so every case is a t0 case.

**The pipeline loads a single snapshot for everything except one block.** `lib/agents/pipeline.ts:119` does `const snapshot = await loadSnapshot(opts.snapshotId)`, and that one object is threaded to `computeMetrics` (`:127`), `runRiskRewardDeterministic` (`:144`), `runPortfolioOverlapDeterministic` (`:162`), and all the scope builders and agents. The deterministic risk-reward stats the primary just validated at the betas gate are computed here, from the 84 monthly points embedded inside t0, single-snapshot.

**The only two-snapshot read is the time-series-performance block, and at t0 it loads no second snapshot.** `loadSnapshotPair` is used in exactly one place, `lib/agents/pipeline.ts:196`, inside the time-series block (`:174-207`). That block first resolves the prior id:

```
const refId = priorSnapshotId(opts.snapshotId);     // pipeline.ts:186
...
if (refId) { const pair = await loadSnapshotPair(...); ... }   // :195-197
else       { ... runTimeSeriesPerformanceDeterministic(snapshot, null, ...) }   // :198-199
```

and `priorSnapshotId` returns null at t0 (`pipeline.ts:85-89`: the regex parses `t(\d+)_q...`, then `if (n <= 0) return null`). So for `t0_q2_2026`, `refId` is null, the `else` branch runs with a null reference, and **no successor or predecessor snapshot is loaded**. `loadSnapshotPair` is never reached at t0.

**No other agent is multi-snapshot.** `loadSnapshotPair` (defined `lib/agents/snapshot-loader.ts:236`, comment at `:235`: "every other agent stays single-snapshot") has exactly one caller, `pipeline.ts:196`. A repo search finds no read of t1-t8 by any agent, deterministic block, or the `app/api/cases` route (which is single-snapshot: `app/api/cases/route.ts:74`, `prisma.snapshot.findUnique({ where: { id: snapshotId } })`).

**Mechanical verdict: at t0, case generation reads only t0. There is no read of t1-t8.**

## 2. Capability: the cases SHINE on t0 alone (the evolution dimension is unbuilt)

The only case content that is meaningful across t0..t8 (trend, trajectory, quarter-over-quarter change, "how risk shifted") is the time-series-performance dimension (ADR-0028, T-5.06). It is not yet a product surface:

- **It is a skeleton.** `lib/agents/time-series-performance.ts:124`: "Layer 1 helpers (deterministic). Bodies are TODO T-5.06-impl stubs." The pipeline wraps the call in try/catch precisely because of this (`pipeline.ts:179-182`: "the agent's Layer-1 helpers are TODO T-5.06-impl, so the call is try/caught to degrade to a null block ... until the implementation lands").
- **At t0 it emits an honest empty sentinel.** With a null reference it returns `{ available: false, sentinel: "no_prior_snapshot_available", ..., per_instrument: [], per_sleeve: [] }` (`time-series-performance.ts:580`; pipeline comment `:177-178`: "at t0 there is no prior, so the agent runs with a null reference and emits no_prior_snapshot_available").
- **It ships data only and is never rendered (WA9).** `pipeline.ts:182`: "Ships data only (content.time_series_performance); the renderer never reads it."
- **The one consumer, s1, is told to be honest about it.** The s1 prompt references the block (`lib/agents/s1-diagnostic.ts:168-169`: "the time_series_performance block (return evidence: trailing-window and benchmark-relative returns plus cross-snapshot evolution; cite snapshot IDs, never invent figures, surface sentinels honestly)"). At t0 the cross-snapshot part is the `no_prior_snapshot_available` sentinel, so s1 surfaces "no prior" honestly rather than inventing evolution.

The return and benchmark evidence the cases DO surface (trailing 1y/3y/5y returns, betas, drawdowns, rolling metrics) comes from the single-snapshot risk-reward block computed off t0's embedded 84-month series, which is now real. Those are the numbers validated at the betas gate.

**Capability verdict: Samriddhi 2 both runs and shines on real t0 alone today. The evolution-over-time dimension is scaffolded but unimplemented and unrendered, so t0-alone is not a hollow product; it is the current product. The time-series shine is a future capability, not part of the re-fire.**

## 3. Format: real t0 has evolved past the existing t1-t8, but only the skeleton would care

Real t0 carries new fields the prior format lacks. Grounded:

| snapshot | `debt_yield_primitives` | `snapshot_metadata.real_data_build` | `crisil_short_term_bond._meta` |
|---|---|---|---|
| `snapshot_t0_q2_2026.json` (synthetic) | absent | absent | none |
| `snapshot_t0_q2_2026_realv1.json` (real) | present | present | FIMMDA AAA 2Y to par-bond TR |
| `snapshot_t1_q3_2026.json` (synthetic successor) | absent | absent | none |

So the existing t1-t8 (`db/seed.ts:62-122`, the nine-snapshot registry) are in the OLD format AND carry synthetic data; a regenerated t1-t8 would have to be produced in real t0's CURRENT enriched format (the new yield primitives, the superseded debt keys with `_meta` provenance, the uniformly recomputed tier_b). But the only thing that consumes t1-t8 is the time-series skeleton, which at t0 reads neither, so the format gap forces no case rework now. It becomes real work exactly when t1-t8 are re-derived for the time-series capability.

**Format verdict: there is a real format gap, but it does not bite the cases at t0; it is work that belongs with the t1-t8 re-derivation, not ahead of the re-fire.**

---

## Decisive sequencing recommendation

**Time-stepping t1-t8 is NOT a prerequisite for the re-fire; it is post-landing cleanup.** All three tests point the same way: the cases do not consume the series mechanically (they read only t0), the product does not need the series to shine (the evolution dimension is an unimplemented, unrendered skeleton), and the format gap does not force case rework (its only consumer is that skeleton). The single-re-fire discipline is satisfied by firing once against real t0; a later t1-t8 re-derivation does not stale the t0 cases, because the t0 cases never read t1-t8.

**The one condition.** This holds because the time-series capability is unimplemented and unrendered. If T-5.06-impl (the deterministic time-series bodies plus a render surface) were to land BEFORE the re-fire, the cases would then surface cross-snapshot evolution, and real t1-t8 would become a hard prerequisite (firing against real-t0-plus-synthetic-successors would build evolution prose on synthetic deltas, the exact double-spend trap). Since the re-fire is the immediate next step and T-5.06-impl is a separate later thread, keep them ordered that way: re-fire first on t0, implement-and-render the time-series later on a real t0..t8.

**Resequenced critical path (recommended):**
1. Land real t0 (promote `snapshot_t0_q2_2026_realv1.json` to the `t0_q2_2026` load path; see the prerequisite below). [deterministic, $0]
2. The single WA12 re-fire of the five t0 cases against real t0. [the only spend]
3. Then, as cleanup for series consistency and as the prerequisite for the time-series capability: time-step t1-t8 deterministically from real t0 (evolve the carried-forward yields, re-derive the TR levels and the rest in real t0's current enriched format, as the same new data version), validate, and regenerate the successor registry. [deterministic, $0]
4. T-5.06-impl (implement the time-series bodies and its render) lands on the real t0..t8, not before. [later thread]

## Adjacent prerequisite that IS on the re-fire path (distinct from t1-t8)

The re-fire loads via the seed registry, which still points `t0_q2_2026` at the synthetic file: `db/seed.ts:58`, `filePath: "fixtures/snapshots/enriched/snapshot_t0_q2_2026.json"`. Real t0 currently lives at `snapshot_t0_q2_2026_realv1.json`. So before the re-fire reads real data, real t0 must be promoted into the load path (rename to the canonical filename, or repoint the registry/loader). That is the "land real t0" step the betas gate precedes; it is a prerequisite for the re-fire, but it is a t0 landing step, not a t1-t8 dependency, and it does not change this audit's conclusion.

---

This audits and recommends; it builds nothing, runs nothing, and spends nothing. The sequencing call is the primary's.
