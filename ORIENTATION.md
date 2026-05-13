# Lean Samriddhi MVP, orientation document

Prepared before any code is written. Scaffolding waits on confirmation of the proposals and clarifying answers below.

## Understanding of the assignment

I am scaffolding the Lean Samriddhi MVP: a demo-grade portfolio diagnostic (Samriddhi 2) and proposal evaluation (Samriddhi 1) tool for Indian HNI wealth advisors. Real Claude API reasoning, real persistence within a session, real PDF generation, real reactivity; pre-seeded fixtures, single user, no auth, no live ingest. This first slice ships the chrome, schema, seed data, and the thinnest end-to-end vertical (Case List, New Case for Samriddhi 2 only with hardcoded mock analysis, Case Detail with hardcoded briefing content, Investor Profile, Settings), so later slices can layer in real reasoning, S1, IC1, the explorer dashboard, briefing PDF, functional read-only chat, and polish. The aesthetic contract is the Lean Samriddhi Design folder; the factual contract is the Factual Foundation folder plus the foundation document and agent skill files lifted from the full-fat repo.

### Inventory note

**Working folder:** empty. Will become the Next.js project root.

**Factual Foundation folder:** archetypes A6 through A14 (9 markdown profiles), 9 quarterly snapshots t0 through t8 at ~11 MB each (Q2 2026 through Q2 2028 covering rate cut at t3, bank shock at t5, RIL idio at t6, smallcap rally at t8), `holdings_extended.json` (113 rows), 4 Excel + 5 TXT alt-format files, 5 eCAS PDFs, 9 meeting notes, generator scripts, the `SNAPSHOT_TEST_AXIS_DESIGN.md` reference, and `sharma_marcellus_evidence_verdicts.md` (a complete worked E1 through E7 example for a Sharma family proposal evaluation).

Three things the Factual Foundation README expects to exist but **do not exist locally**: the foundation document itself, the A1 through A5 archetype profiles, and the agent skill files (E1 through E7, M0 sub-agents, S1 modes, IC1 sub-agents, A1). All three live in the full-fat repo and are lifted below.

**Lean Samriddhi Design folder:** the full design system (`colors_and_type.css`), nine screen JSX files (chrome, case list, new case, case detail S2, case detail S1, investors, explorer, settings), design system reference cards in `preview/`, brand SVGs in `assets/`, and two standalone wireframe HTMLs that render every screen on a single canvas. There is also a self-contained `ui_kits/marketing_site/` React+Babel prototype, which is an alternative to the full-fat landing page when the landing slice happens.

## Modules from the full-fat repo to lift directly

1. **Foundation document.** `/docs/doc1_v2/foundation_reference_structure.md` becomes `/foundation/foundation.md`. The canonical reference for principles, agent activation rules, governance gates, the asset class taxonomy, and the model portfolio cells. The Factual Foundation README assumes this exists; lifting it closes the gap.

