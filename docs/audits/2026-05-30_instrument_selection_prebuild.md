# Instrument-selection pre-build audit: selection funnel, sub-sleeve tilts, cadence, top-up join

**Date:** 2026-05-30
**Task:** T-5.12 (A3 So-What), pre-build audit for instrument-level deployment (Finding 1) and the paced-cadence under-deployed case (Finding 3).
**Branch:** `features/a3-so-what`, PR #11 (draft). Held at the Finding 5 boundary; Findings 4, 2, 5 committed (diagnostic foundation: per-investor targets, cash-as-funding, deploy-to-target).
**Mode:** Read-only. No code, no API, no commit. This resolves the data-and-reuse unknowns so the build encodes settled policy against known data.

## The build this audit supports

Instrument selection is a deterministic funnel (Stage 1 eligibility hard filters, Stage 2 ranking on TER and 3-year-plus risk-adjusted consistency, raw return as a tiebreaker only), emitting a 2 to 3 candidate shortlist per sub-sleeve that an LLM justifies and the advisor decides. Top up existing quality holdings first, add new by suitability. Sub-sleeve tilts by risk profile (equity cap-mix, debt credit-quality). Alternatives split (under 5 percent of portfolio: gold only; 5 percent or more: 5 percent gold plus non-gold AIF). Cadence is size and liquidity aware over a roughly two-week reference. The audit checks whether the data and structures exist to build this.

## Step 0: existing-coverage triage

| Question | Prior coverage | This audit |
|---|---|---|
| B selection-metric inventory | **Partially.** `2026-05-29_a3_credibility_completion.md` Q2 and `2026-05-29_a3_deployment_and_profile.md` Section A listed the mf_funds field set and per-sleeve catalog depth | Cite, and audit the delta: per-metric coverage counts, the 3-year-plus risk-adjusted set, and PMS/AIF/direct-equity metric coverage (not previously enumerated) |
| A counterfactual engine reuse | **Not previously audited** | Fresh (done) |
| C sub-sleeve granularity | **Not previously audited** (the category list was given; its tilt-sufficiency was not assessed) | Fresh (done) |
| D liquidity/volume for cadence | **Not previously audited** | Fresh (done) |
| E framework home | **Partially.** `2026-05-29_a3_deployment_and_profile.md` Section B established the mandate is the per-investor target home and carries no sub-sleeve structure | Cite, and audit the delta: where the sub-sleeve tilt extends |
| F top-up join | **Partially.** The persona-snapshot alignment utility (commit `54101ba`) measured holdings-to-universe match (22 of 32 strict matches) | Cite, and frame for the top-up-first policy |

## Section A: Samriddhi 1's counterfactual engine, learn-from not reuse

**Confirmed: conceptually adjacent, not reusable for sleeve-fill selection.** The engine is `lib/agents/ic1/counterfactual-engine.ts`, an IC1 deliberation sub-agent.

- **The question it answers** is proposal-modification, not universe-selection. It fires only when a single, already-decided proposal is under high-materiality committee deliberation, and it produces "alternative paths that specifically address the risks the Risk Assessor named" (`counterfactual-engine.ts:5-8, 92`). The worked discipline is to modify the one proposal (`:112`: "Smaller ticket is weak; Rs 2.0-2.2 Cr ticket holding equity at the 70 percent ceiling and preserving debt above floor is strong"). It never sees a candidate universe and never asks "fill this gap from the catalog."
- **Its candidate-handling and ranking structure** is none in the selection sense. The input (`CounterfactualEngineInput`, `:42-50`) is case context, synthesis, evidence, gates, materiality, and the Risk Assessor's risks; there is no instrument catalog. The output (`CounterfactualEngineOutput`, `:37-40`) is `{ framing: string[], alternative_paths: StructuredAlternative[] }`, where a `StructuredAlternative` is just `{ label, description }` (`:104, 120-138`). It is a single LLM call (`callAgent`, `:162`) that emits free-text options; there is no eligibility filter, no metric ranking, no shortlist drawn from the snapshot.
- **What is mirror-able** is the shape and the voice, not the mechanism: the options-not-decisions posture (`:115` "the Counterfactual Engine produces options; the Counterfactual Engine does not pick"), which is exactly A3's advisor-decides discipline; the structured label-plus-description output; and the concreteness rule (name the actual figures, `:112`), which maps onto the selection funnel's "cite the metric values" rationale requirement.

