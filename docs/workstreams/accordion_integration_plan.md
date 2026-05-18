# Accordion redesign integration: delta plan

Status: Checkpoint 1 reviewed. Section 5 confirmed. Decisions A to H recorded below; B, F, H carried as small clarifications resolved in Section 6. Not committed. Implementation (Step 4) begins once B, F, H are confirmed.

Branch: `design`, created off `main` at `d14b47b` (the latest local commit, equal to the `origin/main` ref the repo currently tracks). Working tree clean.

Source of truth for the rendering contract: the locked Concept C mockup (the self extracting bundle the user pasted). I decoded its template and its five bundled component assets. The operative Concept C source is `AccordionC` plus `useOpenSet` (mockup asset 3) and the `S1C` / `S2C` / `CaseToolbar` surface wrappers (mockup asset 4).

---

## 0. Two process notes before the delta

**0a. Git remote: resolved.** The prior broken-token memory is stale. The user confirmed SSH is set up and push and PR work normally; stale memory has been corrected. `design` was created locally off `main` at `d14b47b` (equal to the tracked `origin/main`), so the skipped `git pull` was a no op. The end of session PR (Step 10) will be pushed and opened with `gh` as normal. No PR delivery blocker remains.

**0b. Prompt vs repo conflicts surfaced (per the prompt footer).**
- The mockup's Concept C section set for S1 Outcome and S2 does not match the real persisted schema (`BriefingCaseContent`, `BriefingContent`). The mockup carried a hand authored prototype data shape. This is the central structural decision; see Section 5.
- `docs/BUILD_ROADMAP.md` and `docs/PRODUCT_DEBT_LOG.md` do not mention an accordion redesign workstream or a shared `design` branch. Not a hard conflict; I will add the workstream framing in the PR notes and a roadmap line, not silently.
- Skill frontmatter references `output_schema_ref: schemas/<name>.schema.json`, but no `schemas/` directory or `*.schema.json` file exists anywhere in the repo. The real output contract is enforced by TypeScript validators and runtime prompt templates, not JSON schema files. Schema additions land there (see Section 3), not in nonexistent schema files.

---

## 1. The locked Concept C contract (what we are building to)

Primitive `AccordionC` (becomes a real component). Item shape: `{ id, num, title, headline, severity, status, figure, body, defaultOpen }`.

DOM per row:
```
<div class="ar-c-item sev-{sev} {is-open?}">
  <button class="ar-c-head">
    <span class="ar-c-pill {pillClass}">{status || statusLabel(sev)}</span>
    <span class="ar-c-titleblock">
      <span class="ar-c-title-row">{num? <span class="ar-c-num">}{<span class="ar-c-title">}</span>
      {headline? <span class="ar-c-headline">}     // Source Serif
    </span>
    <span class="ar-c-aside">{figure?}<span class="chev"><ChevR/></span></span>
  </button>
  {isOpen? <div class="ar-c-body">{body}</div>}
</div>
```
Bulk controls: `.ar-controls > .eye (eyebrow + .ct count) + .ar-bulk (button "Expand all" / .sep "·" / button "Collapse all")`.

Severity vocabulary `esc | flg | inf | ok | muted`. `statusLabel`: esc "Escalate", flg "Flag", inf "Info", ok "Pass", muted "Note". `pillClass`: muted maps to `mut`, otherwise the raw severity. Left rule colour: `sev-esc` neg, `sev-flg` warn, `sev-inf` accent, `sev-ok` pos, muted or none stays `--rule-strong`.

Default open (locked, derived not hardcoded): only Escalate severity opens by default. Flag stays closed with pill visible. Production must compute the default open set from `severity === "esc"`, not from a per case id list (the mockup hardcoded `s2: ["summary","concentration","deployment"]` for the prototype only).

Always visible bands: S1 Outcome carries a Verdict band (synthesis risk + confidence + governance gates). S2 carries a Diagnostic band (executive summary headline + escalate/flag/total tally). The band carries the headline; rows open only above the flag threshold.

`.ar-c-headline` uses `var(--font-serif)` (Source Serif 4). All required tokens already exist in `app/globals.css` (`--color-neg/-tint`, `--color-warn/-tint`, `--color-accent/-tint`, `--color-pos/-tint`, `--color-rule`, `--color-rule-strong`, `--font-serif`, `--font-sans`). Source Serif 4 and Geist are already wired via `next/font` in `app/layout.tsx`.

