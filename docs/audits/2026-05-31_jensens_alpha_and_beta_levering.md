# Jensen's alpha and beta lever/unlever for the client-weighted benchmark: methodology audit

**Date:** 2026-05-31
**Provisional task id:** T-5.14 (same workstream as `docs/audits/2026-05-31_client_weighted_benchmark.md`; resolve the live id at landing per WA24).
**Branch:** `features/client-weighted-benchmark` (continued; not re-cut).
**Mode:** Audit-only. Read-only grounding plus this one deliverable. No agent logic, no snapshot edits, no fixtures, no debt or ADR codification (write gate at the end).
**Follows:** the World A confirmation in `docs/audits/2026-05-31_client_weighted_benchmark.md` (commit `e1f521b`): a holdings-weighted blend of each evaluable holding's own read-through benchmark, asset-class agnostic, equity plus debt, equity granularity via the faithful `decomposeHeldEquity` large/mid/small split.

**First-move call (WA22): new dated file, not an addendum.** I checked the `docs/audits/` convention against source: all sixteen prior audits are standalone `YYYY-MM-DD_<slug>.md` files (multiple share a date, for example five distinct `2026-05-30_*` files), and there is no precedent of an addendum appended into a live audit on the same branch (the two grep hits for "follow-up" / "appended" are incidental prose inside `2026-05-19_risk_reward.md` and `2026-05-27_chore_v14_debt_sync.md`, not structural addenda). So the established pattern is one focused file per audit, which also matches the kickoff's lean. This audit lands as a new file and commits to `features/client-weighted-benchmark`.

---

## Question 1: Jensen's alpha. Verdict: adopt, with one correction to the framing

**Verdict.** Adopt Jensen's regression alpha (the CAPM intercept) at the **portfolio and sleeve level**, computed inside the existing regression in `benchRelative` (`lib/agents/risk-reward-stats.ts:269-303`), against the client-weighted benchmark. Keep it **alongside** the per-holding simple excess return in `lib/agents/time-series-performance.ts`, not in place of it; they are different objects at different levels. The code supports this cleanly; it is close to a finish on machinery that already exists, and it addresses a gap already logged as product debt P37 ("A3's exit-judgment performance dimension lacks Jensen's alpha (CAPM active-return decomposition); the dedicated benchmarking workstream would add it").

**One correction to where the kickoff landed.** The kickoff frames R_f as "the missing input." It is not missing. The agent already carries a documented risk-free rate, `RISK_FREE_ANN = 0.0525` (the 5.25% repo rate, ADR-0012, `lib/agents/risk-reward-stats.ts:38`), and already uses it in `sharpe` (`:236`) and `sortino` (`:241`, `:247`), and already surfaces it on the output as `risk_free_rate` (`:524`). So R_f is solved as a constant today. The real question is not "find an R_f" but "should Jensen's reuse the existing constant R_f or switch to a series," and (the load-bearing finding below) it barely matters at the portfolio level.

### 1.1 The math, from quantities the regression already computes

`benchRelative` already log-returns both series, aligns on shared months, and computes the means and the regression slope (`lib/agents/risk-reward-stats.ts:280-287`): `ms = mean(s)`, `mb = mean(b)`, `beta = cov / vb`. Jensen's monthly intercept is a one-line addition over those same quantities, with `rfM` the monthly risk-free already used by `sortino` (`:241`, `rfM = log(1 + RISK_FREE_ANN) / 12`):

```
alpha_monthly = (ms - rfM) - beta * (mb - rfM)
             = ms - beta*mb - rfM*(1 - beta)
```

annualised on the file's existing convention (`exp(mean*12) - 1`, as `annReturn` at `:225`). Nothing new needs to be sourced or regressed; the CAPM beta is already the slope `benchRelative` returns, because subtracting a constant R_f from both sides of the regression leaves `cov` and `var` unchanged, so the existing raw-return beta equals the CAPM excess-return beta.

