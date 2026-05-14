# Slice 2 orientation, Samriddhi 2 reasoning and briefing PDF

Prepared before any code is written. The pipeline build waits on confirmation of the proposals and clarifying answers below. Commit cadence proposed at the bottom.

## Understanding of Slice 2's scope

Slice 2 replaces the Shailesh Bhatt fixture with real reasoning for Samriddhi 2 (diagnostic) cases. A New Case submission triggers a TypeScript orchestration runtime under `/lib/agents/` that loads the canonical investor profile, loads a snapshot from a cached on-disk JSON, computes deterministic portfolio metrics (HHI, top-N exposures, sector weights, allocation deviations, liquidity tier coverage, wrapper composition) via M0.PortfolioRiskAnalytics, routes through M0.Router to decide which evidence agents activate, runs the activated evidence agents (E1, E2, E3, E4, E6, E7 conditionally; E5 effectively never under the current six profiles) in parallel via `Promise.all`, rolls their verdicts up through M0.Stitcher, and synthesises the seven-section briefing per foundation §6 via S1.diagnostic_mode. The resulting content is persisted to `Case.contentJson` and rendered in the Analysis tab; the Briefing tab and "Export briefing" button render and download an institutional-quality PDF via React PDF. A "Generating briefing" loading state covers the roughly 30-second wait. Setup wipes the lone smoke-test case so the case list starts empty. The end-state is: any of the six seeded investors can be selected, a real briefing lands in roughly 30 seconds, and the PDF is meeting-ready.

## Where the canonical artefacts actually live

A quick reconciliation before pipeline design, because the Slice 1 notes hint at one location and the file system shows another.

