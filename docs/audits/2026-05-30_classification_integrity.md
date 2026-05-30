# Classification-integrity audit: full-path trace of the entire snapshot universe (before the WA12 backfill)

**Date:** 2026-05-30
**Task:** T-5.12 (A3 So-What), read-only classification-integrity audit before the WA12 paid backfill of the expanded equity + debt framework.
**Branch:** `features/a3-so-what`, PR #11 (draft). The expanded framework is committed (`4f538b8`) and free-previewed; the preview surfaced a real Layer-2 logic bug (passive gilt-index ETFs bucketing as credit-risk, fixed by scoping `DEBT_2D_CATEGORIES`). This audit asks whether that class of error is fully eliminated, universe-wide, before any spend.
**Mode:** Read-only on BOTH repos (this code repo and the snapshot data repo). No code change, no API call, no fixture write. All corrections are PROPOSED, not written. The only artifact written is this doc.
**Method note:** The full-path trace was produced by running the REAL classification functions (`lib/agents/instrument-selection.ts`) over the entire `t0_q2_2026` snapshot universe in a throwaway read-only script (deleted, never committed). Every count below is code-traced, not eyeballed.

WA13: Samriddhi 1 / Samriddhi 2 written in full in prose; code symbols as-is.

## Step 0: existing-coverage triage

| Question | Prior coverage | This audit's delta |
|---|---|---|
| MF field coverage | **Established.** `docs/audits/2026-05-30_instrument_selection_prebuild.md` Section B: TER 98.5%, AUM 98.7%, `sebi_category` 1590 of 1773, the 3-year risk-adjusted set 75 to 88% via `tier_b_stats`. Flagged 183 funds with no `sebi_category`. | Cite. Trace each category through the live code to a bucket and check the result is correct, which a coverage census does not do. |
| Sub-sleeve granularity | **Established (data sufficiency).** Prebuild Section C: cap-mix and credit/duration "fully data-driven from `sebi_category`, RICH." | Cite, then test the LOGIC: does the code place each fund in the right bucket, and where do default branches absorb unusual shapes? |
| 2D credit-by-duration constraint | **Established (the C3 resolution).** `docs/audits/2026-05-30_lookthrough_intl_duration.md` Section C: `sebi_category` is credit OR duration, resolved by per-fund `Duration` / `AAA %`; gilt is the credit-by-category exception. | Cite, then trace the eligible debt pool through `creditBucketOf` / `durationBucketOf` and find every fund the no-`AAA %` default mis-buckets. |
| Look-through / international residual | **Established.** Look-through audit Sections A and B: domestic cap split present, international is an unlabelled residual. | Cite, then run `decomposeHeldEquity` over every persona equity holding and check the residual is actually international (it is not, for hybrids). |
| Wrapper classification | **Established (PMS all equity, AIF by category).** Prebuild Section B. | Cite, then confirm no hard-code: trace `classifyPmsSleeve` over all 513 PMS from the data. |
| Layer-1 vs Layer-2 taxonomy | **Not previously framed.** | Fresh. The gilt-ETF bug was a logic error with correct data; a data-only audit would have missed it. This audit separates the two layers explicitly. |

**Net:** the prior audits established that the data CAN support the framework. This audit asks a different question, whether the code's interpretation of that data is CORRECT for every security, and it routes each mismatch to the repo that must fix it.

## The two-layer framing

Classification can fail at two layers, fixed in two different repos:

- **Layer 1, the security's own data** (`sebi_category`, `strategy_type`, `AAA %`, `Duration`, `LargeCap/MidCap/SmallCap %`, AUM, age). A Layer-1 error is a DATA error; the correction ships to the snapshot repo, flagged for the primary.
- **Layer 2, how the framework code interprets that data into a bucket** (sleeve, sub-sleeve, credit bucket, duration bucket, cap bucket). A Layer-2 error is a LOGIC error; the correction is a code fix in this repo. The gilt-ETF bug lived here: the data was a legitimate gilt-index ETF with a (correctly) null `AAA %`, and the code defaulted no-`AAA %` funds to credit-risk.

A data-only audit misses the class of bug actually hit. So every mismatch below is tagged DATA or LOGIC.

## Method (the repeatable check rules, the seed-spec for the future data-management pipeline)

This is the reusable artifact, captured distinctly from the findings. It is the manual prototype of the classification-validation layer of the eventual dynamic data-management pipeline (which will validate the universe on every refresh).

