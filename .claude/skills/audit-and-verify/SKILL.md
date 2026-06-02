---
name: audit-and-verify
description: Use at the start of any capability workstream, before writing code, and whenever writing to a versioned registry (a debt log, the ADR index, the working agreements, a fixture set). It enforces the audit-first and verify-before-adding working agreements: open with a read-only grounding audit that lands a versioned doc, quote live registry state as evidence before adding to it, and classify each architectural decision the workstream forces against the existing ADR set.
---

This skill implements four working agreements. Read the canonical text in the spec before relying on a paraphrase:

- `docs/working_agreements/WA22_audit_phase_as_deliverable.md` (the audit phase is a versioned deliverable)
- `docs/working_agreements/WA02_audit_before_integration.md` (read existing code before writing new code)
- `docs/working_agreements/WA21_verify_before_adding.md` (verify before asserting, quote as evidence)
- `docs/working_agreements/WA30_adr_disposition_at_propose.md` (classify each architectural decision against the ADR set)

## Operative steps

1. Open the workstream with a read-only grounding audit before any code is written. Consider running it as the `grounding-audit` subagent (it isolates the reads on a cheaper model) or entering plan mode, which is the native audit-first entry.
2. Land the audit as a versioned doc at `docs/audits/<YYYY-MM-DD>_<slug>.md`. Capability work does not start until the audit doc lands. Mark every claim audited or hypothesis.
3. Verify, do not assume: grep-confirm every path before repeating it, read the actual data shapes, and do not carry the kickoff's paraphrase as fact.
4. Before writing to any registry (debt log, ADR index, working agreements, fixtures, PR list), read its live current state and quote the relevant section as evidence first. Resolve any "next free number" against the live registry, never from chat memory.
5. Classify the architectural decisions (WA30). Read `docs/decisions/` (the ADR index), and for each architectural decision this workstream forces, assign a disposition: net-new (write a fresh ADR), already-covered (cite the existing ADR by number, write nothing), supersedes (write a new ADR that names the prior by number and annotate the prior ADR's Status line forward, the ADR-0014-to-0042 pattern), or amends (sharpen an existing ADR in place). Record it as a standing "ADR disposition" section in the audit doc and surface it in the hand-off or PR body. Be quiet when a decision is already covered (cite and move on); be loud only on net-new or supersedes. When the disposition is recorded, mark it for the merge gate: `mkdir -p .claude/.approvals && touch .claude/.approvals/adr-disposition`.

If your operative read here ever conflicts with the spec files above, the spec wins.
