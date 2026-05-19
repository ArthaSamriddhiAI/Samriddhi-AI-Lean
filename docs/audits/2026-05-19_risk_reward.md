# Risk-Reward Statistics: Workstream Audit

**Date:** 2026-05-19
**Branch:** `features/risk-reward-stats` (cut from `main` at `596f732`)
**Workstream:** Risk-Reward Statistics (second Capability Phase workstream, after A2)
**Status of this document:** Step 0 and Step 1 findings recorded. Design decisions, surfaced-conflict resolutions, and execution calibrations are appended at Step 7 (per the Capability Phase audit-doc convention; WA11 dual-write companion is `docs/workstreams/risk_reward_handoff.md`, authored at Step 7).

This is the institutional-memory record for the workstream. It records what the codebase actually is, measured against the architectural ground truth asserted in the CC prompt, with divergences surfaced as questions for Hard Checkpoint 1.

---

## 1. Step 0: loader consolidation (completed)

`lib/agents/snapshot-loader.ts:20` `SNAPSHOTS_DIR` was repointed from `fixtures/snapshots/` to `fixtures/snapshots/enriched/` (one line; enriched filenames match source so `loadSnapshot` path construction is unchanged). `Snapshot`, `MutualFundRow`, `SnapshotMetadata` were extended with optional enriched fields plus a new `TierBStats` type and `Nifty500Company`/`Nifty500`/`SnapshotIndexSeries`/`SnapshotFxSeries` helper types. All additive; index signatures retained.

Verification: `tsc --noEmit` clean across all loader consumers; `scripts/_verify-loader-enriched.ts` (new, 11 assertions) and the pre-existing `scripts/_verify-snapshot-enrichment.ts` (regime-narrative contract, 23 probes) both pass. Decision recorded in `docs/decisions/0013_risk_reward_loader_consolidation.md`. Commit `34327d5`, pushed.

The source directory `fixtures/snapshots/` is retained as a rollback path; deletion is sequenced to Step 6 after data review.

---

## 2. Architectural ground-truth assertions: confirm or contradict

The CC prompt's "Architectural ground truth" section makes eight assertions. Audit result per assertion:

| # | Assertion | Result | Evidence |
|---|---|---|---|
| 1 | Enriched snapshots not yet wired into runtime; loader-dir consolidation is the first action | **Confirmed** | `snapshot-loader.ts:20` read source pre-Step-0; only `_verify-snapshot-enrichment.ts` consumed enriched. Now resolved. |
| 2 | `tier_b_stats` canonical; source flat scalars opaque; `rolling_metrics` not mixed | **Confirmed** | Fund rows carry source flat `Sharpe`, `Sortino`, `Beta`, `Volatility`, `VaR (H)`, `VaR (I)` and a separate `rolling_metrics` block and a separate `tier_b_stats` block. Three distinct stat surfaces, exactly as ADR-0012 and the enrichment handoff describe. |
| 3 | RF = 5.25%; Tier C reads it from `snapshot_metadata.enrichment_*` provenance, not hardcoded | **CONTRADICTED (D2)** | No risk-free field exists anywhere in `snapshot_metadata`. RF is `RISK_FREE_ANN = 0.0525` hardcoded at `scripts/enrich_snapshots.py:133` and documented in ADR-0012. See divergence D2. |
| 4 | `tier_b_stats` horizon coverage asymmetric (vol/Sharpe/Sortino/maxDD 3Y+5Y; beta/R2/TE/IR/Calmar 3Y only) | **Confirmed** | Observed field set on both fund and stock `tier_b_stats`: `vol_3y_annualized`, `vol_5y_annualized`, `sharpe_3y`, `sharpe_5y`, `sortino_3y`, `sortino_5y`, `max_drawdown_3y`, `max_drawdown_5y`, `calmar_3y`, `beta_3y`, `r_squared_3y`, `tracking_error_3y`, `information_ratio_3y`. |
| 5 | ~86.6% of funds lack source `Benchmark Index`; their beta/R2/TE/IR are `None`; the 13.4% with a source string are populated | **PARTIALLY CONTRADICTED (D1)** | The 86.6%/238-of-1773 split is exact (confirmed). But `beta_3y` is `null` for **all 1773 funds, including all 238 with a source `Benchmark Index` string**: enrichment computed zero fund benchmark-relative metrics. See divergence D1. |
| 6 | Risk-reward-stats is a sibling agent alongside `portfolio-risk-analytics.ts`, feeding Dimension 4 of the cluster-7 interpretive skill | **Confirmed** | `portfolio-risk-analytics.ts` is the deterministic feeder (`computeMetrics`); `agents/m0_portfolio_risk_analytics.md` is the provisional cluster-7 interpretive skill whose Dimension 4 declares risk-adjusted/benchmark-relative inputs as `data_unavailable_in_cluster_6`. Sibling placement is sound. |
| 7 | ADR-by-filename; new ADRs start at 0013 | **Confirmed** | `docs/decisions/` holds `0001`..`0012`; internal titles diverge from filenames (`0007_*` is "ADR-1", `0012_*` is "ADR-6"). ADR 0013 created with filename-aligned internal title to stop perpetuating the drift. |
| 8 | Cluster-3 source-data findings out of scope | **Confirmed** | Enumerated in section 6; `PRODUCT_DEBT_LOG.md` D6 already tracks the Kotak Emerging Equity mislabel. Referenced only, not absorbed. |

