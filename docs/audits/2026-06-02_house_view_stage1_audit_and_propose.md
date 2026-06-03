# House view (T-5.04 / Slice 4.6e), Stage 1 of 2: audit and propose

**Date:** 2026-06-02
**Branch:** `features/house-view` (code repo). Audit-and-propose stage; no capability code, no agent run, no content generation, no fixtures, no PR. The writes this stage lands are this audit doc and two debt entries (D13, T22); the draft schema is left uncommitted for the gate. WA22 (versioned `docs/audits/` deliverable), WA21 (verify against the live registry, quote-as-evidence), WA23 (conventions by reference), WA24 (numbering at landing), WA28 (product-shape stop-and-propose), WA07 (no long dashes), WA09 (capability ships data), WA13 (full product-mode names).

This is the Stage 1 deliverable for the house view capability. It audits the Sync-1 design proposal against the live repo, proposes the output schema, sets the per-snapshot variation policy, assigns ADR dispositions, and scopes Stage 2 with a WA12 estimate. It builds nothing. Stage 2 is a separate prompt fired only after the primary's explicit go-ahead.

**Annotation legend (WA22):** [AUDITED] = grep-confirmed against the live repo this stage, with the read site quoted. [HYPOTHESIS] = asserted by the inbound prompt or the Sync-1 proposal and not confirmable in-repo; flagged, not built on.

---

## Section 0, registry and code grounding

### 0.1 ADR index [AUDITED]

Highest ADR on disk is **ADR-0042** (`docs/decisions/0042_real_data_t0_restoration_reverses_adr_0014.md`); the series is contiguous 0001 to 0042. The ADRs this design touches, confirmed by title:

- ADR-0011 `0011_snapshot_schema_placement_and_lookback.md:1`, "Schema Placement and Lookback Horizon"; decision at `:33` "Schema placement: additive sub-fields, two new top-level blocks". This is the additive-placement precedent house view inherits.
- ADR-0019 `0019_sentinel_taxonomy_and_do_not_mix.md:1`, "Sentinel taxonomy and the three-way do-not-mix rule". The shared sentinel taxonomy.
- ADR-0021 `0021_sibling_agent_placement.md:1`, "Risk-reward-stats sibling-agent placement and pipeline integration". The S1-bypass precedent.
- ADR-0028 `0028_time_series_performance_sibling.md:1`, "Time-series-performance sibling placement and pair-aware snapshot loader".
- ADR-0029 `0029_time_series_into_s1_stitcher.md:1`, "Time-series-performance threaded into S1 (Option II stitcher-contract change)". The thread-into-S1 precedent.
- ADR-0030 `0030_portfolio_overlap_sibling.md`, the portfolio-overlap sibling (bypass, fed to A3).
- ADR-0031 `0031_a3_so_what_advisor_action_agent.md`, the A3 So-What agent that already owns client-level actions (the firm-versus-client boundary rationale).
- ADR-0033 `0033_sub_sleeve_tilt_foundation_slice.md:1`, "Sub-sleeve allocation framework, the model-portfolio foundation slice"; `:17` "splits keyed by risk tier ... with a never-zero core". This is the existing structural "house view" allocation tilt (Section 1).

### 0.2 Debt series, live next-free labels [AUDITED]

From `docs/debt/README.md:7-18` (series to file map) and the tail of each log:

| Series | File | Highest | Next-free |
|---|---|---|---|
| P (product) | `product_debt_log.md` | P49 (`:54`) | P50 (note: P30 is a gap, unused) |
| T (tech) | `tech_debt_log.md` | T21 (`:27`) | T22 |
| D (data) | `data_debt_log.md` | D12 (`:18`) | D13 |
| X (design) | `design_debt_log.md` | X6 | X7 |
| DD (production data) | `production_data_debt_log.md` | DD3 | DD4 |
| O (operational) | `operational_debt_log.md` | O5 | O6 |
| UX (render) | `ui_ux_debt_log.md` | UX10 | UX11 |
| ET (enterprise) | `enterprise_readiness_debt_log.md` | ET8 | ET9 |
| DM (data mirror) | private repo, no local file (`README.md:18`) | n/a | n/a |

This stage writes **D13** (frozen-indicator data debt, Section 3) and **T22** (E3 schema artifact gap, below). `combined_debt_log_archive.md` is a frozen archive (`:1` "do not add new entries here") and does not bear on next-free labels.

