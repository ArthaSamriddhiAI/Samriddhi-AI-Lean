# A3 deployment and profile audit: instrument universe, risk-profile targets, cash-as-funding

**Date:** 2026-05-29
**Task:** T-5.12 (A3 So-What), pre-build audit for Finding 1 (instrument-level deployment) and Finding 3 (the under-deployed-investor case).
**Branch:** `features/a3-so-what`, PR #11 (draft). Held at the Finding 2 boundary; Finding 2 committed through `2560996`.
**Mode:** Read-only. No code, no API, no merge. This is the WA22 versioned deliverable that lets the primary sequence the Finding 1 plus Finding 3 build.

## The design this audit supports

There is ONE operation: close the gap between the current allocation and the target allocation. Trimming overweights and deploying cash are the same operation at different points on a spectrum (a low-cash drifter versus Arjun Menon at 86% cash). Two principles follow: cash is dry powder (excluded from concentration, used to fund the under-allocated side of the gap), and the engine is unified while the narration is situated (portfolio-construction voice for a heavily-under-deployed new investor, rebalancing-discipline voice for an established drifter). For a heavily-under-deployed investor the target cannot come from the near-empty current portfolio; it must come from the risk-profile and goals classification. Large deployments are paced (entry-risk-aware). A stated-versus-observed risk divergence is surfaced to the advisor as framing guidance, never as client-facing content.

The audit investigates whether the data and machinery for these exist, are reachable from A3 in the Samriddhi 2 diagnostic pipeline, or must be built.

## Step 0: existing-coverage triage

| Audit question | Prior coverage | This audit |
|---|---|---|
| A.1 universe shapes/paths | **Partially**, by `2026-05-29_a3_credibility_completion.md` Q2 (censused mf_funds/pms/aif/nifty500/unlisted_equity catalogs and per-instrument metadata) | Cite, and audit the delta: per-sleeve coverage depth, the gold nuance, the uncategorized-funds gap |
| A.2 selection metadata | **Partially**, same Q2 (quoted the mf_funds field set) | Cite, confirm, and frame as selection-relevant |
| A.3 holdings as a subset of the universe | **Not previously audited as such.** The persona-snapshot alignment utility (Finding 2 prep, commit `54101ba`) measured it incidentally | Report from the utility's evidence |
| A.4 existing instrument-selection machinery | **Not previously audited** | Investigate fresh (done) |
| B.1 to B.4 risk-profile/goals schema and target derivation | **Not previously audited.** `2026-05-28_t512_a3_so_what.md` quoted `MODEL_BANDS` and the `assetClass` shape but did not ask whether the target is risk-profile-derived | Investigate fresh (done) |
| C.1 to C.2 cash treatment in concentration | **Partially**, by `2026-05-28_t512_a3_so_what.md` (quoted `positionFlags` and the `cashDeployment` block) | Cite, and audit the delta: the dual-treatment bug and the discriminant cleanliness |
| C.3 redeployment funding shape | **Partially**, by `2026-05-29_a3_credibility_completion.md` Q1 (analysed `computeRedeployment` for the leftover-to-cash behaviour, Finding 4) | Cite, and audit the delta: whether cash-as-a-funding-source is a natural extension |

One prior-audit claim is corrected below: a fresh read of `computeMetrics` shows the diagnostic targets A3 consumes come from the flat `MODEL_BANDS`, not the per-investor mandates. See Section B.

## Section A (Finding 1): the investable instrument universe and candidate selection

### A.1 Per-sleeve coverage

Top-level snapshot keys (`fixtures/snapshots/enriched/snapshot_t0_q2_2026.json`): `_meta, mf_funds, aif, pms, nifty500, unlisted_equity, industry_reports, macro, snapshot_metadata, indices, fx`. There is no single universe table; each catalog is a per-product list.

Catalog sizes: `mf_funds` 1773, `pms.funds` 513, `aif["Fund Profiles"]` 162, `nifty500.companies` 500, `unlisted_equity` 100 (a list).

`mf_funds` is the workhorse and gives genuine per-sleeve depth (by `sebi_category`, 46 distinct categories):

