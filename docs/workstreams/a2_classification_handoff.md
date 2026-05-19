# A2 Classification: cross-workstream hand-off

Workstream: A2 classification (Capability Phase, Slice 4.6a). Branch: `features/a2-classification`.

This is the cross-workstream durable copy of the hand-off record (working agreement 11: every hand-off note is dual-written, once in the workstream audit file `docs/audits/2026-05-18_a2_classification.md` and once here). It carries the conventions the four remaining capability workstreams (risk-reward, time-series, overlap, house view) inherit without re-deriving them. If this file and the audit file's Hand-off section drift, that divergence is itself the signal that the orchestration chat and Claude Code have drifted; keep them aligned.

## Working Agreements

The canonical per-agreement records now live in `docs/working_agreements/` (one file per WA: full text, rationale, trigger, examples, cross-references; `docs/working_agreements/README.md` is the index). That per-file structure is the durable home and supersedes the deferred single `docs/conventions.md` idea, which closes debt entry T8. This hand-off doc no longer carries the WA text inline; it points to the canonical location so the two cannot drift. WA1 through WA9 were transcribed from out-of-repo CC build prompts (rationale and trigger partial, marked as such in each file); WA10 and WA11 originated in-repo during the A2 workstream; WA12 originated in-repo during the risk-reward workstream. Per the explicit PR #3 review instruction, the durable cross-workstream conventions surface is intentionally single-sourced (here as a pointer, canonical text in `docs/working_agreements/`), not dual-written into the audit file.

## Conventions inherited by the next capability workstream

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
