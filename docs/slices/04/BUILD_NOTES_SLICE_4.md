# Slice 4 build notes

What landed in the IC1 deliberation layer slice, what deviated from the orientation, what was decided autonomously, what was deferred, and the notable detours encountered.

## Funding-aware delivery shape

Slice 4 ran under **Option A** per the orientation. Approximately $1.54 remained in console at slice start; live IC1 stub generation for the Sharma case was estimated at $2-4 for the five sequential Opus calls and exceeded that envelope. The slice ships the IC1 architecture code-complete with sentinel state for the canonical demo case; live deliberation content is deferred to DEFERRED.md item 12 with a trigger prompt for one-shot resumption when budget clears.

This inherits the same code-complete-defer-content pattern Slice 3 used for the original $0.95 Sharma case generation gate. The architecture is real and demonstrable end-to-end; the specific deliberation content for the demo is a one-shot operation deferred to a known trigger.

## Stack decisions confirmed

- Skill files in `/agents/` stay byte-identical. The five IC1 sub-agent skills (`ic1_chair.md`, `ic1_devils_advocate.md`, `ic1_risk_assessor.md`, `ic1_counterfactual_engine.md`, `ic1_minutes_recorder.md`) load via the same `skill-loader.ts` and call site as Slice 3's evidence and synthesis agents. No `LEAN_RUNTIME_OVERRIDES` entries required; skill-authored Opus 4.7 models apply.
- Materiality evaluation is deterministic; no LLM. The boundary between deterministic gating (materiality decides whether IC1 fires) and LLM deliberation (the five sub-agents produce the content) is the credibility move; preserved from Slice 3's governance-gates discipline.
- Per-role status discriminator pattern (orientation Q2 + scoping confirmation Option a): each IC1 sub-agent payload carries `status: "populated" | "infrastructure_ready"`. The renderer forks on the discriminator without needing presence-or-absence inspection.
- Cascade rule for the sentinel state matches the natural sequential-failure pattern of live generation: Devil's Advocate sentinel when Chair is sentinel; Counterfactual Engine sentinel when Risk Assessor is sentinel; Minutes Recorder sentinel when any of the four upstream is sentinel.
- Persistent fixture pattern carried forward: the Sharma case's materiality output and IC1 deliberation sentinel are persisted in `db/fixtures/cases/c-2026-05-14-sharma-01.json`; the seed loads the updated fixture; existing fields preserved.

## Materiality rule evaluator

`lib/agents/materiality.ts` is the deterministic gate. Reads case content (synthesis verdict, gates, evidence verdicts, ticket size) and returns `{ fires, reason, triggers }`. Four firing conditions per orientation Q1:

1. Any governance gate returns `fail`. Hard block escalates to committee.
2. Verdict `requires_clarification` or `negative` AND at least one of:
   - Severity flag from any agent (interpreted as `risk_level` in {`elevated`, `high`} on any activated agent, per the autonomous decision below)
   - S1 confidence below 0.80
   - Two or more G1 band gaps
3. Ticket size at or above Rs 5 Cr. Institutional escalation threshold.
4. Three or more amplification flags in S1 synthesis. Compound risk pattern.

The reason is a one-line human-readable composition of the firing triggers (when fires=true) or a structured audit-trail summary (when fires=false). Both are persisted on case content and surfaced on the Outcome tab.

For the Sharma case: condition 2 fires on three secondary signals (confidence 0.78, three G1 band gaps, low-confidence reading) plus condition 4 fires on four amplification flags. The verify script `scripts/_verify-materiality.ts` confirms all four paths (Sharma fires; clean small-ticket synthetic case does not; gate-fail short-circuit; large-ticket clean proposal).

## IC1 sub-agent harness

Five role-specific runners under `lib/agents/ic1/`:

| Role | Skill | File | Step |
|---|---|---|---|
| Chair | `ic1_chair.md` | `chair.ts` | 1 (parallel with Risk Assessor) |
| Risk Assessor | `ic1_risk_assessor.md` | `risk-assessor.ts` | 1 (parallel with Chair) |
| Devil's Advocate | `ic1_devils_advocate.md` | `devils-advocate.ts` | 2 (consumes Chair) |
| Counterfactual Engine | `ic1_counterfactual_engine.md` | `counterfactual-engine.ts` | 3 (consumes Risk Assessor) |
| Minutes Recorder | `ic1_minutes_recorder.md` | `minutes-recorder.ts` | 4 (consumes all four) |

The orchestrator at `lib/agents/ic1-pipeline.ts` wires the four-step sequential pattern from orientation Q3. Each runner builds its user prompt from case context plus upstream inputs (chair → devils advocate, risk assessor → counterfactual engine, all four → minutes recorder) and dispatches via the standard harness `callAgent`. Validators check the simpler renderer-shaped output (orientation Q2) rather than the skill files' richer authoring schemas; the skill body remains the system prompt unchanged.

