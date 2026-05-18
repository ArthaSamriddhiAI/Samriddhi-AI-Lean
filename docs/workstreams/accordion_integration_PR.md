# PR: ready-to-open (gh CLI not installed in this environment)

The `design` branch is pushed and tracks `origin/design`. The GitHub CLI is not installed, so the PR was not opened from here. Open it via:

https://github.com/ArthaSamriddhiAI/Samriddhi-AI-Lean/pull/new/design

Base: `main`. Head: `design`. Title and body below. Do not auto-merge; squash-merge after review.

---

## Title

Accordion redesign: Concept C across the three case-detail surfaces

## Body

### Summary

Integrates the locked Concept C accordion across the three case-detail rendering surfaces: Samriddhi 2 Analysis, Samriddhi 1 Outcome, and Samriddhi 1 Analyst Reports. Severity pill leads each row, elevated severity carries a coloured left rule, the one-sentence takeaway sits in Source Serif so the row reads at a glance, and only Escalate rows open by default. The persisted seven-section schema is unchanged; Concept C is a presentational layer over the existing sections (no section re-cut, no case regeneration).

First sub-workstream on the shared `design` branch. Do not merge automatically; squash-merge after review.

### Decisions locked (referenced)

- Concept C across all three surfaces. One accordion philosophy; same vocabulary and rhythm on S2 Analysis, S1 Outcome, S1 Analyst Reports.
- Escalate-only default-open, derived from data. The open set is computed from `severity === "esc"`, not a per-case id list (the mockup hardcoded ids for the prototype only). S1 Outcome and S1 Reports open nothing (no Escalate item); S2 opens the sections that contain an Escalate observation.
- S2 tab nomenclature change. S2 loses the tab strip entirely; the analysis surface is the page. The old "Briefing PDF" tab becomes a single "Download slide deck" toolbar button wired to the existing PDF path. S1 keeps Outcome / Analyst reports tabs with a data-driven "X of Y" activated-agent count.
- Share link removed from both S1 and S2 toolbars (non-functional placeholder; the sharing model is artifact-centric).
- Section structure unchanged. This pass is visual treatment only; section optimisation remains a separate future workstream.

### Visual refinements (post-review)

1. "Download slide deck" is the filled primary button (existing Ledger Blue `--color-accent`, `btn-primary`); it is the only contrasting action on the S2 toolbar. No new token was required.
2. Microcopy spelled out: "Snapshot" to "Data Snapshot" (S2 band), "Frozen" to "Case Frozen" (both toolbars).
3. S2 risk-profile line rewritten from "stated X; revealed Y" shorthand to "Says X, behaves Y: stated appetite and revealed temperament [align | diverge | partially align]." across all six S2 fixtures.
4. Collapsed "Ask the case" rail tightened to a 44px strip; the page reclaims the horizontal space. The dead, never-applied `.chat-closed` rule was removed.

### Files changed, by category

- Visual: `components/case-detail/Accordion.tsx` (new Concept C primitive), `app/globals.css` (Concept C classes, bands, bulk controls, collapsed-rail fix), `app/cases/[id]/page.tsx` (toolbars, tabs, data-driven count), `OutcomeTab.tsx`, `AnalystReportsTab.tsx`, `AnalysisTab.tsx`, `IC1Section.tsx`, `IC1Memo.tsx`, `DecisionCapture.tsx` (body-only refactors), `lib/format/case-accordion.ts` (new severity + scannable-field helpers).
- Schema: `lib/agents/case/briefing-case-content.ts`, `lib/agents/s1-diagnostic.ts`, validators/runtime templates in `lib/agents/case/s1-case.ts` and `lib/agents/case/a1-case.ts`, `scripts/_verify-materiality.ts`.
- Fixtures: all 7 in `db/fixtures/cases/` (4 new fields backfilled; 6 S2 risk-label rewrites).
- Skills: `agents/s1_case_mode.md`, `agents/a1_challenge.md`, `agents/s1_diagnostic_mode.md`.
- Tokens: confirmed only, no change. `--font-serif` already maps to Source Serif 4 via next/font; severity tokens already in `@theme`; the accordion CSS uses `var(--color-*)` exclusively with no hardcoded hex.
- Docs: `docs/PRODUCT_DEBT_LOG.md` (P8, P9), `docs/workstreams/accordion_integration_plan.md` (the delta plan), this file.

### Product debt logged

- P8 S1 outcome: implement Record decision workflow (the mockup's "Record decision" button was omitted rather than shipped fake-functional).
- P9 S2: define and implement a data export artifact beyond the slide deck PDF (the mockup's "Export" button was omitted rather than shipped as a dead button).

### Ambiguities resolved during the session

- Analyst-memo headline: the prompt's proposed `analyst_memo.one_line_summary` was dropped. The existing `section_3_evidence_summary.one_line_takeaway` is authored as exactly that compression and rendered nowhere until now; the Analyst Reports row headline reuses it (joined to the verdict on `agent_id`). Net: 4 new fields, not 5; no e1-e7 skill edits.
- IC1: one accordion row, sub-surfaces inside the body, one headline; severity muted unless a live committee deliberation fires.
- Risk-to-severity: high to esc, elevated to flg, moderate to ok, low to ok, not_activated to muted.
- S2 section taxonomy: the mockup's prototype section names did not match the persisted `BriefingContent`; rows are derived from the real sections (governance and verdict fold into the always-visible band, matching the locked mockup).
- Validator strictness: the four new fields are required in the TypeScript types (forward contract) but validated type-if-present at runtime, so replay of stub responses recorded before these fields existed is not retroactively invalidated. The backfill makes the rendered case set conform.

### Flags for reviewer attention

- Risk-label rewrite attribution: the review note quoted the "current line" as Bhatt's, but that exact text is Surana's fixture, not Bhatt's. The exact approved phrasing ("Says aggressive, behaves aggressive: stated appetite and revealed temperament align.") was applied to Surana, and the parametrised logic to the others. Bhatt is "moderate-aggressive revealed", so it reads "partially align".
- Two cases did not fit the pattern cleanly and carry a trailing clause; please eyeball: Iyengar ("...align, with a 2022 panic-liquidation on record.") and Menon ("...align, on single-geography history with a limited Indian-market record.").
- The agent skill `.md` files are provisional/lookup-stub docs whose authored Output Schema tables predate the runtime override; the operative contract is the runtime template plus validator (updated here). The skill prose addition documents the new fields against that runtime contract.

### Test plan

- [ ] `npm run typecheck` and `npm run build` both pass (verified).
- [ ] `npm run db:seed`, then `npm run dev`.
- [ ] S1 Outcome `/cases/c-2026-05-14-sharma-01`: Verdict band, accordion of 7 rows all closed (no Escalate), "Analyst reports 5 of 7" data-driven, no Share link, Synthesis row Source Serif headline; toggle, Expand all, Collapse all work.
- [ ] S1 Analyst Reports `?tab=analyst`: per-agent rows, headline reused from one_line_takeaway, MODERATE/LOW pills, IC1 row.
- [ ] S2 Analysis `/cases/c-2026-05-14-bhatt-01`: no tab strip, single filled "Download slide deck", Diagnostic band with backfilled summary and tally, Escalate sections open by default, descriptive rows read quiet, "Data Snapshot" / "Case Frozen" / rewritten risk line, collapsed chat rail thin.
- [ ] Spot-check a second S2 case (e.g. `c-2026-05-15-iyengar-01`) to confirm registers and data-driven default-open generalise.

Merge note: review and squash-merge via GitHub. Not merged from here.
