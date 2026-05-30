# WA27: Repo-relative paths when referencing files

## Agreement

Whenever CC references a file for the primary to inspect, it surfaces the path from the repo root, not the bare filename. `lib/agents/a3-so-what.ts` is correct; `a3-so-what.ts` is not. The same applies to ADRs (`docs/decisions/0031_a3_so_what_advisor_action_agent.md`), debt logs (`docs/debt/product_debt_log.md`), fixtures (`db/fixtures/structured-mandates.ts`), and any other in-repo artefact named in CC's text. Outputs that quote source code or audit references use the repo-relative path inline with the citation. Line ranges (`:42`, `:100-150`) are appended where useful and remain optional.

## Rationale

The codebase has multiple files with overlapping basenames (`pipeline.ts` and `pipeline-case.ts`; `e1-listed-equity.ts` and `case/e1-case.ts`; per-snapshot files named identically across `fixtures/snapshots/enriched/`). A bare filename forces the primary to guess which one, which directory, or to grep. The repo-relative path is unambiguous, immediately copy-pasteable into an editor, and survives one-off lookups by future readers of the transcript. It also pairs cleanly with the markdown-link convention applied in the chat surface (link href is the repo-relative path so the chat renderer can resolve it). The failure mode it prevents is the few-second-each, accumulating friction of "which `pipeline.ts` do you mean?".

## Trigger

Codified during T-5.12 (A3 So-What). The v15 planning-audit ping called out the discipline as already being applied in that ping itself and asked it be made standing. The trigger was the recurring pattern across the A3 workstream where the planner's prose and CC's responses sometimes named bare files (`a3-so-what.ts`) while the codebase carries several near-namesakes, and the primary had to disambiguate by context. Making it a standing agreement removes the question.

## Examples

**Compliance:** "A3's deterministic compute lives in `lib/agents/a3-so-what.ts:701` (`computeA3`); the two Layer-2 LLM calls are `runA3Judgment` (`:1143`) and `runA3ReasonText` (`:1046`)."

**Non-compliance:** "A3's deterministic compute is in `a3-so-what.ts`; the LLM calls are in the same file."

## Cross-references

WA23 (conventions inherited by reference, not by re-listing) — WA27 is one such convention. WA17 (questions in message output) — applies to CC's chat surface, alongside which WA27 governs how files are named in that surface. WA22 (audit phase as a versioned deliverable) — audits cite repo-relative paths throughout; WA27 codifies the practice already in effect across the docs/audits/ corpus.
