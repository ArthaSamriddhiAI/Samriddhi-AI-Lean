# ADR 0016: Snapshot source-directory consolidation complete (enriched is the sole canonical dir)

## Context

ADR-0013 repointed the runtime loader from `fixtures/snapshots/` to `fixtures/snapshots/enriched/` and deliberately retained the pre-enrichment source directory as a rollback path "until the risk-reward data review (Step 6) confirms the consolidation is sound." That data review has now passed: the regenerated `monthly_nav` (ADR-0014), the recomputed fund Tier B (ADR-0015), and the backfilled S2 fixtures were reviewed and approved, with the deterministic verify scripts green throughout.

A finding surfaced while executing the deletion: the source snapshots (`fixtures/snapshots/snapshot_t0..t8.json`) are **gitignored local-only files**, populated by `scripts/copy-fixtures.ts`, and were never committed. `.gitignore` re-includes only `fixtures/snapshots/enriched/` (lines: `!/fixtures/snapshots/`, `/fixtures/snapshots/*`, `!/fixtures/snapshots/enriched/`). So in git, the enriched suite has been the sole tracked snapshot directory since the enrichment merge (PR #4); the source files existed only as local working copies.

## Decision

The consolidation is finalized. The local source copies are removed from disk (the rollback path is retired now that the enriched suite passed data review). No git deletion is involved, because the source files were never tracked; `fixtures/snapshots/enriched/` was already the only snapshot directory in version control.

The dead metadata `filePath` strings in `db/seed.ts` (recorded on the `Snapshot` rows but never read by `loadSnapshot`, which constructs its own path from `SNAPSHOTS_DIR`) are cosmetically updated from `fixtures/snapshots/snapshot_*.json` to `fixtures/snapshots/enriched/snapshot_*.json` so the recorded metadata matches the canonical location. The seed comment is updated likewise.

## Alternatives Considered

- **Leave the local source copies in place.** Harmless (gitignored, regenerable by `copy-fixtures.ts`), but the data review confirmed the enriched suite is canonical and the rollback is no longer wanted; keeping stale source copies invites a future reader to load the wrong, pre-enrichment data by hand. Rejected.
- **`git rm` the source files.** Not possible: they are not tracked. The meaningful consolidation (loader repoint, enriched committed) was already in git via ADR-0013 and PR #4.
- **Leave the `db/seed.ts` paths pointing at the old source location.** Rejected: the strings are dead metadata, but a legibility-first codebase should not record a path that no longer exists; the cosmetic update keeps the recorded metadata honest.

## Consequences

`fixtures/snapshots/enriched/` is now the sole snapshot directory both in git (always was) and on disk. `loadSnapshot` reads it (ADR-0013); the verify scripts read it; `db/seed.ts` metadata references it. `scripts/copy-fixtures.ts` still names the source path as its ingestion target; it is not run in normal operation, and a future production ingestion pipeline (tracked as `PRODUCT_DEBT_LOG.md` DD1) would supersede it. No runtime behaviour changes (the loader was already on enriched since ADR-0013). This ADR closes the consolidation that ADR-0013 opened.
