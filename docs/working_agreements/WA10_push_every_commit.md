# WA10: Push every commit

## Agreement

Push the feature branch to the remote on branch creation, and push every commit as it lands. Do not batch pushes or wait for "natural breakpoints." PR-open is the deliberate gate; push is automatic and continuous. Reinforced 2026-05-19: at the start of every response that creates or references a commit, verify push state (`git fetch` then `git log origin/<branch>..HEAD`; empty means fully pushed) and report it with evidence; if a push fails, surface it in-message as a problem to solve rather than silently deferring.

## Rationale

The local environment is not a safety net for hours of work. Intermediate iteration history (for example the HDFC FD bug commit and its fix, the matcher and boundary-convention iterations) is institutional memory that survives squash-merge. Push is free and the downside of intermediate commits on a non-main branch is zero. Origin is the source of truth for review; an unpushed local commit does not exist for review purposes.

## Trigger

Originated in-repo. Adopted mid-A2-workstream after the branch had accumulated six unpushed commits; correcting that gap is itself part of the record. Reinforced during the risk-reward workstream after the owner flagged, twice, that the push-state was not being verified at report time (logged as `PRODUCT_DEBT_LOG.md` O4).

## Examples

**Compliance:** Commit `34327d5` (loader consolidation) was pushed in the same step it landed; the next response opened by verifying `git log origin/features/risk-reward-stats..HEAD` is empty and reporting that with evidence.

**Non-compliance:** Making three commits across a turn and pushing them only at the end of the turn, or referencing a commit in a report without first verifying it is on origin.

## Cross-references

WA01 (PR-open is the deliberate gate, push is not); `PRODUCT_DEBT_LOG.md` O4 (whether to enforce via a hook); memory `feedback_branch_pr_workflow.md`.
