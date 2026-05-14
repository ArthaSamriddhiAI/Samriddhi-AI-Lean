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

### 8. M0.IndianContext activation

**What.** The `agents/m0_indian_context.md` skill is lifted but not wired. It carries tax and regulatory framing (NRE-resident conversion, HUF eligibility, LTCG step-up at inheritance).

**Why deferred.** Skipped in Slice 2 per orientation Q1. Becomes decision-relevant for Samriddhi 1 proposal evaluation (Slice 3) where tax-aware product framings drive specific verdicts.

**Estimated cost.** Roughly Rs 30-50 per Samriddhi 1 case (one additional agent call).

**Estimated runtime.** Roughly 1-2 hours for the integration; activates as part of Slice 3's broader build.

**Dependencies.** Naturally lands in Slice 3.

**Trigger prompt.**

> Wire M0.IndianContext into the Samriddhi 1 proposal-evaluation pipeline. Tax-aware product framings should surface in the briefing's risk flags. Activates per Slice 3 orientation.

## Maintenance

When an item is resolved, remove its entry. When new items defer from future slices, add them here following the same shape. The pattern: a short trigger prompt is the operational handle; the entry around it is the context.
