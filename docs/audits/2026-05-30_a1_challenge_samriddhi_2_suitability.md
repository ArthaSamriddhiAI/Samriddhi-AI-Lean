# A1 challenge agent: suitability audit for the Samriddhi 2 diagnostic

**Date:** 2026-05-30
**Task:** provisional T-5.13 (A1 challenge agent suitability for the Samriddhi 2 diagnostic). The final task ID resolves at landing (WA24); T-5.13 is provisional.
**Branch:** `feature/a1-challenge-for-samriddhi-2` (cut from `main` at `f64dea8`).
**Type:** read-only audit ping (WA22). No feature code, no adapter, no orchestrator edits. The only artifacts written are this document and the branch.
**Generation:** none. Item 4 (the A3-versus-A1 suitability comparison) was answered entirely from output already on `main`. No A1, A3, or other LLM agent was fired. The WA12 / WA19 cost-estimate gate was therefore never reached; no generation was needed to answer any load-bearing question.
**Status of the verdict:** the suitability verdict is left open as the primary's call (WA28). This document assembles the evidence and proposes; it does not resolve.

## Framing that governs this audit

The roadmap carries the provisional task as "wire the A1 challenge agent into the Samriddhi 2 diagnostic pipeline." This audit does not treat that as settled. The Samriddhi 2 diagnostic already produces customer-ready portfolio diagnostics, and the A3 So-What agent (landed in T-5.12) already adds an advisory "what to do about it" layer after A2. The live question is therefore not "where do we insert A1," it is: given what A3 already contributes, does adding A1 to the Samriddhi 2 diagnostic deliver enough distinct value to justify the work and the added pipeline complexity, or not.

A genuine and acceptable outcome is "A1 is not needed in the Samriddhi 2 diagnostic," in which case the workstream lands an absence-of-A1 ADR. The opposite outcome lands an adopt-A1 ADR. This audit does not choose; it surfaces the evidence and proposes (see Section 7).

Where this audit and the planning view disagree, the code on `main` wins (WA2 / WA21). Every path named below was read on `main` before it was quoted. Naming follows WA13: "Samriddhi 1" for the proposal-evaluation workflow, "Samriddhi 2" for the portfolio-diagnostic workflow; "S1" and "S2" appear only as synthesis-agent and pipeline-mode names. Quoted fixture prose has had pre-WA07 long dashes normalized to commas (the fixtures carry the known D7 data-debt: frozen pre-WA07 generated prose); this document itself contains no long dashes (WA7).

## Section 0: headline findings

1. **A1 today is a proposal challenger, not a diagnostic auditor.** The implemented A1 (`lib/agents/case/a1-case.ts`) emits a flat `{ challenges: AdvisoryChallengeItem[] }`, each challenge a `counter_argument | stress_test | edge_case` aimed at a proposed action. Its input is type-bound to the Samriddhi 1 case synthesis output and its prompt is built to challenge "the S1 synthesis verdict you are challenging." It has no notion of a diagnostic.

2. **The gating is structural, confirmed.** A1's input type is `S1CaseOutput`; the Samriddhi 2 orchestrator (`lib/agents/pipeline.ts`) never imports or calls A1. Both halves of the planning hypothesis hold.

3. **The "adapter" is a re-aiming, not a type adapter.** The Samriddhi 2 diagnostic synthesis output is `BriefingContent` (name confirmed), a portfolio-state shape with no proposal, no counterfactual, and no governance gates, which are exactly the things A1's prompt expects. Mapping the type is the easy part; A1's adversarial frame does not transfer, which materially raises the cost side of the ledger.

4. **A3 already owns concentration and allocation; A1's distinct value lies elsewhere.** Across all five Samriddhi 2 diagnostic cases that carry A3 output, A3 leads on single-name concentration and sleeve-gap rebalancing. Of the four concern types A1 is meant to raise, single-name concentration is redundant with A3 and the briefing; implausibly clean alpha or beta, unspecified benchmark methodology, and absent market events are not currently challenged by anything in the pipeline and are where A1 could be additive.

5. **The schema divergence is real, three-way, and already tracked as T17.** The skill file, the code, and the planning view's description of the skill file all disagree. This is logged tech-debt (T17, with a v14 sharpening that already pre-scopes this task's schema choice); it is referenced here, not reopened, and not reconciled here (it is a Samriddhi 1 workstream).

