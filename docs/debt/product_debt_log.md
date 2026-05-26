# Product debt log

P-series. Capabilities the product says it does, or could do, but defers for scope; product-stance questions ("what should Samriddhi do?") routed to the Slice 7 product debt audit. Restructured out of the combined log (now `combined_debt_log_archive.md`); see `README.md` for the convention.

| ID | Description | Severity | Originating workstream | Target fix workstream |
|----|-------------|----------|------------------------|------------------------|
| P1 | NRI / RNOR / HUF investor case shapes deferred. The structural exotica (residency transitions, HUF eligibility, cross-border conversion) are out of scope for the current case set. | Medium | M0.IndianContext (the YAML stores carry the framing; cases do not exercise it) | Post-MVP investor-shape workstream |
| P2 | Full Cat III long-short AIF logic deferred; current handling is simplified. | Medium | Slice 3 evidence agents | Post-MVP capability build |
| P3 | Pairwise overlap analysis with judgment-grade recommendations. Lands via the Slice 4.6c capability build; post-MVP polish still needed beyond the initial build. | Medium | Slice 4.6c (planned) | Slice 4.6c, then post-MVP polish |
| P4 | Maintain / Monitor / Discuss / Review classification. Lands via Slice 4.6a; coverage across all holding types needs validation after the initial build. | Medium | Slice 4.6a (planned) | Slice 4.6a, then a coverage-validation pass |
| P5 | House view content sourcing. Lands via Slice 4.6e; real market-data feed integration is deferred (content is curated, not live). | Medium | Slice 4.6e (planned) | Slice 4.6e, then a market-data integration workstream |
| P6 | Investor onboarding workflow. Designed in the Slice 4.7 wireframes; build deferred to post-Slice-5. | Medium | Slice 4.7 design | Post-Slice-5 build |
| P7 | Cross-case search. Slice 6 read-only chat handles single-case Q&A only; cross-case search is deferred (see RAG note T7). | Low | Slice 6 scope | Post-MVP search workstream |
| P8 | S1 outcome: implement Record decision workflow. The locked accordion mockup showed a "Record decision" toolbar button; it was omitted rather than shipped as a fake-functional affordance (no real decision-recording workflow exists beyond the in-page Decision row, which persists to the case record). | Low | Accordion redesign | Post-MVP decision-workflow build |
| P9 | S2: define and implement a data export artifact beyond the slide deck PDF. The locked mockup showed an "Export" button alongside "Download slide deck"; it was omitted rather than shipped as a dead button, since no second artifact (holdings CSV, full-case JSON, etc.) is defined yet. | Low | Accordion redesign | Post-MVP export workstream |
| P10 | A2 skill file (`agents/a2_classification.md`) Worked Example is internally inconsistent: the prose states "Motilal 10%" but the Layer 1 output table gives Motilal no position_concentration driver. A2's position-threshold interpretation is the strict-greater-than convention (ADR 0005): above 10% flags, exactly 10% is a watch driver, below 10% is no driver. Even at exactly 10% Motilal would carry a watch driver, which still differs from the table's no-driver, so the verify fixture uses Motilal 9.8% (below 10%, no driver; within the skill's stated "approximately, between 8% and 11%") to reproduce the table's intended set. Verdicts are unaffected (all four PMS are Discuss via the wrapper driver); only the driver list differs by one entry. The next skill revision should make the Worked Example weights consistent with the ADR 0005 boundary convention. | Low | A2 classification (Slice 4.6a) | a2_classification skill revision (next A2 workstream / Slice 4.6a coverage-validation pass) |
| P11 | A2 skill file rubric ambiguity on complexity_premium severity: the Review row reads "complexity premium not earned and material" (implying escalate) but the Worked Example classifies Motilal's complexity_premium as a flag (Discuss). "Material" has no deterministic numeric signal available from E6. A2 maps E6 `complexity_premium_earned: "no"` to flag (Discuss) and `"mixed"` to watch (Monitor); a wrapper reaches Review only via a broken thesis (E6 `overall_verdict: "negative"`). The next skill revision should either define a deterministic "material" signal or align the rubric row with the Worked Example. | Low | A2 classification (Slice 4.6a) | a2_classification skill revision (next A2 workstream / Slice 4.6a coverage-validation pass) |
| P12 | Cross-asset-class issuer aggregation in the model portfolio framework: a product-stance question (not a missing feature). Should Samriddhi aggregate single-issuer exposure across asset classes (e.g. Bhatt's HDFC Bank equity 11.3% plus HDFC Bank FD 7% = 18.3% same-issuer)? A2 correctly does not aggregate, because the model portfolio framework specifies thresholds per asset class. See the detailed framing below the table. | Medium | A2 classification (Slice 4.6a) Checkpoint 2 review of Bhatt | Slice 7 product debt audit (evaluate as a product-stance question) |
| P13 | Should S2 (diagnostic) know when to call S1 (proposed_action)? A product-stance question surfaced by the Menon case (86.6% of liquid AUM in bank savings awaiting deployment): Menon is arguably an S1 "what should we do" case forced through S2 "what does the portfolio say." Two separable sub-questions: P13.a case-mode routing at intake; P13.b diagnostic-to-proposal loop when S2 surfaces material observations. See detailed framing below the table. | Medium | A2 classification (Slice 4.6a) Step 4 dry-run on Menon | Slice 7 product debt audit (P13.a and P13.b evaluated independently) |
| P14 | Should cash-adjacent debt instruments (senior-citizen FDs, short-tenor FDs, sweep deposits, liquid debt funds) be treated as cash-equivalent for diagnostic purposes? Surfaced by Iyengar (HDFC FD 27.3%, SBI FD 27.0%) and Sharma-S2 (HDFC FD 15.6%) hitting Review on the position-escalate threshold within debt. A2 correctly does not invent the distinction; the question is whether the model portfolio framework should differentiate cash-adjacent debt from structural debt. See detailed framing below the table. | Medium | A2 classification (Slice 4.6a) Step 4 dry-run on Iyengar and Sharma-S2 | Slice 7 product debt audit (M0 / model-portfolio-framework product-stance question) |
| P15 | Fund NAV regeneration methodology refinement (Option C joint solve). Risk-reward ships with Option A calibration (preserve Sharpe and vol; beta as calibrated output with R-squared in band). A methodologically richer Option C approach (per-fund joint solve over a (beta, sigma, alpha) triple with tolerance-based optimisation, plus a flag-and-rule path for funds where the joint constraint is infeasible) is the more faithful "preserve canonical stats AND pin benchmark-relative metrics" approach. Deferred for shipping efficiency. Future pickup candidates: the model-portfolio workstream (if its corridors require tightly-pinned beta), or a dedicated calibration-refinement workstream if computational budget permits. Cross-references ADR-0014. | Medium | Risk-reward (Step 3a sample sub-checkpoint) | Model-portfolio workstream or a dedicated calibration-refinement workstream |
| P16 | Sortino instability on ultra-low-vol fund categories. Liquid, Overnight, and Arbitrage funds produce numerically unstable Sortino ratios because downside deviation approaches zero. Pre-regeneration and post-regeneration values may differ materially without representing a real change in fund quality. The diagnostic vocabulary does not currently depend on intra-low-vol-category Sortino. A future workstream needing this comparison should design a category-specific methodology (for example a minimum-downside-deviation floor, or Sortino computed over a longer window where downside months exist). Cross-references ADR-0014. | Low | Risk-reward (Step 3a sample sub-checkpoint) | A future workstream that needs intra-low-vol-category Sortino |
| P17 | Risk-free-rate configurability. RF is the documented 5.25% repo rate (ADR-0012), sourced as a named constant in `risk-reward-stats.ts` (not from snapshot provenance, which carries no rf field; D2). Multi-RF evaluation (for example a 91-day T-bill baseline) is deferred until the model-portfolio workstream has a concrete need. | Low | Risk-reward (D2) | Model-portfolio workstream |
| P18 | Production data-onboarding. What a wealth advisory firm provides for Samriddhi in production (real holdings, NAV history, benchmark feeds) versus the dev-phase synthesised snapshot. The benchmark-specific subset is `DD1`; this is the broader onboarding question. | Medium | Risk-reward | Production-data-onboarding workstream |
| P19 | Bucket-level expected Sharpe / IR / Calmar corridors (the "what counts as good for an Aggressive bucket" judgement frame). Risk-reward ships the numbers; the corridors are model-portfolio's call. The schema is built to accept overrides; the thresholds are slot-but-not-filled. | Medium | Risk-reward | Model-portfolio workstream |
| P20 | Sleeve rollup phrasing refinement against model-portfolio expectations. Risk-reward's templated and LLM rollups are register-correct but model-portfolio may want phrasing tuned to its corridors. | Low | Risk-reward | Model-portfolio workstream |
| P21 | S1 (suitability-evaluation) cases do not consume risk-reward; the agent runs on S2 case-mode only. Deferred to a future workstream covering S1. | Low | Risk-reward | Future S1 workstream |
| P22 | E6 four-thesis decision tree enforcement. The first principles section (`docs/reference/pms_aif_first_principles.md`) specifies that PMS/AIF holdings are justified under one of four theses (MF-envelope constraint, non-public-market access, specific hedging need, customisation pooled vehicles cannot deliver), and says E6 should enforce this decision tree. E6's current implementation evaluates conventional dimensions (manager quality, fee structure, and similar) which are inputs to but not equivalent to the four-thesis evaluation. A future workstream should upgrade E6's prompt and output schema to produce structured per-holding thesis verdicts (thesis_applied, thesis_test_result, net_benefit_delta, recommendation). When that lands, the static `pms_aif_framework_notice` field on risk-reward stats records is superseded by the structured per-holding verdicts. Cross-references ADR-0018 and the first principles section. | Medium | Risk-reward (architectural audit) | Future E6-upgrade workstream |
| P23 | Live S2 pipeline does not generate LLM rollups. The live `runRiskRewardDeterministic` produces templated rollups only; the 6 backfilled S2 fixtures carry LLM-generated rollups from the Step 5 backfill. This is a deliberate cost-control choice. A future workstream desiring live LLM rollups must wire `runRiskRewardStats` (the LLM-capable orchestrator) into the live pipeline with proper WA12 handling at the runtime layer. Cross-references WA12, ADR-0020. | Low | Risk-reward (architectural audit) | Future workstream wiring live LLM rollups |
| P24 | Foundation documents as LLM-consumable reference material. Several working-chat foundation documents (the PMS/AIF Advisory Reference, the broader product thesis archive, and others) currently live out-of-repo as project knowledge. Committing them to `docs/reference/` with repo-harmonious naming makes them discoverable, version-controllable, and consumable by LLM agents via skill-file references. A future workstream should audit the working-chat foundation library, decide which documents are platform-doctrine (warrant in-repo presence) versus working-artifacts (stay project-knowledge), commit the platform-doctrine docs with naming aligned to `docs/reference/` conventions, and update relevant skill files to reference them where they would enrich agent reasoning. The `docs/reference/pms_aif_first_principles.md` commit in this workstream is the first example; future doctrine docs follow the same pattern. | Low | Risk-reward (close-out) | Future foundation-library audit workstream |
| P25 | G2 (SEBI gate) returns `requires_clarification` for every mutual-fund target (`mutual_fund`, `mutual_fund_debt`, and future MF categories) because SEBI MF scheme-level rules are not in the curated rule store; only PMS/AIF minimum-ticket rules are, and the deferral is documented inline in `g2-sebi.ts` ("future slice"). Consequence in the Samriddhi 1 pipeline: every MF proposal trips G2 clarify, which contributes to materiality firing and thus IC1 deliberation regardless of proposal stakes, and specifically blocks demonstration of IC1-skip for MF-target cases. A mandatory re-fire protocol for affected fixtures applies when the fix lands (see detail below). | High | s1-case-generation (cases iyengar, surana carry MF debt targets) | Dedicated G2 MF scheme-rule curation workstream (Capability Phase scope, own product thesis) |
| P26 | G1 (mandate gate) `target_category` enum was extended in s1-case-generation to add `mutual_fund_debt` (ADR-0025). Other product types remain absent: hybrid MF variants, international ETFs, REITs, InvITs, gold MFs, sovereign gold bonds, NCDs, gilts, commodity ETFs. As new proposal shapes surface in future Samriddhi 1 batches, the enum and the category-to-asset-class mapping must extend correspondingly, else new target types fail enum validation or are mis-modeled (the failure mode that affected debt MFs before this fix). Re-fire only cases whose `target_category` was previously mis-modeled. | Medium | s1-case-generation | Incremental (extend as new shapes are authored) or a dedicated G1 target_category audit workstream |
| P27 | Samriddhi 1 case coverage exists only for investors 01-05 (and Sharma A6 as the structural scaffolding case). Investors 06-13 have no Samriddhi 1 coverage, and ESOP-specific Samriddhi 1 scenarios are unbuilt. A future Samriddhi 1 batch (this workstream's shape, scoped to 06-13) should author them, applying this batch's learnings (action-centric routing, the G2 MF gap if still extant, the G1 `target_category` state at authoring time). | Medium | s1-case-generation | Future Samriddhi 1 case batch (investors 06-13); ESOP scenarios alongside |
| P28 | WA13 (Samriddhi 1 / Samriddhi 2 naming discipline) is enforced only by reviewer discipline and ad-hoc proofreading. The bare "S1 / S2" shorthand collides with the S1 / S2 synthesis-agent vocabulary and creates read-confusion; without automated enforcement, future ADRs, PR bodies, debt entries, code comments, and audit docs may drift back to it. WA13 was authored during s1-case-generation but nothing lints or CI-checks compliance. Unblocking fix: (A, recommended minimal) a pre-commit hook grepping changed files for `\bS1\b` / `\bS2\b`, whitelisting legitimate references (synthesis-agent names, file names like `s1_case_mode.md`, code identifiers like `runProposedActionPipeline`), blocking non-whitelisted matches with a WA13 pointer; (B) a CI check on PRs touching `docs/` / ADRs running the same grep; (C) both (pre-commit catches local, CI catches web edits / force-pushes). Cross-references WA13, ADR-0023. | Medium | s1-case-generation (authored WA13) | Tooling / repo-hygiene workstream (likely combined with other discipline-enforcement items) |
| P29 | Refresh cadence and assembly methodology for the real-world-sourced data (the 9 enriched snapshots plus `scripts/sector_map.json`) are documented as debt in the private `Samriddhi-AI-Data-Snapshots` repository (its `docs/debt/DATA_DEBT_LOG.md`, entries DM1 and DM2). The public repo references this for awareness; the substantive unblock-work happens in the private repo. Future workstreams in this public repo that depend on more recent market data or refresh-tooling integration will block on those private-repo debts. Per the contracted privacy boundary (ADR-0027), only real-world-sourced data is private; the fictional investor holdings/mandates and the Sharma verdicts are public, in-repo, and carry no such debt. Unblocking-fix: see private-repo DM1 (refresh cadence frozen) and DM2 (assembly methodology not documented). Cross-references: this repo's ADR-0027; private repo `DATA_DEBT_LOG.md` (DM1, DM2). Numbering note for the Slice 7 audit: numbered P29 rather than the next-free P25 because P25-P28 are reserved by the concurrent case-batch and Phase-A workstreams not yet merged to `main` (the gap closes when those branches land). The private repo uses a distinct DM-series (Data Mirror) prefix precisely so it does not collide with this log's Section 5 DD-series. | Low (cross-reference only; substantive debt lives elsewhere) | snapshot-data-extraction (Phase B) | Whichever workstream is triggered by a need for fresh market data; it pulls private-repo DM1 / DM2 unblocking into scope |
| P31 | Firm-onboarding implications of the data-management-layer concern: which custodians, what data-quality SLA, pre-compute vs agent-runtime, canonical-field communication. Forward-looking; no action until the first real-firm deployment conversation. | Medium | T-5.06 (time-series-performance) | TBD (first real-firm deployment) |

**P3 update, 2026-05, from T-5.07/T-5.08 workstream:** P3 splits into two
sub-questions, only one of which is being addressed in the T-5.07/T-5.08
workstream:

- **P3a (landing now via T-5.07):** Deterministic pairwise overlap
  computation. Per-pair overlap percentages at three resolution layers
  (top-5-stock, wrapper-level, sub-category) with explicit `resolution_layer`
  reporting on every emitted pair. No verdict layer, no judgment-grade
  language; the output is descriptive evidence. Ships as a sibling agent at
  `lib/agents/portfolio-overlap.ts` per ADR-0030.
- **P3b (remains deferred under P3):** Judgment-grade recommendations atop
  the deterministic computation, i.e. "this overlap is concerning" or "this
  overlap is acceptable given the mandate." Requires LLM synthesis to produce
  the interpretive layer and a verdict-rendering surface. Routed to a future
  Samriddhi 2 enrichment workstream.

The kickoff for T-5.07/T-5.08 separately proposed logging the verdict-layered
Analyst Reports surface ambition (kickoff scope (b)) as a new P-series entry
(P32). That ambition is the same content as P3b and is therefore tracked here
under P3 rather than as a new entry. No new P-series number allocated.

See ADR-0030 for the no-verdict-layer scope decision in T-5.07.

**P12 detail (product-stance question, not a missing feature).** Surfaced by the A2 Slice 4.6a Checkpoint 2 review of the Bhatt classifications. Concrete case: Bhatt holds HDFC Bank equity at 11.3% and HDFC Bank FD at 7% of liquid AUM. Same issuer, 18.3% aggregate exposure across two asset classes. A2 correctly classifies the FD as Maintain (the 7% position is below the 10% threshold within debt), because the model portfolio framework specifies thresholds per asset class and does not aggregate across them. The product question this surfaces: should Samriddhi's model portfolio framework include cross-asset-class issuer aggregation as a concentration dimension? Some Indian wealth firms do (treating bank exposure as equity plus deposits plus bonds combined); some do not. This was also surfaced in prior conversations with the product owner's colleagues. Routing: this is an M0 / model-portfolio-framework enhancement, not an A2 enhancement. Defer to the Slice 7 product debt audit pass, which should evaluate it as a product-stance question (what should Samriddhi do?) not as a missing-feature question (why does it not do this?). The Slice 7 audit pass is the right venue precisely because that audit is designed to evaluate what Samriddhi should do alongside what it currently does. P12 is an exemplar of that audit's value: A2 surfaced a real product question through the discipline of not inventing thresholds, and it is the first entry to explicitly invoke the product-stance framing so the Slice 7 pass has a template for other entries of the same kind.

**P13 detail (product-stance question).** Surfaced by the A2 Slice 4.6a Step 4 dry-run on the Menon case. Concrete case: Menon holds Rs 52 Cr (86.6% of liquid AUM) in bank savings, a post-exit settlement awaiting staged deployment. The S2 diagnostic surface correctly identifies cash drag at the portfolio level. But Menon's investor state is arguably an S1 (proposed_action) case at heart, "what should we do with this money", not an S2 (diagnostic) case, "what does the current portfolio say." Forcing Menon through S2 produces a faithful diagnostic, but the diagnostic itself is observing a portfolio that is in transit toward its real shape, not a portfolio whose shape is the subject of analysis. The product question this surfaces: when an S2 diagnostic surfaces material observations (cash drag at this magnitude, broken thesis on a major position, structural wrapper drift), should the diagnostic actively call S1, surface an S1-readiness hint, or pre-populate an S1 case draft from the S2 findings; and should the system have recognised at router time that an S1 case is the right intake before running the diagnostic at all. Two separable sub-questions: (a) case-mode routing at intake time; the current router accepts the declared case mode and does not ask whether some investor states are S1-fit at case opening (P13.a). (b) diagnostic-to-proposal loop; when S2 does run and surfaces material observations, should the output include S1-readiness hints, propose an S1 case draft, or remain purely observational per the current Lean MVP framing (P13.b). Routing: P13.a and P13.b are evaluated independently in the Slice 7 product debt audit; the answer to one does not force the answer to the other. Both are product-stance questions about how Samriddhi's case surfaces relate to each other, not A2-specific implementation questions. P13 is a second exemplar of the product-stance framing's value: A2 is not the right place to add S1-routing logic, but A2's discipline of not inventing behaviour surfaced a real product-architecture question that would otherwise have stayed invisible.

**P14 detail (product-stance question).** Surfaced by the A2 Slice 4.6a Step 4 dry-run on the Iyengar and Sharma-S2 cases. Concrete cases: Iyengar holds HDFC FD at 27.3% and SBI FD at 27.0% of liquid AUM, both senior-citizen-rate FDs in a conservative-medium-term mandate; A2 correctly classifies them as Review because they exceed the 15% position-escalate threshold within the debt asset class. Sharma-S2 holds HDFC FD at 15.6%, also above the 15% threshold, triggering Review. The product question this surfaces: are senior-citizen FDs (or similar cash-adjacent debt instruments: liquid debt funds, short-tenor FDs, sweep deposits) functionally cash-equivalent for diagnostic purposes? Some Indian wealth firms treat them that way, since concentrated FD positions in a conservative mandate are not the same risk shape as concentrated equity positions. The current model portfolio framework places FDs in debt, which is structurally correct (FDs carry duration and reinvestment risk that pure cash does not), but the threshold-application logic does not distinguish short-tenor cash-adjacent debt from longer-tenor structural debt. A2 correctly does not invent this distinction. Routing: same as P12 and P13, an M0 / model-portfolio-framework product-stance question deferred to the Slice 7 audit. The boundary between P14 and ADR 0006 is informative: ADR 0006 ships a narrow carve-out because the skill file already established the non-propagation rule for cash; P14 asks whether a similar differentiation should apply to cash-adjacent debt. The Slice 7 answer may be no (FDs stay in debt, position thresholds apply), yes (cash-adjacent debt gets its own treatment), or partial (only certain debt sub-categories such as senior-citizen FDs); A2 does not pre-empt that decision.

**P25 detail (mandatory re-fire protocol).** When the G2 MF scheme-rule curation lands: (1) identify affected case_ids by querying `db/fixtures/cases/*.json` for `target_category` in {mutual_fund, mutual_fund_debt, mutual_fund_equity}; (2) for each, clear the existing case row from the DB, re-run via `scripts/generate-s1-batch.ts <slug>` against the updated pipeline, overwrite the case JSON fixture, and re-record the stub set (delete the old stub directory first for a clean re-record); (3) commit each re-fired fixture in its own commit on the G2 workstream's branch; (4) document in the G2 workstream's PR body that iyengar and surana were re-fired against the updated G2, referencing this entry. Do NOT surgically inject G2 verdicts: G2 changes cascade through materiality, IC1, S1, and A1, so surgical injection produces mixed-provenance fixtures (explicitly considered and rejected during ideation). Estimated re-fire cost at time of writing: ~Rs 300-400 per case, ~Rs 600-800 for the iyengar+surana pair. Unblocking-fix definition: curate SEBI MF scheme-level rules into the G2 store, wire G2 to consume them for all MF target categories (`mutual_fund`, `mutual_fund_debt`, future variants), and add pass / clarify / breach tests. Cross-references: ADR-0023, ADR-0024, ADR-0025, and the inline "future slice" comment in `g2-sebi.ts`.

**P28 update, 2026-05, from T-5.07/T-5.08 workstream:** A further resolution arm
is added. P28 already enumerates three tooling arms — (A) pre-commit hook,
(B) CI check, (C) both. This adds (D), a mechanical rename of the fixture
schema enum values: `workflow: "s1" | "s2"` → `workflow: "samriddhi_1" |
"samriddhi_2"`. The drift vector (schema values bleed into prose because that
is what the data calls itself) is closed at the source rather than only at the
reviewer gate.

The rename touches:
- `prisma/schema.prisma` (the `workflow` column; plain `String`, no union to
  tighten).
- `db/seed.ts` (the `workflow: string` field and the seeding assignment).
- `lib/fixtures/new-case.ts` (the `"s2" as const` literal).
- All twelve fixture files under `db/fixtures/cases/`.
- Any test file hard-coding the enum value.

Out of scope for T-5.07/T-5.08 but bounded enough to ship as a small
standalone PR whenever someone touches the area. Arms (A)/(B)/(C) protect
against prose drift in new content; (D) removes the drift vector from the
existing schema. They are complementary, not alternatives; closing a tooling
arm plus (D) fully retires P28.

---

ID: P30
Description: The Samriddhi AI pipeline currently operates on fictional investors
  (Malhotra, Iyengar, Bhatt, Menon, Surana, Sharma plus future fictional
  additions). Their character bibles, holdings, mandates, and case fixtures
  are creative content authored for demonstration purposes. Per WA14, this
  fictional content is committable to the public repository.

  Any future transition to running cases on REAL investor data (real human
  clients with real portfolios) introduces a categorically different set of
  concerns that this workstream has NOT addressed. Before any real-client
  case is generated, the following must be evaluated and resolved:

  REGULATORY:
  - SEBI investment-adviser registration and the regulatory regime governing
    AI-assisted advisory analysis
  - India's Digital Personal Data Protection Act applicability and consent
    requirements
  - Fiduciary-duty implications when AI-generated case verdicts influence
    real client decisions
  - Audit trail and record-keeping requirements per SEBI advisor regulations

  DATA HANDLING:
  - Personally Identifiable Information (PII) cannot live in GitHub repos
    (public or private). Real client data requires encrypted-at-rest storage
    with role-based access, almost certainly self-hosted infrastructure or
    a regulated cloud provider with appropriate certifications.
  - Real character bibles will contain personally sensitive context (health,
    family dynamics, life events) that go beyond what WA14 covers; require
    additional handling discipline.
  - Real holdings data is licensed-and-PII (subject to vendor terms AND
    personally identifiable); double-sensitive.

  CONSENT AND AUTHORIZATION:
  - Explicit informed consent from each real client for AI-assisted advisory
    analysis, with clear disclosure of how the pipeline reasons and what
    outputs are produced.
  - Consent mechanism design (digital, in-person, witness requirements).
  - Right-to-withdrawal and data-deletion mechanisms.

  PIPELINE BEHAVIOR:
  - Whether agents' outputs (A1 challenges, IC1 deliberations, gate verdicts)
    require additional review before being shown to the advisor.
  - Whether materiality thresholds, IC1 deliberation depth, or governance
    gate strictness should differ between demo and real-client modes.
  - Whether case fixtures for real clients are even storable as fixtures, or
    must be ephemeral / encrypted / single-use.

  LIABILITY AND INSURANCE:
  - Professional indemnity insurance implications.
  - Liability allocation between the advisor, the system, the system's
    operator, and Anthropic.
  - Disclaimer and limitation-of-liability framing in client-facing outputs.

  OPERATIONAL:
  - Multi-user access control if multiple advisors use the system.
  - Audit logging beyond what current telemetry captures.
  - Incident response if real-client data is breached or mis-handled.
  - Backup and disaster recovery for real-client case data.

Severity: Critical-when-triggered. Not blocking current work because the
  current scope is fictional-only. The moment any real-client case is
  proposed, this debt entry becomes a hard blocker on that work.

Originating workstream: snapshot-data-extraction (this entry was authored
  alongside WA14 as part of the privacy-boundary work).

Target fix workstream: Real-client mode design workstream. This is likely
  not a single workstream but a phase of work comparable in scope to the
  entire lean MVP build to date. Includes legal review, regulatory
  consultation, infrastructure migration, pipeline mode-switching, consent
  flow design, audit logging, and operational runbook authoring.

Unblocking-fix definition: This debt does not have a single unblock-fix
  definition because the scope is too large to fix in one motion. The
  unblock-process is:
  (a) Decision to pursue real-client mode (product decision; not technical).
  (b) Legal and regulatory consultation establishing the compliance frame.
  (c) Dedicated workstream(s) addressing each concern category above.
  (d) Validation and audit before any real client is onboarded.
  No real-client case is generated until (a) through (d) are complete and
  documented.

Cross-references: WA14 (privacy boundary for data artifacts) is the
  fictional-data-era companion to this real-data-era debt. ADR-0027
  (snapshot data access) describes the privacy architecture for the
  fictional-data era; real-client mode will require a successor architecture.

Notes: This debt entry exists to ensure future contributors do not
  inadvertently propose running cases on real data without surfacing the
  full scope of preconditions. The framing is deliberately exhaustive so
  that even a casual encounter with this entry produces immediate awareness
  of the gap between current scope and real-client capability.

**P31 detail (firm-onboarding considerations).** When Samriddhi onboards a real wealth advisory firm, the firm's data sources and their canonical-shape mapping is a product concern, not just a technical one. Questions that will need answers at firm-onboarding time:

(a) Which custodians does the firm use, and do we have adapters / connectors?

(b) What is the firm's data-quality SLA, and how do we surface gaps to the advisor?

(c) Does the firm pre-compute enrichment fields, or are we computing at agent runtime?

(d) How do we communicate to the firm what canonical fields Samriddhi expects?

Linked to T18 (technical-debt facing) and ADR-0028 production deployment considerations.

