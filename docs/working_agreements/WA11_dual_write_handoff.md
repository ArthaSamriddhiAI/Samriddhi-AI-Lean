# WA11: Dual-write hand-off

## Agreement

Every hand-off note is dual-written: once in the workstream's audit file (per-workstream record) and once in `docs/workstreams/` as a workstream-scoped hand-off doc (cross-workstream durable record), using the existing `<workstream>_<purpose>.md` naming pattern. Applies retroactively to A2 and to all remaining capability workstreams.

## Rationale

The dual write is a verification mechanism: two files have to stay aligned, which makes orchestration-versus-implementation drift visible. If the audit file's hand-off section and the `docs/workstreams/` copy diverge, that divergence is itself the signal that the orchestration chat and Claude Code have drifted. The failure mode it prevents: a single hand-off record that silently rots without anyone noticing.

## Trigger

Originated in-repo during the A2 workstream. The `<workstream>_<purpose>.md` naming sub-rule was inherited from the accordion-integration files; the explicit PR #3 review instruction set the hand-off doc as the durable cross-workstream surface and the audit file as the workstream-specific record.

## Examples

**Compliance:** Risk-reward maintains `docs/audits/2026-05-19_risk_reward.md` and `docs/workstreams/risk_reward_handoff.md`; the empirical correction was written into both.

**Non-compliance:** Recording the fund-NAV-regeneration decision only in the audit doc and never reflecting it in the hand-off doc that downstream workstreams read.

## Cross-references

`docs/audits/`, `docs/workstreams/`; the conventions-consolidation audit notes WA11 is the only WA whose enforcement is structural.