- **Equity:** rich. Large Cap 33, Mid Cap 30, Small Cap 30, Flexi Cap 40, Multi Cap 31, Large & Mid Cap 33, Focused 28, ELSS 40, plus Equity Index Funds 217 and ETFs-Equity 186.
- **Debt:** rich, roughly 464 funds across the debt family. Gilt 28, Liquid 48, Overnight 34, Money Market 26, Debt Index 99, ETFs-Debt 27, plus corporate-bond and short/low-duration categories.
- **Hybrid:** rich, roughly 166. Dynamic Asset Allocation or Balanced 36, Aggressive Hybrid 29, Multi Asset Allocation 28, Arbitrage 32, Equity Savings.
- **Gold and commodity:** present but thin and indirect. ETFs-Commodity 35; gold exposure is also reachable through Multi Asset funds. There is no standalone physical-gold or sovereign-gold-bond selectable catalog: "deploy into a gold ETF" is expressible, "recommend an SGB tranche" is not.
- **Cash:** not a deploy target. Cash is the funding source, not a sleeve to buy into (see Section C).

**A coverage gap to flag:** 183 of the 1773 `mf_funds` rows carry no `sebi_category` value. Any category-filtered candidate selection silently excludes those 183, or must handle the empty category, so the selector needs an explicit "uncategorized" policy rather than assuming every row is classifiable.

**Alternatives is the thinnest deploy sleeve.** The AIF catalog (162) exists but the persona-product naming mismatch (product debt P40) means specific holdings rarely match a catalog record; gold is only the commodity-ETF route above; there is no REIT catalog (REIT appears as a holding `subCategory`, not a selectable list). Deploying into Alternatives via instrument selection is materially harder than into Equity, Debt, or Hybrid.

`pms` (513) and `aif` (162) carry their own rich metadata (covered in `2026-05-29_a3_credibility_completion.md` Q2 and the operational-scope work in Finding 2), but they are opaque wrappers: selecting one to deploy into is a higher-stakes recommendation than a transparent fund.

### A.2 Selection-relevant metadata

`mf_funds` rows carry everything a selector needs to choose among candidates in a sleeve (sample row key set): `sebi_category` (sub-type fit), `TER (%)` (cost), `AUM (Cr)` (size/liquidity proxy), `Sharpe`, `Sortino`, `Volatility`, `VaR (H)`, `VaR (I)`, `Beta` (risk-adjusted performance), multi-period returns (`1M, 3M, 6M, YTD, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 15Y` plus calendar years 2016 to 2025), `Benchmark Index` and benchmark returns, cap splits (`LargeCap %`, `MidCap %`, `SmallCap %`), `No. Holdings`, `P/E`, `P/B`, `Exit Load (JSON)`, `Top 5 Holdings (JSON)`, `Top 5 Sectors (JSON)`, and `tier_b_stats`. This is enough for a cost-aware, category-fit, performance-and-liquidity-aware selection without inventing anything.

There is no explicit suitability or recommendation flag on a fund (no "advisor-approved" boolean). Suitability is inferable (category fit to sleeve, TER versus peers, AUM floor for liquidity) but not pre-stamped.

### A.3 Are current holdings a subset of the universe?

Partially, and the match rate is sleeve-dependent. The persona-snapshot alignment utility (`scripts/verify-persona-snapshot-alignment.ts`, commit `54101ba`) measured this directly across the five Samriddhi 2 personas: 32 checkable holdings, 22 strict category-consistent matches, 3 category-violations, 7 non-matches. Mutual-fund and listed-equity holdings mostly match a catalog record (so "top up an existing mutual-fund holding" is expressible against the universe); specific PMS and AIF product variants frequently do not (product debt P40). This is the load-bearing input to the top-up-versus-add-new policy decision, which this audit does not make.

### A.4 Existing candidate-selection or recommendation logic

There is none that is reusable. The Samriddhi 1 proposed-action pipeline evaluates a single, already-chosen instrument; it does not select one. Evidence: `routeProposedAction(holdings, proposal)` (`lib/agents/router.ts:212`) takes holdings and a proposal, never a candidate universe; the `Proposal` type carries a single `target_instrument: string` already set by the caller (`lib/agents/proposal.ts:59-69`); the scope-builders curate snapshot context for that one named instrument and do not rank a pool (`lib/agents/case/scope-builders.ts` header and `buildE6Scope`). The E6 and E7 `recommended_alternatives` fields exist (`lib/agents/e6-wrappers.ts:40`, `lib/agents/e7-mutual-fund.ts:52`) but are free-text LLM suggestions, explicitly not manufactured against the snapshot (`e7-mutual-fund.ts:160` "Do not manufacture alternatives"), and nothing matches those strings back to catalog records.

