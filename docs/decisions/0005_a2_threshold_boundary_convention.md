# ADR 0005: A2 threshold-boundary convention (strict greater-than)

## Context

A2's rubric anchors to the foundation §3 thresholds (position flag 10%, position escalate 15%, sector flag 25%, sector escalate 35%, wrapper share 25%). The skill file states the bands loosely ("10% to 15%" Discuss, "above 15%" Review), which is ambiguous exactly at a boundary. The first A2 implementation inherited M0.PortfolioRiskAnalytics's comparison, which uses `>=` (a holding at exactly 10% flagged as Discuss). Checkpoint 2 review surfaced this as a product-owner taste call: how should A2 read a holding sitting precisely on a threshold?

## Decision

A2 uses a strict greater-than convention, applied uniformly to position, sector, and the wrapper 25% share rule:

- strictly greater than the threshold triggers that severity;
- exactly at the threshold is one tier lower (the flag boundary becomes watch / Monitor; the escalate boundary becomes flag / Discuss);
- below the threshold produces no driver.

Concretely: position weight above 10% flags (Discuss), exactly 10% is watch (Monitor), above 15% escalates (Review), exactly 15% is flag (Discuss). Sector: above 25% flags, exactly 25% is watch, above 35% escalates, exactly 35% is flag. Wrapper share: above 25% flags, exactly 25% is watch. The "4+ PMS strategies" rule is a literal count (four or more is the trigger by definition, not a boundary) and stays a `>= 4` count test yielding flag. The mental model is "the number is the line: above the line you flag, on the line you watch."

## Alternatives Considered

- **Inherit M0's `>=` comparison (the first implementation).** A holding at exactly 10% would be Discuss. Rejected at Checkpoint 2: the boundary-exact case read as a harder verdict than the advisor's mental model of the threshold warranted, and "at the line" deserves a softer treatment than "over the line."
- **Treat boundary-exact the same as below (no driver).** Rejected: a holding sitting exactly on a concentration line is worth a Monitor note for next quarter; dropping it entirely loses a real soft signal.

## Consequences

A2 and M0 now diverge by exactly one severity tier at a boundary: M0's `positionFlags` still uses `>=` (a 10.0% holding is in M0's flag list), while A2 re-derives severity and reads the same holding as watch. This is intentional and allowed (interpreting M0's thresholds is part of A2's job), but it means M0's `positionFlags[].severity` and A2's position driver severity are not interchangeable; A2 deliberately ignores `pf.severity` and recomputes from `pf.weightPct`. Any future engineer wanting cross-component consistency at the boundary must make that an explicit decision, not assume it: changing one side silently will desynchronise the audit trail. The convention is guarded by boundary-exact tests in `scripts/_verify-a2-classification.ts` (position and sector). On Bhatt this moves White Oak's position driver from flag to watch while the wrapper driver still carries the holding to Discuss, so the verdict distribution is unchanged.