- **Snapshots.** Slice 1's `BUILD_NOTES.md` says the 9 quarterly snapshot JSONs sit in the Factual Foundation folder. They actually sit in `../08 - Factual Foundation Continued/Data Snapshots/snapshots/`. Nine files, roughly 11 MB each. `SNAPSHOT_TEST_AXIS_DESIGN.md` is alongside them. The copy-fixtures script (Slice 2 deliverable 1) needs to point at the Continued folder. Filenames already match `db/seed.ts`'s `filePath` strings (e.g., `snapshot_t0_q2_2026.json`).
- **Sharma proposal verdicts file.** Lives at `../08 - Factual Foundation Continued/sharma_marcellus_evidence_verdicts.md`. Not needed in Slice 2 (Sharma's real case is deferred to Slice 3 per Q4 resolution), but worth knowing the path.
- **Foundation document.** Already lifted, no action needed.
- **Skill files.** All 21 already lifted into `/agents/`, no action needed.
- **Wireframe and design assets.** Live in `../09 - Samriddhi AI Lean MVP Design - 13 May 2026/` for visual reference of the briefing tab layout. Already mirrored in `components/case-detail/BriefingTab.tsx` for the on-screen approximation.

## Pipeline design

The shape from the orientation prompt is the right backbone. I have refinements rather than restructuring.

### Data model extension

The orientation prompt assumes investor portfolios are available structurally. They are not: today the portfolio table lives as markdown inside `Investor.profileMd`. Parsing markdown at every pipeline run is fragile.

**Proposed addition:** seed a structured `holdingsJson` field on Investor (text column, JSON-encoded). Each holding has `{ subCategory, instrument, valueCr, weightPct, assetClass }`. The structured form is derived once from the foundation profile tables during seed and re-derived if profiles change. The markdown stays the human-readable view; the structured holdings drive deterministic computation and look-through lookups against the snapshot. I will add this as part of the early Slice 2 work and migrate the seed.

### Snapshot loader with LRU cache

A `SnapshotLoader` class wraps `fs.readFile` plus `JSON.parse`. The cache is a `Map<snapshotId, ParsedSnapshot>` with capacity 3 and least-recently-used eviction (move accessed entries to the end; pop the head on overflow). The map is module-scoped, so it persists across requests within the dev server process. First access pays roughly 200-400 ms parse cost; subsequent hits are near-zero. Memory ceiling: 3 × 11 MB JSON, roughly 100 MB parsed in V8 (a conservative overhead estimate); acceptable for a local dev process.

### Skill loader

A `loadSkill(skillId)` function reads the `.md` file from `/agents/`, parses YAML frontmatter via a small handwritten parser (the frontmatter is simple and stable; pulling in `gray-matter` for this seems heavier than needed, but I will use it if the manual parser becomes brittle on edge cases), and returns `{ frontmatter, body }`. The body becomes the system prompt verbatim; the frontmatter provides `llm_model`, `max_tokens`, `temperature` defaults. A `LEAN_RUNTIME_OVERRIDES` map keyed by `agent_id` supplies Slice 2-specific tunes (e.g., lower `max_tokens` for demo speed). The skill files stay byte-identical on disk per Q2.

### Deterministic computation, M0.PortfolioRiskAnalytics

Pure TypeScript, no LLM. Reads the investor's structured holdings + snapshot + foundation model portfolio. Computes:

- Asset-class weights and deviations vs the 65/25/7/3 model bands.
- HHI at holding level (with PMS aggregated into single position and AIF aggregated into single position, per foundation §3 wrapper convention).
- HHI at asset-class level (reported as context, not thresholded per foundation §3).
- Top-1, top-5 concentration percentages.
- Liquidity tier coverage: holdings classified into T+30, T+90, T+365, locked buckets per foundation §3, against the investor's tier floor.
- Wrapper composition: count of PMS strategies, count of AIF positions, aggregate PMS share, aggregate AIF share.
- Cash share and deployment gap against the investor's liquidity tier floor.
- Sector weights for the listed-equity sleeve where snapshot top-5-sector data is available; aggregate fund-level exposure noted where not.

Output: a single `PortfolioMetrics` object that downstream LLM agents reference by field name. **This object is the deterministic contract.** Agent prompts cite values from it; agents do not recompute. The honesty-of-split principle from the prompt: every number on the briefing is either a `metric` value from this object (auditable as math) or an `interpretation` from an LLM (auditable via reasoning trace), and the case content JSON marks each accordingly.

### M0.Router

Deterministic in Slice 2 (per the skill file's "deterministic dispatch in cluster 5/6, LLM fallback later" framing). Inputs: investor's holdings, case_mode (always `diagnostic` in Slice 2). Output: an `ApplicabilityVector` with booleans for E1-E7. Rules straight out of `m0_router.md`:

- E1 fires if any direct listed equity, MF look-through equity, or PMS holding exists. True for all six investors.
- E2 fires if listed equity exists (same as E1 in practice). True for all six.
- E3 always fires (mandatory unconditional). True for all six.
- E4 fires on diagnostic if 5+ prior cases or 1+ year of relationship history; **see clarifying question 2 below**.
- E5 fires if direct unlisted equity is in advisory scope. False for all six (Surana's pre-IPO and Sharma's family business are explicitly out-of-scope).
- E6 fires if PMS or AIF holdings exist. True for Bhatt (4 PMS + 1 AIF), Sharma (1 PMS + 1 AIF), Surana (1 PMS). False for Malhotra, Iyengar, Menon.
- E7 fires if mutual fund holdings exist. True for all except Menon (cash-heavy transitional).

Per the principles §3.8 note in `m0_router.md`, M0.PortfolioRiskAnalytics activates on every diagnostic, independent of the evidence vector.

### Evidence agent harness

One async function per agent: `runE1(ctx)`, `runE2(ctx)`, etc. Each:

1. Loads the skill via `loadSkill`.
2. Builds a user prompt that contains: investor profile excerpt, the relevant holdings slice, the `PortfolioMetrics` object, a snapshot data slice scoped to the agent's needs (e.g., E1 receives the top-5 stocks and sectors for the funds in the investor's portfolio; E3 receives the snapshot's `macro` section), and an explicit instruction to produce the agent's `output_schema_ref` shape as a single fenced JSON block.
3. Calls the Anthropic SDK with `system=skill.body`, `user=builtUserPrompt`, `model=skill.frontmatter.llm_model`, `max_tokens=overrides[agentId] ?? skill.frontmatter.max_tokens`, `temperature=skill.frontmatter.temperature`.
4. Parses the JSON block. On parse failure, retries once with a "respond with valid JSON only inside a ```json fence" instruction prepended; on second failure, throws (per the orientation prompt's "fail loudly").
5. Returns the parsed verdict.

Activated agents run in parallel via `Promise.all`. Sequential dependencies are: M0.PortfolioRiskAnalytics (deterministic, before agents); evidence agents (parallel); M0.Stitcher (after agents); S1.diagnostic_mode (after stitcher).

### M0.Stitcher

Per the skill file, Stitcher is largely deterministic templating in this slice ("LLM prompt for narrative composition activates in cluster 12+"). For Slice 2 I propose Stitcher runs as a **deterministic transformer**: takes the metrics object and all evidence verdicts, produces a single `StitchedContext` object with normalised section payloads (concentration, liquidity, mandate-drift, behavioural, fee, deployment, plus per-agent verdict summaries). No LLM call here. This honours the skill file's intent and saves a token round-trip. If Slice 2's first end-to-end run shows that S1 underperforms without an LLM-stitched narrative, I will revisit and add an LLM Stitcher call as a follow-up commit.

### S1.diagnostic_mode

This is the one place I am proposing a deliberate runtime override beyond `max_tokens` tuning. The skill file's authored output schema is institutional-health-report shaped (`overall_health_verdict`, `asset_allocation_status`, `performance_summary`, `drift_indicators`, `recommendations`, `reasoning_summary`). The lean MVP's briefing PDF, per foundation §6, is advisor-talking-points shaped with seven fixed sections (Headline Observations, Portfolio Overview, Concentration Analysis, Risk Flags, Comparison vs Model Portfolio, Suggested Talking Points, Evidence Appendix).

These two structures are not 1:1. The skill's verdict roughly maps to Headline Observations + Suggested Talking Points; allocation_status + drift_indicators to Portfolio Overview + Comparison; M0.PortfolioRiskAnalytics provides Concentration Analysis (essentially deterministic); evidence agent verdicts provide Risk Flags; holdings drive the Evidence Appendix.

**Proposed approach:** use s1_diagnostic_mode's prompt body as the system prompt unchanged (the analytical voice, no-decision discipline, mandate-anchoring rules all apply), but in the user prompt instruct the LLM to return the seven-section foundation-§6 structure as a single JSON object with a fixed schema (each section a typed payload: bullets for §1, a row array for §2 and §5, observation arrays for §3 and §4, structured talking points for §6, holding array for §7). The skill's "what S1 is for" is preserved; the "what output shape" is the runtime override per Q2.

The diagnostic vocabulary in §3 and §6 is non-negotiable: every observation references a named vocabulary item from foundation §3 (`wrapper_over_accumulation`, `cash_drag`, `allocation_drift`, etc.). The prompt will be explicit: do not invent new observation names; use only the canonical vocabulary; if an observation requires a vocabulary item not in foundation §3, flag for human review rather than inventing.

### Output rendering

`Case.contentJson` stores the parsed S1 output (the seven-section payload) plus a small `runtime_metadata` block (token usage, agents activated, deterministic metrics object, generation duration). The Analysis tab renders this JSON instead of importing the Shailesh fixture; the existing fixture stays in the file system as a comparison reference but is no longer imported by the UI. The Briefing tab renders the same seven sections in PDF-styled HTML for the on-screen view.

The PDF export route (`/api/cases/[id]/briefing.pdf`) renders the same seven-section payload via React PDF and streams the binary back. Server-side rendering only; no client-side PDF generation.

### Loading state

The wireframe specifies a "Generating briefing" intermediate screen with progress steps. The cleanest pattern given Next.js 15 App Router:

1. `POST /api/cases` creates the case row with `status="generating"` and `contentJson="{}"`, then kicks off the pipeline asynchronously (fire-and-forget Promise; the route returns the case ID immediately).
2. The browser is redirected to `/cases/[id]/generating`.
3. The generating screen polls `GET /api/cases/[id]/status` every 1.5 s; when status flips to `ready` (or `failed`), it redirects to `/cases/[id]`.
4. The pipeline itself, in the background, updates the case row with the final `contentJson` and flips `status`.

In a serverless deployment this would need a job queue; for the local dev demo, fire-and-forget on the Node process is sufficient and matches the rest of the lean MVP's "local single-user demo" posture. I will note this constraint in `SLICE_2_BUILD_NOTES.md`.

### Token budget guardrail

A `BudgetTracker` per case sums `usage.input_tokens + usage.output_tokens` from every API response. Cap is a Setting (new field `tokenBudgetPerCase`, default 250,000; covers the soft 8-12 calls at roughly 6k-input + 3k-output each, plus headroom for E1's larger envelope). Exceeding the cap throws a `BudgetExceededError`; the case is marked `status="failed"` with the error message visible on `/cases/[id]/generating`. The default is high enough that the cap fires only on a bug, not on routine cases; the threshold can be lowered as confidence grows.

## Autonomous decisions I plan to make, flagged in advance

These are judgement calls I will execute unless you push back. Each is small enough to revise mid-slice.

1. **Structured `holdingsJson` field on Investor.** Add to schema; backfill in seed by encoding the foundation §4 tables. Migration via `prisma db push` (the existing pattern). The markdown profile stays for the InvestorDetail view.

2. **Snapshot loader cache scope.** Module-scoped `Map` plus LRU eviction; capacity 3. Cleared on process restart (acceptable). No filesystem-watch invalidation (snapshots are immutable fixtures).

3. **Skill loader implementation.** Hand-written YAML frontmatter parser inside `/lib/agents/skill-loader.ts`. Trivial enough that pulling in `gray-matter` is overkill; if the frontmatter ever grows lists or nested objects, I will switch.

4. **Anthropic SDK call shape.** Direct `client.messages.create` with `system` and `messages: [{ role: "user", content }]`. No tool use, no extended thinking, no streaming. The single-shot batch shape per Q1.

5. **Output schema discipline.** Each agent's user prompt ends with: `Respond with a single fenced JSON block (\`\`\`json ... \`\`\`) matching the schema described above. No prose outside the fence.` Parser extracts the fence content; failed parse triggers one retry with strengthened instruction.

6. **Per-agent model selection.** Honour the skill's `llm_model` frontmatter by default. Slice 2 lean overrides: M0.Router runs deterministically (no LLM); E3 and E4 already use Sonnet per skill; E2 uses Sonnet per skill; E1 and E6 use Opus per skill; E7 uses Sonnet per skill; M0.Stitcher is deterministic (no LLM); S1.diagnostic_mode uses Opus per skill.

7. **Token budget default.** 250,000 combined input + output per case. Tuned down later if observed runs come in lower.

8. **Loading state polling cadence.** 1.5 s. Fast enough to feel responsive; slow enough to avoid hammering the DB with status reads.

9. **Empty-string vs null in JSON outputs.** Agents return `null` for absent fields, never empty string. The TypeScript parser treats `null`, `undefined`, and missing keys identically.

10. **Deterministic-vs-LLM tagging.** Every observation in the case JSON has a `source` field: `"metric"` for numbers derived from `PortfolioMetrics`, `"interpretation"` for LLM judgements, `"hybrid"` for cases where a deterministic metric is paired with an LLM-stated context (e.g., "HHI 0.27 is elevated against the aggressive ceiling of 0.30"). The Analysis tab can render the three differently; the briefing footnotes the metric ones in the Evidence Appendix.

11. **Voice and prompt discipline.** Every evidence agent's user prompt has a final paragraph: "Maintain the analytical voice specified in your system prompt: institutional, declarative, evidence-grounded, no hedging, no advisory framing. If you cannot evaluate a dimension due to missing data, mark `cannot_evaluate` and reduce confidence; do not guess." This is belt-and-braces over the skill body's own discipline section.

12. **PDF metadata.** Footer per page: advisor name (from Settings), firm name (from Settings), case ID, "Generated DD MMM YYYY, HH:MM IST" timestamp, "Page X of Y", and a static line "Prepared, not generated. Lean Samriddhi MVP." Letterhead upload (Slice 7) is not in scope; default header is the firm name as plain text plus a small horizontal rule.

13. **Shailesh as Gate 1 archetype.** Pipeline-tested against Shailesh first (per the prompt's recommendation). The full Shailesh case content gets committed as `PROPOSED_CASE_OUTPUT_SAMPLE.md` for review before the other five run.

14. **Gate 2 PDF.** Generated from the approved Gate 1 case content; committed as `PROPOSED_CASE_BRIEFING_PDF.pdf` (or similar) for review before format is locked.

15. **Smoke-test case wipe.** A short setup script `scripts/wipe-smoke-test.ts` deletes cases created before Slice 2's first real run (any case whose `contentJson` matches the fixture tag `shailesh-bhatt-diagnostic-fixture-v1`). Conservative filter; preserves any real cases generated during Slice 2 build.

16. **E5 visibly skipped.** Since none of the six investors trigger E5 activation, the router output and case JSON will record `e5_activated: false`. No effort spent stubbing E5 in code beyond the no-op branch.

17. **M0.Indian_Context skipped in Slice 2.** Not in the explicit scope list. The skill file is regulatory/tax framing; the diagnostic briefing per foundation §6 does not require it. **See clarifying question 1.**

## Clarifying questions

These are the places where the prompt is silent or where I spotted something worth checking. Numbered for one-pass response.

### Q1, M0.Indian_Context activation in diagnostic mode

The skill files include `m0_indian_context.md`. The orientation prompt's pipeline shape sketch does not mention it. The diagnostic vocabulary in foundation §3 also does not require tax/regulatory framing. Two options:

- (a) Skip entirely in Slice 2; defer to Slice 3 (Samriddhi 1) where regulatory framings like NRE-resident conversion (Menon), HUF eligibility (none of the six), or LTCG step-up at inheritance (Iyengar) become decision-relevant.
- (b) Run as a low-budget context-augmentation step that adds 1-2 tax/regulatory notes to the briefing's Risk Flags section where applicable.

I lean (a) because the foundation §6 briefing structure does not have a natural home for tax framings as standalone observations (they would surface as Risk Flags only when material, which the evidence agents will already do via their `key_risks` arrays). Confirm.

### Q2, E4 activation on diagnostic with no prior case history

E4's skill says it activates on diagnostic "if archetype has 5+ prior cases or 1+ year of advisor relationship history." None of the six investors have any prior cases in our DB at slice start (the case list is empty by design). Three options:

- (a) Activate E4 always on diagnostic, treating the foundation profile's "Behavioural and contextual attributes" section as the character bible the skill's worked examples cite. This is the most natural read of the foundation content: every archetype has a behavioural read authored.
- (b) Skip E4 on diagnostic for now and surface a "behavioural read" purely from the foundation profile parsing (no LLM call). Cheaper, but loses E4's stated-revealed-divergence synthesis dimension.
- (c) Treat the absence of cases as triggering E4's `limited_history_flag = true`, which the skill says reduces confidence but still produces a verdict.

I lean (a). The foundation §4 archetype profiles are pre-authored character bibles; that is what the E4 skill's worked examples consume. Confirm.

### Q3, snapshot date semantics

When the advisor picks `t3_q1_2027` as the snapshot, the case's "snapshot date" reads 1 Jan 2027 in the chrome (the existing code formats `snapshot.date`). But the system wall clock for the demo is today's date (2026-05-14). The pipeline currently has no notion of "today vs snapshot date"; agents are told the snapshot data and the case is dated from `frozenAt` (always "now").

I will treat `snapshot.date` as the authoritative "as-of" date for the diagnostic and pass it into every agent's context as `as_of_date`. The `frozenAt` stays the case-generation timestamp shown on PDFs and the case list. Confirm this is the intended split.

### Q4, token budget default

Proposed default: 250,000 combined input + output tokens per case. Rationale: the soft estimate from the prompt is 8-12 LLM calls. Each evidence agent call carries an investor profile excerpt (~2k tokens), a holdings slice (~1k), the metrics object (~1k), a snapshot slice (~3-5k for E1, smaller for others), and the agent's system prompt (~3-5k); call this 10-15k input per agent. Output per agent runs 1-4k. S1 synthesis carries the full stitched context (~20k input) and produces 3-5k output. Total per case: roughly 100k-180k tokens depending on activation. 250k as the cap gives comfortable headroom while still catching runaway loops or pathological cases. Confirm or override.

### Q5, PDF header treatment

The prompt asks for "institutional-quality" PDFs with "PDF metadata footer: advisor name, firm name, case ID, generation timestamp." The header is unspecified. Two options:

- (a) Plain text header: firm name plus thin horizontal rule plus document title (e.g., "Investor briefing: Shailesh Bhatt"). Honest, no branding chrome. Matches the lean MVP's "prepared, not generated" tone.
- (b) Minimal branded header: a small "Lean Samriddhi" wordmark plus the document title.

I lean (a). The Settings letterhead upload is explicitly out of scope (Slice 7), so an honest plain header is consistent. Confirm.

### Q6, "Generating briefing" failure path

If the pipeline fails mid-run (Anthropic API error, parse failure, budget exceeded), the case row stays at `status="failed"` with an `error_message` field. The generating screen should show a clear error and a "Retry" affordance.

Proposed: the case row carries a new optional field `errorMessage`. The generating screen, when it polls `status="failed"`, renders the error message plus a Retry button that POSTs `/api/cases/[id]/retry`. The retry clears the error and re-runs the pipeline. Confirm I should build the retry affordance now, or defer to Slice 7 polish.

## Proposed commit cadence

About 18 commits across the slice, two of which are review-gated pauses. Numbered roughly in order; some can be reordered if helpful.

1. `docs: add Slice 2 orientation` (this document). Pause for review; awaiting your confirmation before code.
2. `chore: copy-fixtures script and snapshot distribution`. The `scripts/copy-fixtures.ts` and the 9 JSONs in `fixtures/snapshots/` (gitignored).
3. `feat: skill loader and runtime overrides map`. `/lib/agents/skill-loader.ts`.
4. `feat: snapshot loader with LRU cache`. `/lib/agents/snapshot-loader.ts`.
5. `feat: structured holdings extension and seed migration`. New `Investor.holdingsJson` column; seed parses foundation §4 tables.
6. `feat: M0 portfolio risk analytics deterministic module`. `/lib/agents/portfolio-risk-analytics.ts`.
7. `feat: M0 router deterministic dispatch`. `/lib/agents/router.ts`.
8. `feat: evidence agent harness and E3 macro implementation`. End-to-end shape with the easiest agent.
9. `feat: E1 listed equity per-stock and E2 industry`. The two listed-equity-aware agents.
10. `feat: E4 behavioural reading from profile`. Per Q2 outcome.
11. `feat: E6 PMS-AIF and E7 mutual fund`. The wrapper-aware agents.
12. `feat: M0 stitcher deterministic transform`. Rolls metrics + verdicts into stitched context.
13. `feat: S1 diagnostic synthesis with foundation seven-section schema`. The output-shape override per Q2.
14. `feat: pipeline wired into POST /api/cases with fire-and-forget background run`. New status polling endpoint.
15. `feat: generating loading screen with progress steps`. The intermediate screen between submit and detail.
16. **`docs: Gate 1 Shailesh case output sample for review`**. `PROPOSED_CASE_OUTPUT_SAMPLE.md`. Pause for approval.
17. `feat: react-pdf briefing component and export route`. The PDF generation.
18. **`docs: Gate 2 Shailesh briefing PDF for review`**. `PROPOSED_CASE_BRIEFING_PDF.pdf`. Pause for approval.
19. `chore: wipe smoke-test case and add token budget guardrail with Settings field`. Setup polish.
20. `feat: generate cases for remaining five investors`. Real diagnostic content for Malhotra, Iyengar, Menon, Surana, Sharma (Sharma gets a diagnostic case in Slice 2; her Samriddhi 1 proposal evaluation is still deferred to Slice 3).
21. `docs: Slice 2 build notes and Slice 3 next-slice proposal`. Wrap-up.

Push cadence matches Slice 1: after each commit. Two review gates require explicit confirmation before continuing.

## What happens next

On your confirmation (or with answers to the questions above), I will:

1. Commit this orientation document and push.
2. Walk the commit list in order, pushing each, pausing at the two review gates.
3. Produce `SLICE_2_BUILD_NOTES.md` and the updated `NEXT_SLICE_PROPOSAL.md` at the end.

Awaiting your responses.
