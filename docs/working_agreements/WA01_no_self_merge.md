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
