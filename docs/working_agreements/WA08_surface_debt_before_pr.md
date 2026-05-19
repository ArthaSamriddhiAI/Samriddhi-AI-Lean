# WA08: Surface debt entries before PR

## Agreement

Surface debt entries at the end. Before opening the PR, explicitly list anything logged, or that should have been logged, in the debt log during the workstream.

## Rationale

Transcribed from CC build prompts; original rationale not in-repo. In-repo evidence: the PR-body house template has a debt-entries section. The failure mode it prevents: deferrals and trade-offs made silently during execution never reaching the institutional record, so a future audit has to re-derive them.

## Trigger

Transcribed from CC build prompts; original rationale not in-repo.

## Examples

**Compliance:** Risk-reward's PR body will enumerate DD1-DD3, O1-O4, UX1-UX3, and the RF-configurability P-series entry, cross-checking each exists in the log.

**Non-compliance:** Opening the PR with the regenerated NAV but never logging that source-history fidelity was traded for index coherence.

## Cross-references

WA05 (product debt over scope creep, the in-flight half); `docs/PRODUCT_DEBT_LOG.md`, `docs/UI_UX_DEBT_LOG.md`.