The Devil's Advocate user prompt names the scope distinction from A1 explicitly per orientation Q3: A1 challenges what the synthesis says; Devil's Advocate challenges what the committee should conclude. The distinction also surfaces in the rendered subheading ("Challenges the committee should resolve before approval").

## STUB_MODE and sentinel state

`shouldUseSentinel(key)` in `lib/agents/stub.ts` returns true iff STUB_MODE is active AND the per-role stub fixture is missing. The IC1 orchestrator uses this gate to short-circuit each role to `{ status: "infrastructure_ready" }` with zero token usage before invoking its runner. Evidence-agent calls retain the throw-on-missing-stub behaviour; IC1 is the only consumer of the sentinel branch because Slice 4 ships code-complete-without-content per the Option A funding-aware posture.

`scripts/_verify-ic1-sentinel.ts` exercises the cascade against the Sharma case content under STUB_MODE: confirms materiality fires=true, the orchestrator returns all five sub-agent roles at `status: "infrastructure_ready"` with zero usage, and no throws on missing stubs.

The pipeline-case.ts orchestrator now calls `evaluateMateriality` after A1 synthesis and conditionally invokes `runIC1Pipeline`; the resulting `materiality` and `ic1_deliberation` fields persist on `case.contentJson`.

## Rendering surfaces

**Outcome tab.** New section at position 05 between Advisory challenges (04) and Suggested talking points (renumbered to 06; Decision to 07; Coverage to 08). Three rendering paths in `components/case-detail/IC1Section.tsx`:

1. `materiality.fires === false`: one paragraph in ink-secondary register naming the deterministic reason.
2. `materiality.fires === true` AND all five roles in sentinel state: small-caps "IC1 DELIBERATION PENDING" eyebrow plus the scoping-confirmed body prose. Visual register matches the CaseStubBadge from Slice 3.
3. `materiality.fires === true` AND any role populated: Minutes Recorder summary visible by default; expansion control reveals the four per-role contributions in order (Chair, Devil's Advocate, Risk Assessor, Counterfactual Engine). Each role respects its own status discriminator.

**Analyst Reports tab.** New eighth memo after the seven E1-E7 memos in `components/case-detail/IC1Memo.tsx`. Same institutional voice and visual register as the E memos; no shell renders when materiality fires=false; one-line "IC1 deliberation pending; infrastructure ready; awaiting live generation per DEFERRED item 12" when all sentinel; full per-role subsections when populated.

**Counterfactual supersession (Outcome tab synthesis section).** When materiality fires AND `ic1_deliberation.counterfactual_engine.status === "populated"`, the IC1 multi-path structured alternatives supersede S1's single-string `counterfactual_framing`. Section eyebrow switches to "IC1 counterfactual"; `.ic1-counterfactual` container adds a left-border accent. Falls back to S1's framing on null materiality, fires=false, or sentinel cf state.

## Deviations from the orientation

- **DEFERRED.md item numbering.** Orientation §8 said "Carry forward existing items 1-7 and 9-12 unresolved." Pre-Slice-4 state had items 1-11 (item 12 didn't yet exist). The wrap-up carries items 1-11 forward and adds items 12 (Live IC1 stub generation) and 13 (Multi-investor IC1 deliberation cases). Flagged at scoping confirmation and approved.
- **Severity flag interpretation in materiality.** Orientation Q1 referenced "severity = `flag` or `escalate` in any E1-E7 output". The Samriddhi 1 evidence verdict schema (case-verdict.ts) carries `risk_level` rather than a `severity` field. The natural translation is `risk_level` in {`elevated`, `high`}; recorded as an autonomous decision below. The Sharma case happens to fire on three other signals so this branch doesn't activate for the canonical demo, but the rule is in place for non-Sharma cases.

## Autonomous decisions during build

- **Severity-flag → risk_level mapping.** Slice 4 orientation Q1 used "severity = flag or escalate" wording. The Samriddhi 1 evidence verdict schema uses `risk_level`; mapped severity → risk_level ∈ {elevated, high} as the natural translation. Documented in materiality.ts header comment and in this build note. If the rule needs tightening (e.g., only `high`, not `elevated`), it's a one-character change in `SEVERITY_RISK_LEVELS` and a re-run of `_verify-materiality.ts`.
- **Cascade rule for sentinel state.** Downstream roles cascade to sentinel when their upstream is sentinel: Devil's Advocate when Chair is sentinel, Counterfactual Engine when Risk Assessor is sentinel, Minutes Recorder when any of the four upstream is sentinel. Matches the natural sequential-failure pattern of live generation (a step-N failure leaves step-N+1 onward unrun). The "3 of 5 succeed" scenario from the scoping confirmation works under this rule because the failure is sequential by construction.
- **Counterfactual supersession only when populated, not when sentinel.** Orientation Q4 said IC1's counterfactual supersedes S1's when IC1 fires. The cleaner reading: supersession only kicks in when IC1's counterfactual_engine is actually populated; sentinel state falls back to S1. Avoids the awkward state of "IC1 fired but its counterfactual is a pending pill replacing S1's actual framing."
- **IC1 memo absent (not blank) when materiality fires=false on Analyst Reports.** Orientation §4: "the IC1 memo is absent from Analyst Reports (no shell for a non-existent deliberation)." Implemented as `return null` in the IC1Memo component; the parent guards on `materiality && ic1Deliberation`. Cleaner than rendering an empty article.
- **Two-step JSON injection for visual verification.** The Sharma fixture is the canonical demo artifact and is committed in commit 7. For commits 4-6 visual verification, an ad-hoc `_test-ic1-rendering.ts` script injected sentinel state into the case row directly via Prisma; reverted via `npm run db:seed`. The throwaway script was removed in commit 7 once the fixture itself carried the state. `_test-ic1-supersession.ts` is preserved as a future demo helper for the populated-state path post-deferred generation.

## Notable detours

1. **Top-level await in tsx scripts.** The first verification script for commit 3 used top-level await against the `lib/agents/ic1-pipeline.ts` orchestrator; tsx rejected it with "Top-level await is currently not supported with the cjs output format." Wrapped in an `async function main()` with `main().catch(...)` per the existing `_verify-sharma-seed.ts` pattern. One-line fix.
2. **Bash zsh globbing on bracketed file paths.** `git add app/cases/[id]/page.tsx` produced "no matches found" because zsh treats `[id]` as a glob pattern. Quoting the path fixed it: `git add "app/cases/[id]/page.tsx"`. Surfaces during commit 4 staging; one round-trip.
3. **CSS variable for ledger-blue accent.** Initial commit 6 styling referenced `var(--color-ledger-blue, var(--color-ink-6))` for the IC1 counterfactual border. `--color-ledger-blue` was not defined; the fallback resolved cleanly but the indirection was noise. Replaced with `var(--color-accent)` (the defined Ledger Blue at #1F3A5F).
4. **Transient section-numbering gap during commits 4-6.** With the IC1 rendering wired (commits 4-6) but the Sharma fixture not yet updated (commit 7), the Outcome tab section numbering jumped from 04 to 06 because the IC1Section guard hid the (null materiality, null ic1_deliberation) state. Verified the gap closes when commit 7 lands; acceptable transient state across the slice's intermediate commits.

## What is functional, what is not

| Surface | State |
|---|---|
| Materiality rule evaluator | Functional |
| IC1 four-step orchestrator | Functional under STUB_MODE (sentinel cascade) and live mode (would consume budget) |
| IC1 sentinel cascade on missing stubs | Functional; verified end-to-end via `_verify-ic1-sentinel.ts` |
| Outcome tab IC1 deliberation section | Functional; Sharma case renders the all-sentinel state at position 05 |
| Analyst Reports tab IC1 memo | Functional; renders one-line sentinel body for the Sharma all-sentinel state |
| Counterfactual supersession | Functional; supersedes when populated, falls back to S1 when sentinel |
| Sharma case fixture with materiality + IC1 sentinel | Functional; seed loads cleanly; visual rendering verified |
| Live IC1 stub generation for the Sharma case | **Deferred** per DEFERRED.md item 12; ready as a single-shot operation when budget clears |
| Multi-investor IC1 deliberation cases | **Deferred** per DEFERRED.md item 13 |
| M0.IndianContext integration in IC1 (Risk Assessor + Counterfactual Engine prompts) | Soft-dependency placeholder ready; the IC1 prompts instruct the model to emit `context_not_yet_available` sentinels in the relevant fields when IndianContext is null; resolves when DEFERRED item 6 lands |

## Token usage empirical

Zero. No LLM calls in Slice 4. All commits are code, fixture, or rendering work. Live IC1 stub generation is deferred; the budget envelope is preserved for that one-shot operation post-budget-clearance.

## Cross-references

- [DEFERRED.md](../../DEFERRED.md) — items 12 and 13 added; trigger prompt for live IC1 stub generation
- [NEXT_SLICE_PROPOSAL.md](../../NEXT_SLICE_PROPOSAL.md) — Slice 5 (Model Portfolio and Data Explorer Dashboard) framing
- [BUILD_ROADMAP.md](../../BUILD_ROADMAP.md) — Slice 4 marked complete, Slice 5 recommended
- [BUILD_NOTES_SLICE_3.md](../03/BUILD_NOTES_SLICE_3.md) — pattern inheritance reference (STUB_MODE, persistent fixture, deterministic-vs-LLM honesty)