**Full-path-trace procedure (per security):** (1) read the classification-relevant snapshot fields; (2) apply the real classification code to derive the bucket(s), citing the code path (repo-relative path + line); (3) judge whether the bucket is correct for what the security actually is; (4) if not, tag DATA (Layer 1, other repo) or LOGIC (Layer 2, this repo).

**Scope:** the entire universe, every instrument type (`mf_funds`, `pms`, `aif`, `nifty500`, `unlisted_equity`), not a sample.

**The explicit check rules (apply each universe-wide):**

- **R1, eligibility floor.** `isEligibleMf` (`lib/agents/instrument-selection.ts:155-161`): AUM at or above `MIN_AUM_CR`, age at or above `MIN_TRACK_RECORD_YEARS`, and a complete 3-year risk-adjusted triple. Report the eligible count per category; never let a thin or empty pool pass silently.
- **R2, sleeve classification.** `classifyMfSleeve` (`:96-103`) by `sebi_category` hint, `classifyPmsSleeve` (`:108-113`) by `strategy_type`. Check: is the sleeve right, and what does the no-hint / unknown-strategy fallback do?
- **R3, credit bucket.** `creditBucketOf` (`:209-216`): category-primary (gilt sovereign, corporate-bond / banking-PSU high-grade, credit-risk by name), `AAA %`-secondary for a duration-category fund. Check every fund that reaches the `AAA %` branch and every fund where `AAA %` is null.
- **R4, duration bucket.** `durationBucketOf` (`:218-230`): `Duration` metric primary, category fallback. Check for null outcomes on the eligible pool.
- **R5, cap bucket / look-through.** `decomposeHeldEquity` (`:335-373`): the residual-as-international rule, the pure-cap category defaults, the decline branch. Check that the residual is genuinely international and that every held sub-category has a handler.
- **R6, selection-pool membership.** Cross-check each sleeve-classified category against the selection pools (`CAP_CATEGORY`, `INTERNATIONAL_CATEGORIES`, `FLEXI_CATEGORIES`, `GOLD_CATEGORIES`, `DEBT_2D_CATEGORIES`). Report categories that are correctly sleeve-classified but in no selection pool (silent omissions).
- **R7, default / fallback census.** Enumerate every branch that absorbs an unusual shape into a bucket without positive evidence (`classifyMfSleeve` null, `classifyPmsSleeve` Equity default, `creditBucketOf` no-`AAA %` to credit-risk, `decomposeHeldEquity` listed-to-large, PMS-to-large, and the decline). For each, ask: is the default ever wrong, and is it the WORST-direction default?

**Edge-shape checklist (where mis-classification clusters):** funds lacking the field the logic keys on; categories whose name fights the economics; passive / index / ETF / FoF; wrappers classified by `strategy_type`; any fallback that silently absorbs.

## Findings

### Universe coverage (code-traced, snapshot `t0_q2_2026`)

| Instrument type | Count | Classification surface | Outcome |
|---|---|---|---|
| `mf_funds` | 1773 (1590 categorised, 183 no `sebi_category`) | `sebi_category` to selection pools + `classifyMfSleeve` (latent) | 45 distinct categories; 183 no-category excluded cleanly at `:183`; see L1, C1, C2 |
| `pms.funds` | 513 | `classifyPmsSleeve(strategy_type)` (`:194`) | All 513 `strategy_type` "equity", all classify Equity from the data, 0 hard-codes, 0 missing. CORRECT |
| `aif["Fund Profiles"]` | 162 | `SEBI Category` count (`:196-201`) | Cat I 12, Cat II 49, Cat III 101; advisor-select (no performance metrics). CORRECT |
| `nifty500.companies` | 500 | Not sleeve-classified by the funnel | Direct-equity top-up surface only (prebuild Section B); no deploy-classification path. No finding |
| `unlisted_equity` | (Surana founder stake) | Out of advisory scope | Recorded in `excludedHoldings`, excluded from metrics. No finding |

### The findings table (every mismatch, tagged DATA or LOGIC)

