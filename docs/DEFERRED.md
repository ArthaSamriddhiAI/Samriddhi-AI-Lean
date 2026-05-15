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

### 4. Frozen holdings on case detail

**What.** The Case Detail page's "Holdings reference" table currently reads from `Investor.holdingsJson` (the live state). The briefing's section 7 evidence appendix is part of `Case.contentJson` and was frozen at generation time. After Slice 2's structured-holdings cleanup (commit 18), these two paths can diverge for Shailesh: the live record now shows "HDFC Arbitrage Fund" while the briefing's appendix still shows "Aditya Birla Arbitrage Fund". The case is the frozen artefact; the analysis tab should freeze with it.

**Why deferred.** Requires either (a) snapshotting `Investor.holdingsJson` into `Case.contentJson` at generation time and reading it back, or (b) accepting the divergence as benign (the briefing self-describes its provenance via the coverage note). Pragmatic for Slice 2.

**Estimated cost.** Zero.

**Estimated runtime.** Roughly 30 minutes.

**Dependencies.** None.

**Trigger prompt.**

> Freeze holdings at case generation time. Snapshot `Investor.holdingsJson` into `Case.contentJson.holdings_at_generation`; have the Case Detail AnalysisTab read from there with a fallback to the live record for older cases.

### 5. Streaming reasoning output

**What.** The orientation Q1 deferred streaming. The pipeline returns one complete result; the generating screen polls until ready and renders the full briefing on completion. Streaming would surface observations as agents finish.

**Why deferred.** Approved batch posture per orientation Q1. The 30-second wireframe expectation (now 10 minutes under serial dispatch, 90 seconds once parallel returns) is acceptable for the demo with a calm loading state.

**Estimated cost.** Zero.

**Estimated runtime.** Roughly 4-6 hours. Non-trivial because it requires per-agent streaming, server-sent events or websockets, and a fundamentally different Case Detail UX.

**Dependencies.** Most useful after item 2 (parallel) lands; agents finishing close together rather than at 90-second intervals makes streaming more responsive.

**Trigger prompt.**

> Implement streaming reasoning output per the deferred Slice 2 Q1 framing. Per-agent completion surfaces in the generating screen via server-sent events. Parallel dispatch must already be active.

### 6. M0.IndianContext activation (blocked on Workstream C)

**What.** The `agents/m0_indian_context.md` skill is lifted but not wired. It carries tax and regulatory framing (NRE-resident conversion, HUF eligibility, LTCG step-up at inheritance) sourced from six YAML knowledge stores (tax_matrix, structure_matrix, sebi_boundaries, gift_city_routing, demat_mechanics, regulatory_changelog).

**Why deferred.** Slice 3 scoping response B revised orientation Q4: the curated YAML stores don't exist in the codebase, and LLM-as-knowledge-store would violate the platform's auditability USP. **Workstream C** (a parallel workstream running in a separate chat) curates the six YAML stores at demo fidelity with explicit "indicative reference data; not validated for production use" disclosure. Commit 3 of Slice 3 stays blocked until that workstream completes.

**Estimated cost.** Roughly $0.30-0.50 for the Sharma + Marcellus IndianContext stub generation (one deterministic-with-LLM-fallback call) once Workstream C lands. Per-case cost in live mode similar.

**Estimated runtime.** Roughly 2-3 hours for the integration once Workstream C completes: wire the YAML loader, add the IndianContextOutput proper schema, populate `ctx.indianContext` in `lib/agents/pipeline-case.ts`, regenerate the Sharma IndianContext stub. Workstream C's curation timeline is its own; check the parallel chat for status.

**Dependencies.** Workstream C YAML curation. Until that's complete, Slice 3 agents proceed with `ctx.indianContext = null` and the "not yet integrated" sentinel in their prompts.

**Trigger prompt.**

> Resume Slice 3 commit 3 from DEFERRED.md item 6. Workstream C has landed the six M0.IndianContext YAML knowledge stores. Wire the loader into `lib/agents/case/case-context.ts` (replace the placeholder IndianContextSummary with the curated schema), populate `ctx.indianContext` in `lib/agents/pipeline-case.ts` before the evidence agents fire, regenerate the Sharma `m0_indian_context.json` stub via a focused live-mode call, and verify the Sharma case briefing surfaces the tax / lock-in / regulatory framings in section 7's data sufficiency notes.

