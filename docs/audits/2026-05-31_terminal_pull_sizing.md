# Terminal pull sizing: making the snapshot real to the universe, and the comprehensive pull list

**Date:** 2026-05-31
**Branch:** `features/client-weighted-benchmark` (code repo). Audit-only; this reasons about the data, it does not write the data repo.
**Mode:** Read-only sizing audit. The primary has Bloomberg terminal access and has already pulled real equity index TRIs, FX, and 13 stocks (COVID-validated). This sizes tomorrow's comprehensive pull to the snapshot universe. WA2, WA21, WA27, WA7, WA28 (the pull scope and the R_f-debt closure are the primary's calls), WA24.
**First-move:** new dated `docs/audits/` file.

---

## 1. Debt indices, sized to the snapshot's debt-fund universe

The snapshot's debt-fund universe spans the full duration ladder and the full credit range. Counts by `sebi_category`:

| duration bucket | categories (counts) |
|---|---|
| cash-adjacent | Liquid 48, Overnight 34, Money Market 26, Ultra Short 26, Low Duration 25, Floater 12 |
| short | Short Duration 26 |
| medium | Medium 13, Medium to Long 14 |
| long | Long Duration 11 |
| gilt | Gilt 28, Gilt 10yr Constant 5 |
| credit-defined | Corporate Bond 23, Banking & PSU 21, Credit Risk 14 |
| spans-by-design | Dynamic Bond 24 |
| passive | Debt Index Funds 99, ETFs-Debt 27 |

Per ADR-0037's 2D framework (`DEBT_2D_CATEGORIES`, `creditBucketOf`, `lib/agents/instrument-selection.ts:43-88`), the duration axis is short (< 3y) / medium (3-5y) / long (> 5y) plus the cash-adjacent and gilt families, and the credit axis is sovereign / high-grade (AAA) / credit-risk. The current snapshot ships only 5 debt indices (`crisil_composite_bond`, `crisil_short_term_bond`, `crisil_dynamic_gilt`, `nifty_10y_gsec`, `crisil_liquid`), which cover a diagonal slice, not the whole grid. To give every debt-fund cell in the universe a matching benchmark, pull the Nifty Fixed Income family (the primary already pulls Nifty symbology cleanly; CRISIL SEBI-renamed series are alternates):

**Duration ladder (high-grade / composite):**
- Nifty Overnight Index (alt: CRISIL Overnight)
- Nifty Liquid Index (have `crisil_liquid`)
- Nifty Money Market Index
- Nifty Ultra Short Duration Debt Index
- Nifty Low Duration Debt Index
- Nifty Short Duration Debt Index (have `crisil_short_term_bond`)
- Nifty Medium Duration Debt Index
- Nifty Medium to Long Duration Debt Index
- Nifty Long Duration Debt Index
- Nifty Composite Debt Index (have `crisil_composite_bond`)

**Credit-defined:**
- Nifty Corporate Bond Index (AAA) (covers Corporate Bond 23)
- Nifty Banking & PSU Debt Index (covers Banking & PSU 21)
- Nifty Credit Risk Bond Index (AA and below) (covers Credit Risk 14)
- Nifty AAA Corporate Bond Index (the high-grade credit anchor)

**Gilt:** Nifty Gilt (dynamic / all-duration) (have `crisil_dynamic_gilt`); the 10yr benchmark and the rest of the curve come from area 2.

**Floater (12):** maps to a floating-rate / money-market proxy; low priority, can ride the Money Market index. **Dynamic Bond (24):** spans credit and duration by design, so it has no single clean benchmark (it stays `benchmark_structurally_inapplicable`, footnoted, like an opaque wrapper); do not pull a special index for it. **Debt Index Funds (99) and ETFs-Debt (27):** these track an index already; their benchmark is whichever of the above index they replicate.

Net new debt indices to pull: roughly 11 to 13 (the universe set above minus the 5 already shipped).

## 2. The G-Sec curve, sized to the duration span

For tenor-matched gilt and long-duration benchmarking, and for forward time-stepping of the curve, pull the curve, not two points. Sized to the universe's duration span (overnight to long gilt) and the two risk-free needs (area 3):