---

## 3. The 16 canonical indices (`index_id` values)

Read from `snapshot_t0_q2_2026.json` `indices` (a dict; each entry has `name`, `category`, `synthesis_method`, `monthly_values`, `metadata`):

`nifty_50_tri`, `nifty_next_50_tri`, `nifty_100_tri`, `nifty_midcap_150_tri`, `nifty_smallcap_250_tri`, `nifty_500_tri`, `bse_sensex_tri`, `nifty_bank_tri`, `nifty_it_tri`, `crisil_composite_bond`, `crisil_short_term_bond`, `crisil_dynamic_gilt`, `nifty_10y_gsec`, `crisil_liquid`, `gold_inr`, `sp_500_tri_inr`.

`fx` is a dict: `usd_inr` populated; `eur_inr`, `gbp_inr`, `aed_inr` reserved as `null` (confirms the enrichment handoff and Trade-off 7 of the thesis).

---

## 4. Sleeve-to-index current state

**Stocks (mapped, in `tier_b_stats._meta`):** every Nifty 500 company carries `_meta: { sector, cap_tier, benchmark_index_id }`. Mapping logic is in `scripts/enrich_snapshots.py` `_resolve_bench_id` (banking to `nifty_bank_tri`, IT to `nifty_it_tri`, large to `nifty_50_tri`, mid to `nifty_midcap_150_tri`, small to `nifty_smallcap_250_tri`). Sample: Reliance Industries -> `{ sector: petroleum_refining, cap_tier: large, benchmark_index_id: nifty_50_tri }`, beta_3y 1.8087.

**Funds (unmapped):** fund `tier_b_stats` has **no `_meta` block** and no `benchmark_index_id`. `beta_3y`/`r_squared_3y`/`tracking_error_3y`/`information_ratio_3y` are `null` for every fund. This is the gap `benchmark_resolution` fills (workstream scope). The `benchmark_resolution` design must extend the stock cap-tier -> index logic to fund sub-categories, source-string-first where the 238 funds carry a `Benchmark Index` string.

**Sleeve definition for Tier C aggregation:** `Holding.assetClass` in {Equity, Debt, Alternatives, Cash} is the sleeve partition. `portfolio-risk-analytics.ts` already partitions on `assetClass` and on `BUCKET_BY_SUBCATEGORY`; `isPMS`/`isAIF`/`isMF` are `subCategory`-prefix tests. Reuse these, do not redefine (prompt Step 2.5).