**E3-declared-but-absent schema, logged status [AUDITED]:** NOT logged in any debt log. A search of all of `docs/debt/` for `e3_macro_output`, `output_schema_ref`, and "declared but absent" returns nothing. The inbound prompt and the prior E3 audit referred to it provisionally as a "D-series" item; that is incorrect. It is an engineering/audit-trail hygiene gap, so it belongs in the **T-series** (`README.md:9`, T is "Technical debt about the codebase or the engineering / audit-trail process itself"), at the live next-free label **T22**. Logged accordingly this stage.

### 0.3 PR history and T-5.16 [AUDITED, with a correction]

T-5.16 has shipped, under **PR #14** (merged 2026-06-02), per `docs/audits/2026-06-02_t516_scope_pr14.md:10` ("T-5.16 is fully delivered in SCOPE") and the landed commit subject `7907a0e` "T-5.14 + T-5.16: client-weighted (World A) benchmark, real-data t0 restoration, whole-book look-through (#14)". So Sync-1 decision 6 holds: T-5.16 is live and house view's market-structure grounding can lean on it.

Two corrections to the way decision 6 names it. First, the repo's canonical phrasing is **"whole-book look-through"**, not "stock and sector look-through"; the two parts are a per-stock true-weight roll-up across direct, MF, and PMS (Part 1) and a whole-book sector look-through including direct and PMS (Part 2), per the scope audit `:14,:23`. The Sync-1 phrasing is functionally accurate but should adopt the repo's wording. Second, T-5.16 must not be conflated with **T-5.14** (the client-weighted World A benchmark), a separate task that co-landed in PR #14; PR #14's title names only T-5.14, and the audit `:48` notes the body under-specified T-5.16. House view stays firm-level and does not consume the client-weighted benchmark.

### 0.4 Working agreements, with two phantom citations flagged [AUDITED]

The registry on disk is **WA01 through WA28** (README table last row `WA28_product_shape_stop_and_propose.md:38`; confirmed by `git ls-files docs/working_agreements/`, which lists WA01 to WA28 plus README, WA04 a preserved stub). The WA titles this prompt relies on are all real and correctly named: WA03, WA07, WA09, WA10, WA12, WA13, WA21, WA22, WA23, WA24, WA28.

**WA29 and WA30 DO NOT EXIST [AUDITED].** The inbound prompt cites "WA29 (parallel reads are free, writes stay serial on the main thread)" and "WA30 (classify each architectural decision against the live ADR index at the propose stage)" as canonical. There are no such files; the registry tops out at WA28. Per the prompt's own rule ("the file wins and you flag the contradiction"; "do not import any WA number from this prompt as if it were current"), this is flagged here. The two practices the phantom WAs describe are sound and were followed this stage (read fan-out was parallel, all writes serial; Section 4 classifies every decision against the live ADR index). They are simply not codified working agreements. If the primary wants them codified, they would be authored as new WA files with numbers allocated at landing per WA24 (not pre-assigned here). Until then this audit treats them as uncodified-but-followed practice, not as inherited law.

**"FR 10.7 canonical-entity rationale" is unverifiable [HYPOTHESIS].** Sync-1 decision 3 and Section 2 of the inbound prompt anchor the real-schema-file call to "FR 10.7". A repo-wide search for "FR 10.7", "FR-10", and "canonical entity" finds no such requirement document or section; the only hits are unrelated "10.7%" figures. The decision to give house view a version-controlled schema file is still well-founded, but on grounds that ARE in-repo: house view has named cross-workstream consumers (`docs/workstreams/snapshot_enrichment_handoff.md:250` "### House view"; the slide-deck and Market Outlook tab consumers in the prebuild audit), and there is a working schema-file precedent (`schemas/time_series_performance_output.schema.json`). The audit rests the decision on those, not on the unverifiable FR reference.

### 0.5 Code paths [AUDITED]

Confirmed against the live repo (call sites quoted from the Stage-0 reads):

