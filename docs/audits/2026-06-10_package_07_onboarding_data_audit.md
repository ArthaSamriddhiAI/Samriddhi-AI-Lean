# Package 07 audit: investor onboarding and data management, audit and propose

- Date: 2026-06-10
- Branch: `features/package-07` (this audit doc is the branch's only write)
- Status: read-only grounding audit plus proposals (WA22, WA30). No implementation code, no fixture writes, no registry writes, zero API spend (WA12: nothing in this pass invokes any model; all evidence is file reads, git inspection, and local static analysis).
- Mode: every claim below is marked **[audited]** (verified against the live file, with path and line) or **[hypothesis]** (stated belief, not yet verified). Kickoff claims that failed verification are called out explicitly.
- Repos read: this repo on `main` (at 87840af); the private data repo `ArthaSamriddhiAI/Samriddhi-AI-Data-Snapshots` (local clone, `main` at 971ede6, plus tag `v1.0.0-frozen`); external read-only artifact folders under the project parent directory (never committed): `23 - Lean Samriddhi MVP/14 - Factual Foundation Continued/` (the A1 to A5 ingestion package) and `23 - Lean Samriddhi MVP/08 - Factual Foundation Continued/Investor Archetypes For Testing/` (the A6 to A14 cohort); the locked v7.2 wireframe at `23 - Lean Samriddhi MVP/15 - Product Roadmap & Build Plan/14 - Samriddhi Roadmap v14/12 - In-App Case Screen - Rajiv Surana v7.2 (Standalone).html`; the render bundle screenshot set at `23 - Lean Samriddhi MVP/11 - Package-Wise Build/19 - Render Tasks Bundle (T-5.08 + T-5.09 + T-5.11)/06 - Screenshots/`.

Working agreements were read from `docs/working_agreements/` in full (WA23 inheritance by reference; the operative ones here: WA22, WA02, WA21, WA30, WA28, WA24, WA15, WA29, WA12, WA16, WA13, WA07, WA14, WA05, WA08, WA26, WA27, WA20).

---

## Part A: grounded findings

### A1. The section 06 / P50 / D14 data-universe mismatch, re-grounded

The kickoff's framing ("the eCAS NAVs and the snapshot `monthly_nav` are inconsistent universes; re-anchor `simulate_history`, resolve fund-name mismatches, regenerate") is directionally right but is built on a measurement taken against a stale data version. The live state is materially better and differently shaped than the debt entries record.

**A1.1 What `generate_ecas.py` actually produces.** [audited] `simulate_history` (data repo `generators/generate_ecas.py:154-326`) backsolves `target_units = current_value_inr / current_nav` (line 175), then fabricates the transaction path by discounting the current NAV at an assumed CAGR per fund role: debt 6.5% (line 188), hybrid 9% (line 224), index 11.5% (line 250), equity 12% (lines 275 and 292), with a final proportional rescale so the closing balance ties exactly (lines 314 to 325). `current_nav` comes from the clean source universe's static `NAV` field, not from any `monthly_nav` series. This matches the recorded limitation (data repo `generators/METHODOLOGY.md:43-51` and `docs/decisions/0002_repository_as_home_of_synthetic_data_apparatus.md:35-40`) exactly. The external package README's claim that "the eCAS NAVs in Batch 3 are sourced from the t0 baseline snapshot" (`14 - Factual Foundation Continued/README.md:80`) is true only of the terminal NAV; every intermediate NAV on the statements is CAGR fiction.

**A1.2 There are three t0 universes in play, and D14 measured against the wrong one.** [audited]

| Universe | Where | Mirae Asset Large Cap, 2026-03 `monthly_nav` | Static `NAV` field |
|---|---|---|---|
| v1.0.0-frozen, synthetic (ADR-0014 regenerated series) | data repo tag `v1.0.0-frozen` | 137.443843 | 101.888 |
| v2.0.0 real t0 (ADR-0042 restoration) | data repo `main` HEAD, `snapshots/snapshot_t0_q2_2026.json` | 99.677 | 101.888 |
| eCAS closing basis | the statements; equals the static `NAV` field | n/a | 101.888 |

The five mismatch figures D14 quotes (Mirae 137.44, Parag 68.37, Axis 49.64, SBI 133.34, Franklin 113.14) are exactly the **v1.0.0-frozen synthetic** series at the 2026-03 grid point. Verified by reading both versions from git: synthetic 2026-03 values 137.443843 / 68.373211 / 49.644001 / 133.335456 / 113.140754; committed real t0 2026-03 values 99.677 / 78.2643 / 53.78 / 147.155 / 103.4834 against eCAS closing NAVs 101.888 / 79.0268 / 54.54 / 151.0376 / 103.276.

Consequence: against the **committed real t0** the terminal-point gap collapses from "9 to 35% off" to **0.2% to 2.6%**, and the residual is a date-grid question (the static NAV is an as-of-2026-04-02 value, the series is a month-end grid), not an inconsistent universe. The static `NAV` field is identical in both versions because both inherit it from the clean colleague source; ADR-0014 regenerated only the series, which is why the synthetic series disagrees with its own row's static NAV by up to 35%.

What remains fully true on real t0: the **intermediate path** is still fiction (smooth CAGR versus the real market path), so the per-month gross line and any mid-history purchase NAV still do not reconcile. Re-anchoring is still required; its target has changed (anchor to the real series, not to a synthetic one), and the terminal tolerance question (A1.6 item 2) replaces the headline universe break.

**A1.3 Why the render bundle measured the synthetic universe: the pin is stale and the v2.0.0 release does not exist.** [audited]

- `data-version.txt:1` on `main` pins `v1.0.0-frozen`. `scripts/setup-data.ts:100-126` downloads exactly the pinned release tag.
- The data repo has only one tag, `v1.0.0-frozen`. Its `manifest.json:2` says `v2.0.0`, and `manifest.json:77` says "The formal v2.0.0 GitHub release is cut when the full real series is complete." So ADR-0042's "consumers pin v2.0.0" is aspirational: there is nothing to pin. The real t0 is reachable today only via the data repo's `main` branch, not via the ADR-0027 release flow.

**A1.4 A live data-integrity incident discovered during this audit: the data repo working tree is clobbered back to synthetic.** [audited]

- This repo's `fixtures/snapshots/enriched` is not a fetched directory on this machine; it is a **symlink** (created 2026-05-23, untracked) into the data repo clone's `snapshots/` directory.
- `scripts/setup-data.ts:174-180` places each downloaded asset with `copyFileSync` to `fixtures/snapshots/enriched/...`, which resolves **through the symlink into the data repo's working tree**.
- Result: the data repo working tree's `snapshots/snapshot_t0_q2_2026.json` is byte-identical to the v1.0.0-frozen blob (`git hash-object` 3b54c5f1... equals `v1.0.0-frozen:snapshots/snapshot_t0_q2_2026.json`; HEAD's blob is dbebb7fb...). `git status` in the data repo shows the file modified. The render bundle's `setup-data` run (per the addendum in `docs/audits/2026-06-09_section06_performance_line_data.md`) silently overwrote the real t0 in the data repo clone with the synthetic one.
- Live consequence: any code or person reading "the snapshot" through this repo's canonical path today reads **synthetic** t0 while ADR-0042 records the real restoration; the five re-fired Samriddhi 2 fixtures were computed on real t0 (PR #14), so the on-disk snapshot now disagrees with the basis of the persisted fixtures. Nothing currently running is wrong (the case screen reads persisted fixtures, A4 item 2), but the next agent run or reconciliation will read the wrong universe, which is exactly what happened on 2026-06-09.
- The fix is one `git checkout -- snapshots/snapshot_t0_q2_2026.json` in the data repo plus a decision about the symlink (Part B, decision 1, and surface RS1). Out of scope for this read-only pass.

