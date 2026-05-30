# ADR 0031: A3 So-What advisor-action agent, placement and the agent-reads-agent precedent

## Status

Accepted, 2026-05. Capability shipped as T-5.12 on `features/a3-so-what`. The
`A3Output` schema was locked by the primary before implementation (audit-first,
WA22; the audit is `docs/audits/2026-05-28_t512_a3_so_what.md`). Layer 1 is
verified deterministically (`scripts/_verify-a3-so-what.ts`, 32 assertions, no
API). The live two-layer verify is WA12-gated. The PR opens this ADR alongside
the capability code.

## Context

T-5.12 introduces A3, the so-what advisor-action layer, the single product
surface that recommends an action (a trade to propose) rather than
characterising a state. It produces three arrays in one pass: per-holding
actions, per-observation actions, and one portfolio-level rebalance proposal.

A3's primary input is different from every capability sibling so far. The prior
siblings (risk-reward-stats, time-series-performance, portfolio-overlap) read
the snapshot and the deterministic metrics. A2 reads the metrics plus the
evidence bundle. A3's primary input is another agent's structured output: A2's
`holding_verdicts`. This is a new dependency shape in the pipeline,
agent-reads-agent, and it warrants a recorded decision.

A2 is deliberately non-recommendatory: it says "this conversation is worth
having," never "this position should be cut." A3 is the inverse and the only
surface that crosses that line. That product boundary, and the discipline that
keeps it from sliding into a workflow the platform owns, also warrant recording.

## Decision

- **Placement, sibling agent.** A3 ships as `lib/agents/a3-so-what.ts`, a
  sibling to `a2-classification.ts` and the capability agents. Reasons:
  precedent gravity (every prior capability went sibling) and role separation
  (A3 is the recommendation layer, distinct from A2's classification and M0's
  metrics).
- **Two-layer, no new pattern.** A3 mirrors the established deterministic plus
  LLM split. Layer 1 (`computeA3`) is pure: it builds the three surfaces and
  computes the rebalance glide-path math. Layer 2 (`runA3ReasonText`) is one
  Claude call that writes the recommendatory prose, merged in TypeScript; it
  cannot mutate a computed number. A2 and risk-reward-stats already establish
  this pattern, so A3 introduces none and needs no pattern ADR.
- **Ordering, after A2 and M0.** A3 runs in `runDiagnosticPipeline` after the
  A2 call, consuming `a2Result.output`, `metrics`, and
  `stitched.pre_observations`, all already in scope. No orchestration
  restructuring was required.
- **Agent-reads-agent contract.** A3 treats A2's output as a fixed upstream
  artifact, exactly as it treats the M0 metrics. It never re-derives a verdict;
  it routes A2's `unable_to_classify` to its own sentinel. The dependency is
  one-directional and acyclic: A2 does not read A3. The join key between them
  is `holding_ref`. This is the contract surface a future A2 schema change must
  respect.
- **Computed versus narrated split.** Mirrors risk-reward-stats and is legible
  in the type: the rebalance proposal carries a `computed` block (target
  weight, per-step trims, trigger weights, step count) that verify asserts
  exactly, and a `narrated` block (advisor prose plus a `generation_method`
  disclosure) that gets a voice and shape check only. T-5.09 can render the
  glide-path object independently of the surrounding voice.
- **Observation key source (the honest 8).** `observation_actions` keys off the
  7 live stitcher `pre_observations` plus `sector_over_concentration` pulled
  from A2's drivers (where A2 derives it from M0's sector look-through). The
  aspirational 10-item vocabulary is not carried in the schema. The two
  unproducible categories are debt, not contract: `fee_inefficiency` and
  `mandate_consistent` (P34), and the promotion of `sector_over_concentration`
  to a first-class pre-observation (P35).
- **Workflow-creep boundary.** A3 proposes the action as advisor-facing text
  and stops. The schema carries no `status`, approval, scheduling, owner, or
  execution field. `kind` is a content discriminant for rendering and carries
  no lifecycle meaning. The system does not own the action; the advisor does.
- **Glide-path cadence is A3's own.** The per-step trim ceiling (5 weight
  points) is an execution-pacing parameter to stage a large trim, not a
  concentration threshold. The concentration thresholds (10% flag, 15%
  escalate) and the trim target (the 10% flag line) are imported from
  `portfolio-risk-analytics.ts`; A3 invents no thresholds.
- **Persistence, data-only.** A3 output persists as `content.a3_so_what`,
  mirroring the sibling keys. The Samriddhi 2 renderer is untouched (WA09).
  Per the WA15 inversion, the locked `A3Output` schema is the design reference
  T-5.09 renders against; the canonical Surana v7.2 wireframe is what the
  schema was grounded against.

## Consequences

- **Positive.** The agent-reads-agent precedent is established cleanly and
  acyclically. A3's recommendations are grounded in A2's already-audited
  verdicts, so the two surfaces cannot diverge on what is flagged. The
  computed/narrated split keeps the recommendation auditable: the numbers an
  advisor would act on are deterministic and replayable.
- **Trade-off to watch.** The agent-reads-agent dependency means an A2 schema
  change ripples into A3 through the `holding_ref` join and the
  `source_observation` linkage. A future agent reading A3's output would extend
  the chain and should be evaluated for cycle risk.
- **Deferred.** Promoting `sector_over_concentration` to a first-class
  pre-observation is blocked on T-5.16 look-through (today the sector signal is
  mutual-fund-only, roughly 60% coverage, so a book-wide pre-observation would
  over-assert); see P35. Whether an all-clear (`mandate_consistent`) is an
  observation or the null state is an open product-design question; see P34.

## Cross-references

ADR-0030 (portfolio-overlap sibling; the prior placement decision A3 follows),
WA09 (capability ships data, design ships render), WA15 (wireframe before
capability, here inverted), WA16 (real reasoning over stubs), the T-5.12 audit
(`docs/audits/2026-05-28_t512_a3_so_what.md`), and product debt P34, P35.
