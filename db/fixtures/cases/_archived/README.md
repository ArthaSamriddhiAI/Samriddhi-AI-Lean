# Archived case fixtures

Case fixtures retained for git history but **excluded from all active processing**. No script, backfill, verify, or run that iterates `db/fixtures/cases/` should touch anything in this `_archived/` subdirectory. Directory iterators in the codebase are non-recursive over the cases directory, so files here are not picked up; this README plus the explicit-case-enumeration requirement in the backfill scripts are the durable guards.

Nothing here is deleted: archiving is a structural move, not a removal. Git history follows the file (`git mv`), so the full provenance is intact.

## Contents

### `c-2026-05-15-sharma-s2-01.json`

Archived 2026-05-29 (T-5.12, A3 So-What Finding 2 workstream).

This was the legacy Sharma-family Samriddhi 2 diagnostic case, a janky artifact from an earlier pass where stubbed content was mixed with real reasoning. It is not a clean Samriddhi 2 investor in the same sense as the five canonical diagnostic personas (bhatt, menon, surana, iyengar, malhotra), and it never carried an `a3_so_what` block.

It is **permanently excluded from all future Samriddhi 2 backfill, run, and verify operations**. It was wrongly swept into the Finding 2 A3 re-backfill by an implicit "all Samriddhi 2 cases in the directory" default (since corrected: `scripts/backfill-a3.ts` now requires explicit `--cases=` enumeration, and this file is archived so even a future glob cannot reach it). See product debt P42.

Do not move this file back into the active `db/fixtures/cases/` directory; doing so reintroduces the failure mode that caused the wasted spend.
