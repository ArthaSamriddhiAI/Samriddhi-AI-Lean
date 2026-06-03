# Is E3's macro extraction separable, or does sharing it with house view mean refactoring E3?

**Date:** 2026-06-02
**Branch:** `features/house-view` (code repo). Read-only prebuild audit; no code change, no agent run, no commit, no spend. WA22 (versioned `docs/audits/` deliverable), WA21 (grounded against the repo, read sites quoted by path and line), WA23 (conventions inherited by reference), WA27 (repo-relative paths), WA07 (no long dashes).

Follow-on to `docs/audits/2026-06-02_house_view_capability_prebuild.md`, which recommended modeling the house view macro section on E3 (the closest existing consumer of the same `macro.data_snapshot.dimensions` block). This audit answers one question: does house view reuse E3's macro extraction as shared library code, or is E3's extraction so entangled with its case lens that sharing means refactoring E3 itself? It proposes and writes nothing about the house view agent; it scopes the cost of sharing and adjudicates whether an A4 restructure is real or a distraction.

---

## Verdict: (C), in its cheap form. House view reads raw `macro.data_snapshot.dimensions` directly and copies E3's case-neutral output field shape, not its code. No E3 change. (A4 is a distraction; argue against, below.)

The question contains a buried assumption worth surfacing first: that E3 has a macro "extraction stage" which could be entangled with the case lens. **It does not.** E3 has no deterministic extraction stage at all. The macro block arrives already structured inside the snapshot (`macro.data_snapshot.dimensions`, per-indicator `value` / `direction` / `as_of_date` / `source_document` / `notes`, verified in the prior audit). E3 hands that block to the LLM verbatim (one `JSON.stringify`, no parse), and the LLM does all the structuring into typed fields, guided by a prompt that is fused with the case lens. So:

- There is no extraction **function** to import. Outcome (A)'s premise (a distinct extraction stage taking only a snapshot) is counterfactual.
- There is no internal extraction **code** to move. Outcome (B)'s "extract-function refactor" has nothing to operate on.
- The only E3 asset resembling "structured macro" is its **output shape** (the case-neutral substrate inside `E3Output`), which is a prompt plus a TypeScript type, fused with case-conditioned fields. That shape is copyable as a target; the code is not shareable because it is not extraction.

The practical outcome (no E3 change, lowest cost) happens to match (A)'s reassuring conclusion, which is why this is good news; but the mechanism is (C)'s, because the thing (A) assumes exists does not. This also matches the capability-sibling precedent (Section 4): every capability agent reads the typed snapshot directly and shares only the sentinel union and read-through conventions, never an extraction module.

---

## 1. E3 stage map (lib/agents/e3-macro.ts, 197 lines)

E3 is a single-layer LLM agent. There is no Layer 1 deterministic computation (unlike risk-reward and time-series, Section 4). Its stages:

**Stage A, input contract (case-coupled at the interface).** `E3Input` (`lib/agents/e3-macro.ts:68-74`) is `{ asOfDate; investorName; investorMandate; investorScope; macroData: unknown }`. The macro block (`macroData`, `:73`) sits beside four case-scoped fields. The function cannot be called as typed without supplying the case fields.

**Stage B, prompt construction (extraction and case lens are fused here, and only here).** `buildPrompt` (`:76-154`) interleaves three things into one prompt:
- Case framing first: `:79-84` emit `case_mode: diagnostic`, `investor: ${input.investorName}`, `mandate: ${input.investorMandate}`, `portfolio_scope: ${input.investorScope}`.
- The macro block, pass-through: the only operation on `macroData` in the whole file is `:94`, `JSON.stringify(input.macroData, null, 2)`. There is no parse of `data_snapshot`, no read of `dimensions`, no field extraction. The raw block is dropped into a fenced JSON region.
- A case-conditioned output schema: `:99-141` ask the model to produce the structured fields. The structuring of raw macro into `rate_environment.current_repo_pct` and the like is delegated to the LLM here, in the same prompt that carries the case lens. The case conditioning is explicit at `:139`: `reasoning_summary` must be a "narrative tying the indicators to the investor's mandate and holdings".

**Stage C, output validation (validates the LLM output, does not extract the input).** `validate` (`:156-188`) shape-checks the returned object (required keys at `:161-176`, enum and range checks at `:178-186`). It never touches `macroData`. It is an output guard, not an extraction stage.

**Stage D, dispatch.** `runE3` (`:190-196`) wraps `callAgent` with `skillId: "e3_macro_policy_news"`.

**Where case context enters:** Stage A (the input type) and Stage B (`:79-84` framing and `:139` case-tied narrative). **Where extraction happens:** nowhere deterministically; the snapshot is the extraction, and the LLM does the field structuring inside Stage B's prompt. **Is the LLM prompt separate from a deterministic extraction?** There is no deterministic extraction to separate it from; prompt construction is the only transformation E3 performs on macro.

## 2. The output shape: a case-neutral substrate exists, but it is a shape, not code

`E3Output` (`:28-66`) splits cleanly into two groups:

- **Case-neutral macro substrate** (a snapshot-scoped consumer could lift this shape): `rate_environment` (`:29-35`), `growth_inflation` (`:36-41`), `currency_external` (`:42-47`), `policy_regulatory` (`:48-53`), `material_news` (`:54`). These describe the market, not the case. They map directly onto the house view Market Outlook sections.
- **Case-conditioned fields** (a snapshot-scoped consumer must drop these): `risk_overlay.concentration_risks_macro` (`:56`, portfolio-relative), `overall_e3_assessment` (`:60`, a verdict), `key_drivers` / `key_risks` whose `evidence` is tied to the case (`:55,58`), `confidence` (`:63`), `escalate_to_master` (`:64`, "structural complexity e.g. flash event mid-case"), and the mandate-tied `reasoning_summary` (`:139`).

So the house view can lift the **field shape** of the case-neutral substrate as a parse and generation target. That is a copy of a prompt-and-type shape, which is exactly outcome (C)'s "copy E3's parsing shape, not its code". There is no code to import because the substrate is produced by the LLM, not by a function.

## 3. Separability at the interface: E3 cannot run without case context as typed; the case-mode twin is more fused, not less

The practical test the question names ("if E3 cannot run without a case, its extraction is coupled at the interface even if the internal logic looks clean") resolves against clean separability at the interface:

- **Diagnostic call site:** `lib/agents/pipeline.ts:228` invokes `runE3({ asOfDate, investorName: investor.name, investorMandate: mandate, investorScope: scopeNarrative, macroData: snapshot.macro })`. The case fields are required and are built immediately above from the investor and holdings (`mandate` at `pipeline.ts:214`, `scopeNarrative = describeScope(holdings)` at `:215`). Note the macro argument is `snapshot.macro`, the whole block, not a pre-extracted slice; the pipeline does no extraction either.
- **Proposal (S1) call site:** `lib/agents/pipeline-case.ts:179-181` invokes `runE3Case(ctx, { macroDataJson: JSON.stringify(snapshot.macro ?? {}, null, 2) })`. Again the whole block, stringified, no parse.
- **The case-mode twin is harder-coupled, not softer.** `lib/agents/case/e3-case.ts` builds a scope block that is explicitly proposed-action-lensed: `:32-39` instruct "Evaluate the macro environment as it bears on the proposed action. Particular attention to: rate cycle (FD reinvestment compression matters when source_of_funds = fixed_deposits), equity valuation cycle phase, regulatory backdrop for the target's product category". This is the opposite of a reusable macro substrate; it is macro read through one case's lens.

The takeaway: the macro input (`snapshot.macro`) is trivially separable (it is just a snapshot field, and the pipeline already passes it in unmodified), but E3 the runnable unit is coupled to case context at its interface and in its prompt. House view does not need E3 the unit; it needs `snapshot.macro`, which it can read for itself.

## 4. Sibling precedent: capability agents read the snapshot directly; no shared extraction module exists

The house-style answer to "shared extraction lib or each agent reads raw?" is decisively the latter:

- **risk-reward-stats.ts** imports the typed snapshot directly (`lib/agents/risk-reward-stats.ts:32`, `import type { Snapshot, MutualFundRow, TierBStats } from "./snapshot-loader"`) and reads pre-computed `tier_b_stats` read-through (header `:5-18`). Its only cross-agent share is the WA07 sanitiser (`:35`, "reuse the WA7 sanitiser; do not redefine") and the sentinel union.
- **time-series-performance.ts** imports the typed snapshot directly (`lib/agents/time-series-performance.ts:22`) and computes from `monthly_nav` / `monthly_prices` itself. It reuses exactly one small pure helper from risk-reward (`:24`, `buildPmsAifFrameworkNotice`), shares the sentinel union (`:25,37`), and resolves benchmarks by read-through convention, not a shared module.
- **No shared macro-extraction utility exists.** A search for `extractMacro` / `parseMacro` / `macroSubstrate` across `lib/` returns nothing. `snapshot.macro` is consumed in exactly two places today, both E3 (`pipeline.ts:228`, `pipeline-case.ts:181`); house view would be the second logical consumer, reading the same raw block.

The precedent is: read the typed snapshot, structure what you need yourself, share only sentinels and small pure helpers by import and conventions by read-through. House view reading `snapshot.macro` directly is squarely in pattern. It also means the only thing worth genuinely sharing later (if anything) is the sentinel union (`lib/agents/case/sentinels.ts`), which house view should align to per ADR-0019 regardless.

## 5. Blast radius if E3 were modified anyway (why (B) is unjustified, not just unnecessary)

E3's surface area is small but non-zero, so touching it is not free:

- **Exports consumed elsewhere:** `runE3` has one caller (`pipeline.ts:228`); the case twin `runE3Case` has one caller (`pipeline-case.ts:179`); the `E3Output` **type** has one consumer, the stitcher (`lib/agents/stitcher.ts:20` import, `:30` `e3: E3Output | null`). So any change to E3's output shape ripples into the stitcher's `StitchedContext` and into the briefing assembly that reads it.
- **Replay fixtures:** E3 runs through the stub-replay harness keyed by `skillId: "e3_macro_policy_news"`; changing E3's prompt or output shape risks invalidating the recorded `fixtures/stub-responses/` entries for E3 across the case fixtures, which is replay-affecting work outside house view's scope.
- **Schema artifact gap (pre-existing):** the skill `agents/e3_macro_policy_news.md` declares `output_schema_ref: schemas/e3_macro_output.schema.json`, but that file does not exist on disk (only `schemas/time_series_performance_output.schema.json` is present); E3's validation lives in-code at `e3-macro.ts:156-188`. Any refactor that formalised E3's output would inherit the unfinished schema. See debt D-1 below.

Since house view gains no shareable code by touching E3 (Sections 1 to 2) and touching E3 carries a stitcher-plus-fixtures cost, (B) is not merely unnecessary; it is net-negative for this workstream. Leave E3 untouched (WA09: capability ships data, not architecture rework on a neighboring agent).

## 6. A4 (outcome D): a distraction at Lean MVP scope. Argue against.

The proposal is to invert the dependency: a snapshot-scoped A4 owns a case-neutral macro substrate; E3 consumes it for its case verdict. The evidence does not support this, on three grounds:

1. **It is exactly the architecture rework WA09 forbids a capability workstream.** Standing up A4 means: build a new agent; change E3's input contract from `macroData: snapshot.macro` to `macroData: a4Output`; edit both call sites (`pipeline.ts:228`, `pipeline-case.ts:181`); re-validate E3 against its replay fixtures; and decide where A4's frozen output is stored per snapshot. That is neighboring-agent rework, not data shipped.
2. **It buys nothing, because the substrate already exists in the snapshot.** `macro.data_snapshot.dimensions` is already the case-neutral structured macro. A4 would re-derive (via a costed, lossy LLM pass) a structured macro from data that is already structured, then freeze it. E3 must still re-interpret through the case lens per case (the lens changes what is salient, per `e3-case.ts:32-39`), so A4 saves E3 no model call. The inversion adds a layer and removes nothing.
3. **There is one snapshot-scoped macro consumer today, and its "substrate" is its own deliverable.** The per-snapshot structured macro view that A4 would produce is, in practice, the house view's own curated firm commentary. That is house view's output, not a shared dependency E3 should read. Making E3 depend on house view's output would couple a case agent to a capability output, the wrong direction.

The only honest kernel: if a second snapshot-scoped macro consumer ever appears (for example a standalone Market Outlook generator distinct from house view), a shared snapshot-onboarding macro-structuring step might pay off. That is a future-watch, not present work. Recommend against A4 now; revisit only on a second consumer. Logged as O-1 (watch), not a task.

---

## Recommendation for the house view workstream

Read raw, copy the shape, leave E3 alone.

1. House view reads `snapshot.macro` (`macro.data_snapshot.dimensions`) directly via the typed loader, exactly as the pipeline already hands it to E3, and exactly as risk-reward and time-series read the snapshot for their own needs (Section 4).
2. House view copies the **case-neutral field shape** from `E3Output` (`rate_environment`, `growth_inflation`, `currency_external`, `policy_regulatory`, `material_news`; Section 2) as the structural target for its Market Outlook sections, and drops every case-conditioned field. This is a shape reference in the house view skill and schema, not an import of `e3-macro.ts`.
3. House view aligns to the shared sentinel union (`lib/agents/case/sentinels.ts`, ADR-0019) rather than coining its own, the one genuinely shareable asset.
4. Do not import from `e3-macro.ts`, do not modify E3, do not stand up A4.

This keeps house view snapshot-scoped and E3 case-scoped, with zero coupling between two differently-scoped agents, which is the property that makes house view the cleanest parallel workstream in the first place.

## Debt entries surfaced

- **D-1 (tech, hygiene, pre-existing, not house view's to fix):** `agents/e3_macro_policy_news.md` frontmatter declares `output_schema_ref: schemas/e3_macro_output.schema.json`, but that file is absent; E3's output contract lives only in code (`lib/agents/e3-macro.ts:156-188`). The declared schema reference has no artifact. Surface for confirmation against the existing tech-debt log before adding, per the numbering and verify-before-adding conventions; if unlogged, add to `docs/debt/tech_debt_log.md`. This audit does not fix it.
- **O-1 (operational, watch, not a task):** revisit a shared snapshot-onboarding macro-structuring step (the A4 idea) only if a second snapshot-scoped macro consumer beyond house view appears. With one consumer and the substrate already present in the snapshot, factoring it out now is premature.
- **Explicit non-finding:** this audit does **not** surface an "extract E3's macro parsing into a shared lib for hygiene" debt. There is no deterministic macro extraction in E3 to factor out (Section 1); the snapshot already carries the structured macro. Recording the non-finding so a future reader does not re-open the question expecting hidden parsing code.

---

This audits and recommends; it builds nothing, runs nothing, changes no code, and spends nothing. The decision is the workstream's, ratified at the ideation and planning-chat syncs.