- E3 macro agent: `lib/agents/e3-macro.ts` (no deterministic extraction; macro passed through, structured by the LLM); diagnostic call site `pipeline.ts:228` passes `macroData: snapshot.macro` plus case fields; the case-mode twin `lib/agents/case/e3-case.ts` is more case-fused. Per the prior separability finding, house view reads `snapshot.macro` directly and copies E3's case-neutral field shape, it does not import or modify E3.
- Sibling capability agents are invoked only in `lib/agents/pipeline.ts` (the Samriddhi 2 diagnostic path), gated by `routerDecision.*`: risk-reward `:143-154`, portfolio-overlap `:161-172`, time-series `:184-208`. `pipeline-case.ts` (Samriddhi 1) invokes none of them.
- Content keys are written in the `fullContent` object at `pipeline.ts:406-408` (`risk_reward_stats`, `time_series_performance`, `portfolio_overlap`) and persisted via `prisma.case.update`.
- Stitcher seam: risk-reward and portfolio-overlap **bypass** the stitcher (ADR-0021, ADR-0030); time-series is **threaded** into it (`stitcher.ts:74,96,110`; `pipeline.ts:283`, ADR-0029). New capabilities must choose bypass-versus-thread explicitly (`0029_...:29`).
- Snapshot loader: `lib/agents/snapshot-loader.ts:26` reads `fixtures/snapshots/enriched/snapshot_<id>.json`; `macro`, `indices`, `fx` are typed top-level blocks (`:140-145`).
- `schemas/` contains exactly one file, `time_series_performance_output.schema.json`. Risk-reward and overlap have no published schema; time-series is the lone schema-file precedent.
- Stub-replay harness: `fixtures/stub-responses/<case-fixture-id>/<agent-id>.json`, keyed by `{caseFixtureId, agentId=skillId}` (`lib/agents/stub.ts:28-33,73-75`; `harness.ts:89-91`). The deterministic siblings have no stub fixtures (pure computation). This is load-bearing for Section 5: house view is snapshot-scoped, not case-scoped, so the case-keyed stub harness does not fit it; its replay-safety belongs to a snapshot-generation script, not the case-time harness.

---

## Section 1, the two-house-views namespace check [AUDITED]

Two unrelated things are called "house view" in this repo:

- **Structural allocation tilt (shipped):** ADR-0033's sub-sleeve splits by risk tier, carried on `Mandate.sub_sleeve_tilt` and resolved in `lib/agents/instrument-selection.ts`; the prior constant was `HOUSE_VIEW_TILT_BY_RISK` (`docs/audits/2026-05-30_classification_integrity.md:105`). This is the firm view expressed as allocation numbers.
- **Market commentary (this workstream):** the per-snapshot narrative, debt P5, render task T-5.04.

**Namespace decision:** the new content takes the key **`house_view`** (a per-snapshot block and a `content.house_view` case copy). This does not collide: a search of `lib/` for `house_view` / `houseView` / `HouseView` returns nothing, and the structural tilt uses the distinct identifier `sub_sleeve_tilt`. The two can coexist.

**Flagged for propose (candidate ADR):** should the narrative `house_view` be required to stay coherent with the structural `sub_sleeve_tilt` (the firm should not narrate "overweight equity" while the tilt under-weights the equity sleeve)? This is a real product-coherence question. Recommended disposition: a net-new ADR that names the consistency expectation as a soft authoring constraint, not a hard runtime coupling (house view is firm-generic commentary; the tilt is per-mandate structure, so a hard equality would be wrong). Decided at the propose gate, not here.

---

## Section 2, schema design proposal (draft, not implemented)

The proposed `house_view` shape is drafted as an uncommitted file at `docs/audits/house_view_output.schema.DRAFT.json` (clearly marked draft, for the gate only; it is not in `schemas/` and is not the Stage 2 implementation). Its shape, and the rationale for each load-bearing field:

- **Anchor:** `snapshot_id`, `as_of_date`, `regime_label` (sourced from `snapshot_metadata.evolution_type`, e.g. `stress_bank_shock`; the nine values are enumerated in Section 3), `schema_version`.
- **`macro_overview`:** `global` and `india` sub-objects, each a short narrative plus an `evidence_basis` array. Global is deliberately thin (Section 3 and the prebuild audit: the snapshot carries only Dimension 4 India-relevant global linkages, not a global sector surface).
- **`cross_asset_stances`:** `equity` (a `conviction` of overweight / neutral / underweight with an optional directional `lean`, plus `cap_tiers` large / mid / small each carrying its own conviction, plus `sector_notes`), `debt` (`conviction`, `duration_view`, `credit_view`), `alternatives` (gold, REIT, AIF notes), `geography` (India versus developed versus emerging). Every stance carries `rationale` prose and an `evidence_basis`.
- **`evidence_basis` (the structural enforcement of the two-register design, Sync-1 decision 4):** an array where each entry names a `signal_type` (`macro_indicator` | `index_series` | `fx_series` | `news_flow`), a `ref` (the indicator name and dimension, or the `index_id`, or the FX pair), and the citation hooks the macro block already exposes per indicator (`value`, `direction`, `as_of_date`, `source_document`). Each stance also carries a `register` of `grounded` (cites a moving indicator) or `interpretive` (states firm stance anchored to a signal that actually moved). A stance with no supporting moving signal carries a `sentinel` instead of prose (Section 4 sentinel disposition).
- **`key_risks`:** array of `{ risk, severity, evidence_basis }`.
- **`positioning` (the structural enforcement of the firm-versus-client boundary, Sync-1 decision 5):** `overweight` and `underweight` string arrays plus a `summary`, and structurally no `investor_id`, no `holding_ref`, and no action-verb field. The boundary is enforced by schema shape, not prompt instruction, because A3 So-What (ADR-0031) already owns client-level actions; house view must be incapable of carrying them.
- **Forward-compatible citation:** citation starts section-level (each stance references the indicators under it via `evidence_basis`). Claim-level citation can be added later as an optional per-sentence reference array without changing existing fields, so the v1 schema is not a breaking-change trap.

**Schema-file placement:** `schemas/house_view_output.schema.json`, consistent with the sole existing `schemas/time_series_performance_output.schema.json`. Implemented in Stage 2, not now.

The draft is presented for the primary to review and revise at the gate. It is a draft, uncommitted, and marked as such.

---

## Section 3, per-snapshot variation policy [AUDITED]

Audited across all nine snapshots (`fixtures/snapshots/enriched/snapshot_t0..t8`). `snapshot_metadata.evolution_type` runs: `baseline, quiet, quiet_it_cool, stress_rate_cut, normalisation, stress_bank_shock, stress_ril_idio, normalisation, quiet_smallcap_rally` (t0 to t8).

**Of the 24 macro indicators, 11 move and 13 are frozen at t0 across the whole suite.**

Moving (11): PMI Manufacturing, PMI Services, GDP Growth, CPI Headline, CPI Core, CPI Food, Repo Rate (5.25 to 4.75 at t3), RBI Stance (Neutral to Accommodative at t3), US Fed Funds (3.75 to 3.25 at t3), USD/INR (94.787 for t0 to t2, then 84.2 from t3), Dimension 5 News Flow.

Frozen (13): Non-Food Credit Growth (14.3%), Capacity Utilization (75.6%), IMD Monsoon, Real Interest Rate (0.0315), 10Y Govt Bond Yield (6.99%), WALR (8.28%), the three Government Fiscal Policy rows (still FY26 / FY27 labelled at t8 = Q2 2028), India-US Rate Differential (still labelled "5.25% - 3.625%" after the repo cut), Brent Crude ($118.95 "close Apr 29"), FII Net Flows (April), DII Net Flows (April).

**Beat-to-signal mapping (the evidence base for the two-register design):**

| Beat | Snapshot | Carried by (moving signal) | NOT carried by |
|---|---|---|---|
| RBI rate cut | t3 `stress_rate_cut` | Repo 5.25 to 4.75, RBI stance to Accommodative, US Fed funds to 3.25, USD/INR to 84.2, and the Dimension 5 news flow ("RBI cut ... 50 bps") | the 10Y yield, real rate, and India-US differential, which stay frozen despite the cut |
| Bank-sector shock | t5 `stress_bank_shock` | Dimension 5 news flow ("Banking ... down ~18%") and the `nifty_bank_tri` index (t4 1097 to t5 978, about -11% at the index level) | every macro indicator (none moves for the shock) |
| RIL idiosyncratic | t6 `stress_ril_idio` | Dimension 5 news flow ("Reliance ... dropped ~28%") and the energy sector path in `nifty500` / `nifty_50_tri` | macro indicators |
| Smallcap rally | t8 `quiet_smallcap_rally` | `snapshot_metadata.evolution_type` and the index series (`nifty_smallcap_250_tri` rising t5 1084 to t8 1167) | the macro block AND the news flow, which at t8 is stale on the t6 RIL text |