| # | Security / class | Data (Layer 1) | Code path (Layer 2) | Resulting bucket | Correct? | Cause | Bites the pending backfill? |
|---|---|---|---|---|---|---|---|
| L1 | Nippon India Nivesh Lakshya Long Duration, SBI Long Duration, HDFC Long Duration (3 funds) | `sebi_category` "Long Duration Fund", `AAA %` null (they hold government securities, so no corporate rating, like gilts) | `creditBucketOf` no-`AAA %` branch (`:215`) | **credit_risk** | **NO** (they are sovereign / high-grade in substance) | **LOGIC** | Pool pollution only: they enter the credit-risk-by-long pool used by Bhatt / Menon / Surana, but did not surface in the top-3 shortlists in the free preview |
| L2 | ICICI Prudential Balanced Advantage (Iyengar holding) | `sebi_category` "Dynamic Asset Allocation or Bal", has a cap split AND `Duration` 3.24 (a hybrid: roughly 66% domestic equity, roughly 25% debt) | `decomposeHeldEquity` residual branch (`:354-357`) computes international = 1 - domestic - cash | domestic large/mid/small + **international 2.4** (the debt sleeve counted as international) | **NO** (the residual is the fund's debt, not international) | **LOGIC** | No: Iyengar deploys alternatives only (his equity is at target), so `decomposeHeldEquity` is not invoked for him |
| L3 | HDFC Index Fund Nifty 50 (Iyengar holding) | `sub_category` `mf_passive_index`; the fund is not strict-matched to a snapshot row | `decomposeHeldEquity` has handlers for `mf_active_large/mid/small_cap` but none for `mf_passive_index`; falls to the decline branch (`:369`) | **declined**, "diversified equity, composition unavailable, advisor-select" | **NO** (a Nifty 50 fund is a large-cap passive, not diversified-unavailable) | **LOGIC** (no `mf_passive_index` handler) + **DATA** (name not matched, P40 class) | No: Iyengar deploys alternatives only |
| C1 | Large & Mid Cap Fund (24 eligible), ELSS (28), ETFs- Equity (46), Value (15), Dividend Yield (9), Contra (3) | correct `sebi_category` | `classifyMfSleeve` returns Equity (correct sleeve) but the category is in NO selection pool (R6) | sleeve correct, never offered as a candidate | sleeve YES, selection COVERAGE gap | **LOGIC** (deliberate v1 scoping, but currently silent) | No (coverage, not correctness) |
| C2 | 13 categories: the hybrids (Aggressive / Conservative Hybrid, Dynamic AA, Equity Savings, Multi Asset), Arbitrage, Childrens, Retirement, Floater, FoFs Domestic, AND the 3 international categories (FoFs Overseas, ETFs- Global, Sectoral- Foreign Equity) | correct `sebi_category` | `classifyMfSleeve` returns null (`:102`) | unclassified by the latent classifier | n/a for the live path | **LOGIC, latent only** (`classifyMfSleeve` is verify-only, not on the live selection path) | No |
| D1 | HDFC Index Fund Nifty 50 and the broader unmatched persona holdings (10 of 32 per the alignment utility) | persona instrument name does not strict-match a snapshot fund name | `findRawMf` / `strictNameMatch` (`:326-328`) finds nothing | look-through declines or category-defaults | naming, not economics | **DATA** (P40 persona-universe naming mismatch) | No (latent, Iyengar alternatives-only) |
| D3 | 183 `mf_funds` with no `sebi_category` | missing `sebi_category` | excluded at `:183` (`if (!cat) continue`) | excluded from category-filtered selection | YES (correct handling) | DATA gap, sound handling | No |

### LOGIC findings, detailed

**L1 (the headline): the gilt-ETF fix is incomplete; long-duration government-securities funds still default to credit-risk.** The gilt-ETF fix scoped passive categories OUT of `DEBT_2D_CATEGORIES`, but "Long Duration Fund" is IN the pool (it is a legitimate duration-ladder category). Three eligible Long Duration funds, Nippon India Nivesh Lakshya, SBI Long Duration, and HDFC Long Duration, hold long-dated government securities. Government securities carry no corporate AAA rating, so their `AAA %` is null, exactly the gilt shape. But `creditBucketOf` (`lib/agents/instrument-selection.ts:215`) only treats funds CATEGORISED "Gilt Fund" as sovereign; a Long Duration fund holding G-secs is sovereign-in-substance but not gilt-by-category, so it reaches the no-`AAA %` default and lands in **credit_risk**, the RISKIEST bucket and the worst-direction default for what is in fact a sovereign-quality fund. This is the same root cause as the original bug, surviving one category over. Consequence in the data: the credit-risk-by-long pool (8 eligible) is inflated by 3 mislabels, and the high-grade-by-long cell is empty (the grid shows no high-grade long-duration fund), forcing long-horizon high-grade deploys to relax to shorter-duration funds, partly because three genuinely high-grade long funds are sitting in the wrong bucket. Note: the look-through audit's AAA% coverage list (Section C) quietly omitted Long Duration, so this consequence was not previously connected; the code-trace surfaces it.

**L2: a hybrid's debt residual is counted as international equity.** `decomposeHeldEquity` applies the flexi residual rule (international = 1 - domestic-cap - cash, ADR-0036) to every `mf_` holding with a cap split, including `mf_hybrid_dynamic_aa`. Iyengar's ICICI Prudential Balanced Advantage decomposes to international 2.4 (on a 9.7% holding), but that residual is the fund's roughly 25% DEBT allocation, not an overseas sleeve. The residual-is-international assumption holds only for genuinely all-equity funds (Parag Parikh's roughly 29% residual IS international, correctly counted, verified in the same pass for Malhotra, Surana, and Sharma); it is false for a balanced-advantage / dynamic-asset-allocation fund.