---

## 5. Coverage statistics (t0 snapshot)

`mf_funds` count: **1773**. Source `Benchmark Index` non-empty: **238 (13.4%)**; empty: **1535 (86.6%)**. Source `Benchmark Return 1Y/3Y/5Y`: 0/1773 (100% empty; a dead source field, do not consume).

MF `tier_b_stats`: present on all 1773; `data_window_insufficient` sentinel on **203** (reason example: `fewer_than_12_months`); `sharpe_3y` non-null on **1568**; `beta_3y` non-null on **0**.

Nifty 500: **500** companies; every company has `tier_b_stats` with populated benchmark-relative metrics and `_meta`.

Sentinel shape (ADR-0012): `{ "data_window_insufficient": true, "reason": "..." }` replaces the metric fields. Consumers must check this before reading any metric.

---

## 6. Cluster-3 reference list (reference only; do not absorb; tracked elsewhere)

1. Missing MFs in the source universe: Axis Bluechip Fund, HDFC Index Fund Nifty 50 Plan, Kotak Emerging Equity (the last is `PRODUCT_DEBT_LOG.md` D6, mislabelled overseas FoF). Affects Malhotra, Surana, Sharma-S2, Iyengar archetypes via holdings labels; the canonical Bhatt (Shailesh) case does not reference Kotak Emerging Equity.
2. Broken `market_cap_rs_cr`: roughly 5 stocks above 1.5M Cr, roughly 19 at zero; all default to small cap-tier, so their `tier_b_stats._meta.benchmark_index_id` is `nifty_smallcap_250_tri` by construction (benchmark wrong for those names).
3. SBI escaped the bank shock: substring bank detection missed "SBI"; source SBI t5 went +10% instead of designed -18%; the monthly extension and pre-computed `tier_b_stats` inherit the noise. Use sector aggregates via `tier_b_stats._meta.sector in {banks_psu, banks_private}`, not name detection.
4. Source flat risk scalars (`Sharpe`, `Sortino`, `Beta`, `Volatility`, `VaR (H)`, `VaR (I)`) use undocumented methodology; opaque; never consume.

`PRODUCT_DEBT_LOG.md` D7 is the precedent for fixture backfill: the frozen S2 fixtures contain pre-existing long-dash glyphs in Slice 2/3 S1 prose; the A2 backfill was strictly additive (N added, 1 removed, zero added long dashes) and did not rewrite frozen prose. Risk-reward backfill follows the same discipline (additive `risk_reward_stats` key only).

---

## 7. Divergences surfaced as questions for Hard Checkpoint 1

Per the CC prompt ("If the audit contradicts an architectural ground-truth assertion in this prompt, stop and surface before proceeding"), the following are surfaced. None block Step 0 (already complete and independent of all of them). D1 and D2 are direct ground-truth contradictions and need a product-owner decision before Step 3 computation code.

**D1 (scope-shaping; ground-truth assertion 5 contradicted).** Fund `beta_3y`/`r_squared_3y`/`tracking_error_3y`/`information_ratio_3y` are `null` for all 1773 funds, including all 238 that carry a source `Benchmark Index` string. The enrichment computed no fund benchmark-relative metrics at all. Consequences: (a) the prompt's Step 3.3 concern about "not overwriting existing populated fund slots" and "surface discrepancy if recompute disagrees with the 238" is moot, there are zero populated fund slots; (b) `benchmark_resolution` scope is cleanly "fill all resolvable funds, no overwrite risk"; (c) the 238 source strings are still useful as the source-string-first input to resolution, just not pre-computed. Proposed handling: proceed exactly as the thesis Trade-off 4 intends (build resolution, recompute the four metrics for all resolvable funds), and drop the no-overwrite caveat as unnecessary. Question for the owner: confirm this reading.

