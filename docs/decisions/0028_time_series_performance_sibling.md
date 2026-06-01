# ADR 0028: Time-series-performance sibling placement and pair-aware snapshot loader

## Status

Accepted. Implemented and verified 45/45 deterministic (see `docs/verification/T-5.06-verification.md`); the agent and the pair-aware loader are live in the pipeline.

## Context

T-5.06 (time-series-performance) is the return-evolution evidence layer for Samriddhi 2: trailing-window returns, benchmark-relative returns, sleeve and portfolio rollups, and cross-snapshot evolution ("how performance moved since the prior quarter"). It is a sibling to risk-reward-stats (ADR-0021) and to the deterministic feeder `lib/agents/portfolio-risk-analytics.ts` (M0.PortfolioAnalytics), and it ships data only (WA09).

Three findings from the Phase B structural recon shape the decision:

- **`rolling_metrics` is per-fund, per-snapshot, and flat.** Each fund row carries a flat ~12-field `rolling_metrics` object (`rolling_3y_pct_beat_cat`, `alpha_trend_direction`, `upside/downside_capture_3y`, `rolling_ir_current`, ...). It is **not** a t-keyed block inside one snapshot, and **stocks carry no `rolling_metrics` at all**. Cross-snapshot evolution therefore comes from comparing the same field across two snapshot *files*, not from reading a within-file series.
- **No agent today is two-snapshot-aware.** `loadSnapshot(snapshotId)` returns one snapshot by id, and both `runDiagnosticPipeline` (`lib/agents/pipeline.ts`) and `runProposedActionPipeline` (`lib/agents/pipeline-case.ts`) consume exactly one. Cross-snapshot evolution is a genuinely new pipeline shape; without it, time-series can only describe a point in time.
- **`snapshot_metadata.evolved_fields` is an incomplete change manifest.** A t0-vs-t5 spot check showed `tier_b_stats`, `rolling_metrics`, and `monthly_nav` all changing across snapshots while `evolved_fields` listed none of them. Evolution must be derived by diffing actual field values across the pair, never by trusting the manifest.

Benchmark resolution is read-through, not a runtime module: per-instrument `tier_b_stats._meta.benchmark_index_id` plus a lookup into `snapshot.indices[...]`, governed by ADR-0017 (fund benchmark cascade) and ADR-0012 (stock benchmark mapping and Tier B pre-computation). Time-series shares that seam rather than reinventing it. Input assembly mirrors the established scope-builder pattern (ADR-0024, ADR-0026), whose deterministic builders live in `lib/agents/case/scope-builders.ts`, `lib/agents/listed-equity-scope.ts`, and `lib/agents/wrapper-scope.ts`.

## Decision

- **Sibling placement.** Time-series-performance lives as a sibling to M0.PortfolioAnalytics, parallel to risk-reward-stats: a deterministic module (`lib/agents/time-series-performance.ts`) gated by a `timeSeriesPerformance` flag on the router's `ApplicabilityVector`, persisted to a new `content.time_series_performance` key, read by no renderer (WA9). It **fires after risk-reward, before S1**. The live pipeline uses a deterministic templated rollup; the LLM rollup is fixture-only (P23 lineage), not wired into the live pipeline in this workstream.
- **Standard windows computed at agent runtime, symmetric across funds and stocks.** The standard window set (1M / 3M / 6M / 1Y / 3Y / SI) is computed at agent invocation, funds from `monthly_nav`, stocks from `monthly_prices`. This is a justified exception to ADR-0012 (which pre-computes Tier B at snapshot-onboarding time): `tier_b_stats` does not carry trailing-window returns, and extending snapshot enrichment was out of scope for T-5.06.
- **Pair-aware loader.** The snapshot loader gains `loadSnapshotPair(currentId, referenceId)` as a sibling to `loadSnapshot(currentId)`. The pipeline threads the pair to time-series-performance **only**; every other agent stays single-snapshot.
- **MVP evolution scope.** Cross-snapshot evolution compares `t_n` vs `t_{n-1}` only; the reference snapshot in the pair is always the immediately-prior one. Configurable reference points (e.g. "since the bank shock at t5") are deferred (T19).

## Alternatives considered

- **4b, array-aware loader (`loadSnapshots(ids[])`).** Rejected on YAGNI. There is no concrete use case for three-or-more snapshots, and it would change the type signature for every agent that consumes a snapshot.
- **4c, lazy reference loader (time-series receives the primary snapshot plus a resolver function).** Rejected. It adds complexity to time-series for a deferral benefit we do not need.
- **4d, pipeline pre-computes a delta block and threads it as case context.** Rejected. It puts diagnostic logic into the pipeline layer, which is the wrong layer.
- **Snapshot enrichment extension (add a `tier_b_return_stats` block at enrichment time).** Rejected for MVP. Snapshot enrichment was out of scope for T-5.06; agent-runtime computation is performant (tens of ms) and keeps T-5.06 self-contained. A future enrichment-time pre-compute remains open (see the production-deployment considerations below and T18).

## Consequences

- **Easier.** Time-series can make true cross-snapshot statements ("up X% since the prior quarter"). Standard windows are firm-portable: they only require `monthly_nav` / `monthly_prices` in canonical shape. Other agents are unaffected.
- **Harder.** The snapshot loader now has two public functions to maintain. The pipeline has a conditional branch (time-series gets a pair; everything else gets a single snapshot).
- **New surface area.** `loadSnapshotPair`, plus the pair-threading and the `priorSnapshotId` resolution in the pipeline.

## Production deployment considerations

In a production deployment to a real wealth advisory firm, snapshot data sources will be firm-specific. Different custodians produce different field shapes feeding into what will eventually be a "data management layer" that normalizes to Samriddhi's canonical schema. The decision to compute trailing-window returns at agent runtime, rather than at snapshot enrichment, is fortuitously the more firm-portable choice: it only assumes `monthly_nav` and `monthly_prices` are present in canonical shape, not that the firm has pre-computed return statistics in its enrichment pipeline.

This is a deferred-production-decision rather than conventional technical debt. Future deployment work may choose to (a) lift `computeTrailingWindowReturns()` into a firm-specific enrichment pipeline for performance, (b) keep at agent runtime for portability, or (c) support both with a fallback pattern. The choice is a production-deployment decision requiring real-firm context; the architectural awareness lives here.

See T18 (tech debt log) for the technical-debt facing of this concern, and P31 (product debt log) for the product-debt facing (firm-onboarding implications). Cross-reference UX11 (future, UI/UX debt log) for the UX surface deferral, parallel to UX4.

## References

- ADR-0012 (Tier B pre-computed at snapshot-onboarding time; the exception this ADR takes for trailing-window returns).
- ADR-0017 (fund benchmark_resolution cascade; the read-through seam time-series shares).
- ADR-0019 (sentinel taxonomy and the three-way do-not-mix rule; `rolling_metrics` is read independently and never blended with `tier_b_stats` in one statistic).
- ADR-0021 (risk-reward-stats sibling placement; the template this ADR follows).
- ADR-0024 and ADR-0026 (case-mode scope-builder enrichment; the input-assembly pattern time-series mirrors, in `lib/agents/case/scope-builders.ts`, `lib/agents/listed-equity-scope.ts`, `lib/agents/wrapper-scope.ts`).
- ADR-0027 (snapshot data access via private-repo releases; `loadSnapshotPair` loads from the same fetched suite, no new access mechanism).
