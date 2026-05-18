# Engineering Audit: A2 Classification Agent

- **Date:** 2026-05-18
- **Workstream:** A2 classification (Capability Phase, Slice 4.6a)
- **Branch:** `features/a2-classification`
- **Canonical references:** `A2_Product_Thesis.md` (what and why), `a2_classification_skill.md` (how A2 behaves)
- **Scope:** data layer only (skill file, schema, deterministic verdict logic, LLM reason text, native pipeline generation, fixtures). Render is deferred to the Capability surfaces design workstream.

This is the durable institutional record of how A2 was built and what alternatives were weighed. Future maintenance of A2 starts here, not in git history or chat threads.

## Audit

**Agent harness.** One entry point, `callAgent({ skillId, userPrompt, validate, stubKey? })` in `lib/agents/harness.ts:78`. There is no registry or enum: an agent exists by having a skill file at `agents/<skillId>.md` and a TypeScript module that calls `callAgent`. Skill files load via `lib/agents/skill-loader.ts:146`. Naming convention is `agents/<agent_id>.md` with no `_skill` suffix (confirmed against `a1_challenge.md`, `m0_portfolio_risk_analytics.md`, `s1_diagnostic_mode.md`). A2's file is therefore `agents/a2_classification.md` with `agent_id: a2_classification`.

**A1 plug-in precedent.** `lib/agents/case/a1-case.ts:129` is the closest precedent: a module with `buildPrompt`, an inline `validate`, and an exported `run*` that calls `callAgent`. A1 is also the discipline precedent ("critical reviewer, not antagonist", "no decision language"). A2 shares the descriptive, no-recommendation posture but has a different job: per-holding classification, not synthesis challenge.

**Two-layer precedent (M0.PortfolioRiskAnalytics).** `lib/agents/portfolio-risk-analytics.ts:235` `computeMetrics()` is pure deterministic TypeScript and exports the foundation thresholds as constants: `POSITION_FLAG_PCT=10`, `POSITION_ESCALATE_PCT=15`, `SECTOR_FLAG_PCT=25`, `SECTOR_ESCALATE_PCT=35`, `WRAPPER_COUNT_FLAG_PMS=4`, `WRAPPER_SHARE_FLAG_PCT=25`, plus `HHI_CEILING_BY_TIER`, `LIQUIDITY_TIER_FLOOR`, `BUCKET_BY_SUBCATEGORY`. M0's "Layer 2" is not a separate runner; S1.diagnostic does the LLM interpretation. The real codebase pattern A2 follows: a deterministic TS module plus a `callAgent` LLM call.

**S2 pipeline and insertion point.** `lib/agents/pipeline.ts:69` `runDiagnosticPipeline` is the S2 path (`case_mode: "diagnostic"`). Sequence: load investor holdings, `computeMetrics`, `route`, run E1-E7 in parallel, `stitch`, `runS1Diagnostic`, build `fullContent`, persist. A2 inserts after S1 returns (`pipeline.ts:179`) and before `fullContent` (`pipeline.ts:199`). At that point in scope: `holdings` (full `StructuredHoldings`), `metrics` (PortfolioMetrics), `evidence` (E1-E7), `stitched`, `briefing`, `investor`, `asOfDate`.

**E4 on S2 (the most material open question), resolved.** E4 runs on every S2 case (`lib/agents/router.ts`: `e4 = caseMode === "diagnostic"`; dispatched at `pipeline.ts:117`). All 6 S2 fixtures carry it at `content.evidence.e4`. Its `stated_vs_revealed_divergence` is `{ direction, magnitude, implication }`, investor-level, not keyed to holdings (the `implication` is prose that may name a holding but has no structural per-holding key). The stitcher already promotes material divergence to a `stated_revealed_divergence` pre-observation that S1 surfaces as a portfolio headline. No new mechanism is required: A2 reads `evidence.e4` directly from pipeline scope.

**Schema convention.** Plain TypeScript types (no Zod, JSON Schema, or Pydantic). The case is a JSON blob: `Case.contentJson String` in Prisma, persisted as `{ briefing, metrics, router_decision, evidence, usage_summary }` (`pipeline.ts:199`). The on-disk fixture wraps that under `content`. The `output_schema_ref` in skill frontmatter is documentation only (a1/m0 reference `schemas/*.json` files that do not exist; validators are inline `validate()` functions). A2 follows that: inline validator, no schema file.

