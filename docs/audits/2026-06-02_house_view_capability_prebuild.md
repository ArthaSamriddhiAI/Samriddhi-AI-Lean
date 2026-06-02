# House view (T-5.04 / Slice 4.6e): can it ship on the current snapshot and the existing case engine?

**Date:** 2026-06-02
**Branch:** `features/house-view` (code repo). Read-only prebuild audit; no agent run, no re-fire, no data or code change, no spend. WA22 (versioned `docs/audits/` deliverable), WA21 (grounded against the repo, read sites quoted), WA23 (conventions inherited by reference), WA27 (repo-relative paths), WA07 (no long dashes). First move on the workstream: this dated `docs/audits/` file.

This audit is the Step 0 deliverable for the house view capability workstream (item 4 of the 10 deliverable template). It answers the collaborator's framing question: with the current data snapshot and the calculation functionality already shipped in the Rajiv Surana case, can the house view task be finished, or is more needed? It is the audit input to ideation Sync 1.

---

## Bottom line

**Yes, house view is buildable now. Every source input it consumes already exists and is present locally, it is the most self-contained of the five Capability Phase workstreams, and it has no hard dependency on the other in-flight capabilities.** What is missing is not data infrastructure; it is the capability artifacts themselves (all greenfield) plus four scoping decisions the ideation must lock before the Claude Code prompt is fired.

Two clarifications that reframe the question:

1. **The existing "calculation functionality" in the Rajiv case is not the house view.** The shipped engine computes the *portfolio* section of the deck (risk-reward statistics, correlation, overlap, performance: Section ii of the Q2 review). The house view is Section i, the Market Outlook front section (global macro, India macro, equity, debt / FX / gold / oil). That section is LLM-generated firm commentary conditioned on the snapshot macro block, not a deterministic calculation. The two are complementary: the calc engine is necessary for the whole deck, but it does not produce house view content, and house view does not depend on it.

2. **The render target already exists and the capability only ships data.** The provided in-app wireframe (`12 - In-App Case Screen - Rajiv Surana v7.2`) carries a Market Outlook section (section 02, default open, a two-column frame: macro narrative left, cross-asset signature panel right). The v7.2 micro-update note (24 May 2026) records that the standalone "House View" section was removed and that "when the capability lands via T-5.04 it will fold into Market Outlook rather than living as its own section." So per WA09 this workstream ships `house_view` data; the Market Outlook render wiring is the later Capability Surfaces design pass.

The honest "what is still needed" list is Sections 3 and 4 below. The single most material item is partial per-snapshot macro variation (Section 4.2): many macro indicators are frozen at t0, which caps how much of the house view's quarter-over-quarter narrative arc can be data-grounded rather than asserted.

---

## 1. The two senses of "house view" in this repo (disambiguate before building)

The name "house view" already exists in the codebase, meaning something different from this workstream. This is the first thing the build must not collide with.

- **(a) House view as allocation tilt (shipped).** ADR-0033 (`docs/decisions/0033_sub_sleeve_tilt_foundation_slice.md:17,44`) defines the firm's default sub-sleeve allocation by risk tier as the "house-view default for the tier," carried on `Mandate.sub_sleeve_tilt` and resolved in `lib/agents/instrument-selection.ts`. The classification-integrity audit (`docs/audits/2026-05-30_classification_integrity.md:105`) names the prior constant `HOUSE_VIEW_TILT_BY_RISK`. This is the firm view expressed *structurally*, as numbers in the model portfolio framework. It is already in `foundation/foundation.md` and the instrument-selection layer.

- **(b) House view as market commentary (this workstream).** The firm's per-snapshot market outlook *narrative* (equity / debt / alternatives stance, macro themes, key risks, positioning), tracked as product debt P5 and render task T-5.04. This is the firm view expressed *narratively*, as content for the Market Outlook section.

**Implication for the build:** the new content must take a namespace that does not overshadow the existing allocation tilt (for example a `house_view` content block distinct from `sub_sleeve_tilt`). Whether the narrative house view should also cite or stay consistent with the allocation tilt (the firm being overweight equity in commentary while the tilt sets the equity sleeve split) is a genuine product-coherence question worth an ADR. The two are adjacent prior art, not duplicates.

## 2. The planning record already anchors this workstream

House view is not a new idea dropped into the build; it is a pre-registered debt item with a planned slice.

- **Product debt P5** (`docs/debt/product_debt_log.md:11`): "House view content sourcing. Lands via Slice 4.6e; real market-data feed integration is deferred (content is curated, not live)." Severity Medium. This sets two boundaries the workstream inherits: house view lands as Slice 4.6e (the fifth capability slice, alongside 4.6a classification, 4.6c overlap), and its content is curated per snapshot, not fed from live market data.
- **Enterprise readiness ET3** (`docs/debt/enterprise_readiness_debt_log.md:15`): house view is named as a tenant-config boundary that activates at first paying client. Out of scope here; noted so the schema does not foreclose firm customisation later.
- **Downstream contract already written.** The snapshot enrichment thesis (`docs/reference/SnapshotEnrichment_Thesis.md:117`) and handoff (`docs/workstreams/snapshot_enrichment_handoff.md:250-253`) both list house view as a recognised consumer: "Index series available for relative-value views. Can construct cross-asset comparisons (Nifty 50 vs CRISIL Composite Bond, Gold vs Equity)." So the enrichment workstream has already shipped what house view needs from it.