**Policy for house view:** ground each per-snapshot stance in what actually moves for that snapshot, the evolving macro indicators plus the index and FX series plus the news flow, and treat the 13 frozen indicators as static context, never as evidence of a quarter-over-quarter shift. The `evidence_basis` field enforces this: a stance may only claim a change if it cites a moving signal. Where a beat has no macro carrier (t5, t6, t8), the stance rests on the index, FX, or news-flow signal, with the register marked `interpretive`. The t7 and t8 stale news flow means those two snapshots cannot lean on Dimension 5 for a fresh beat; they lean on the index series and `evolution_type`.

This frozen-indicator finding is logged as **D13** (data debt). It is the same class as the cluster-3 synthetic-data-quality items (D8) but is distinct from D8's four named items; it is a new entry, surfaced by this stage, not a re-statement of an existing one.

---

## Section 4, ADR disposition

Each decision the design forces, classified against the live ADR index (highest 0042). Dispositions: net-new (write a fresh ADR in Stage 2), already-covered (cite an existing ADR, write nothing), amends (sharpen an existing ADR), supersedes (reverse a named prior ADR).

| # | Decision | Disposition | Basis |
|---|---|---|---|
| 1 | Content structure mapped to Market Outlook | net-new | no ADR covers house view content structure |
| 2 | Namespace relationship to the allocation tilt (Section 1) | net-new | ADR-0033 defines the tilt but not the coherence relationship to commentary; soft-constraint ADR |
| 3 | Output schema, per-snapshot additive placement | already-covered (placement) + net-new (case copy) | ADR-0011 covers additive sub-fields and new top-level blocks; the read-only `content.house_view` case copy that the pipeline does not parse is a new seam, a thin net-new ADR or WA09-covered |
| 4 | Generation methodology, two registers, `evidence_basis`, temperature, replay-safety | net-new | core house view design; no existing ADR |
| 5 | Per-snapshot variation policy (Section 3) | net-new | informed by D13; may fold into the generation ADR |
| 6 | Citation discipline mapped to the five-tier taxonomy | net-new, with a grounding caveat | no citation-taxonomy ADR exists; the five-tier taxonomy itself is not codified in-repo (it lives in prose), so Stage 2 should rest citation on the verifiable per-indicator `source_document` hook and treat the five-tier overlay as [HYPOTHESIS] to confirm |
| 7 | Sentinel taxonomy for house view | already-covered, candidate amends | ADR-0019 is the shared taxonomy; reuse the `EvidenceSentinel` union (`lib/agents/case/sentinels.ts`). If the "no moving signal supports this stance" case needs a new member, that AMENDS ADR-0019, the same way time-series added `no_prior_snapshot_available` |
| 8 | Schema artifact form (real version-controlled schema file) | net-new | follows the `time_series_performance_output.schema.json` precedent; rationale rests on cross-workstream consumers, NOT on the unverifiable FR 10.7 (Section 0.4) |
| 9 | Two-register design and the `evidence_basis` rule | net-new | folds into decision 4's ADR |
| 10 | Firm-versus-client boundary enforced by schema shape | net-new, references ADR-0031 | A3 So-What (ADR-0031) owns client actions; the boundary ADR cites it as rationale |

Net of this: roughly four to six fresh ADRs in Stage 2 (content structure, namespace coherence, generation-and-registers, schema-artifact-form, firm-versus-client boundary, and optionally the case-copy seam), with sentinel taxonomy and schema placement resolving to already-covered, and sentinel possibly amending ADR-0019. Numbers allocated at landing per WA24, starting at the then-live next-free (0043 or higher; reconfirm at Stage 2).

---

## Section 5, Stage 2 scope and the WA12 estimate

**Stage 2 builds:** the agent skill file (`agents/house_view.md`), the schema implementation (`schemas/house_view_output.schema.json`), the generation pipeline (a snapshot-scoped generator, not a case-time agent, see below), house view content backfilled additively into all nine snapshots (t0 to t8), the test set (schema validity, presence across all nine snapshots, `evidence_basis` integrity, the firm-only positioning shape, sentinel firing on no-signal stances), the fixtures, the fresh ADRs from Section 4, the hand-off doc (`docs/workstreams/house_view_handoff.md` per WA11), and the PR body. No render (WA09).