**Conclusion:** the selection funnel is new logic with no reusable engine. The counterfactual engine teaches the output contract and the institutional voice, nothing more.

## Section B: selection-metric data inventory

Coverage counts are over the full catalogs (`mf_funds` 1773, `pms.funds` 513, `aif["Fund Profiles"]` 162, `nifty500.companies` 500).

**Mutual funds (1773): RICH.** The ranking funnel runs fully here.
- TER 1746 of 1773 (98.5 percent), AUM 1750 (98.7 percent), Sharpe (top-level) 1759 (99.2 percent), Volatility 1769 (99.8 percent), `sebi_category` 1590 (89.7 percent).
- The 3-year-plus risk-adjusted set lives in `tier_b_stats`: `sharpe_3y` 1568 (88.4 percent), `sortino_3y` 1570 (88.6 percent), `calmar_3y` 1327 (74.8 percent). The 5-year horizon is half-covered (`sharpe_5y` 850, 47.9 percent), so 3-year is the primary ranking horizon and 5-year a secondary confirm.
- Track record: `Age (Yrs)` 1386 (78.2 percent) plus `Since Inception`. Raw returns: `1Y` 1537, `3Y` 1208, `5Y` 888 (tiebreaker use only, per design).
- Two coverage notes for the funnel: the top-level `Sortino` field is sparse (1318) but `tier_b_stats.sortino_3y` is rich (1570), so read risk-adjusted metrics from `tier_b_stats`, not the top-level columns; and `Beta` is effectively absent (47), which is irrelevant to the funnel. The 183 funds with no `sebi_category` need an explicit "uncategorized, excluded from category-filtered selection" rule (flagged in the prior audit).

**PMS (513): PARTIAL, no risk-adjusted ranking possible.** `identity.strategy_type` 513 (100 percent, all "equity", so every PMS candidate is an equity-sleeve instrument), `identity.inception_date` and `portfolio_age_years` 513 (track record rich), `identity.category` 482 (94 percent), `performance.returns_fund` 513 (raw returns present), `fee_structure.fixed_amc_pct` 421 (82 percent). But `scale.aum_cr` is sparse (218, 42.5 percent) and there are NO Sharpe/Sortino/Calmar (PMS is opaque, no `tier_b_stats`). So PMS ranking rests on fee plus track record plus raw returns plus strategy fit, with the opacity caveat and a soft AUM filter; the risk-adjusted-consistency stage cannot run. PMS selection is a higher-stakes, lower-confidence pick that leans advisor-select.

**AIF (162): THIN for ranking.** `SEBI Category` 162 (100 percent), `Min Commitment (Cr)` 161, `Mgmt Fee % (Primary)` 156 (96 percent), `Fund Tenure` 116 (72 percent), `Target Fund Size (Cr)` 107 (66 percent). There are NO risk-adjusted metrics and NO per-instrument performance in the profile (the AIF record is operational, not performance). AIF "selection" can filter on category and fee and operational terms but cannot rank on performance, so it is advisor-select by data necessity (compounding the persona-product mismatch, product debt P40). Category mix: Cat I 12, Cat II 49, Cat III 101.

**Direct equity (nifty500, 500): RICH fundamentals, no ranking-for-deploy need.** Full fundamentals (`market_cap_rs_cr` 500, `pe`, `roe_pct`, `roce_pct`, `return_3m_pct` 487, and more). Direct equity is a top-up-of-existing surface, not a primary deploy sleeve (deployment is fund-based), so the funnel's ranking does not target it; the fundamentals support a top-up suitability read.

## Section C: sub-sleeve granularity for the risk-profile tilts