6. **The highest-value A1 variant points at A3's recommendations, which breaks the "strictly additive, fed by nothing" hypothesis.** A1's existing adversarial muscle (deployment-timing stress, funding-continuity stress) maps directly onto A3's recommendations, but consuming A3's output makes A1 fed-by-A3 and edges toward the parked feedback-loop question. ADR-0031 anticipates "a future agent reading A3's output" and flags it for cycle-risk evaluation.

7. **There is no render home for A1 in Samriddhi 2.** A3 itself ships data-only (WA09); the Samriddhi 2 renderer reads only the briefing. Adding A1 would add a second unrendered Opus call per diagnostic.

## Section 1: A1 as it exists today (item 1)

### The implemented output (code)

`lib/agents/case/a1-case.ts:31-33`:

```ts
export type A1Output = {
  challenges: AdvisoryChallengeItem[];
};
```

`AdvisoryChallengeItem` is defined in `lib/agents/case/briefing-case-content.ts:88-96`:

```ts
export type AdvisoryChallengeItem = {
  category: "counter_argument" | "stress_test" | "edge_case";
  title: string;
  body: string;
  /** One sentence naming the watch-item this challenge raises. Renders
   * as the challenge's Source Serif lead in the Advisory challenges
   * accordion body. */
  headline_takeaway: string;
};
```

So the implemented A1 is a flat list of free-text challenges in three categories. This matches the planning view's belief about the implemented shape.

### The skill file (claimed output)

`agents/a1_challenge.md:113-127` documents a different and richer schema:

```
| Field | Type | Description |
|---|---|---|
| implementation_concerns | array | structured concerns |
| track_record_concerns | array | similar |
| conflict_of_interest_concerns | array | similar |
| scenario_risk_concerns | array | similar |
| governance_audit_concerns | array | similar |
| primary_concern | string \| null | most significant if any |
| recommended_modifications | array | concrete modifications if proposal stands |
| approval_recommendation | enum | proceed / proceed_with_conditions / defer / escalate_to_compliance |
| confidence | number | 0.0 to 1.0 |
| reasoning_summary | string | 200-400 word narrative |
```

The skill file also declares `output_schema_ref: schemas/a1_challenge_output.schema.json` (`agents/a1_challenge.md:11`). That file does not exist; `schemas/` contains only `time_series_performance_output.schema.json`. The skill points at a schema artifact that was never created.

### The divergence, flagged not reconciled

The code and the skill file describe two different agents. The code's A1 produces three free-text challenge categories framed around a proposed action. The skill file's A1 produces five categorized concern arrays plus a structured `approval_recommendation` enum, a `confidence` float, and `recommended_modifications`, the shape of a structured proposal-approval verdict.

A third party to the disagreement is the planning view itself. The planning kickoff described the skill schema as "counter_arguments, alternative_proposals, stress_test_scenarios, edge_cases, accountability_flags, reasoning_summary." That list matches neither the code nor the skill file. It reads as the code's category enum (`counter_argument`, `stress_test`, `edge_case`) pluralized into field names, plus invented fields (`alternative_proposals`, `accountability_flags`). The planning view is inaccurate about both the magnitude and the specifics of the skill schema, which is exactly the kind of staleness this audit exists to correct (WA2).

This reconciliation is **not** in scope here. It is already logged as **tech-debt T17** (`docs/debt/tech_debt_log.md:23`):

