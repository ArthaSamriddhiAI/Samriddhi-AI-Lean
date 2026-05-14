# Slice 1 build notes

What landed in the scaffolding slice, what was deviated from, what was decided autonomously, and what would have been worth asking about with more time.

## Stack decisions confirmed

- Next.js 15 App Router + TypeScript strict + Tailwind 4 (via PostCSS plugin).
- Prisma 6 + SQLite. Migrations live in `prisma/migrations/`; the dev.db file is gitignored.
- Anthropic SDK plumbed in `lib/claude.ts` and `app/api/anthropic-test/route.ts`; direct API calls (no LangGraph), as approved.
- React PDF earmarked for the briefing PDF export; not yet wired (slice 2 work).
- Source Serif 4, Geist, Geist Mono via `next/font/google`. Design tokens (Ledger Blue, warm paper, ink scale, hairline rules, 4px spacing) declared as Tailwind 4 `@theme` variables in `app/globals.css`.

## Deviations from the prompt

- **Investor count.** The original prompt said "14 archetypes". The orientation review settled on 6 (A1-A5 from the foundation document plus the authored Sharma family) because the wireframe's investor list shows only those names and the user's approval explicitly reviewed 6 profiles. The 9 fixture archetypes A6-A14 from the local Factual Foundation folder are test infrastructure for later slices, not part of the demo's visible investor list. Resurrection is trivial: append them to the INVESTORS array in `db/seed.ts`.
- **Skill file count.** The orientation document said 23 lifted skill files based on the prior inspection agent's count. The actual count in `/config/skills/` on the dev branch is **21**. The discrepancy is benign and was logged in `LIFT_INVENTORY.md`.
- **Foundation document.** The orientation initially proposed lifting `foundation_reference_structure.md` from the full-fat repo. The user corrected this: that file is a meta-specification for full-fat documentation, not the factual contract. The actual factual contract is `Lean_Samriddhi_MVP_Factual_Foundation.md` from `02 - Factual Foundation/`, lifted into `foundation/foundation.md`.

## Autonomous decisions

These were judgement calls during the build, all of them documented inline.

- **Auth on the new GitHub remote.** The PAT is embedded in the remote URL (`https://<token>@github.com/...`). Contained to `.git/config` (gitignored by git itself); no global git config changes were made. The credential-helper alternative would require a Keychain prompt on first push that is awkward in a non-interactive environment.
- **Snapshot JSONs not shipped.** The 9 quarterly snapshot JSONs are ~11 MB each (99 MB total). They are not in the working folder; `db/seed.ts` records metadata only. When slice 2 needs the JSONs, a copy-from-fixtures step copies them under `fixtures/snapshots/` (gitignored, set up locally).
- **Case content fixture.** Per the approved Q5 option (a), every case renders the Shailesh Bhatt diagnostic verbatim regardless of selected investor/snapshot. The case's chrome (header, breadcrumb) reflects the user-picked investor; the body is fixed. `lib/fixtures/shailesh-bhatt-case.ts` is the single source of that content.
- **Profile content rendering.** The InvestorDetail page uses `react-markdown` + `remark-gfm` to render `Investor.profileMd` rather than a structured per-section layout. The wireframe's attribute grid is derived from structured DB fields (riskAppetite, timeHorizon, modelCell, liquidAumCr, location); below it the markdown renders the prose + portfolio table.
- **Tab state for case detail.** Tab state lives in the URL via `?tab=briefing` (default = analysis). Linkable; no client state needed. The whole page is a server component.
- **Filter pills on case list.** Visually present, click does not filter. The volume in this slice does not yet warrant the interaction; click-to-filter waits for slice 5 or 7.
- **Empty state copy.** The wireframe has no empty state. I authored the brand-voice-consistent message: "No cases yet. Open a new case to begin a portfolio diagnostic or proposal evaluation. Cases are frozen once generated and accumulate as the book is reviewed."
- **Settings auto-save.** Fields auto-save on blur (or change for the model dropdown). The bottom save-bar shows the last saved time. Matches the wireframe's "All changes saved · 14:02 IST" pattern but without a separate Save button.
- **db/seed-cli.ts split.** `db/seed.ts` was refactored to export `seedDatabase()` and `clearDemoData()` so the demo-data API route can call them without re-running the seed at module-import time. A small `db/seed-cli.ts` is the CLI entry that `npm run db:seed` invokes.
- **2 moderate vulnerabilities in `npm audit`.** Left unaddressed because `npm audit fix --force` would introduce breaking changes. Worth a clean pass during slice 7 polish.

## Items I would have asked about with more time

- **Per-firm branding.** The model dropdown in Settings shows Opus, Sonnet, Haiku. The Test Connection button always uses Haiku regardless of the user's chosen model. Reasonable for a connectivity check; worth confirming if the demo is firm-specific.
- **Case Detail's "Share link" button.** Disabled in slice 1. Should this be a public link, an internal link with a token, or a copy-to-clipboard of the current URL?
- **Briefing PDF metadata.** When React PDF generation lands in slice 2, the PDF will need a footer/title metadata block (advisor name, firm, case ID, generation timestamp). Settings carries advisor and firm names; need to confirm the exact footer format.
- **Severity colour treatment.** Severity values in the database use the wireframe vocabulary: escalate (red), flag (warm gold), info (Ledger Blue), ok (green). The new-case fixture writes severity=escalate. When real LLM reasoning lands, severity should be inferred from the observation set, not hardcoded.
- **Profile markdown drift.** A1-A5 profile content lives in both `foundation/foundation.md` Section 4 AND inline in `db/seed.ts` (as template-literal strings). Any edit to the foundation document requires a manual re-sync of the seed strings. A one-time parser could derive the seed strings from the foundation doc; for slice 1 the manual sync is acceptable.

## What is functional, what is not

| Surface | State |
|---|---|
| Top nav (Cases, Investors, Explorer, Settings) | Functional |
| Case list with empty state | Functional |
| New Case workflow selector (S2 only) | Functional |
| New Case diagnostic intake | Functional; writes to DB |
| Case Detail Analysis tab | Renders Shailesh Bhatt fixture verbatim |
| Case Detail Briefing tab | Renders Shailesh Bhatt fixture verbatim |
| Case Detail chat panel | UI shell only; input disabled |
| Case Detail "Export briefing" | Disabled placeholder |
| Case Detail "Share link" | Disabled placeholder |
| Investor list (6 archetypes) | Functional |
| Investor detail | Functional; renders profile markdown + transcript when present |
| Settings, API key + model | Functional; PATCH endpoint writes to DB |
| Settings, Test connection | Functional; calls Anthropic |
| Settings, Load demo data | Functional; re-runs seedDatabase |
| Settings, Clear demo data | Functional; truncates investor/case/snapshot tables |
| Settings, View model portfolio | Disabled placeholder for slice 5 |
| Settings, PDF letterhead upload | Disabled placeholder for slice 7 |
| Explorer | Coming-soon stub |

`npm run dev` starts clean. `npm run typecheck` passes. The dev server has been running throughout the build; no warnings of consequence.
