# WA16: Real reasoning over stubs

## Agreement

When new capability ships and needs to be reflected in existing fixtures, inject the new capability data into the fixtures via partial pipeline activation, not via stubs. Real LLM reasoning, not placeholder content. Triggers each time a new capability ships that affects fixture-owned cases. Owner: primary, by default, for primary-owned fixtures.

## Rationale

*(Extended from the planner v11.3 body; the planner card carried the agreement text above without separate rationale / trigger / examples sections.)*

Fixtures are demo-seed and review evidence; placeholder stub content in them misrepresents what the system actually produces. Injecting real reasoning via partial pipeline activation keeps the fixtures faithful to live behaviour, so a reviewer reading a fixture sees the genuine capability output rather than a hand-written stand-in that can silently drift from the implementation.

## Trigger

*(Extended from planner body.)* Adopted as the fixture-fidelity discipline for capability workstreams that backfill existing cases. Codified during T-5.06 alongside WA15, WA17, WA18.

## Examples

**Compliance:** A new capability that adds a `content.*` block to existing Samriddhi 2 cases backfills those fixtures by re-running the relevant pipeline stage against the real model, recording the genuine output.

**Non-compliance:** Hand-authoring placeholder JSON for the new block and committing it into the fixtures as if it were pipeline output.

## Cross-references

WA09 (capability ships data); WA12 (API-call gate, since fixture injection via partial activation incurs API spend and must be gated); the T-5.06 fixture injection is explicitly deferred to T-5.11 and is not exercised in the T-5.06 ping. Codified from planner v11.3.