**Render tolerance (working agreement 9).** `app/cases/[id]/page.tsx:185-193` parses `c.contentJson` and reads only `parsed.briefing`; S2 holdings come from `investor.holdingsJson`, not case content. A new `content.a2_classification` key is invisible to the renderer. Zero render changes; no tolerance shim needed.

**Fixture round-trip and backfill precedent.** `db/seed.ts:467` loads `db/fixtures/cases/*.json` and re-stringifies `content` into `Case.contentJson`. A key added inside a fixture's `content` round-trips with no seed change. `scripts/generate-s2-batch.ts` regenerates all 5 non-Bhatt S2 cases via the pipeline (costs spend, churns frozen briefings). `scripts/export-case-fixture.ts` serializes one case. The accordion PR backfilled `section_headlines` additively into committed fixtures rather than regenerating.

**Notable findings.**
- No existing skill file needs editing. The build prompt hypothesized `s1_diagnostic_mode.md` might need an A2 reference; it does not, because A2 runs after S1 in TS orchestration and never feeds S1's prompt. Native generation is achieved purely by wiring A2 into `pipeline.ts`.
- Temperature nuance: `harness.ts:132` drops `temperature` for any `claude-opus-4*` model. The skill frontmatter declares `temperature: 0.3`; on Opus 4.7 this is not applied. Acceptable because the verdict is Layer 1 (deterministic) and the skill permits reason-text phrasing to vary.
- No test runner exists (PRODUCT_DEBT_LOG T3). The codebase test pattern is `scripts/_verify-*.ts` run via `npx tsx`. A2's mandatory Layer 1 test follows that pattern.
- PRODUCT_DEBT_LOG P4 already anticipated this workstream as Slice 4.6a; the coverage-validation pass is already logged as future debt.
- Bhatt is "Shailesh" (`c-2026-05-14-bhatt-01.json`, investor `bhatt`, 12 holdings). The `section_7` appendix is a 10-row S1-curated subset; A2 classifies all 12 from `StructuredHoldings`, not the appendix.

## Design Proposal

**Two-layer structure** (`lib/agents/a2-classification.ts`):
- Layer 1, `classifyHoldings(input)`: pure, deterministic, no LLM, no `Date.now`, no randomness. Imports the M0 threshold constants so the foundation numbers have a single source of truth. Same evidence in produces the same verdict out. This is the audit surface.
- Layer 2, `runA2ReasonText(layer1)`: one Claude call per case (all drivers batched), `callAgent({ skillId: "a2_classification" })`, no `stubKey` (matches `runS1Diagnostic`; the S2 path is live-then-frozen-to-fixture, not stub-replayed). Returns reason strings only.
- `runA2Diagnostic(input)`: orchestrates Layer 1 then Layer 2 and merges reason strings into the Layer 1 structure in TypeScript. Layer 2 structurally cannot change a verdict because the verdict and driver list are never read back from the LLM.

**Pipeline wiring.** `runDiagnosticPipeline` calls A2 after S1, adds `a2_classification` to `fullContent`, folds Layer 2 tokens into `usage_summary` and the token-budget check. No Prisma migration (JSON blob), no render change, no seed change.

**Resolution of the skill file's open questions.**
1. E4 on S2: available at `content.evidence.e4`, investor-level. A2's `behavioural` driver does not independently propagate per-holding; it fires only as a corroborator capped at `watch` severity on a holding that already carries a holding-scope driver. Deterministic, no prose parsing.
2. Schema convention: TypeScript types plus inline `validate()`; persisted as the `content.a2_classification` JSON blob.
3. Backfill: an additive `scripts/backfill-a2.ts` that computes A2 from each fixture's frozen holdings/metrics/evidence and injects `content.a2_classification`. Frozen briefings untouched; no regeneration spend.

**Native-generation skill edits:** only the new `agents/a2_classification.md`. No other skill file edited.

**Tests:** `scripts/_verify-a2-classification.ts` asserts Layer 1 determinism (same input twice, byte-identical) and reproduces the skill's 4-PMS Worked Example as a fixture, plus escalate, default-to-Maintain, behavioural-corroborator, and unable_to_classify paths.

## Reconciliations

The skill file is internally ambiguous in two places. Both are logged as PRODUCT_DEBT_LOG P10 and P11 for the next skill revision. Verdict tiers are unaffected by either; only driver-list detail and severity mapping are involved.