---

## 2. Visual integration delta (scope items 1 to 6)

| File | From | To |
|---|---|---|
| `components/case-detail/Accordion.tsx` | does not exist | NEW. The Concept C `AccordionC` primitive plus `useOpenSet`, `BulkControls`, `ChevR`, `statusLabel`, `pillClass`, default open derived from `severity === "esc"`. Server friendly shell with a client island for open state. |
| `app/globals.css` | no `.ar-c-*` classes | ADD the Concept C class block (`.ar-c`, `.ar-c-item`, `.sev-*`, `.ar-c-head`, `.ar-c-pill` and variants, `.ar-c-titleblock`, `.ar-c-title-row`, `.ar-c-num`, `.ar-c-title`, `.ar-c-headline`, `.ar-c-aside`, `.chev`, `.ar-c-body`, `.ar-controls`, `.ar-bulk`, `.eye`, `.ct`) transcribed from the mockup, using existing `--color-*` token names. |
| `app/cases/[id]/page.tsx` S1 branch (lines 119 to 175) | toolbar right is a single disabled "Share link" button (148 to 152) | REMOVE Share link. Toolbar right becomes empty (decision D: omit the mockup's "Record decision" button entirely; it would be fake functional, same anti pattern as Share). Keep the Outcome / Analyst tabs; tab label "Analyst reports" with a data driven count (decision F). |
| `app/cases/[id]/page.tsx` S2 branch (lines 234 to 300) | tab strip "Analysis" + "Briefing PDF" (251 to 264); toolbar right "Share link" disabled + "Export briefing" anchor to `/api/cases/[id]/briefing.pdf` (265 to 277) | REMOVE the entire `case-tabs` strip. S2 renders the analysis surface directly as the page. REMOVE Share link. REMOVE "Export" (decision E: dead button anti pattern, no real second artifact). Toolbar right becomes a single "Download slide deck" button (Download glyph) wired to the existing `/api/cases/[id]/briefing.pdf`. Styling: keep the mockup's `btn-ghost` for this button as locked, even though it now sits alone (flagged in build notes). `BriefingTab.tsx` is no longer routed to; it stays in the tree only as the PDF render path (unchanged). |
| `components/case-detail/OutcomeTab.tsx` | renders 8 fixed linear `<section>` blocks, no accordion | Render the always visible Verdict band, then `AccordionC` of the section rows. Section to row mapping in Section 5. Bodies reuse existing JSX moved into row `body`. |
| `components/case-detail/AnalystReportsTab.tsx` | renders each verdict as a stacked `<article class="agent-memo">` | Render `AccordionC`. Per agent row: pill = risk (activated) or muted "Not activated"; `headline` = new `one_line_summary`; `figure` = `conf. {confidence}`; `body` = existing memo JSX (drivers / flags / reasoning / data points). IC1 memo stays appended. Default open none (no agent at High risk). Risk to severity mapping: Open Question C. |
| `components/case-detail/AnalysisTab.tsx` | renders linear `workbench-section` blocks | Render the always visible Diagnostic band (header tally), then `AccordionC` of the S2 section rows. Mapping in Section 5. |
| `components/chrome/Icons.tsx` | has `Download` (used today by Export briefing) | Reuse existing `Download` glyph for both S2 toolbar buttons. No new icon. |

`BriefingTab.tsx`, `IC1Section.tsx`, `IC1Memo.tsx`, `DecisionCapture.tsx`, the PDF path, and case generation are not refactored beyond hosting their JSX inside accordion bodies.

---

## 3. Schema additions delta (scope items 7 to 8)

No JSON schema files exist. The real contract is TypeScript types plus validators plus runtime prompt templates. **Four new fields (not five): `analyst_memo.one_line_summary` is dropped; we reuse the existing dormant `one_line_takeaway` instead (decision B, Section 6).**

| Prompt field (abstract) | TypeScript home | Fixture path | Validator / loader |
|---|---|---|---|
| `synthesis.headline_takeaway` (string, one sentence) | `SynthesisVerdictSection` in `lib/agents/case/briefing-case-content.ts:42` | `content.briefing.section_2_synthesis_verdict.headline_takeaway` | add presence + string check in `lib/agents/case/s1-case.ts` `validate()` (the S1 case runtime validator) |
| `advisory_challenge[].headline_takeaway` (per item) | `AdvisoryChallengeItem` in `briefing-case-content.ts:84` | `content.briefing.section_5_advisory_challenges[].headline_takeaway` | A1 challenge validator / runtime template |
| (analyst memo headline) | REUSE existing `EvidenceSummaryItem.one_line_takeaway` (`briefing-case-content.ts:73`), no new field | `content.briefing.section_3_evidence_summary[].one_line_takeaway` (already populated for all 7 agents incl. non activated) | already validated in `s1-case.ts:183`; render by joining `evidence_verdicts[]` to `section_3_evidence_summary[]` on `agent_id` |
| `diagnostic_section.headline_takeaway` (per S2 section) | new `section_headlines` object on `BriefingContent` in `lib/agents/s1-diagnostic.ts` (98 to 109), keyed by fixed S2 row id | `content.briefing.section_headlines.<rowId>` | `validate()` in `s1-diagnostic.ts:248` and the runtime prompt template `buildPrompt` (183 to 223) |
| `diagnostic_observation.short_form` (per observation) | `HeadlineObservation` in `s1-diagnostic.ts:24` ONLY (rationale in decision H: the only observation type lacking an existing scannable field) | `content.briefing.section_1_headline_observations[].short_form` | `validate()` plus `buildPrompt` template |

All four added as required string fields going forward; backfill (Section 7 of the prompt) makes existing fixtures conform before the validator is tightened, so nothing breaks at load. Reusing `one_line_takeaway` also activates data that is currently persisted but rendered nowhere.

---

## 4. Fixtures, skills, tokens delta

- **Fixtures (7 files, `db/fixtures/cases/`):** `c-2026-05-14-sharma-01.json` (S1) gets `section_2_synthesis_verdict.headline_takeaway` and each `section_5_advisory_challenges[].headline_takeaway`. No analyst memo backfill: `section_3_evidence_summary[].one_line_takeaway` is already populated for all 7 agents (verified). The 6 S2 files (`c-2026-05-14-bhatt-01`, `c-2026-05-15-iyengar-01`, `-malhotra-01`, `-menon-01`, `-sharma-s2-01`, `-surana-01`) each get a `section_headlines` object (per S2 row `headline_takeaway`) and `short_form` on each `section_1_headline_observations[]` item. Verified: all 6 S2 fixtures share one identical `BriefingContent` shape, so no per case structural variation (this resolves the prompt's "5 other S2 cases" open item). All values authored from existing prose, not invented (Section 7 of the prompt, gated by Hard Checkpoint 2).
- **Skill files (`agents/`, markdown with YAML frontmatter and a `## Output Schema` markdown table):** `s1_case_mode.md` (adds `synthesis.headline_takeaway`; this skill already authors `one_line_takeaway` per its runtime template `lib/agents/case/s1-case.ts:99`, so no per agent skill change is needed for the analyst memo headline), `a1_challenge.md` (adds per challenge `headline_takeaway`), `s1_diagnostic_mode.md` (adds `diagnostic_section.headline_takeaway` and `diagnostic_observation.short_form`). The seven `e1..e7` memo skills are NOT edited (decision B: reuse `one_line_takeaway`, which the S1 synthesis layer already authors). The S2 contract is also enforced by the runtime template in `lib/agents/s1-diagnostic.ts` `buildPrompt`, updated in lockstep with the skill prose. IC1: one row, one `headline_takeaway` covering the deliberation punchline (decision A). Each skill change is a small focused diff: one schema table row, a one or two sentence instruction mirroring the confirmed headline style, one or two register examples.
- **Tokens:** No change required. `--font-serif`, severity colours and tints, and rule strengths all already exist in `app/globals.css` and Source Serif 4 is loaded. I will only confirm and note this in the PR; no token commit expected unless transcription surfaces a gap.

---

## 5. Central structural decision: mockup taxonomy vs real schema

The mockup's S1 Outcome rows were `proposal, synthesis, challenges, ic1, talking, decision, coverage` with governance folded into the Verdict band. The mockup's S2 rows were `summary, portfolio, concentration, behaviour, fees, deployment, coverage`. Those came from a hand authored prototype (`SHARMA_OUTCOME`, `BHATT_CASE`), not the persisted schema.

Real persisted shapes:
- S1 `BriefingCaseContent`: `section_1_proposal_summary`, `section_2_synthesis_verdict`, `section_3_evidence_summary`, `section_4_governance_status`, `section_5_advisory_challenges`, `section_6_talking_points`, `section_7_coverage_methodology_note`, plus `IC1Section` and `DecisionCapture`.
- S2 `BriefingContent`: `workbench_lede`, `section_1_headline_observations[]`, `section_2_portfolio_overview`, `section_3_concentration_analysis[]`, `section_4_risk_flags[]`, `section_5_comparison_vs_model`, `section_6_talking_points[]`, `section_7_evidence_appendix[]`, `coverage_note`, plus `header` (band data).

Recommended clean path (no schema rebuild, no case regeneration, "section structure unchanged" respected): treat Concept C as a presentational layer. Derive the accordion rows from the existing real sections; do not adopt the prototype's invented taxonomy.

- S1 Outcome rows (proposed): `01 Proposal summary` (section 1), `02 Synthesis` (section 2 body; verdict risk/confidence + G1/G2/G3 move to the always visible Verdict band, matching the locked mockup), `Advisory challenges` (section 5), `IC1 deliberation` (existing `IC1Section`, conditional), `Talking points` (section 6), `Decision` (existing `DecisionCapture`), `Coverage and methodology` (section 7). `section_3_evidence_summary` stays the compressed roll up that the Analyst Reports tab expands; it does not become its own row (matches the mockup). Row severity from the synthesis verdict and per section signals.
- S2 rows (proposed): `Executive summary` (workbench_lede), `Portfolio overview` (section 2), `Headline observations` (section 1), `Concentration analysis` (section 3), `Risk flags` (section 4), `Comparison vs model` (section 5), `Talking points` (section 6), `Evidence appendix` (section 7), `Coverage and methodology` (coverage_note). The prototype's `behaviour / fees / deployment` are `section_4_risk_flags` categories, not separate sections; they render as observations inside the Risk flags row. Row severity = max observation severity in the row; default open = any row containing an `escalate`. The `header.severity_counts` drives the Diagnostic band tally.

This keeps the seven diagnostic sections intact (section optimisation remains a future workstream) while delivering the locked Concept C visual contract. `diagnostic_section.headline_takeaway` therefore attaches one headline per real section row. Proposed concrete home: a `section_headlines` object on `BriefingContent` keyed by row id, plus `short_form` on the observation items. Confirm at Checkpoint 1 (Open Question H covers the exact field placement).

This is the single highest leverage decision in the plan. If you want the prototype's literal 7 row S2 taxonomy instead, that is a section re cut and would contradict "section structure unchanged"; I recommend against it and flag it here rather than choosing silently.

---

## 6. Decisions A to H (recorded from the Checkpoint 1 reply)

- **A. CONFIRMED.** IC1 is one accordion row. Its sub surfaces (consensus, tensions, conditions, minority view, whatever IC1 produces) render inside the row body, not as separate rows. One `headline_takeaway` summarising the deliberation's punchline. Severity from materiality / escalation.
- **B. RESOLVED to REUSE.** `one_line_takeaway` (on `section_3_evidence_summary[]`, all 7 agents incl. non activated) is authored by the S1 synthesis layer expressly as "single declarative sentence compressing the verdict for the briefing; full reasoning lives in the Analyst Reports tab" (`lib/agents/case/s1-case.ts:99`). It is currently rendered nowhere. That is exactly the Concept C closed row headline. They carry the same content and role, so per the reply's instruction we reuse it and do NOT add `analyst_memo.one_line_summary`. Render the Analyst Reports row headline by joining `evidence_verdicts[]` to `section_3_evidence_summary[]` on `agent_id`. Net: 4 new fields not 5; no `ActivatedVerdict` / validator change; no e1..e7 skill edits; dormant data activated.
- **C. ADJUSTED.** Risk to severity: `high` to `esc`, `elevated` to `flg`, `moderate` to `ok`, `low` to `ok`, not activated to `muted`. (Moderate to ok keeps the flag tier meaningful as "advisor should look at this".)
- **D. RESOLVED: omit.** No "Record decision" button. S1 toolbar right is empty. No dead button carried into the PR. Deliberate divergence from the mockup noted in build notes.
- **E. RESOLVED: kill Export.** S2 toolbar is only "Download slide deck". No Export button.
- **F. CONFIRMED label; count flagged.** Label "Analyst reports". The "X of Y" count must be data driven, not hardcoded against Sharma. Source: `content.evidence_verdicts` (Y = `.length`, X = count of `activation_status === "activated"`). Computed in `app/cases/[id]/page.tsx` S1 branch, passed to the tab. Verified Sharma yields 5 of 7. Will show the exact derivation at implementation before commit (flag back F).
- **G. RESOLVED.** Push auth is fine (SSH). Push `design` and open the PR normally at Step 10. Stale memory corrected.
- **H. CONFIRMED with rationale.** Three observation bearing types exist in `lib/agents/s1-diagnostic.ts`: `HeadlineObservation` (section_1: `vocab, severity, one_line, source`), `ConcentrationBreach` (section_3: `kind, severity, detail, evidence, figure, source`), `RiskFlag` (section_4: `category, severity, title, body, source`). `ConcentrationBreach` already carries `figure` (a short scannable value) and `RiskFlag` already carries `title` (a short scannable label); `HeadlineObservation` has only `one_line` (no scannable short form). So `short_form` is added to `HeadlineObservation` ONLY, because it is the sole observation type lacking an existing scannable field. `section_headlines` (object keyed by fixed S2 row id) on `BriefingContent` carries `diagnostic_section.headline_takeaway`.

Flag backs B, F, H were addressed with evidence and CONFIRMED in the Checkpoint 1 reply. Implementation notes carried forward:
- B: reuse `one_line_takeaway`; render Analyst Reports row headline by joining `evidence_verdicts[]` to `section_3_evidence_summary[]` on `agent_id`.
- F: emit the computed `X of Y` value in a code comment and the PR notes so it can be spot verified against a second fixture.
- H: the three observation types each expose a different scannable field (`HeadlineObservation.short_form`, `ConcentrationBreach.figure`, `RiskFlag.title`). Build one helper `getScannableField(obs)` that switches on the discriminant; do not scatter the type check across the renderer.

---

## 7. Product debt candidates (for `docs/PRODUCT_DEBT_LOG.md`, Design category, format `| ID | Description | Severity | Originating workstream | Target fix workstream |`)

These get appended to `docs/PRODUCT_DEBT_LOG.md` in the existing table format during the work, and are listed in the PR notes:
- **Record decision workflow (S1).** The mockup's "Record decision" toolbar button was omitted (decision D) because no real recording workflow exists yet. Log as a Product debt entry "S1 outcome: implement Record decision workflow", target a future workstream. Severity Low.
- **S2 data export.** The "Export" button was omitted (decision E); no second artifact beyond the slide deck PDF exists. Log as a Product debt entry "S2: define and implement a data export artifact (beyond the slide deck PDF)", target a future workstream. Severity Low.
- Concept C accordion is a presentational mapping over a section schema shaped for a different layout; a future section optimisation workstream should align the persisted S2 section model with the rendered rows. Severity Low.
- Skill `output_schema_ref` frontmatter points at nonexistent `schemas/*.schema.json` files across all agent skills; contracts actually live in TS validators and runtime templates. Pre existing, not introduced here, but worth a Tech debt line. Severity Low.

These are candidates raised here and in the PR for your decision; I will not expand scope to fix them in this session.

---

## 8. Sequence from here

1. You confirm flag backs B, F, H (addressed with evidence in the Checkpoint 1 reply message). Decisions A, C, D, E, G already locked above.
2. Visual changes (Section 2), commit per the branch and PR workflow.
3. Schema additions (Section 3), commit.
4. Draft 2 to 3 candidate headlines across field types including one muted severity example, with source prose (Hard Checkpoint 2). Stop for confirmation.
5. Backfill all 7 fixtures, one logical commit.
6. Skill file updates, focused commits.
7. Token confirmation, small commit only if needed.
8. Push `design` and open the PR to `main` (SSH auth, decision G). I do not merge.

No em dashes, en dashes, or long dashes are used anywhere in this plan or in any output for this session.
