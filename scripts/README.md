# scripts/

Operational and verification scripts, run via `npx tsx scripts/<name>.ts`. There is no unified runner yet (tracked in PRODUCT_DEBT_LOG T5); invoke individually.

One data-infrastructure script is Python: `enrich_snapshots.py` (snapshot data enrichment; Python 3 stdlib only, no deps), run via `python3 scripts/enrich_snapshots.py` with an explicit `--sector-map scripts/sector_map.json`. It reads `scripts/sector_map.json` (Nifty 500 sector classifications, a data file, not a script).

## Prefix legend

- `_verify-*` : deterministic verification (no API spend; assert and exit non-zero on failure). The going-forward convention for new deterministic tests.
- `_print-*` : read-only data-review printouts (no LLM, no DB writes).
- `_test-*` : older one-off / throwaway verification, being retired in favour of `_verify-*`.
- `backfill-*`, `regenerate-*` : data-mutation utilities (additive backfill / targeted regeneration).
- `generate-*` : case and fixture generators (these cost real API spend).
- `gate-*` : review-gate sample runners.
- `export-*`, `copy-*`, `render-*` : single-purpose I/O utilities.

## Scripts

| Script | Purpose |
|---|---|
| `_verify-a2-classification.ts` | A2 Layer 1 determinism: 11 tests (skill Worked Example, boundary-exact ADR 0005 cases, cash carve-out ADR 0006, instrument-match regression guard, long-dash sanitiser). No API. |
| `_verify-materiality.ts` | Materiality threshold evaluator (Sharma fires; clean small-ticket proposal does not). |
| `_verify-indian-context.ts` | M0.IndianContext: the six YAML stores load and ground G2 plus header rendering. |
| `_verify-governance-regrounding.ts` | Re-runs G1/G2/G3 across the case fixtures; asserts verdicts stable post-M0. |
| `_verify-ic1-sentinel.ts` | IC1 sentinel cascade under STUB_MODE (roles collapse to infrastructure_ready, zero API). |
| `_verify-sharma-seed.ts` | Sharma case row present and fully populated after `npm run db:seed`. |
| `_verify-stub-replay-sharma.ts` | STUB_MODE replay integrity for the Sharma IC1 stubs. |
| `_verify-snapshot-enrichment.ts` | Snapshot Data Enrichment design-doc probes (SNAPSHOT_TEST_AXIS_DESIGN.md regression contract): RIL quarterly CMP + calibration anchor, RIL/HDFC narrative beats, gilt rate-cut, smallcap rally. Reads `fixtures/snapshots/enriched/`. No API. |
| `_print-a2-classifications.ts` | Read-only printout of `content.a2_classification` across all S2 fixtures (Step 5 data-review surface). |
| `_test-ic1-supersession.ts` | Throwaway: injects materiality plus a partially-populated IC1 into the Sharma case to visually verify counterfactual supersession; revert via `npm run db:seed`. |
| `backfill-a2.ts` | Additive A2 backfill into S2 fixtures (dry-run and write modes); injects `content.a2_classification` only, no pipeline regen. |
| `generate-s2-batch.ts` | Generates the five-case S2 diagnostic batch (Malhotra, Iyengar, Menon, Surana, Sharma-S2) and exports fixtures. API spend. |
| `generate-sharma-fixture.ts` | Generates the canonical Sharma S1 (proposed_action) case fixture. API spend. |
| `generate-sharma-ic1.ts` | Generates the Sharma IC1 deliberation (five sub-agents) and records stubs. API spend. |
| `regenerate-sharma-ic1-grounded.ts` | Regenerates Sharma IC1 grounded in M0.IndianContext (post-M0 stub re-record). API spend. |
| `gate-1-shailesh.ts` | Runs the Shailesh (Bhatt) S2 pipeline; the Slice 2 Gate 1 case-content sample. API spend. |
| `export-case-fixture.ts` | Exports a Case row from the DB to `db/fixtures/cases/<id>.json` (human-readable nested JSON). |
| `copy-fixtures.ts` | Copies the large snapshot fixtures locally per the Slice 2 fixture pattern. |
| `enrich_snapshots.py` | Python 3 (stdlib only). Snapshot Data Enrichment engine: adds monthly_prices/indices/fx/tier_b_stats, extends monthly_nav (freeze fix), recomputes period scalars + rolling_metrics at t1..t8. Deterministic, no API. Run: `python3 scripts/enrich_snapshots.py --mode sequence --input-dir fixtures/snapshots/ --output-dir fixtures/snapshots/enriched/ --sector-map scripts/sector_map.json`. See docs/SnapshotEnrichment_Thesis.md + docs/decisions/0007-0012. |
| `render-briefing-pdf.ts` | Renders the S2 briefing PDF via the React-PDF path. |