**Conclusion for Finding 1:** instrument selection is new logic that exists nowhere. Reusable adjacent pieces: the strict name matcher (`lib/agents/operational-scope.ts` `strictNameMatch` / `findConsistentMatch`, and the sibling in `wrapper-scope.ts`) for detecting whether a chosen candidate is already held (top-up detection); and the sleeve-level gap math in `computeRedeployment` (`lib/agents/a3-so-what.ts:515`) as the layer that decides how much to deploy per sleeve before instruments are picked within it.

## Section B (Finding 3): risk-profile and goals classification, and target allocation

### B.1 Where the classification lives

Two places. The Prisma `Investor` model (`prisma/schema.prisma`) and its seed (`db/seed.ts` INVESTORS, lines 338 onward) carry per-investor classification fields: `riskAppetite`, `timeHorizon`, `modelCell`, `liquidityTier`, `structureLine`, plus `liquidAumCr`, `location`, `profileMd`. Value space across the six personas:

- `riskAppetite`: "Aggressive" (malhotra, menon, surana), "Aggressive · stated" (bhatt, sharma), "Conservative" (iyengar).
- `timeHorizon`: "Over 5y" (most), "3-5y operational" (iyengar).
- `modelCell`: "aggressive_long_term" (five of six), "conservative_medium_term" (iyengar).
- `liquidityTier`: "Essential", "Secondary", "Essential (deep, transitional)" (menon).

Separately, per-investor target bands live in `MANDATES_BY_INVESTOR` (`db/fixtures/structured-mandates.ts`), serialized to `Investor.mandateJson`. These ARE risk-appropriate and differ by investor: iyengar conservative (Equity 25-45, Debt 45-65, Alt 0-10, Cash 3-10), menon widened alternatives (Equity 55-70, Debt 15-30, Alt 5-20, Cash 2-10), the aggressive personas at the foundation default (Equity 60-70, Debt 20-30, Alt 5-10, Cash 2-5).

### B.2 How and where it is used (and the load-bearing correction)

The diagnostic targets A3 reads do NOT come from the per-investor mandate. `computeMetrics(holdings, snapshot, { riskAppetite, liquidityTier })` (`lib/agents/portfolio-risk-analytics.ts:235`) receives only `riskAppetite` and `liquidityTier`, not the mandate, and `buildAssetClassBlock` (`portfolio-risk-analytics.ts:418-424`) reads the flat `MODEL_BANDS` constant (`:26-31`, Equity 65/60/70, Debt 25/20/30, Alternatives 7/5/10, Cash 3/2/5). So the `assetClass[*].{targetPct, band}` that A3's `computeRedeployment` consumes is one-size-fits-all, identical for every investor.

This corrects a claim that surfaced during the audit: the per-investor mandate is NOT what the Samriddhi 2 metrics use. The mandate is consumed by Samriddhi 1's G1 governance gate (`lib/agents/pipeline-case.ts` loads `investor.mandateJson` and G1 validates the proposal against it), not by the Samriddhi 2 diagnostic. This is the same "exists but is unreachable from A3" shape that Finding 2 hit with M0.IndianContext.

Two consequences:
- `riskAppetite` IS reachable in the Samriddhi 2 pipeline, but only for the HHI concentration ceiling: `resolveHhiTier(investor.riskAppetite)` (`portfolio-risk-analytics.ts:195-202` via `:280`) sets `bucketTier` and `bucketCeilingHhi` (Conservative 0.20 up to Ultra-Aggressive 0.35, `HHI_CEILING_BY_TIER :42`). It does not touch the allocation target.
- Because the target is the flat aggressive-leaning `MODEL_BANDS`, the Samriddhi 2 diagnostic currently mis-targets non-aggressive investors. Mrs. Lalitha Iyengar (conservative, mandate Equity 25-45) is diagnosed against a 60-70 equity target. This is a latent correctness issue independent of the under-deployed case, and it interacts directly with Finding 3.

`modelCell` is passed only as a narrative string to the evidence agents and as `bucket_tier` in the stitched case metadata (`pipeline.ts:201, 264`); it does not drive any target.

### B.3 Can it produce a target allocation?