2. **23 agent skill files.** `/config/skills/` becomes `/agents/`. E1 through E7 (listed equity, industry, macro, behavioural, unlisted, PMS/AIF, mutual fund), M0 (Boss, Router, Portfolio Risk Analytics, Indian Context, Stitcher), S1 (briefing, case, diagnostic modes), IC1 (Chair, Devil's Advocate, Risk Assessor, Minutes Recorder, Counterfactual Engine), A1 (challenge). YAML frontmatter for model, max_tokens, temperature, and output schema. Lift now so downstream slices already have the reasoning contracts in place; tune `max_tokens` down later for tighter demo latency.

3. **Landing page.** `/static/landing.html`, vanilla HTML/CSS/JS, navy plus gold palette with Lato typography. **Out of scope for this initial slice;** earmarked for a later slice. The full-fat landing's aesthetic differs from the application interior (Ledger Blue + Source Serif + Geist). The Design folder also ships a `ui_kits/marketing_site/` alternative that styling-matches the app. The user-vs-marketing styling decision is for the landing slice.

4. **Investor archetype seed content for the five originals.** **Caveat:** the full-fat repo's archetypes (Reddy, Mehta, Kapoor, Sharma Family Office, Bhat, Pillai) do **not** match the wireframe's named investors (Malhotra, Iyengar, Bhatt, Menon, Surana). The wireframe is the visual contract. Resolution proposed in clarifying question 2 below.

## Modules to rewrite in leaner form

1. **Frontend stack.** Full-fat uses React 19 + Vite. Lean uses Next.js App Router + TypeScript + Tailwind per the locked stack. The wireframe JSX (React via Babel inside HTML) is the source content for our components. `colors_and_type.css` becomes a `globals.css` import plus a `tailwind.config.ts` extension that exposes the design tokens as Tailwind theme values (so utility classes like `text-ink-2`, `bg-paper`, `text-accent` resolve).

2. **Backend stack.** Full-fat uses FastAPI + SQLAlchemy. Lean uses Next.js API routes + Prisma + SQLite. Investors, cases, and snapshots tables port across; governance, accountability, and trace tables stay out.

3. **Agent orchestration.** Full-fat uses LangGraph. Lean uses direct Claude API calls under `/lib/agents/`: one async function per agent that loads the lifted skill markdown, formats the prompt with case context, calls Claude with the model/temperature/max_tokens from the skill's YAML frontmatter, and parses the structured response. Thin shim; the skill files carry the prompt content.

4. **Design tokens.** Lift the CSS variable architecture pattern from the full-fat repo, but replace values with the lean design system. Single tenant so the firm-info-at-auth dance is skipped.

5. **PDF generation.** Full-fat uses HTML-to-print-PDF. **My proposal: React PDF (`@react-pdf/renderer`)** for the briefing tab export. Reasoning: deterministic vector PDFs, embedded fonts (Source Serif 4, Geist, Geist Mono), runs server-side in Node, no Chromium dependency. Trade-off: the briefing content is authored twice (once as an on-screen React component, once as a React PDF component). The alternative (Puppeteer) gives a single render path at the cost of a ~250 MB Chromium dependency plus headless-browser process management. For a local demo, React PDF is the cleaner choice. Wants confirmation.

## Modules to leave out

1. **IC1 deliberation layer in this slice.** Lift the IC1 skill files into `/agents/` now (cheap; useful for the contract), but no runtime wiring until the IC1 slice.
2. **A1 challenge layer in this slice.** Same treatment.
3. **Governance gates G1 through G3.** Wireframe shows "governance approved / pending" status copy in case rows; this is hardcoded mock for now. Real gate logic lands with the Samriddhi 1 slice.
4. **Governance, accountability, trace tables.** Out of the lean schema. Case immutability is enforced by setting `frozenAt` at write time, not a separate audit table.
5. **Multi-tenant theming.** Single firm (Anand Rathi Wealth · UHNI desk per the wireframe Settings screen), single advisor (Priya Nair). No firm-info API call.
6. **Authentication.** Single user, no login.
7. **Live ingest pipeline.** The eCAS PDFs, alt-format files, and meeting notes are demonstration artifacts of the ingest contract; not actually ingested. Investor holdings come from the markdown profiles plus `holdings_extended.json`.
8. **Explorer dashboard.** Wireframe shows an Explorer tab in the top nav. The prompt did not mention it. Open question 4 below.
9. **Real LLM reasoning in this slice.** Case creation writes a hardcoded mock analysis blob. The Anthropic SDK is plumbed, the Settings API key field works, but the diagnostic engine lands in the Samriddhi 2 slice.

## Clarifying questions

Grouped so they can be answered in one pass. The first three matter most because they shape the seed data.

### About the factual foundation

**Q1. Foundation document.** Confirm I should lift the full-fat repo's `/docs/doc1_v2/foundation_reference_structure.md` into `/foundation/foundation.md`. If a more recent or different canonical version exists somewhere I have not found, point me to it.

**Q2. A1 through A5 naming mismatch.** Three sources disagree:
- Wireframe `screen4_investors.jsx`: Malhotra, Iyengar, Bhatt, Menon, Surana.
- Full-fat `/scripts/seed_investors.py`: Reddy, Mehta, Kapoor, Sharma Family Office, Bhat, Pillai (six).
- Factual Foundation README: refers to "the existing five archetypes A1 through A5" but does not name them.

The wireframe is the visual contract for the application surfaces. My proposed approach: seed **Malhotra, Iyengar, Bhatt, Menon, Surana** as A1 through A5, and author the five profile markdown files myself by adapting wireframe content (the Investor Detail screen is fully populated for the Malhotra household; the case list rows and Investor List metadata cover the other four) plus context from the lifted foundation document. Confirm, or point me to canonical A1 through A5 profile content I have missed.

**Q3. Sharma family.** Appears in one case row of the case list and in the Samriddhi 1 New Case form mockup, but **not** in the wireframe's INVESTORS array. The local `sharma_marcellus_evidence_verdicts.md` provides full E1 through E7 verdicts for a Sharma family proposal. Is the Sharma family a 6th seeded archetype I should also create, or just demo content attached to one case row?

### About this slice's scope

**Q4. Explorer tab.** Wireframe top bar shows Cases | Investors | Explorer | Settings. The prompt mentioned only Cases | Investors | Settings. Two options: include Explorer as a visible tab routing to a "Coming in next slice" placeholder; or omit until the Explorer slice. The first preserves visual parity with the wireframe; the second is more honest about scope. I lean toward the first. Your call.

**Q5. Hardcoded content for the Case Detail screen.** The prompt says "hardcoded mock content drawn from the wireframe (e.g., the Shailesh Bhatt diagnostic case)". Two readings:
- (a) Render the entire screen as the Shailesh Bhatt diagnostic verbatim regardless of what the user picked at New Case. Simple, demo-honest.
- (b) Render the user-picked investor's name in the chrome (header, breadcrumb, snapshot date metadata), but keep the analysis body as the Shailesh Bhatt diagnostic. Cosmetically richer; the visible mismatch (e.g., "Mrs. Iyengar" header above a Bhatt-themed analysis) might confuse a viewer.

I lean (a) for this slice because the prompt explicitly says hardcoded content, and (b) creates the wrong demo expectation. Confirm.

**Q6. PDF library choice.** Confirm React PDF, or override with Puppeteer.

### About schemas and naming

**Q7. Prisma schema for the three tables.** Proposed minimum, expandable later:

- `Investor`: id (string slug, e.g. `malhotra`), name, summary_short, summary_long, profile_md (full archetype markdown), risk_appetite, time_horizon, model_cell, liquid_aum_cr (decimal), location, structure, onboarding_transcript (nullable text).
- `Case`: id (string, e.g. `c-2025-12-13-shailesh-04`), investor_id (FK), snapshot_id (FK), workflow (`"s1"` or `"s2"`), severity (`escalate` | `flag` | `info` | `ok`), headline, status (`ready` | `archived` | null), frozen_at, content_json (the analysis blob), context_note.
- `Snapshot`: id (string slug, e.g. `t0_q2_2026`), date, type (`baseline` | `quiet` | `quiet_it_cool` | `stress_rate_cut` | ...), test_axis, file_path (path to the JSON on disk), holdings_count.

Confirm shape, or flag fields to add now to avoid an early migration.

**Q8. Snapshot storage.** Each snapshot JSON is ~11 MB and contains 1,773 mutual funds with full 241-month NAV series. I propose keeping the JSONs on disk under `/fixtures/snapshots/` and storing only metadata in the database; case generation, when the reasoning layer lands, lazy-loads the relevant snapshot from disk. Confirm.

**Q9. Case ID format.** The wireframe uses `c-YYYY-MM-DD-investor-NN` (e.g., `c-2025-12-13-shailesh-04`). Confirm I follow this format with `investor` being the investor's slug and `NN` being a per-investor sequence number for the day.

**Q10. Naming conventions.** Proposed:
- DB tables: plural snake_case (`investors`, `cases`, `snapshots`).
- Prisma models: PascalCase singular (`Investor`, `Case`, `Snapshot`).
- Component files: PascalCase + `.tsx`; one folder per screen-feature inside `/components/` (e.g., `/components/case-list/CaseList.tsx`).
- API routes: REST style under `/app/api/cases/route.ts`, `/app/api/cases/[id]/route.ts`, etc.
- Agent files: keep full-fat repo naming when lifted (e.g., `e1_listed_fundamental_equity_skill.md`).

Confirm or revise.

### Defaults I will adopt unless told otherwise

The following are defensible defaults I will assume silently unless you push back:

- TypeScript strict mode on.
- Tailwind v4 with the PostCSS plugin; design tokens exposed as Tailwind theme extensions.
- No ESLint or Prettier configuration beyond Next.js defaults in this slice.
- No CI configuration in this slice. Local dev only.
- No commit hooks in this slice.
- Settings API key stored as plaintext in a single-row settings table. The prompt called "trivial encryption" sufficient; plaintext is honest about the single-user local-demo threat model.
- Wireframe HTML files used as visual reference only; not bundled at runtime.
- Local Git repo initialised in the working folder during scaffolding, no remote yet (the eventual `lean-dev` branch push is a downstream step).

## What happens next

On confirmation (or with answers to the questions above), I will:
1. Scaffold the Next.js project, install dependencies, configure Tailwind with the design tokens, initialise Prisma + SQLite, write the seed script, lift the foundation document and 23 agent skill files into the working folder, and ship the six screens with hardcoded mock content for the Case Detail.
2. Verify `npm run dev` runs cleanly with no errors.
3. Produce `BUILD_NOTES.md` summarising stack decisions confirmed, deviations and reasons, autonomous decisions, and items I would have asked about with more time.
4. Produce `NEXT_SLICE_PROPOSAL.md` recommending the next focused slice and the rationale.

Awaiting your responses.
