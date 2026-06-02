# Get the real t0 into the data repo cleanly (two-repo discipline)

**Date:** 2026-06-02
**Branch:** `features/client-weighted-benchmark` (code repo). Read-only audit-and-proposal; propose, do not move data, do not change the build, commit nothing except this audit, no agent run, no spend. WA14 (the two-repo separation is the point), WA22 (versioned `docs/audits/` deliverable), WA28 (the data-repo versioning and the v1.0.0 treatment are the primary's calls), WA2/WA21 (grounded, read sites quoted), WA27, WA7. First-move: new dated `docs/audits/` file. The time-stepping / t1-t8 question belongs to the in-flight sequencing audit (`docs/audits/2026-06-02_timeseries_dependency_and_sequencing.md`); this audit only notes (item 2) that the new data version must accommodate the eventual real t1-t8.

---

## Bottom line

The real t0 is already physically in the data repo, not the code repo. `fixtures/snapshots/enriched` is a symlink into the data repo's `snapshots/`, so the build wrote `snapshot_t0_q2_2026_realv1.json` straight into `Samriddhi-AI-Data-Snapshots/snapshots/`, where it sits UNTRACKED (`git status` in the data repo shows `?? snapshots/snapshot_t0_q2_2026_realv1.json`). Nothing data-shaped is in the code repo's git. So the clean-up is small and lives in the DATA repo: rename the loose `_realv1` file onto the canonical `snapshot_t0_q2_2026.json` (preserving the synthetic at the `v1.0.0-frozen` tag), update the manifest, commit on the data repo's `main`, and cut a new versioned release when the series is complete. The code repo needs no data change; it already references the data via the gitignored symlink (local) and `data-version.txt` plus `npm run setup-data` (canonical). The build scripts are code and belong committed to the code branch.

---

## 1. The data repo's actual versioning convention (grounded)

The data repo is `Samriddhi-AI-Data-Snapshots` (private, org `ArthaSamriddhiAI`), checked out at `.../17 - Claude Code Local Workflow - Samriddhi AI Data Snapshots - main branch`. Layout (from the repo and its README):
- `snapshots/` : the nine enriched snapshots `snapshot_t0_q2_2026.json` through `snapshot_t8_q2_2028.json`.
- `sector_map.json` : Nifty 500 sector classification (the ENRICHMENT map; see item 4, it is not the code-repo look-through map).
- `manifest.json` : the release-asset manifest. Fields per asset: `filename`, `sha256`, `size_bytes`, `target_path`; top level `version`, `asset_count` (10), `consumer_repo` (`ArthaSamriddhiAI/Samriddhi-AI-Lean`), `generated_at`.
- `docs/{decisions,debt,methodology,working_agreements}`, `README.md`.

**Versioning is "data publication via versioned GitHub releases"** (the data repo's own `docs/decisions/0001_data_publication_via_versioned_github_releases.md`, Accepted). Each release ships the nine snapshots plus `sector_map.json` plus `manifest.json` as release assets; authorized consumers fetch with `gh release download <tag>` and verify against the manifest's SHA256. Semantic versioning: "patch versions for corrections, minor versions for additions, major versions for breaking schema changes." Consumer-follows-main was explicitly REJECTED for reproducibility, so consumers pin a release tag, not the branch.

**"Frozen at v1.0.0" means the git tag plus GitHub release `v1.0.0-frozen`** (the only tag in the repo; `manifest.json.version` is `"v1.0.0-frozen"`). It is the synthetic snapshot set as it existed at extraction, deliberately immutable.

So a new real-data version is a NEW release (new tag, new assets, new manifest). The real t0 is both a content change (synthetic to real) and a schema change (the build added `debt_yield_primitives`, `snapshot_metadata.real_data_build`, and `_meta` provenance on the debt indices, none of which exist in `v1.0.0-frozen`), so by the repo's own rule (major = breaking schema change) it is a **major bump: v2.0.0**.

## 2. Committing the real t0 to the data repo, and the v1.0.0 treatment

The `_realv1` artifact already carries its provenance in-band (`snapshot_metadata.real_data_build`: real Bloomberg sources, the yield-to-TR conversion, the synthetic-debt supersession; plus per-index `_meta`). The clean sequence (data repo, on `main`):

1. **Promote onto the canonical filename.** Rename `snapshots/snapshot_t0_q2_2026_realv1.json` to `snapshots/snapshot_t0_q2_2026.json`, replacing the synthetic file. The synthetic t0 is not lost: it remains in git history and in the `v1.0.0-frozen` tag and release. This removes the loose `_realv1` artifact (the thing the kickoff wants gone) and keeps the filename the manifest, the seed, and the symlink already expect.
2. **Update `manifest.json`.** Bump `version` to `v2.0.0`; recompute t0's `sha256` and `size_bytes` for the real file; record the real-data provenance (real Bloomberg sources, par-bond yield-to-TR, synthetic-debt supersession) either in the manifest or via a `docs/methodology/` note that points at the code-repo conversion ADR (item 6). `target_path` is unchanged.
3. **Commit on `main`** with a provenance message.
4. **Tag and cut the `v2.0.0` GitHub release** (per the repo's ADR-0001) once the version is complete, see the t1-t8 note below. Keep `v1.0.0-frozen` untouched as the synthetic reference baseline.

**v1.0.0 treatment (WA28, options):**
- **(A, recommended) New major version alongside; v1.0.0-frozen stays as the synthetic reference.** The tag is literally named "frozen"; the synthetic baseline keeps its value as a regime-test / reproducibility reference and as the provenance of the prior cases. The real data becomes canonical at `v2.0.0`. This is the natural reading of the existing convention and needs no special handling.
- **(B) Treat the real t0 as a correction (patch/minor) of v1.0.0.** Rejected: the schema changed (new blocks), and ADR-0001 reserves major for schema changes; calling real-vs-synthetic a "patch" understates the change and muddies reproducibility.
- The decision that is genuinely the primary's is only the version NUMBER and whether `v1.0.0-frozen` should additionally be re-described (for example, annotated in the README as "synthetic baseline, superseded by v2.0.0 real"). Recommend A with a one-line README note.

**t1-t8 accommodation (the sequencing audit owns the how/when).** The new version must carry the eventual real t1-t8 as part of the same `v2.0.0`. Two ways to stage it (WA28):
- **(recommended) Land real t0 on `main` now; cut the `v2.0.0` release when the full real t0..t8 series is complete.** A release should be a coherent complete version. The local re-fire does not need the release: it loads through the symlink from the data repo working tree (item 3), so committing real t0 to `main` is enough to unblock it. The formal `v2.0.0` release and the `data-version.txt` bump follow once the real successors land. Interim, `main` carries real t0 beside synthetic t1-t8; the sequencing audit establishes the t0 cases do not read t1-t8, so this interim is safe for the re-fire.
- **(alternative) Cut `v2.0.0` now** with real t0 and a manifest flag that t1-t8 are pending real re-derivation, then a later `v2.1.0` updates the successors. Cleaner for canonical consumers who want a tag immediately, at the cost of a release whose successors are knowingly still synthetic.

## 3. How the code repo references it (the alias, cleanly)

Two mechanisms, both grounded:
- **Canonical (CI / clean clone).** `data-version.txt` (tracked in the code repo; currently `v1.0.0-frozen`) pins the release tag. `npm run setup-data` (`scripts/setup-data.ts`) reads that pin, runs `gh release download <tag>` against `ArthaSamriddhiAI/Samriddhi-AI-Data-Snapshots`, verifies each asset's SHA256 against the manifest, and places it at the manifest `target_path` (`fixtures/snapshots/enriched/snapshot_t0_q2_2026.json`, ...). To consume real data canonically: after the `v2.0.0` release exists, bump `data-version.txt` to `v2.0.0`.
- **Local dev (this machine).** `fixtures/snapshots/enriched` is a gitignored symlink to `<data-repo>/snapshots`, so the code reads the data repo's working tree live. Once real t0 is at the canonical filename on the data repo's `main` (item 2 step 1), the symlink resolves the standard `snapshot_t0_q2_2026.json` to real data with no code change. This is why the local re-fire is unblocked by the data-repo commit alone.

**Nothing data-shaped is tracked by code-repo git, confirmed.** `.gitignore` ignores `/fixtures/snapshots/*`; `git check-ignore fixtures/snapshots/enriched` confirms the symlink itself is ignored, and `git ls-files fixtures/snapshots/` is empty. The code repo tracks only `data-version.txt` (a pointer, which is code) and the scripts. End-state: data committed and released in the data repo; the code repo points at it via `data-version.txt` plus the gitignored symlink; the loose `_realv1` file is gone (renamed onto the canonical name).

## 4. Build scripts vs data: the split

- **CODE, commit to the code branch:** `scripts/build_real_t0.py`, `scripts/_recompute-real-betas.ts`, `scripts/_verify-debt-blend.ts`, the blend wiring in `lib/agents/risk-reward-stats.ts`, the sector wiring in `lib/agents/portfolio-risk-analytics.ts`, and `db/fixtures/sector-map.ts`. These are the held build artifacts from the execution turn; they belong in the code repo.
- **DATA, commit to the data repo:** the snapshot JSON (real t0, and the eventual real t1-t8), `manifest.json`, and the enrichment `sector_map.json`.
- **Committing the code drags no data into the code repo.** The snapshots are reached only through the gitignored symlink; the scripts read the data at runtime and embed none of it. The held build diff is `lib/`, `scripts/`, `db/fixtures/sector-map.ts` only, all code.
- **One distinction to avoid confusion:** the code-repo `db/fixtures/sector-map.ts` (T-5.14 Phase 4) is NOT the data-repo `sector_map.json`. The code-repo map is a small TS runtime map of held / pulled listed names to the snapshot's AMFI sector labels (Banks, IT - Software, Petroleum Products, ...), consumed by the look-through so direct equity aggregates with MF/PMS disclosed sectors. The data-repo `sector_map.json` is an enrichment input keyed to a different internal taxonomy (`banks_psu`, `banks_private`, `nbfc_financials`, ...) used by `enrich_snapshots.py` for stock synthesis. Different layer, purpose, and taxonomy; they are not duplicates, and the code one is correctly code. A future consolidation (deriving the look-through map from the enrichment map via a taxonomy crosswalk) is possible but non-blocking; noting it as debt is enough.

## 5. LIX15: confirm NIFTY1D, discard LIX15 (with the corrected characterization)

Confirmed: the build's cash cell is sourced from **NIFTY1D** (the real Nifty 1D Overnight index, flat through COVID, the correct cash benchmark), and **LIX15 is not in the real snapshot** (`grep -l LIX15 snapshot_t0_q2_2026_realv1.json` finds nothing) and nothing in the data or the loaded snapshot depends on it. LIX15 appears in exactly two places, both descriptive prose, neither consumed:
- `scripts/build_real_t0.py:515` (a comment characterizing LIX15 as "glitched").
- `docs/audits/2026-06-01_fimmda_debt_cell_sizing.md:32` (lists "Liquid (LIX15)" among cash-floor indices).

**Corrected characterization (per the primary):** LIX15 is the WRONG INSTRUMENT, a "Liquid 15" instrument, not the intended overnight / 1D index, so its roughly -37% March 2020 move is an instrument mismatch, not glitched data. Discard LIX15 entirely; NIFTY1D stays. Action is cleanup, not a re-pull, and it rides with the held build code rather than this audit: when the build is committed, change the `build_real_t0.py:515` comment from "came back glitched" to "is the wrong instrument (a Liquid 15, not the intended overnight)," and correct the same "glitched" wording in the Phase 6 narrative wherever it ships. The sizing audit's mention is a pre-build descriptive line; an optional one-line footnote is enough. No data change.

## 6. The yield-to-TR conversion needs an ADR (note for docs)

The par-bond yield-to-TR conversion (`TR_return = carry - ModDur*dy + 0.5*Conv*dy^2`), the supersession of the five synthetic ADR-0009 debt indices, the `DEBT_CELL_INDEX` contract, and the documented approximation are currently captured only in the audits and the build script, not as an ADR. They warrant one.

- **Home:** the CODE repo `docs/decisions/`, because the decision is a code/method decision (the conversion in `scripts/build_real_t0.py`, the `DEBT_CELL_INDEX` blend wiring in `lib/agents/risk-reward-stats.ts`). The decisions there run to `0040_a1_absence_in_samriddhi_2_diagnostic.md`, so this is **ADR-0041** (next free number; confirm at landing per WA24).
- **Data-side pointer:** since the conversion produces the snapshot's debt series, add a short provenance/methodology note in the data repo (`docs/methodology/` or the manifest provenance) pointing at code-repo ADR-0041, so a data consumer sees why the debt benchmarks are yield-derived. This mirrors the split: the decision and method are code; the data carries provenance referencing them.
- **Timing (WA28):** ADR-0041 documents the data foundation the re-fire builds on, so the primary may prefer to write it BEFORE the re-fire rather than in the post-re-fire docs phase. Flag it as ready-to-write; it is a doc, no spend.

---

## Proposed clean sequence (for approval; execution is a later gated step)

1. [code] Correct the LIX15 "glitched" wording to "wrong instrument" in `scripts/build_real_t0.py`, then commit the held build scripts and wiring and `db/fixtures/sector-map.ts` to the branch.
2. [code] Write ADR-0041 (yield-to-TR conversion, synthetic-debt supersession, `DEBT_CELL_INDEX`) in `docs/decisions/`.
3. [data] Rename `snapshots/snapshot_t0_q2_2026_realv1.json` onto `snapshot_t0_q2_2026.json`; recompute its SHA256 and size; update `manifest.json` (version `v2.0.0`, provenance) and add a `docs/methodology/` provenance note pointing at ADR-0041; commit on `main`. This alone unblocks the local re-fire through the symlink.
4. [data] When the sequencing audit's real t1-t8 are produced, replace `snapshot_t1..t8`, update the manifest, then tag and cut the `v2.0.0` GitHub release (the complete real series). `v1.0.0-frozen` stays as the synthetic baseline.
5. [code] After the release exists, bump `data-version.txt` to `v2.0.0` so canonical consumers fetch real data.

This audits and proposes; it moves no data, changes no build, commits only this file, runs nothing, and spends nothing. The data-repo versioning and v1.0.0 treatment are the primary's calls.
