# Layout-gap audit: the v7.2 composed page versus the built severity accordion (render bundle)

- Date: 2026-06-09
- Branch: `features/render-bundle-sweep` (PR #16 closed, not merged; branch preserved per WA01)
- Status: diagnosis and rebuild proposal. No fix code written. The rebuild is gated on primary ratification (Phase 0 below).
- Method: looked three ways (the v7.2 wireframe decoded and read as a layout spec, the built screens screenshotted via headless Chrome, the code read), corroborated by a six-agent diagnosis workflow (two independent wireframe-layout reads, a code-structure read, a per-section data-availability read, a synthesis, and an adversarial completeness critic) and reconciled against my own look.
- Evidence note: the v7.2 wireframe stays external and uncommitted (hardline). It is the standalone HTML at `15 - Product Roadmap & Build Plan/14 - Samriddhi Roadmap v14/12 - In-App Case Screen - Rajiv Surana v7.2 (Standalone).html`; its body markup is JS-string-encoded inside the bundle (`<` for `<`), which is why an earlier pass mined it for chart geometry but never read it as a layout. Screenshots of the built screens are working evidence, not committed image files. A reviewer cannot see the wireframe in the repo; the structural quotes below are the record.

## 1. Why PR #16 was rejected

The render data and the chart SVG geometry are sound. Verified separately: the four chart components compute real, non-degenerate geometry (real arcs, no NaN), and they paint correctly when a row is expanded. Nothing in the charts is broken.

The defect is the page skeleton. The build renders the Samriddhi 2 case screen as a uniform severity-pill accordion derived from the `BriefingContent` schema, with the five capability surfaces appended as collapsed rows. The v7.2 wireframe is a composed, numbered, content-named 12-section page with authored open and closed defaults and severity demoted to a local device. We shipped correct charts onto the wrong page architecture. This is a re-scope, not a bug-fix, and the mis-sizing traces to a product-shape assumption that was defaulted rather than decided (Section 5).

## 2. What the v7.2 wireframe actually is (read as a layout spec)

Top to bottom: a sticky nav, an always-visible `header.case-header` (case id, snapshot date, a Decided pill, the H1, an Aggressive risk pill), a standalone `section.headline-takeaway` (a prose thesis paragraph plus a `frozen-note` provenance line, NOT a severity tally), then a single `div.accordion` containing exactly twelve `details.acc-section` blocks numbered 01 to 12, then a `footer` and a standalone `section.disclaimer` of five methodology paragraphs.

The accordion is a numbered content-section accordion, not a severity accordion:
- Each `summary` carries `.acc-num` (01, 02, 03), `.acc-title` (Market Outlook, Portfolio composition, Per-holding verdicts), an `.acc-aside` content caption (for example "Maintain 6 / Monitor 3 / Discuss 2 / Review 0"), and a chevron. No severity pill on any summary.
- Sections 01 to 05 carry `open=""` (expanded by default); sections 06 to 12 have no `open` (collapsed by default). The open and closed split is authored per section, not derived from severity.
- Severity pills exist in exactly one place: inside section 04 Portfolio observations, as `.sev-pill data-sev="flg"|"muted"` on each obs-card. Section 03 uses verdict pills (Maintain/Monitor/Discuss/Review), section 09 uses overlap levels, section 10 uses valuation markers. Severity is one local device, not the page's organizing axis.
- Each section body is its own bespoke composed grid: `comp-grid`, `verdicts-layout`, `a1-grid`, `perf-layout`, `rr-hero`, `heatmap-wrap`, `sleeve-map`, `val-grid`, `glide-path`, `market-outlook-frame`, `macro-grid`, `obs-card`. These are multi-column composed sections, not uniform rows.

## 3. What the build actually is (read from the code)

`components/case-detail/AnalysisTab.tsx` builds an array of `AccordionItem` rows (an imperative `rows.push` / `capRows.push` builder), interleaves them in a fixed `ROW_ORDER`, stamps numbers, and renders one `<Accordion items={numbered} />`. The rows are a near 1:1 projection of `BriefingContent.section_1..section_7` plus five appended capability rows. `components/case-detail/Accordion.tsx` is the top-level structure; its `useOpenSet` opens only `severity === "esc"` rows. Every capability row is hardcoded `muted` / `flg` / `inf`, so the charts never open on load. The file comment "no section re-cut, this is a presentational layer only" is exactly the assumption v7.2 reverses.

Built screens (headless Chrome, all five Samriddhi 2 cases): a uniform severity-pill accordion. surana and iyengar show the pills down the left, the briefing-schema titles (Portfolio overview, Headline observations, Concentration analysis), the charts crammed into single-column row bodies, and the heatmap note box colliding with the rotated column headers (the `heatmap-wrap` two-column grid did not survive into an accordion body). menon (all-cash) shows the same skeleton with the correct empty states. The charts paint; the composition is wrong.

## 4. Section-by-section gap (v7.2 section versus build)

| v7.2 section | Build has it | Form correct | The gap |
|---|---|---|---|
| Headline takeaway (standalone, always-visible) | Partial (the `ar-diag` exec band) | No | Wireframe is a prose thesis paragraph plus a frozen-note; the build foregrounds an escalate/flag/total tally the wireframe does not carry. Right placement, wrong content. |
| 01 Market Outlook (open) | No | No | Entire section absent. Data present in all five (`content.evidence.e3`). Needs the `market-outlook-frame` plus `macro-grid` (4 dimension cards) built from zero. Buildable now. |
| 02 Portfolio composition (open) | Partial | No | Wireframe is one `comp-grid`: stacked composition donut plus per-holding donut on the left, asset-mix table plus founder-equity aside on the right. The build splits these across two non-adjacent rows and puts the asset-class donut in the `portfolio` row. Pieces exist; the composition does not. |
| 03 Per-holding verdicts (open) | Partial, dispersed | No | No dedicated verdict section. The SAA two-ring donut is in the wrong row; there is no MMDR pie, no verdict-tier roster, no risk-reward chips, no concentration callout. Data fully present (`content.a2_classification.holding_verdicts`). So-what must be inline per Monitor/Discuss holding, not a standalone row. |
| 04 Portfolio observations (open) | Partial | No | Wireframe is `obs-card.with-sowhat` two-column grids with a `sev-pill`, evidence visualizations, and inline so-what. The build renders flat text blocks, carries severity as a CSS class not a pill, and detaches the so-what. `evidence.e2.cross_holding_sector_observations` unrendered. |
| 05 Critical review (open) | No | No | BLOCKED, not merely unbuilt. ADR-0040 records A1 is deliberately absent from the Samriddhi 2 diagnostic at MVP; no adversarial-challenge capability is persisted. The wireframe section 05 conflicts with a committed ADR. A product-shape decision (WA28), not a render task. |
| 06 Portfolio performance (closed) | No | No | Section absent. Data present and templated (`content.time_series_performance`). Needs a net-new hand-rolled time-series SVG chart plus `perf-layout` and an 8-cell stats footer. `cross_snapshot_evolution.available=false`, so only trailing-window returns render. Largest net-new chart. |
| 07 Risk-reward statistics (closed) | No | No | Section absent. Data present (`content.risk_reward_stats`). Needs `rr-hero` (5 cards), a 3Y/5Y horizon toggle (implies a client component, unlike the static-SVG surfaces), statgrid, best/worst table, and coverage-caveat rendering. Pre-existing UX4 already defers this. Substantial net-new. |
| 08 Holdings overlap heatmap (closed) | Yes | Yes | Chart correct and reusable verbatim. Gap is composition only: the wireframe wraps it in `heatmap-wrap` (1.4fr/1fr) with a legend bar and four note callouts; the build has the chart but not the grid or callouts (UX12 layer-mixing already logged). |
| 09 Overlap and consolidation (closed) | No (leaks into the so-what row) | No | No `sleeve-map`, no overlap table. Data present (`content.portfolio_overlap`, plus a3 trims). Both sub-surfaces net-new. menon empty (no pairs) is a correct state. |
| 10 Valuation markers (closed) | No | No | Section absent. Data PARTIAL by design: `content.evidence.e1.per_stock_verdicts` exists only for direct-listed stocks (present for bhatt/surana/menon, EMPTY for iyengar/malhotra all-MF). Needs `val-grid` plus an all-MF empty state. Per-MF valuation would need new data. |
| 11 Rebalance framework (closed) | Yes | Yes | Chart correct and reusable verbatim. Gap is composition only: the wireframe adds a `glide-path-title` and a `glide-meta-strip` (trigger / reinvestment / tax); the meta strip is not rendered. |
| 12 Decision history (closed) | No | No | Section absent. Data PARTIAL: structured advisory history is absent (`cross_snapshot_evolution.available=false`, `prior_cases_count=0` in all five, single t0 snapshot); only `evidence.e4.historical_decision_pattern` narrative is renderable. A real timeline needs multi-snapshot data. |
| Disclaimer and methodology (standalone, always-visible) | Partial (a `coverage` row) | No | Wireframe is a standalone five-paragraph methodology section at the page foot (a provenance map of which surfaces are LLM versus deterministic). The build has one coverage paragraph inside a collapsible row. |

Two of twelve sections (08 heatmap, 11 glide-path) are chart-correct and need only a composition wrapper. Four exist as fragments (02, 03, 04, plus the takeaway and disclaimer chrome) and must be re-composed and relocated. Six are net-new (01, 06, 07, 09, 10, and the verdict/MMDR parts of 03). One (05) is blocked by a committed ADR.

## 5. Verdict: re-scope, and a mis-specified original scope

Genuine re-scope, not a bug-fix. The build is internally correct against the spec it was given (the Concept C briefing accordion); the target was wrong. Closing the gap is building a different page architecture on top of the salvageable charts and data layer, not fixing a regression.

Scope sizing, honest and arguably conservative: roughly six net-new composed sections built from zero, four sections re-composed from fragments, a full rebuild of the `AnalysisTab` composition shell, and a substantial net-new stylesheet (a dozen composed grids absent from `app/globals.css` today). Only two sections are already chart-correct. This is comparable in size to the original Concept C build, not a touch-up. "Render the five surfaces" was the small framing; the five charts are the already-done easy part of building the whole 12-section page.

Scope mis-specification (WA28 product-shape gap, not an execution error). The render-bundle audit (`docs/audits/2026-06-04_render_bundle_audit.md`, sections 5 and 8) framed T-5.09 as "render the five shipped capability surfaces onto the case screen" and treated the page shell as a given ("widen AnalysisTab Props and add the render rows"). That silently assumed the existing shell was the v7.2 page minus the charts. It was not. Eight of twelve sections were never in scope because the gap was measured as "charts missing from a matching shell" rather than "shell does not match." Per WA28 this load-bearing assumption should have been surfaced and ratified before execution. The same audit's WA30 line "net-new ADRs required: none" followed from the mis-sized premise and is now stale.

## 6. Concept C status and WA30 ADR dispositions

Concept C status is an open product-shape question for the primary (WA28); I do not resolve it here. On the evidence, v7.2 and the Concept C briefing accordion are mutually exclusive top-level structures for the analysis page: v7.2 is a composed numbered-section page with authored open and closed and severity demoted to a local device; Concept C is a uniform severity-pill accordion with severity-derived default-open. Both cannot be the page's top-level structure. ADR-0046 (Accepted 2026-06-09, this branch) is built on Concept C holding: it states "the analysis page itself remains a single scrolling, signal-led accordion." Adopting v7.2 supersedes Concept C for this screen and reframes ADR-0046's premise. Whether v7.2 supersedes Concept C, or the team reconciles the wireframe back to Concept C, is a locked-design-versus-locked-design call that is the primary's, not the rebuild's to assume. Flag and wait (WA19, WA28).

WA30 dispositions the rebuild forces:
1. Net-new ADR (the load-bearing one): "the v7.2 composed 12-section page supersedes the Concept C briefing accordion as the Samriddhi 2 analysis-page structure." This reverses the render-bundle audit's "net-new ADRs: none." Must be ratified before the rebuild, not after.
2. Amend ADR-0046 (`0046_concept_c_analyst_reports_tab_amendment.md`): its "Concept C holds, single signal-led accordion" framing needs a forward annotation if v7.2 is adopted. The Analyst Reports tab affordance survives; the ADR's stated basis does not stand unannotated.
3. ADR-0040 (`0040_a1_absence_in_samriddhi_2_diagnostic.md`) governs section 05. It records A1 deliberately absent at MVP with reopening conditions (product debt P48/P49) not met. The rebuild MUST NOT build section 05 as a live A1 surface; doing so violates ADR-0040. Either omit 05, or surface whether to populate it with repurposed (non-A1) review prose, itself a WA28 decision.
4. ADR-0045 (`0045_chart_render_technology_svg.md`, hand-rolled SVG, no library) is reinforced by sections 06 and 07. Watch item: section 07's 3Y/5Y toggle introduces client interactivity, the exact trigger ADR-0045 names for reopening. If the toggle ships, annotate ADR-0045.
5. Sections 10 and 12 raise capability and data-shape questions (per-MF valuation; multi-snapshot history). WA28 flags for the primary, recorded as debt or a short ADR per the ruling.

## 7. Salvageable versus must-rebuild

Salvageable (reused, most verbatim):
- The four chart components `components/case-detail/charts/{SaaDonut,HoldingsDonut,OverlapHeatmap,GlidePath}.tsx`. Prop-driven and typed against the capability outputs (not schema-free; they import `PortfolioMetrics`, `A3Output`, `PortfolioOverlapOutput`). Only their call sites move. ADR-0045 ratifies the approach.
- The geometry helper `components/case-detail/charts/geometry.ts` (polar, donutArc, lerpHex). The base for the net-new time-series chart too.
- The `app/cases/[id]/page.tsx` data layer (parse plus holdings derivation). It survives; only the consumer changes. Correction from the critic: to reach sections 01/03/06/07, page.tsx must additionally PARSE `time_series_performance`, `risk_reward_stats`, and `a2_classification` (present in `contentJson` but not currently extracted), and thread `evidence.e1..e4`; today it parses only briefing, metrics, a3_so_what, portfolio_overlap, evidence.
- The data-presence guards and per-case empty states (menon all-cash; iyengar and malhotra all-MF). Correct data states; they carry over.
- `AnalystReportsTabS2.tsx` and its tab (ADR-0046): orthogonal to the analysis-page rebuild; untouched.
- The `Accordion` primitive: survives as an optional in-section collapsible device, NOT as the page's top-level structure.
- The asset-mix, comparison, talking-points, and evidence-appendix table fragments: reusable markup that drops into the composed sections.
- The chart-local CSS already in `app/globals.css` (sowhat, glide-path, saa-radial, heatmap-wrap selectors) carries over; only the composed-section grid CSS is net-new.

Must rebuild:
- The entire `AnalysisTab.tsx` composition: the `rows[]` / `capRows[]` builders, the `ROW_ORDER` interleave, and the single `<Accordion>` render are replaced by explicit per-section composed JSX with bespoke grids.
- The Accordion-as-top-level-structure and its esc-only default-open: replaced by 12 numbered sections with authored open and closed.
- The briefing-to-row 1:1 mapping: section boundaries re-cut against the v7.2 12-section spec, not inherited from the 7 briefing sections.
- SaaDonut lifted out of the `portfolio` row into section 02 and section 03; so-what detached from its standalone row and inlined into 03 and 04.
- Six net-new composed sections (01, 06, 07, 09, 10, the verdict and MMDR parts of 03) plus a net-new hand-rolled time-series chart.
- The exec band reframed from a severity tally to the prose headline-takeaway; the coverage row promoted to a standalone disclaimer/methodology section.
- A substantial net-new composed-grid stylesheet in `app/globals.css`.

## 8. Data availability per section (what is buildable now)

Renderable from existing fixture data today (present in all five, render-buildable now): 01 Market Outlook (`evidence.e3`), 02 Portfolio composition (holdings plus metrics), 03 Per-holding verdicts (`a2_classification.holding_verdicts`), 04 Portfolio observations (`section_1` plus `evidence.e2`), 06 Portfolio performance (`time_series_performance`, templated), 07 Risk-reward statistics (`risk_reward_stats`, templated), 08 Holdings overlap heatmap (live), 09 Overlap and consolidation (`portfolio_overlap` plus a3 trims), 11 Rebalance framework (live). Four are already live in `AnalysisTab` (composition, heatmap, so-what, rebalance); the other five are data-present but need the WA09 design-ships-render buildout.

Needs new data or capability, or a product-shape ruling (partial or blocked): 05 Critical review (no adversarial/A1 capability persisted; ADR-0040 forbids inventing it; only reusable review prose), 10 Valuation markers (only `evidence.e1.per_stock_verdicts` for direct-listed stocks; empty for all-MF iyengar and malhotra), 12 Decision history (structured history absent; only `evidence.e4` narrative renderable; a real timeline needs multi-snapshot data). These three are exactly the uncertain ones.

## 9. Proposed rebuild (a plan, not applied code). All on `features/render-bundle-sweep`.

- Phase 0, product-shape gate (no code). Surface the three load-bearing decisions and wait: (a) does v7.2 supersede the Concept C accordion as the analysis-page structure; (b) how is section 05 handled given ADR-0040; (c) how are partial-data sections 10 (all-MF) and 12 (no multi-snapshot) shaped. Ratify the supersession ADR and annotate the render-bundle audit's stale "net-new ADRs: none" line and ADR-0046. Recommend a path, do not override the gate (WA19/WA28).
- Phase 1, page shell and CSS scaffold. Replace the single-Accordion composition with a composed page shell: always-visible header plus prose headline-takeaway, a 12-section container with authored open (01 to 05) and closed (06 to 12), and a standalone disclaimer/methodology foot. Add the net-new composed-grid CSS. Widen `page.tsx` to parse and thread `time_series_performance`, `risk_reward_stats`, `a2_classification`, and `evidence.e1..e4`. Preserve the parse layer, chart-local CSS, the Accordion primitive (demoted), and the Analyst Reports tab.
- Phase 2, mount the salvaged charts into their composed homes. SaaDonut into section 02 comp-donut-stack and section 03 verdicts-layout left column; HoldingsDonut into section 02; OverlapHeatmap into section 08 `heatmap-wrap` (add legend bar plus note callouts); GlidePath into section 11 `glide-path` (add the meta strip); so-what inlined into 03 (per Monitor/Discuss holding) and 04 (per obs-card). Chart components and geometry preserved verbatim.
- Phase 3, build the net-new data-backed sections that need no new capability: 01 Market Outlook, the verdict-tier rosters and MMDR pie in 03, the obs-cards with sev-pills and evidence visualizations in 04, 06 Portfolio performance (net-new time-series SVG chart reusing geometry.ts), 07 Risk-reward (rr-hero plus statgrid plus best/worst plus coverage caveats; the 3Y/5Y toggle as a scoped client component, annotate ADR-0045), 09 Overlap and consolidation (sleeve-map plus overlap table). Resolve the coverage-caveat register debts (UX1/UX2/UX5/UX10) here.
- Phase 4, resolve the gated sections per the Phase 0 ruling, then verify and log debt. Build 05 only if a non-A1 editorial framing is authorized (else omit per ADR-0040); build 10 with an all-MF empty state; build 12 from e4 narrative only with the multi-snapshot absence stated. Finalize the disclaimer/methodology provenance map. Verify all five fixtures render at HTTP 200 with the correct open and closed defaults, looking at the painted DOM, not markers.

## 10. Debt surfaced (to log at execution; numbers resolved at landing per WA24)

1. [tech] The render-bundle audit (`docs/audits/2026-06-04_render_bundle_audit.md`) sections 5 and 8 are stale: T-5.09 scoped as render-only against a matching shell, and "net-new ADRs: none". Both are overtaken; annotate, and add the supersession ADR if v7.2 is adopted.
2. [product] Mis-sized T-5.09 scope (WA28): the original assumed a matching shell; 8 of 12 sections were out of scope. Log so the next planner sizes the composed-page rebuild honestly.
3. [product/design] Section 05 conflict: the v7.2 wireframe specifies an A1 critical-review section that ADR-0040 forbids at MVP (P48/P49). Log the wireframe-versus-ADR conflict so the wireframe is not later read as authorizing an A1 surface.
4. [data] Section 10 valuation: `evidence.e1.per_stock_verdicts` is empty for all-MF portfolios; per-MF look-through valuation needs new data (extends the look-through debts).
5. [data] Section 12 decision history: `cross_snapshot_evolution.available=false`, `prior_cases_count=0` in all five; a real timeline needs multi-snapshot data.
6. [ui_ux] Sections 06 and 07 unrendered capability data: `time_series_performance` and `risk_reward_stats` are persisted and templated but never rendered; cross-reference UX4 and resolve UX1/UX2/UX5/UX10 coverage-caveat register debts when section 07 is built.
7. [ui_ux] Section 07 client-interactivity watch: the 3Y/5Y toggle breaks ADR-0045's "pure server components" note; annotate the reopening trigger when the toggle ships.
8. [tech] If the accordion top-level structure is retired, the Concept C `.ar-c-*` CSS in `app/globals.css` becomes partly dead; sweep it as follow-up rather than leaving it.

## 11. Method and corrections

This diagnosis was looked-at three ways (wireframe decoded and read as layout, built screens screenshotted, code read) and cross-checked by a six-agent workflow (two independent wireframe reads, code-structure, data-availability, synthesis, adversarial critic). The critic's accepted corrections are folded in above: page.tsx needs three blocks PARSED not merely passed (Section 7); the chart components are typed against the capability outputs, not schema-free; ADR-0045 and ADR-0046 are net-new on this branch and the rebuild reinforces or amends them rather than ignoring them; and the v7.2 wireframe is external and unverifiable in-repo, so the structural quotes here are the record. The earlier verification failure (inferring chart health from class-name markers that matched the CSS and the RSC flight payload, not the painted DOM) is what this pass corrected by screenshotting and probing the live DOM.
