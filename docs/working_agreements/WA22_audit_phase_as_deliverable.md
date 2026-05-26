# WA22: Audit phase as a versioned deliverable

## Agreement

Every capability workstream opens with an explicit audit phase that produces a versioned artifact at `docs/audits/<task-id>.md` (or the established equivalent location). The audit verifies: relevant registry state (debt logs, ADR index, PR history), relevant code paths (no path quoted in the kickoff that isn't grep-confirmed first), relevant existing artifacts (prior PRs and ADRs the new work inherits from), and the specific data shapes the new capability assumes. Capability work does not start until the audit doc lands. The kickoff text shipped from planner chat is annotated with "audited" or "hypothesis" on every claim.

## Provenance

Twice in the T-5.07 workstream, audit gaps caused mid-implementation WA19 stops that could have been prevented if audit had been a deliverable rather than a prelude. First: the kickoff's claim that the diagnostic pipeline activates four evidence agents (E1, E2, E6, E7) turned out wrong; the pipeline actually activates six (E1-E4, E6-E7), with E5 routed but never run (T16). Second: ADR-0030's original three-layer resolution model (top-5 stocks / wrapper-level / sub-category) was drafted from a hypothesis about snapshot data shape that turned out not to match the data. In both cases, the audit happened (CC's discovery turns) but it wasn't framed as a versioned deliverable, so the upstream artifacts (kickoff, ADR draft) shipped against unaudited assumptions.

## Cross-references

WA21 (verify before adding; the per-action discipline), WA23 (conventions inheritance by reference; complementary discipline about reading from source rather than re-listing).
