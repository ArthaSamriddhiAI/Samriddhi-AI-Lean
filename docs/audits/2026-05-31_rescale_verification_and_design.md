# Verifying the $0 prose-reuse claim and designing the equity-index rescale (2-lite-B)

**Date:** 2026-05-31
**Branch:** `features/client-weighted-benchmark` (build held at the Phase 2 stop; capability `acb6125`, provenance `8858114`, strategic cost `d7b55ab`; back-fill tooling staged but uncommitted; nothing changed by this audit).
**Mode:** Read-only verification and design. The only write is this deliverable. Dollar figures are WA12 estimates, not a spend. WA2, WA21, WA27, WA7, WA28 (the design and go/no-go are the primary's; this verifies, designs, recommends), WA24 (ids resolve at landing).
**First-move call:** new dated `docs/audits/` file per the established one-file-per-audit convention.

---

## Part 1: the $0 prose-reuse claim, now verified airtight

**Verdict: confirmed. 2-lite-B is genuinely $0 API.** No reused prose, in any block, in any of the five cases, cites a *value* of any of the four fields the rescale changes (beta, R-squared, tracking error, information ratio). The only place those four values live is `content.risk_reward_stats`, which refreshes deterministically. Every LLM-authored block is reusable as-is.

**Block authorship (confirmed, not assumed).** The eight `content` blocks split cleanly: LLM-authored are `briefing` (the Samriddhi 1-style diagnostic narrative), `evidence` (the e1 through e7 agent verdicts), and the reason-text inside `a3_so_what`; deterministic are `a2_classification`, `metrics`, `risk_reward_stats`, `router_decision`, `usage_summary`. The evidence agents emit verdict prose, not embedded risk numbers: e7's structure is `analysis_scope, escalate_to_master, per_scheme_verdicts, reasoning_summary, scope_notes`, and its only risk-named fields are the qualitative `skill_vs_beta` and `key_risks`.

**The four fields, searched exhaustively across all five cases' LLM prose:**

- **Beta:** 51 mentions total, every one qualitative. They are skill-versus-market language ("this is not skill; it is beta with fee drag", "a beta vehicle that happened to catch a regime tailwind", "single-regime EM beta event, not skill", "beta drift", "deep India macro beta") and benchmark-name usage ("Returns are pure Nifty 50 beta", "provides efficient Nifty 50 beta"). Zero "beta of 1.5" value citations: the only digit-adjacent hits are sentence boundaries ("beta. The 1Y return...") and index names ("Nifty 50 beta"). `a3_so_what` cites beta zero times.
- **R-squared / correlation:** no `R-squared` value citations anywhere. The only correlation hit is "equities tend to sell off together (correlation ~0.6-0.7 in stress periods)", a general cross-equity stress observation, not a fund-versus-benchmark R-squared, and the rescale preserves R-squared regardless.
- **Tracking error:** all qualitative concepts ("minimal tracking error", "very low tracking error", "tracking error is the only source of deviation", "improving tracking efficiency (lower tracking error over time)", "returns are benchmark returns minus tracking error and TER"). No value citations.
- **Information ratio:** not cited at all, by name or as "IR of", in any block.

**The prose leans on the preserved quantities, not the changing four.** The quantitative claims rest on trailing returns ("the 1Y return of 43.14%"), regime stability ("regime stability of 0.077"), TER ("ter_pct 1.58"), and Sharpe/vol, all of which the rescale leaves byte-identical because it never touches the fund NAVs (ADR-0014 Option A pins `vol_3y` and the sharpe-implied return; the NAV path itself is untouched, so trailing returns and drawdown are untouched too).

**The evidence-agent verdicts survive, agent by agent.** e1 (listed equity) and e7 (mutual fund) are the only agents that engage risk language, and both anchor verdicts on returns, regime-dependence, and skill-versus-beta judgments, never on a beta or tracking-error value ("Returns are pure Nifty 50 beta; no downside protection", "this is beta with fee drag", "single-regime beta event, not skill"). e2, e3, e4 (industry, macro, behavioural) and e6 (wrappers) carry no benchmark-relative values. No agent's verdict or reasoning is anchored on a value the rescale moves.

**The deterministic reused blocks are also clean.** `a2_classification`, `metrics`, and `router_decision` contain zero `beta` / `r_squared` / `tracking_error` / `information_ratio` tokens across all five cases, so they carry no stale values either; only `risk_reward_stats` does, and it is the one block that refreshes.

So this is not "almost all reusable" rounded up. It is all reusable, verified. The deterministic `risk_reward_stats` refresh is the entire change to the case fixtures, and it costs no credits.

---

## Part 2: the rescale design

### 2.1 Where the rescale applies, and that it is contained

The transform applies to each equity index's `monthly_values` in the snapshot's `indices` block, downstream of synthesis (a post-hoc operation on the already-generated series, not a change to `enrich_snapshots.py`'s factor-model parameters). It is a contained deterministic map over at most 9 series of 84 values each. For each rescaled index, with `r_t` the monthly log returns and `mu = mean(r)`:

```
r'_t = mu + k * (r_t - mu)          (demeaned scaling)
level'_t = level'_{t-1} * exp(r'_t)  (re-accumulate from the same base)
```

The demeaning is deliberate and load-bearing: it scales the volatility by `k` while preserving the mean log return, hence the cumulative return and the start and end levels. The index ends where it ended; only the path's amplitude changes.

### 2.2 Scope discipline: only the domestic equity tiers, only t0

Measured realized annualised vols at t0 against realistic segment norms:

| index | realized vol | realistic segment | rescale? |
|---|---|---|---|
| nifty_50_tri / nifty_100_tri / bse_sensex_tri / nifty_next_50_tri | 0.088 / 0.085 / 0.090 / 0.083 | large-cap ~14-16% | yes |
| nifty_500_tri | 0.082 | broad ~15% | yes |
| nifty_midcap_150_tri | 0.088 | mid ~18-20% | yes |
| nifty_smallcap_250_tri | 0.131 | small ~22-24% | yes (least wrong) |
| nifty_bank_tri / nifty_it_tri | 0.105 / 0.106 | sector ~22-25% | yes |
| **sp_500_tri_inr** | **0.147** | US+INR ~15-16% | **no, already realistic** |
| crisil_* / nifty_10y_gsec / gold_inr | 0.007 to 0.064 | debt/commodity | **no, correct by design** |

`sp_500_tri_inr` is synthesized independently at 4.5% monthly vol (ADR-0009:70-71), which lands at 0.147 annualised, already realistic; its implied k is 1.09, within noise. Leave it and all debt indices untouched. Only the 9 domestic equity TRIs are wrong, and only those are rescaled.

**t0 only.** The five cases all load `t0_q2_2026`, and t0 is the baseline (`evolution_type: "baseline"`, `evolved_fields: []`), so it carries no regime beats. Rescaling t0 therefore amplifies no narrative beat. The forward snapshots t1..t8 do carry beats (placed in indices via constituents, ADR-0009/0014); rescaling those would scale the beats by `k` (a -16% bank shock would deepen toward -28%), changing narrative severity and breaking the regime probes. So leave t1..t8 untouched, accept a documented t0-to-t1 equity-vol discontinuity that no current case touches, and log the forward-snapshot rescale (plus its regime re-calibration) as future-state debt.

### 2.3 The invariant check and the honest knock-ons

- **R-squared is preserved exactly.** Scaling demeaned returns by `k` gives `cov -> k*cov`, `var -> k^2*var`, so `beta -> beta/k` while `corr = cov / (sd_F * sd_I)` is unchanged (the `k` cancels). R-squared, the co-movement ADR-0014 calibrated, survives untouched. Betas normalise without half-normalising anything.
- **Mean, cumulative return, and endpoints are preserved** by the demeaning, so the index's performance story is unchanged.
- **Alpha is not disturbed in any stored artifact.** Time-series-performance (which holds the simple-excess alpha) is not persisted in the S2 case fixtures (no `time_series` block), so there is no stored alpha to stale. The Jensen's alpha in `risk_reward_stats` uses the benchmark's mean return, which the rescale preserves, plus beta, which it changes; that recomputes deterministically in the refreshed block.
- **No index Sharpe or vol is displayed anywhere.** Indices carry only `monthly_values`, no `tier_b`, so raising index vol changes no shown statistic outside the benchmark-relative four.
- **The normalization-base inconsistency is left alone, on purpose.** The equity TRIs are terminal-normalized and the debt/intl series start-normalized; the demeaned rescale preserves the terminal base. Because every consumer (the blend, benchRelative) works on returns, the base is return-invariant and does not affect any beta, so fixing it would be scope creep with no payoff. Leave it (WA5).
- **The one real knock-on is the ADR-0009 invariant** (documented in 2.6).

### 2.4 The cleverer approach: calibrate to the betas, not to naive index vol

This is the high-value correction to the per-tier proposal. A per-tier `k` is better than a single global `k`, but **targeting each index to its realistic segment vol over-corrects the segments whose funds were already fine.** The small-cap index is the proof: SBI Small Cap already reads beta 1.0204 versus `nifty_smallcap_250` (because that index's realized vol, 0.131, is already close to the fund's vol). Rescaling small-cap to a "realistic" 0.22 (k 1.675) would push that fund to beta 1.02 / 1.675 = 0.61, which is a new believability problem in the opposite direction: an advisor distrusts a small-cap equity fund at 0.6 almost as much as a large-cap fund at 1.5.

So the target should be the **resulting fund betas, not the index vol in isolation.** I recommend a **per-index variance-match calibrated so the representative fund benchmarked to each index lands at beta ~0.9 to 1.05**, the believable centre. Because `beta = corr * vol_fund / vol_index` and the funds' preserved vols are roughly their real segment vols, this means setting each index's target vol near its segment's typical fund vol (so beta lands near `corr`, about 0.9 for active equity at R-squared 0.80). The implied k differs sharply from the naive table:

| segment | representative stored beta | naive-vol k | **beta-centred k (target beta ~0.95)** |
|---|---|---|---|
| large (vs nifty_50/100) | ~1.49 (Axis 1.466, Mirae 1.524) | ~1.78 | **~1.57** |
| mid (vs nifty_midcap_150) | ~1.4 (estimate; confirm at exec) | ~2.05 | **~1.47** |
| small (vs nifty_smallcap_250) | ~1.02 (SBI 1.020) | ~1.68 | **~1.07 (barely touched)** |

The beta-centred k is self-correcting: large-cap (the most inflated) gets the most rescale, small-cap (already fine) gets almost none. This is what a per-tier-vol target misses. Mechanically it is the same variance-match; only the targets change, and the targets are chosen by the betas you want to see. The exact per-index k is a product-shaping default (WA28); the execution phase should set them by re-running Phase 2 and tuning until the per-holding and portfolio betas land believable, rather than hard-coding a vol table.

(If the primary prefers index vols that are themselves realistic over betas that centre cleanly, that is the naive-vol table and it is defensible, but it ships some equity funds at beta 0.6 to 0.7. The two cannot both be exact because the funds' preserved vols are what they are; this is the genuine choice to make.)

### 2.5 Recommended design, in one line

Per-index variance-matching rescale (demeaned, R-squared-preserving) on the 9 domestic equity TRIs at t0 only, with per-index `k` calibrated to centre the representative fund betas near 0.95 and validated by re-running Phase 2; `sp_500_tri_inr`, the debt indices, gold, and t1..t8 left untouched.

### 2.6 Documentation obligation (specify; do not write now)

- **A new ADR (next free 0041 per the prior audits, confirm at landing):** records the post-hoc equity-index rescale, the per-index k and targets, the believability rationale, the invariants preserved (R-squared, mean, cumulative, endpoints) and the one broken (the equity TRI no longer equals its constituents' market-cap-weighted return). It amends ADR-0009 for the equity TRIs at t0 and resolves the elevated-beta consequence ADR-0014 flagged. Cross-reference ADR-0009, ADR-0014, ADR-0015.
- **A data-debt entry (next free D13 per the prior audits, confirm at landing):** the equity indices at t0 are rescaled and no longer reconstructable from constituents, so any future index-from-constituents work (the regime probes in `scripts/_verify-snapshot-enrichment.ts`, any holdings-to-index reconstruction) must know this; and t1..t8 retain the un-rescaled low vol, so a forward-snapshot demo needs the same rescale plus regime re-calibration. The production path (real index data, ADR-0014:58) supersedes the rescale.
- **The regime probes** must be cross-referenced so a future maintainer does not assert index-equals-constituents against a rescaled t0.

---

## Part 3: the execution shape (specified, not executed)

In order, once greenlit:

1. **Deterministic equity-index rescale (no API).** A new script rescales the 9 domestic equity TRI `monthly_values` at t0 by the per-index k (demeaned, re-accumulated). Decision to surface for the primary: whether this writes back to the private data repo (a new data version beyond `v1.0.0-frozen`) or is applied as a deterministic transform in the consuming pipeline; the snapshot is a frozen cross-repo asset, so this is a real choice, and it is the first time this workstream writes data rather than agent code.
2. **Deterministic tier_b recompute (no API).** Recompute the benchmark-relative four (`beta_3y`, `r_squared_3y`, `tracking_error_3y`, `information_ratio_3y`) for the affected funds and stocks against the rescaled indices, reusing the existing ADR-0015 stat functions. NAVs are not regenerated (R-squared is preserved, vol and Sharpe are preserved); only the four recompute. R-squared lands identical, beta divides by k.
3. **Deterministic risk-reward refresh (no API).** Run the already-staged back-fill tooling, which writes only `content.risk_reward_stats` across the five S2 cases. It covers this step as-is, since it reads the (now rescaled) snapshot deterministically; the staged tooling is exactly what step 3 needs.
4. **The gated ADR and debt writes (no API):** ADR-0041 and the D13 data-debt entry per 2.6.
5. **Re-run Phase 2 validation (no API):** confirm the per-holding and portfolio betas now land believable (target ~0.8 to 1.1) across the five cases, and tune the per-index k if any segment over- or under-shoots. This is the loop that sets the final k.
6. **Revisit the parked narration decision (downstream):** with betas near 1 by genuine composition match rather than by artifact, the structural-beta sentence from the earlier Phase 2 finding may be unnecessary or should be reframed; that remains the primary's call and is downstream of this fix.

**WA12 picture:** every step above is deterministic. **Total API cost: $0.** The only expenditures are compute time and the dev effort to write the rescale script and tune the targets. Part 1 verified there is no hidden re-fire.

This audit verifies and designs; it executes nothing. The build stays parked at the Phase 2 stop, the back-fill tooling uncommitted, the snapshot unchanged, awaiting the primary's go-ahead on the design (and the per-index targets) before any execution.
