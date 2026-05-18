# A2 Classification: cross-workstream hand-off

Workstream: A2 classification (Capability Phase, Slice 4.6a). Branch: `features/a2-classification`.

This is the cross-workstream durable copy of the hand-off record (working agreement 11: every hand-off note is dual-written, once in the workstream audit file `docs/audits/2026-05-18_a2_classification.md` and once here). It carries the conventions the four remaining capability workstreams (risk-reward, time-series, overlap, house view) inherit without re-deriving them. If this file and the audit file's Hand-off section drift, that divergence is itself the signal that the orchestration chat and Claude Code have drifted; keep them aligned.

## Conventions inherited by the next capability workstream

**Working agreement 10 (push every commit).** Push the feature branch to the remote on branch creation, and push every commit as it lands. Do not batch pushes or wait for "natural breakpoints." PR-open is the deliberate gate (Step 6); push is automatic and continuous. Rationale: the local environment is not a safety net for hours of work; intermediate iteration history (for example the HDFC FD bug commit and its fix, the matcher and boundary-convention iterations) is institutional memory that survives squash-merge; push is free and the downside of intermediate commits on a non-main branch is zero. This was adopted mid-A2-workstream after the branch had accumulated six unpushed commits; correcting the gap is itself part of the record.

**Working agreement 11 (dual-write hand-off).** Every hand-off note is dual-written: once in the workstream's audit file (per-workstream record) and once in `docs/workstreams/` as a workstream-scoped hand-off doc (cross-workstream durable record), using the existing `<workstream>_<purpose>.md` naming pattern. The dual write is a verification mechanism: two files have to stay aligned, which makes orchestration-vs-implementation drift visible. Applies retroactively to A2 and to all four remaining capability workstreams.

**Numbering conventions for debt log entries.** Prompts that specify exact P/D/T numbers may collide with existing log state, because chat context does not always reflect the current repo state of the logs (the D1-to-D6 renumbering in the A2 workstream surfaced this). Confirm the next available number against the current log before adding an entry; prompts should say "the next available P-series number" rather than hard-coding one. Series meanings: X design debt; P product-stance questions (Slice 7 audit); D data-quality issues (fixture refresh); T technical debt about the codebase or the engineering / audit-trail process itself.

**Audit discipline (ships narrow, captures wide).** A single capability workstream ships a deliberately narrow data layer while surfacing a wide institutional record. A2 shipped deterministic Layer 1, LLM Layer 2, the ADR 0005 boundary convention, and the ADR 0006 cash carve-out, while capturing ADRs 0001-0006, reconciliations P10/P11, product-stance questions P12/P13/P14, data debt D6/D7, and technical debt T8/T9. That volume from one workstream is not noise; it is the audit discipline doing its job. The workstream ships the carve-out; the institutional memory captures the questions A2 deliberately does not answer and the issues it surfaced but does not own. A future reader can reconstruct not just what A2 does, but what A2 deliberately does not do and why.

**Discipline demonstrated: the Layer 1 / Layer 2 split made an investigation answerable.** Step 5 review flagged a recurring "5Y return 6.86%" across three funds that looked like Layer 2 fabrication. Because verdicts are deterministic Layer 1 and only the prose is Layer 2, the question "is Layer 2 inventing this?" had a clean place to stand: the figure was traced to the source snapshot and confirmed as genuine coincidence (Axis Large Cap Fund 5Y 0.068625 and Kotak Global Emerging Market Overseas Equity Omni FOF 5Y 0.068588, both rounding to 6.86%). The split did not just prevent a failure mode; it made the failure mode investigable, and the investigation surfaced a real general question (Layer 2 fact-grounding, logged as T9) that improves the system without forcing an immediate fix. The hand-off record exists to capture how the workstream's discipline produced value, not only what it shipped.

## Pointers

- Skill file: `agents/a2_classification.md` (byte-identical copy of the canonical reference; runtime tuning in `LEAN_RUNTIME_OVERRIDES`).
- Implementation: `lib/agents/a2-classification.ts` (Layer 1 `classifyHoldings`, Layer 2 `runA2ReasonText`, orchestrator `runA2Diagnostic`).
- Tests: `scripts/_verify-a2-classification.ts` (Layer 1 determinism + boundary cases).
- Backfill: `scripts/backfill-a2.ts` (additive injection; dry-run and write modes).
- Review surface: `scripts/_print-a2-classifications.ts` (read-only Step 5 printout).
- Decisions: `docs/decisions/0001-0006`. Audit body: `docs/audits/2026-05-18_a2_classification.md`.
