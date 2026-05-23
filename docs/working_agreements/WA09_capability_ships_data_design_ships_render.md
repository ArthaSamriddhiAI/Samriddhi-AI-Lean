# WA09: Capability ships data, design ships render

## Agreement

Capability ships data, design ships render. Capability workstreams do not add UI components, columns, tabs, accordion rows, or visual surfaces. Data lives in fixtures, schemas, and pipeline output; the existing renderer must tolerate new fields without surfacing them. The Capability Surfaces Design workstream picks up rendering against the cumulative data of all five capability workstreams.

## Rationale

Transcribed from CC build prompts; original rationale not in-repo. In-repo evidence: A2 ships `content.a2_classification` and the S2 renderer reads only `briefing` and never touches the key. The asymmetry rationale (capability ships narrow, the single design pass renders wide once all five capabilities have landed) is the "ships narrow, captures wide" discipline noted in the conventions-inheritance section of the A2 hand-off. The failure mode it prevents: five capability workstreams each making piecemeal UI decisions that the design pass then has to unwind.

## Trigger

Transcribed from CC build prompts; original rationale not in-repo. Reinforced in-repo during A2 (data-only ship) and risk-reward (UX1-UX3 deferred to `ui_ux_debt_log.md`).

## Examples

**Compliance:** Risk-reward persists `content.risk_reward_stats`; the renderer is untouched; render decisions are logged as UX1-UX3 for the design workstream.

**Non-compliance:** Adding a "Risk-Reward" accordion row or a Sharpe column to the holdings table inside the risk-reward workstream.

## Cross-references

`docs/debt/ui_ux_debt_log.md` (the deferred-render surface); WA05 (scope discipline); the Capability Surfaces Design workstream consumes both.
