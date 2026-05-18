# ADR 0003: E4 behavioural driver is a corroborator only, watch-capped

## Context

The skill file says A2's "only non-standard read is from E4, where a per-investor stated-revealed-divergence signal may attach to specific holdings; the exact mechanism is resolved at codebase-audit time." The audit found E4 runs on every S2 case and lands at `content.evidence.e4`, but its `stated_vs_revealed_divergence` is `{ direction, magnitude, implication }`: investor-level, with no structural per-holding key. The `implication` is prose that sometimes names a holding but cannot be deterministically parsed to decide which holdings it touches. Layer 1 must stay deterministic and replayable (ADR 0001), so a prose-driven attachment is not viable.

## Decision

The `behavioural` driver fires only as a corroborator. It attaches at `watch` severity, with `scope: portfolio_propagated` and `source_observation: stated_revealed_divergence`, only when (a) E4 `stated_vs_revealed_divergence.magnitude` is `material` and (b) the holding already carries at least one holding-scope driver. It never fires standalone and never independently lifts a healthy holding's tier (a holding with only a watch driver is Monitor, but a holding reaching this rule already has a flag or escalate holding-scope driver, so the verdict is already set above watch). E4 divergence otherwise remains a portfolio-level observation that S1 surfaces; it does not propagate per holding the way wrapper and sector observations do.

## Alternatives Considered

- **Prose-parse E4's `implication` to attach behavioural to named holdings.** Rejected: non-deterministic and fragile; violates Layer 1 replayability (ADR 0001).
- **Behavioural as an independent propagated driver that can lift tier.** Rejected: an investor-level soft signal single-handedly turning healthy holdings into Discuss would breach "Default to Maintain" and the "every holding becomes Discuss" anti-pattern.
- **No behavioural driver at all (portfolio-only).** Rejected: the skill's `behavioural` driver_type would go entirely unused and the advisor would lose the corroborating annotation where behaviour and a hard signal coincide (for example Bhatt's Cat III: E6 complexity-premium-not-earned plus material E4 divergence).

## Consequences

Behavioural is annotation, not escalation: it enriches the conversation on holdings that already warrant one without inflating the verdict count. This is the part of the rubric flagged as most likely to need iteration. If E4's contract ever becomes per-holding-keyed (a structured field naming the holdings it implicates), this ADR should be superseded and the driver can become a first-class per-holding signal with its own severity mapping.