## 3. Source inputs: all five exist and are present locally

The ideation prompt lists the inputs house view consumes. Each is verified present in the clone, and the enriched snapshot suite is on disk, so the workstream can be built and dry-run without `setup-data` fetching from the private data repo.

| Input | Where it lives | State | Verified at |
|---|---|---|---|
| Foundation document (model portfolio, asset taxonomy, sleeve logic) | `foundation/foundation.md` | Present; 65/25/7/3 split, four asset classes, equity sub-sleeve targets | foundation.md sections 2 to 4 |
| IndianContext YAML stores (regulatory, structural, tax) | `agents/m0_indian_context/data/*.yaml` | Present; 6 stores (sebi_boundaries, tax_matrix, structure_matrix, regulatory_changelog, demat_mechanics, gift_city_routing) | directory listing |
| Snapshot macro dimension | `macro.data_snapshot.dimensions` in each snapshot | Present in all 9 (t0..t8); 5 dimensions, indicator-level detail with `source_document` per indicator | `fixtures/snapshots/enriched/snapshot_t0_q2_2026.json` |
| Index and FX series (relative value) | `indices` (16 canonical) and `fx` (usd_inr plus eur/gbp/aed) top-level blocks | Present; enrichment landed | `lib/agents/snapshot-loader.ts:77-147` |
| Industry reports (the wireframe's cross-asset grounding) | `industry_reports` top-level block | Present; 14 reports per snapshot with full page text | snapshot inspection |

The macro block maps cleanly onto the Market Outlook sections. The five dimensions are: Dimension 1 Economic Cycle (PMI, credit growth, capacity, GDP, CPI headline / core / food, monsoon), Dimension 2 RBI Monetary Policy (repo, stance, real rate, 10Y yield, WALR), Dimension 3 Government Fiscal Policy (deficit, capex, budget targets), Dimension 4 Global Macro Linkages (US Fed funds, India-US differential, USD/INR, Brent, FII / DII flows), Dimension 5 News and Qualitative Intelligence (the per-snapshot narrative beat). Each indicator carries `value`, `direction`, `as_of_date`, `source_document`, and `notes`, which directly supports the citation discipline the ideation asks for.

The existing E3 macro agent (`agents/e3_macro_policy_news.md`, `lib/agents/e3-macro.ts:76-154`) already consumes this exact block across six analytical dimensions and emits a structured macro verdict. E3 is the closest existing consumer of the same input house view will read; its skill file, prompt construction, and output schema are a strong template for the house view agent, second only to the capability siblings.

## 4. What is still needed (the honest gap list)

### 4.1 The capability is entirely greenfield (expected)

None of the artifacts exist yet, confirmed by listing: there is no `agents/house_view.md`, no `lib/agents/house-view.ts`, no `schemas/house_view_output.schema.json` (only `time_series_performance_output.schema.json` is present), no per-snapshot `house_view` block, and no `docs/HouseView_Thesis.md`. The 10 deliverable template applies. The sibling pattern to copy is well established: `agents/risk_reward_stats.md` and `agents/time_series_performance.md` for the skill file shape, the `callAgent` harness and `stripLongDashes` Layer-2 sanitiser for generation, ADR-0019 (`docs/decisions/0019_sentinel_taxonomy_and_do_not_mix.md`) for sentinels. This is normal workstream scope, not a blocker.

### 4.2 Per-snapshot macro variation is partial (the material constraint)

Comparing the macro block across t0, t5, and t8, only some indicators evolve. Evolving: repo rate (5.25 to 4.75), RBI stance (Neutral to Accommodative), GDP, CPI headline / core / food, PMI, US Fed funds, USD/INR, and the Dimension 5 news flow (which does carry the beat text: t5 banking drawdown, t8 a Reliance regulatory drop). Frozen at t0 across all snapshots: the 10Y government bond yield (6.99% throughout, even as the repo moves), WALR, real interest rate, the entire fiscal block, non-food credit growth, capacity utilisation, Brent, the FII / DII flow figures, and the India-US differential label.

This matters for ideation decision 3 (per-snapshot variation). The narrative beats the suite encodes (t5 bank shock, t6 RIL idio, t8 smallcap rally) are real, but they live mostly in the Dimension 5 news flow and in the `indices` / `fx` series, not in the evolving macro indicators. So a house view that tilts defensive at t5 and engages the smallcap rally at t8 must derive that tilt from the news-flow dimension plus index-derived relative value, treating the frozen indicators as static context rather than reading a moving yield curve or fiscal path off them. The frozen indicators overlap the enrichment closure-note items (`docs/workstreams/snapshot_enrichment_handoff.md:265-272`) and should be logged as a data-debt entry, not silently worked around. Recommendation: scope the per-snapshot arc to what genuinely moves, and do not assert quarter-over-quarter shifts in indicators that are static in the data.

### 4.3 Global macro breadth is thinner than the reference deck

The reference sample portfolio (Standard Chartered) and the Q2 Surana deck both show a global macros page with DM policy-rate paths, MSCI ACWI forward EPS, and a global sector-return table. The snapshot carries only the six India-relevant global linkages in Dimension 4. Fuller global commentary can only be LLM narrative, and live or external global data is explicitly out of scope per P5 ("curated, not live"). Recommendation: scope the global section as a brief linkages-grounded narrative, not a data-rich global sector table, and document the deferral so the slide deck workstream does not assume a global data surface that is not there.

### 4.4 Four decisions to lock in ideation before the CC prompt

These become ADRs during execution; flagging them now so Sync 1 can resolve them.

1. **Output schema and placement.** The additive-enrichment precedent (ADR-0011 schema placement, the snapshot-is-additive principle) and the wireframe (Market Outlook is snapshot-scoped, not case-scoped) both point to a per-snapshot `house_view` block rather than a `content.house_view` on the case or a standalone `house_views/` directory. Confirm, and define the schema so the slide deck and Market Outlook tab consumers are cheap.
2. **Backfill home and provenance.** House view content must be generated for all 9 snapshots (t0..t8), additive only. But snapshots are dual-homed: the live fixtures at `fixtures/snapshots/enriched/` and the private `Samriddhi-AI-Data-Snapshots` repo accessed via private releases (ADR-0027). Decide where the authored house view lands and how it is regenerated, so the two homes do not drift.
3. **Equity valuation inputs.** The reference deck cites Nifty 12m forward P/E and Nifty EPS growth. These are not macro fields; per-stock `pe` / `industry_pe` exist on `nifty500.companies[]` and index levels exist, so an aggregate is derivable but not pre-computed. Decide whether house view computes and cites these (a calc dependency that strains WA09) or stays qualitative. Leaning qualitative keeps the capability data-only.
4. **Generation methodology and replay.** Follow the E3 and risk-reward pattern: structured template plus per-section LLM narrative, temperature near 0.3, the `stripLongDashes` sanitiser on output, sentinels aligned to ADR-0019 plus the existing harness sentinels (`infrastructure_ready`, `context_not_yet_available`, `not_activated`). Confirm replay-safety against the `fixtures/stub-responses/` harness.

## 5. Dependencies and sequencing

- **Not blocked on snapshot enrichment.** Enrichment has landed: `indices` and `fx` are present in the suite and the loader reads them (`lib/agents/snapshot-loader.ts:144-145`), and the handoff already names house view as able to assume the richer schema.
- **Not blocked on the other three capabilities.** Risk-reward, time-series, and overlap are independent; house view reads none of their outputs. This is why Plan v6 calls it the cleanest parallel handoff.
- **Render is a later design pass (WA09).** The Market Outlook section in the wireframe is the design reference; this workstream ships the data that section will consume. The actual fold-in is T-5.04 in the design workstream, not here.
- **Process gates inherited.** WA01 (no self-merge; PR goes to Shubham), WA10 (push on branch creation, commits push as they land, PR is the deliberate gate), WA11 (dual-write hand-off: this audit in `docs/audits/`, the cross-workstream note in `docs/workstreams/`), plus the two ideation syncs before the CC prompt is fired.

## 6. Expected ADRs (6 to 8 likely)

1. House view content structure (the section list mapped to the Market Outlook render).
2. Namespace and relationship to the existing allocation-tilt house view (Section 1).
3. Output schema and per-snapshot placement (4.4 item 1).
4. Generation methodology, temperature, replay-safety (4.4 item 4).
5. Per-snapshot variation policy: what evolves, what is held static, given 4.2.
6. Citation discipline mapping to the five-tier IndianContext taxonomy.
7. Sentinel taxonomy for house view (inherit where possible per ADR-0019).
8. Backfill home and provenance across the dual-homed snapshot store (4.4 item 2).

---

## Recommendation

Proceed. The workstream is buildable on the current snapshot and the existing scaffolding with no upstream data work required first. Take this audit to ideation Sync 1 with a design proposal that resolves the four decisions in Section 4.4 and the two-house-views namespace question in Section 1, and that scopes the per-snapshot arc honestly around the indicators that actually move (Section 4.2). Log the frozen-macro-indicator finding and the deferred claim-verification as debt entries before the PR. The CC prompt should be lighter on the test deliverable (the output is LLM content; tests cover schema validity, presence across all 9 snapshots, and pipeline robustness on edge inputs) and should anchor to the legibility-first 10 deliverable template. Bring the drafted CC prompt to Shubham for the Sync 2 review before firing.

This audits and recommends; it builds nothing, runs nothing, and spends nothing. The scoping calls are the ideation's, ratified at the planning-chat syncs.