### 1.2 Why the R_f choice is low-stakes here (the (1 - beta) result)

The relationship between Jensen's alpha and the simple excess return the workstream already uses is exact:

```
simple_excess - jensens_alpha = (beta - 1) * (Rm_bar - Rf)
```

When `beta = 1`, Jensen's alpha equals simple excess return exactly. The correction term is purely the return earned from taking more or less systematic risk than the benchmark. This matters for this workstream specifically: the client-weighted benchmark is composition-matched to the book, so the portfolio's beta against it is **near 1 by construction**, which means at the portfolio level Jensen's alpha and simple excess return nearly coincide, and R_f (which enters only through the `(1 - beta)` term) barely moves the number. The correction earns its keep at the **sleeve and per-holding** level, and against any single broad index, where beta genuinely deviates from 1. This is a point in favour of Jensen's honesty, not against it: against a composition-matched benchmark it will not manufacture alpha.

### 1.3 R_f series choice, surfaced as a product-shaping default (WA28)

R_f is a product-shaping methodology default; per WA28 I surface the options and recommend, I do not silently pick. `snapshot_metadata` carries no rf field (confirmed; keys are evolution / lookback / provenance only), so a series R_f would come from the index block, where these candidates exist (84 months, start-normalised to 1000 at 2019-05):

- `nifty_10y_gsec` (debt_gilt_long): the conventional 10Y sovereign tenor for an equity-risk-premium context.
- `crisil_liquid` (debt_liquid): the cash-adjacent, low-duration proxy, the closest series to the repo-rate register.
- `crisil_dynamic_gilt` (debt_gilt_dynamic): a managed-duration gilt, less conventional as an R_f.

