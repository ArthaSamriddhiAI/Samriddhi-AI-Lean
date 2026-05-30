# ADR 0040: A1 is not added to the Samriddhi 2 diagnostic (deliberate absence at the MVP stage)

## Status

Accepted, 2026-05. A1 is **not** added to the Samriddhi 2 portfolio-diagnostic pipeline at the MVP stage. This is a deliberate absence recorded as a decision, not an oversight and not a "no value" finding. Landed as T-5.13 on `feature/a1-challenge-for-samriddhi-2`, documentation-only (no feature code, no adapter, no orchestrator change, no schema file, no agent firing), built on the read-only audit `docs/audits/2026-05-30_a1_challenge_samriddhi_2_suitability.md`. The PR that opens this ADR also lands the two parked product-debt entries P48 and P49. Per WA01 the merge is the primary's; per WA28 the framing is product-shaping, so the decision recorded here was the primary's call, made after the audit.

## Context

The roadmap carried T-5.13 provisionally as "wire the A1 challenge agent into the Samriddhi 2 diagnostic pipeline." The audit that precedes this ADR did not treat that as settled; it asked whether, given what the A3 So-What agent already contributes (T-5.12, ADR-0031), adding A1 to the Samriddhi 2 diagnostic delivers enough distinct value to justify the work and the added pipeline complexity.

The audit established the relevant ground truth on `main`, all read-only:

- A1 today is a proposal challenger. Its implemented output is a flat `{ challenges: AdvisoryChallengeItem[] }` over three categories (`counter_argument`, `stress_test`, `edge_case`), and its input is type-bound to the Samriddhi 1 case synthesis output (`S1CaseOutput` in `lib/agents/case/a1-case.ts`). Its prompt is built to challenge a proposed action.
- A1 is gated out of the Samriddhi 2 diagnostic structurally, not by a conditional: the Samriddhi 2 orchestrator (`lib/agents/pipeline.ts`) never imports or calls A1, and A1's input type does not accept a diagnostic briefing.
- A3 already owns single-name concentration and allocation in the diagnostic; the audit's sweep of all five Samriddhi 2 diagnostic cases that carry A3 output confirmed A3 reasons forward from the numbers into recommended actions.

The audit's load-bearing finding for this ADR is in the next section: A1 would fill a real gap, and that gap is acknowledged here rather than denied.

## Decision

A1 is not added to the Samriddhi 2 diagnostic pipeline at the MVP stage. The Samriddhi 2 diagnostic continues to ship S1 diagnostic synthesis, A2 classification, and A3 So-What, with no A1 layer.

### Scope boundary (load-bearing)

This decision concerns **A1 in the Samriddhi 2 portfolio-diagnostic flow only.** It does not touch, reopen, question, or affect A1's existing implementation in the Samriddhi 1 proposed-action flow in any way. A1 fires today in the Samriddhi 1 orchestrator (`lib/agents/pipeline-case.ts`, the `runA1Case` call after S1 case-mode synthesis) and renders in the Samriddhi 1 Case Detail Outcome tab; that is untouched and out of scope here. No later reader should read "no A1" as a system-wide statement. The current product focus is Samriddhi 2 portfolio diagnostics; Samriddhi 1 is not in scope for this decision and keeps A1 exactly as it is.

### The confirmed gap, acknowledged honestly

The audit found that A1 would fill a real gap that nothing else in the Samriddhi 2 pipeline currently covers: interrogating the believability of the diagnostic's own evidence and metrics. The diagnostic computes per-holding risk-reward statistics (alpha, beta, Sharpe, and a chosen `benchmark_index_id`) and presents them as fact; no agent asks whether a metric is implausibly clean, whether the chosen benchmark is apt for the holding, or what adverse scenario the clean diagnostic is not pricing. A3 cannot fill this gap by construction: A3 is the recommendation layer; it reasons forward from the numbers, it does not reason at them. A1's existing Samriddhi 1 outputs prove it has exactly this instinct (challenging a three-year return "earned during a cutting cycle that has now paused," or gross returns "the 3Y window may have flattered").

This decision does not deny that gap. It defers filling it. The reason is not that the gap is unreal; it is that A1's genuinely valuable form is mis-placed in time and architecture for the lean MVP, as the next two sections explain.

### A1's spirit, clarified

A1 is the institutional contrarian: the system's standing skeptic of its own output. The form of that contrarian that would earn its place in Samriddhi 2 is **not** an inline, case-generation-runtime agent firing once per diagnostic and emitting unrendered commentary. It is an **asynchronous QA layer over already-generated cases**: a periodic quality audit that reads diagnostics the system has already produced, interrogates their credibility in the sense above, learns from how advisors iterate on those cases in practice, and feeds improvements back into the product indirectly (through prompt, threshold, and methodology updates) rather than as a live in-case voice to the advisor.

