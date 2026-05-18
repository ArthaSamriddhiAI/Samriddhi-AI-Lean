# Audit: Test discipline (PR #3 review)

- Date: 2026-05-18
- Trigger: PR #3 review discipline (A2 classification merge into main)
- Mode: read-only sweep. No code or test changes. Approved findings become T-series debt entries only.

## Audit findings

**Inventory.** Eight verification/test scripts, all under `scripts/`, all invoked individually as `npx tsx scripts/<name>.ts`. No `test` script in `package.json`, no unified runner, no CI config (`.github/workflows` absent). Scripts: `_verify-a2-classification.ts`, `_verify-materiality.ts`, `_verify-indian-context.ts`, `_verify-governance-regrounding.ts`, `_verify-ic1-sentinel.ts`, `_verify-sharma-seed.ts`, `_verify-stub-replay-sharma.ts`, `_test-ic1-supersession.ts` (older, self-described throwaway).

**Test health.** All eight scripts pass when run; `npx tsc --noEmit` is clean. No flaky, skipped, commented-out, or silently-broken tests detected. `_verify-a2-classification.ts` is 11 assertions green.

**Deterministic-logic coverage.** A2 Layer 1 is the high-water mark: 11 fine-grained tests (boundary-exact, regression guard, determinism, edge cases). `materiality.ts` has 4 tests. `m0-indian-context.ts` and governance gates G1/G2/G3 have integration verification. **Zero automated coverage** for three deterministic modules upstream of or adjacent to A2: `portfolio-risk-analytics.ts` (`computeMetrics`, the foundation A2 Layer 1 consumes), `router.ts` (`route` / `routeProposedAction`), `stitcher.ts` (`stitch`). A regression in `computeMetrics` position/sector/wrapper flag logic would propagate into A2 uncaught by any test.

**LLM-logic coverage.** Uniform across the codebase: no automated tests for LLM output. A2 Layer 2, E1-E7, S1.diagnostic, A1, and IC1 roles are all human-spot-checked at workstream review (IC1 additionally has stub-replay integrity verification). This is structurally sound (LLM output resists deterministic assertion) and is a deliberate, consistent pattern, not an A2-specific gap.

**Convention.** `_verify-<feature>.ts` (A2-introduced, now 7 instances) is the de-facto standard for deterministic verification. `_test-ic1-supersession.ts` is the lone older `_test-` instance and is throwaway. There is no `_test-llm-*` pattern (consistent with LLM testing being human-only).

**Overlap with existing debt.** Existing T3 ("No test harnesses outside M0.IndianContext") is now partially stale: A2 (`_verify-a2-classification.ts`) and materiality (`_verify-materiality.ts`) are test harnesses outside M0.IndianContext. Existing T5 ("No automated CI") already covers the CI gap. Proposed entries below are scoped to not duplicate T3/T5; the cleaner action for two of them may be an update-in-place of T3 rather than a new entry (flagged for the reviewer's call).

## Recommendations as debt entries

Proposed T-series entries (numbers assigned against the live log at implementation time per the numbering discipline; T3/T5 interaction noted). One per finding worth tracking.

| Proposed | Description | Severity | Originating | Target fix | Note vs existing |
|---|---|---|---|---|---|
| TC-a | Deterministic test coverage for `portfolio-risk-analytics.ts` (`computeMetrics`): HHI tiers, the four threshold boundaries under the ADR 0005 convention, wrapper-count logic, liquidity buckets. A2 Layer 1 anchors to this module's output; it is the highest-value gap. | Medium | A2 Slice 4.6a Step 5/PR-review test audit | A coverage pass on M0 deterministic modules | Supersedes the stale half of T3; recommend a new T entry and an in-place update marking T3 partially-addressed. |
| TC-b | Deterministic test coverage for `router.ts` activation logic (diagnostic vs proposed_action, each E-agent applicability condition, empty/single-asset edges). | Medium | same | same | New T entry; relates to T3. |
| TC-c | Deterministic test coverage for `stitcher.ts` (StitchedContext shape, pre-observation derivation from metric thresholds, no-invention discipline). Lower priority: stitcher failures are partly caught by S1 schema validation. | Low | same | same | New T entry; relates to T3. |
| TC-d | No unified test runner / `npm test` / CI. All verification is manual individual invocation. | Low | same | Slice 7 or a dedicated CI workstream | Largely **already T5**. Recommend updating T5 in place to note the `_verify-*` suite, not a new entry. |
| TC-e | Document `_verify-<feature>.ts` as the going-forward deterministic-verification naming convention; retire the `_test-` prefix once `_test-ic1-supersession.ts` is removed. | Very low | same | Conventions consolidation (see the conventions audit) or Slice 7 | New, very low; could fold into the conventions-consolidation outcome rather than its own entry. |

## Out of scope

Not worth a debt entry:

- LLM agents tested by human spot-check only: deliberate, uniform, architecturally sound. Not a defect.
- No mocking/DI framework: deterministic verifications are integration-style against real fixtures; failures surface clearly. Acceptable for the MVP.
- Shallow fixture set for governance re-grounding (1 S1 + 6 S2): structural (S2 has no gates), not a test gap.
- Stub-replay instead of live LLM tests for IC1: intentional (spend, determinism).
- `_verify-materiality.ts` self-marked throwaway: on track, not broken.
