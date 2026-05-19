# WA12: Explicit API-call gate

## Agreement

Any work that will trigger Anthropic API calls (LLM inference via `callAgent` or equivalent, end-to-end pipeline runs that exercise LLM-using agents, prompt-engineering tests) stops and surfaces for approval before firing. The message to the working chat includes: estimated number of calls, which agent or skill is being invoked, what the call is testing, and rough credit cost if estimable. Resume only after explicit approval. Does not apply to: pure local computation, `tsc` or typecheck, deterministic verify scripts, schema validation, fixture inspection, or file edits.

## Rationale

Preventative discipline against accidental API spend across all workstreams. Capability work involves many local-computation steps and a small number of genuinely LLM-invoking steps; the gate makes the expensive steps deliberate and visible rather than incidental. The failure mode it prevents: an end-to-end pipeline run or a prompt-tuning loop silently consuming credits without the owner having chosen to spend them.

## Trigger

Originated in-repo at the risk-reward Step 3 ruling. Adopted alongside the pre-recompute sample sub-checkpoint; both pieces of discipline (this gate and the sample sub-checkpoint) paid for themselves in their first use (the sample caught the fund-NAV-versus-synthetic-index incoherence before any write-back, with zero API spend).

## Examples

**Compliance:** The 1773-fund partition and the 10-fund pre-recompute sample were run as pure local computation and explicitly noted as not WA12-gated; the eventual Layer 2 rollup LLM call and any end-to-end pipeline run will stop and surface a cost estimate first.

**Non-compliance:** Running the full diagnostic pipeline on Shailesh (which exercises S1 and the Layer 2 rollup) to "just check it works" without surfacing the call count and cost for approval.

## Cross-references

WA06 (flag and wait freely, the general form); the risk-reward audit doc records the adoption context; binds all future workstreams.
