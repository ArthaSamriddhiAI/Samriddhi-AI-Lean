# Risk-Reward Statistics: cross-workstream hand-off

Workstream: Risk-Reward Statistics (Capability Phase, second after A2). Branch: `features/risk-reward-stats`.

This is the cross-workstream durable copy of the hand-off record (WA11: every hand-off note is dual-written, once in the workstream audit file `docs/audits/2026-05-19_risk_reward.md` and once here). If this file and the audit file's hand-off section drift, that divergence is itself the signal that the orchestration chat and Claude Code have drifted; keep them aligned.

**Status: completed at Step 7.** Seeded at Step 3 with the load-bearing empirical correction and the conventions delta; expanded here with the full shipped-surface, downstream interfaces, and pointers.

## Working agreements inherited

WA1 through WA12 (`docs/workstreams/a2_classification_handoff.md`, the durable WA home until the T8 conventions consolidation). WA12 (explicit API-call gate) originated in this workstream at the Step 3 ruling and binds all future workstreams.

## Load-bearing empirical correction (for downstream workstreams)

Thesis Trade-off 4 ("~86.6% of funds resolve via cap-tier fallback into the 16-index set") is empirically false. Measured over all 1,773 funds: roughly 44% resolve to a canonical-16 benchmark (clean category, source-string, or defensible-default); roughly 44% track non-canonical indices and are sentinelled; the remainder are history-sentinelled. This is the real structure of the 2026 Indian MF universe.

Two sentinels partition the non-resolvable set, and they route to different downstream owners:

- **`benchmark_structurally_inapplicable`** (multi-asset, dynamic allocation, retirement, conservative hybrid, children's, equity savings, BAF, multi-asset FoF): a single-index comparison is the wrong measurement. The **model-portfolio workstream** owns the methodology (composite benchmarks, multi-comparator, fund-is-its-own-benchmark).
- **`benchmark_not_in_snapshot`** (smart-beta, sector ex Bank/IT, target-maturity debt, non-US international, commodity ex-gold): the comparator exists in the world but not in the canonical 16. The **snapshot-data-extension workstream** owns canonical-set expansion.

## Systematic-negative information ratio (methodology consequence, for model-portfolio)

Fund-level information ratio runs systematically negative across the dev-phase data because Option A regeneration (ADR-0014) preserves fund volatility while synthesised canonical indices use a tighter volatility envelope than real-world indices. This elevates beta values, which produces negative active returns and therefore negative IR by construction. The diagnostic vocabulary's negative-IR interpretation (complexity-premium-not-earned, fee-inefficiency) is consistent with the demo seed's curated intent. Production data with real index vol envelopes would not exhibit this systematic property; per-case IR would vary in sign and magnitude per actual fund performance. The model-portfolio workstream calibrating corridors against this data should account for this systematic methodology consequence rather than treat negative IR as the empirical norm. Cross-references ADR-0014.

Cross-references: `docs/debt/PRODUCT_DEBT_LOG.md` DD1/DD2/DD3 (production data debt), O1/O2/O3 (forward-audit obligations), P15/P16 (Option C deferral, Sortino instability), `docs/debt/UI_UX_DEBT_LOG.md` UX1/UX2/UX3 (render-layer disclosure of benchmark and sentinel state). Decisions: ADR-0013 (loader consolidation), ADR-0014 (fund NAV regeneration), ADR-0015 (calendar-aligned recompute) onward.

## What this workstream shipped

- Loader consolidation: `loadSnapshot` reads the enriched suite as canonical (ADR-0013); the source dir is retired (ADR-0016).
- Fund `monthly_nav` regenerated for index co-movement (Option A, ADR-0014) and the per-fund benchmark-relative Tier B recomputed calendar-aligned (ADR-0015), across t0..t8; `vol_3y`/`sharpe_3y` preserved exactly, beta a calibrated output.
- `benchmark_resolution` mapping (ADR-0017): 921 to 943 funds resolved to a canonical-16 benchmark; the rest carry the two partition sentinels.
- The risk-reward-stats sibling agent (ADR-0021): Layer 1 deterministic (per-holding read-through plus Tier C synthesised-series sleeve and portfolio aggregation, ADR-0018; sentinel taxonomy and do-not-mix, ADR-0019); Layer 2 templated-plus-LLM-fallback rollup with synthetic-forward disclosure (ADR-0020). Routed through the pipeline as `content.risk_reward_stats`; renderer untouched (WA9).
- All 6 S2 fixtures backfilled additively with `content.risk_reward_stats`.
- Deterministic tests: `_verify-risk-reward.ts` (19 probes) plus the loader and enrichment verify scripts; review surface `_print-risk-reward.ts`.

## Downstream interfaces

**Model-portfolio workstream.** Risk-reward ships numbers and a defensible-default benchmark mapping; model-portfolio ships the judgement frame. Override seams: (a) the `benchmark_resolution` mapping (ADR-0017) is the configurable artifact, overridable per fund for house-view benchmarks; (b) bucket-level Sharpe / IR / Calmar corridors are slot-but-not-filled (P19); (c) sleeve rollup phrasing is refinable (P20). Read the systematic-negative-IR disclosure above before calibrating corridors against this data. The `benchmark_structurally_inapplicable` funds need model-portfolio's composite or multi-comparator methodology.

**Time-series workstream.** Shares the enriched return-data layer (`monthly_nav`, `monthly_prices`, `indices`, `fx`) that risk-reward consumes but does not own; the interface is the snapshot schema (ADR-0007 / ADR-0012), not anything risk-reward defines. Fund `monthly_nav` is now index-co-moved (ADR-0014), so a consumer reading fund NAV paths should know they are synthetic-by-construction for funds (as stock prices already are).

**Snapshot-data-extension workstream.** Owns expanding the canonical-16 set to cover the `benchmark_not_in_snapshot` funds (smart-beta, sector ex Bank/IT, target-maturity debt, non-US international, commodity ex-gold); see DD3.

**Capability Surfaces Design workstream.** Receives risk-reward's data layer; render decisions are deferred (`UI_UX_DEBT_LOG.md` UX1 to UX9): per-stat benchmark disclosure, sentinel display register, synthetic-forward visual, rollup placement, S2-tab render, PDF, slides.

## Integration posture with E6 and the broader S2 pipeline

E6 (PMS/AIF/SIF evidence agent) fires in the S2 diagnostic pipeline today and produces `complexity_premium_earned` per holding, which flows to S1 (diagnostic mode) via pre-observations and to A2 (classification) via per-holding drivers. Risk-reward sits alongside E6 in the same pipeline, providing the return-evidence layer (Sharpe, Sortino, beta, R-squared, and the rest) on the evaluable surface and sentinelling PMS/AIF for return-evaluation purposes.

The two agents are complementary. Risk-reward does not evaluate craft-layer dimensions; E6 does not evaluate return statistics. Future workstreams combining both into a richer per-holding claim should target the interpretive verdict layer (`agents/m0_portfolio_risk_analytics.md`, currently unbuilt) or extend A2's per-holding drivers, not risk-reward itself.

The four-thesis framework specified in the first principles section (`docs/reference/pms_aif_first_principles.md`) is currently surfaced to the diagnostic consumer via the `pms_aif_framework_notice` structured field on the risk-reward stats record. The framework is not evaluated by any agent today; the notice is a static pointer. A future workstream upgrading E6 to enforce the four-thesis decision tree (P22) replaces this static notice with structured per-holding thesis verdicts.

Live-versus-fixture rollup divergence: the live S2 pipeline uses `runRiskRewardDeterministic` (templated rollup, no API). The 6 backfilled S2 fixtures carry LLM-generated rollups from the Step 5 backfill. This divergence is deliberate (cost-controlled live generation, reviewable curated fixtures). Future workstreams desiring live LLM rollups must handle WA12 explicitly at the runtime layer (P23).

## Pointers

- Skill: `agents/risk_reward_stats.md`.
- Implementation: `lib/agents/risk-reward-stats.ts` (Layer 1 `computeRiskReward`; orchestrators `runRiskRewardDeterministic` and `runRiskRewardStats`; sleeve aggregation with calendar-aligned benchmark-relative; sentinel taxonomy). Router gate: `lib/agents/router.ts` (`riskRewardStats`). Pipeline: `lib/agents/pipeline.ts` (`content.risk_reward_stats`).
- Data regeneration and recompute: `scripts/regenerate_fund_nav.py` (`--validate` / `--write` / `--recompute`).
- Tests and tooling: `scripts/_verify-risk-reward.ts`; review surface `scripts/_print-risk-reward.ts`; backfill `scripts/backfill-risk-reward.ts` (dry-run plus write).
- Decisions: `docs/decisions/0013` through `0021`. Audit body: `docs/audits/2026-05-19_risk_reward.md`.

## Known open questions for future validation

- Option C joint-solve calibration (P15) would let beta be pinned in conventional ranges; until then beta runs elevated for equity in dev-phase data (ADR-0014 beta-interpretation note).
- Sortino is unstable for ultra-low-vol categories (P16); the diagnostic does not lean on it there.
- Production data replaces the regeneration; the benchmark mapping persists as the configurable artifact (DD1).