- 91-day T-bill (cash tier; the short risk-free)
- 1yr G-Sec
- 2 to 3yr G-Sec
- 5yr benchmark G-Sec
- 7yr G-Sec
- 10yr benchmark G-Sec (the long anchor; the CAPM risk-free)
- 15yr G-Sec
- 30yr G-Sec (long-duration anchor)

The 91-day T-bill and the 10yr benchmark do double duty as the two risk-free rates. Bloomberg carries these as the FBIL/CCIL benchmark G-Sec yields and the Nifty G-Sec duration indices; pull the level/yield series, max history.

## 3. Risk-free rate: the wiring, confirmed, and a cascade the primary should know

**Every static-R_f consumer is in one file.** `RISK_FREE_ANN = 0.0525` (`lib/agents/risk-reward-stats.ts:38`) is read only in `risk-reward-stats.ts`: `sharpe` (`:272`), `sortino` (`:277`, `:283`), Jensen's alpha in `benchRelative` (`:343`), and the output `risk_free_rate` field (`:708`). Audited: neither `time-series-performance.ts` (which computes simple excess-return alpha, no R_f) nor `portfolio-risk-analytics.ts` carries its own R_f. So wiring a time-varying R_f into the agent runtime is a single-file change that hits sharpe, sortino, and Jensen's together.

**The non-obvious cascade: the per-holding Sharpe is read-through, not recomputed at runtime.** The sleeve and portfolio Sharpe/Sortino are computed fresh in `aggregate()` and will pick up the time-varying R_f directly. But the per-holding Sharpe/Sortino are read-through from `tier_b_stats.sharpe_3y` / `sortino_3y`, which were computed during enrichment against the static 5.25%. To keep per-holding and sleeve consistent on the same R_f, the per-holding `tier_b` must be recomputed with the time-varying R_f. This folds naturally into the Option B tier_b recompute (which already runs against the real series), so it is free and deterministic, but it must be done or the two levels disagree.

**Consequences to note for the ADR:** moving to time-varying R_f recomputes Sharpe and Sortino, which were real-preserved, so they will shift (this is expected, not a regression). It closes the R_f convenience-debt entry cleanly (the entry logged the 0.0525 constant as a lean-MVP shortcut with the time-varying gilt path as enterprise-correct; pulling both rates retires it). And recall the earlier finding: against a composition-matched benchmark, portfolio Jensen's alpha is near-insensitive to R_f (it enters only through the (1 - beta) term), so the richness of a real R_f pays off most in Sharpe/Sortino and at the sleeve and holding level, less in the headline portfolio Jensen's.

## 4. The Nifty 500 stock-price question: verdict

**Stock `monthly_prices` are synthesized** (the regrounding established stock prices were among the genuinely-absent, synthesized data; the colleague source carries no stock monthly series, and `nifty500.companies[].monthly_prices` is a `new_fields_added` enrichment block). **What consumes them: only direct-equity holdings.** `risk-reward-stats.ts:369-370` and `time-series-performance.ts:495` read a stock's `monthly_prices` only when a holding is a direct listed stock (`findStock`). The indices are read pre-stored at runtime (`risk-reward-stats.ts:490`, `time-series-performance.ts:507` read `snapshot.indices[id].monthly_values`); nothing rebuilds an index from its constituents at runtime (`derive_from_constituents` was enrichment-time only). So once real index levels are stored, the 500 constituents are not needed for index integrity.

**Verdict.** The must-pull is the direct-equity stocks held by the current and future test investors (the ~13 to 22 already pulled), because a real direct holding must regress against the real index (a synthetic Reliance price against a real Nifty would be a basis mismatch). The full Nifty 500 is **future-insurance, not a current fix**: it covers any future investor's any direct-equity pick, consistent with the universe framing, but it changes nothing for the five cases or for benchmarking. Given the primary's "pull to the universe, more is cheap now" intent, pulling all 500 is defensible and future-proofs the direct-equity path in one trip; the only cost is the BDH scale (500 series versus the ~22 of today). Recommendation: pull all 500 if the session size is acceptable, otherwise the direct-holding subset is sufficient and nothing breaks.

