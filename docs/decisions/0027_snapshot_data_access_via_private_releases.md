# ADR-0027: Snapshot data access via private-repo releases-as-assets

## Status
Accepted

## Context
The Samriddhi AI pipeline operates on enriched market snapshots (per-stock fundamentals from Nifty 500, fund-level data from ~1,773 MFs, PMS and AIF metadata, macro indicators) and on `scripts/sector_map.json` (Nifty 500 sector classification). This data is real-world-sourced: licensed from vendors / curated from exchanges without redistribution rights, and proprietary-edge (the curated assembly differentiates the product). Until this ADR, it lived in the public repo's working tree, which violated both concerns. This ADR establishes the access pattern for moving the real-world-sourced data to a private GitHub repository while keeping the pipeline code, the fictional investor fixtures, case fixtures, and stub-response files public.

## Decision
Real-world-sourced data lives in a separate private GitHub repository named `Samriddhi-AI-Data-Snapshots` under the `ArthaSamriddhiAI` organisation. Two asset categories are fetched from it:
- the 9 enriched market snapshots (`fixtures/snapshots/enriched/snapshot_t0..t8.json`)
- `scripts/sector_map.json`

The public repo accesses this data via the GitHub-releases-as-assets pattern:

1. The private repo publishes versioned releases (initial release `v1.0.0-frozen`); each release carries the data files as release assets plus a `manifest.json`.
2. The public repo declares the required data version in a `data-version.txt` file at the repo root.
3. The public repo includes a setup script (`scripts/setup-data.ts`) that uses `gh release download` to fetch the declared version's assets, verifies each against the manifest's SHA256, and places each at its target path (`fixtures/snapshots/enriched/` and `scripts/sector_map.json`).
4. The public repo's `.gitignore` excludes the two data-target paths, so the fetched files cannot accidentally re-enter git.
5. The public repo's existing data loader (`snapshot-loader.ts` and friends) reads from the original paths unchanged. No loader refactor is needed beyond ensuring the loader doesn't assume the data is tracked.

This pattern means: clone the public repo, run the setup script once with `gh` authenticated, the data appears at the path the code expects, the pipeline runs normally.

## Privacy boundary

The boundary the pattern enforces: **real-world-sourced data is private; fictional and creative content is public.**

- **Private (real-world-sourced).** The enriched snapshots and the sector map. These are licensed / curated from vendor and exchange sources without redistribution rights, and the curated assembly is proprietary-edge. They live in the private repo and are fetched on setup.
- **Public (fictional / creative).** The six investor archetypes are fictional characters. Their structured holdings and mandates (`db/fixtures/structured-holdings.ts`, `db/fixtures/structured-mandates.ts`) are invented creative content consistent with the character bibles, not real portfolio data. The Sharma evidence verdicts (`db/fixtures/raw/sharma_marcellus_evidence_verdicts.md`) are hand-authored ground-truth reasoning content. Case fixtures and stub-response files are product output derived from reasoning over the data. None of these carry a licensing or proprietary-edge constraint, so they stay tracked in the public repo.

Future workstreams classify new artifacts by this principle: if an artifact is sourced from the real world (vendor feeds, exchange data, licensed datasets), it is private; if it is invented or hand-authored for the product, it is public.

## Alternatives considered

**Local clone + env-var path.** Authorized collaborators clone both repos separately and set a `SAMRIDDHI_DATA_PATH` env var pointing to where the data repo lives locally. Simpler than releases, but requires loader refactoring to consume the env var. The releases pattern is preferred because it keeps the loader code untouched, provides explicit versioning, and centralises the access pattern in one setup script.

**Git submodule.** The private snapshots repo as a submodule of the public repo. Tightly coupled and ergonomic in the happy path. Rejected because submodules have known operational pain (people forget `--recursive`, submodule pointer drift, awkward behavior when the submodule is private and the user lacks access). The releases pattern produces clearer errors when access is missing ("you need GH access to ArthaSamriddhiAI/Samriddhi-AI-Data-Snapshots").

**Sanitization in place.** Strip sensitive figures from the snapshot data and keep redacted versions in the public repo. Rejected because the figures are load-bearing for the pipeline's reasoning; without real values, the agents have no data to reason over.

## Consequences

**Positive.**
- Real-world-sourced snapshot and sector data are no longer world-readable.
- Access pattern is explicit and audit-able through GitHub's release download logs and private-repo access lists.
- Pipeline code, the fictional investor fixtures, case fixtures, ADRs, debt logs, working agreements, and agent skill files all remain public.
- Versioning is explicit: the public repo declares which data version it requires; reproducibility is preserved across data refreshes.

**Negative.**
- Authorized collaborators need GitHub access to the private repo plus `gh` configured locally. New collaborator setup gains one step.
- Refreshes of the data require a coordinated motion: tag a new release in the private repo, bump the version in the public repo, push the bump. Documented in the refresh-cadence debt (see private repo DM1).
- The data is no longer "right there" in the public clone; collaborators must run setup explicitly.

## References
- The s1-case-generation workstream's audit doc, which surfaced the public-data exposure during Phase A.
- ADR-0024 (scope-builder design) and ADR-0026 (Phase 1.5 enrichment), which establish what data the pipeline reads.
- Private repo's data-access-pattern ADR (`Samriddhi-AI-Data-Snapshots/docs/decisions/0001`), the counterpart to this ADR describing the producer side.
- WA13 (Samriddhi 1 / Samriddhi 2 naming discipline), which is operationally adjacent.

## Related debt
- (Public repo) Cross-reference debt entry P29 pointing to the private repo's debt log.
- (Private repo) DM1 (refresh cadence frozen for lean build), DM2 (assembly methodology not documented in reproducible form).
