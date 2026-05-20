# PR: Snapshot Data Enrichment (ready-to-open via gh)

Base: `main`. Head: `features/snapshot-enrichment`. **Do not auto-merge; squash-merge after review (WA1).** `gh` is available here; the PR is opened with `gh pr create --body-file docs/workstreams/snapshot_enrichment_PR.md`. This doc is the durable PR-body record (mirrors `accordion_integration_PR.md`, WA11).

---

## Title

[Snapshot Data Enrichment] Add monthly series, Tier B stats, freeze fix across t0-t8

## Body

### Summary

Integrates the Snapshot Data Enrichment workstream: monthly-frequency series (stock `monthly_prices`, 16 `indices`, USD/INR `fx`), per-instrument `tier_b_stats`, the `monthly_nav` freeze fix, and recomputed period scalars + `rolling_metrics` at t1–t8, regenerated against the live source in `fixtures/snapshots/`. The quarterly engine stays canonical (monthly compounds exactly to quarterly; zero tolerance by construction). Richness, not restructuring: every pre-existing field is preserved; the t0 enriched snapshot is a byte-identical pure superset of source, so existing consumers are unaffected.

### What changed

New files:
- `scripts/enrich_snapshots.py` — enrichment engine (Python 3 stdlib only; byte-identical to the validated workstream bundle, intentionally not refactored).
- `scripts/sector_map.json` — 500 Nifty 500 names → 57 sectors (data file read by the engine).
- `scripts/_verify-snapshot-enrichment.ts` — deterministic design-doc probe suite (no API; `_verify-*` convention).
- `docs/reference/SnapshotEnrichment_Thesis.md`, `docs/reference/SCHEMA_DIFF.md`.
- `docs/decisions/0007_…0012_….md` — the 6 folded ADRs (renumbered from ADR-1..6 to the repo's `000N_` scheme; bodies verbatim — see ADR map below).
- `docs/workstreams/snapshot_enrichment_handoff.md`, `docs/workstreams/snapshot_enrichment_PR.md` (this file).
- `fixtures/snapshots/enriched/snapshot_t0..t8_*.json` — 9 enriched snapshots (~115 MB), committed as demo seed.

Modified files:
- `.gitignore` — targeted un-ignore so only `fixtures/snapshots/enriched/` tracks (source ~99 MB stays ignored, still copied locally by `scripts/copy-fixtures.ts`).
- `scripts/README.md` — documents the new verify script and the Python engine.

New top-level snapshot blocks: `indices` (16 canonical), `fx` (usd_inr populated; eur/gbp/aed null). New sub-blocks: `mf_funds[].tier_b_stats`; `nifty500.companies[].monthly_prices` + `.tier_b_stats`; `snapshot_metadata.enrichment_*` provenance.

ADR filename map (bodies cross-reference each other as ADR-1..6 — a self-consistent set, kept verbatim per legibility-first):
`0007`=ADR-1 calibration/freeze-fix · `0008`=ADR-2 stock synthesis/beats · `0009`=ADR-3 index synthesis/set · `0010`=ADR-4 fx · `0011`=ADR-5 schema placement/lookback · `0012`=ADR-6 Tier B pre-computation.

### What did NOT change

Per `docs/reference/SCHEMA_DIFF.md` and verified by the backwards-compat gate (below):
- All 9 existing top-level keys preserved; `_meta`, `aif`, `pms`, `unlisted_equity`, `industry_reports`, `macro` byte-identical.
- Quarterly engine outputs untouched: `mf_funds[].NAV`/`AUM`, `nifty500.companies[].cmp_rs`/`market_cap_rs_cr`, `Top 5 Holdings`/`Top 5 Sectors`.
- t0 period scalars and `rolling_metrics` preserved exactly (boundary discontinuity per ADR-1/0007).
- Source flat `Sharpe`/`Sortino`/`Beta`/`Volatility`/`VaR` preserved unchanged; `tier_b_stats` lives in parallel.
- PMS, AIF, `unlisted_equity`, `industry_reports`, `macro`, `generate_snapshots.py` untouched.
- Existing consumers keep reading `fixtures/snapshots/` (source, unchanged, still local); enriched is additive demo seed in a new dir.

### Validation

**Step 1 — source audit:** 9 snapshots present; all 9 top-level keys; 1773 funds + 500 companies each; ids/dates/evolution types match the design doc; no pre-existing `enrichment_version`; sector_map covers 100% of company names (0 `other_unmapped`). No structural drift.

**Step 2 — enrichment:** exit 0, zero errors, 9 files written (12.13→13.28 MB, matches SCHEMA_DIFF). Banners: rate cut t3@2026-12, bank shock t5@2027-07, RIL idio t6@2027-10, smallcap t8@2028-03; `monthly_nav` "Extended: 1773, skipped: 0" at every snapshot.

**Step 3 — design-doc probes** (`npx tsx scripts/_verify-snapshot-enrichment.ts`, all PASS):
- RIL quarterly CMP: t2→t3 +7.2%, t4→t5 +14.3%, t5→t6 −28.0%, t7→t8 +16.2% (±0.005).
- RIL calibration anchor: `monthly_prices[last] == cmp_rs` at every t2..t8 (relErr < 1e-6).
- RIL idio beat 2027-10/2027-09 ≈ 0.74 at t6; HDFC Bank 2027-07/2027-06 ≈ 0.84 at t5.
- Gilt funds (n=33) Nov→Dec 2026: median +4.500%, range [+4.499%, +4.501%], 100% within ±0.005.
- Small-cap stocks (n=192) Feb→Mar 2028: median +7.00%, mean +7.00%, 100% within ±0.02 of 0.07.

**Step 4 — backwards-compat gate (structural deep-diff, all 9 snapshots PASS):**
- **t0 = byte-identical pure superset** (0 genuine violations, 0 changed pre-existing values). All 7 case fixtures read `snapshotId: t0_q2_2026`, so every field they consume is byte-identical source→enriched.
- t1–t8: 0 genuine violations; differences are exclusively (a) documented recompute of `monthly_nav`/`rolling_metrics`/period scalars on funds that had them, and (b) recomputed period scalars (5Y/7Y/10Y/15Y) newly populated on funds whose source lacked them (strictly additive at the key level — safe for existing consumers, no removals, no value changes to keys consumers already read), plus the additive `indices`/`fx`/`tier_b_stats`/`monthly_prices` blocks.
- Runtime STUB_MODE pipeline run **skipped per CC_DECISIONS** (see debt T2): no `bhatt` stub set exists; the t0 pure-superset proof already guarantees byte-identical inputs for every field a t0 stubbed pipeline would read.

### Sample diffs (spot-check)

**MF — JM Large Cap Fund (Regular) - Growth Option:**
- t0: `monthly_nav` 2006-05→2026-05 (241 mo) **source == enriched**; `NAV` 139.192 unchanged; `3Y`/`5Y` 0.121159/0.107546 **identical**; `tier_b_stats` added.
- t5: source `monthly_nav` still ends **2026-05** (the freeze); enriched extends to **2027-07** (255 mo, freeze fixed); `NAV` 163.6962 unchanged; `1Y` recomputed −0.0231 (stale) → 0.0960; `tier_b_stats.sharpe_3y` −0.4469 added.

**Stock — Reliance Industries:**
- t0: `cmp_rs` 1315.10 unchanged; no source `monthly_prices` → enriched adds 2019-05→2026-04 (84 mo); `tier_b_stats.beta_3y` 1.8087.
- t6: source `cmp_rs` 1222.15 == enriched `cmp_rs` 1222.15; `monthly_prices` →2027-10; 2027-09=1651.55 → 2027-10=1222.15 (**−26.0%**, the idio beat in its pinned month).

**Index — Nifty Bank TRI:**
- t0: source has **no `indices` block**; enriched adds `indices.nifty_bank_tri` (derive_from_constituents), 2019-05→2026-04 (84 mo).
- t5: series →2027-07; 2027-06=1175.11 → 2027-07=978.36 (**−16.7%**, bank shock in its pinned month).

### Debt entries (P / D / T / O — inline per the Phase E prompt; lighter than full debt-tracking)

**P (Process)**
- P-1: Enriched snapshots committed as demo seed (~115 MB; `.git` packs to ~+16 MB) via targeted `.gitignore` un-ignore, deviating from the literal `snapshots/enriched/` path and the `/fixtures/*` ignore convention. Per CC_DECISIONS item 1. Revisit (git-lfs candidate) if repo size bites.
- P-2: Branch `features/snapshot-enrichment` (repo plural convention) vs the prompt's `feature/snapshot-enrichment`. Convention won.
- P-3: Required-reading items 6 & 7 mis-located — `docs/workstreams/conventions.md` absent (WA1–WA11 live in `docs/workstreams/a2_classification_handoff.md`; dedicated conventions doc is existing debt **T8**); `SNAPSHOT_TEST_AXIS_DESIGN.md` is out-of-repo. Read from real locations.
- P-4: Debt surfaced inline here per the prompt, diverging from the durable `docs/debt/PRODUCT_DEBT_LOG.md` convention. Not adding rows unilaterally (log numbering discipline + prompt scope); owner to triage into the log (and reconcile P/D/T/O ↔ the log's T/P/D/X series) if desired.
- P-5: Phase A–E closure notes are required reading but not on the prompt's "files to land" list (not committed); WA11 audit-file counterpart to the hand-off not produced. Closure note owned by Shubham post-merge per PHASE_E_CLOSURE. Surfaced, not decided.

**D (Design)**
- D-1: `enrich_snapshots.py` hardcodes `DEFAULT_SECTOR_MAP_PATH = '/home/claude/enrichment/sector_map.json'` (standalone-env path). Not edited (no-refactor rule); `--sector-map scripts/sector_map.json` passed explicitly. Make relative/env-driven post-merge. Per CC_DECISIONS item 6.

**T (Tooling)**
- T-1: `lib/agents/snapshot-loader.ts` resolves only `fixtures/snapshots/` (source). Consuming `fixtures/snapshots/enriched/` needs a loader dir override; deferred to the downstream consumer (risk-reward) — out of scope for this data-infra workstream (richness-not-restructuring keeps existing consumers on untouched source).
- T-2: No `bhatt` stub set (only `c-2026-05-14-sharma-01` has the 16-file set; evidence agents throw on missing stubs), so the CC_DECISIONS "STUB_MODE pipeline run on bhatt" is not executable. Runtime run skipped per decision; backwards-compat proven structurally instead.
- T-3: `enrich_snapshots.py` is the repo's only Python (otherwise TS/Next.js); not in CI. Documented in `scripts/README.md`; runs on bare `python3` (stdlib only).

**O (Other)**
- O-1: Local source snapshots ~11.27 MB vs docs' ~10.75 MB — whitespace/serialization, not structural drift (counts/keys/ids/evolution/sector-map coverage all exact; no pre-existing `enrichment_version`). Enriched sizes match SCHEMA_DIFF.
- O-2: Tier-B MF computed-count ramps t1=1639 → t2=1688 → t3=1745 → t4–t8=1773 (funds below the 36/60-mo window carry the `data_window_insufficient` sentinel per ADR-6/0012 until `monthly_nav` extends). Expected; flagged because Step 2 text said "1773 at each".

### Out-of-scope findings (cluster-3 — for Shubham's planning-chat closure note, NOT debt)

1. Missing MFs in source MF universe: Axis Bluechip, HDFC Index Fund Nifty 50 Plan, Kotak Emerging Equity. Affects Lalitha/Mehra/Malhotra archetypes.
2. Broken `market_cap_rs_cr`: 5 stocks > 1.5M Cr, ~19 stocks = 0. Index constituent-selection edge effects only.
3. Existing engine's bank-shock detection misses SBI (substring matching) — t5 narrative-beat fidelity; enrichment honours source as canonical (ADR-1/0007).
4. Source `Sharpe`/`Sortino`/`Beta` flat scalars use unclear methodology — do not mix with `tier_b_stats` (hand-off documents this).

### References

`docs/reference/SnapshotEnrichment_Thesis.md` · `docs/reference/SCHEMA_DIFF.md` · `docs/decisions/0007–0012` (ADR-1..6) · `docs/workstreams/snapshot_enrichment_handoff.md` · Phase A–E closure notes (workstream bundle, out-of-repo) · `SNAPSHOT_TEST_AXIS_DESIGN.md` (out-of-repo: `08 - Factual Foundation Continued/Data Snapshots/`).

Plan v6/v7 update is **out of scope** for this PR per CC_DECISIONS item 4 (out-of-repo planning docs; Shubham updates manually post-merge). Risk-reward statistics can resume post-merge; its trade-off 3 / trade-off 4 sections are updated separately by Shubham.