**Both tilts are fully data-driven from `sebi_category`. RICH.**

- **Equity cap-mix:** the categories distinguish every tilt the design needs: `Large Cap Fund` (33), `Mid Cap Fund` (30), `Small Cap Fund` (30), `Large & Mid Cap Fund` (33), `Flexi Cap Fund` (40), `Multi Cap Fund` (31), `Focused Fund` (28), plus `Value Fund`, `Contra Fund`, `Dividend Yield Fund`, `ELSS`, and the index/ETF families. So aggressive-leans-small/mid, moderate-large/mid, conservative-large-only is implementable directly from the category.
- **Debt credit-quality and duration:** the categories distinguish both axes. Credit quality: `Gilt Fund` and `Gilt Fund with 10 year Constant` (sovereign), `Corporate Bond Fund` and `Banking and PSU Fund` (high-grade), `Credit Risk Fund` (credit risk). Duration: `Overnight`, `Liquid`, `Ultra Short Duration`, `Low Duration`, `Short Duration`, `Medium Duration`, `Medium to Long Duration`, `Long Duration`, `Dynamic Bond`. So conservative-high-grade/sovereign versus aggressive-may-include-credit-risk is implementable, and a duration tilt is available if wanted.

No sub-sleeve granularity is missing for the stated tilts; neither tilt falls back to category-level-only.

## Section D: liquidity and volume data for cadence

**Liquidity proxy present; daily traded volume absent. Cadence is size and proxy aware, not true-volume aware.**

- Direct equity: NO daily traded volume (`volume`, `traded_volume`, `avg_volume` all 0 of 500). `market_cap_rs_cr` is present for all 500, which is a usable liquidity proxy (large-cap reads as more liquid).
- Funds: AUM is the liquidity proxy, present and usable (`AUM (Cr)` 1750 of 1773 for MF, 98.7 percent; PMS `scale.aum_cr` sparse at 42.5 percent).
- Classification: liquidity proxy present-and-usable (AUM for funds, market cap for direct equity); daily volume absent. The cadence computation (corpus size, instrument liquidity, tranche count over the roughly two-week reference) can be built on corpus size plus the AUM and market-cap proxies; it cannot be true-volume-aware. This is a fallback, not a blocker: pace by corpus size and the size proxy, and flag that turnover-based pacing is not available from this snapshot.

## Section E: sub-sleeve and house-view framework home

**The mandate is the natural home; the sub-sleeve tilt is net-new structure that extends it cleanly.** `Mandate` (`structured-mandates.ts:23-27`) carries `bands: AssetClassBand[]` (the four asset-class sleeves), `wrapper_count_ceilings`, `position_concentration_ceilings`, `sector_exclusions`, `instrument_exclusions`, and provenance. There is no sub-sleeve field today: `AssetClassBand` is `{ asset_class, min_pct, max_pct, target_pct? }` (`:1-11`), an asset-class-level band with no cap-mix or credit-quality breakdown.

So the sub-sleeve tilt mapping is net-new structure, but it extends the mandate rather than replacing it, exactly as ADR-0032 extended `AssetClassBand` with the optional `target_pct`. The foundation slice would add an optional sub-sleeve tilt to the mandate (for example an optional `equity_cap_tilt` / `debt_credit_tilt`, or a `sub_sleeve_targets` array keyed by sub-category), defaulting to a sensible per-risk-profile rule when absent, so the future full model-portfolio framework (product debt P43) formalizes the same field rather than introducing a parallel one. The mandate structure is shaped to carry it.

## Section F: existing-holdings to universe join for top-up

**Reliable for the transparent sleeves, falls back for the opaque ones.** The join tool exists: `scripts/verify-persona-snapshot-alignment.ts` (commit `54101ba`) and the shared matcher `lib/agents/operational-scope.ts` (`findConsistentMatch`, the category-guarded strict join). Its measured result across the five personas was 22 of 32 checkable holdings strict-matched, sleeve-dependent:

- Mutual-fund and listed-equity holdings match reliably, so "which of this investor's existing holdings are in this sleeve, and are they matchable for a top-up" is answerable, and top-up-first is expressible, for the equity-fund, debt-fund, and direct-equity sleeves.
- PMS and AIF holdings frequently do not match a catalog record (the persona-product naming mismatch, product debt P40; for example Bhatt's specific PMS variants, and no Avendus Cat III AIF exists), so top-up of an opaque wrapper falls back to add-new or advisor-select. This compounds with the thin PMS/AIF ranking metrics from Section B: the opaque sleeves are advisor-select on both counts.

So the top-up-first policy runs cleanly on the transparent sleeves (where the gap-closing deploy mostly lands anyway), and degrades gracefully to add-new or advisor-select on the opaque ones.

## Build-readiness read

| Build piece | Readiness | Trichotomy |
|---|---|---|
| Selection funnel, mutual funds | **Ready to build.** TER/AUM/Sharpe/`sebi_category` at 89 to 99 percent; the 3-year risk-adjusted set (`sharpe_3y`/`sortino_3y`/`calmar_3y`) at 75 to 88 percent via `tier_b_stats`. Fallbacks: read risk-adjusted from `tier_b_stats` not the sparse top-level columns; 3-year primary, 5-year secondary; an "uncategorized 183" exclusion rule. | New logic (no selection machinery exists anywhere). Wiring: thread the per-sleeve catalogs into A3 or a new selection module (A3 today reads metrics/evidence/operational for held holdings, not the full selectable universe). |
| Selection funnel, PMS | **Partially blocked.** Strategy/track-record/returns/fee support a filter and a coarse rank, but no risk-adjusted stage (no `tier_b_stats`) and sparse AUM (42 percent). All 513 are equity strategy, so a PMS pick is an equity-sleeve instrument. | New logic, but the funnel degrades to fee-plus-track-record-plus-returns and leans advisor-select. Data gap is structural (PMS opacity), not fixable here. |
| Selection funnel, AIF | **Blocked for ranking, advisor-select by design.** Category/fee/operational present, no performance metrics, plus the P40 mismatch. | Advisor-select. The funnel filters on category and surfaces, it does not rank. |
| Sub-sleeve tilt framework | **Ready to build.** `sebi_category` fully distinguishes equity cap-mix and debt credit-quality/duration (Section C). | New structure (extend the mandate, ADR-0032 pattern) plus new logic (the risk-profile-to-tilt rule). No data work. |
| Alternatives split | **Partially blocked.** Gold is deployable via the commodity-ETF route (68 gold/commodity funds in `mf_funds`); the non-gold AIF universe exists (162, Cat III-heavy) but is advisor-select per Section B and F. | New logic for the under-5-percent / 5-percent-plus split; gold side data-ready; AIF side advisor-select by design. |
| Cadence | **Partially blocked (usable).** Corpus size plus AUM and market-cap proxies support a size-and-proxy-aware cadence; daily traded volume is absent, so true-volume pacing is not possible. | New logic. Data supports the proxy path; flag the volume absence as a fallback, not a blocker. |
| Top-up join | **Ready for transparent sleeves, degrades for opaque.** The strict matcher reliably answers top-up for MF and listed holdings; PMS/AIF fall back to add-new or advisor-select (P40). | Wiring (reuse the existing matcher) plus new logic (top-up-first policy). |

**Overall:** the build is largely new logic, not data work. The selection metrics, the sub-sleeve categories, and the liquidity proxies are present in the snapshot; the gaps are coverage percentages handled by fallbacks, plus two genuine absences (daily traded volume, and risk-adjusted metrics for the opaque PMS/AIF wrappers) that the design already routes around (proxy-based cadence, advisor-select for opaque). The one wiring piece is giving the selection step access to the full per-sleeve catalogs, which A3 does not currently receive. The one new-structure piece is the sub-sleeve tilt on the mandate, which extends the existing framework rather than replacing it.

## Stops

No build started, no API call, no policy decided. Holding at the Finding 5 boundary; PR #11 stays in draft.
