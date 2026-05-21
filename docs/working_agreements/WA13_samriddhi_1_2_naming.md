# WA13: Samriddhi 1 / Samriddhi 2 naming discipline

## Agreement

In prose artifacts (ADRs, audit docs, hand-off and PR bodies, debt entries, case-JSON comments and `contextNote`, commit messages), refer to the two MVP workflows by their full names: "Samriddhi 1" for the proposal-evaluation workflow and "Samriddhi 2" for the portfolio-diagnostic workflow. Do not use the bare shorthand "S1" / "S2" for the workflows.

The reason is collision: "S1" already names the S1 synthesis agent (`agents/s1_*.md`, the synthesizer with its case / diagnostic / briefing modes, and the `runS1Case` code path), and "S2" loosely names the diagnostic surface and Slice 2. Writing the workflow names in full removes the workflow-versus-agent ambiguity.

The synthesis agent keeps its "S1" name in agent-layer contexts (skill files, the `s1-case.ts` code path, agent-orchestration prose). The persisted case-JSON `workflow` enum values `s1` and `s2` are the data-layer schema and are unchanged; this agreement governs human-readable prose, not the field values.

## Rationale

Three referents share the string "S1" in this project: the Samriddhi 1 workflow, the S1 synthesis agent, and (loosely) Slice 1. Disambiguating the workflow by always writing "Samriddhi 1 / Samriddhi 2" in prose keeps the legibility-first record unambiguous for future readers and auditors at near-zero cost.

## Trigger

Adopted with the Samriddhi 1 case batch, the first workstream to author multiple proposal-evaluation cases and their surrounding ADRs and audit docs, where the workflow-versus-agent ambiguity was most acute.

## Examples

**Compliance:** "The Samriddhi 1 case batch authors five proposal-evaluation cases; the S1 synthesis agent runs in case mode within each."

**Non-compliance:** "The S1 batch runs S1 in S1 mode" (three different referents for S1 in one sentence).

## Cross-references

Foundation document Workflows and Case Intent section (the canonical workflow definitions); ADR-0023 (Samriddhi 1 case batch scenario design) applies this throughout; binds future workstreams that touch either workflow.
