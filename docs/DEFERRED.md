# Deferred work

Structured backlog of items deferred from completed slices. Each item lists what it is, why it was deferred, estimated cost and runtime to resume, dependencies, and a one-line **trigger prompt** that can be pasted into a fresh Claude Code chat when ready to pick the item up.

The trigger prompts assume the responder will read this document for context. They are intentionally short; the surrounding entry carries the detail.

## Deferred from Slice 2

### 1. Five-case batch generation (originally commit 20)

**What.** Generate Samriddhi 2 diagnostic cases for the five remaining investors (Malhotra, Iyengar, Menon, Surana, Sharma) via the existing pipeline, export each as a JSON fixture in `db/fixtures/cases/`, and have the seed load all six fixtures by default.

**Why deferred.** API budget exhausted at the end of Slice 2 (Shailesh case generation consumed roughly Rs 260 in tier-1 Sonnet + Opus spend). Timing of additional funding is uncertain.

**Estimated cost.** Rs 400-800 (five cases at roughly Rs 80-160 per case, scaling with each investor's holdings count and the resulting agent input sizes).

**Estimated runtime.** Roughly 50 minutes at current serial dispatch (item 2 reverts to parallel and shortens this materially).

**Dependencies.** API budget. Independently, this benefits from items 2 and 3 (rate-limit upgrade) being resolved first; the serial path works under tier 1 but the wall-clock time is high.

**Trigger prompt.**

> Resume commit 20 from DEFERRED.md, generate the five remaining Samriddhi 2 cases (Malhotra, Iyengar, Menon, Surana, Sharma) via `runDiagnosticPipeline`, export each as a fixture in `db/fixtures/cases/` via `scripts/export-case-fixture.ts`, verify the seed loads all six fixtures by default.

### 2. Parallel agent dispatch reversion

**What.** `lib/agents/pipeline.ts` currently runs evidence agents serially (one at a time) instead of in parallel via `Promise.all`. Revert to parallel; the `EvidenceBundle` / `UsageBundle` shape is unchanged.

**Why deferred.** Tier-1 Anthropic rate limit on Sonnet 4.6 is 10,000 input tokens per minute. Parallel dispatch of six agents at roughly 6,000 input tokens each tripped the limit immediately. Serial dispatch self-regulates because each call takes 60-90 seconds wall time; by the time the next call dispatches, the previous call's input tokens have aged out of the rolling-minute window.

**Estimated cost.** Zero. Code change only.

**Estimated runtime.** Roughly 10 minutes to revert plus end-to-end pipeline verification.

**Dependencies.** Tier upgrade to Tier 2 or higher (Tier 2 unlocks at $40 cumulative console spend per Anthropic's published limits).

**Trigger prompt.**

> Revert the serial-dispatch refactor in `lib/agents/pipeline.ts` to parallel `Promise.all`; the rate-limit constraint has lifted. Verify by running the existing Shailesh case generation and confirming wall-clock drops from roughly 10 minutes to roughly 90 seconds.

### 3. S1-to-Sonnet reversion

**What.** `LEAN_RUNTIME_OVERRIDES` currently leaves `s1_diagnostic_mode` on its skill-authored Opus 4.7. The intended Slice 2 economics-driven default was Sonnet 4.6 for every evidence agent and S1. Revert S1 to Sonnet.

**Why deferred.** Tier-1 Sonnet's 10k-input-tokens-per-minute limit cannot accommodate S1's roughly 15-25k-input-token call in a single request. Opus has a higher tier-1 ceiling (roughly 30k tokens per minute) which absorbs S1 comfortably.

**Estimated cost.** Zero. Code change only. (Will materially reduce per-case spend once it lands.)

**Estimated runtime.** Roughly 5 minutes to revert plus verification.

**Dependencies.** Tier upgrade.

**Trigger prompt.**

> Restore S1 to Sonnet via `LEAN_RUNTIME_OVERRIDES` in `lib/agents/skill-loader.ts`; the rate-limit constraint has lifted. Verify by regenerating the Shailesh case.

### 4. PDF font upgrade

**What.** Replace React PDF's built-in Times-Roman / Helvetica / Courier fonts with the lean MVP design system: Source Serif 4 (body), Geist (sans), Geist Mono (mono). Register the TTF assets via `@react-pdf/renderer`'s `Font.register`.

**Why deferred.** Built-in fonts work end to end for the Gate 2 review; full font registration is a Slice 7 polish item and was out of scope for the Slice 2 closure. As a side effect, the rupee glyph (₹, U+20B9) does not render in Times-Roman; the PDF currently substitutes a Latin-1 fallback character. The proper glyph appears once design fonts are loaded.

**Estimated cost.** Zero. The TTF assets need to be sourced (Google Fonts for Source Serif 4 and Geist; both freely licenced).

**Estimated runtime.** Roughly 30-45 minutes.

**Dependencies.** None.

**Trigger prompt.**

> Implement Source Serif 4 and Geist font registration in `components/pdf/BriefingPDF.tsx` per the visual target in the Lean Samriddhi Design folder. Replace the Times-Roman / Helvetica / Courier defaults throughout. Verify the rupee glyph (₹) renders correctly in the regenerated PDF.

### 5. Dynamic page numbering in PDF footer

**What.** The PDF footer right-side currently reads "Case <id> · Frozen artefact" statically. The intended copy is "Case <id> · Page X of Y". The `render` prop on `<Text fixed>` did not produce output in `@react-pdf/renderer` 4.1 even when wrapped in a fixed `<View>`.

**Why deferred.** Needs investigation of the library version (likely a regression or an undocumented constraint). Out of scope for Slice 2 closure; the static right-footer carries the case ID for provenance.

**Estimated cost.** Zero.

**Estimated runtime.** Roughly 15-20 minutes including a library bump and verification.

**Dependencies.** None.

**Trigger prompt.**

> Restore dynamic "Page X of Y" in the briefing PDF footer right-side; investigate `@react-pdf/renderer` version constraint. The current static text in `components/pdf/BriefingPDF.tsx` is the workaround.

### 6. Frozen holdings on case detail

**What.** The Case Detail page's "Holdings reference" table currently reads from `Investor.holdingsJson` (the live state). The briefing's section 7 evidence appendix is part of `Case.contentJson` and was frozen at generation time. After Slice 2's structured-holdings cleanup (commit 18), these two paths can diverge for Shailesh: the live record now shows "HDFC Arbitrage Fund" while the briefing's appendix still shows "Aditya Birla Arbitrage Fund". The case is the frozen artefact; the analysis tab should freeze with it.

**Why deferred.** Requires either (a) snapshotting `Investor.holdingsJson` into `Case.contentJson` at generation time and reading it back, or (b) accepting the divergence as benign (the briefing self-describes its provenance via the coverage note). Pragmatic for Slice 2.

**Estimated cost.** Zero.

**Estimated runtime.** Roughly 30 minutes.

**Dependencies.** None.

**Trigger prompt.**

> Freeze holdings at case generation time. Snapshot `Investor.holdingsJson` into `Case.contentJson.holdings_at_generation`; have the Case Detail AnalysisTab read from there with a fallback to the live record for older cases.

### 7. Streaming reasoning output

**What.** The orientation Q1 deferred streaming. The pipeline returns one complete result; the generating screen polls until ready and renders the full briefing on completion. Streaming would surface observations as agents finish.

**Why deferred.** Approved batch posture per orientation Q1. The 30-second wireframe expectation (now 10 minutes under serial dispatch, 90 seconds once parallel returns) is acceptable for the demo with a calm loading state.

**Estimated cost.** Zero.

**Estimated runtime.** Roughly 4-6 hours. Non-trivial because it requires per-agent streaming, server-sent events or websockets, and a fundamentally different Case Detail UX.

**Dependencies.** Most useful after item 2 (parallel) lands; agents finishing close together rather than at 90-second intervals makes streaming more responsive.

**Trigger prompt.**

> Implement streaming reasoning output per the deferred Slice 2 Q1 framing. Per-agent completion surfaces in the generating screen via server-sent events. Parallel dispatch must already be active.

### 8. M0.IndianContext activation (blocked on Workstream C)

**What.** The `agents/m0_indian_context.md` skill is lifted but not wired. It carries tax and regulatory framing (NRE-resident conversion, HUF eligibility, LTCG step-up at inheritance) sourced from six YAML knowledge stores (tax_matrix, structure_matrix, sebi_boundaries, gift_city_routing, demat_mechanics, regulatory_changelog).

**Why deferred.** Slice 3 scoping response B revised orientation Q4: the curated YAML stores don't exist in the codebase, and LLM-as-knowledge-store would violate the platform's auditability USP. **Workstream C** (a parallel workstream running in a separate chat) curates the six YAML stores at demo fidelity with explicit "indicative reference data; not validated for production use" disclosure. Commit 3 of Slice 3 stays blocked until that workstream completes.

**Estimated cost.** Roughly $0.30-0.50 for the Sharma + Marcellus IndianContext stub generation (one deterministic-with-LLM-fallback call) once Workstream C lands. Per-case cost in live mode similar.

**Estimated runtime.** Roughly 2-3 hours for the integration once Workstream C completes: wire the YAML loader, add the IndianContextOutput proper schema, populate `ctx.indianContext` in `lib/agents/pipeline-case.ts`, regenerate the Sharma IndianContext stub. Workstream C's curation timeline is its own; check the parallel chat for status.

**Dependencies.** Workstream C YAML curation. Until that's complete, Slice 3 agents proceed with `ctx.indianContext = null` and the "not yet integrated" sentinel in their prompts.

**Trigger prompt.**

> Resume Slice 3 commit 3 from DEFERRED.md item 8. Workstream C has landed the six M0.IndianContext YAML knowledge stores. Wire the loader into `lib/agents/case/case-context.ts` (replace the placeholder IndianContextSummary with the curated schema), populate `ctx.indianContext` in `lib/agents/pipeline-case.ts` before the evidence agents fire, regenerate the Sharma `m0_indian_context.json` stub via a focused live-mode call, and verify the Sharma case briefing surfaces the tax / lock-in / regulatory framings in section 7's data sufficiency notes.

## Deferred from Slice 3

### 9. Real-mode Sharma + Marcellus case regeneration

**What.** Replace the current hybrid Sharma fixture (E1-E7 parsed from authored verdicts, S1 + A1 live-generated) with an end-to-end real-mode case where every layer runs live against the canonical Sharma + Marcellus proposal. Records every stub as a side effect; the resulting fixture supersedes the parsed-stub version.

**Why deferred.** Slice 3 orientation §funding context: parsed-from-verdicts shipping is the budget-aware path. Real-mode regeneration produces richer per-agent reasoning that exercises each skill's full prompt, but the parsed verdicts are demo-grade. Run when budget is comfortable.

**Estimated cost.** $5-10 (eight LLM calls at Opus 4.7: E1, E2, E3, E4, E6 plus M0.IndianContext plus S1, A1; E5 and E7 stay deterministic non-activation).

**Estimated runtime.** 10-15 minutes once parallel agent dispatch reverts (item 2); roughly 50 minutes at current serial dispatch.

**Dependencies.** API budget. Benefits from item 2 (parallel) and item 8 (IndianContext) being resolved first; real-mode generation can also run without IndianContext if Workstream C is still mid-flight.

**Trigger prompt.**

> Resume DEFERRED item 9. Regenerate the Sharma + Marcellus case end-to-end in live mode via `scripts/generate-sharma-fixture.ts` adapted to call every layer through the orchestrator without the parse-from-verdicts shortcut. Set STUB_MODE=false, STUB_RECORD=true. Confirm budget before running. Replaces `db/fixtures/cases/c-2026-05-14-sharma-01.json` and every stub fixture under `fixtures/stub-responses/c-2026-05-14-sharma-01/`.

### 10. Samriddhi 1 case-mode briefing PDF

**What.** A React PDF renderer for the seven-section BriefingCaseContent, mirroring the Slice 2 BriefingPDF scaffolding. The Outcome tab on the web is the current primary surface; the Export briefing button is hidden on s1 cases. Adding the PDF re-enables the button and gives the advisor a take-into-the-meeting artefact.

**Why deferred.** Slice 3 shipped the Outcome web view as the primary surface. Building the case-mode PDF was out of scope for the slice's budget envelope. The scaffolding is in place (`components/pdf/BriefingPDF.tsx` already handles `BriefingContent`; the case shape is structurally similar).

**Estimated cost.** Zero (no API spend; component implementation).

**Estimated runtime.** Roughly 3-5 hours: clone the diagnostic BriefingPDF, refactor it to consume `BriefingCaseContent`, lay out the seven sections (proposal summary, verdict, governance, challenges, talking points, evidence summary, coverage note), wire to `app/api/cases/[id]/briefing.pdf/route.ts` to detect workflow and route to the right renderer.

**Dependencies.** None.

**Trigger prompt.**

> Implement the Samriddhi 1 case-mode briefing PDF per DEFERRED item 10. Build a `BriefingCasePDF` component mirroring the Slice 2 BriefingPDF scaffolding but consuming `BriefingCaseContent`. Update `app/api/cases/[id]/briefing.pdf/route.ts` to route workflow=s1 cases to the new renderer. Re-enable the Export briefing button on s1 cases in `app/cases/[id]/page.tsx`.

### 11. Richer evidence-agent scope builders for live mode

**What.** The Slice 3 orchestrator (`lib/agents/pipeline-case.ts`) builds short scope blocks for each evidence agent from the investor + proposal context (e.g., "Look-through universe of Marcellus Consistent Compounder PMS"). Adequate for stub replay; thin for live-mode runs on non-Sharma investors. Richer scope-builders would derive look-through stocks from the snapshot, compute sector weights, surface manager / strategy facts from a curated PMS/AIF database, etc.

**Why deferred.** The Slice 3 MVP demo runs Sharma's case under stub replay (scope is ignored). Live-mode runs on non-Sharma investors would still produce reasonable verdicts informed by the LLM's world knowledge plus the generic scope; the gap is noticeable but not blocking.

**Estimated cost.** Zero (code only).

**Estimated runtime.** Roughly 6-10 hours: build `buildE1CaseScope`, `buildE6CaseScope`, etc. from holdings + snapshot data; verify against the Sharma case's verdicts file as the reference shape.

**Dependencies.** None for the core; benefits from snapshot look-through coverage improvements (a separate Slice 7 polish item not currently in DEFERRED).

**Trigger prompt.**

> Implement richer evidence-agent scope builders per DEFERRED item 11. Replace the generic scope strings in `lib/agents/pipeline-case.ts` with per-agent scope-builder functions in `lib/agents/case/scope-builders.ts` that consume `StructuredHoldings`, `StructuredMandate`, and the snapshot data. Test against a Bhatt or Surana Samriddhi 1 case to verify the live-mode output matches the verdicts file's analytical depth.

### 12. Multi-investor Samriddhi 1 case batch

**What.** Generate Samriddhi 1 proposal-evaluation cases for the five investors beyond Sharma (Malhotra, Iyengar, Bhatt, Menon, Surana) with appropriate per-investor proposals (e.g., Bhatt's PMS-rationalisation rebalance, Surana's AIF Cat II addition, Iyengar's conservative-mandate-aware listed-bond entry). Export each as a JSON fixture; the seed loads all six s1 cases plus the existing six s2 cases.

**Why deferred.** Slice 3 single-case scope per orientation Q5. Multi-investor cases require per-investor proposal authoring (which actions make sense for each archetype) plus the live-mode spend.

**Estimated cost.** Roughly $25-50 for five cases at the Sharma per-case spend levels, assuming hybrid generation (parsed evidence verdicts where authored content exists, live for the rest). End-to-end live would be $25-50.

**Estimated runtime.** Roughly 1-2 hours of authoring per case (proposal definition + manual verdict scaffolding); 50 minutes serial or 10 minutes parallel for live generation.

**Dependencies.** Per-investor proposal authoring (a content task, not engineering); item 2 (parallel) for the runtime savings; API budget for the live spend.

**Trigger prompt.**

> Resume DEFERRED item 12, multi-investor Samriddhi 1 case batch. Author proposals for Malhotra, Iyengar, Bhatt, Menon, Surana (one canonical proposal per investor matching their mandate and life-stage), generate via `scripts/generate-sharma-fixture.ts` adapted as `scripts/generate-s1-batch.ts`, export each as a fixture in `db/fixtures/cases/`, verify the seed loads all eleven cases by default.

## Maintenance

When an item is resolved, remove its entry. When new items defer from future slices, add them here following the same shape. The pattern: a short trigger prompt is the operational handle; the entry around it is the context.