**D2 (ground-truth assertion 3 contradicted).** No risk-free field exists in `snapshot_metadata`. RF is hardcoded `RISK_FREE_ANN = 0.0525` at `scripts/enrich_snapshots.py:133` and documented in ADR-0012 (5.25% repo rate at t0). Tier C "reads RF from provenance" is not satisfiable. Proposed handling: Tier C sources the documented `0.0525` as a single named constant in `risk-reward-stats.ts` with an explicit ADR-0012 cross-reference comment; do not read from provenance (absent), do not add an rf field or configurability (prompt says RF configurability is product debt, do not add it). Question for the owner: confirm sourcing the documented ADR-0012 constant rather than provenance, and that adding an rf provenance field is explicitly out of scope (logged as P-series debt instead).

**D3 (plumbing detail; thesis/prompt imply a flag that does not exist).** No `is_synthetic_forward` field exists in `snapshot_metadata`. t0 has `evolution_type: "baseline"`, `days_elapsed_since_t0: 0`; t1 has `evolution_type: "quiet"`, `days_elapsed_since_t0: 90`. Proposed derivation: `is_synthetic_forward = snapshot_metadata.evolution_type !== "baseline"` (equivalently `snapshot_id !== "t0_q2_2026"`). Risk-reward owns deriving and plumbing this end-to-end. Question for the owner: confirm the derivation rule.

**D4 (referenced authority absent).** `SNAPSHOT_TEST_AXIS_DESIGN.md` is referenced by the CC prompt (Step 2.9, Checkpoint 2) and by `scripts/_verify-snapshot-enrichment.ts:4`, but does not exist in the repo. The regime narrative is actually encoded in `scripts/_verify-snapshot-enrichment.ts` probes 1 to 5 (the executable contract: RIL +7.2% t2->t3, +14.3% t4->t5, -28% t5->t6, +16.2% t7->t8; RIL idio -26% in 2027-10 at t6; HDFC Bank shock -16% in 2027-07 at t5; gilt rate-cut +4.5% Nov->Dec 2026 at t3; smallcap rally +7% Feb->Mar 2028 at t8) and in `docs/decisions/0008_snapshot_stock_synthesis_and_narrative_beats.md` and `docs/SnapshotEnrichment_Thesis.md`. Proposed handling: the Step 2.9 regime-validation tests source the narrative from `_verify-snapshot-enrichment.ts` plus ADR-0008. Question for the owner: confirm this substitution; note the SBI wrinkle (cluster-3 finding 3) for any SBI-prominent archetype.

**D5 (naming and frozen-artefact note).** "Shailesh" (canonical S2 in prompt Step 4 and thesis) is the Bhatt investor: fixture `db/fixtures/cases/c-2026-05-14-bhatt-01.json` (`workflow: s2`, `snapshotId: t0_q2_2026`), holdings `BHATT_HOLDINGS` in `db/fixtures/structured-holdings.ts`, plus `lib/fixtures/shailesh-bhatt-case.ts`. The frozen `c-2026-05-14-bhatt-01.json` uses pre-cleanup instrument labels (Motilal Oswal Value Strategy PMS, Aditya Birla Arbitrage Fund) while `BHATT_HOLDINGS` uses corrected labels (Motilal Oswal Value Migration PMS, HDFC Arbitrage Fund). Backfill must respect frozen-artefact semantics (additive key only, per D7). Not a blocker; a backfill-correctness note.

**D6 (trivial path correction).** Prompt Step 1 names `db/fixtures/holdings.json` and `db/fixtures/holdings_extended.json`; these do not exist. Holdings live in `db/fixtures/structured-holdings.ts` (`HOLDINGS_BY_INVESTOR`, the typed source of truth) and are serialised into `Investor.holdingsJson` at seed time. The audit used the actual source. No decision needed.

---

## 8. Capability Phase shape reference (informs the design proposal)

A2 (`agents/a2_classification.md` plus `lib/agents/a2-classification.ts`) is the template risk-reward mirrors:

- **Skill file:** YAML frontmatter (`agent_id`, `skill_md_version`, `draft_version`, `llm_model`, `max_tokens`, `temperature`, `output_schema_ref`, `source_files`) then Role, When Activated, Two-Layer Operation, domain rubric, Inputs Consumed, Output Schema (JSON), Discipline, Worked Example, Edge Cases, Open Questions for Codebase Audit, Deferred to Capability Surfaces Design, Anti-Patterns, Source line.
- **Implementation:** exported TS output contract; Layer 1 pure deterministic; Layer 2 one `callAgent` call via `./harness` (`callAgent({ skillId, userPrompt, validate })` returns `{ output, usage }`); Layer 2 cannot change Layer 1; `stripLongDashes` (exported from `a2-classification.ts`, declared via `\u` escapes so the source contains no long-dash glyph) applied to every persisted string; orchestrator returns `{ output, usage }`.
- **Pipeline:** `runDiagnosticPipeline` in `pipeline.ts` calls the agent and persists its output as a new `content.<agent>` key (`content.a2_classification`); the S2 renderer reads only `briefing` and never touches the key (WA9). `router.ts` `ApplicabilityVector` carries a per-agent boolean (`portfolioRiskAnalytics`, always true on diagnostic and proposed_action).
- **Reuse, do not redefine:** `stripLongDashes` and the threshold constants are imported from sibling modules; risk-reward imports `stripLongDashes` and any needed partitioning helpers rather than re-implementing.

The risk-reward agent shape, output type, pipeline placement, and router gate are proposed in the Hard Checkpoint 1 design deliverable, anchored to this template.

---

## 9. Step 3 ruling: benchmark_resolution empirical correction

Thesis Trade-off 4 framed fund benchmark resolution as "~86.6% (1,535) resolve via cap-tier fallback into the 16-index set." The prototype resolver over all 1,773 funds shows this is empirically false. The resolvable universe is roughly 44%; roughly 44% track non-canonical indices (smart-beta, sector ex Bank/IT, target-maturity debt, non-US international, multi-asset/dynamic-allocation/retirement blends); the remainder are history-sentinelled. This is the actual structure of the 2026 Indian MF universe, not a workstream failure. Logged as `PRODUCT_DEBT_LOG.md` DD3.

Per the Step 3 ruling the previously-single `benchmark_resolution_pending` sentinel is partitioned into two:

- **`benchmark_structurally_inapplicable`**: the fund's design resists single-index comparison (multi-asset, dynamic asset allocation, retirement glide-path, conservative hybrid, children's, equity savings, BAF, multi-asset FoF). A single Sharpe-vs-benchmark line is the wrong measurement, not a deferred one. Methodology (composite benchmarks, multi-comparator views, fund-is-its-own-benchmark) is model-portfolio workstream territory.
- **`benchmark_not_in_snapshot`**: a reasonable comparator exists in the real world but is not in the canonical 16 (smart-beta, sector ex Bank/IT, target-maturity debt, non-US international, commodity ex-gold). Methodology (expand the canonical set) is snapshot-data-extension territory. Genuinely ambiguous funds default here (the conservative classification: the index may exist, we just lack it).

Rulings A (two-sentinel partition), B (tracked-index detector pulls in-16 trackers to clean resolution), C (broad-equity and debt defensible-defaults; Long Duration to `nifty_10y_gsec`), D (Large Cap to `nifty_50_tri`; Gilt to `crisil_dynamic_gilt` with the 10-year-constant variant to `nifty_10y_gsec`; Arbitrage to `crisil_liquid`; US-large international to `sp_500_tri_inr`, non-US to `benchmark_not_in_snapshot`) are carried into ADR-0014. WA12 (explicit API-call gate) was adopted at this ruling. A pre-recompute 10-fund sample sub-checkpoint precedes the full recompute write-back.

*Design decisions, alternatives considered, surfaced-conflict resolutions, and execution calibrations are appended to this document at Step 7, after Hard Checkpoint 1 approval and execution.*