**A load-bearing Stage 2 design point surfaced here:** house view is snapshot-scoped, generated once per snapshot, so it is a snapshot-generation step, not a `routerDecision`-gated case-time agent like the three siblings, and the case-keyed `fixtures/stub-responses/` harness (Section 0.5) does not fit it. Its replay-safety is the determinism of the generation script plus the committed content in the snapshot, not the case stub harness. Stage 2 should also make the bypass-versus-thread call explicit (ADR-0029 requires it): the recommendation is **bypass** (write `content.house_view` as read-only display content, do not thread into the S1 stitcher), because house view is firm-generic context the case pipeline does not reason over, which matches Sync-1 decision 2 and the risk-reward and overlap precedent rather than the time-series exception.

**WA12 API-spend estimate (generation not fired this stage):** content is generated per snapshot across nine snapshots. Two methodology options, both estimated:

- One-or-two structured LLM calls per snapshot (a grounded-register pass and an interpretive-register pass that fill the schema): roughly 9 to 18 calls, input on the order of 6 to 8K tokens each (macro block plus foundation excerpts plus the schema), output 2 to 3K tokens each. About 70 to 140K input and 20 to 45K output tokens total.
- Per-section calls (about 8 to 10 sections per snapshot): roughly 80 to 90 calls, more overhead, similar per-call size.

At Sonnet-class pricing (the E3 precedent runs `claude-sonnet`) the recommended one-or-two-calls-per-snapshot approach lands at roughly **1 to 4 US dollars** for the full nine-snapshot suite including a retry margin; per-section generation or an Opus-class model would push toward **8 to 12 US dollars**. Recommendation for the gate: Sonnet-class, the two-register two-call-per-snapshot shape, and a t0-first calibration (generate t0, review against the Market Outlook reference, then fire the remaining eight), so the spend is staged and de-risked. The exact model and temperature are the decision-4 ADR; this stage proposes, it does not fire.

---

## Debt entries surfaced this stage

- **D13** (`docs/debt/data_debt_log.md`): the frozen-indicator finding (Section 3). Live next-free label confirmed D13.
- **T22** (`docs/debt/tech_debt_log.md`): the E3 declared-but-absent output schema (Section 0.2), corrected from the prior audit's provisional "D-1" to the T-series at the live next-free label T22. Not house view's to fix; logged for the workstream that next formalises E3's output.

---

## Discrepancies flagged (inbound prompt versus live repo)

1. **WA29 and WA30 do not exist** (Section 0.4). The registry tops out at WA28. The practices they name were followed; they are not codified WAs. Numbering, if they are adopted, is allocated at landing (WA24).
2. **"FR 10.7" is unverifiable** (Section 0.4). The schema-file decision is sound on in-repo grounds (cross-workstream consumers plus the time-series schema precedent); the FR reference is not used as authority.
3. **House view is absent from `docs/BUILD_ROADMAP.md`** and from `NEXT_SLICE_PROPOSAL.md`. T-5.04 / Slice 4.6e lives only in the debt logs (P5, ET3), the snapshot-enrichment thesis and handoff, and the prebuild audit. The roadmap's named next step is Slice 5 (Explorer). The "Slice 4.6x" capability series is a parallel track not reconciled into the numbered 1 to 9 slice sequence. So "T-5.16 has shipped per the roadmap" (Sync-1 decision 6) is true on PR history, not on a roadmap entry.
4. **T-5.16 canonical naming** is "whole-book look-through", and it is distinct from the co-landed T-5.14 client-weighted benchmark (Section 0.3).

---

## Hard stop (WA03 checkpoint)

Stage 1 stops here. Built nothing, ran nothing, generated no content, touched no fixtures, opened no PR. Surfaced for the primary's explicit review and go-ahead: this audit document, the Section 4 ADR dispositions, the draft schema at `docs/audits/house_view_output.schema.DRAFT.json` (uncommitted), and the Section 5 WA12 estimate. Stage 2 is a separate prompt, fired only after approval. The scoping and the spend approval are the primary's, ratified at the planning-chat sync.
