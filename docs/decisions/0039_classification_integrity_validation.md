# ADR 0039: Classification-integrity as a recurring validation concern

## Status

Accepted, 2026-05. T-5.12 on `features/a3-so-what`, PR #11. The manual audit that prompted it is `docs/audits/2026-05-30_classification_integrity.md`; the three logic fixes it drove (the SOV-aware credit read, the hybrid debt-residual, the passive-index handler) shipped in `lib/agents/instrument-selection.ts`. This ADR records the decision to treat classification-integrity as a standing concern and banks the audit's method as the seed-spec for a future automated pipeline. It does NOT build the pipeline.

## Context

The expanded framework classifies every instrument by reading its snapshot data (`sebi_category`, `strategy_type`, `SOV %`, `AAA %`, `Duration`, the cap split) into a sleeve / sub-sleeve / credit / duration / cap bucket. The free previews and the classification-integrity audit kept surfacing the same failure mode: the code misreads CORRECT data at an edge shape (a passive gilt-index ETF with a legitimately null `AAA %`; long-duration G-sec funds; sovereign-heavy income funds; a hybrid's debt residual; a passive index with no handler). These are logic errors, not data errors, and a data-coverage census does not catch them. As the universe grows and eventually refreshes on a schedule, ad-hoc discovery does not scale, and paying to narrate allocations built on a mis-classified security is the specific waste the audit-before-spend exists to prevent.

## Decision

**Classification-integrity is a recurring validation concern, validated by a full-path trace under an explicit two-layer taxonomy, not by a data-coverage census.** The audit's method is the reusable artifact and the seed-spec for the future dynamic data-management pipeline:

- **Two-layer taxonomy.** Layer 1 is the security's own data (a data error ships to the snapshot repo); Layer 2 is how the framework code buckets that data (a logic error is a code fix here). Every mismatch is tagged DATA or LOGIC and routed to the repo that owns it.
- **Full-path-trace procedure (per security):** read the classification-relevant fields; apply the real classification code to derive the bucket(s), citing the code path; judge whether the bucket is correct; if not, tag DATA or LOGIC.
- **Scope:** the entire universe, every instrument type, not a sample.
- **The check rules (R1 to R7), captured in the audit and carried here as the pipeline seed-spec:** R1 eligibility floor (and never let a thin/empty pool pass silently); R2 sleeve classification and its no-hint / unknown-strategy fallback; R3 credit bucket (category-primary, SOV-aware metric-secondary); R4 duration bucket; R5 cap bucket / look-through (the residual-is-international rule holds only for all-equity funds, hybrids excepted); R6 selection-pool membership (report categories correctly classified but in no pool); R7 default / fallback census (enumerate every branch that absorbs an unusual shape without positive evidence, and ask whether the default is ever the worst-direction default).

**Trigger condition (when to build the automated pipeline).** Build it when the data goes live or begins refreshing on a schedule, so the whole universe is re-validated on every refresh by R1 to R7 with each mismatch routed DATA vs LOGIC. For the static demo snapshot the manual audit suffices; the design is banked, not built (the same defer-until-the-trigger discipline as ADR-0038).

**The live path vs the latent classifier (a reconciliation the pipeline must own).** The live selection path classifies mutual funds by exact `sebi_category`-set membership into the selection pools; `classifyMfSleeve` is a parallel, currently verify-only classifier that returns null for hybrids, the international categories, Floater, and arbitrage. The automated validator should reconcile the two so a future wiring of `classifyMfSleeve` (for example the P44 holding-classification validator) does not reintroduce the gaps the audit catalogued.

**Standing data-correction policy (recorded here, UNUSED this round).** When a genuine Layer-1 data correction arises, it pushes to the snapshot repo's `main` directly, consciously and knowingly, as the primary's call (the snapshot is an immutable fixture suite, not a PR-reviewed surface). This round produced NO data correction: all three fixes were Layer-2 logic in this repo, so nothing pushed to the snapshot repo. The policy is documented so the path is clear when a data correction does come up.

## Consequences

- The classification audit becomes a repeatable, structured procedure rather than a one-off, and its output routes cleanly to the right repo.
- The pipeline is scoped and deferred, not speculatively built; the trigger is explicit.
- The two-layer discipline gives a consistent answer to "which repo fixes this", which matters as data and code evolve on different cadences.

## References

- `docs/audits/2026-05-30_classification_integrity.md` (the audit, the findings table, R1 to R7 in full).
- `lib/agents/instrument-selection.ts` (`creditBucketOf` SOV-aware, `decomposeHeldEquity` hybrid + passive-index handlers, `classifyMfSleeve` / `classifyPmsSleeve`).
- ADR-0037 (the SOV-aware credit read this validation concern hardened); ADR-0033 / ADR-0035 / ADR-0036 (the buckets validated). Product debt P47 (the dynamic data-management pipeline on the roadmap), P44 (the holding-classification validator), WA26 (persona-snapshot alignment).
