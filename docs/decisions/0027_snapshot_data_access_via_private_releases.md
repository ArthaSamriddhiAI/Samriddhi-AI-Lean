# ADR-0027: Snapshot data access via private-repo releases-as-assets

## Status
Accepted

## Context
The Samriddhi AI pipeline operates on enriched market snapshots (per-stock fundamentals from Nifty 500, fund-level data from ~1,773 MFs, PMS and AIF metadata, macro indicators) and on per-investor curated content (holdings, mandates, character bibles). Until this ADR, all of this data lived in the public repo's working tree. The data is both licensed-sensitive (sourced from vendors / exchanges without redistribution rights) and proprietary-edge (curated assembly that differentiates the product). Public-repo exposure of this data violated both concerns. This ADR establishes the access pattern for moving the data to a private GitHub repository while keeping the pipeline code, case fixtures, and stub-response files public.

## Decision
Snapshot and curated data live in a separate private GitHub repository named `Samriddhi-AI-Data-Snapshots` under the `ArthaSamriddhiAI` organisation. The public repo accesses this data via the GitHub-releases-as-assets pattern:

1. The private repo publishes versioned releases (initial release `v1.0.0-frozen`); each release carries the data files as release assets.
2. The public repo declares the required data version in a `data-version.txt` file at the repo root.
3. The public repo includes a setup script (`scripts/setup-data.ts`) that uses `gh release download` to fetch the declared version's assets into the local working tree at the original `fixtures/snapshots/enriched/` path (and other original paths for the other data files).
4. The public repo's `.gitignore` excludes all data-target paths, so the fetched files cannot accidentally re-enter git.
5. The public repo's existing data loader (`snapshot-loader.ts` and friends) reads from the original paths unchanged. No loader refactor is needed beyond ensuring the loader doesn't assume the data is tracked.

This pattern means: clone the public repo, run the setup script once with `gh` authenticated, the data appears at the path the code expects, the pipeline runs normally.

## Alternatives considered

**Local clone + env-var path.** Authorized collaborators clone both repos separately and set a `SAMRIDDHI_DATA_PATH` env var pointing to where the data repo lives locally. Simpler than releases, but requires loader refactoring to consume the env var. The releases pattern is preferred because it keeps the loader code untouched, provides explicit versioning, and centralises the access pattern in one setup script.

**Git submodule.** The private snapshots repo as a submodule of the public repo. Tightly coupled and ergonomic in the happy path. Rejected because submodules have known operational pain (people forget `--recursive`, submodule pointer drift, awkward behavior when the submodule is private and the user lacks access). The releases pattern produces clearer errors when access is missing ("you need GH access to ArthaSamriddhiAI/Samriddhi-AI-Data-Snapshots").

**Sanitization in place.** Strip sensitive figures from the snapshot data and keep redacted versions in the public repo. Rejected because the figures are load-bearing for the pipeline's reasoning; without real values, the agents have no data to reason over.

## Consequences

**Positive.**
- Snapshot and curated data are no longer world-readable.
- Access pattern is explicit and audit-able through GitHub's release download logs and private-repo access lists.
- Pipeline code remains public (the case-batch workstream's output, ADRs, debt logs, working agreements, agent skill files, etc.).
- Versioning is explicit: the public repo declares which data version it requires; reproducibility is preserved across data refreshes.

**Negative.**
- Authorized collaborators need GitHub access to the private repo plus `gh` configured locally. New collaborator setup gains one step.
- Refreshes of the data require a coordinated motion: tag a new release in the private repo, bump the version in the public repo, push the bump. Documented in the refresh-cadence debt (see private repo DD1).
- The data is no longer "right there" in the public clone; collaborators must run setup explicitly.

**The boundary the pattern enforces.** Code is public; data is private. Case fixtures and stub-response files stay public despite containing derived figures (figures cited in service of reasoning artifacts, not bulk redistribution). The boundary follows licensing and proprietary-edge concerns: the snapshot is the proprietary asset; cases derived from reasoning over the snapshot are the product output.

## References
- The s1-case-generation workstream's audit doc, which surfaced the public-data exposure during Phase A.
- ADR-0024 (scope-builder design) and ADR-0026 (Phase 1.5 enrichment), which establish what data the pipeline reads.
- Private repo's data-access-pattern ADR (`Samriddhi-AI-Data-Snapshots/docs/decisions/0001`), the counterpart to this ADR describing the producer side.
- WA13 (Samriddhi 1 / Samriddhi 2 naming discipline), which is operationally adjacent.

## Related debt
- (Public repo) Cross-reference debt entry P29 pointing to the private repo's debt log.
- (Private repo) DD1 (refresh cadence frozen for lean build), DD2 (assembly methodology not documented in reproducible form).