For an established investor: a risk-appropriate target SOURCE exists (the per-investor mandate), but it is unreachable from A3 today and is authored per investor rather than derived. For a fresh, heavily-under-deployed investor with no mandate authored, nothing derives a target from the classification fields. There is no function of the shape `deriveTarget(riskAppetite, timeHorizon, liquidityTier) -> bands`; the only general-purpose target is the flat `MODEL_BANDS`. So deploy-toward-target for a fresh investor needs one of: wiring the existing mandate through to A3 (when a mandate exists), or a new risk-profile-to-bands mapping (when it does not). Both are real work; neither exists in the A3 path now.

### B.4 The stated-versus-observed divergence

It exists, is reachable, and is already consumed by A3, but it is an LLM judgment rather than a deterministic computation. E4 (`lib/agents/e4-behavioural.ts`, an LLM agent, imports `callAgent`) emits `stated_vs_revealed_divergence` (`{ direction, magnitude, implication }`), which is portfolio-level, not per-holding (`a2-classification.ts:538` notes it is investor-level). A3 already reads it in `suitabilitySignal` (`a3-so-what.ts:404-406`), and the stitcher derives a `stated_revealed_divergence` pre-observation from it (`stitcher.ts:208-217`). So for the "framing guidance to the advisor" use, A3 has the signal in hand; the build is to route it into advisor-facing framing (not client-facing content) rather than to source it.

The caveat: it is E4's qualitative read, present only when E4 fired and magnitude is above "minor". A deterministic backstop (compare stated `riskAppetite` to revealed equity share) does not exist; if the framing signal must be reliable for every case (including ones where E4 did not flag it), a small deterministic computation would be the complement. The persona bibles (`profileMd`) describe the divergence in prose (menon: "Stated risk appetite: aggressive ... cash 86.6%"), but it is not machine-parseable.

## Section C (both): the cash-as-funding correction

### C.1 Current treatment

The diagnostic treats cash two ways at once, and one of them is wrong for the deployment model. The position-flag loop (`portfolio-risk-analytics.ts:286-293`) flags ANY holding with `weightPct >= POSITION_FLAG_PCT` (10) or `>= POSITION_ESCALATE_PCT` (15), with no asset-class exclusion. Arjun Menon's 86.6% savings balance therefore produces an "escalate" position flag, which A3's `buildReconciledDecisions` reads (`a3-so-what.ts:446` via `metrics.concentration.positionFlags`) to set `over_concentrated = true`, yielding a trim-toward-the-10%-ceiling on cash. That is the Menon absurdity, confirmed at file:line.

At the same time, the metrics ALREADY model cash as a deployment gap: `cashSharePct`, `deploymentGapPct = max(0, cashSharePct - MODEL_BANDS.Cash.max)`, and `cashDragFlag` (`portfolio-risk-analytics.ts:318-321`), surfaced as the `cash_drag` pre-observation (`stitcher.ts`). So the correct framing already exists alongside the wrong one; the defect is the dual counting (cash is simultaneously a concentration to trim and a gap to fund), not a missing concept.

### C.2 Is the cash discriminant clean enough to exclude?

Yes, for true cash. `AssetClass` includes "Cash" and the only cash `subCategory` is "savings" (`db/fixtures/structured-holdings.ts:20, 54`); every savings holding is `assetClass: "Cash"`. Excluding `assetClass === "Cash"` from the position-flag concentration view is a clean, reliable operation.

