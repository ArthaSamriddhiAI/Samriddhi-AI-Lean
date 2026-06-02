# Client-specific weighted benchmark for the Samriddhi 2 risk-reward statistics: scope audit

**Date:** 2026-05-31
**Provisional task id:** T-5.14 (label, not fact; per WA24 resolve against the live task registry at landing. `docs/debt/data_debt_log.md` D12 already anchors the string "T-5.14" to this work, but the A3 So-What and A1-deferral landings moved the Package 5 numbering, so the next free id is the primary's to confirm at landing.)
**Branch:** `features/client-weighted-benchmark` (cut from `main` at `1ff6368`, pushed on creation per WA10).
**Mode:** Audit-only. Read-only against code, snapshot, and registries. The only writes this session are the branch and this document (see the write gate at the end). No agent logic, no snapshot edits, no debt or ADR codification, no partial-close of D12.
**Conventions applied:** WA22 (versioned audit deliverable; every claim tagged audited or hypothesis-checked), WA21/WA2 (registry and contracts read from source and quoted as evidence), WA27 (repo-relative paths), WA7 (no long dashes), WA28 (scope recommendation is a recommendation, not a decision).

---

## 0. Executive summary and scope recommendation

The repo puts us in **World A: equity plus debt is buildable, cleanly.** Both conditions the fork requires are met against real data:

1. **Matching debt index series exist.** The snapshot carries five debt index series (`crisil_composite_bond`, `crisil_short_term_bond`, `crisil_dynamic_gilt`, `nifty_10y_gsec`, `crisil_liquid`), each 84 monthly points, bucketed by duration and credit. Evidence: Section 4.
2. **Debt is per-holding classifiable.** Every debt mutual fund in the snapshot carries `tier_b_stats._meta.benchmark_index_id` mapping it to one of those five debt indices, already resolved and already read-through by both agents today. Per-fund `Duration` / `AAA %` / `SOV %` metrics also exist and the A3-era ADR-0037 classifier (`creditBucketOf` / `durationBucketOf`) can place a debt fund on a 2D credit-by-duration grid. Evidence: Sections 3 and 4.

The more important finding is that the fork partly dissolves once you look at the real seam. The believability fix does not need an "equity blend" with a debt module bolted on. It needs **a holdings-weighted blend of each evaluable holding's own read-through `benchmark_index_id` series**, which is asset-class agnostic: an equity fund contributes its cap index, a debt fund contributes its duration index, and whatever is unevaluable (PMS, AIF, international, FDs, bonds) is sentinelled out of both the portfolio series and the blend, exactly as it is today. Built this way, debt is included wherever it is evaluable for essentially zero extra cost, and the result reuses snapshot data the agents already consume.

**Recommendation (WA28: a recommendation, the scope call stays with the primary):** build **equity plus debt**, on the per-holding-benchmark mechanism, because the repo supports it without strain and the marginal cost over equity-only is near zero. Two honest qualifiers shape it:

- The high-value believability win for the **current seed** is the **equity cap-weighting** axis, not debt. Evaluable debt is thin in the seeded book (Section 2.3): four of six personas hold their debt entirely as bank FDs and tax-free bonds, which are sentinelled and never enter the series. So equity plus debt is the right capability shape, but it moves the number for only two personas.
- There is a genuine product-shape choice on the **equity granularity** that the primary should make: weight by the coarse already-resolved `benchmark_index_id` (where flexi, multi, ELSS, and value funds all resolve to the broad `nifty_500_tri`), or decompose each equity holding into large/mid/small with the already-built `decomposeHeldEquity` (ADR-0035) for a finer cap-weighted blend. This is the real fork worth surfacing, more than equity-versus-equity-plus-debt.

The known-safe equity-only-with-a-footnote fallback remains valid and is not contradicted by anything here; I am not recommending it because the repo reaches the better answer without strain. The richer dynamic model-portfolio benchmark stays logged future state (product debt P19 / P43, model-portfolio workstream) and is out of scope (WA8).

One realism caveat to hold honestly, stated once and not overweighted: the "implausibly clean" portfolio beta is partly a property of the synthetic snapshot, whose fund NAVs were regenerated for index co-movement (`docs/debt/product_debt_log.md` P15: risk-reward "ships with Option A calibration, preserve Sharpe and vol; beta as calibrated output with R-squared in band"; ADR-0014). A client-weighted benchmark legitimately improves benchmark aptness, which is the right fix, but on a co-movement-calibrated snapshot the realism ceiling is set by the data generation, not by the benchmark alone. This tempers the expected gain; it does not block the build.

---

## 1. Benchmark selection and the alpha/beta computation as they work today

### 1.1 Where the static benchmark id is used (the believability locus)

The hardcoded canonical-index ids live in exactly one place, `lib/agents/risk-reward-stats.ts`:

```
128  const SLEEVE_BENCHMARK: Record<AssetClass, string | null> = {
129    Equity: "nifty_500_tri",
130    Debt: "crisil_composite_bond",
131    Alternatives: null, // dominated by opaque AIF; sleeve sentinelled when no evaluable constituent
132    Cash: null,
133  };
```

The sleeve aggregate passes `SLEEVE_BENCHMARK[s]` (`lib/agents/risk-reward-stats.ts:509`); the portfolio aggregate hardcodes the broad index directly (`lib/agents/risk-reward-stats.ts:512-517`):

```
512    const portfolio = aggregate(
513      "portfolio",
514      holdings.holdings.filter((h) => h.assetClass !== "Cash"),
515      snapshot,
516      "nifty_500_tri",
517    );
```

**Audited.** The planner's belief that the portfolio aggregate benchmarks against `nifty_500_tri` is confirmed. The planner's belief that sleeves carry per-asset-class defaults is confirmed and is richer than the kickoff implied: there is already a **Debt sleeve benchmark, `crisil_composite_bond`**. So the static id is genuinely a per-asset-class map, and the portfolio-level blend of all non-cash holdings against the broad equity 500 is the precise source of the "moves in lockstep with the 500" beta. The debt portion of the portfolio series is today regressed against a pure-equity index at the portfolio level, which is the silent misrepresentation the kickoff describes.

### 1.2 The seam where a synthesized series threads in

**Audited, and the planner's name is correct.** `aggregate()` (`lib/agents/risk-reward-stats.ts:395-468`) is the real entry point. Inside it, the benchmark is resolved from the snapshot and handed to the beta computation (`lib/agents/risk-reward-stats.ts:447-455`):

```
447    if (benchId) {
448      const bench = snapshot.indices?.[benchId]?.monthly_values;
449      if (bench) {
450        const br = benchRelative(series, bench);
451        stats.beta_3y = br.beta_3y;
452        stats.r_squared_3y = br.r_squared_3y;
453        stats.tracking_error_3y = br.tracking_error_3y;
454        stats.information_ratio_3y = br.information_ratio_3y;
455      }
456    }
```

`benchRelative` consumes a benchmark as a plain `Record<string, number>` of monthly values. The cleanest, lowest-blast-radius thread-in is to give `aggregate()` an optional pre-built blend series (a `Record<string, number>`) and, when present, pass it to `benchRelative` in place of the `snapshot.indices[benchId]` lookup. The blend itself is built from the same `snapshot.indices[...]` series the function already reads, weighted by the client's holdings. This is an agent-runtime accommodation, not a snapshot edit, so it is inside the stated scope boundary (D12: "agent-runtime accommodations are okay; re-touching the snapshot data is not").

### 1.3 How alpha and beta are each computed

**Audited; the planner's belief is confirmed, with one load-bearing clarification.**

- **Beta is the regression term**, computed fresh in `benchRelative` (`lib/agents/risk-reward-stats.ts:269-303`). It aligns instrument and benchmark log-returns on shared `YYYY-MM` keys, requires at least 12 common months, and computes `beta = cov / vb` (`:287`) and `r2 = (cov / sqrt(vs*vb))^2` (`:288`). Tracking error and information ratio follow on the trailing 36 (`:289-296`). Beta lives in the **risk-reward-stats** path.

- **Alpha is simple excess return**, computed in `computeBenchmarkRelative` (`lib/agents/time-series-performance.ts:242-248`), whose own comment reads "Simple alpha: instrumentReturn - benchmarkReturn" (`:239`). The `alpha` field is on `BenchmarkRelativeReturn` (`lib/agents/time-series-performance.ts:48-52`). Alpha lives in the **time-series-performance** path. Confirmed exactly as the planner stated.

**The clarification that changes the threading plan.** The two paths place their benchmark very differently:

- In **risk-reward-stats**, the sleeve and portfolio benchmark is the *static* `SLEEVE_BENCHMARK` / `nifty_500_tri`, resolved fresh at the sleeve and portfolio level inside `aggregate()`. This is where the static id distorts beta. A client-weighted benchmark threads in here.
- In **time-series-performance**, the benchmark is resolved **per holding** as read-through from `tier_b_stats._meta.benchmark_index_id` (`lib/agents/time-series-performance.ts:444-452`, `:507`), which is already cap-appropriate per instrument (a midcap fund already carries a midcap benchmark). There is **no sleeve-level or portfolio-level alpha at all**: `SleeveTimeSeries` (`:68-76`) carries `trailing_returns` but no `benchmark_relative`, and the rollups (`rollupSleeve` `:256-288`, `rollupPortfolio` `:292-294`) roll up only trailing returns, never alpha.

Consequence: the "especially beta" emphasis in the kickoff is the honest framing. Per-holding alpha is already benchmarked instrument-appropriately and has no lockstep problem to fix. If the product wants a **portfolio-level alpha against the client-weighted benchmark**, that is net-new computation in time-series-performance (there is nothing to "rethread" there, only something to add), and it is a scope question for the primary, not a free byproduct of the beta seam.

---

## 2. Equity cap-classification metadata: what exists, what does not

### 2.1 The two layers of cap data

There are two distinct cap signals, and the planner's belief ("MF holdings carry LargeCap/MidCap/SmallCap %") is **confirmed but located differently than the loader type suggests.**

- **Coarse, per holding, already resolved:** each equity holding's `tier_b_stats._meta.benchmark_index_id` maps it to a cap-appropriate index. Audited distribution over the snapshot:
  - Mutual funds (`SEBI category -> benchmark_index_id`): Large Cap Fund maps to `nifty_50_tri` (30) and `nifty_100_tri` (3); Mid Cap Fund to `nifty_midcap_150_tri` (30); Small Cap Fund to `nifty_smallcap_250_tri` (29); Flexi / Multi / Focused / ELSS / Value / Large-and-Mid all map to the broad `nifty_500_tri`.
  - Direct equity (the 500 `nifty500.companies`): 96 map to `nifty_50_tri`, 151 to `nifty_midcap_150_tri`, 195 to `nifty_smallcap_250_tri`, plus 26 `nifty_bank_tri` and 32 `nifty_it_tri`. So direct stocks carry a cap-bucketed benchmark too.

- **Fine, per fund, partially populated:** the snapshot fund rows carry literal `"LargeCap %"`, `"MidCap %"`, `"SmallCap %"`, `"Cash %"` fields (top-level on the row, not in `tier_b_stats._meta`). Audited coverage (corroborated by `docs/audits/2026-05-30_lookthrough_intl_duration.md` Section A): `LargeCap %` 977 of 1773 funds, `MidCap %` 970, `SmallCap %` 766. Values are fractions of the whole fund, not of the equity sleeve.

Note the loader type field `cap_tier?: string` on `TierBStats._meta` (`lib/agents/snapshot-loader.ts:73`) is **declared but never populated**: audited, `cap_tier` is ABSENT on all 1773 funds. The usable cap signals are the two above, not `cap_tier`.

### 2.2 The classifiable-versus-not list, per the kickoff's denominator question

**Audited, per equity instrument type:**

| Instrument type | Holdings sub-category | Cap signal available | Mechanism |
|---|---|---|---|
| Direct equity (domestic) | `listed_large_cap` | Yes, per holding | `tier_b_stats._meta.benchmark_index_id` on the matched `nifty500.companies` row; large-cap by category for the personas' names (`decomposeHeldEquity`, `lib/agents/instrument-selection.ts:371-373`). |
| MF equity, dedicated cap | `mf_active_large_cap` / `_mid_cap` / `_small_cap` | Yes, per holding | benchmark id and/or category default; pure-cap categories rarely need look-through. |
| MF equity, diversified | `mf_active_flexi_cap`, `mf_hybrid_dynamic_aa`, plus Multi / Focused / ELSS / Value universe | Coarse via benchmark id (resolves to broad `nifty_500_tri`); fine via `LargeCap/MidCap/SmallCap %` where present | `decomposeHeldEquity` splits these proportionally (`lib/agents/instrument-selection.ts:374-391`); falls back to category default, then to advisor-select (`composition_source: "declined"`, `:411`). |
| MF equity, passive index | `mf_passive_index` | Yes, by what it tracks | classified by index name (`lib/agents/instrument-selection.ts:399-404`). |
| PMS equity | `pms_growth_quality`, `pms_concentrated_quality`, `pms_value`, `pms_focused_midcap` | Disclosure-gated; defaulted | `decomposeHeldEquity` defaults PMS to a domestic large-cap-leaning category default (`lib/agents/instrument-selection.ts:413-414`); in the risk-reward path PMS is sentinelled `pms_disclosure_limited` (`lib/agents/risk-reward-stats.ts:339`). |
| International equity | `intl_us_etf`, `intl_us_individual` | No India cap tier; sentinelled in the return path | not in `mf_funds` or `nifty500`, so risk-reward sentinels them `not_applicable_for_risk_reward` and time-series sentinels them `currency_conversion_pending`. There is no labelled international field in any fund (`Intl %` / `International %` / `Overseas %` / `Foreign %` are 0 of 1773; `docs/audits/2026-05-30_lookthrough_intl_duration.md` Section A). A flexi fund's international slice is only a residual. |
| Opaque AIF | `aif_cat_*` | None | sentinelled `opaque_wrapper` (`lib/agents/risk-reward-stats.ts:338`). |

**The honest-coverage footnote denominator is therefore the already-computed sentinelled weight.** Both agents already split each sleeve into `evaluable_weight_pct` and `sentinelled_weight_pct` (`lib/agents/risk-reward-stats.ts:419-420`). The blend covers exactly the evaluable set; the footnote is the sentinelled remainder (PMS, AIF, international, FDs, bonds, gold, cash). No new coverage accounting is needed; it exists.

### 2.3 A data-quality caveat that touches the per-holding-benchmark mechanism

**Audited from `docs/debt/data_debt_log.md` D8(b):** about 24 of the 500 direct stocks carry broken `market_cap_rs_cr` (5 above 1.5M Cr, about 19 at zero) and "default to small cap-tier, so their `tier_b_stats._meta.benchmark_index_id` is wrong by construction." If the equity blend keys on `benchmark_index_id`, those stocks contribute the wrong cap index. The seeded personas' direct names (Reliance, HDFC Bank, ITC) are not in that broken set, but the mechanism should be aware of it. This is existing logged debt, not new scope.

### 2.4 Evaluable debt in the current seed (why the debt axis moves little today)

**Audited from `db/fixtures/structured-holdings.ts`.** The seeded debt positions are overwhelmingly bank FDs and tax-free bonds, which are not mutual funds, carry no return series, and are sentinelled `not_applicable_for_risk_reward` (`lib/agents/risk-reward-stats.ts:149-159, 340`). The only evaluable debt mutual funds across all six personas are:

- Iyengar: "Franklin India Corporate Debt Fund" (`mf_corporate_debt`, 10.3%), which the snapshot resolves to `crisil_short_term_bond`.
- Bhatt: "HDFC Arbitrage Fund" (`mf_arbitrage`, 7.2%), which resolves to `crisil_liquid` (cash-adjacent).

Malhotra, Menon, and Sharma hold debt only as FDs and tax-free bonds; Surana holds no Debt-class instrument at all. So the equity-plus-debt expansion changes the portfolio benchmark materially for **Iyengar** (a debt-heavy conservative book), marginally for **Bhatt**, and not at all for the other four. This is the strongest reason the equity cap-weighting axis, not the debt axis, is where the current-seed believability win sits.

---

## 3. The debt-classification work: where it lives, its shape, and its dimension

**Audited. The planner's belief that "debt-fund classification work landed during the A3 So-What workstream" is confirmed, and it is more precisely a 2D credit-by-duration classifier.**

- **Where it lives:** `lib/agents/instrument-selection.ts`, built during T-5.12 (A3 So-What), imported by `lib/agents/a3-so-what.ts:40`. The decision is ADR-0037 (`docs/decisions/0037_debt_2d_credit_by_duration.md`), status Accepted, "Implemented in `lib/agents/instrument-selection.ts` (`creditBucketOf`, `durationBucketOf`, `buildDebtPlan`, `DEBT_2D_CATEGORIES`)" with thresholds in `SELECTION_PARAMS` (`AAA_HIGH_GRADE_MIN_PCT` 70, `SOV_SOVEREIGN_MIN_PCT` 80).

- **Its dimension:** two axes. Credit quality (sovereign / high-grade / credit-risk) by risk appetite, and duration (short under 3 years / medium 3 to 5 / long over 5) by time horizon. The credit read is category-primary, metric-secondary, SOV-aware (`docs/decisions/0037_debt_2d_credit_by_duration.md` Decision section). The duration read is the per-fund `Duration` metric with category fallback. The supporting per-fund metrics (`Duration` 685 of 1773, `AAA %` 521, `SOV %`) are near-complete on the eligible debt universe per `docs/audits/2026-05-30_lookthrough_intl_duration.md` Section C.

- **Its shape, against the kickoff's per-holding-versus-taxonomy question:** it is **both layered, and it classifies the selection universe, not the client's held debt.** The raw signals (`Duration`, `AAA %`, `SOV %`) are per-fund-row data that exist per holding. The bucketing is a runtime classification scheme (`creditBucketOf` / `durationBucketOf`) with stated thresholds. But it is applied to `universe.debt_funds`, the pool of candidate funds to recommend in `buildDebtPlan` (`lib/agents/instrument-selection.ts:508-534`), to drive forward-looking deployment. There is a held-equity decomposition (`decomposeHeldEquity`, `:361`) but **no `decomposeHeldDebt`**: the client's existing debt is not run through the 2D classifier anywhere today. The `DEBT_2D_CATEGORIES` pool also deliberately excludes the cash-adjacent ladder (Liquid, Overnight, Money Market, Ultra Short, Low Duration) and the credit-indeterminate categories (`Debt Index Funds`, `ETFs- Debt`, `Dynamic Bond`), per `docs/decisions/0037_debt_2d_credit_by_duration.md`.

**What this means for anchoring a debt blend.** Two paths, and the audit recommends the first:

1. **Reuse `tier_b_stats._meta.benchmark_index_id`** (already resolved per debt fund, maps each to one of the five debt indices). This is the same read-through both agents already perform, it is asset-class agnostic with the equity side, and it needs no new classifier. Coarse (five buckets) but sufficient for a benchmark blend.
2. **Build a held-debt decomposition** that applies ADR-0037's `creditBucketOf` / `durationBucketOf` to the client's debt, then maps 2D cells to debt indices. This is new code (the held-debt equivalent does not exist), and the 2D cells do not map one-to-one onto the five debt indices, so it also needs a cell-to-index rule. More granular, more work, and not required for the believability fix.

So the A3-era debt work is real, per-holding-grounded, and proves debt funds can be richly classified; the actual benchmark blend does not need to invoke it, because `benchmark_index_id` already carries a sufficient per-holding debt-to-index mapping.

---

## 4. The index series in the snapshot, equity and debt, and the normalization convention

### 4.1 The sixteen canonical indices

**Audited** from `fixtures/snapshots/enriched/snapshot_t0_q2_2026.json` `.indices` (the snapshot is a git-ignored symlink to the sibling data repo; `lib/agents/snapshot-loader.ts:26` resolves it). All sixteen carry 84 monthly points.

| index_id | category | role for the blend |
|---|---|---|
| `nifty_50_tri` | equity_largecap | equity cap (large core) |
| `nifty_next_50_tri` | equity_largecap | equity cap |
| `nifty_100_tri` | equity_largecap | **large-cap tier (plan's blend input)** |
| `nifty_midcap_150_tri` | equity_midcap | **mid-cap tier (plan's blend input)** |
| `nifty_smallcap_250_tri` | equity_smallcap | **small-cap tier (plan's blend input)** |
| `nifty_500_tri` | equity_broad | current portfolio benchmark; diversified-fund benchmark |
| `bse_sensex_tri` | equity_largecap | equity cap |
| `nifty_bank_tri` | equity_sector_banks | sector (direct-stock benchmark) |
| `nifty_it_tri` | equity_sector_it | sector (direct-stock benchmark) |
| `crisil_composite_bond` | debt_composite | **debt; current Debt sleeve benchmark** |
| `crisil_short_term_bond` | debt_short_duration | **debt (short)** |
| `crisil_dynamic_gilt` | debt_gilt_dynamic | **debt (gilt dynamic)** |
| `nifty_10y_gsec` | debt_gilt_long | **debt (gilt long)** |
| `crisil_liquid` | debt_liquid | **debt (liquid / cash-adjacent)** |
| `gold_inr` | commodity_gold | commodity |
| `sp_500_tri_inr` | equity_intl_us | **international (plan's blend input)** |

**Audited confirmations for the fork:** the three equity cap tiers the original plan assumes (`nifty_100_tri`, `nifty_midcap_150_tri`, `nifty_smallcap_250_tri`) and the international `sp_500_tri_inr` are all present; and five debt index series exist, bucketed by duration and credit. So a debt blend has real series to blend against.

### 4.2 The normalization convention (the kickoff's unresolved wording question, resolved, with a correction)

**Audited, and it carries a real inconsistency the blend math must handle.** Every index records metadata `base_value: 1000.0, base_month: "2019-05"`. The actual series split into two families:

- **The nine equity TRI series** read **1000.0 at the terminal month (2026-04)** and 276 to 416 at 2019-05. Example: `nifty_500_tri` is 346.18 at 2019-05 and 1000.0 at 2026-04; `nifty_100_tri` is 376.52 then 1000.0. So equity TRI is normalized to **1000 at the terminal month**, and the metadata `base_month: "2019-05"` is **wrong for the equity family.**
- **The seven non-equity series** (five debt, `gold_inr`, `sp_500_tri_inr`) read **1000.0 at the start month (2019-05)**. Example: `crisil_composite_bond` is 1000.0 then 1772.23; `sp_500_tri_inr` is 1000.0 then 751.46. Here the metadata is accurate.

So the planner's "1000 at the start or the terminal month" question has a split answer: equity at the terminal month, debt and international and gold at the start month, with uniform (and for equity, incorrect) metadata.

**Implication, and why it does not block the build.** Because the families do not share a level base, **a blend must be built on monthly returns, not on raw levels;** blending levels would corrupt the result. This is already the established pattern: `synthesiseSeries` (`lib/agents/risk-reward-stats.ts:371-393`) builds the holdings series by compounding weighted monthly log-returns from an index level of 1000 (`:382-391`), base-agnostic by construction. A benchmark blend follows the same recipe. Moreover, beta and alpha are themselves computed on returns (`benchRelative` log-returns the benchmark at `lib/agents/risk-reward-stats.ts:273-274`; `computeBenchmarkRelative` differences returns), so they are already base-invariant, which is why the existing `nifty_500_tri` computation is correct despite the mixed convention. The inconsistency is a real gotcha to encode against, not a blocker, and snapshot re-touching to "fix" the metadata is explicitly out of scope.

### 4.3 FX

**Audited:** `.fx` carries `usd_inr` with 84 monthly points; `eur_inr`, `gbp_inr`, `aed_inr` are present but null (`lib/agents/snapshot-loader.ts:142-145` describes this). International holdings are sentinelled out of the return path regardless, so the blend does not depend on FX; `sp_500_tri_inr` is already an INR-denominated series.

---

## 5. The D-series ledger and D12

**Audited.** `docs/debt/data_debt_log.md` runs D1 through D12; D12 is the most recent and is the benchmark-coverage entry. Its current text, quoted verbatim:

> **D12** | International ETF (Vanguard S&P 500 et al.) and opaque AIF holdings lack cap-classification metadata in the current snapshot, so T-5.14's client-specific weighted equity-only benchmark cannot include them in the cap-weight aggregation. v14 design choice: surface the gap honestly as a footnote on the rendered output ("X% of equity included in benchmark calculation") rather than enriching the snapshot. The primary explicitly stated preference: agent-runtime accommodations are okay; re-touching the snapshot data is not. Enrichment is the cleaner long-term path; deferred until either a production-data-onboarding workstream opens or a client demands cap-inclusive international benchmarking. | Medium | v14 new, surfaced via T-5.14 provisional task | TBD

**Findings about D12:**

- It is framed **equity-only** ("client-specific weighted equity-only benchmark"). The A3-era debt work did **not** touch it; D12 still reads as it did when the plan was equity-only. This matches the kickoff's suspicion.
- Its gap is specifically **international ETF plus opaque AIF cap-classification**. That gap is **independent of the equity-versus-equity-plus-debt fork.** International ETFs and AIFs are sentinelled (no benchmark, no series) and stay excluded from the blend under either scope. So even in World A, D12's underlying gap does **not** close; only its "equity-only" framing would be updated. Any "partial-close" is a wording correction (scope label), not a closure of the intl/AIF coverage gap, which persists and is correctly footnoted.
- Per the write gate, this audit does **not** edit D12. The framing update and any new debt entry (for example, the normalization-inconsistency note from Section 4.2, the absent held-debt decomposition from Section 3, or the D8 broken-market-cap interaction from Section 2.3) are codification motions for a later, separately consented step.

**Registry state for the record (WA21):** max ADR on disk is `0040` (next free 0041); the D-series ends at D12 (next free D13). This audit creates neither.

---

## 6. The fork, stated plainly

**World A (equity plus debt buildable) is the truth.** Both gating conditions hold: debt classification is per-holding derivable (via `benchmark_index_id`, already resolved; ADR-0037 available for richer placement), and matching debt index series exist (five, duration and credit bucketed). The kickoff's World B (equity-only holds because debt is not per-holding, or no debt series exist) is contradicted by the data on both clauses.

The recommendation and its qualifiers are in Section 0 and not repeated here. The single most useful sentence for the primary: the believability fix is cleanest as a holdings-weighted blend of each evaluable holding's own read-through benchmark, which is asset-class agnostic, so the live product-shape decision worth making is not equity-versus-equity-plus-debt (debt comes along for near-zero cost) but the **equity cap-granularity** choice, coarse `benchmark_index_id` versus fine `decomposeHeldEquity` decomposition.

---

## 7. What this audit did not do, and the next motion (write gate, WA1 / WA19)

This session wrote exactly two things: the branch `features/client-weighted-benchmark` and this document. It did **not** write agent logic, modify the snapshot or fixtures, codify any ADR or working agreement, create or edit any debt entry, or partial-close D12. Front-loaded consent for the audit does not extend to any of those.

The decisions that now belong to the primary, surfaced as stop-and-propose (WA28), are: (a) the scope, equity-only or equity plus debt; (b) if equity plus debt, the equity cap-granularity mechanism; (c) whether a portfolio-level alpha against the client benchmark is wanted (net-new in time-series-performance) or beta-only is sufficient; (d) the task-id resolution at landing (WA24). Each of those, and any ledger or ADR write that follows, needs its own explicit, single-purpose go-ahead before the next motion begins.
