# WA01: No self-merge

## Agreement

No self-merge. PRs are opened via `gh pr create` when work and tests are complete. The product owner reviews and squash-merges through the GitHub UI. (The owner may explicitly direct the squash-merge via `gh`; that is an authorized directed action, not auto-merge.)

## Rationale

Transcribed from CC build prompts; original rationale not in-repo. In-repo evidence: this is a single-author repo where GitHub blocks self-review-requests, so the gate is a deliberate human review step, not a tooling artifact. The failure mode it prevents: an agent merging its own unreviewed work into `main`.

## Trigger

Transcribed from CC build prompts; original rationale not in-repo. Restated by the owner at the M0.IndianContext integration ("Open the PR but do not merge it. Stop after opening and tagging for review").

## Examples

**Compliance:** Work and tests complete on `features/risk-reward-stats`; run `gh pr create --base main`; post the PR link; stop.

**Non-compliance:** Running `gh pr merge` immediately after opening the PR without an explicit owner instruction to merge.

## Cross-references

`docs/workstreams/a2_classification_handoff.md` (conventions inheritance); WA04 (workstream-template duplicate of this rule).
