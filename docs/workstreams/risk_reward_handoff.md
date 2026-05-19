# Risk-Reward Statistics: cross-workstream hand-off

Workstream: Risk-Reward Statistics (Capability Phase, second after A2). Branch: `features/risk-reward-stats`.

This is the cross-workstream durable copy of the hand-off record (WA11: every hand-off note is dual-written, once in the workstream audit file `docs/audits/2026-05-19_risk_reward.md` and once here). If this file and the audit file's hand-off section drift, that divergence is itself the signal that the orchestration chat and Claude Code have drifted; keep them aligned.

**Status: seeded at Step 3. Expanded at Step 7 with the full shipped-surface, debt-by-receiving-workstream, and downstream interface detail.** Only the load-bearing empirical correction and the conventions delta are recorded now, per the Step 3 ruling instruction.

## Working agreements inherited

WA1 through WA12 (`docs/workstreams/a2_classification_handoff.md`, the durable WA home until the T8 conventions consolidation). WA12 (explicit API-call gate) originated in this workstream at the Step 3 ruling and binds all future workstreams.

## Load-bearing empirical correction (for downstream workstreams)

Thesis Trade-off 4 ("~86.6% of funds resolve via cap-tier fallback into the 16-index set") is empirically false. Measured over all 1,773 funds: roughly 44% resolve to a canonical-16 benchmark (clean category, source-string, or defensible-default); roughly 44% track non-canonical indices and are sentinelled; the remainder are history-sentinelled. This is the real structure of the 2026 Indian MF universe.

Two sentinels partition the non-resolvable set, and they route to different downstream owners:

- **`benchmark_structurally_inapplicable`** (multi-asset, dynamic allocation, retirement, conservative hybrid, children's, equity savings, BAF, multi-asset FoF): a single-index comparison is the wrong measurement. The **model-portfolio workstream** owns the methodology (composite benchmarks, multi-comparator, fund-is-its-own-benchmark).
- **`benchmark_not_in_snapshot`** (smart-beta, sector ex Bank/IT, target-maturity debt, non-US international, commodity ex-gold): the comparator exists in the world but not in the canonical 16. The **snapshot-data-extension workstream** owns canonical-set expansion.

Cross-references: `PRODUCT_DEBT_LOG.md` DD1/DD2/DD3 (production data debt), O1/O2/O3 (forward-audit obligations), `UI_UX_DEBT_LOG.md` UX1/UX2/UX3 (render-layer disclosure of benchmark and sentinel state). Decisions: ADR-0013 (loader consolidation) onward.

## Pointers

To be completed at Step 7: skill file, implementation, tests, backfill, review surface, decisions list, model-portfolio interface (benchmark precedence override, bucket corridors, sleeve rollup refinement), time-series interface, Capability Surfaces Design interface.