## Deferred from Slice 3

### 7. Real-mode Sharma + Marcellus case regeneration

**What.** Replace the current hybrid Sharma fixture (E1-E7 parsed from authored verdicts, S1 + A1 live-generated) with an end-to-end real-mode case where every layer runs live against the canonical Sharma + Marcellus proposal. Records every stub as a side effect; the resulting fixture supersedes the parsed-stub version.

**Why deferred.** Slice 3 orientation §funding context: parsed-from-verdicts shipping is the budget-aware path. Real-mode regeneration produces richer per-agent reasoning that exercises each skill's full prompt, but the parsed verdicts are demo-grade. Run when budget is comfortable.

**Estimated cost.** $5-10 (eight LLM calls at Opus 4.7: E1, E2, E3, E4, E6 plus M0.IndianContext plus S1, A1; E5 and E7 stay deterministic non-activation).

**Estimated runtime.** 10-15 minutes once parallel agent dispatch reverts (item 2); roughly 50 minutes at current serial dispatch.

**Dependencies.** API budget. Benefits from item 2 (parallel) and item 6 (IndianContext) being resolved first; real-mode generation can also run without IndianContext if Workstream C is still mid-flight.

**Trigger prompt.**

> Resume DEFERRED item 7. Regenerate the Sharma + Marcellus case end-to-end in live mode via `scripts/generate-sharma-fixture.ts` adapted to call every layer through the orchestrator without the parse-from-verdicts shortcut. Set STUB_MODE=false, STUB_RECORD=true. Confirm budget before running. Replaces `db/fixtures/cases/c-2026-05-14-sharma-01.json` and every stub fixture under `fixtures/stub-responses/c-2026-05-14-sharma-01/`.

### 8. Samriddhi 1 case-mode briefing PDF

**What.** A React PDF renderer for the seven-section BriefingCaseContent, mirroring the Slice 2 BriefingPDF scaffolding. The Outcome tab on the web is the current primary surface; the Export briefing button is hidden on s1 cases. Adding the PDF re-enables the button and gives the advisor a take-into-the-meeting artefact.

**Why deferred.** Slice 3 shipped the Outcome web view as the primary surface. Building the case-mode PDF was out of scope for the slice's budget envelope. The scaffolding is in place (`components/pdf/BriefingPDF.tsx` already handles `BriefingContent`; the case shape is structurally similar).

**Estimated cost.** Zero (no API spend; component implementation).

**Estimated runtime.** Roughly 3-5 hours: clone the diagnostic BriefingPDF, refactor it to consume `BriefingCaseContent`, lay out the seven sections (proposal summary, verdict, governance, challenges, talking points, evidence summary, coverage note), wire to `app/api/cases/[id]/briefing.pdf/route.ts` to detect workflow and route to the right renderer.

**Dependencies.** None.

**Trigger prompt.**

> Implement the Samriddhi 1 case-mode briefing PDF per DEFERRED item 8. Build a `BriefingCasePDF` component mirroring the Slice 2 BriefingPDF scaffolding but consuming `BriefingCaseContent`. Update `app/api/cases/[id]/briefing.pdf/route.ts` to route workflow=s1 cases to the new renderer. Re-enable the Export briefing button on s1 cases in `app/cases/[id]/page.tsx`.

### 9. Richer evidence-agent scope builders for live mode

**What.** The Slice 3 orchestrator (`lib/agents/pipeline-case.ts`) builds short scope blocks for each evidence agent from the investor + proposal context (e.g., "Look-through universe of Marcellus Consistent Compounder PMS"). Adequate for stub replay; thin for live-mode runs on non-Sharma investors. Richer scope-builders would derive look-through stocks from the snapshot, compute sector weights, surface manager / strategy facts from a curated PMS/AIF database, etc.

**Why deferred.** The Slice 3 MVP demo runs Sharma's case under stub replay (scope is ignored). Live-mode runs on non-Sharma investors would still produce reasonable verdicts informed by the LLM's world knowledge plus the generic scope; the gap is noticeable but not blocking.

**Estimated cost.** Zero (code only).

**Estimated runtime.** Roughly 6-10 hours: build `buildE1CaseScope`, `buildE6CaseScope`, etc. from holdings + snapshot data; verify against the Sharma case's verdicts file as the reference shape.

**Dependencies.** None for the core; benefits from snapshot look-through coverage improvements (a separate Slice 7 polish item not currently in DEFERRED).

