# WA28: Product-shape decisions require stop-and-propose, not a silent default

## Agreement

When CC reaches a point in execution where a choice would shape what the product DOES, surface it as a stop-and-propose to the primary before encoding it. "Defer to the advisor" (advisor-select), "decline silently to a sentinel," "fall back to a degraded path," "skip a step," and similar branch-points are not silent defaults; they are product decisions and require an explicit ask. Implementation choices that are reversible and contained (a variable name, an internal helper signature, a test scaffolding shape) are CC's own and do NOT trigger this stop. The discipline applies to the moment of choice between behaviours the user or advisor will see or feel, not to the mechanical detail of how a chosen behaviour is implemented.

The stop takes the form of a single-purpose message stating: (1) the branch-point in plain language; (2) the realistic options with their trade-offs; (3) CC's recommendation if any, marked as a recommendation, not a decision; (4) an explicit ask for a pick. CC waits for an affirmative pick before proceeding, the same posture as WA01 (the merge confirmation gate) and WA12 (the API-call gate).

## Rationale

Silent defaults look like neutral engineering and are not. "The funnel emits advisor-select for missing PMS metrics" reads as a robustness detail; it is in fact a product statement that the system declines to recommend a class of instruments. Encoded silently, the primary discovers the choice in the rendered output, after the fixtures are backfilled, when reversing it costs a re-backfill. Encoded as a stop-and-propose, the primary picks the behaviour the product owes its users at the moment the choice arises, when it is free. The failure mode this prevents is product-shape drift accreting one quiet default at a time, with no single moment to disagree.

## Trigger

T-5.12 (A3 So-What) Finding 1. The instrument-selection funnel reached the question of what to do when PMS or AIF candidates carry no risk-adjusted metrics. Two clean options existed: (a) emit a degraded advisor-select with a logged reason; (b) decline the sleeve entirely and force a different path. CC's default lean was (a) because it was the less-disruptive code path. The primary's correction was that "defer to the advisor" is itself a product decision: it tells the user the system will not pick here, which has a different feel and accountability shape than "the system picks but flags low confidence." The right path was a stop-and-propose at that branch-point, not to encode (a) silently and surface it for review later.

The same shape recurred at the bounded-LLM-composition-inference branch (deferred per ADR-0038): the silent default would have been to build the inference component; the stop-and-propose surfaced that the trigger condition had not actually fired and the right answer was C, deterministic decline, with the inference deferred. Codifying the stop-and-propose discipline as a standing agreement preserves the pattern across future workstreams.

## Examples

**Compliance:** The funnel hits the no-metrics PMS branch. CC stops with a single-purpose message: "AIF candidates carry no performance metrics. Three options: (a) emit advisor-select with the reason logged; (b) decline the alternatives sleeve entirely for these investors; (c) downgrade to a different sleeve. I lean (a) on robustness grounds; the trade-off is the system saying 'I will not pick'. Which do you want?" The primary picks; CC encodes.

**Non-compliance:** CC writes the advisor-select branch with a code comment ("not enough data, deferring to advisor") and surfaces it as a Finding in the PR description. The primary discovers the product behaviour after the fixtures land; reversing it costs a paid re-backfill.

## Cross-references

WA06 (flag and wait freely) — WA28 is the specific class of WA06 stops that always fire: any branch-point that shapes product behaviour. WA17 (questions live in the message output) — WA28 stops use the same message-surface posture. WA01 (squash-merge with explicit confirmation gate) and WA12 (explicit API-call gate) — same stop-and-confirm pattern applied to a different class of sensitive moments. WA05 (product debt over scope creep) — WA28 is the upstream complement: surface the product decision now, record any deferred work as debt, do not absorb the decision silently as a code default.
