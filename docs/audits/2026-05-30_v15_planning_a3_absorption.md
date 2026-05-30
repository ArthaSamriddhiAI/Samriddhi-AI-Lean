# v15 planning audit: source-verified absorption of A3 So-What (T-5.12, PR #11)

**Date:** 2026-05-30
**Task:** v15 planner refresh, post-PR-#11 verification pass.
**Branch:** `chore/v15-a3-absorption-audit` (chore, documentation-only landing; precedent `chore/v14-debt-sync`).
**Mode:** Read-only verification against `main` at `8544a93` (the PR #11 squash). The only writes this session are this audit, `docs/working_agreements/WA27_repo_relative_paths.md`, `docs/working_agreements/WA28_product_shape_stop_and_propose.md`, and the WA-index update in `docs/working_agreements/README.md`. No code, no fixtures, no agent logic, no planner HTML.

This is the institutional-memory record of the v15 absorption pass: the verified landing facts, the verbatim capability shape, the ADR list, the architecture wiring, the snapshot shape, the synthetic-investor profiles, the audit harvest with verbatim P40 to P47, and the codification actions taken. The planner refresh that grounds on this audit is the helper view; this doc and the WAs are canonical.

---

## Part 0: preflight result

The session opened with HEAD on the residual `features/a3-so-what` @ `342e287` (the workstream branch preserved per the no-delete-after-squash discipline). Per the ping's Part 0 gate, the checkout was synced before any verification read:

- Pre-sync local `main` was at `f8d007c` (the prior tip, the v14 debt-sync chore squash).
- `origin/main` was at `8544a93` (the PR #11 squash, matches the handoff).
- `git checkout main && git merge --ff-only origin/main` fast-forwarded `f8d007c -> 8544a93`. Working tree clean post-sync. `git log -1 8544a93` confirms the PR #11 squash commit: *"T-5.12: A3 So-What advisor-action agent for Samriddhi 2 (instrument-level deployment) (#11)"*.
- No reads were taken before the sync, so no branch-local or stale-main state leaked into the verification.

The branch state to surface plainly: the session DID start on a residual feature branch and a stale local `main`. The fix was a fast-forward, not a force-push; nothing was discarded. Post-sync HEAD `8544a93` is the canonical source of truth for everything below.

---

## Part A: PR #11 landing facts (verified)

All claims in the handoff confirmed against git and the tree, with one minor wording flag:

| Handoff claim | Code/git verdict | Evidence |
|---|---|---|
| PR #11 merged to main | Confirmed | `git log -1 8544a93` shows squash subject with `(#11)` |
| Squash commit `8544a93` | Confirmed | `git rev-parse origin/main` == `git rev-parse main` == `8544a93` post-sync |
| Main moved `f8d007c` -> `8544a93` | Confirmed | pre-sync local `main` was at `f8d007c`; the ff-merge applied exactly one commit |
| Branch `features/a3-so-what` preserved at `342e287` | Confirmed | `git rev-parse refs/heads/features/a3-so-what` == `342e287`; branch present locally and at `remotes/origin/features/a3-so-what` |
| 33 commits, +11,919 / -26 across 41 files | Confirmed | `git log --oneline f8d007c..342e287 \| wc -l` == 33; merge ff output reports the 41-file diffstat |
| Agent at `lib/agents/a3-so-what.ts` | Confirmed | file exists; 1351 lines |
| Wired into the Samriddhi 2 diagnostic pipeline | Confirmed | `lib/agents/pipeline.ts:39` imports `runA3Diagnostic`; `:369` invokes it after `runA2Diagnostic` and after `computeMetrics`. The entry points for `runDiagnosticPipeline` are `app/api/cases/route.ts:133`, `app/api/cases/[id]/retry/route.ts:28`, `scripts/gate-1-shailesh.ts:39`, and `scripts/generate-s2-batch.ts:36`, all Samriddhi 2 (`case_mode: "diagnostic"`) paths |
| NOT in the Samriddhi 1 path | Confirmed | `grep -n "a3-so-what\|runA3\|a3_so_what" lib/agents/pipeline-case.ts` returns no matches; the Samriddhi 1 orchestrator (`lib/agents/pipeline-case.ts`) does not import or invoke A3 |

Minor wording flag: the handoff describes A3 as "in a single pass" and the skill file (`agents/a3_so_what.md:35`) says "two LLM calls" while the original ADR-0031 says "one Claude call". The code is two Layer-2 LLM calls (`runA3Judgment` at `lib/agents/a3-so-what.ts:1143` and `runA3ReasonText` at `:1046`). ADR-0031 records this as the Step-2b refinement that lands later in the workstream; the code is the canonical version. No correction needed to ADR-0031; just noting the apparent contradiction reads correctly once the Step-2b refinement is read in.

---

## Part B: A3 capability shape (the planner-T-5.12-rewrite ground truth)

### B.1 A3's actual inputs, verbatim

From `lib/agents/a3-so-what.ts:250-269`:

```ts
export type A3Input = {
  caseId: string;
  asOfDate: string;
  a2Output: A2Output;
  metrics: PortfolioMetrics | null;
  preObservations: PreObservation[];
  riskReward: RiskRewardOutput | null;
  overlap: PortfolioOverlapOutput | null;
  evidence: EvidenceBundle | null;
  /* M0.IndianContext tax-matrix + SEBI minimums, product-structure-scoped
   * (Finding 2); null when M0 is unavailable. */
  indianContext: A3IndianContext | null;
  /* Per-holding snapshot operational metadata (PMS lock-in / exit-load, AIF
   * tenure / redemption / min-commitment, MF exit-load), category-guarded
   * (Finding 2 / Option 2A). Empty when no holding has a consistent match. */
  operational: A3OperationalMetadata[];
  /* Finding 1 instrument-selection context; null when the universe is not
   * wired (a metrics-only path). */
  selection: A3SelectionContext | null;
};
```

The handoff said A3 consumes A2 verdicts, M0 metrics, and the per-sleeve instrument catalogs. Verified, and the actual input is broader: A3 also threads `riskReward`, `overlap`, the full `evidence` bundle (E1-E7), the M0.IndianContext tax/SEBI bundle, the per-holding operational metadata, and the instrument-selection context (the eligible universe + the resolved sub-sleeve framework + the holdings + the corpus size). The plumbing in `lib/agents/pipeline.ts:362-381` shows all these are wired in from the existing pipeline scope; no orchestrator restructuring was needed.

### B.2 The two-layer architecture (confirmed)

From `lib/agents/a3-so-what.ts:5-22`:

> Layer 1 (`computeA3`): pure, deterministic. Per holding it computes the fixed five-dimension signal set, a type-specific exit-eligibility gate, and a baseline reconciled decision. Both the per-holding action surface and the rebalance proposal read from the SAME reconciled decision. Layer 1 also computes the rebalance glide-path math and the deterministic redeployment.
>
> Layer 2 (LLM): over the fixed signal set, returns a structured judgment (refining the baseline decision: it may upgrade a trim to exit ONLY for an exit-eligible holding) plus the advisor-action prose.

The Layer-1 entry point is `lib/agents/a3-so-what.ts:701` (`computeA3`). Layer 2 is two LLM calls, NOT one:

- `runA3Judgment` (`lib/agents/a3-so-what.ts:1143`), called only when the exit-eligible set is non-empty (`:1255-1263`). Validates against `A3JudgmentPayload`; refuses an exit verdict that lacks a non-empty `exit_rationale` (`:1138`); the judgment can only upgrade a trim to exit, and only on an `exit_eligible` holding (`applyJudgment` at `:1152`).
- `runA3ReasonText` (`lib/agents/a3-so-what.ts:1046`), the narration call. Receives the FINAL Layer-1 result (post-judgment), the regulatory context, the deployment plan, and the framing signal. Returns prose keyed to each holding action, observation action, the rebalance, and the deployment.

The constraint that the LLM cites only computed metrics is enforced by prompt construction (the prompt builder threads the computed numbers in explicitly) and post-merge structural validation. The Layer-1 numbers are unaltered through Layer 2.

### B.3 The authoritative output type, verbatim from main

The single most important artefact for the T-5.09 (Claude Design) kickoff. Source: `lib/agents/a3-so-what.ts:46-238`. The skeleton in `agents/a3_so_what.md:136-166` is the pre-implementation lock and DIVERGES from this; the live type below is canonical.

```ts
export type A3SentinelReason =
  | "no_client_specific_context"
  | "upstream_evidence_unavailable";

export type A3Sentinel = {
  kind: "sentinel";
  sentinel_reason: A3SentinelReason;
  note: string;
};

export type A3Dimension =
  | "redundancy"
  | "cost_efficiency"
  | "performance"
  | "thesis_quality"
  | "suitability";

export type A3DimensionSignal = {
  dimension: A3Dimension;
  status: "assessable" | "sentinelled";
  hard_number: boolean;
  concern: boolean;
  detail: string;
};

export type A3DecisionKind = "maintain" | "trim" | "exit";

export type A3HoldingKind = "transparent" | "opaque" | "allocation";

export type A3ReconciledDecision = {
  holding_ref: string;
  instrument_display_name: string;
  asset_class: string;
  sub_category: string;
  weight_pct: number;
  holding_kind: A3HoldingKind;
  tax_product_family: A3TaxProductFamily | null;
  over_concentrated: boolean;
  a2_verdict: A2Verdict;
  signals: A3DimensionSignal[];
  exit_eligible: boolean;
  decision: A3DecisionKind;
  dimensions_failing: A3Dimension[];
  exit_rationale: string;     // non-empty ONLY when decision is exit
  judgment_reasoning: string;
};

export type A3HoldingVerdict = Exclude<A2Verdict, "maintain">;

export type A3HoldingActionBody = {
  kind: "action";
  decision: A3DecisionKind;
  source_observation: string;
  advisor_action: string;
};

export type A3HoldingAction = {
  holding_ref: string;
  instrument_display_name: string;
  a2_verdict: A3HoldingVerdict;
} & (A3HoldingActionBody | A3Sentinel);

export type A3ObservationCategory =
  | "position_over_concentration"
  | "sector_over_concentration"
  | "wrapper_over_accumulation"
  | "cash_drag"
  | "allocation_drift"
  | "liquidity_gap"
  | "stated_revealed_divergence"
  | "complexity_premium_not_earned";

export type A3ObservationActionBody = { kind: "action"; advisor_action: string };

export type A3ObservationAction = {
  observation_category: A3ObservationCategory;
  severity_hint: string;
} & (A3ObservationActionBody | A3Sentinel);

export type A3GlidePathStep = {
  step: number;
  trim_pct_points: number;
  resulting_weight_pct: number;
  trigger_at_weight_pct: number;
};

export type A3RebalancePosition = {
  instrument: string;
  decision: "trim" | "exit";
  current_weight_pct: number;
  breach_threshold_pct: number;
  target_weight_pct: number;
  total_trim_pct_points: number;
  glide_path: A3GlidePathStep[];
};

export type A3RedeploymentTarget = {
  sleeve: string;
  current_pct: number;
  target_pct: number;
  upper_band_pct: number;   // cushion, NOT the deployment ceiling
  add_pct_points: number;
  resulting_pct: number;
};

export type A3Redeployment = {
  freed_capital_pct: number;
  cash_funding_pct: number;       // cash above its target, deployed as dry powder (Finding 5)
  deployments: A3RedeploymentTarget[];
  leftover_to_cash_pct: number;
  note: string;
};

export type A3RebalanceComputed = {
  positions: A3RebalancePosition[];
  redeployment: A3Redeployment;
};

export type A3RebalanceNarrated = {
  advisor_action: string;
  generation_method: "templated" | "llm";
};

export type A3RebalanceProposal =
  | { kind: "proposal"; computed: A3RebalanceComputed; narrated: A3RebalanceNarrated }
  | { kind: "no_action_needed"; note: string }
  | A3Sentinel;

export type A3Summary = {
  holding_actions_surfaced: number;
  holding_actions_sentinelled: number;
  observation_actions_surfaced: number;
  observation_actions_sentinelled: number;
  trim_count: number;
  exit_count: number;
  rebalance: "proposal" | "no_action_needed" | "sentinel";
  one_line_characterization: string;
};

export type A3Output = {
  agent_id: "a3_so_what";
  case_id: string;
  as_of_date: string;
  decisions: A3ReconciledDecision[];
  holding_actions: A3HoldingAction[];
  observation_actions: A3ObservationAction[];
  rebalance_proposal: A3RebalanceProposal;
  summary: A3Summary;
  reasoning_summary: string;
  indian_context: A3IndianContext | null;          // Finding 2 provenance
  operational: A3OperationalMetadata[];            // Finding 2 provenance
  deployment_plan: SleeveDeploymentPlan[] | null;  // Finding 1
  deployment_narration: string | null;             // Finding 1
  advisor_framing_note: string | null;             // Finding 3
};
```

### B.4 Delta against the pre-implementation lock

The handoff flagged that the schema grew "materially beyond the original lock". Confirmed; the deltas:

- New top-level fields on `A3Output`: `decisions` (the full reconciled-decision matrix, both surfaces read from it; the coherence fix), `indian_context` and `operational` (Finding 2 provenance blocks), `deployment_plan` and `deployment_narration` (Finding 1), `advisor_framing_note` (Finding 3).
- `A3RebalanceComputed` gained `redeployment` (the Finding 4 + Finding 5 work; gap-closing math, cash-as-funding, leftover-to-cash).
- `A3HoldingActionBody` gained `decision` and `source_observation` (the per-holding action now carries the trim/exit/maintain decision directly, not only the prose).
- `A3Summary` gained `trim_count` and `exit_count`.
- `A3RebalancePosition` gained `decision` ("trim" \| "exit"); `glide_path[].trigger_at_weight_pct` is in addition to `resulting_weight_pct`.
- The skeleton's bare `holding_actions[i].advisor_action` is now a discriminated union of `A3HoldingActionBody | A3Sentinel`, keyed by `kind`.

### B.5 The deterministic instrument-selection funnel (Finding 1)

Implemented in `lib/agents/instrument-selection.ts` (607 lines). Tunable parameters at `:30-56`, every value named (the ADR-0034 rationale-in-the-code discipline):

```ts
export const SELECTION_PARAMS = {
  MIN_AUM_CR: 500,                   // eligibility floor, ADR-0034
  MIN_TRACK_RECORD_YEARS: 3,         // matches the 3-year ranking horizon
  QUALITY_GATE: "top_half",          // alternative: "top_tercile"
  SHORTLIST_SURFACE: 3,
  SHORTLIST_INTERNAL: 5,
  CADENCE_WINDOW_DAYS: 14,
  CADENCE_STAGE_THRESHOLD_CR: 2,
  CADENCE_PER_TRANCHE_CR: 1.5,
  CADENCE_MAX_TRANCHES: 4,
  DURATION_SHORT_MAX_Y: 3,           // ADR-0037 A1
  DURATION_LONG_MIN_Y: 5,
  AAA_HIGH_GRADE_MIN_PCT: 70,        // ADR-0037 A2: AAA% excludes AA+, so 70 not 80
  SOV_SOVEREIGN_MIN_PCT: 80,         // ADR-0037 A2: SOV-aware, mirrors the gilt SOV% profile
};
```

The funnel mechanics (`runFunnelOnPool`, `:286`): risk-adjusted composite (Sharpe, Sortino, Calmar each rank-normalised; mean of ranks) -> quality cohort (top half by composite) -> lexicographic sort (lowest TER, then 3y return tiebreak) -> internal 5, surface 3. Eligibility (`isEligibleMf`, `:173`): AUM >= 500 Cr AND age >= 3y AND the three risk-adjusted metrics present. The skill's "up-to-3 surfaced, internal-5" lines up exactly.

### B.6 Honest degradation (the MF / PMS / AIF asymmetry, confirmed)

- Mutual funds run the full funnel where the metrics are present (the canonical case).
- PMS classification (`classifyPmsSleeve`, `:124`) reads `strategy_type` from the snapshot row, never the wrapper-type assumption; current PMS universe is all strategy_type "equity", classifies Equity by data. PMS deployments use the top-up-or-fresh-suggestion path against the equity pool.
- AIF non-gold alternatives have no auto-funnel: when the alternatives target is >= 5% of the portfolio, the split is 5% gold (the commodity-ETF funnel) plus the remainder marked `non_gold_advisor_select` with a logged reason citing P40 (`buildAlternativesPlan`, `:563`). Never auto-recommended; never fabricated metrics to fill it.

The skill states the discipline at `agents/a3_so_what.md:111` ("PMS has no risk-adjusted metrics and AIF has no performance metrics, so their selection is advisor-select; say so honestly and never fabricate metrics to fill it.").

---

## Part C: ADRs 0031 through 0039 (on disk, with one-line titles)

All nine ADRs are present and accepted on disk. Titles taken verbatim from each file's H1:

| ADR | Path | Title |
|---|---|---|
| 0031 | `docs/decisions/0031_a3_so_what_advisor_action_agent.md` | A3 So-What advisor-action agent, placement and the agent-reads-agent precedent |
| 0032 | `docs/decisions/0032_mandate_target_midpoint_with_optional_explicit.md` | Mandate allocation targets, band midpoint by default with an optional explicit target |
| 0033 | `docs/decisions/0033_sub_sleeve_tilt_foundation_slice.md` | Sub-sleeve allocation framework, the model-portfolio foundation slice |
| 0034 | `docs/decisions/0034_instrument_selection_architecture.md` | Instrument-selection architecture and its tunable parameters |
| 0035 | `docs/decisions/0035_flexi_multi_lookthrough.md` | Flexi/multi-cap look-through and the diversified-equity option |
| 0036 | `docs/decisions/0036_international_equity_subsleeve.md` | International equity as its own sub-sleeve, with residual counting |
| 0037 | `docs/decisions/0037_debt_2d_credit_by_duration.md` | The 2D credit-by-duration debt framework |
| 0038 | `docs/decisions/0038_deferred_llm_composition_inference.md` | DEFERRED, bounded LLM inference of a missing fund composition |
| 0039 | `docs/decisions/0039_classification_integrity_validation.md` | Classification-integrity as a recurring validation concern |

### C.1 ADR-0038 deferred — breadcrumb and premise-did-not-hold verified

The breadcrumb is at the deterministic-decline branch of `decomposeHeldEquity`, `lib/agents/instrument-selection.ts:405-411`:

```ts
// A diversified (flexi/multi/focused) fund with NO composition. The bounded
// LLM inference for this case is DEFERRED (ADR-0038): no flexi in the current
// universe lacks composition, so this branch is unreachable today, and the
// ring-fenced inference component will be built if and only if a real
// composition-missing flexi appears in a future snapshot (product debt P46).
// Until then, decline deterministically to advisor-select rather than guess.
return { ...base, type_label: "diversified equity, composition unavailable, advisor-select", composition_source: "declined" };
```

The premise-did-not-hold claim: the look-through audit cited in ADR-0038 establishes that ALL 99 flexi/multi/focused funds in the snapshot carry an explicit `LargeCap/MidCap/SmallCap %`, AND the only equity funds missing a composition are five pure small-caps whose cap is given by category (no inference needed). The exact "99 flexi/multi/focused, all with composition" figure is recorded in ADR-0038 and product debt P46 (`docs/debt/product_debt_log.md:51`, "all 99 flexi/multi/focused funds carry an explicit `LargeCap/MidCap/SmallCap %`"); the audit it cites is `docs/audits/2026-05-30_lookthrough_intl_duration.md`. Cross-verified: the decline branch is reachable in code but unreachable for any real fund in the current universe.

### C.2 ADR-0039 classification-integrity — R1 through R7 confirmed, standing data-correction policy recorded

The R1-R7 check rules and the standing data-correction policy are both captured in `docs/decisions/0039_classification_integrity_validation.md`. The rules verbatim (the seed-spec for the future automated pipeline):

- **R1** eligibility floor and never let a thin or empty pool pass silently
- **R2** sleeve classification and its no-hint / unknown-strategy fallback
- **R3** credit bucket (category-primary, SOV-aware metric-secondary)
- **R4** duration bucket
- **R5** cap bucket / look-through (residual-is-international holds only for all-equity funds, hybrids excepted)
- **R6** selection-pool membership (categories correctly classified but in no pool)
- **R7** default/fallback census (every branch that absorbs an unusual shape without positive evidence)

The standing data-correction policy is recorded in the ADR itself (last paragraph of the Decision section): "When a genuine Layer-1 data correction arises, it pushes to the snapshot repo's `main` directly, consciously and knowingly, as the primary's call... This round produced NO data correction." The trigger to build the automated pipeline is also stated: "when the data goes live or begins refreshing on a schedule."

---

## Part D: architecture wiring (for the planner's Architecture tab)

### D.1 A3's place in the Samriddhi 2 pipeline topology

Source: `lib/agents/pipeline.ts:100-447` (`runDiagnosticPipeline`). Sequential dataflow:

1. Load investor + snapshot + mandate (`:107-118`).
2. `computeMetrics` (M0.PortfolioRiskAnalytics) with the per-investor mandate threaded for asset-class targets/bands (`:127-135`, ADR-0032).
3. `route` (the deterministic evidence-router).
4. `runRiskRewardDeterministic` (sibling capability, S1-bypass, ADR-0021), conditional on `routerDecision.riskRewardStats` (`:143-154`).
5. `runPortfolioOverlapDeterministic` (sibling, ADR-0030), conditional (`:161-172`).
6. `runTimeSeriesPerformanceDeterministic` (sibling, ADR-0028), conditional with a try/catch skeleton degradation (`:184-207`).
7. Evidence agents E1-E7 in parallel via `Promise.all` (`:223-252`).
8. `stitch` -> StitchedContext with `pre_observations` (`:269-283`).
9. `runS1Diagnostic` -> the seven-section briefing.
10. `runA2Diagnostic` -> per-holding meeting-behaviour verdicts (`:312-318`).
11. **`runA3Diagnostic`** -> the so-what surfaces (`:369-381`). Reads A2's output, the metrics, the pre-observations, risk-reward, overlap, evidence, the M0.IndianContext bundle, the operational metadata, and the instrument-selection context.
12. Persist `contentJson` with `a3_so_what: a3Result.output` (`:404`).

So A3 runs AFTER A2 (not in parallel) and AFTER M0; it consumes A2 as agent-reads-agent (the third such reader after the ADR-0031 pattern, the prior two being A2 reading metrics+evidence and risk-reward reading metrics). The S2 renderer is untouched and reads only `briefing` (WA09); A3 ships as data.

### D.2 The sub-sleeve tilt framework (the model-portfolio foundation slice)

Lives in `db/fixtures/structured-mandates.ts:51-122` (the framework) and `lib/agents/instrument-selection.ts:98-102` (the resolver). The carrier on the mandate is the optional `sub_sleeve_tilt` field (`Mandate.sub_sleeve_tilt`, the ADR-0032 optional-field pattern) with two sub-fields `equity` and `debt_credit`. The house-view defaults:

```ts
export const EQUITY_SPLIT_BY_TIER: Record<string, EquitySplit> = {
  Conservative:          { international_pct: 10, domestic_large_pct: 75, domestic_mid_pct: 20, domestic_small_pct:  5 },
  "Moderate-Aggressive": { international_pct: 15, domestic_large_pct: 55, domestic_mid_pct: 35, domestic_small_pct: 10 },
  Aggressive:            { international_pct: 20, domestic_large_pct: 35, domestic_mid_pct: 40, domestic_small_pct: 25 },
  "Ultra-Aggressive":    { international_pct: 20, domestic_large_pct: 35, domestic_mid_pct: 40, domestic_small_pct: 25 },
};

export const DEBT_CREDIT_SPLIT_BY_TIER: Record<string, DebtCreditSplit> = {
  Conservative:          { sovereign_pct: 55, high_grade_pct: 42, credit_risk_pct:  3 },
  "Moderate-Aggressive": { sovereign_pct: 35, high_grade_pct: 55, credit_risk_pct: 10 },
  Aggressive:            { sovereign_pct: 25, high_grade_pct: 55, credit_risk_pct: 20 },
  "Ultra-Aggressive":    { sovereign_pct: 25, high_grade_pct: 55, credit_risk_pct: 20 },
};
```

The duration axis resolves from the investor's `timeHorizon` via `durationForHorizon` (`db/fixtures/structured-mandates.ts:112`). The resolver `resolveFramework` (`lib/agents/instrument-selection.ts:98`) takes risk tier + time horizon + optional override and returns `{equity, debt_credit, debt_duration}`. No persona currently sets the override; all five Samriddhi 2 personas use the house-view default. ADR-0033 frames this as the foundation slice that the future model-portfolio framework (P43) will extend, not replace.

### D.3 Non-agentic components and shared types introduced

- `lib/agents/instrument-selection.ts` (the funnel; 607 lines; pure deterministic, no LLM).
- `lib/agents/operational-scope.ts` (the category-guarded per-holding operational-metadata join; 282 lines).
- `lib/agents/m0-indian-context.ts` (the tax-matrix and SEBI-minimums context builder for A3; 791+ lines).
- New shared types: `SubSleeveFramework`, `SubSleeveTilt`, `EquitySplit`, `DebtCreditSplit`, `DurationBucket`, `Mandate.sub_sleeve_tilt` (mandate-side); `SleeveDeploymentPlan`, `EquityPlan`, `DebtPlan`, `AlternativesPlan`, `Shortlist`, `Cadence`, `SelectionCandidate`, `InstrumentUniverse` (selection-side); `A3IndianContext`, `A3TaxProductFamily`, `A3OperationalMetadata` (regulatory/operational); the A3 output types in §B.3.

---

## Part E: snapshot shape and time-step model (for the planner's snapshot sub-view)

The substantive data is private; what follows is structure only, no holdings figures.

### E.1 Snapshot schema, top-level

Each snapshot is a JSON object with these top-level keys (verified against `fixtures/snapshots/enriched/snapshot_t0_q2_2026.json`):

```
{
  _meta:               object        // description, sections, counts, enrichment metadata
  mf_funds:            list[1773]    // mutual-fund rows (the workhorse catalog)
  aif:                 object        // { "Fund Profiles": list, "Fee Tiers Detail", "E6 Agent Input Ready", "Category Summary", "Data Quality & Gaps" }
  pms:                 object        // { _schema_version, _pass, _source, _data_as_of, _total_funds, _note, funds: list }
  nifty500:            object        // { metadata, columns_description, companies: list, e1_financial_risk_agent_snapshot }
  unlisted_equity:     list[100]
  industry_reports:    list[14]
  macro:               object        // { data_snapshot: { ... } }
  snapshot_metadata:   object        // snapshot_id, snapshot_date, evolution_type, days_elapsed_since_t0, evolved_fields, static_fields, generation_notes, enrichment_version
  indices:             object        // nifty_50_tri, nifty_next_50_tri, nifty_100_tri, nifty_midcap_150_tri, nifty_smallcap_250_tri, nifty_500_tri, bse_sensex_tri, nifty_bank_tri, nifty_it_tri, sp_500_tri_inr, ...
  fx:                  object        // { usd_inr, eur_inr, gbp_inr, aed_inr }
}
```

The per-instrument field shape lives on the rows themselves: `mf_funds[i]` carries `sebi_category`, `TER (%)`, `AUM (Cr)`, `Age (Yrs)`, multi-period returns (`1M, 3M, 6M, YTD, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 15Y`, plus calendar years 2016-2025), cap splits (`LargeCap %`, `MidCap %`, `SmallCap %`), `Duration`, `AAA %`, `SOV %`, `Cash %`, `Sharpe`, `Sortino`, `Volatility`, `VaR (H)`, `VaR (I)`, `Beta`, `Benchmark Index` + benchmark returns, `No. Holdings`, `P/E`, `P/B`, `Exit Load (JSON)`, `Top 5 Holdings (JSON)`, `Top 5 Sectors (JSON)`, `tier_b_stats`, and `monthly_nav`. The full TypeScript type for the loader is at `lib/agents/snapshot-loader.ts` (start of file); the per-row type (`TierBStats`) is at `:54-83`.

### E.2 Time-step model: nine separate snapshot files

The t0 through t8 snapshots are NINE SEPARATE JSON FILES on disk, not one time-indexed structure:

```
fixtures/snapshots/enriched/snapshot_t0_q2_2026.json
fixtures/snapshots/enriched/snapshot_t1_q3_2026.json
fixtures/snapshots/enriched/snapshot_t2_q4_2026.json
fixtures/snapshots/enriched/snapshot_t3_q1_2027.json
fixtures/snapshots/enriched/snapshot_t4_q2_2027.json
fixtures/snapshots/enriched/snapshot_t5_q3_2027.json
fixtures/snapshots/enriched/snapshot_t6_q4_2027.json
fixtures/snapshots/enriched/snapshot_t7_q1_2028.json
fixtures/snapshots/enriched/snapshot_t8_q2_2028.json
```

Cadence: quarterly. The metadata rows in `db/seed.ts:52-125` carry the per-snapshot dates, the evolution-type label, and a one-line `testAxis` describing the stress or quiet scenario each step encodes. Summary:

| Snapshot | Date | Evolution type | Test axis |
|---|---|---|---|
| t0 | 2026-04-02 | baseline | source-identical baseline |
| t1 | 2026-07-01 | quiet | stability under quiet evolution |
| t2 | 2026-10-01 | quiet_it_cool | sub-threshold IT sector tilt (~4% cool) |
| t3 | 2027-01-01 | stress_rate_cut | RBI cuts repo 50 bps; duration plays surface |
| t4 | 2027-04-01 | normalisation | post-rate-cut normalisation |
| t5 | 2027-07-01 | stress_bank_shock | Banking & Financial Services ~18% drop |
| t6 | 2027-10-01 | stress_ril_idio | Reliance Industries ~28% drop on regulatory action |
| t7 | 2028-01-01 | normalisation | post-stress normalisation |
| t8 | 2028-04-01 | quiet_smallcap_rally | mild small-cap rally (~12% quarter) |

What changes step-to-step: NAVs, prices, indices, fund tier_b stats, macro indicators, the per-row `monthly_nav` arrays, FX rates. The `_meta`-style structural fields (column descriptions, categories, etc.) are stable across steps. The per-snapshot `snapshot_metadata.evolved_fields` and `static_fields` lists in each file are authoritative on what was evolved versus held static. The MVP only consumes t_n and the immediately-prior t_{n-1} (ADR-0028; the priorSnapshotId helper at `lib/agents/pipeline.ts:85-98`).

### E.3 Safe counts (shape stats, non-sensitive)

- 1773 mutual funds across 46 distinct `sebi_category` values; 183 carry no `sebi_category` (the silent-omission gap A3's selection funnel handles by category-set filtering).
- 513 PMS funds (all current strategy_type "equity"; classification is data-driven, not wrapper-hardcoded).
- 162 AIF profiles across multiple SEBI categories.
- 500 Nifty 500 companies (the listed-equity universe).
- 100 unlisted-equity rows.
- 14 industry reports.
- 16 indices: Nifty 50 TRI, Next 50 TRI, 100 TRI, Midcap 150 TRI, Smallcap 250 TRI, 500 TRI, BSE Sensex TRI, Nifty Bank TRI, Nifty IT TRI, crisil_composite_bond, crisil_short_term_bond, crisil_dynamic_gilt, nifty_10y_gsec, crisil_liquid, gold_inr, sp_500_tri_inr (per ADR-0009).
- 4 FX pairs (usd_inr, eur_inr, gbp_inr, aed_inr).

`mf_funds[i]` carries ~64 fields per row (the field set in E.1 is the workhorse subset; see `lib/agents/snapshot-loader.ts` TierBStats for the enrichment shape).

### E.4 TRI normalisation (the v14 finding) — partial confirmation, one inconsistency to flag

The v14 finding the ping references is the equity TRI normalisation. The on-disk evidence:

- `docs/decisions/0009_snapshot_index_synthesis_and_set.md:55` says: "Indices are base-indexed at 1000.0 at the **start** of the synthesis window."
- `docs/decisions/0011_snapshot_schema_placement_and_lookback.md:105` shows an example `"monthly_values": {"2019-05": 483.76, ..., "2026-04": 1000.00}` where the START is 483.76 and the END (the snapshot's terminal month) is 1000.00.

These two ADRs appear inconsistent on whether 1000.0 anchors the START or the TERMINAL month. The example in ADR-0011 is the live shape (terminal = 1000.00); ADR-0009's "start of the synthesis window" wording may be a stale phrasing from an earlier draft, or a different (un-normalised) base series before the live normalisation step. **Flag for the planner refresh:** this is worth a follow-up read against the snapshot itself (cheap, one-step) to resolve which is canonical; the ping recalled "normalised to 1000.0 at the terminal month" which matches ADR-0011's example, not ADR-0009's prose. Either way, the practical implication holds: charts that render the un-normalised path need the underlying per-fund `monthly_nav` (which carries raw values), not the normalised index series.

The normalisation lives snapshot-side (the per-index `monthly_values` block, written at snapshot synthesis time); the agents read it as-is.

### E.5 Privacy boundary (ADR-0027)

The boundary is real and codified at `docs/decisions/0027_snapshot_data_access_via_private_releases.md`: real-world-sourced data is private (the enriched snapshots live in `ArthaSamriddhiAI/Samriddhi-AI-Data-Snapshots`, fetched on setup via `gh release download` against the version pinned by `data-version.txt`); fictional/creative content is public (the six investor profiles, the structured holdings and mandates at `db/fixtures/structured-holdings.ts` and `db/fixtures/structured-mandates.ts`, the case fixtures at `db/fixtures/cases/*.json`, the Sharma evidence verdicts at `db/fixtures/raw/sharma_marcellus_evidence_verdicts.md`, all the ADRs and audits). The planner's snapshot sub-view should reflect that the public repo describes the SHAPE of the snapshot but not its contents; the private repo holds the contents.

---

## Part F: the five Samriddhi 2 synthetic investors (source-verified profiles)

Source: `db/seed.ts:138-429` (the investor records, profile markdown verbatim, structured-holdings tables) and `db/fixtures/structured-mandates.ts:153-264` (the per-investor mandates).

### F.1 Bhatt

- **Display name:** Shailesh Bhatt (`SB`). 52, Ahmedabad. Family textile exporter, second generation.
- **One-line archetype:** Stated-aggressive, revealed-moderate Ahmedabad family-business head, mid-cleanup of an accreted PMS/AIF stack.
- **Liquid AUM:** Rs 22.10 Cr. `riskAppetite: "Aggressive · stated"`, `timeHorizon: "Over 5y"`, `modelCell: aggressive_long_term`, `liquidityTier: Essential`.
- **Mandate shape:** Standard aggressive-long-term bands per foundation §1 (Equity 60-70, Debt 20-30, Alternatives 5-10, Cash 2-5). No explicit `target_pct` (midpoint default applies; ADR-0032). Position-concentration ceiling 15% of liquid AUM.
- **Portfolio character:** 12 holdings. Equity-heavy 72.2% (breaches the 60-70 ceiling by ~2.2 pp), Debt 14.3%, Alternatives 13.6% (Avendus Cat III), Cash 0%. Includes 4 PMS schemes (Marcellus, White Oak, Motilal Oswal, Alchemy), 3 direct large-cap names (Reliance 12.2%, HDFC Bank 11.3%, ITC 5.0%), 2 mutual funds, 1 Cat III long-short AIF, FDs and arbitrage. Headline tension: wrapper over-accumulation across 4 PMS, complexity-premium-not-earned on the Cat III, fee inefficiency, stated-revealed divergence. The cleanup-inflection (Aanchal-driven) is the narrative driver.
- **Case archetypes mapped:** wrapper over-accumulation, complexity premium not earned, allocation drift on the equity ceiling, full-PMS-stack judgment (the Bhatt fixture is the archetypal cleanup case).

### F.2 Menon

- **Display name:** Arjun Menon (`AM`). 38, Bengaluru Indiranagar. Post-exit UAE return.
- **One-line archetype:** Post-liquidity-event founder sitting in cash, deploying from zero, NRE-to-resident in transition.
- **Liquid AUM:** Rs 60.65 Cr. `riskAppetite: "Aggressive"`, `timeHorizon: "Over 5y"`, `modelCell: aggressive_long_term`, `liquidityTier: "Essential (deep, transitional)"`.
- **Mandate shape:** The only investor that sets explicit `target_pct` (ADR-0032, the worked example). Bands and targets: Equity 55-70 target 65; Debt 15-30 target 15; Alternatives 5-20 target 15; Cash 2-10 target 5. Targets sum to 100. Alternatives and Cash bands widened on the upside (permissive ceilings) for the pre-IPO runway and deployment window; the explicit targets state the intent directly so the midpoint default is not used.
- **Portfolio character:** 3 holdings. Cash 86.6% (savings), Debt 6.8% (HDFC FD), Equity 6.6% (US-listed legacy). Headline tension: extreme cash drag, NRE-conversion mechanics constraining moves, Rs 12-14 Cr property reserve within 12 months, Rs 50 L parents-care fund planned. This is the deploy-from-zero archetype.
- **Case archetypes mapped:** cash drag (extreme), the deploy-to-target redeployment math, the Finding 5 cash-as-funding case, instrument-level deployment scale (largest deploy in the cohort).

### F.3 Iyengar

- **Display name:** Mrs. Lalitha Iyengar (`LI`). 67, Chennai. Widow, 18 months.
- **One-line archetype:** Conservative-distribution widow with an inherited corpus, capital-protection priority.
- **Liquid AUM:** Rs 3.41 Cr. `riskAppetite: "Conservative"`, `timeHorizon: "3-5y operational"`, `modelCell: conservative_medium_term`, `liquidityTier: Secondary`.
- **Mandate shape:** Tightened conservative-medium-term: Equity 25-45, Debt 45-65, Alternatives 0-10, Cash 3-10. Wrapper-count ceiling of 1 across any wrapper type. Position-concentration ceiling tightened to 12%. Instrument exclusions: `aif_cat_iii_long_short`, `unlisted_pre_ipo`.
- **Portfolio character:** 6 holdings. Debt-heavy 64.5% (FDs + corporate-debt MF), Equity 35.5% (Bluechip MF, Nifty 50 index, Balanced Advantage), Alternatives and Cash 0%. Headline tension: liquidity profile against medical contingency, FD maturity laddering, emotional weight of inherited equity MFs (built by her late husband, never modified). Revealed pattern more conservative than stated (2022 partial-loss withdrawal).
- **Case archetypes mapped:** conservative-distribution comparison surface, mandate-consistent positioning with informational drift, the no-PMS / no-AIF clean-MF-and-FD shape.

### F.4 Surana

- **Display name:** Rajiv Surana (`RS`). 44, Mumbai Bandra West. Tech founder, Series D.
- **One-line archetype:** Sophisticated equity-heavy founder with a single-name concentration tension and an unlisted-stake-outside-scope question.
- **Liquid AUM:** Rs 34.50 Cr (advisory scope; excludes the Rs 165 Cr private company stake).
- **Mandate shape:** Standard aggressive-long-term bands; standard position-concentration 15%; sub_sleeve_tilt default (house-view aggressive).
- **Portfolio character:** 12 advisory-scope holdings. Equity 89.9% (well over the 60-70 band), Alternatives 5.8% (gold), Cash 4.3%, Debt 0%. Reliance Industries at 20.3% of advisory-scope liquid corpus (breaches the 15% escalate threshold, the archetypal single-position-trim case). Holdings span MFs (Parag Parikh, Axis Bluechip, Mirae, Kotak, SBI Small Cap), one PMS (White Oak), two direct large-caps (Reliance, HDFC Bank), one international ETF (Vanguard S&P 500 via GIFT), and physical gold. Disciplined sophisticated portfolio with one acute trim case.
- **Case archetypes mapped:** position over-concentration (Reliance trim; the worked example in `agents/a3_so_what.md:182-197`), equity-over-target rebalance, the no-debt anomaly, sophisticated-investor framing.

### F.5 Malhotra

- **Display name:** Dr. Vikram & Dr. Shruti Malhotra (`VM`). 47 / 44, Gurgaon DLF Ph 4. Dual-professional household.
- **One-line archetype:** Disciplined dual-professional accumulation household, under-allocated to equity, education corpus structured.
- **Liquid AUM:** Rs 11.85 Cr. `riskAppetite: "Aggressive"`, `timeHorizon: "Over 5y"`, `modelCell: aggressive_long_term`, `liquidityTier: Essential`.
- **Mandate shape:** Standard aggressive-long-term bands. No explicit targets; midpoint applies.
- **Portfolio character:** 8 holdings. Equity 52.2% (under the 60-70 band; allocation-drift case), Debt 39.4% (NHAI/PFC tax-free bonds + HDFC FD), Alternatives 8.4% (physical gold), Cash 0%. No PMS, no AIF, no international. Headline tension: allocation drift on the equity sleeve (under-deployed against the model target), flexi-cap look-through opportunity (Parag Parikh Flexi Cap is 14.2% of the portfolio), structured education-corpus priority.
- **Case archetypes mapped:** allocation-drift case (equity-under), flexi look-through (ADR-0035), the well-managed-but-conservative-by-revealed-pattern shape.

### F.6 Sharma — archive status confirmed

- **Investor record** (`db/seed.ts:414-428`) is still seeded as `sharma`. The Sharma Samriddhi 1 (proposed-action) case `c-2026-05-14-sharma-01.json` is ACTIVE in `db/fixtures/cases/`.
- **The Samriddhi 2 (diagnostic) sharma case is ARCHIVED.** Moved to `db/fixtures/cases/_archived/c-2026-05-15-sharma-s2-01.json` (commit `2560996`, per the merge stat). The `_archived/README.md` records why: "a janky artifact from an earlier pass where stubbed content was mixed with real reasoning... never carried an `a3_so_what` block... permanently excluded from all future Samriddhi 2 backfill, run, and verify operations."
- **The wiring guards** are durable, per `_archived/README.md`: (i) directory iterators in `db/fixtures/cases/` are non-recursive so `_archived/` is unreachable by glob; (ii) `scripts/backfill-a3.ts` now requires explicit `--cases=` enumeration and refuses an empty/all-cases default; (iii) `scripts/generate-s2-batch.ts` no longer lists sharma-s2 in its batch (per commit `2560996` "chore: remove sharma-s2 from generate-s2-batch.ts to preserve archive"). Product debt P42 (`docs/debt/product_debt_log.md:47`) records the standing discipline. The Samriddhi 1 Sharma case is unaffected; Sharma remains the demonstration archetype for the proposal-evaluation workflow.

Net for the planner: Sharma is a LIVE Samriddhi 1 persona, ARCHIVED Samriddhi 2 stub.

---

## Part G: existing-audit harvest + verbatim product debt P40 to P47

### G.1 Audits on disk under `docs/audits/` (post-PR-#11)

| File | Date | Scope |
|---|---|---|
| `2026-05-28_t512_a3_so_what.md` | 2026-05-28 | T-5.12 workstream audit (Sections 0, 1; drift register D1-D6) |
| `2026-05-28_qualitative_data_snapshot.md` | 2026-05-28 | Qualitative-data census preceding A3 wiring |
| `2026-05-29_a3_credibility_completion.md` | 2026-05-29 | Coverage of mf_funds/pms/aif/nifty500/unlisted_equity, redeployment leftover-to-cash behaviour |
| `2026-05-29_a3_deployment_and_profile.md` | 2026-05-29 | Finding 1 + Finding 3 pre-build audit (instrument universe, risk-profile targets, cash-as-funding) |
| `2026-05-30_classification_integrity.md` | 2026-05-30 | Full-path classification trace under R1-R7, two-layer (DATA/LOGIC) taxonomy |
| `2026-05-30_instrument_selection_prebuild.md` | 2026-05-30 | Pre-build coverage census for the Finding 1 funnel |
| `2026-05-30_lookthrough_intl_duration.md` | 2026-05-30 | Look-through + international + credit-by-duration pre-build audit |
| `2026-05-27_chore_v14_debt_sync.md` | 2026-05-27 | Bidirectional planner-vs-disk debt sync (pre-A3, the v14 chore) |

The planner should absorb directly:

- The drift register from `2026-05-28_t512_a3_so_what.md` (Drift Register, end of doc): D1 branch-convention (resolved `features/`), D2 path drift in the ping (corrected), D3 observation-vocabulary location (stitcher, not M0), D4 7-live vs 10-aspirational observations (`sector_over_concentration`, `fee_inefficiency`, `mandate_consistent` not live as pre-observations), D5 the favorable two-layer-pattern precedent (no new pattern-ADR), D6 absent JSON-schema files (TS type is canonical).
- The R1-R7 method from `2026-05-30_classification_integrity.md` is the seed-spec for the future automated data-management pipeline (now codified as ADR-0039 and product debt P47).
- The five-case archetype maps from the persona-snapshot alignment work (commit `54101ba`; 32 checkable holdings, 22 strict matches, 3 category-violations, 7 non-matches; the source of P40).
- The v14 debt-sync audit's Bucket B (the on-disk-not-in-planner entries P25, P26, P27, P29, P30, D9, T14, T15) are still on disk and unchanged this round; the v15 refresh inherits them.

### G.2 Verbatim product debt P40 to P47

All eight entries are committed in `docs/debt/product_debt_log.md:45-52`. Table format (one row per entry, `| ID | Description | Severity | Originating workstream | Target fix workstream |`). Verbatim:

| ID | Description | Severity | Originating workstream | Target fix workstream |
|---|---|---|---|---|
| P40 | Persona-universe naming mismatch. The existing Samriddhi 2 investor personas reference specific PMS/AIF/MF product variants that do not all match the snapshot record set under a strict matcher, so per-instrument operational fields (lock-in, exit-load, AIF tenure/redemption/min-commitment) stay silent (Reading B) for those holdings. Examples: Bhatt's "Avendus Absolute Return Fund" (no Avendus Cat III AIF in the 162 profiles; an Avendus PMS variant, Olivo Core Equity, exists but is a different product), "Marcellus Consistent Compounder" (snapshot carries "Consistent Compounders", plural near-miss), "White Oak India Pioneers PMS" (manager present as WhiteOak Capital AIF/MF rows, not this PMS), "Alchemy Smart Alpha 250 PMS" (snapshot has a "Smart Alpha 250" PMS row and an "Alchemy Leaders of Tomorrow" AIF, neither this exact product), "Kotak Emerging Equity Fund" (correct match is Kotak Midcap Fund; the strict matcher binds nothing once the wrong overseas FoF is category-rejected). The personas are coherent as portfolios; product-scoped tax and SEBI context still applies to every holding regardless of snapshot match. Not in scope for a retroactive fix (backfill cost); the next investor-persona cohort is snapshot-verified at creation via `npm run check:persona-snapshot` (must exit 0 before a persona is treated as locked). | Low | A3 So-What (T-5.12) Finding 2 snapshot integrity check | Next investor-persona cohort (snapshot-verified at creation) |
| P41 | Kotak upstream verdict contamination. The name-matcher false-positive A3 now guards against (the mid-cap holding "Kotak Emerging Equity Fund" binding to the overseas "Kotak Global Emerging Market Overseas Equity Omni FOF") is pre-existing in E6/E7's wrapper and mutual-fund name matching (`case/scope-builders.ts`, `wrapper-scope.ts`). The upstream evidence verdicts in the current Samriddhi 2 fixtures may therefore be reasoning about the wrong Kotak fund. A3's local category-consistency guard (`operational-scope.ts`) prevents A3 from surfacing the wrong fund's operational data, but does not repair the upstream verdict. Flagged as a distinct workstream: review E6/E7's matcher for category-consistency and re-fire affected fixtures if a verdict shifts. | Low | A3 So-What (T-5.12) Finding 2 | Future E6/E7 matcher review |
| P42 | Backfill and run scripts must require explicit case enumeration. An implicit "all cases in the directory" default in scripts/backfill-a3.ts swept the off-list `c-2026-05-15-sharma-s2-01` case into the Finding 2 A3 re-backfill, wasting ~$0.87 of API spend on a case the operator did not authorise. Mitigations now in place and to be retained: (1) scripts/backfill-a3.ts requires `--cases=` and exits 1 without it, with a free `--dry-run` that lists targets before any spend (commit 0317b5b); (2) sharma-s2 is archived to db/fixtures/cases/_archived/ so directory iteration cannot reach it (commit 4c9d812). Loosening either protection (re-introducing a glob/all-cases default, or moving sharma-s2 back into the active cases directory) reintroduces the failure mode. Separate follow-on: scripts/generate-s2-batch.ts still lists sharma-s2 in its generation batch and would re-materialise it in the active directory if re-run. | Low | A3 So-What (T-5.12) Finding 2 re-backfill | Retained as standing discipline; generate-s2-batch follow-on |
| P43 | No risk-appetite x time-horizon to model-portfolio-bands framework. The per-investor mandates in MANDATES_BY_INVESTOR are bespoke and hand-authored; the classification tags (riskAppetite, timeHorizon, modelCell) are attached per investor but do NOT drive the bands through any shared grid or function. Proof: Bhatt, Sharma, and Menon carry identical tags (aggressive, Over 5y, aggressive_long_term) yet have three different band sets. Correct and deliberate for the current 5 demo personas, but a real "how does Samriddhi decide an investor's target allocation" framework (a risk x horizon to bands mapping, with per-investor overrides) is needed for the forthcoming larger investor cohort and the productization story. ADR-0032's optional explicit target_pct is the interim seam (mandate states intent directly); the framework itself is on the roadmap, not built. | Medium | A3 So-What (T-5.12) Finding 5 band-structure analysis | Model-portfolio framework workstream (larger investor cohort) |
| P44 | Hand-authored per-holding asset-class classification has no runtime validator. Holdings carry a hand-authored assetClass (the sleeve), which computeMetrics sums directly; correct for the 5 personas (equity PMS is Equity, long-short/private-credit AIF is Alternatives, verified in the Finding 5 PMS classification check), but a future persona could mistag a holding (e.g. an equity PMS as Alternatives) with no runtime guard to catch it. The snapshot `identity.strategy_type` field on PMS records (and `SEBI Category` on AIF) could power a validator, a companion to the persona-snapshot-alignment utility (WA26), to guard the larger investor cohort at creation time. Out of scope now; flagged. | Low | A3 So-What (T-5.12) Finding 5 PMS classification check | Future classification-validator (companion to npm run check:persona-snapshot) |
| P45 | Instrument-selection funnel is a v1 that needs calibration before productisation. The funnel (ADR-0034) ships with named, tunable parameters whose starting values are reasoned but not yet validated against advisor feedback: the eligibility floors (AUM 500 Cr, track record 3y), the quality-gate cohort cutoff (top-half vs top-tercile), the shortlist size (up to 3 surfaced, internal 5), the cadence numbers (2-week window, 2 Cr staging threshold, 1.5 Cr base per-tranche, 4-tranche cap), and (added in the expanded-framework pass) the 2D-debt thresholds (duration cutoffs short under 3y / long over 5y, AAA% high-grade cutoff 70 not 80, and the SOV-aware sovereign cutoff SOV% 80; rationale in ADR-0037). The internal-5/surface-3 split logs ranking positions 4-5 in the deterministic preview as a calibration aid (may be retained or dropped once the ranking is trusted). UPDATE (expanded-framework pass): the earlier note that the funnel "does not prescribe the intra-sleeve split" is SUPERSEDED. The intra-sleeve split is now prescribed by the expanded framework, two-level equity (domestic cap-split plus international, ADR-0033/0036) and 2D credit-by-duration debt (ADR-0033/0037), with a per-investor `sub_sleeve_tilt` override seam; the splits themselves remain house-view-by-tier v1 values to calibrate. These are deliberate v1 simplifications, all documented in ADR-0034 and the expanded-framework ADRs; calibrate the parameters and the split tables when the model-portfolio framework (P43) is formalised and real advisor feedback is available. | Low | A3 So-What (T-5.12) Finding 1 | Model-portfolio framework workstream / instrument-selection calibration pass |
| P46 | Bounded LLM composition-inference (the one ring-fenced two-layer exception) is DEFERRED, designed not built. The flexi/multi look-through (ADR-0035) needs each held equity fund's domestic cap split; where the snapshot lacks one, the contemplated fallback was to let Layer 2 infer the split (the single sanctioned place an LLM would produce an allocation-feeding number). It is deferred because the premise does not hold in the current universe: all 99 flexi/multi/focused funds carry an explicit `LargeCap/MidCap/SmallCap %`, and the only composition-missing equity funds are five pure small-caps whose cap is given by category, so the component would have no input and no test can be built from real data. v1 declines deterministically ("diversified, composition unavailable, advisor-select"); the deferred design with its five guardrails is ADR-0038, and the decline branch in `decomposeHeldEquity` carries an `ADR-0038` breadcrumb. TRIGGER to revisit: build only when BOTH (a) a flexi/multi/focused fund with no explicit cap split enters the universe, AND (b) it is held by or recommended to a real investor such that the deterministic decline is materially worse than a labelled estimate. Until both hold, keep the decline and do not build the component. | Low | A3 So-What (T-5.12) Finding 1 (expanded framework, option-C ruling) | Trigger-gated (see condition); ADR-0038 |
| P47 | Dynamic data-management pipeline (the automated classification-validation layer) on the roadmap. The classification-integrity audit (`docs/audits/2026-05-30_classification_integrity.md`) is the manual prototype: a full-path trace of the whole universe under a two-layer (data / logic) taxonomy, with explicit check rules R1 to R7, routing each mismatch DATA (snapshot repo) vs LOGIC (this repo). The automated version validates the universe on every data refresh, applying R1 to R7 and flagging mismatches, and reconciles the live `sebi_category`-set selection path with the latent `classifyMfSleeve` (which currently returns null for hybrids, the international categories, Floater, arbitrage) so a future wiring of the latent classifier does not reintroduce the audit's catalogued gaps. ADR-0039 records the concern, the method as the seed-spec, and the build trigger (when the data goes live / refreshes on a schedule). Also records the standing data-correction policy: a genuine Layer-1 data correction pushes to the snapshot repo's `main` directly, consciously, as the primary's call. Not built; the static demo snapshot is covered by the manual audit. | Medium | A3 So-What (T-5.12) classification-integrity audit | Dynamic data-management pipeline workstream (trigger: data live / refreshing); ADR-0039 |

All P40-P47 are ALREADY committed; no additional debt-log writes are needed in this session. The cross-references in ADR-0031, ADR-0034, ADR-0035, ADR-0036, ADR-0037, ADR-0038, ADR-0039 all resolve correctly.

### G.3 Two emerged working-agreement candidates — codification status

Both are codified in this session as new files:

- **Repo-relative-path surfacing** -> `docs/working_agreements/WA27_repo_relative_paths.md` (new file this commit).
- **"Defer to the advisor is itself a product decision" stop-and-propose** -> `docs/working_agreements/WA28_product_shape_stop_and_propose.md` (new file this commit). Codified as a SEPARATE WA, not a sharpening of WA06 (flag and wait freely). Reasoning: WA06 is the broad "surface load-bearing assumptions" discipline; WA28 names the specific class of decisions (those that shape product behaviour) that ALWAYS warrant a stop, regardless of CC's own confidence. WA28 cites WA06 as the parent and the pattern relatives (WA01 merge gate, WA12 API-call gate). Placing it as its own WA keeps it citeable by name in future workstreams.

Numbering allocated against the live registry per WA24: WA26 was the highest existing; WA27 and WA28 are the next free. README index updated.

---

## Part H: codification + audit + commit actions taken

1. **New working agreement, repo-relative-path surfacing.** Codified at `docs/working_agreements/WA27_repo_relative_paths.md`. Index row added to `docs/working_agreements/README.md`. Already applied throughout this audit.
2. **Stop-and-propose sharpening.** Codified as `docs/working_agreements/WA28_product_shape_stop_and_propose.md` (new WA, not a WA06 sharpening; reasoning in §G.3). Index row added.
3. **P40-P47 debt entries.** ALL EIGHT are already committed on disk in `docs/debt/product_debt_log.md` from PR #11; no new entries codified this session. ADR cross-references resolve correctly (ADR-0031 cites P34/P35, ADRs 0034-0039 cite P43-P47 correctly, P47's "Target fix workstream" column points back to ADR-0039).
4. **This v15 planning audit** is the WA22 versioned deliverable for the v15 absorption pass; lands here at `docs/audits/2026-05-30_v15_planning_a3_absorption.md`.
5. **Commit** is the chore-branch commit on `chore/v15-a3-absorption-audit`. The squash-merge into `main` requires the WA01 explicit confirmation gate; the chore branch is pushed and the merge is staged for primary's affirmative. Pre-merge `main` is at `8544a93`. Post-merge SHA will be reported at the point of merge. Branch will be preserved (no `--delete-branch`), consistent with how `features/a3-so-what` was just handled.

---

## Divergences from the handoff

Tracked plainly per the ping's "where the handoff and the code disagree, the code wins; surface the divergence explicitly".

| ID | Handoff said | Code says | Resolution |
|---|---|---|---|
| V1 | A3 has one Claude call | A3 has TWO LLM calls in Layer 2: `runA3Judgment` and `runA3ReasonText` | ADR-0031 originally said one call; the Step-2b judgment refinement added the second. Code is canonical. |
| V2 | A3 produces three surfaces "in one pass" | True at the pass level (one A3 invocation) but technically two LLM round-trips inside that pass | Cosmetic; "one pass" reads correctly at the orchestration level. |
| V3 | The v14 finding was "equity TRI normalized to 1000.0 at the terminal month" | ADR-0009 says "base-indexed at 1000.0 at the start of the synthesis window"; ADR-0011 shows an example with terminal = 1000.00. Inconsistency on disk. | Flagged for follow-up (§E.4). Practical implication holds: un-normalised NAVs are on the per-fund `monthly_nav` rows. |
| V4 | P40-P47 debt entries described per workstream provenance | All eight on disk in `docs/debt/product_debt_log.md:45-52`, table-row format, content matches | Verified verbatim; ADR cross-references resolve correctly. |
| V5 | A3 ships "in a single pass" agent-call shape | Confirmed at the pass level; deterministic Layer 1 plus two LLM calls in Layer 2 | No drift; just a precision note on the LLM-call count. |

No structural divergences: every load-bearing claim in the handoff (the agent path, the pipeline placement, the two-layer architecture in principle, the Finding 1-5 splits, the schema growth direction, the ADR list 0031-0039, the funnel mechanics and thresholds, the persona shapes, the snapshot t0-t8 model, the privacy boundary, the P40-P47 debt entries) verified true against `main` at `8544a93`.

---

## Forward note

This audit is the WA22 deliverable for the v15 absorption pass. The planner refresh (the v15 HTML, built separately) grounds on the artefacts cited above. Anything the planner says about A3 that is not here, or that contradicts the verbatim type in §B.3, the ADRs in §C, the wiring in §D, the snapshot shape in §E, the persona profiles in §F, or the debt entries in §G.2 should be reconciled against main (`8544a93`) before the v15 refresh is treated as locked.