## 5. Meta-inventory: every synthetic-but-pullable series

| series | synthetic today? | pullable real? | does the build use it? | action |
|---|---|---|---|---|
| equity index TRIs | yes (synthesized) | yes (Nifty TRI) | yes (benchmark) | DONE today |
| FX `usd_inr` | yes | yes | yes (intl conversion) | DONE today |
| FX `eur_inr` / `gbp_inr` / `aed_inr` | reserved null | yes | only if future intl in those currencies | optional, low priority |
| debt indices (5 shipped) | yes | yes (Nifty Fixed Income) | yes (debt benchmark) | EXPAND to universe (area 1) |
| G-Sec curve | partial (`nifty_10y_gsec`) | yes (FBIL/CCIL) | yes (gilt tenor + R_f) | PULL (area 2) |
| both risk-free rates | static 0.0525 constant | yes (91-day + 10yr) | yes (sharpe/sortino/Jensen's) | PULL (area 2/3) |
| stock `monthly_prices` | yes | yes | only direct-equity holdings | direct holdings MUST; all-500 optional (area 4) |
| fund `monthly_nav` | over-reach synthetic (real exists in source) | n/a, restore from source | yes (the load-bearing series) | RESTORE from colleague source (no pull) |
| `gold_inr` | yes (synthesize_macro_anchored) | yes (gold price) | gold is sentinelled in risk-reward (not evaluable) | low priority; pull only if gold benchmarking is wanted |
| `macro` block | reference data (`data_snapshot: {dimensions, source_file}`), not a fabricated monthly series | n/a | not a regression series | leave as reference |
| `tier_b_stats`, `rolling_metrics` | derived | n/a, recompute | yes | RECOMPUTE from real series, not pulled |

So the only fabricated monthly series the build actually regresses over are the index series (done plus the debt/gilt expansion), the FX (done), and the stock prices (direct holdings). The fund NAVs are restored from source, not pulled. Everything else is either derived (recompute) or reference (leave).

---

## The complete sized pull list for tomorrow

**Must pull (makes the universe real for benchmarking):**
1. Debt indices to the universe (area 1): roughly 11 to 13 Nifty Fixed Income series spanning overnight, liquid, money market, ultra-short, low, short, medium, medium-to-long, long, composite, corporate bond (AAA), banking and PSU, credit risk.
2. The G-Sec curve (area 2): 91-day T-bill, 1yr, 2-3yr, 5yr, 7yr, 10yr benchmark, 15yr, 30yr. The 91-day and 10yr are the two risk-free rates.

**Strongly recommended (universe future-insurance):**
3. Nifty 500 stock prices: at minimum the direct-equity holdings of current and future test investors (mostly done); the full 500 if the BDH session size is acceptable.

**Optional / low priority:**
4. `eur_inr` / `gbp_inr` / `aed_inr` (only if future international holdings need them), `gold_inr` (only if gold benchmarking is wanted).

**Not pulled (handled otherwise):** fund `monthly_nav` (restore from the colleague source), `tier_b_stats` and `rolling_metrics` (recompute deterministically from the real series), `macro` (reference, leave).

### Spec reminders for the pull
- **Total return.** Equity indices and stocks must be total-return (TRI / adjusted), to match the total-return fund NAVs; debt indices are total-return / accrual by construction, pull the TR variant.
- **Max history.** Pull the longest available history (the build window is 2019-05 to 2026-04, but max history future-proofs time-stepping and longer windows).
- **Monthly at minimum.** Monthly month-end to match the fund NAVs; daily is finer and downsamples cleanly if the primary prefers one pull granularity.
- **The inverted COVID gut-check for debt.** Equity validates by showing the March 2020 crash (about -23%). Debt validates by the inverse: high-grade and gilt debt should be roughly flat or slightly up in March 2020 (the real Franklin Corporate Debt was -1.1%), and only credit-risk debt should show a modest stress dip. A debt index that "crashed" like equity in March 2020 is mis-pulled (wrong series or price-return artifact).

This audit sizes and recommends; it pulls nothing and writes no data. The build stays parked at the Phase 2 stop; the pull and the later data write are separate gated steps.