1. **Motilal position driver (P10).** The Worked Example prose says "Motilal 10%" but the Layer 1 table gives Motilal no `position_concentration` driver. A2 anchors the position threshold to M0 (`>= 10%` flags; A2 must not invent thresholds, per the skill's own Discipline). Under M0, exactly 10% flags. The verify fixture uses Motilal 9.8%, which is within the skill's own stated range ("approximately, between 8% and 11%"), so the table's intended driver set is reproduced without diverging from the M0 boundary.

2. **complexity_premium severity (P11).** The skill's Review rubric row reads "complexity premium not earned and material" (implying escalate), but the Worked Example classifies Motilal's `complexity_premium` as a flag (Discuss). "Material" has no deterministic numeric signal available from E6's contract. A2 maps E6 `complexity_premium_earned: "no"` to flag (Discuss) and `"mixed"` to watch (Monitor). A wrapper reaches Review only via a broken thesis (E6 `overall_verdict: "negative"`). This makes the Worked Example reproduce exactly and avoids inventing a "material" threshold.

## Alternatives Considered

- **Layer 2 model: Sonnet via runtime override vs Opus 4.7 from frontmatter.** Recommended Sonnet (honors `temperature: 0.3`, matches the rest of the S2 pipeline economics, skill file stays byte-identical). Decision (Checkpoint 1, product owner): keep Opus 4.7 per the skill frontmatter. Consequence: `harness.ts:132` drops temperature for opus-4*; accepted because verdicts are deterministic Layer 1 and reason-text phrasing is permitted to vary. Only `max_tokens` is overridden at runtime (skill default 2000 is tight for batched reasons across ~12 holdings; the harness hard-fails on a max_tokens stop). Recorded as ADR 0004.

- **Wrapper-opacity sentinel.** Considered adding an `unable_to_classify` path for PMS/AIF holdings whose look-through is unavailable. Rejected: skill edge case 1 states this is normal (A2 operates at the holdings-row level; the wrapper is the holding) and explicitly says no sentinel is needed. `unable_to_classify` is reserved for edge case 2 (M0 metrics genuinely missing). E6 `cannot_evaluate` for a specific product is treated as opacity (no driver), not as missing evidence.

- **Editing `s1_diagnostic_mode.md` for native generation.** Considered because the build prompt hypothesized it. Rejected: A2 runs after S1 as TS orchestration and never feeds S1's prompt; editing it would be an unnecessary change to a canonical skill file (also against the working agreement on not editing other skill files unless required). Native generation is achieved entirely by `pipeline.ts` wiring.

- **Prose-parsing E4's `implication` to attach behavioural per holding.** Rejected: E4 output is investor-level with no structural per-holding key; deterministically parsing prose to decide which holdings it touches would be non-deterministic and fragile, violating the Layer 1 replayability discipline. Chosen instead: behavioural is a corroborator, watch-capped, only on holdings that already carry a holding-scope driver. Recorded as ADR 0003.

- **Full pipeline regeneration for backfill.** Rejected: re-running `generate-s2-batch.ts` would cost $5-10 in API spend and rewrite the expensive frozen S1 briefings (unwanted churn). Chosen: additive injection that preserves frozen content and only adds `content.a2_classification`.

- **Position "outside model sub-allocation band, below 10%" Monitor tier.** The skill's holding-level table defines a Monitor band for a position outside its model sub-allocation band but below 10%. There is no deterministic per-holding sub-allocation-band signal in `metrics` (sub-allocations are per sleeve and not computed per holding). Rather than invent one, A2's `position_concentration` driver fires only at the M0 flag (10%) and escalate (15%) boundaries; a sub-10% holding with no other signal defaults to Maintain. This is faithful to "Default to Maintain" and "A2 does not invent thresholds"; a future refinement could add per-sleeve sub-allocation band checks.

- **Separate `fee_inefficiency` driver distinct from `complexity_premium`.** No clean deterministic numeric signal exists in E6 for a standalone fee-inefficiency driver beyond the complexity-premium read. To avoid inventing a signal, A2 surfaces the material case through `complexity_premium`; a dedicated `fee_inefficiency` driver is not fabricated in Layer 1.

- **`regulatory` driver in Layer 1.** E3 (macro, policy, news) is not cleanly keyed per holding. No deterministic per-holding regulatory signal is available, so A2 does not emit a `regulatory` driver in Layer 1 rather than guess.

- **Holdings source: `section_7` appendix vs `StructuredHoldings`.** The briefing's `section_7_evidence_appendix` is an S1-curated subset (10 of Bhatt's 12). A2 must classify every holding, so it reads the canonical full holdings list (`db/fixtures/structured-holdings.ts`, the same source seeded into `investor.holdingsJson`).
