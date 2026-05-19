# ADR 0013: Risk-Reward loader consolidation (enriched snapshots become canonical)

## Context

The Snapshot Data Enrichment workstream (PR #4, merged to main 2026-05-19; ADR-0007 through ADR-0012 by filename) wrote an enriched snapshot suite to `fixtures/snapshots/enriched/`, carrying `tier_b_stats` per instrument, `monthly_prices` per stock, the 16 canonical `indices`, the `fx` block, and `snapshot_metadata` enrichment provenance. The runtime loader at `lib/agents/snapshot-loader.ts` resolved `SNAPSHOTS_DIR` to the pre-enrichment source directory `fixtures/snapshots/`. Every case pipeline reaches snapshots only through `loadSnapshot`, so none of the enriched fields were reachable at runtime; the enriched suite was consumed only by `scripts/_verify-snapshot-enrichment.ts`, which reads the directory directly and bypasses the loader.

Risk-reward statistics consumes `tier_b_stats` for per-instrument metrics and the enriched return series for sleeve and portfolio aggregation. Consolidating the loader onto the enriched suite is therefore the precondition for the entire workstream: without it, the data the capability is built on is invisible to the pipeline.

## Decision

`SNAPSHOTS_DIR` in `lib/agents/snapshot-loader.ts` is repointed from `fixtures/snapshots/` to `fixtures/snapshots/enriched/`. This is a one-line constant change. Enriched filenames are identical to source filenames (`snapshot_t0_q2_2026.json` and the rest of the t0..t8 suite), so the `loadSnapshot` path construction is unchanged and no call sites move.

The `Snapshot`, `MutualFundRow`, and `SnapshotMetadata` types in the same file are extended with the enriched fields as optional members (`tier_b_stats`, `monthly_prices` via the new `Nifty500Company` type, `indices`, `fx`, and the `snapshot_metadata` enrichment provenance), plus a `TierBStats` type that documents the ADR-0012 metric set. All additions are optional and the `[key: string]: unknown` index signatures are retained, so the change is additive and backward-compatible: pre-enrichment shapes still type-check and existing field reads are untouched.

The pre-enrichment source directory `fixtures/snapshots/` is retained as a rollback path until the risk-reward data review (workstream Step 6) confirms the consolidation is sound. It is deleted before the workstream PR opens; the metadata-only path strings in `db/seed.ts` are cosmetically updated at that point. Source deletion is deliberately the last work before PR, not part of this decision.

The consolidation is guarded by two deterministic, no-API-spend verify scripts: `scripts/_verify-loader-enriched.ts` (asserts enriched fields are reachable through `loadSnapshot` and that pre-enrichment fields still read) and the pre-existing `scripts/_verify-snapshot-enrichment.ts` (the regime-narrative regression contract). Both pass, and `tsc --noEmit` is clean across all loader consumers.

## Alternatives Considered

- **Replace the source files in place with the enriched files and keep `SNAPSHOTS_DIR` pointed at `fixtures/snapshots/`.** Rejected: it destroys the pre-enrichment artifact immediately, removing the rollback path during the highest-risk window, and it conflates two distinct provenance states (source versus enriched) in one directory with no way to tell them apart.
- **Keep source canonical and add a second enriched-aware loader.** Rejected: two loader code paths invite sync drift and force every consumer to choose a path; the enrichment architecture (ADR-0007 zero-tolerance) already guarantees enriched is a strict superset of source for pre-existing fields, so a parallel path buys nothing.
- **Symlink `fixtures/snapshots/` to `enriched/`.** Rejected: symlinks are fragile across the contributors' platforms, opaque in git history, and would obscure the very rollback path this decision preserves.

## Consequences

The enriched suite is canonical at runtime; every case pipeline now reads `tier_b_stats` and the enriched series without code changes beyond the loader. Backward compatibility holds because enriched t0 is a byte-superset of source t0 for pre-existing fields (ADR-0007 zero-tolerance principle), confirmed by the loader verify script's backward-compat assertions. The source directory remains on disk as a rollback path for the duration of the workstream; its deletion and the `db/seed.ts` cosmetic path update are sequenced to Step 6 after data review, and are recorded in a later ADR when executed. To revisit (for example, to reintroduce a source-versus-enriched switch), this ADR must be superseded; the loader verify script's reachability assertions are the intended trip-wire that would fail if the loader were silently repointed away from the enriched suite.