> T17: Skill-vs-implementation schema divergence. Across IC1 (Chair, Minutes Recorder), S1 (diagnostic mode), and A1, the skill `.md` files describe richer authored output schemas than the TypeScript renderers actually emit today (A1's approval-recommendation enum, ...). Either the renderers should be expanded to ship the authored shape or the skills should be trimmed to match what runs.

T17 carries a **v14 sharpening dated 2026-05-27** (`docs/debt/tech_debt_log.md:52`) that already addresses this very task:

> The planner v14 scopes "Samriddhi 2 A1 challenge" (provisional task ID T-5.13, not yet landed) under "Decision 2A": adopt the existing flat `A1Output = { challenges: AdvisoryChallengeItem[] }` shape on the diagnostic firing path; do NOT expand to the richer `approval_recommendation` enum ... and categorized concern arrays that the skill file describes. Rationale: the richer schema was authored against Samriddhi 1 proposed-action semantics; it has no clean fit on a diagnostic case that has no action to approve. T17 reconciliation for the richer schema therefore stays a Samriddhi 1 workstream and does not gate the diagnostic firing path.

Two observations on that sharpening, both load-bearing for Section 7. First, it pre-decides the schema question conditionally: **if** A1 fires on the diagnostic, use the flat shape. It does not decide **whether** A1 should fire; that is this audit's question. Second, its own rationale ("the richer schema has no clean fit on a diagnostic case that has no action to approve") is also an argument about the flat schema: the flat schema's category enum (`counter_argument`, `stress_test`, `edge_case`) is itself proposal-flavored. A counter-argument argues against a proposed action; in a diagnostic there is no proposed action to argue against. The schema mismatch the sharpening identifies for the rich schema applies, in softer form, to the flat one too.

## Section 2: the gating mechanism (item 2)

The planning view holds that A1's diagnostic firing is blocked structurally, not by a conditional. Confirmed on both counts.

**Type binding.** A1's input is type-bound to the Samriddhi 1 case synthesis output (`lib/agents/case/a1-case.ts:35-40`):

```ts
export type A1CaseInput = {
  ctx: CaseAgentContext;
  s1_synthesis: S1CaseOutput;
  evidence_verdicts: CaseEvidenceVerdict[];
  gate_results: GateResult[];
};
```

`s1_synthesis` is `S1CaseOutput`, the proposal-shaped synthesis (Section 3). A diagnostic briefing cannot be passed here without adaptation.

**Orchestrator.** The Samriddhi 2 orchestrator is `lib/agents/pipeline.ts` (`runDiagnosticPipeline`). It imports and calls S1 diagnostic synthesis, A2, and A3, and never A1. A grep for A1 across that file returns a single hit, the substring "a1" inside a "Dimension 4" comment, not a call. A1 is invoked only in the Samriddhi 1 orchestrator `lib/agents/pipeline-case.ts:272-280` and in `scripts/generate-sharma-fixture.ts`. The code comment at `lib/agents/case/a1-case.ts:4-11` confirms the intended scope: "Per Slice 3 orientation Q3: A1 fires once after S1.case_mode synthesis ... The output renders alongside S1's verdict in the Case Detail Outcome tab."

The block is therefore structural: A1 cannot be constructed from a Samriddhi 2 diagnostic briefing because its input type does not accept one, and the Samriddhi 2 orchestrator does not reference it.

A note for completeness: the skill file's own activation section (`agents/a1_challenge.md:30-33`) says A1 should fire "After evidence + S1 + governance for case_mode = diagnostic." The skill author imagined A1 in diagnostic mode; the implementation never wired it there. This is consistent with the T17 divergence (the skill describes an A1 the code did not build) and is not a separate finding.

## Section 3: the adapter surface (item 3)

### The Samriddhi 2 diagnostic synthesis output

The name `BriefingContent` is confirmed (`lib/agents/s1-diagnostic.ts:119-131`):

```ts
export type BriefingContent = {
  header: BriefingHeader;
  workbench_lede: string;
  section_1_headline_observations: HeadlineObservation[];
  section_2_portfolio_overview: PortfolioOverview;
  section_3_concentration_analysis: ConcentrationBreach[];
  section_4_risk_flags: RiskFlag[];
  section_5_comparison_vs_model: ModelComparison;
  section_6_talking_points: TalkingPoint[];
  section_7_evidence_appendix: EvidenceAppendixRow[];
  coverage_note: string;
  section_headlines: SectionHeadlines;
};
```

### What A1 consumes today

A1 consumes `S1CaseOutput` (`lib/agents/case/briefing-case-content.ts:115-121`):

```ts
export type S1CaseOutput = {
  section_1_proposal_summary: ProposalSummarySection;
  section_2_synthesis_verdict: SynthesisVerdictSection;
  section_3_evidence_summary: EvidenceSummaryItem[];
  section_6_talking_points: TalkingPoint[];
  section_7_coverage_methodology_note: CoverageMethodologyNote;
};
```

### The gap is semantic, not just structural

The two shapes are not near-namesakes that a field map reconciles. `S1CaseOutput` is organized around a proposal: `section_1_proposal_summary` (what is being proposed) and `section_2_synthesis_verdict` (the verdict on the proposal). `BriefingContent` is organized around a portfolio state: concentration breaches, risk flags, comparison versus model. A1's prompt (`lib/agents/case/a1-case.ts:42-98`) is built around the proposal verdict; it instructs the model: "The synthesis you are challenging. Read it, then surface the questions a critical reviewer would ask. Do not argue against the action; ask the hard questions the synthesis should be ready to answer." There is no "action" in a diagnostic. Adapting the input type would hand A1 a shape it can parse but a frame it cannot use.

This is why "adapter" understates the work. A type adapter from `BriefingContent` to an A1 input is mechanical; making A1 say anything useful about a diagnostic requires re-aiming the prompt (and, per Section 1, deciding what `counter_argument` even means with no proposal present).

### Candidate seams (surfaced as options, not chosen)

If A1 were adopted, an adapter or re-aimed input could live in one of several places. These are surfaced with their tradeoffs; this audit does not build one and does not pick.

- **Option A: inline in `lib/agents/pipeline.ts`.** Build the A1 input next to the A3 input assembly (`lib/agents/pipeline.ts:342-367` is the precedent: A3's `indianContext`, `operational`, and `selection` are assembled inline before the call). Tradeoff: lowest ceremony, consistent with how A3's auxiliary inputs are built; cost: grows an already large orchestrator and mixes adaptation with orchestration.
- **Option B: a dedicated sibling module `lib/agents/a1-diagnostic.ts`.** Mirror `lib/agents/a3-so-what.ts`: a diagnostic-flavored A1 with its own input type, its own prompt, and a two-layer split if wanted. Tradeoff: cleanest separation and the most honest about the fact that this is a different agent from the Samriddhi 1 A1; cost: most new surface area, and it makes "adopt the existing A1" visibly false (it is a new agent).
- **Option C: a converter in `lib/agents/case/`.** A `briefingToA1Input` helper beside the existing A1 case code. Tradeoff: keeps A1 code colocated; cost: couples Samriddhi 1 case code to the Samriddhi 2 diagnostic shape, which inverts the current clean separation and risks the proposal-versus-diagnostic ambiguity WA13 exists to prevent.

The choice among these is downstream of the adopt-or-not verdict and is not this audit's to make.

## Section 4: A3 So-What, and the suitability comparison (item 4)

### How A3 is wired

A3 runs in `lib/agents/pipeline.ts` after S1 synthesis and A2, consuming A2's output and the deterministic context already in scope (`lib/agents/pipeline.ts:369-381`):

```ts
const a3Result = await runA3Diagnostic({
  caseId: opts.caseId,
  asOfDate,
  a2Output: a2Result.output,
  metrics,
  preObservations: stitched.pre_observations,
  riskReward,
  overlap: portfolioOverlap,
  evidence,
  indianContext: a3IndianContext,
  operational: a3Operational,
  selection: a3Selection,
});
```

It outputs `A3Output` (`lib/agents/a3-so-what.ts:212-238`): `decisions`, `holding_actions`, `observation_actions`, `rebalance_proposal`, `summary`, `reasoning_summary`, `indian_context`, `operational`, `deployment_plan`, `deployment_narration`, `advisor_framing_note`. The pipeline comment (`lib/agents/pipeline.ts:328-335`) states the boundary: A3 is "The single product surface that recommends an action rather than characterising a state. Ships as data only (content.a3_so_what); the S2 renderer reads only briefing and never touches this key (WA09)."

### A3 is not rendered; there is no advisory-challenge slot in Samriddhi 2

A grep of `components/` and `app/` for `a3_so_what`, `A3Output`, and `advisory` finds A3 nowhere in the render path. The only advisory-challenge render is `components/case-detail/OutcomeTab.tsx:224`, `briefing.section_5_advisory_challenges.map(...)`, which is the **Samriddhi 1** Outcome tab (that field exists on `BriefingCaseContent`, the Samriddhi 1 case type, not on `BriefingContent`, the Samriddhi 2 diagnostic type). The Samriddhi 2 diagnostic briefing has `section_5_comparison_vs_model`, not advisory challenges. So Samriddhi 2 has no advisory-challenge render slot today, and A3 itself is unrendered data.

### The A3 sweep (all five cases that carry A3 output, no sampling)

Reading already-generated output is free, so the full set was swept rather than sampled (item 4 instruction). Five Samriddhi 2 diagnostic cases carry `content.a3_so_what` (`db/fixtures/cases/`): `c-2026-05-14-bhatt-01`, `c-2026-05-15-iyengar-01`, `c-2026-05-15-malhotra-01`, `c-2026-05-15-menon-01`, `c-2026-05-15-surana-01`. The six 05-21 cases are Samriddhi 1 proposal cases (`workflow: s2` is false for them; they carry `a1_challenge`, not `a3_so_what`). The `_archived` match is a README, not a case.

What A3 actually says, by case (the `summary.one_line_characterization`, verbatim):

- **bhatt:** "One coordinated rebalance: four trims to the 10% ceiling and a full PMS exit free 17.9 points, of which 10.8 close the debt-sleeve gap to target and 7.1 stay in cash as honest leftover."
- **iyengar:** "Two oversized FDs lead a five-position concentration trim that frees 40.4 points, fills the Alternatives sleeve to its 5% target via low-cost gold ETFs, and leaves 35.4 points in cash for staged deployment."
- **malhotra:** "Six concentration trims free 23.3 points; 12.9 points close the equity gap to the 65% target across international, mid and small cap, with 10.4 points held back as honest cash."
- **menon:** "A pure deployment case: 81.6 points of idle cash is staged across equity, debt, and alternatives to build the portfolio to its model targets, with no trims required."
- **surana:** "Stage Reliance Industries down from 20.3% toward 10% with concurrent trims on two large-cap funds, and deploy the freed 12.9 points plus 0.8 points of cash into the missing Debt sleeve and the under-target Alternatives sleeve as one coordinated rebalance."

Three of the five (bhatt, iyengar, malhotra) also carry an `advisor_framing_note` for a stated-versus-observed risk-appetite divergence; menon and surana carry none (`null`). The A3 voice is consistent: it identifies sleeve gaps and concentration breaches, then proposes one coordinated rebalance with tax-aware and lock-in-aware staging. It is a recommendation layer.

### The A1 sweep (all six cases that carry A1 output, no sampling)

A1 output exists on the Samriddhi 1 cases: `c-2026-05-14-sharma-01` (7 challenges) and the five 05-21 cases (bhatt 6, iyengar 7, malhotra 7, menon 7, surana 7). All read from `content.briefing.section_5_advisory_challenges`. A1's voice is uniform across all six: every challenge interrogates a **proposed action**. Representative challenges (titles or headline takeaways, verbatim except long dashes normalized to commas):

- **sharma** (PMS addition): "Is the Rs 2.0-2.2 Cr counterfactual a genuine alternative or a face-saving compromise?"; "How does the verdict hold if FMCG cycle softness persists into FY27?"; "Is the fee premium robust to capacity-driven alpha decay?"
- **iyengar** (debt redirect): "The 7.32% 3Y return was earned during a 125 bps cutting cycle that has now paused, and the forward path is not the backward path"; "Two corporate bond funds drawing from a similar AAA universe is one concentration, not two diversified positions."
- **malhotra** (PMS entry): "The band gap could be closed for ~100 bps in a flexi-cap or mid-cap addition rather than 340-490 bps in a quality PMS that duplicates the existing factor"; "The strategy may already be past its capacity sweet spot, and the household has no market-cap disclosure to assess whether forward alpha is intact."
- **menon** (private-credit commitment): "The equity-first counterfactual asks Arjun to deploy Rs 25-35 Cr into equities during the heaviest FII outflow month on record without an explicit market-timing thesis"; "A front-loaded Vivriti drawdown coinciding with property closing and parallel equity deployment compresses cash exactly when reserves are most committed."
- **surana** (debt-sleeve sizing): "The Rs 5 Cr figure is presented as a sizing decision but functions as a partial fix"; "The deployment treats founder distributions as a renewable funding source, but a distribution pause would collapse the sequenced-correction path back onto the Reliance position the proposal deliberately preserves."
- **bhatt** (fourth PMS): "Four mandate bands are already out of compliance before the Ambit ticket is considered"; "The MF counterfactual changes the cost of a thematic call without changing whether the thematic call itself is well-timed."

### Case-by-case: what would A1 catch that A3 did not

The question item 4 asks is whether A1 would add anything to each diagnostic that A3 (and the briefing it sits on) did not. Measured against the four concern types A1 is meant to raise:

- **Single-name concentration framing: redundant.** A3 already leads on it. Surana's A3 opens on "a 20.3% single-name concentration in Reliance Industries"; iyengar's A3 acts on "two FDs above the 15% escalate threshold"; malhotra's A3 handles "six positions above the single-position thresholds." The briefing's `section_3_concentration_analysis` is the deterministic source A3 acts on. A1 raising concentration here would echo, not add.

- **Implausibly clean alpha or beta: additive.** The diagnostic computes per-holding risk-reward statistics (`content.risk_reward_stats.per_holding[].stats`, each with a `benchmark_index_id`) and presents them as fact. Nothing in the pipeline challenges whether a metric is plausible. A1 demonstrably has this instinct: iyengar's A1 challenges a 3Y return "earned during a 125 bps cutting cycle that has now paused"; malhotra's A1 challenges "gross returns the 3Y window may have flattered." That is a track-record-credibility challenge no current agent makes on the diagnostic.

- **Unspecified benchmark methodology: additive (modest).** `risk_reward_stats` carries `benchmark_index_id`, `method`, and a `pms_aif_framework_notice`, but nothing asks whether the chosen benchmark is apt for the holding. A1 could. No current agent does.

- **Absent market events: partially additive.** The E3 macro evidence agent covers some of this, but A1 layers specific adverse scenarios onto the verdict (bhatt's "If Brent retraces and FII flows reverse within the next two quarters"; surana's "Crude persists at $118 through Q2 FY27 and the RBI pauses"). A3's reasoning prices some macro but does not stress-test systematically.

The conclusion of the sweep: A1's additive value in the Samriddhi 2 diagnostic is **not** a second voice on concentration and allocation (A3 and the briefing own that), it is **adversarial credibility review of the diagnostic's own evidence and metrics**: are the computed numbers plausible, is the benchmark apt, what scenario is the clean diagnostic not pricing. Notably, that additive role matches the skill file's A1 (track-record-bias and scenario-risk dimensions), not the implemented A1 (proposal counterfactual frame). The version of A1 that would help is closer to the one on disk in `agents/a1_challenge.md` than the one running in `lib/agents/case/a1-case.ts`.

## Section 5: the orchestration seam (item 5)

The planning hypothesis: A1 fires post-S1, parallel to A2 via `Promise.all`, consuming the S1 diagnostic output plus evidence, feeding nothing and fed by nothing (strictly additive). The actual orchestrator shape qualifies this.

**The advisory layer is sequential, not a parallel fan.** In `lib/agents/pipeline.ts` the evidence agents E1 through E7 run in parallel via `Promise.all`, but the advisory agents run as sequential awaits: S1 synthesis (`:292`), then A2 (`:312`), then A3 (`:369`). A2 and A3 are not in a `Promise.all`; A3 is sequential because it consumes A2's output. So "parallel to A2 via `Promise.all`" is not an existing pattern in the advisory layer; adopting it would introduce one. The lower-ceremony integration is another sequential await, not a fan.

**The A3 precedent establishes agent-reads-agent, not a parallel fan, and not a free lunch.** ADR-0031 records the agent-reads-agent contract (`docs/decisions/0031_a3_so_what_advisor_action_agent.md:44-53`): A3 "treats A2's output as a fixed upstream artifact ... The dependency is one-directional and acyclic." That precedent supports A1 reading the S1 diagnostic briefing the way A3 reads A2. It does **not** establish a parallel pattern (A3 is strictly sequential after A2), and it explicitly flags the risk relevant to the higher-value A1 variant (`docs/decisions/0031_a3_so_what_advisor_action_agent.md:89-92`):

> The agent-reads-agent dependency means an A2 schema change ripples into A3 ... A future agent reading A3's output would extend the chain and should be evaluated for cycle risk.

This is the fork that decides the orchestration shape, and it is a product decision, not a mechanical one:

- **If A1 consumes only the S1 diagnostic briefing plus evidence** (the planning hypothesis), it can run parallel to A2 and is strictly additive, fed by nothing. This is the credibility-auditor role from Section 4. It challenges the diagnostic's inputs, not A3's recommendations (A1 would not see them; A3 runs after A2, A1 would run beside A2).
- **If A1 consumes A3's output** (to stress-test the recommendations, where A1's existing muscle is strongest: menon's deployment-timing challenge and surana's funding-continuity challenge map directly onto A3's staged glide and build-around recommendations), then A1 runs after A3, is fed-by-A3, and is the "future agent reading A3's output" ADR-0031 flags for cycle-risk review. It also edges toward the feedback-loop question (Section 8), because an agent whose whole job is to challenge A3, even as commentary that cannot alter A3, raises the question of whether it should be able to.

The two are different architectures with different value and different risk. The planning hypothesis describes only the first. The sweep in Section 4 suggests the second is where A1's distinct value is highest. That tension is the heart of the suitability question.

## Section 6: schema divergence summary (flagged, not reconciled)

Collected here for the record. The divergence is **three-way**: the code (`lib/agents/case/a1-case.ts:31-33`, flat `challenges[]`), the skill file (`agents/a1_challenge.md:113-127`, five concern arrays plus an approval verdict), and the planning view's description of the skill file (matching neither). The skill file additionally references a schema artifact that does not exist (`schemas/a1_challenge_output.schema.json`). All of this is tracked as **T17** with a v14 sharpening that conditionally pre-scopes this task's schema choice (flat, if A1 fires). Per the kickoff, this is not reconciled here and no new debt entry is opened; the reconciliation remains a Samriddhi 1 workstream.

## Section 7: product-thinking proposal

The kickoff invites reasoning here. The verdict remains the primary's (WA28); what follows is the suitability question curated as options with tradeoffs, then a recommendation marked as a recommendation.

### The reframe

"Wire A1 into the Samriddhi 2 diagnostic" is not one proposal; it is at least two, distinguished by what A1 challenges. A1 is an adversarial agent and needs a target. In Samriddhi 1 the target is the proposal. Samriddhi 2 has no proposal, so the target must be chosen, and the choice determines both value and complexity.

- **Variant 1, A1 as diagnostic-credibility auditor.** Consumes the briefing, evidence, and computed metrics; runs parallel to A2; strictly additive; fed by nothing. Challenges the diagnostic's own inputs: implausibly clean metrics, benchmark aptness, unpriced scenarios.
- **Variant 2, A1 as recommendation stress-tester.** Consumes A3's output; runs after A3; fed-by-A3. Challenges the recommendations: the glide timing, the funding assumptions, the build-around logic.
- **Variant 3, A1 alters the diagnostic or A3.** Explicitly out of scope (the intent is strictly additive commentary). Not on the table; see Section 8.

### The case for A1 earning its place

The sweep found a real gap: nothing in the Samriddhi 2 pipeline subjects the diagnostic's own evidence to adversarial review. The five A3 outputs are confident and internally coherent, and not one of them questions whether its inputs are trustworthy. If the firm's differentiation is institutional-grade scrutiny ("we challenge our own diagnostic, we do not just produce it"), Variant 1 fills a gap A3 structurally cannot fill (A3 is the recommendation layer; it consumes the metrics, it does not doubt them). A1's existing outputs prove it has exactly this instinct (the 3Y-window-flattered and cutting-cycle-regime challenges). Variant 1 stays strictly additive and matches the clean parallel-to-A2 wiring. Variant 2 is higher-value still (A1's strongest existing challenges are recommendation stress-tests) for firms that want the system to argue with its own advice.

### The case against

A3 plus the deterministic briefing already deliver a customer-ready, actionable diagnostic, and the roadmap's own product-framing note records that Samriddhi 2 is the primary value driver and already converts. The additive A1 value is real but narrow (metric credibility, benchmark aptness, scenario stress), and the agent that exists is mis-shaped for it: the implemented A1 is a proposal challenger, so "adopt the existing A1" is misleading. Realizing the value requires re-aiming A1 (new prompt, and a decision about what its proposal-flavored category enum means with no proposal), inheriting the T17 frame mismatch, and adding an Opus call per diagnostic whose output has no render home (A3 itself is not yet rendered). On sequencing alone, adding a second unrendered advisory layer before the first one (A3) is surfaced to users is hard to justify. Variant 2 additionally introduces agent-reads-agent coupling that ADR-0031 flags for cycle-risk, and pushes on the feedback-loop boundary the intent wants to hold.

### What distinguishes the two

The deciding question is one of product identity, not engineering: does the firm want Samriddhi 2 to say something adversarial about the credibility of its own diagnostic, or to remain a clean prepared diagnostic plus recommendation. A cheap disambiguator is available and costs no generation: put the five existing A3 outputs in front of an advisor and ask, "do you wish the system had flagged that these metrics might be flattered, or that this benchmark might be the wrong one." If yes, Variant 1 earns its place. If the advisor wants clean actionable output and would read a credibility caveat as noise, A1 does not earn it.

### My recommendation (a recommendation, not a decision)

I would argue to **defer adoption now and land an absence-of-A1 ADR**, for three evidence-grounded reasons. First, the one genuinely additive role (Variant 1, credibility auditor) requires re-aiming A1, so the apparent cheap win ("the agent already exists") does not exist; the honest options are "build a new diagnostic A1" or "do not." Second, A3 is not yet rendered, so adding a second unrendered advisory Opus call per case is premature on sequencing; the natural order is to surface A3 first, learn whether advisors want more, and then decide. Third, the highest-value variant (Variant 2) leans on the parked feedback-loop question, which is out of scope by intent.

If the primary's product thesis is that adversarial self-scrutiny is a differentiator, I would not defer; I would scope **Variant 1 only** (re-aimed credibility auditor, strictly additive, parallel to A2, not reading A3), land it as its own agent (Option B from Section 3 is the honest placement), and keep Variant 2 behind the feedback-loop decision.

Either way, the verdict is the primary's. This audit proposes and stops here (WA28); it does not encode a default.

## Section 8: parked, referenced, and flagged

- **The feedback-loop question (parked, not scoped).** Variant 2 (A1 reading and challenging A3) raises whether A1 should ever be able to feed back into A3 or alter a downstream verdict. The current intent is strictly additive commentary, and any capacity for A1 to change A3's output is added complexity that must be earned, not assumed. The sweep surfaced a real pull toward Variant 2 (A1's strongest challenges are recommendation stress-tests), so this is logged as a parked future product question, to be recorded as a product-debt entry **next-free in the P-series** at landing (WA5 / WA8 / WA24; highest current is P47). It is not scoped here.
- **The schema divergence (referenced, not reopened).** Tracked as **T17** with its v14 sharpening. No new debt entry opened (kickoff instruction).
- **The pre-WA07 dashes in fixture prose (referenced).** The A1 and A3 generated outputs carry long dashes (visible in the quoted A1 titles). This is the known **D7** data-debt (frozen pre-WA07 generated prose); referenced, not reopened.
- **Anticipated artifacts, numbered at landing (WA24).** The ADR (absence-of-A1 or adopt-A1) is **next-free in the ADR series** (highest current is 0039). Any debt entries are next-free in their series. The PR number and the final task ID resolve at landing. T-5.13 is provisional.
- **Flagged stops awaiting a decision.** One: the suitability verdict itself (Section 7), which is the primary's call. No generation gate was reached; reading existing output answered every load-bearing question, so there is no cost-estimate request pending.