**L3: a passive index fund declines and mislabels.** `decomposeHeldEquity` handles `mf_active_large/mid/small_cap` but not `mf_passive_index`. Iyengar's HDFC Index Fund Nifty 50 is also not name-matched in the snapshot (D1), so with no cap split and no pure-cap category match it hits the decline branch and is labelled "diversified equity, composition unavailable, advisor-select", which misreads a Nifty 50 large-cap passive as an unknown diversified fund.

**Both L2 and L3 are latent for the pending backfill.** They sit in Iyengar's holdings, and Iyengar's deploy is alternatives-only (his equity is already at target), so `buildEquityPlan` / `decomposeHeldEquity` is never invoked for him in the pending five-case backfill. The two investors who DO deploy equity, Malhotra and Menon, hold neither a hybrid nor a passive index. The bugs are real in the code; they do not bite the current five cases.

### Confirmed correct (no action)

- **PMS, all 513**: `strategy_type` "equity" universe-wide, all classify Equity from the data, 0 missing (the line-112 default-to-Equity is never exercised). The all-equity outcome falls out of the data, it is not assumed.
- **AIF, 162**: by `SEBI Category`, advisor-select by data necessity. Correct.
- **`classifyMfSleeve` hint ordering**: 0 categories match more than one hint group, so the Alternatives-before-Debt-before-Equity ordering never misroutes.
- **Gilt to sovereign by category** and **Corporate Bond / Banking and PSU to high-grade** (the name-fights-economics case): both correct, the SEBI rationale holds (ADR-0037).
- **Flexi look-through and international residual**: correct for genuinely-equity flexi / multi / focused funds (only the hybrid case, L2, misapplies it).
- **Duration bucketing**: 0 null outcomes on the eligible debt pool.

## Config-integrity result

**PASS. The committed `db/fixtures/structured-mandates.ts` (in `4f538b8`) is exactly the agreed ruling, with no stray content.**

- `EQUITY_SPLIT_BY_TIER` (`:95-100`): Conservative 10 / 75-20-5, Moderate-Aggressive 15 / 55-35-10, Aggressive and Ultra-Aggressive 20 / 35-40-25. Every domestic cap row sums to 100.
- `DEBT_CREDIT_SPLIT_BY_TIER` (`:102-107`): Conservative 55-42-3, Moderate-Aggressive 35-55-10, Aggressive and Ultra-Aggressive 25-55-20. Every row sums to 100; credit-risk caps at 20.
- `durationForHorizon` (`:112-117`): short / medium / long by horizon, defaulting long; Iyengar's "3-5y operational" resolves to medium via the "operational" token, the others to long, matching the look-through audit.
- Types `EquitySplit`, `DebtCreditSplit`, `DurationBucket`, `SubSleeveTilt`, and `Mandate.sub_sleeve_tilt` (`:76-132`) all present and correct.
- Thresholds (`SELECTION_PARAMS` in `lib/agents/instrument-selection.ts:43-49`): AAA high-grade cutoff 70, duration short under 3y / long over 5y. Confirmed by the code-trace.
- The landed diff (`git diff 4f538b8^ 4f538b8`) touches only the framework region: it removes the old directional tilt (`large_only` / `large_mid` / `small_mid_lean`, `HOUSE_VIEW_TILT_BY_RISK`) and adds the explicit splits. It does NOT touch `MANDATES_BY_INVESTOR` or Menon's explicit `target_pct` (`:207-210`, Equity 65 / Debt 15 / Alt 15 / Cash 5), which remain as committed in `5e515fa`.

Whatever the working-tree pre-edit was, the committed bytes equal the ruling, so its provenance no longer matters for what ships.

## Proposed corrections (PROPOSED, not written)

**Logic (this repo, `lib/agents/instrument-selection.ts`):**

