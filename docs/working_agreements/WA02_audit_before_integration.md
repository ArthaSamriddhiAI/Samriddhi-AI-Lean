# WA02: Audit before integration

## Agreement

Audit before integration. Step 0 of every workstream is reading the existing relevant code in detail. Surface findings before writing any new code. Surface deviations from approved plans rather than silently diverging.

## Rationale

Transcribed from CC build prompts; original rationale not in-repo. In-repo evidence: the Capability Phase template (A2, risk-reward) puts a codebase audit before Hard Checkpoint 1; the audit repeatedly catches ground-truth divergences (for example the risk-reward Step 1 audit contradicted four prompt assertions) that would have been silent bugs if code had been written first.

## Trigger

Transcribed from CC build prompts; original rationale not in-repo.

## Examples

**Compliance:** Risk-reward Step 1 read `pipeline.ts`, `router.ts`, the ADRs, and the snapshot structure, then surfaced divergences D1-D6 before any computation code.

**Non-compliance:** Writing the `benchmark_resolution` recompute pass against an assumed data shape without first inspecting the actual `tier_b_stats` and `monthly_nav` structure.

## Cross-references

`docs/audits/` (per-workstream audit docs are the WA02 output surface); WA06 (flag and wait freely).
