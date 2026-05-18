# ADR 0006: Cash asset class excluded from position_concentration

## Context

The Step 4 dry-run on the Menon case surfaced bank savings at 86.6% of liquid AUM firing `position_concentration` (escalate) and lifting the savings line to Review. M0's `positionFlags` includes any instrument above the threshold regardless of asset class, and A2 inherited that instrument set. The skill file's portfolio-level propagation table is explicit: "Cash drag does NOT propagate to individual holdings; this is a deployment-level observation." Firing a per-holding `position_concentration` driver on a cash line therefore propagates an observation the skill marks as non-propagating, and it trips the "A2 contradicts the rest of the diagnostic" anti-pattern: the cash concentration is already the cash-drag story owned by the portfolio surface (S1's diagnostic), and A2 would be re-surfacing it as a different per-holding verdict.

## Decision

Layer 1 excludes any holding whose `asset_class` is `Cash` from `position_concentration` evaluation. The exclusion is keyed on asset class, not on the `savings` sub-category, so any future cash-equivalent sub-category inherits the carve-out by default. No other driver is affected; cash holdings can still in principle carry other drivers, they simply do not generate a position-concentration driver.

## Alternatives Considered

1. **Pure literal threshold (the prior behaviour).** Treat cash like any other instrument: above 15% is escalate, so Menon's savings is Review. Rejected: it propagates a non-propagating observation and contradicts the rest of the diagnostic, per the skill's own propagation rule.
2. **Exclude only the `savings` sub-category.** Rejected: the same logic applies to any cash-equivalent line (liquid funds parked as cash, sweep balances), and a sub-category-narrow exclusion creates a "why this and not that" ambiguity the next engineer has to re-litigate.
3. **Exclude the entire `Cash` asset class (chosen).** Boundary is clear, future cash-equivalent additions inherit the carve-out, and it maps exactly onto the skill's existing cash-drag non-propagation rule.

## Consequences

A2's `position_concentration` driver now operates on Equity, Debt, and Alternatives, never Cash. Cash drag continues to surface at the portfolio level via S1's diagnostic; the division of labour is now clean (deployment-level observation stays on the portfolio surface, A2's per-holding column does not duplicate it). Of the six S2 cases only Menon's distribution changes (savings 86.6% moves from Review to Maintain, giving 3 Maintain / 0 Monitor / 0 Discuss / 0 Review); Bhatt, Malhotra, Iyengar, Surana, and Sharma-S2 have no cash holding large enough to have been affected, so their reviewed distributions are unchanged. If a future model portfolio framework introduces a cash *ceiling* (rather than the current deployment-efficiency floor), a cash overweight would become a meaningful per-holding signal and this carve-out would need revisiting; that is a model-portfolio-framework decision, not an A2 one. The carve-out is guarded by a boundary test in `scripts/_verify-a2-classification.ts` (a Cash holding above 15% must produce no position driver while a non-cash holding above 10% still flags). The related question of whether cash-adjacent debt (senior-citizen FDs and similar) deserves a comparable treatment is deliberately out of scope here and tracked as product debt P14.
