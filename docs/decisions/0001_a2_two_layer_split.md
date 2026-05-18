# ADR 0001: A2 two-layer split (deterministic verdict, LLM reason text)

## Context

A2 assigns a per-holding meeting-behaviour verdict (Maintain, Monitor, Discuss, Review) and explains it. The product thesis requires verdicts to be replayable: the same case run twice must produce the same verdict, so a CIO reviewing a case in three months gets a defensible record. Reason text, by contrast, is advisor-facing prose where phrasing may vary. M0.PortfolioRiskAnalytics already establishes a two-layer shape in the codebase (deterministic `computeMetrics` plus LLM interpretation downstream). A2 had to choose where the deterministic/LLM boundary sits.

## Decision

A2 is two layers. Layer 1 (`classifyHoldings` in `lib/agents/a2-classification.ts`) is pure deterministic TypeScript: it assigns the verdict and the structured driver list from the rubric, using threshold constants imported from M0 (single source of truth). No LLM, no `Date.now`, no randomness. Layer 2 (`runA2ReasonText`) is one Claude call per case that writes the one-sentence reason for each driver plus the rollup characterisation. The orchestrator merges Layer 2's reason strings into the Layer 1 structure in TypeScript; the verdict and driver list are never read back from the model, so Layer 2 structurally cannot change a verdict.

## Alternatives Considered

- **Single LLM call producing verdict and reason together.** Rejected: verdicts would not be replayable, the audit trail would depend on model sampling, and demo determinism would be lost. The thesis explicitly forbids this ("the verdict varies on retry" is a named anti-pattern).
- **Verdict logic in the LLM with a deterministic post-validator.** Rejected: a validator that rejects non-conforming verdicts still leaves the verdict itself model-dependent on the accepted path; it does not deliver replayability.

## Consequences

Layer 1 is unit-testable without API spend and is guarded by `scripts/_verify-a2-classification.ts` (determinism assertion plus the skill's Worked Example). Layer 2 cost is one call per case. To revisit (for example, to let an LLM influence tiering), ADR 0001 must be superseded and the replayability guarantee in the product thesis renegotiated; the verify script's determinism assertion would have to be removed deliberately, which is the intended trip-wire.
