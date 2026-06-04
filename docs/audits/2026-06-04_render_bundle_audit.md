# Render bundle audit (T-5.08 + T-5.11 + T-5.09)

- Date: 2026-06-04
- Branch: `features/render-bundle-sweep` (cut from `main` at 168a20e, PR #15)
- Status: read-only audit (WA22 deliverable). No implementation code written this pass.
- Method: three parallel read-only subagents (WA29-blessed), synthesized here, with one cross-subagent contradiction resolved by direct orchestrator verification of the fixtures.
- Scope: the render bundle only. T-5.10 (slide deck) is out of scope.

## Headline verdicts

1. ZERO-SPEND HOLDS. No WA12 gate fires for the render bundle. Every field the six surfaces consume is already persisted in the five Samriddhi 2 fixtures (written by PR #14, 2026-06-02), including the model-generated A2 verdict text and A3 so-what narrative. The read-only audit itself was free.
2. DEPENDENCY GRAPH (revised by evidence): the hard "T-5.11 then T-5.09" edge has largely dissolved. The capability data T-5.11 was scoped to inject is already in the committed fixtures, so T-5.09 can build against them now. T-5.08 is independent of both on data, but shares three files with T-5.09 on writes.
3. WRITE-DISJOINTNESS: partial, not clean. T-5.08 and T-5.11 are fully disjoint. T-5.08 and T-5.09 collide on three shared files (`app/globals.css`, `lib/format/case-accordion.ts`, `app/cases/[id]/page.tsx`). The bundle is less write-disjoint than the experiment premise assumed.
4. WA30 DISPOSITION: net-new ADRs required: none. One watch item (chart-render technology choice) that flips to net-new only if a durable cross-surface charting architecture is locked.
5. DEBT: eight items surfaced below for logging at execution (WA5 / WA8 / WA24).

## 1. What this audit overturned (read this first)

The kickoff and the orchestrator's first-pass grounding both assumed the five Samriddhi 2 fixtures were the `c-2026-05-21-*` set. That is wrong. Two of the three subagents independently caught it, and direct verification of the `workflow` enum on every case file confirms the correction. The codebase is canonical and the planner framing was stale here; per the task-init's own rule, the code wins and this audit says so.

The correction cascades: the `c-2026-05-21-*` files are Samriddhi 1 (proposal-evaluation) cases that legitimately lack every capability block, so any reasoning grounded on them ("the fixtures are stale, the data is missing, T-5.11 must inject everything, A3 so-what needs a model call") is an artifact of inspecting the wrong family. The real Samriddhi 2 fixtures are fully populated.

## 2. The two fixture families (verified)

Verified by reading `db/fixtures/cases/*.json` and the `workflow` enum and content shape of each:

| Fixture | `workflow` | Briefing shape | Capability blocks | Family |
|---|---|---|---|---|
| `db/fixtures/cases/c-2026-05-14-bhatt-01.json` | `s2` | `section_1_headline_observations`, `section_2_portfolio_overview` | a2, a3, risk_reward, time_series, overlap, evidence{e1-e4,e6,e7}, metrics | Samriddhi 2 (target) |
| `db/fixtures/cases/c-2026-05-15-iyengar-01.json` | `s2` | same | same | Samriddhi 2 (target) |
| `db/fixtures/cases/c-2026-05-15-malhotra-01.json` | `s2` | same | same | Samriddhi 2 (target) |
| `db/fixtures/cases/c-2026-05-15-menon-01.json` | `s2` | same | same | Samriddhi 2 (target) |
| `db/fixtures/cases/c-2026-05-15-surana-01.json` | `s2` | same | same | Samriddhi 2 (target, wireframe persona) |
| `db/fixtures/cases/c-2026-05-21-{bhatt,iyengar,malhotra,menon,surana}-01.json` | `s1` | `section_1_proposal_summary`, `section_2_synthesis_verdict`, `section_3_evidence_summary` | `evidence_verdicts[7]` only | Samriddhi 1 (not a target) |
| `db/fixtures/cases/c-2026-05-14-sharma-01.json` | `s1` | S1 shape | `evidence_verdicts[7]` | Samriddhi 1 (not a target) |
| `db/fixtures/cases/_archived/c-2026-05-15-sharma-s2-01.json` | `s2` | S2 shape | partial (no a3) | Archived legacy, do not reactivate (P42) |

The five Samriddhi 2 render targets are therefore: `c-2026-05-14-bhatt-01`, `c-2026-05-15-iyengar-01`, `c-2026-05-15-malhotra-01`, `c-2026-05-15-menon-01`, `c-2026-05-15-surana-01`. Note the date prefix is the generation-run date (bhatt ran 05-14, the rest 05-15); it is not a family marker. The family marker is the `workflow` enum.

## 3. Zero-spend verdict (load-bearing)

ZERO-SPEND HOLDS. Verified by direct inspection of all five Samriddhi 2 fixtures: each carries `content.a2_classification`, `content.a3_so_what`, `content.risk_reward_stats`, `content.time_series_performance`, `content.portfolio_overlap`, `content.evidence` (e1, e2, e3, e4, e6, e7), `content.metrics` (with `assetClass`, `concentration.sectorExposureLookThrough`, `concentration.positionFlags`), and `content.section_headlines`.

The model-generated narrative text is persisted, which is the field that could have forced a WA12 gate:

- A2 verdict text: persisted. `content.a2_classification` carries per-holding verdict prose and a `reasoning_summary` (real prose, not a stub).
- A3 so-what text: persisted. In `c-2026-05-15-surana-01.json`, `content.a3_so_what.reasoning_summary` is a 447-char prose paragraph ("The action centres on concentration discipline: trim Reliance, Parag Parikh, and Axis back toward their ceilings, with Reliance staged ..."), `content.a3_so_what.deployment_narration` is 1869 chars, and `content.a3_so_what.rebalance_proposal.computed.positions` carries the glide-path steps. Rendering this requires no model call.

The deterministic producers (verified to carry no LLM call on the path that wrote the fixtures): `lib/agents/portfolio-risk-analytics.ts` (metrics, asset-class actual/target, look-through), `lib/agents/time-series-performance.ts`, `lib/agents/portfolio-overlap.ts`, `lib/agents/instrument-selection.ts`. The risk-reward rollup is `templated`, confirmed by `content.risk_reward_stats.rollup.generation_method == "templated"` in the fixtures, not an LLM rollup. The A2 and A3 Layer-2 prose was generated once during the case re-fire (PR #14) and is now frozen in the fixtures; the render reads it as data.

Conclusion: T-5.11 injects nothing model-required, and T-5.09 renders persisted data. No LLM-invoking step exists anywhere on the render-bundle path. The only place spend could ever re-enter is a deliberate full re-fire of a case (`scripts/refire-real-t0.ts`, `scripts/generate-s2-batch.ts`), which the render bundle does not require.

## 4. T-5.11 residual scope (code wins, say so)

The kickoff scopes T-5.11 as "batched injection of all the new capability fields into the five Samriddhi 2 fixtures." Per the actual fixtures, that injection is already done: PR #14 (T-5.14 + T-5.16, 2026-06-02) re-fired the five Samriddhi 2 cases end to end and wrote every capability block plus `section_headlines`. The stale `AnalysisTab.tsx:27-29` comment ("section_headlines lands in Step 5 ... until the fixture backfill, the band falls back") predates that backfill; the field is present now.

So T-5.11's residual scope is not a from-scratch sweep. It is:

- (a) Verification that all five Samriddhi 2 fixtures carry the render-required blocks. They do (section 3).
- (b) Any small deterministic render-shim field surfaced during T-5.09 (for example a relabel, or a pre-derived value a surface wants). None is currently known to be missing. The render-time derivations the surfaces need (the heatmap matrix pivot from the overlap edge-list, the rupee conversion of glide-path trims) are render concerns, not fixture fields, so they are not T-5.11 injections.

This is a product-shape observation, not a unilateral re-plan: the execution kickoff should decide whether T-5.11 stays a distinct verification gate or folds into T-5.09 pre-flight. Flagging per WA28 rather than silently collapsing it.

## 5. T-5.09 five-surface render spec

The locked spec is the external v7.2 wireframe (`15 - Product Roadmap & Build Plan/14 - Samriddhi Roadmap v14/12 - In-App Case Screen - Rajiv Surana v7.2 (Standalone).html`), read in place and never committed. Line refs below are to a line-split working copy (`/tmp/wf_v72_split.html`, also never committed). All five surfaces are fully specified in v7.2, and all five have their data already in the Samriddhi 2 fixtures. The single mount host is `components/case-detail/AnalysisTab.tsx`, whose `Props` today expose only `content: BriefingContent` and `holdings`; T-5.09 widens that contract to read the capability blocks and adds the render rows. This is the WA09 design-ships-render half of the already-shipped capabilities.

| Surface | Wireframe marker | Data it renders | Source capability and fixture field | Present in 5 S2 fixtures |
|---|---|---|---|---|
| 1. so-what | split line 1156 (`sowhat-eyebrow`), portfolio scope at 2636 | per-holding and portfolio advisor-action prose | `lib/agents/a3-so-what.ts`, `content.a3_so_what.holding_actions[].advisor_action`, `.rebalance_proposal.narrated` | Yes |
| 2. heatmap | split line 2096 (`Holdings overlap heatmap`, Layer 1 stock-level), mount 2114 | pairwise stock-level overlap matrix, diagonal blanked | `lib/agents/portfolio-overlap.ts`, `content.portfolio_overlap.per_pair` (edge-list, pivoted to matrix at render) | Yes |
| 3. SAA two-ring donut | split line 903 (`saa-radial`), 909 (`saa-radial-svg`) | four asset-class slices, outer ring actual, inner ring target | `lib/agents/portfolio-risk-analytics.ts`, `content.section_2_portfolio_overview.rows` (actual_pct, target_pct, band) and `content.metrics.assetClass` | Yes |
| 4. per-holding donut | split line 770 (`v7: per-holding donut`), 774 (`holdings-donut`) | per-holding weights, top holding centered | `holdings` from `investor.holdingsJson` (already a prop); optional look-through via `content.metrics.concentration.*LookThrough` | Yes (base); look-through populated for bhatt and surana, empty by data for iyengar, malhotra, menon |
| 5. rebalance glide-path | split line 2529 (`v7: glide-path object`), 2536 (`glide-path-svg`) | per-position trajectory current to step to target, against policy threshold | `lib/agents/a3-so-what.ts`, `content.a3_so_what.rebalance_proposal.computed.positions[].glide_path[]` | Yes |

Render-time empty states the renderer must handle (these are correct data states, not gaps): menon is near all-cash, so its heatmap, per-holding flags, glide-path, and overlap are empty by design; iyengar and malhotra have 0 percent sector look-through coverage, so their heatmap renders all-uncovered with the coverage footnote. Only bhatt and surana have populated sector look-through.

Wireframe quotes are held to minimal labels by design, so the wireframe content does not effectively land in the repo via this audit.

## 6. T-5.08 Analyst Reports port

No-math, no-schema: CONFIRMED, with one adapter caveat.

- The surface is `components/case-detail/AnalystReportsTab.tsx`. Its header reads "Samriddhi 1 Case Detail, Analyst Reports tab," and `app/cases/[id]/page.tsx` mounts it only inside the `c.workflow === "s1"` branch. So the existing component is the Samriddhi 1 source surface; the Samriddhi 2 target view does not exist yet. The component is hash-identical on `main` and on `samriddhi-1-case-generation`, so T-5.08 is not a branch-to-branch file move; it is the build of an S2-facing render of the same evidence material.
- No math: the component performs no computation beyond formatting (`confidence.toFixed(2)`, a label regex); severity is delegated to the shared `lib/format/case-accordion.ts` mapper. No schema: it defines no new persisted field.
- The adapter caveat: the Samriddhi 1 tab consumes `content.evidence_verdicts` (a 7-element list with `one_line_takeaway`), but the Samriddhi 2 fixtures carry evidence under a different shape, `content.evidence` with sub-objects `e1, e2, e3, e4, e6, e7` (no e5, no `evidence_verdicts`, no `one_line_takeaway`). Porting the surface to Samriddhi 2 therefore requires a render-side data adapter from the S2 evidence shape onto the tab's props. This stays zero-spend (the S2 evidence is already persisted) and stays no-schema (the adapter is render-side, it does not rewrite the fixture), but it is real render work, not a free re-use. The E5 omission decision (ADR-0030, tech-debt T16) is the one product-shape choice to confirm at execution; it must be done as a render adapter, not a fixture edit, or it would collide with T-5.11's write-set.

## 7. Dependency graph, write-set, disjointness

Forecast write-sets (inferred from code; nothing was written this pass):

| Sub-task | Files it writes |
|---|---|
| T-5.11 (fixture sweep / verify) | `db/fixtures/cases/c-2026-05-14-bhatt-01.json`, `c-2026-05-15-{iyengar,malhotra,menon,surana}-01.json`, plus any regeneration script it runs. Residual only (section 4). |
| T-5.08 (Analyst Reports port) | `components/case-detail/AnalystReportsTab.tsx`; likely `app/globals.css`; possibly `app/cases/[id]/page.tsx` (tab wiring). |
| T-5.09 (capability surfaces render) | `components/case-detail/AnalysisTab.tsx`; new chart subcomponents under `components/case-detail/`; likely `app/globals.css`; likely `lib/format/case-accordion.ts`; possibly `app/cases/[id]/page.tsx`. |

Dependency edges:

- T-5.11 to T-5.09: a data edge only, and now a weak one, because the data is already present (section 4). T-5.09 can build today against the committed fixtures.
- T-5.08: independent of both on data (it reads the Samriddhi 1 family, which T-5.11 and T-5.09 do not touch).

Write-disjointness:

- T-5.08 and T-5.11: fully disjoint (component plus CSS versus fixtures plus script; different families even at the fixture layer). Clean.
- T-5.11 and T-5.09: write-disjoint (fixtures and script versus components and CSS); coupled only by the now-satisfied data edge.
- T-5.08 and T-5.09: NOT disjoint. Three collision files: `app/globals.css` (the single global stylesheet; both add styling), `lib/format/case-accordion.ts` (the shared severity mapper imported by both tabs), and `app/cases/[id]/page.tsx` (the single case route that wires both tabs; there is no separate tab registry).

Implication for the later parallel-write experiment (assessment only this pass; the experiment is not run here): the cleanly disjoint pair is T-5.08 alongside T-5.11, and T-5.11 is now thin, so that pairing buys little. The two substantive render tasks, T-5.08 and T-5.09, are the ones a parallel write would want to run together, and they are the pair that collides on three shared files. So the bundle is less write-disjoint than the premise hoped. Any parallel write also remains a WA29 exception requiring explicit sanction, with the merge serial and gated under WA01 regardless of disjointness.

## 8. WA30 ADR disposition

Read against `docs/decisions/0001..0044`. Net-new ADRs required: none.

| Decision the bundle forces | Disposition | Basis |
|---|---|---|
| Render the Samriddhi 2 capability data on the case screen | already-covered | WA09 (capability ships data, design ships render): this is the design-ships-render half, not a reversal. ADR-0031 names T-5.09 as the render pass for a3_so_what. |
| Chart / render technology for the five surfaces | not architectural per WA30 / WA28 (reversible implementation choice); watch item | No chart library exists in `package.json` today. A library pick is reversible and excluded by WA30. It rises to net-new only if the design pass locks a durable cross-surface charting architecture. |
| Fixture-sweep regeneration approach | already-covered | The additive, byte-stable re-export mechanism (`scripts/refire-real-t0.ts` form) is established and WA12 / WA16 governed. |
| E5 row omission in the Analyst Reports adapter | already-covered | ADR-0030 plus tech-debt T16 record the don't-render-E5 decision on WA15 grounds; annotate T16 if implemented, write no new ADR. |
| `section_headlines` render field | already-covered | Field exists and is persisted; rendering it is the WA09 design half. |
| Absence of A1 on the Samriddhi 2 diagnostic | already-covered | ADR-0040; the render must not invent an A1 surface. |

Surface "net-new ADRs: none; chart-render technology watched" in the execution hand-off and PR body per WA30.

## 9. Debt surfaced (to log at execution per WA8 / WA24)

Surfaced here, not yet written to the per-series logs (this is an audit-only pass; numbers resolve at landing per WA24). Recommended target series in brackets.

1. [tech] The Samriddhi 1 / Samriddhi 2 framing of T-5.08 needs the execution kickoff to confirm scope. The existing `AnalystReportsTab.tsx` is the Samriddhi 1 source surface; the planner prose and ADR-0030 describe a Samriddhi 2 target. Both are coherent once read as a port (S1 source, S2 target), but the prose should be reconciled so the decision log stays unambiguous (WA13).
2. [tech] No stub-response fixtures exist for the five Samriddhi 2 cases (`fixtures/stub-responses/` covers only the sharma S1 case and the `c-2026-05-21-*` S1 set). Any future Samriddhi 2 re-fire or replay cannot use stub mode and would incur live spend or fail-fast. Does not block the render bundle; relevant to the re-fire and CI story.
3. [product] P23 is partially stale: the Samriddhi 2 rollups are now `templated` (deterministic), not `llm_fallback`, after PR #14. The entry body should be updated; this strengthens the zero-spend posture.
4. [tech] `scripts/generate-s2-batch.ts` still lists the archived `sharma-s2` case (P42). Re-running it would re-materialise `_archived/c-2026-05-15-sharma-s2-01.json` into the active cases dir. Standing follow-on; relevant only if generation is touched.
5. [ui_ux] T-5.09 renderer must handle data-driven empty states: menon all-cash (empty heatmap, per-holding flags, glide-path, overlap) and iyengar plus malhotra 0 percent sector look-through (empty heatmap with coverage footnote). Correct data states, not bugs, but they need explicit empty-state render. Related to P33.
6. [ui_ux] Per-holding donut look-through variant: if the donut must show look-through-adjusted weights rather than raw holding weights, that derived value is not a standalone fixture field and is a render-time derivation to resolve at execution.
7. [ui_ux] Heatmap matrix is a render-time pivot of `portfolio_overlap.per_pair`, and glide-path rupee amounts are render-time conversions of `trim_pct_points` against corpus. Flag so T-5.09 does not expect them as fixture fields.
8. [tech] The `AnalysisTab.tsx:27-29` comment about `section_headlines` "until the fixture backfill" is stale; the field is now present in all five Samriddhi 2 fixtures. Minor doc-staleness; the fallback is harmless. Separately, `content.a3_so_what.generation_method` is null at the top level in the committed fixtures even though the narrative prose is present, so the provenance flag understates origin; a tiny data-metadata nit.

## 10. Method note and open questions for the execution kickoff

Method (for the parallel-subagent evaluation): the three read-only subagents fanned out cleanly and returned deep, evidence-rich findings in one pass. Two of the three independently caught the orchestrator's seeded fixture-family error, which is exactly the cross-check value of independent parallel reads. The cost was that the one subagent fully downstream of the bad premise (the wireframe-to-data-presence lane) inherited it and produced a wrong "0 of 5 present" conclusion; the parallel pass did not self-resolve the resulting contradiction, so the orchestrator had to adjudicate it by reading the fixtures directly. Lesson: parallel reads catch independent angles fast, but a wrong shared premise in the brief propagates, and conflicting findings still land on the orchestrator to verify against primary evidence.

Open questions to settle at the execution kickoff (each a WA28 product-shape choice, not for silent default):

1. Does T-5.11 remain a distinct verification gate, or fold into T-5.09 pre-flight, given the capability data is already present?
2. Confirm the T-5.08 scope as an S2 evidence-shape adapter onto the existing Concept-C tab, including the E5-omission decision (render adapter, not fixture edit).
3. The chart-render technology choice (the one WA30 watch item): pick a library or hand-roll SVG per the wireframe, and decide whether that choice is durable enough to warrant an ADR.