**A1.5 Fund-name mismatches, verified against the live universes (1,773 funds in both).** [audited]

- "Kotak Emerging Equity Fund" (held by Malhotra, Surana, Sharma; `db/fixtures/structured-holdings.ts:86,164,188`): no fund containing "Kotak Emerging" exists in either snapshot version. The correct record is "Kotak Midcap Fund - Regular Plan - Growth" (P40, D6), and the generator's own resolver already maps it (`generators/generate_a1_a5_ingestion.py:47`).
- "HDFC Index Fund Nifty 50" (Iyengar; `db/fixtures/structured-holdings.ts:101`): no fund contains "HDFC Index"; the universe carries "HDFC Nifty 50 Index Fund - Direct Plan" among 358 index funds. Word-order plus plan-suffix near-miss; generator alias at `generate_a1_a5_ingestion.py:48`.
- "ICICI Prudential Balanced Advantage Fund" (Iyengar; `db/fixtures/structured-holdings.ts:102`): **"ICICI Prudential Balanced Advantage Fund - Growth" exists in both universes.** D14's claim that ICICI Balanced Advantage has "no clean share-class match" does not reproduce against the live universe under a containment test; the failing matcher lived in the un-merged render-bundle reconciliation, not on `main`. [audited for the universe; the matcher's exact rule is unverifiable from `main` and is marked hypothesis.]
- "Axis Bluechip" was already renamed to "Axis Large Cap Fund" in the fixtures (`db/fixtures/structured-holdings.ts:120-122`); the universe carries "Axis Large Cap Fund - Regular Plan - Growth".
- Net: the alias knowledge exists in the generator (`generate_a1_a5_ingestion.py:44-51`) but was never shared with the consuming side's reconciliation. The canonical fix is one versioned name map consumed by both (Part B, decision 3).

**A1.6 What re-anchoring `simulate_history` concretely involves.** [audited mechanics, the rulings are flagged]

1. Pass each resolved fund's real `monthly_nav` (v2.0.0 t0) into `simulate_history` and replace the four CAGR discount expressions (`generate_ecas.py:188,224,250,275,292`) with lookups of the real series at each transaction month. Real series have true inceptions (Parag Parikh Flexi starts 2013-05, SBI Small Cap 2013-11), so the synthesized 6-to-10-year SIP patterns must clamp to inception or re-pattern; the synthetic-era series had no such constraint.
2. Pick the terminal basis (a small WA28 ruling): either `target_units = value / series_value_at_t0_grid` so units times the series reconciles exactly by construction, or keep the static-NAV basis and write the reconciliation gate with an explicit 3% date-basis tolerance. The first is cleaner; it changes printed closing NAVs slightly relative to the static field.
3. Move the name-alias map into a versioned, shared artifact (data repo) consumed by both the generator and the app-side reconciliation.
4. Regenerate the eCAS set (8 PDFs across A1 to A14) and keep holdings consistency: `current_market_value_inr` stays canonical (the freeze), so MF `quantity` values in `holdings_a1_a5.json` / `holdings_extended.json` change to value divided by real NAV. The five demo investors' in-repo fixtures (`db/fixtures/structured-holdings.ts`) carry no units, so the public demo seed is untouched by construction (values and weights are the frozen surface).
5. Prerequisites from A1.3/A1.4: restore the data repo working tree, cut the v2.0.0 (or v2.0.1) release, bump `data-version.txt`, and re-run `setup-data` against a non-symlinked target (or rule the symlink as the documented dev convention and make `setup-data` refuse to write through it).
6. The line itself is then a capability build on top (persist a gross and net monthly series into `content.time_series_performance`, re-fire deterministically, render per ADR-0045 conventions), as scoped in `docs/audits/2026-06-09_section06_performance_line_data.md` and ADR-0048.