**Trigger prompt.**

> Implement richer evidence-agent scope builders per DEFERRED item 9. Replace the generic scope strings in `lib/agents/pipeline-case.ts` with per-agent scope-builder functions in `lib/agents/case/scope-builders.ts` that consume `StructuredHoldings`, `StructuredMandate`, and the snapshot data. Test against a Bhatt or Surana Samriddhi 1 case to verify the live-mode output matches the verdicts file's analytical depth.

### 10. Multi-investor Samriddhi 1 case batch

**What.** Generate Samriddhi 1 proposal-evaluation cases for the five investors beyond Sharma (Malhotra, Iyengar, Bhatt, Menon, Surana) with appropriate per-investor proposals (e.g., Bhatt's PMS-rationalisation rebalance, Surana's AIF Cat II addition, Iyengar's conservative-mandate-aware listed-bond entry). Export each as a JSON fixture; the seed loads all six s1 cases plus the existing six s2 cases.

**Why deferred.** Slice 3 single-case scope per orientation Q5. Multi-investor cases require per-investor proposal authoring (which actions make sense for each archetype) plus the live-mode spend.

**Estimated cost.** Roughly $25-50 for five cases at the Sharma per-case spend levels, assuming hybrid generation (parsed evidence verdicts where authored content exists, live for the rest). End-to-end live would be $25-50.

**Estimated runtime.** Roughly 1-2 hours of authoring per case (proposal definition + manual verdict scaffolding); 50 minutes serial or 10 minutes parallel for live generation.

**Dependencies.** Per-investor proposal authoring (a content task, not engineering); item 2 (parallel) for the runtime savings; API budget for the live spend.

**Trigger prompt.**

> Resume DEFERRED item 10, multi-investor Samriddhi 1 case batch. Author proposals for Malhotra, Iyengar, Bhatt, Menon, Surana (one canonical proposal per investor matching their mandate and life-stage), generate via `scripts/generate-sharma-fixture.ts` adapted as `scripts/generate-s1-batch.ts`, export each as a fixture in `db/fixtures/cases/`, verify the seed loads all eleven cases by default.

## Deferred from PDF polish micro-slice

### 11. Structured blended-fee field on BriefingContent

**What.** The KPI strip's "Blended fee est." cell on the briefing PDF currently derives its value via heuristic regex parsing of Fee-category risk flag bodies (`extractBlendedFee()` in `components/pdf/BriefingPDF.tsx`). The heuristic is wrong on the bhatt-01 fixture: it returns `~0.72%`, which is a since-inception alpha figure parsed from the first Fee flag, rather than the `~2.1%` blended fee load that the diagnostic actually identifies elsewhere in the risk flags. Proper fix is a structured `fee_estimate_blended_pct` field on `BriefingContent`, populated by S1 synthesis, with the KPI strip reading the structured field instead of prose-parsing.

**Why deferred.** Out of scope for the PDF polish micro-slice. The micro-slice was a single-file visual implementation; touching the `BriefingContent` schema would have widened the scope to S1.diagnostic_mode prompt updates, validation in `lib/agents/s1-diagnostic.ts`, and a re-generation pass on the Bhatt fixture to populate the new field. Non-blocking: the rest of the briefing communicates the fee story correctly through the Fee-category risk flags themselves.

**Estimated cost.** Roughly $1-2 for a single S1 re-generation of the Bhatt fixture to populate the new field. Lower if a one-time deterministic backfill from the existing prose is acceptable.

**Estimated runtime.** Roughly 30-45 minutes including the schema add, S1 prompt update, validation, fixture re-generation, and PDF re-render to verify the KPI cell.

**Dependencies.** None for the structural work. The cost line above assumes API budget for the re-generation; a no-spend alternative is to compute the field deterministically from S1's existing output and backfill the bhatt-01 fixture without re-calling the model.

**Trigger prompt.**

> Add `fee_estimate_blended_pct` field to `BriefingContent` schema (`lib/agents/s1-diagnostic.ts`), update the S1.diagnostic_mode prompt to populate it from the fee analysis, regenerate the Bhatt fixture to verify, and replace the heuristic `extractBlendedFee()` parsing in `components/pdf/BriefingPDF.tsx` with a structured field read. The KPI strip should then show the correct blended fee (~2.1% for Bhatt) on the briefing PDF.

## Deferred from Slice 4

### 12. Live IC1 stub generation for the Sharma case

**What.** Run the IC1 four-step orchestrator (Chair, Risk Assessor, Devil's Advocate, Counterfactual Engine, Minutes Recorder) end-to-end live against the canonical Sharma + Marcellus case content. Each successful call records a stub fixture at `fixtures/stub-responses/c-2026-05-14-sharma-01/ic1_<role>.json`; the Sharma case fixture's `ic1_deliberation` block updates from all-sentinel to all-populated; the Outcome tab and Analyst Reports tab surfaces resolve from sentinel state to actual deliberation content automatically (no code change required, just file additions in the fixture directory plus the fixture refresh).

**Why deferred.** Slice 4 ran under Option A funding-aware mode: API budget remaining at slice start was approximately $1.54 in console; the five-call IC1 generation at Opus 4.7 was estimated at $2-4 and exceeded that envelope. The architecture ships code-complete; the demo content is a single-shot operation gated on budget clearance.

**Estimated cost.** $2-4 (five sequential Opus 4.7 calls; per-call input dominated by case context + JSON-stringified evidence + gates + upstream-role outputs).

**Estimated runtime.** Roughly 3-5 minutes wall-clock at current serial Anthropic dispatch (item 2's parallel reversion does not apply; IC1's sequential pattern is by design per orientation Q3).

**Dependencies.** API budget. No code dependency; the orchestrator and sentinel cascade are in place. Optionally benefits from item 6 (M0.IndianContext) landing first: Risk Assessor and Counterfactual Engine prompts include the `context_not_yet_available` sentinel placeholder; with IndianContext wired, those fields populate with real tax/lock-in framings.

**Trigger prompt.**

> Resume DEFERRED item 12. Run the IC1 four-step orchestrator live against the Sharma + Marcellus case via `runIC1Pipeline` with `STUB_RECORD=true` and `STUB_MODE=false`. Use the case content already on disk at `db/fixtures/cases/c-2026-05-14-sharma-01.json` for materiality, synthesis, gates, and evidence inputs. Confirm budget (~$2-4) before running. On success, five stub fixtures land at `fixtures/stub-responses/c-2026-05-14-sharma-01/ic1_*.json` and the Sharma fixture's `ic1_deliberation` block is regenerated from disk-loaded stubs to replace the sentinel state. Verify the Outcome tab and Analyst Reports tab render the populated deliberation in place of the sentinel.

### 13. Multi-investor IC1 deliberation cases

**What.** Generate IC1 deliberation surfaces for the five non-Sharma Samriddhi 1 cases (Malhotra, Iyengar, Bhatt, Menon, Surana) once those cases themselves exist per DEFERRED item 10. Each material case triggers a five-call IC1 pipeline; the resulting stubs persist alongside the case fixture; the rendered surface follows the same conditional pattern as Sharma's.

**Why deferred.** Post-MVP scope. The Slice 4 single-case rule (orientation §boundary-protections) keeps the surface area tight. Batch IC1 generation requires items 10 (multi-investor S1 cases exist), 12 (Sharma live IC1 pattern proven), and possibly 6 (IndianContext) to be resolved first.

**Estimated cost.** Roughly $10-20 (five cases at $2-4 each; some materiality firings may not require IC1 if their conditions don't trigger, lowering the bound).

**Estimated runtime.** Roughly 20-30 minutes wall-clock across all material cases at current serial Anthropic dispatch.

**Dependencies.** Items 10 (multi-investor S1 cases) and 12 (Sharma IC1 stubs as the proven pattern). Item 6 (IndianContext) is desirable but not blocking; missing IndianContext continues to emit the `context_not_yet_available` sentinel.

**Trigger prompt.**

> Resume DEFERRED item 13, multi-investor IC1 deliberation cases. For each Samriddhi 1 case where materiality fires=true (verified by `evaluateMateriality` on the loaded fixture content), run the IC1 four-step orchestrator live and record stubs at `fixtures/stub-responses/<case-fixture-id>/ic1_*.json`. Update each case fixture's `ic1_deliberation` block to reflect the populated stubs. Confirm budget (~$10-20) before running.

## Maintenance

When an item is resolved, remove its entry. When new items defer from future slices, add them here following the same shape. The pattern: a short trigger prompt is the operational handle; the entry around it is the context.
