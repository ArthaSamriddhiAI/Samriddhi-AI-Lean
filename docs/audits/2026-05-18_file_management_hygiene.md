# Audit: File-management hygiene (PR #3 review)

- Date: 2026-05-18
- Trigger: PR #3 review discipline (A2 classification merge into main)
- Mode: read-only sweep; recommendations only. Approved items implement as additional commits on `features/a2-classification`.

## Audit findings

The repository is in good hygiene for the A2 merge. Concrete findings:

**docs/.** Root holds project-level docs (`BUILD_ROADMAP.md`, `PRODUCT_DEBT_LOG.md`, `DEFERRED.md`, `LIFT_INVENTORY.md`, `NEXT_SLICE_PROPOSAL.md`, `QUICK_START.md`, `README.md`, `BUILD_NOTES_M0_INDIAN_CONTEXT.md`, and the new `A2_Product_Thesis.md`). Subdirs: `audits/` (1 file), `decisions/` (0001-0006), `workstreams/` (accordion x2 + `a2_classification_handoff.md`), `slices/`. Naming is consistent. Cross-link check: every path referenced by `docs/audits/2026-05-18_a2_classification.md` and `docs/workstreams/a2_classification_handoff.md` (skill file, lib modules with line numbers, scripts, ADRs, thesis) was verified to resolve to an existing file. No broken or moved references. `docs/README.md` links resolve.

**agents/.** 22 skill files plus the `m0_indian_context/` data directory. Naming is uniformly `<agent_id>.md` (no `_skill` suffix). `a2_classification.md` matches the established frontmatter shape (agent_id, llm_model, max_tokens, temperature, optional output_schema_ref). `agents/m0_indian_context.md` co-exists with `agents/m0_indian_context/` (the latter holds curated YAML stores); this is deliberate co-location, not a collision. `output_schema_ref` keys point at `schemas/*.json` files that do not exist; this is documentation-only by design (validators are inline TypeScript), consistent across a1/m0/a2.

**scripts/.** 18 files. Prefix patterns: `_verify-` (7), `generate-` (3), plus single-instance `backfill-`, `regenerate-`, `gate-`, `export-`, `copy-`, `render-`, `_print-`, `_test-`. The A2-introduced `_verify-<feature>.ts` and `_print-*` are consistent with the existing `_verify-*` family; `_test-ic1-supersession.ts` is an older throwaway (its own header says revert via `npm run db:seed`). No `scripts/README.md` exists.

**lib/agents/.** TypeScript modules use kebab-case (`a2-classification.ts`) while `agents/` skill files use underscores (`a2_classification.md`); the skill-loader maps `skillId` to the file, so the divergence is intentional and load-bearing, not an inconsistency. `a2-classification.ts` is imported only by `pipeline.ts`; exports are clean (`classifyHoldings`, `runA2ReasonText`, `runA2Diagnostic`, `stripLongDashes`). No dead code or orphan modules attributable to A2. `e5_unlisted_equity.md` has no `e5-*.ts` (a known pre-A2 stub, out of scope here). No `lib/agents/README.md` exists.

**Top-level.** Root `README.md` is a one-line title; no broken links (none present). No hardcoded moved paths found in docs.

**Debt log structure.** `PRODUCT_DEBT_LOG.md` carries T1-T9, P1-P14, D1-D7, X1-X6 with prose detail blocks (T7 RAG note, T8/T9 detail, P12/P13/P14 detail) and a Maintenance section that states the X/P/D/T series semantics, routing, and the numbering discipline. Navigable; the series convention is explicit.

## Recommendations

Items #3 through #8 are leave-as-is; each carries its standalone one-line justification in the Rationale column so a future reader sees why it was deliberately left, not merely that it was noticed (per the PR #3 review approval).

| # | Finding | Recommendation | Rationale |
|---|---|---|---|
| 1 | No `scripts/README.md` (18 scripts, prefix conventions implicit) | **Create** (low effort, in this PR if approved) | A one-screen index (prefix legend + one line per script) makes the script vocabulary self-documenting at the moment A2 adds three new scripts. Cheap, additive, improves the merge hand-off. |
| 2 | No `lib/agents/README.md` (module map implicit) | **Defer** (Slice 7 polish; or create if explicitly wanted) | Higher-value than #1 but larger to do well (must explain harness/router/pipeline/skill-loader/case/ic1). Doing it shallow now is worse than doing it deliberately later. Not a merge blocker. |
| 3 | kebab `a2-classification.ts` vs underscore `a2_classification.md` | **Leave as is (justified)** | Intentional: skill files mirror the underscore `agent_id`; TS modules follow Node module convention; the skill-loader bridges them. Unifying would break the mapping. |
| 4 | `agents/m0_indian_context.md` + `agents/m0_indian_context/` | **Leave as is (justified)** | Deliberate co-location of the M0 skill file with its curated YAML data directory. Unique to M0; not ambiguous. |
| 5 | `docs/reference/A2_Product_Thesis.md` at docs root, not in `audits/` or `decisions/` | **Leave as is (justified)** | A product thesis is a canonical "what/why" reference, peer to `BUILD_ROADMAP.md`, not a post-hoc audit or a decision record. Future capability theses should follow the same root placement. |
| 6 | `output_schema_ref` points at non-existent `schemas/*.json` | **Leave as is (justified)** | Documentation-only by design; output contracts are inline TS validators. Consistent across a1/m0/a2. Already implicitly tracked. |
| 7 | WA11 dual-write produces two copies (audit doc + workstreams doc) | **Leave as is; tracked by T8** | The duplication is the WA11 mechanism. T8 already flags the audit-vs-conventions structural question and dates the decision. No new action here. |
| 8 | No stale/obsolete docs; cross-refs accurate; debt log navigable | **Leave as is (justified)** | Nothing is wrong: every cross-reference resolves and the debt log is navigable; recorded so the merge has a verified clean-hygiene baseline rather than an unstated assumption. |

Net actionable: one cheap create (#1) is the only thing recommended for this PR; #2 is a defer; everything else is leave-as-is-with-justification.

## Out of scope

Noticed, not recommended for action in this round (already tracked or pre-A2):

- `e5_unlisted_equity.md` has no implementation module: pre-A2 known stub, future capability.
- D7 (pre-existing long-dash glyphs in frozen S1/evidence prose): already logged, A2 additive-only.
- P10/P11 (skill-file Worked Example inconsistencies): already logged for the next skill revision.
- STUB_MODE toggle behaviour and the deploy-time-flag question: T1, Slice 9.
- Accessibility/keyboard-nav: X5, Slice 7.
- `_test-ic1-supersession.ts` throwaway naming: addressed in the test-discipline audit, not here.