**A1.7 Coverage against the WA16 70% floor: re-anchoring alone restores the line for Surana only.** [audited arithmetic from `db/fixtures/structured-holdings.ts` weights]

| Investor | MF weight | Listed equity | MF + listed | Other classes (no NAV/price series) |
|---|---|---|---|---|
| Surana | 46.4% | 26.1% | **72.5%** | ETF (GIFT) 8.7, PMS 8.7, gold 5.8, cash 4.3 |
| Malhotra | 52.1% | 0 | 52.1% | Tax-free bonds 26.3, FD 13.1, gold 8.4 |
| Iyengar | 45.8% | 0 | 45.8% | FDs 54.3 |
| Bhatt | 11.5% | 28.5% | 40.0% | PMS 39.4, AIF 13.6, FD 7.0 |
| Menon | 0 | 6.6% (US) | 6.6% | cash 86.6, FD 6.8 |

(The 2026-06-09 audit's "about 25% MF plus listed" for Bhatt was an underestimate; it is 40.0%. Its 46/46/52 MF-only figures check out.)

So after a perfect re-anchor: Surana clears the floor at 72.5% (81.2% if the GIFT ETF is ruled coverable via the real SPXT series plus FX, which v2.0.0 carries); **Malhotra (52.1%) and Iyengar (45.8%) still do not clear 70%** on MF plus listed alone. The kickoff's implication that the fix restores the line generally does not hold arithmetically. What would change it, honestly:

- FDs: `holdings_a1_a5.json` rows carry `vehicle_specific_attributes` with contractual `interest_rate` and `maturity` (verified on the Iyengar HDFC FD row: 7.0%, 2026-06-15). A deterministic contractual-accrual value path for FDs is **real data, not fabrication**; ruling it coverable takes Iyengar to 100% and Malhotra to 65.2%.
- Tax-free bonds (Malhotra 26.3%): no instrument-level series; the v2.0.0 FIMMDA yield-to-TR debt grid (ADR-0041) is a sleeve-level proxy. Whether a labelled proxy passes the honesty bar is a product ruling; if yes, Malhotra clears.
- Physical gold (8.4 / 5.8%): an index-level series could price the metal honestly if a gold series exists in the canonical set. [hypothesis: not verified whether the 16-index set carries gold; check at build time.]
- PMS, AIF, savings: stay uncovered (the established opacity posture, D12, ADR-0048).

This is surfaced as RS2 below: the 70%-floor class-coverage policy is a product decision that gates what "done" means for the P50/D14 task.

### A2. The data-snapshots generators: hardcoded paths and what rehoming requires

[audited] The four generators are committed verbatim as provenance (data repo `generators/`, ADR-0002), and will not run as-is:

- Hardcoded claude.ai-sandbox paths: `generate_ecas.py:861,865` (`/home/claude/lean_test_infra/archetypes/holdings_extended.json`, `/mnt/user-data/uploads/SamriddhiAI_data_clean.json`), `generate_a1_a5_ingestion.py:30,32,190,230,483`, `generate_altformat.py:17-18`, `generate_snapshots.py:21`.
- Flat-module imports: `generate_a1_a5_ingestion.py:22-23` imports `generate_ecas` / `generate_altformat` by bare name.
- External dependency: `reportlab` (`generate_ecas.py:12-23`); no requirements file, no runner.
- Cohort-era mix: the committed `generate_ecas.py`'s `main()` reads the A6-to-A14 `holdings_extended.json` while the committed orchestrator reads `holdings_a1_a5.json`; the A6-to-A14 folder carries its own copies of `generate_ecas.py` and `generate_altformat.py` which are **byte-identical** (md5-verified) to the committed ones, so there is no fork drift, but that folder's `build_holdings_extended.py` (the A6-to-A14 holdings builder) is **not committed** to the data repo apparatus.
- Input data location: the clean universe file `SamriddhiAI_data_clean.json` exists locally only at `21 - Team Inputs/02 - 1 May 2026/Kush Goyal/Final Merged JSON/` (the curated colleague source of ADR-0042); it is real-world-sourced, so per WA14 its versioned home should be the private data repo, where it currently is not.

Rehoming therefore means: repo-relative pathing with a small config or CLI for input/output locations; committing (or release-attaching) the clean universe input to the private repo; committing `build_holdings_extended.py`; a `requirements.txt` (reportlab); and a documented run recipe in `generators/METHODOLOGY.md` (closing part of DM2). Plus the A1.6 re-anchor changes. None of this is architecturally controversial; it is the explicit "data-management workstream owns making the generators runnable" deferral recorded in ADR-0002's consequences.

### A3. File-format parsing and investor data shape and storage today

**Parsing: none exists in this repo.** [audited]

- `package.json` dependencies carry no parsing library of any kind (no xlsx, no pdf reader, no csv; `@react-pdf/renderer` generates PDFs, it does not read them).
- D3 (`docs/debt/data_debt_log.md:9`) is accurate and current: "No eCAS parsing pipeline. Investor holdings fixtures are created manually."
- The only thing resembling ingestion is `db/seed.ts:441-451`, which JSON-stringifies the hand-authored `HOLDINGS_BY_INVESTOR` fixtures into `Investor.holdingsJson` at seed time, plus hand-authored onboarding transcripts for Malhotra and Menon (`db/seed.ts:352,397` into the existing `Investor.onboardingTranscript` column).

**Kickoff correction.** The kickoff's "interim `db/fixtures/investor-transactions.ts` design" does not exist anywhere in the repo or its docs: grep over code and markdown finds zero references. What exists on `main` is the prose design (parse with a strict reconciliation gate, 70% floor) recorded in `docs/audits/2026-06-09_section06_performance_line_data.md` and ADR-0048's consequences ("designed but not implemented"). The TS-fixture filename lives only in planner memory; per WA22 it is a **[hypothesis]** artifact, and this package may treat the prose design as the only interim contract.

**Shape and storage.** [audited]

- Canonical in-repo holding shape: `{ instrument, assetClass, subCategory, valueCr, weightPct }` (`db/fixtures/structured-holdings.ts:56-62`); investor totals plus optional `excludedHoldings`. No units, no cost basis, no dates, no folio/ISIN/AMFI identifiers.
- Storage: SQLite via Prisma (`prisma/schema.prisma:10-13`); `Investor` rows carry `holdingsJson`, `mandateJson`, `profileMd`, `onboardingTranscript` (`prisma/schema.prisma:15-48`); cases are frozen `contentJson` blobs. Single-tenant (T4), no encryption at rest beyond the filesystem, API key in the single-row `Setting` table.
- The richer shape already exists, but only externally: `holdings_a1_a5.json` (41 rows, five investors) carries `quantity`, `cost_basis_per_unit_inr`, `cost_basis_total_inr`, `purchase_date`, `current_market_value_inr`, and `vehicle_specific_attributes` (FD rows: `interest_rate`, `maturity`), with `holdings_extended.json` carrying 113 more rows for A6 to A14 in the same schema.
- Registry correction for landing: P51 names `lib/agents/structured-holdings.ts` as the dropping transform; **that file does not exist**. The drop happens at hand-authoring time: the in-repo fixtures were authored from the foundation section 4 tables (`db/fixtures/structured-holdings.ts:1-18`) and never carried the fields. P51's substance stands; its mechanism and path need rewording when this workstream lands (WA21).

**The ingestion test corpus already exists, and it is synthetic.** [audited] The external folders carry, for A1 to A14: 8 eCAS PDFs (CAMS/KFintech-style), 14 alt-format files (4 spreadsheet textures, plain-text dumps, email prose), 14 meeting notes, and per-archetype character bibles for A6 to A14 (`14 - Factual Foundation Continued/README.md:55-76`). Everything is generated fiction (synthetic PAN, addresses, folios), so the entire onboarding build can be exercised offline with zero PII exposure and zero spend.

### A4. The cross-repo arrangement today (the model for private investor data)

[audited]

1. **The contract** (ADR-0027, both repos' ADR-0001): real-world-sourced data lives in the private data repo and is published as versioned release assets with a SHA256 manifest; this repo pins a version in `data-version.txt`, fetches via `scripts/setup-data.ts` (gh release download, verify-all-then-place-all, `scripts/setup-data.ts:150-180`), into gitignored paths (`.gitignore:65-88`); the loader reads those paths from disk (`lib/agents/snapshot-loader.ts:26,207-221`, LRU capacity 3).
2. **The render path never touches the snapshots**: the case route reads only Prisma rows (`app/cases/[id]/page.tsx:47`); the 13.8MB JSONs are agent-runtime-only. Any future investor-data read has the same two lanes available: seed-time (into SQLite) or agent-runtime (from disk).
3. **The de facto dev-machine arrangement diverges from the contract**: the symlink described in A1.4 bypasses the release flow entirely and makes `setup-data` destructive to the data repo clone. It is undocumented and untracked. It is also evidence that a local-path convention is operationally attractive (zero-copy, instant), which Part B decision 1 takes seriously rather than dismissing.
4. **The version chain is currently broken at three links**: pin says v1.0.0-frozen (stale), no v2.0.0 release exists (manifest only), working tree clobbered (A1.4). The model is sound; its operation has drifted.

### A5. UX13: the rendering-versus-wireframe residual, concretized (findings only)

Method note: the brief asked for a vision comparison of the current rendering against the v7.2 wireframe. The only screen captures that exist (the 13 viewport shots plus one full-page capture in `11 - Package-Wise Build/19 - Render Tasks Bundle/06 - Screenshots/`) are, on inspection, the **pre-rebuild Concept C accordion** (Iyengar case, uniform severity rows, charts collapsed): they are the layout-gap audit's "before" evidence, dated 2026-06-09 1:10 PM, before the composed rebuild landed. **No post-rebuild capture of the composed page exists anywhere I could find.** Producing one requires running the app, which this audit phase does not do. So the comparison below grounds the wireframe side in vision (the full 27,516px wireframe capture, read in 10 segments) and the current side in the shipped code (`components/case-detail/AnalysisTab.tsx`, `app/globals.css`), which is exact for colours, weights, and structure. The one thing this cannot verify is painted-pixel behaviour (wrapping, spacing rhythm at runtime); that gap is itself a finding.

**A5.1 Structure: matches, with the ratified exceptions.** [audited] `components/case-detail/AnalysisTab.tsx:237-560` renders the case header, headline takeaway, numbered `<details>` sections 01 to 04 (open), 06 to 09 and 11 (collapsible), and the disclaimer; severity pills are local to section 04; sections 05, 10, 12 are out per the code comment at `AnalysisTab.tsx:7` (ADR-0040, P52). The wireframe's margin-annotation register exists structurally: `mo-signature` (`app/globals.css:2459`), `perf-sidebar` (`:2532`), the observation so-what right column (`:2498`), `editorial-caption` (`:2533`), `sleeve-map-cap` (`:2555`). Ratified divergences, not residual: the MMDR proportion strip instead of a pie, and the Analyst Reports tab (ADR-0047); bars-only section 06 (ADR-0048).

**A5.2 The concrete cosmetic residual.** The wireframe (decoded from its JS-string body to plain HTML for token extraction) and the app stylesheet disagree systematically, not randomly:

1. **Ground and ink temperature.** Wireframe: warm paper `#FAF8F4` (12 occurrences), warm ink ramp `#1A1A1A` / `#4A4A4A` / `#8A8A8A` / `#9A9489`, warm hairlines `#D8D2C5` / `#D3CCB7` / `#E8E4DC`. App: cool paper ramp `#FAFAF7` / `#F4F3EE` / `#F0EFEA` (`app/globals.css:14-18`), blue-grey ink ramp `#14181F` / `#3C4350` / `#6B7280` / `#9AA0A8` (`:20-24`), cool rules `#E5E3DC` / `#D4D1C8` (`:26-28`). The composed sections inherit the app tokens (`var(--color-ink-*)`, `var(--color-paper)` throughout `globals.css:2424-2575`), so the whole page sits on a measurably cooler, bluer register than the locked warm-paper wireframe. This is the single largest contributor to the "exact colours" residual.
2. **Navy accent intrusions.** The app's single accent is Ledger Blue `#1F3A5F` (`globals.css:30`). It drives the section 09 sleeve-map fills and headers (`.sleeve`, `:2546-2549`), the section 07 horizon-toggle active state (`:2573`), and info pills (`:2506`). The wireframe contains no navy anywhere; its equivalents are sage and neutral treatments (`#4A7A4F`, `#E8EDE9`, `#9AA688`).
3. **Verdict palette: already faithful.** The maintain/monitor/discuss/review quartet is hardcoded to the wireframe values `#3F5B47` / `#9AA688` / `#C28A1D` / `#B23A2D` (`globals.css:2478-2481`; performance bars `:2528-2529`). Where the v7.2 block hardcodes, it matches; where it inherits app tokens, it drifts. Two palettes coexist in one stylesheet.
4. **Type faces match, one weight is missing.** Both use Source Serif 4, Geist, Geist Mono (`app/layout.tsx:3,14,21`; `globals.css:49-51`; wireframe loads the same three families). The wireframe uses `font-weight: 300` for its large display numerals (11 instances); the app never uses a weight below 400, so every big number renders one step heavier than the locked design.
5. **Size distributions are close, not identical.** Wireframe centre of mass 10.5 to 13px with the same mono-eyebrow / serif-body pattern the app uses; the app's section titles run `22px` serif weight 400 (`globals.css:2447`) against visibly smaller wireframe section titles (vision estimate 17 to 18px at equal zoom). [hypothesis on the exact wireframe px: read visually, not extracted per-selector.]
6. **Missing verification artifact.** UX13's "verified on the painted DOM" was a text-marker verification (per the 17a6e03 commit body); no post-rebuild screenshot exists, and the screenshot folder's pre-rebuild captures are easily mistaken for the current screen (they nearly were in this audit). First step of any polish pass: capture the five composed pages, then fix to the wireframe register.

UX13's own summary ("roughly 90% fidelity, residual is spacing, sizing, font weights, exact colours") is consistent with these specifics; items 1, 2, and 4 are the named, checkable content of that residual. Per the kickoff, no aesthetic direction is proposed here and the case screen was not touched; this is the read-only gap statement for the separate single-writer thread (WA29).

---

## Part B: open decisions, options, recommendations

Per WA28 these are proposals; the picks happen at planning altitude. ADR dispositions per WA30 are collected in the next section, with numbering left as next-free-in-series per WA24.

### B1. Cross-repo private-data storage

The kickoff's premise ("all newly added investor data lands as private data, intended home is the data-snapshots repo") collides with P30's hard line: "Personally Identifiable Information (PII) cannot live in GitHub repos (public or private)" (`docs/debt/product_debt_log.md:150-153`). The collision dissolves once origin is examined (WA14's own test): the A6 to A14 cohort is **fictional**, so it carries no PII constraint at all; real client data, when it ever arrives, is governed by P30 and cannot go to GitHub in any repo. So the decision is two-tier by construction.

Options for the synthetic tier (A6 to A14 and successors):

- (a) **Extend the ADR-0027 release flow**: the data repo carries the ingestion corpus (eCAS PDFs, alt-format files, holdings JSONs, bibles) as a second release-asset family with manifest entries; this repo's `setup-data` fetches them to a gitignored `fixtures/investors-private/` (name illustrative). Pros: proven mechanics, versioned, SHA-verified, demo isolation is structural (gitignore), CI-compatible via a secret-scoped gh token. Cons: release churn per cohort; the corpus is fiction, so privacy is not actually the binding constraint, only tidiness and the statement-like-artifact optics.
- (b) **Local-only path convention** (env var, e.g. `SAMRIDDHI_PRIVATE_DATA_PATH`, or the existing symlink): zero-copy, instant iteration. Cons: this audit just documented the symlink silently corrupting the data repo working tree (A1.4); undocumented machine state, no versioning, CI cannot run it. As the only mechanism it is disqualified by demonstrated failure; as a documented dev override on top of (a) it is fine if `setup-data` is made symlink-aware (refuse or warn before writing through a link).
- (c) **Git submodule**: already considered and rejected in ADR-0027's alternatives; nothing has changed.
- (d) **Separate private package/registry**: heavier than the problem; adds infrastructure for no boundary gain over (a).

For the real tier (actual clients, someday): none of the above. P30 stands: encrypted-at-rest local or regulated-cloud storage, never GitHub; the Prisma/SQLite layer plus the PII boundary (B2) is the seam where that lands, and P30's full precondition list is the gate.

**Recommendation**: (a) plus a documented (b) override, plus an explicit two-tier ADR: fictional investor corpora are private-repo release assets (privacy by tidiness and one fetch path, not by necessity); real investor data never enters any repo and is gated on P30. Immediate hygiene regardless of pick: restore the clobbered t0, cut the v2.0.0 release, bump the pin, make `setup-data` symlink-aware.

### B2. PII sanitisation / tokenisation for future LLM reasoning

Grounding: today's prompts are built from holdings, mandates, and snapshot data for fictional people, so nothing is leaking now; the layer is being built ahead of real data, and the build-but-do-not-live-test rule (kickoff; WA12) applies. What PII will exist at ingestion, per the synthetic corpus: names, addresses, emails, mobiles, PANs, folio numbers, nominee names, bank-ish narratives in alt-format files and meeting notes (the archetype identity blocks at data repo `generators/generate_a1_a5_ingestion.py:93-130`; the alt-format emails).

Options:

- (a) **Deterministic tokenisation at the prompt boundary**: a single sanitise pass over the assembled prompt context replaces identity values with stable opaque tokens (`INV-007`, `FOLIO-3`), from a per-investor vault map held only in local storage; detokenisation happens only when rendering results locally. Deterministic, unit-testable offline (assert no vault value survives in any built prompt), reversible where the product needs continuity across agent steps.
- (b) **Redaction (strip, no tokens)**: simpler, loses cross-step referential continuity (two holdings of the same person become unlinkable in multi-call flows), and makes detokenisation impossible where the advisor-facing output must name the client.
- (c) **NER / LLM-based PII detection**: highest recall on free text, but non-deterministic, unauditable in the WA16 sense, and untestable here without API spend. Disqualified as the primary mechanism by the zero-spend gate and the platform's determinism ethos; possibly a labelled future augmentation for free-text fields.
- (d) **Structural minimisation first**: do not put identity in the prompt at all. The pipeline already reasons over portfolio shape; the investor's name is contextual garnish. Make the canonical agent-visible investor object identity-free by schema (pseudonymous id, archetype-level descriptors), so most "sanitisation" becomes a field that was never sent.

**Recommendation**: (d) as the design stance plus (a) for the residue, implemented as one choke point in the agent layer where prompt context is assembled (the same architectural position as the WA07 `stripLongDashes` sanitiser, which is the in-repo precedent for "deterministic pass, model not trusted"). Free-text surfaces (meeting notes, transcripts) get the strict treatment: tokenise known vault values, and carry a conservative pattern pass for PAN/email/phone formats. Unit tests run on the synthetic corpus (real-shaped PANs and folios, zero real PII). The untested-against-live-API state is logged as debt at landing (next free in series, P or T per the log convention) with the explicit note that validation is gated on a WA12-approved budget.

### B3. Any-file-format ingestion architecture

What "any file" means concretely, from the corpus: eCAS PDFs (two registrar styles), four spreadsheet textures, columnar and free-form text dumps, email prose, meeting notes; plus formats not yet in the corpus (CAS from depositories, broker contract notes, scans). Today: nothing parses anything (A3); the interim sketch is the reconciliation-gate prose in ADR-0048.

Options:

- (a) **Deterministic per-format adapters into one canonical envelope**: pdf table extraction, xlsx reader, text heuristics; each adapter emits the canonical parsed shape with per-field provenance (file, page/cell); a strict reconciliation gate (totals tie to stated AUM, units times NAV ties to stated values where both exist, names resolve against the snapshot universe via the shared alias map from A1.6) sits between parse and store; failures surface to the human, never auto-pass. Pros: auditable, offline-testable against the corpus, consistent with WA16 and with the gate that already proved itself by catching the NAV-basis break. Cons: per-format engineering; free-form email prose will defeat deterministic parsing in places.
- (b) **LLM-first extraction** ("throw the file at the model with a schema"): maximal format coverage, minimal upfront engineering. Cons here and now: untestable without spend (WA12); non-deterministic in a pipeline whose differentiator is auditability; and the killer interaction: ingestion happens **before** sanitisation can exist for that document, so LLM-first ingestion of real files would ship raw PII to the API, violating the B2 boundary by construction.
- (c) **Deterministic-first, LLM-assist as a labelled, gated fallback**: (a) is the spine; documents or regions the adapters cannot parse are queued for an explicitly labelled LLM-assisted extraction that runs only post-B2-sanitisation and under WA12 approval, with its output forced through the same reconciliation gate.

**Recommendation**: (c). The reconciliation gate is the non-negotiable centre regardless of parser; it is what makes "parses correctly" a checkable claim instead of a vibe. The canonical ingested shape should be the transaction-bearing one (B5), not the value/weight summary.

### B4. Onboarding screen design direction (WA15: the design artifact lands before the capability)

Grounding: P6 records that an investor onboarding workflow was designed in the Slice 4.7 wireframes with the build deferred; the surviving design-system artifacts (`04 - Samriddhi AI Lean MVP Design - 12 May 2026/screens/`, the May design bundles) carry the app chrome, an Investors screen, and a new-case screen, but I could not locate a dedicated onboarding/import wireframe in the design folders [hypothesis: it may exist in planner-side artifacts I cannot see; if so it should be pulled into the lineage, else authored fresh]. The app already has the receiving surfaces: an Investors tab in the chrome and an `onboardingTranscript` column waiting in the schema.

Proposed direction (to be landed as a wireframe artifact, in the established standalone-HTML wireframe medium, before any build):

1. **Intake**: an "Add investor" flow on the Investors surface; a drop zone that takes any mix of files (eCAS PDF, spreadsheet, text, pasted email) plus optional meeting-notes text into the transcript field; nothing auto-commits.
2. **Reconciliation workbench** (the heart, and the honest-state surface): parsed holdings in a table, each cell carrying its provenance chip (file and page/cell); an unresolved-names queue with did-you-mean candidates from the snapshot universe (the WA26 check running inline at curation time, not after); totals tie-out against stated AUM; sub-category assignment validated against the foundation taxonomy; per-field parse-confidence shown, advisor confirms rather than the system silently accepting (WA28's spirit applied to the product surface).
3. **Commit**: writes to the private store (per B1 tier), locks the persona only at WA26 exit 0 (or with an explicitly recorded accepted mismatch), then offers mandate capture as the next step.

Register: the existing paper-and-ink design system; the workbench is information-dense, mono-figures, serif headings, consistent with the v7.2 page rather than a wizard aesthetic. Recommendation: I author this wireframe as the package's first design deliverable in the next pass, against the A1-to-A14 corpus as specimen content; the build follows only after the wireframe is ratified (WA15), and the screens ship against synthetic investors only until P30 clears.

### B5. Transaction-data-shape stance

The question: must new private investor data conform to the demo five's exact `StructuredHoldings` shape as a frozen contract, or may the canonical shape evolve with the five migrated later?

- (a) **Fixed contract**: new investors flatten to `{instrument, assetClass, subCategory, valueCr, weightPct}`. Consequence: the ingestion layer would deliberately discard `quantity`, cost basis, dates, and folio identity that the corpus supplies and that the section 06 net line and P51 need; the performance line then stays undrawable for newly onboarded investors too, and a second migration is guaranteed later.
- (b) **Canonical shape evolves; the five stay frozen as a derived view**: the canonical store becomes transaction-bearing (per holding: instrument identity including the resolved snapshot id, units, dated lots or transactions, cost basis, vehicle attributes; essentially the `holdings_a1_a5.json` row schema plus a transaction list), and `StructuredHoldings` becomes a deterministic derivation from it. The five demo investors keep their hand-authored fixtures untouched; optionally their canonical layer is backfilled later from `holdings_a1_a5.json` and the regenerated eCAS, under the invariant that the derived `StructuredHoldings` stays byte-identical (cheaply verifiable), so no case re-fire and no demo drift.
- Consequences either way: (a) protects nothing real (the freeze is honoured in (b) by the byte-identity invariant) and costs the package its first concrete deliverable; (b) costs a derivation layer and a schema to maintain, and is the only option under which P50/P51/D14 are actually fixable end to end.

**Recommendation**: (b), stated with the invariant. The agents keep reading the derived shape unchanged; nothing in the pipeline is touched by the canonical layer's existence.

---

## ADR disposition (WA30)

Read against the full `docs/decisions/` index (0001 to 0048) and the data repo's 0001 to 0002:

| Decision this package forces | Disposition | Notes |
|---|---|---|
| Two-tier investor-data storage (fictional corpora via private-repo releases; real data never in GitHub, P30-gated) | **Net-new ADR, next free in series** | Cites and extends ADR-0027 and data repo ADR-0001; does not supersede them (the snapshot flow is unchanged) |
| PII boundary at prompt assembly (minimise plus deterministic tokenisation; offline tests; live validation deferred under WA12) | **Net-new ADR, next free in series** | Cites WA14, P30; precedent `stripLongDashes` (WA07) |
| Ingestion architecture (deterministic adapters, canonical envelope, reconciliation gate as spine, gated LLM-assist fallback) | **Net-new ADR, next free in series** | ADR-0048 already records the interim gate design as superseded-eligible ("a production onboarding pipeline may supersede the interim parse approach"); the new ADR cites it as provenance rather than superseding a numbered decision |
| Canonical transaction-bearing investor shape with derived `StructuredHoldings` and the byte-identity freeze invariant | **Net-new ADR, next free in series** | Resolves P51; cites D3, ADR-0048 |
| eCAS re-anchor to the real `monthly_nav` basis (terminal-basis ruling, shared alias map, regeneration) | **Already covered in substance** by data repo ADR-0002 plus D14/P50 (the fix is the recorded one); if the terminal-basis ruling lands as written here it is an **amend** to data repo ADR-0002's limitation section, not a new consumer-side ADR |
| Data-version hygiene (cut v2.0.0 release, bump pin, restore working tree, symlink-aware setup-data) | **Already covered** operationally by ADR-0027 and ADR-0042 mechanics; no new ADR unless the symlink is formalised as a supported mode, which would **amend ADR-0027** |
| Onboarding screen design | No ADR; WA15 design-artifact lane |
| Chart/render conventions for any new screens | **Already covered**: ADR-0045, ADR-0047 |

No supersedes dispositions are proposed; nothing here reverses a numbered decision. The four net-new ADRs are written at build kickoff, not in this read-only pass; numbering resolves at landing per WA24.

---

## Re-scope surfaces (WA28): the necessary over the planned

- **RS1. The package's first task is actually version hygiene, not the re-anchor.** The stale pin (`data-version.txt` at v1.0.0-frozen), the uncut v2.0.0 release, and the clobbered data repo working tree (A1.4) mean any reconciliation, regeneration, or coverage measurement run today executes against the wrong universe, which is precisely how D14's 9-to-35% figures came to be. Sequencing: restore, release, repin, then re-anchor.
- **RS2. The 70% floor needs a class-coverage ruling before the P50/D14 task can be scoped "done".** Re-anchoring alone restores the line for Surana only (A1.7). Whether FDs (contractual accrual: real data exists), tax-free bonds (sleeve-level proxy), gold (index series), and the GIFT ETF (SPXT plus FX) count as honest coverage is a product decision that determines whether Iyengar and Malhotra ever get the line.
- **RS3. The PII-versus-GitHub tension in the kickoff resolves into the two-tier ruling (B1)** and needs an explicit pick, because "intended home is the data-snapshots repo" is only true for the fictional tier.
- **RS4. The A6-to-A14 cohort reframes the build.** Onboarding can be built, exercised, and demoed end to end against the existing synthetic corpus (8 eCAS PDFs, 14 alt-format files, bibles, meeting notes) with zero PII risk and zero spend, with WA26 gating each persona lock. Real-data onboarding remains P30-gated and is not needed to ship this package.
- **RS5. Registry corrections to make at landing (WA21; not written in this read-only pass):** D14's mismatch magnitude is stale-pin-derived and its ICICI Balanced Advantage claim does not reproduce (A1.2, A1.5); P51's path names a file that does not exist (A3); UX13's screenshot folder contains only pre-rebuild captures (A5); the package README's "eCAS NAVs sourced from the t0 baseline" overclaims (A1.1).

## Debt candidates to log at landing (WA05, WA08, WA24: numbered against the live logs then)

1. PII sanitisation validated offline only; live-prompt validation deliberately deferred, gated on WA12 budget approval (the kickoff's build-not-live-test rule, made durable).
2. `setup-data` writes through symlinks; make it symlink-aware and document the dev override (A1.4 root cause).
3. `build_holdings_extended.py` and the clean universe input are not part of the committed data-repo apparatus (A2).
4. The registry corrections in RS5.
5. Post-rebuild composed-page screenshots do not exist; capture as polish-pass step 1 (A5.2 item 6).

## Questions for the primary (WA17; the turn ends after this audit lands)

1. B1 pick: two-tier storage as recommended, or a different arrangement?
2. B2 pick: minimise-plus-tokenise at the prompt boundary, or an alternative?
3. B3 pick: deterministic-first with gated LLM fallback, or stricter/looser?
4. B4: confirm the onboarding design direction and whether I author the wireframe as the next deliverable (WA15).
5. B5 pick: evolving canonical shape with the byte-identity freeze invariant, or fixed contract?
6. RS1: authorize the version-hygiene sequence (data repo working-tree restore, v2.0.0 release cut, pin bump) as the package's step 0; the restore and release are writes in the data repo, outside this audit's write scope.
7. RS2: rule the class-coverage policy for the 70% floor (FD accrual, bond proxy, gold index, intl ETF), or defer the line for the non-Surana cases.
8. A1.6 item 2: terminal basis for the re-anchor (series-grid basis with exact tie, or static-NAV basis with a stated tolerance).

## Evidence index (paths per WA27; external artifacts labelled)

- This repo: `data-version.txt:1`; `scripts/setup-data.ts:100-126,150-180`; `.gitignore:65-88`; `lib/agents/snapshot-loader.ts:26,207-252`; `app/cases/[id]/page.tsx:47`; `db/fixtures/structured-holdings.ts:1-18,56-62,80-212`; `db/seed.ts:352,397,441-451`; `prisma/schema.prisma:10-120`; `package.json` (dependencies); `components/case-detail/AnalysisTab.tsx:7,73-92,237-560`; `app/globals.css:14-51,2424-2575`; `app/layout.tsx:3-21`; `docs/audits/2026-06-09_section06_performance_line_data.md`; `docs/decisions/0027,0042,0045,0047,0048`; `docs/debt/data_debt_log.md` (D3, D14), `docs/debt/product_debt_log.md` (P6, P30, P50, P51, P52), `docs/debt/ui_ux_debt_log.md` (UX13), `docs/debt/tech_debt_log.md` (T4, T13).
- Data repo (`ArthaSamriddhiAI/Samriddhi-AI-Data-Snapshots`, local clone): `manifest.json:2,77`; `generators/generate_ecas.py:154-326,471-530,859-886`; `generators/generate_a1_a5_ingestion.py:22-51,186-250,479-490`; `generators/generate_altformat.py:17-18`; `generators/generate_snapshots.py:21`; `generators/METHODOLOGY.md:14,43-51`; `docs/decisions/0001,0002`; `docs/debt/DATA_DEBT_LOG.md` (DM1, DM2); git evidence: tag list, blob hashes for the t0 clobber, `git show HEAD|v1.0.0-frozen:snapshots/snapshot_t0_q2_2026.json` field reads.
- External (read-only, never committed): `23 - Lean Samriddhi MVP/14 - Factual Foundation Continued/` (README.md:1-80, holdings_a1_a5.json: 41 rows, field schema, FD `vehicle_specific_attributes`; ecas_01/02/05 PDFs; altformat 01 to 05; meeting notes); `23 - Lean Samriddhi MVP/08 - Factual Foundation Continued/Investor Archetypes For Testing/` (A6 to A14 bibles, holdings_extended.json, 5 eCAS PDFs, 9 alt-format files, `build_holdings_extended.py`, byte-identical generator copies); `21 - Team Inputs/02 - 1 May 2026/Kush Goyal/Final Merged JSON/SamriddhiAI_data_clean.json` (the clean universe input); the v7.2 wireframe standalone HTML (decoded for token extraction) and the render bundle screenshot set (13 pre-rebuild viewports, 1 full-page wireframe capture at 2940x27516).