| Option | R_f | For | Against |
|---|---|---|---|
| A (recommended) | reuse the `RISK_FREE_ANN` 0.0525 constant | one R_f across the whole agent (Sharpe, Sortino, Jensen's all consistent); no new series; flat and clean; already documented (ADR-0012); and the (1 - beta) result makes it near-indistinguishable from a series at the portfolio level | a constant ignores the rate path over the window; the repo rate is a short cash rate, not the textbook 10Y equity-CAPM R_f |
| B | `crisil_liquid` monthly returns | time-varying, genuinely cash-like (low duration, low rate risk), so it is a clean risk-free return series | introduces a second R_f different from the one Sharpe and Sortino use, for a portfolio-level number where it barely changes the result |
| C | `nifty_10y_gsec` monthly returns | the conventional 10Y tenor | as a total-return index its monthly return embeds duration and price risk, so it is not a clean risk-free *return*; it would make `(Rm - Rf)` noisy and is inconsistent with Sharpe and Sortino |

**Recommendation: Option A, reuse the existing 0.0525 constant.** The decisive reasons are internal consistency (one R_f across the agent) and the (1 - beta) result that makes the series choice immaterial at the portfolio level. If the primary wants a time-varying R_f for register reasons, `crisil_liquid` (Option B) is the cleaner series than the 10Y; Option C reads as conventional but is methodologically the weakest because a long-bond TRI return is not a risk-free return. The honest constraint the kickoff named holds: do not synthesize an R_f that is not present. None of these options does; A and B reuse what exists.

### 1.4 The shared-regression consolidation: what it disturbs

**It consolidates cleanly, and the natural home is `benchRelative` / `aggregate()` in risk-reward-stats, not time-series-performance.** Grounded:

- The full regression already lives in **one place**, `benchRelative` (`lib/agents/risk-reward-stats.ts:269-303`): it computes beta, R-squared, tracking error, and information ratio from the aligned log-returns. Jensen's alpha is the intercept of that same regression. Adding it there puts alpha and beta in the same regression, same benchmark, same window, by construction. So the consolidation the kickoff wants is not a refactor across agents; it is a few lines inside the function that already owns the regression.
- The current cross-file split is not actually disturbed, because the two "alphas" are different objects. The time-series simple alpha (`lib/agents/time-series-performance.ts:242`) is **per holding, per window (1M..SI), read-through against each instrument's own benchmark**; there is no portfolio-level alpha in that agent at all (`SleeveTimeSeries`, `:68-76`, carries no `benchmark_relative`). The Jensen's alpha under discussion is **portfolio-level and sleeve-level, against the client blend**. They do not collide; one is not a migration of the other.
- **Nothing downstream reads the simple-alpha field in a way a methodology change would break.** Audited: `benchmark_relative` and `alpha` are referenced only within `lib/agents/time-series-performance.ts` itself and its schema (`schemas/time_series_performance_output.schema.json:111,124`); no stitcher, component, app route, or other agent consumes `.alpha`. And risk-reward "ships data only; the renderer is untouched (WA9)" (`lib/agents/risk-reward-stats.ts:24-25`), so adding a Jensen's field to its output is additive and unread today. The blast radius of adopting Jensen's is the regression function plus the risk-reward output shape (and its schema if one is added), nothing further.

One build-detail to own, not a blocker: `benchRelative` computes beta and R-squared over the full common intersection but tracking error and information ratio over the trailing 36 (`:289-296`), while the field is named `beta_3y`. Jensen's alpha should state its window and annualisation explicitly and align with whichever convention the primary wants for the benchmark-relative block; flag it so the naming and window stay coherent.

### 1.5 Coexist or replace

**Coexist.** Keep the per-holding simple excess return (it answers "did this instrument beat its own benchmark this window," descriptive and read-through) and add the portfolio-level and sleeve-level Jensen's alpha (it answers "did the book add value after adjusting for the systematic risk it took versus its composition-matched benchmark," risk-adjusted). Replacing the per-holding simple alpha with Jensen's would be wrong: there is no per-holding regression against the client blend to take an intercept from, and the per-holding read-through benchmark is already instrument-appropriate. So the two live at different levels and both are correct there.

### 1.6 Honest limits

Jensen's alpha inherits the same realism ceiling the prior audit flagged. It is computed from the same fund NAVs that were regenerated for index co-movement (product debt P15: risk-reward "ships with Option A calibration, preserve Sharpe and vol; beta as calibrated output with R-squared in band"; ADR-0014), so a calibrated-clean beta produces a calibrated-clean intercept. Combined with the (1 - beta) result (Section 1.2), the honest framing is that **against a composition-matched benchmark Jensen's alpha is a better-framed number, not a more-real one** on this snapshot: it reports value-add in the risk-adjusted register a seasoned advisor trusts, which is the believability payoff, but it does not see through the synthetic data's co-movement calibration. Represent it as the more defensible *framing* of the same evidence, carrying the existing synthetic-forward disclosure (ADR-0019), not as new realism. Adopting it would address product debt P37 (a partial-close motion for a later consented step, not written here).

---

## Question 2: beta lever/unlever. Verdict: does not belong here

### 2.1 The steelman, built honestly

The strongest case for beta lever/unlever (the Hamada capital-structure adjustment) needs a place in the codebase where beta feeds a *valuation* under an assumed capital structure, and there is exactly one such place: the unlisted-equity path. `lib/agents/case/e5-case.ts` and `agents/e5_unlisted_equity.md` are a real valuation agent: "Evaluate valuation framing (last-priced-round, comparable-public, DCF where applicable)" (`lib/agents/case/e5-case.ts:37-38`), with a Valuation framework dimension that lists "Comparable-company multiples in listed peers (with private-company discount)" and "DCF with explicit cash-flow projections" (`agents/e5_unlisted_equity.md:46-50`). Comparable-public valuation and DCF are precisely the settings where the textbook move is to take listed comparables' equity betas, unlever each by its capital structure to an asset beta, and relever to the target's structure to get a cost of equity. The raw input even exists in the snapshot: `debt_equity` is carried per listed company (`lib/agents/snapshot-loader.ts:110`). So in its own domain the technique is correct, and the codebase is not wholly barren of the ingredients.

### 2.2 Why it still does not belong, in this workstream or as currently built

The steelman locates the technique's valid domain, then three facts keep it out:

1. **This agent regresses realised listed returns; there is no capital structure to strip.** `benchRelative` computes an empirical beta from realised NAV and price returns (`lib/agents/risk-reward-stats.ts:269-303`). An empirical beta from market returns already embeds whatever leverage the holdings carry, because the market price already reflects it. Lever/unlever is for converting between *assumed* capital structures of a *modelled* beta, which is not what a realised-return regression produces or needs. This is the category mismatch the kickoff suspected, and the code confirms it.

2. **Even E5, the one valid home, does not use beta.** E5's documented method is multiples plus a private-company discount plus DCF (the worked Surana example uses an EV/Revenue multiple and a 25 to 30 percent discount, `agents/e5_unlisted_equity.md:91`); there is no CAPM cost-of-equity-via-comparable-beta step anywhere in E5, and there is zero lever/unlever, Hamada, asset-beta, or relever machinery anywhere in `lib/` or `agents/` (audited: no hits). So adopting Hamada would not be "reusing" anything; it would be building a new valuation method into a different agent (E5), which is out of this workstream's scope, and onto holdings (Surana's founder stake, Sharma's family business) that are `excludedHoldings`, out of advisory scope, and for which E5 does not even activate on the current seed (`lib/agents/router.ts:111,157`).

3. **It would make the benchmark number less trustworthy, not more.** Mixing the fundamental `debt_equity` ratio (an E1-style display metric, used only for the "D/E" line in the E1 case scope, `lib/agents/case/scope-builders.ts:113`) into a returns-regression beta is methodologically incoherent: it answers a counterfactual ("what beta would this book have at a different leverage") that the believability spec never asks. The spec asks how the realised book moves against its composition-matched benchmark. A capital-structure-adjusted beta would substitute a modelling assumption for an observed quantity, which is the opposite of the believability the workstream is buying.

### 2.3 Verdict

**No.** Beta lever/unlever does not belong in the client-weighted-benchmark or risk-reward returns-regression path. It is a valuation technique from the unlisted and M&A domain; its only valid codebase home is the E5 unlisted-valuation path, which today uses multiples and DCF rather than CAPM betas, runs only for in-scope unlisted equity, and is a separate agent from this workstream. If a future unlisted-valuation workstream ever adopts a comparable-company cost-of-equity method, that is where Hamada would correctly live, and `debt_equity` is the input it would use; that is logged-future-state territory, not this build. Killing it here is the correct call, and it costs nothing this workstream needs.

---

## Registry and numbering (WA21, for the record; not written this session)

- Product debt P37 (Jensen's alpha, scoped to "the benchmarking workstream") would partial-close if Jensen's is adopted; the beta lever/unlever decline is a candidate new future-state entry. Next free D-series id is D13; next free ADR is 0041. This audit creates none of them.
- The task id resolves at landing (WA24).

## Write gate (WA1 / WA19)

This session wrote exactly one thing: this audit file, committed to `features/client-weighted-benchmark`. It did not write agent logic, modify the snapshot or fixtures, or codify any ADR or debt entry (including the P37 partial-close and any beta-levering future-state note). The decisions that are the primary's, surfaced as stop-and-propose (WA28): adopt Jensen's alpha in the recommended form (portfolio and sleeve, in `benchRelative`, coexisting with per-holding simple alpha); the R_f choice (recommended: reuse the 0.0525 constant; `crisil_liquid` if a series is wanted); confirm beta lever/unlever is declined and logged as future-state rather than built. Each, and any ledger or ADR write that follows, needs its own explicit single-purpose go-ahead before the next motion.
