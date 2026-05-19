# WA06: Flag and wait freely

## Agreement

Flag and wait freely. Outside formal checkpoints, surface questions whenever an assumption feels load-bearing.

## Rationale

Transcribed from CC build prompts; original rationale not in-repo. In-repo evidence: the highest-value moments in the risk-reward workstream were unscheduled flags (the fund-NAV-vs-synthetic-index incoherence surfaced at a sub-checkpoint, not a formal gate). The failure mode it prevents: an agent proceeding on a wrong load-bearing assumption because the next formal checkpoint is far away.

## Trigger

Transcribed from CC build prompts; original rationale not in-repo.

## Examples

**Compliance:** Pausing the recompute pass to surface that fund `monthly_nav` is statistically unrelated to the synthesised indices, even though no formal checkpoint required a stop there.

**Non-compliance:** Writing the recompute across 908 funds and only mentioning the incoherence in the eventual PR notes.

## Cross-references

WA03 (formal checkpoints); WA02 (audit findings). WA06 governs the space between checkpoints.