That async-QA form is an enterprise-deployment capability with infrastructure prerequisites (a corpus of real generated cases, an advisor-iteration signal to learn from, and the loop that connects them), not an MVP runtime agent. Recording this here clarifies what A1 is for, and what shape it would take in Samriddhi 2, for anyone who reads this later. The schema mismatch that makes today's A1 a poor inline fit for a diagnostic (the proposal-flavored category enum, the richer skill-file schema authored against proposal semantics) is tracked separately as tech-debt T17 and is a Samriddhi 1 concern; it is referenced here, not reconciled and not reopened.

### The governing principle (the reasoning for the deferral)

The deferral rests on an architectural principle that stands independent of A1:

> Looping with the human advisor (human-in-the-loop: the advisor iterates on a generated case and the system aligns to their working style) is sound and welcome. Looping with an autonomous LLM agent that decides for itself is a different and heavier class of complexity, and that complexity must be earned through demonstrated need, not assumed by default.

A1's valuable async-QA form depends on exactly the autonomous-agentic-loop infrastructure that the MVP does not have and does not yet need. The MVP has no real-case corpus, no advisor-iteration signal, and no loop to learn from; standing up that loop to host A1 would be adding the heavier class of complexity ahead of the demonstrated need. The lighter, sound direction (the human-in-the-loop advisor-iteration capability) is the prerequisite that an A1 async-QA layer would learn from, and it comes first in the natural order. This is the same earned-not-assumed discipline that governs the deferred bounded-LLM-inference exception (ADR-0038): an LLM capability that adds a heavier loop is built when its trigger fires, not by default.

## Consequences

- **Positive.** The Samriddhi 2 diagnostic stays lean: S1, A2, A3, with no second unrendered advisory Opus call per case and no agent-reads-agent coupling beyond the A2-to-A3 dependency ADR-0031 already records. The real gap A1 would fill is documented, not lost, so a future enterprise workstream inherits a clear statement of what A1 is for rather than re-deriving it.
- **Trade-off accepted.** The Samriddhi 2 diagnostic does not, at the MVP stage, subject its own computed metrics to adversarial credibility review. The numbers are presented as fact; a flattered metric or an inapt benchmark would pass unchallenged. This is an accepted MVP limitation, recorded so it is a known absence rather than a silent one.
- **No effect on Samriddhi 1.** A1 in the Samriddhi 1 proposed-action flow is unchanged.

## Reopening conditions (when to revisit)

Revisit A1 in the Samriddhi 2 diagnostic when the enterprise advisor-iteration loop exists, specifically when all three hold: (a) Samriddhi is deployed with a corpus of real, already-generated Samriddhi 2 diagnostic cases; (b) a human-in-the-loop advisor-iteration capability is in place, so the system has a signal for how advisors refine and react to generated cases (the capability tracked as product debt P49); and (c) the agentic-loop infrastructure to run a periodic, autonomous QA pass over that corpus is available or warranted (tracked as product debt P48). Until those hold, A1 stays absent from the Samriddhi 2 diagnostic by this decision. When they hold, the form to evaluate is the async-QA layer described above, not an inline runtime agent.

## References

- Audit (evidence base): `docs/audits/2026-05-30_a1_challenge_samriddhi_2_suitability.md`.
- A1 implementation (Samriddhi 1, untouched): `lib/agents/case/a1-case.ts`; its Samriddhi 1 invocation `lib/agents/pipeline-case.ts`; its skill `agents/a1_challenge.md`.
- Samriddhi 2 orchestrator (no A1): `lib/agents/pipeline.ts`.
- A3 So-What (the layer A1 was compared against): ADR-0031 (`docs/decisions/0031_a3_so_what_advisor_action_agent.md`), `lib/agents/a3-so-what.ts`.
- The earned-not-assumed precedent for a deferred LLM capability: ADR-0038 (`docs/decisions/0038_deferred_llm_composition_inference.md`).
- A1 skill-versus-code schema divergence (referenced, not reconciled; a Samriddhi 1 concern): tech-debt T17 (`docs/debt/tech_debt_log.md`).
- Parked future directions logged with this decision: product debt P48 (enterprise async-QA layer for A1) and P49 (human-in-the-loop advisor-iteration capability), `docs/debt/product_debt_log.md`.
- Working agreements: WA01 (merge gate), WA05 and WA08 (debt over scope creep, surfaced before PR), WA13 (Samriddhi 1 / Samriddhi 2 naming), WA22 (audit phase as deliverable), WA24 (numbering at landing), WA28 (product-shape stop-and-propose).