One boundary to note, not to fix here: fixed deposits are classified `assetClass: "Debt"`, `subCategory: "bank_fd"` (for example Mrs. Iyengar's two FDs at 27.3% and 27.0%), not Cash. So a large FD still earns a position flag as a Debt position. Whether cash-adjacent debt (senior-citizen FDs, sweep deposits, liquid funds) should be treated as deployable-like cash is the already-logged product-stance question P14; it is out of scope for the cash-as-funding correction, which cleanly covers only the Cash sleeve.

### C.3 Is cash-as-a-funding-source a natural extension of the redeployment engine?

Mostly yes, with one invariant change to manage. `computeRedeployment` (`a3-so-what.ts:515-541`) today computes `freed` from trims and exits only (`freed += weight - 10` for a trim, `+= weight` for an exit, lines 516-521), then deploys `freed` across the non-Cash sleeves up to their upper bands (`ASSET_CLASSES.filter(c => c !== "Cash")`, line 524) and parks any remainder as leftover-to-cash. The target-side logic (gap to upper band per sleeve, proportional fill) is exactly the gap-closing the unified engine wants and does not change.

The extension is to add deployable cash as a second funding source alongside `freed`: roughly `fundable = freed + max(0, cashActual - cashFloor)`. This is a localized change to the funding scalar, but it shifts two things the build must handle deliberately:

- The books-close invariant changes from "trims + exits = deployments + leftover" to "trims + exits + deployable cash = deployments + leftover". The deterministic verify (45-plus assertions) asserts the current invariant and must be updated in lockstep.
- The "leftover to cash" semantics invert for a cash-funded deployment. When cash is the source, undeployed capital staying in cash is not leftover, it is the starting state; the residual concept needs rethinking (probably "cash drawn down by X, with Y still to deploy once capacity or candidates open").

So the engine shape is right and the change is contained, but it is not purely additive: it touches the invariant and the leftover narrative, and the cash floor (target 3%, ceiling 5% from `MODEL_BANDS.Cash`) becomes load-bearing as the "how much cash is dry powder versus working balance" line.

## Blast-radius read

Five build pieces, classified small / medium / large, and tagged as data work (something needed does not exist), wiring work (exists but unreachable from A3), or new logic (exists nowhere):

1. **Cash-as-funding correction.** SMALL to MEDIUM, new logic on existing deterministic code. Excluding `assetClass === "Cash"` from the concentration position-flag view is a few lines against a clean discriminant; adding deployable cash to `computeRedeployment` is a contained change to one funding scalar. The cost is not the code volume but the invariant: the books-close assertion and the leftover-to-cash narrative both change, so the verify and the narration prompt move together. P14 (cash-adjacent FDs) stays out of scope.

2. **Instrument selection within a sleeve.** LARGE, new logic. Nothing in the codebase ranks or picks instruments from the universe; this is built from scratch. The data supports it well for Equity, Debt, and Hybrid (rich `mf_funds` metadata: TER, category, risk-adjusted performance, AUM, exit load), is thin for Alternatives (AIF persona-mismatch per P40, gold only via commodity ETFs, no REIT catalog), and needs an explicit policy for the 183 uncategorized funds. The top-up-versus-add-new policy (reuse the strict matcher to detect already-held candidates) is an open decision the primary will make. Largest single piece of the build.

3. **Risk-profile-to-target mapping.** MEDIUM, mixed wiring and data work. For established investors a risk-appropriate target exists as the per-investor mandate but is unreachable from A3 (wiring work, the Finding 2 pattern: thread `Investor.mandateJson` into the Samriddhi 2 metrics or into A3 directly). For fresh under-deployed investors no derivation from classification fields exists (data/new-logic work: author a mandate or build a `riskAppetite`-to-bands mapping). A latent correctness issue rides along: the flat `MODEL_BANDS` mis-targets conservative investors (Mrs. Iyengar) in the current Samriddhi 2 diagnostic regardless of the deployment build, so fixing the target source has value beyond Finding 3.

4. **Paced deployment.** MEDIUM, new logic with a reusable pattern. The glide-path stepper (`buildGlidePath`, `a3-so-what.ts:479`) is the structural precedent (multi-step, trigger-aware), but it paces trims down to a ceiling; entry-risk-aware pacing for a large deployment (tranche count as a function of corpus size and target-instrument liquidity over a short window, working default thinking roughly two weeks) is a new computation. The liquidity and AUM data to inform it exists in the universe metadata.

5. **Stated-versus-observed framing signal.** SMALL, exists and is reachable. E4's `stated_vs_revealed_divergence` is already consumed by A3 (`suitabilitySignal`); the build routes it into advisor-facing framing guidance (not client-facing content) in the narration, with an optional small deterministic backstop (stated `riskAppetite` versus revealed equity share) if the signal must be present even when E4 did not flag it. Mostly a narration and prompt change.

**Sequencing read for the primary.** Piece 1 (cash correction) and piece 3-wiring (reach a real target) are the unlocks: without them, Menon is mis-diagnosed (cash trimmed) and non-aggressive investors are mis-targeted, so the deployment story is wrong before any instrument is picked. Piece 2 (instrument selection) is the largest and most independent, and its top-up-versus-add-new policy is a prerequisite decision. Pieces 4 and 5 are refinements that make the deployment paced and the conversation well-framed once the gap-closing and the target are correct.

## Stops

No build started, no API call, no policy decision made (top-up-versus-add-new and exact cadence are left to the primary). Holding at the Finding 2 boundary; PR #11 stays in draft.