## Section 9: evidence index

Every path below was read on `main` before being quoted.

- A1 implemented output and input: `lib/agents/case/a1-case.ts:31-40`; prompt frame `:42-98`; scope comment `:4-11`.
- `AdvisoryChallengeItem`, `S1CaseOutput`, `BriefingCaseContent`: `lib/agents/case/briefing-case-content.ts:88-96`, `:115-121`, `:123-129`.
- A1 skill claimed schema and missing schema ref: `agents/a1_challenge.md:113-127`, `:11`; diagnostic-mode activation `:30-33`.
- A1 invocation (Samriddhi 1 only): `lib/agents/pipeline-case.ts:272-280`; `scripts/generate-sharma-fixture.ts`.
- Samriddhi 2 orchestrator and advisory ordering: `lib/agents/pipeline.ts:292`, `:312`, `:369-381`; A3 data-only comment `:328-335`.
- `BriefingContent`: `lib/agents/s1-diagnostic.ts:119-131`.
- A3 output and input types: `lib/agents/a3-so-what.ts:212-238`, `:250-269`.
- A3 sweep (one_line_characterization, reasoning_summary, advisor_framing_note): `db/fixtures/cases/c-2026-05-14-bhatt-01.json`, `c-2026-05-15-iyengar-01.json`, `c-2026-05-15-malhotra-01.json`, `c-2026-05-15-menon-01.json`, `c-2026-05-15-surana-01.json` (key `content.a3_so_what`).
- A1 sweep (challenges): `db/fixtures/cases/c-2026-05-14-sharma-01.json` and `c-2026-05-21-{bhatt,iyengar,malhotra,menon,surana}-01.json` (key `content.briefing.section_5_advisory_challenges`); raw stub `fixtures/stub-responses/c-2026-05-14-sharma-01/a1_challenge.json`.
- Risk-reward metrics shape: `db/fixtures/cases/c-2026-05-14-bhatt-01.json` key `content.risk_reward_stats` (`per_holding[].stats`, `benchmark_index_id`, `method`, `pms_aif_framework_notice`).
- Render path (A1 in Samriddhi 1, none in Samriddhi 2): `components/case-detail/OutcomeTab.tsx:224`; no `a3_so_what` / `A3Output` / `advisory` match in `components/` or `app/` Samriddhi 2 render path.
- Agent-reads-agent precedent and cycle-risk flag: `docs/decisions/0031_a3_so_what_advisor_action_agent.md:44-53`, `:89-92`.
- Schema-divergence debt and v14 sharpening: `docs/debt/tech_debt_log.md:23`, `:52`.
- Working agreements relied on: WA2, WA5, WA6, WA7, WA8, WA12, WA13, WA19, WA21, WA22, WA23, WA24, WA27, WA28 (`docs/working_agreements/`).
