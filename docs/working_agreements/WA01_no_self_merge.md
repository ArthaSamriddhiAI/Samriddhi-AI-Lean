# WA01: Squash-merge with explicit confirmation gate

## Agreement

**WA1 (squash-merge with explicit confirmation gate).** When a PR is ready for merge (tests green, all reviews complete, all close-out commits landed), CC may execute the squash-merge via `gh pr merge --squash` under owner-authenticated `gh` credentials. Squash-merge requires an explicit confirmation gate: CC stops, asks the owner directly "are you sure you want me to squash-merge PR #N now?" as a single-purpose message, and waits for explicit affirmative approval ("yes", "merge it", "go", or equivalent unambiguous affirmative) before executing. Ambiguous responses, non-responses, or any non-affirmative response means CC does not merge; the PR stays open until explicit approval lands. The confirmation gate exists because the merge is the moment the work ships and the owner owns that moment; the gate preserves owner authority without requiring the owner to operate GitHub UI directly.

## Rationale

The original WA1 ("the product owner reviews and squash-merges through the GitHub UI") required the owner to operate GitHub manually at every workstream close. That friction became apparent at the risk-reward workstream close (PR #5), where the work was complete, reviewed, and pushed, and the only remaining step was a UI click. The refinement removes the UI friction while preserving owner authority: the merge still cannot happen without an explicit affirmative from the owner, delivered in response to a single-purpose confirmation question. The explicit-confirmation-gate pattern mirrors WA12 (the API-call gate) in spirit: a sensitive, hard-to-reverse action stops and surfaces for a deliberate yes before it fires. The failure mode it still prevents: CC merging its own work without the owner having chosen that moment.

## Trigger

This refinement was born at the risk-reward workstream close (PR #5), driven by the owner's instinct that the rule needed evolution rather than abandonment: the no-self-merge discipline was sound, but its UI-only mechanism was friction, and an explicit-confirmation gate keeps the discipline while removing the friction. (The original no-self-merge rule was transcribed from the out-of-repo CC build prompts and restated by the owner at the M0.IndianContext integration.)

## Examples

**Compliance:** PR #5 is ready (tests green, close-out commits landed). CC stops and asks, as a single-purpose message, "are you sure you want me to squash-merge PR #5 now?"; the owner replies "yes"; CC runs `gh pr merge 5 --squash` and reads back the merge SHA.

**Non-compliance:** CC says "merging now" and runs `gh pr merge` without an explicit confirmation message; or CC treats an ambiguous reply ("sounds good", "nice") as approval and merges; or CC merges with no owner response at all. In each case the merge happened without an unambiguous affirmative to the confirmation question.

## Cross-references

WA12 (explicit API-call gate; the same stop-and-confirm pattern for a sensitive action). WA04 (workstream-template duplicate of the no-self-merge posture; consolidate in the eventual conventions doc). `docs/workstreams/a2_classification_handoff.md` (conventions inheritance). This supersedes the prior "owner squash-merges via the GitHub UI" wording wherever it is quoted.

## Clarification note

**Clarification note, 2026-05, T-5.07 workstream:** WA01 extends to
respect of repository-level merge protections on `main` (and any other
protected branches). Branch protection rules take precedence over
primary-authorized exceptions, including the single-purpose confirmation
gate established in the refined agreement. If a primary-authorized fix
requires bypassing protection rules (force-push, direct push to a
protected branch), the legitimate paths are: (a) the primary lifts the
protection temporarily as an admin action, then re-enables, with the fix
happening in the gap; (b) the fix routes through a PR like any other
change; (c) the fix is abandoned and the planner chat triages the root
cause. Force-push attempts on protected branches are not legitimate
even with primary verbal authorization and an unambiguous affirmative
reply to a confirmation prompt; infrastructure-level discipline is
authoritative.

**Provenance:** PR #8's squash-merge commit on `main` was missing the
`(#8)` suffix due to a one-off template glitch. The T-5.07 workstream
attempted to amend the message and force-push with primary's
authorization. The push was correctly rejected by `main`'s
`non_fast_forward` protection rule. The fix was abandoned; the
bare-subject commit remains on `main` as a small historical artifact;
the `(#N)` convention is preserved going forward (PR #9 demonstrates).
The lesson: infrastructure-level guardrails do real discipline work
even when humans authorize exceptions, and the right response to a
guardrail firing is to respect it, not to route around it. The
authorisation framing in the refined WA01 governs *what CC may execute*;
infrastructure protections govern *what the repository accepts*. Both
must be honoured.