- **For L1 (recommended before backfill):** change the no-`AAA %` default in `creditBucketOf` (`:215`) from credit-risk to **high-grade**. A duration-category fund with no disclosed `AAA %` is far more likely high-grade or sovereign than genuine credit-risk (only "Credit Risk Fund" is credit-risk by category), and high-grade is the conservative ballast default; defaulting an unknown into the riskiest bucket is the wrong direction. This also restores the three long funds toward the high-grade-by-long cell. (A more precise alternative, detecting sovereign substance, is fragile from names; the high-grade default is the clean, minimal rule.)
- **For L2:** in `decomposeHeldEquity`, special-case the hybrid sub-categories (`mf_hybrid_dynamic_aa`, and the hybrid `sebi_category` values) so the non-domestic-non-cash residual is treated as DEBT, not international; or exclude the debt portion from the equity look-through.
- **For L3:** add an `mf_passive_index` handler keyed to the underlying index (broad-market / Nifty 50 / Sensex to large-cap, Next 50 to large, a midcap or smallcap index to mid / small), defaulting broad-market to large-cap.
- **For C1 (a product decision, not a bug):** decide whether Large & Mid Cap, ELSS, Value, Contra, and Dividend Yield funds should feed the equity selection pools (or the diversified option), and until then log the omitted-but-eligible categories in the deterministic preview so the omission is explicit, not silent.
- **For C2 (defer):** extend `classifyMfSleeve` to recognise hybrids, the international categories, Floater, and arbitrage, when the latent classifier is wired into the validation pipeline (it is verify-only today).

**Data (other repo, flagged for the primary's review):**

- **D1:** reconcile the persona holding names that do not strict-match the snapshot (HDFC Index Fund Nifty 50, and the wider P40 set) at the snapshot or persona-authoring layer; this is the standing P40 workstream, gated by `npm run check:persona-snapshot` for the next cohort.
- **L1 is NOT a data error:** the null `AAA %` on the three G-sec funds is correct Layer-1 data (government securities are not AAA-rated). The fix is the Layer-2 default direction, above.

## Proposed ADR and roadmap debt (PROPOSED, not written)

- **ADR-0039 (proposed): classification-integrity as a recurring validation concern.** Records the two-layer (data / logic) taxonomy, the full-path-trace procedure, and the explicit check rules R1 to R7 above as the seed-spec for the automated classification-validation layer of the future dynamic data-management pipeline. Trigger condition: build the automated pipeline when the data goes live or begins refreshing on a schedule (the manual audit suffices for the static demo snapshot). Captures that the live selection path classifies by exact category-set membership while `classifyMfSleeve` is a parallel latent classifier, and that the validator should reconcile the two.
- **Product debt P47 (proposed): dynamic data-management pipeline (classification-validation layer) on the roadmap.** The manual audit prototypes it; the automated version validates the whole universe on every refresh, applying R1 to R7 and routing each mismatch DATA vs LOGIC. Cross-references ADR-0039 and the companion validators (P44 holding-classification validator, WA26 persona-snapshot alignment).

## Build-readiness verdict

**Not a clean "backfill as-is." One logic correction (L1) should land first; two more (L2, L3) are latent and can land in the same pass or fast-follow.**

The audit's own premise is that narrating allocations built on mis-classified securities is paying to polish wrong answers. L1 puts three sovereign-quality funds into the credit-risk deploy pool that the three long-horizon backfill cases (Bhatt, Menon, Surana) draw from. They did not surface in the top-3 shortlists in the free preview, so the blast radius today is pool pollution rather than a surfaced wrong pick, but it is the same bug class we just committed to fixing, the fix is a one-line default-direction change, and it touches the exact pool the paid narration would describe. The conservative and consistent call is to fix L1, re-verify, re-preview, and then backfill.

L2 and L3 do not bite the current five cases (they live in Iyengar's holdings, and Iyengar deploys alternatives only). They are real and should be fixed, but they do not, on their own, block the backfill. C1 is a product decision and does not block. D1 is the standing P40 and does not block.

**Recommended sequence:** primary authorises the logic corrections (L1, ideally L2 and L3 in the same small pass) and the C1 product decision; we implement, re-run the verify suite and the free preview, confirm the credit-risk-by-long pool no longer carries the three G-sec funds and the high-grade-by-long cell populates; only then the WA12 backfill. The backfill stays parked until classification is proven sound.

## Stops

- Read-only on both repos. No code change, no API call, no fixture write. Corrections proposed, none written.
- The automated data-management pipeline is NOT built; only its seed-method is captured here.
- Holding at WA12. PR #11 stays in draft.
