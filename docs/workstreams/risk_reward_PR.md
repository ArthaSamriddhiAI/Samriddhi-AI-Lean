# Risk-Reward Statistics: return-evidence layer for Samriddhi 2

> Awaiting product-owner review. Per WA1 (refined: squash-merge with explicit confirmation gate), CC may execute the squash-merge only after an explicit owner affirmative to a single-purpose confirmation question; CC does not self-merge without it.

Second Capability Phase workstream after A2. Ships the return-evidence data layer that lets the diagnostic vocabulary say true things about risk-adjusted returns (the `fee_inefficiency` and `complexity_premium_not_earned` observations depend on it). Data only; no UI surfaces (WA9).

## Scope shipped

- **Loader consolidation (ADR-0013, ADR-0016).** `loadSnapshot` reads `fixtures/snapshots/enriched/` as canonical; `Snapshot`/`MutualFundRow`/`SnapshotMetadata` extended with optional enriched fields (`TierBStats`, `indices`, `fx`, `monthly_prices`, provenance, `_benchmark_resolution`). Pre-enrichment source dir retired (it was gitignored local-only; enriched was the sole tracked dir since PR #4).
- **Fund NAV regeneration (ADR-0014, Option A).** Fund `monthly_nav` regenerated as a deterministic single-factor co-movement series on the resolved benchmark, preserving each fund's `vol_3y`/`sharpe_3y` exactly while making benchmark-relative metrics meaningful (a Sensex ETF reads R-squared about 0.99, not the pre-fix 0.01). Across t0..t8.
- **Calendar-aligned recompute (ADR-0015).** Fund `beta_3y`/`r_squared_3y`/`tracking_error_3y`/`information_ratio_3y` recomputed on the shared-month intersection (a scoped refinement of ADR-0012's tail-align for the funds data shape; stocks keep tail-align). 921 to 943 funds resolved per snapshot.
- **benchmark_resolution mapping (ADR-0017).** Source-string-first, tracked-index detector, category-clean and defensible-default fallbacks, two-sentinel partition (`benchmark_structurally_inapplicable` / `benchmark_not_in_snapshot`).
- **Risk-reward-stats agent (ADR-0018/0019/0020/0021).** `lib/agents/risk-reward-stats.ts`: Layer 1 deterministic (per-holding read-through; Tier C synthesised-series sleeve and portfolio aggregation, never weighted-average-of-Sharpes; sentinel taxonomy; three-way do-not-mix). Layer 2 templated rollup with an LLM fallback for enumerated edge cases. Synthetic-forward disclosure derived and runtime-guarded. Skill at `agents/risk_reward_stats.md`.
- **Pipeline integration.** `router.ts` `riskRewardStats` gate; `pipeline.ts` persists `content.risk_reward_stats` alongside `a2_classification`; renderer untouched.
- **Fixtures backfilled.** All 6 S2 case fixtures gain `content.risk_reward_stats` additively (1573 insertions, 0 deletions; zero long dashes added; frozen prose byte-identical).
- **Repo hygiene.** Working agreements migrated to `docs/working_agreements/` (per-file; closes T8); `docs/` reorganised (`debt/`, `reference/`); root `README.md` authored; WA12 (API-call gate) adopted.

## Schema additions

`content.risk_reward_stats`: `{ snapshot_context, risk_free_rate, per_holding[], per_sleeve[], portfolio, rollup, reasoning_summary }`. Snapshot types gain `TierBStats` (with `_benchmark_resolution`, `_meta.benchmark_index_id`), `indices`, `fx`, `Nifty500Company`. Additive and backward-compatible.

## Metrics implemented

Per-instrument (read-through): vol/Sharpe/Sortino/maxDD (3Y and 5Y), Calmar/beta/R-squared/tracking-error/information-ratio (3Y). Per-sleeve and per-portfolio: the same set computed fresh on a market-value-weighted synthesised return series (ADR-0012 formulas, RF 5.25%, calendar-aligned benchmark).

## ADRs landed (filename-numbered)

0013 loader consolidation; 0014 fund NAV regeneration (Option A); 0015 calendar-aligned recompute; 0016 source-dir consolidation complete; 0017 benchmark_resolution mapping; 0018 Tier C aggregation and sleeves; 0019 sentinel taxonomy and do-not-mix; 0020 rollup and synthetic-forward disclosure; 0021 sibling-agent placement.

## Debt entries surfaced

- `docs/debt/PRODUCT_DEBT_LOG.md`: T13 (storage format); P15-P21 (Option C calibration, Sortino instability, RF configurability, production data-onboarding, bucket corridors, sleeve phrasing, S1 deferral); D8 (cluster-3 remainder); O1-O5 (forward-audit obligations, WA10 discipline, execution patterns); DD1-DD3 (production data debt; T8 marked resolved).
- `docs/debt/UI_UX_DEBT_LOG.md`: UX1-UX9 (per-stat benchmark disclosure, sentinel display, canonical-set visibility, S2-tab render, synthetic-forward visual, rollup placement, PDF, slides, archived cases).

## Dual-write completeness

Every load-bearing decision exists as an ADR (`docs/decisions/0013-0021`) and is referenced in the audit doc (`docs/audits/2026-05-19_risk_reward.md`) and the cross-workstream hand-off (`docs/workstreams/risk_reward_handoff.md`). No decision lives only in code comments or PR notes.

## No UI changes

Confirmed: no components, columns, tabs, accordion rows, or visual surfaces added. The S2 Analysis tab is unchanged; risk-reward ships data into fixtures and the pipeline only (WA9). Render decisions are deferred to the Capability Surfaces Design workstream (UI_UX UX1-UX9).

## Test plan

- [x] `npm run typecheck` clean across all consumers.
- [x] `scripts/_verify-loader-enriched.ts` (loader reachability + backward-compat).
- [x] `scripts/_verify-snapshot-enrichment.ts` (regime-narrative contract; Probe 4 refactored for ADR-0014 to assert the rate-cut beat at the gilt index plus beta-scaled fund propagation).
- [x] `scripts/_verify-risk-reward.ts` (19 deterministic + regime probes: read-through equality, sentinel taxonomy, sleeve aggregation, rollup, synthetic-forward guard, Bhatt t0/t5/t6 directional regime validation).
- [x] HARD CHECKPOINT 2 candidate stats (Shailesh/Bhatt) reviewed and approved.
- [x] Data review of all 6 backfilled S2 fixtures approved.
- [ ] Product-owner review and squash-merge (this PR).
