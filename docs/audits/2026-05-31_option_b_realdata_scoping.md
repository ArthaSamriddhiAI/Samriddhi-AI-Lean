# Option B (restore real data): sourcing plan, firm cost, surgical-versus-clean, execution shape

**Date:** 2026-05-31
**Branch:** `features/client-weighted-benchmark` (build held at the Phase 2 stop; capability `acb6125`, back-fill tooling staged but uncommitted; nothing changed by this scoping pass).
**Mode:** Read-only scoping. The only write is this deliverable. All dollar figures are WA12 estimates before any spend. WA2, WA12, WA16 (a re-fire runs the real agents, never hand-authored), WA21, WA27, WA7, WA28 (the go/no-go and the surgical-versus-clean call are the primary's), WA24.
**First-move call:** new dated `docs/audits/` file.

---

## Bottom line

Option B is well-scoped and the expensive part is bounded. The real index series and the three direct-equity prices are standard public total-return data; the fund NAVs are already real in the colleague source. The firm, recorded re-fire cost for the five cases' evidence and diagnostic is **about 12.7 dollars**; A3 re-fires on top of that and is **not** in the recorded logs, adding an estimated **3 to 4 dollars**, for an honest total near **13 to 17 dollars**. On the surgical question the answer is clear and goes against shaving cost: the changed trailing returns are woven into the evidence verdicts and through them into A3, so a partial regeneration is not coherence-safe; a clean full re-fire per case is the right value at this price. One clarification that sharpens the trade: `vol_3y` and `sharpe_3y` are already the real preserved values, so Option B's true payoff over the cosmetic rescale is a genuinely real beta plus a realistic drawdown path (the COVID crash returns), not a change to the headline risk-adjusted stats.

---

## Part 1: the data-sourcing plan

### 1.1 Exactly which series are needed

Grounded from the five cases' evaluable holdings and their read-through `benchmark_index_id` in the snapshot:

**Real index total-return series (9):**
- `nifty_50_tri` (Axis Large Cap, Mirae Large Cap, and the direct stocks Reliance and ITC),
- `nifty_500_tri` (Parag Parikh Flexi),
- `nifty_midcap_150_tri` (Kotak Midcap, the holding labelled Kotak Emerging Equity),
- `nifty_smallcap_250_tri` (SBI Small Cap),
- `nifty_bank_tri` (the HDFC Bank direct holding),
- `nifty_100_tri` (the World A blend's large-cap tier),
- `sp_500_tri_inr` (the international residual the Parag Parikh flexi look-through maps to, and the blend's international leg),
- `crisil_short_term_bond` (Franklin India Corporate Debt),
- `crisil_liquid` (the HDFC Arbitrage holding).

**Real direct-equity price series (3):** Reliance Industries, HDFC Bank, ITC (the only direct listed equity across the five cases; the rest of the equity is funds, and PMS/AIF/FD/gold/savings/international are sentinelled).

(The PMS, AIF, FDs, tax-free bonds, gold, savings, and the Vanguard and US-listed international holdings are sentinelled and need no benchmark.)

### 1.2 Source recommendation, with the total-return constraint flagged

- **Indian index TRIs: niftyindices.com / NSE published Total Return Index series.** This is the authoritative publisher and, critically, publishes the TRI variants by name. The debt series (`crisil_short_term_bond`, `crisil_liquid`) come from CRISIL's published index levels (available via AMFI/CRISIL). Recommended over a generic aggregator.
- **The load-bearing correctness constraint: the index series must be total-return (TRI), not price-return.** Beta regresses the funds' total-return NAVs against the benchmark; a price-return index (for example Yahoo's `^NSEI`, which is price-return) would understate the benchmark return and bias both beta and alpha. niftyindices.com provides the TRI explicitly; confirm TRI on every series pulled. This single constraint is where a careless source choice reintroduces wrongness.
- **Direct-equity prices: dividend-adjusted (total-return) monthly closes** from Yahoo Finance (`Adj Close`) or NSE. Adjusted close is total-return and matches the TRI basis; raw close would mismatch.
- **International: S&P 500 TRI (USD) times USD/INR.** `sp_500_tri_inr` is a derived series; source the S&P 500 total-return index and a real USD/INR monthly series (the colleague source carries no FX block, so USD/INR must be sourced too). This leg matters only for the flexi's small international residual, so it is low-stakes but should still be total-return and currency-consistent.

### 1.3 Reconciliation details that prevent subtle wrongness

- **Window.** The cases regress over the enriched 84-month window, 2019-05 to 2026-04 (the `t0` lookback per its metadata). The real fund NAVs cover it (they run back to 2006-05). Every sourced index must cover 2019-05 through 2026-04 at monthly frequency. Since the as-of is 2026-04-02 and today is past it, the entire window is real and sourceable.
- **Frequency.** Month-end values, to match the monthly `monthly_nav`. Align on the same month-end convention the fund NAVs use.
- **Total-return basis.** TRI indices, adjusted-close stocks, total-return fund NAVs, all consistent (per 1.2).
- **Currency and units.** The international leg in INR (S&P 500 TRI times USD/INR). Index base levels are irrelevant to beta (returns are scale-invariant), so no rebasing is needed; only a consistent monthly return series per source.

### 1.4 What replaces the over-reach in code (specify, do not implement)

The over-reach is ADR-0014's NAV regeneration in `scripts/regenerate_fund_nav.py` (its `--write` path rewrites `monthly_nav` across t0..t8), which overwrote the real fund NAVs with a synthetic single-factor path; and the index synthesis in `scripts/enrich_snapshots.py` (`derive_index_from_constituents`), which built synthetic indices because the source had none. Option B is a contained, deterministic data change at t0:

1. **Bypass the NAV regeneration**: take the real `monthly_nav` for the window straight from the colleague source for the evaluable holdings (do not run `regenerate_fund_nav.py`).
2. **Feed real indices**: replace the synthesized `indices` block series with the sourced real TRI series (the 9 above).
3. **Feed real direct-equity prices**: replace the three direct stocks' synthesized `monthly_prices` with the sourced adjusted closes.
4. **Recompute** the benchmark-relative four (`beta_3y`, `r_squared_3y`, `tracking_error_3y`, `information_ratio_3y`) via the existing ADR-0015 stat functions against the real series. Leave `vol_3y` and `sharpe_3y` (already real and preserved) untouched.

This writes the snapshot (a data change to the frozen `v1.0.0` asset, the same data-repo write decision the rescale would have faced, but larger: it touches NAVs, indices, stock prices, and the recomputed `tier_b`). Minimal scope is the roughly ten evaluable holdings, nine indices, and three stocks at t0; a consistency-minded version restores all funds.

## Part 2: the firm cost of a clean five-case re-fire

From the recorded `tokenUsage` in each fixture, at `claude-opus-4-7` Opus pricing (about 15 dollars per million input, 75 per million output, no prompt caching in the harness):

| case | input tok | output tok | cost |
|---|---|---|---|
| Bhatt | 79,417 | 33,306 | ~$3.69 |
| Surana | 59,740 | 31,187 | ~$3.24 |
| Iyengar | 43,309 | 19,806 | ~$2.14 |
| Malhotra | 43,174 | 19,881 | ~$2.14 |
| Menon | 32,362 | 13,305 | ~$1.49 |
| **total** | **258,002** | **117,485** | **~$12.7** |

**What that figure covers, and what it does not.** The recorded usage is the diagnostic pipeline that generated each case on 2026-05-14/15: the evidence agents (e1, e2, e3, e4, e6, e7 as routed) plus s1 (the briefing and diagnostic synthesis). It does **not** include A3: `a3_so_what` carries no usage field and was back-filled later (2026-05-30, after the recorded generation), so its LLM cost (two calls per case, `runA3ReasonText` and `runA3Judgment`) is outside the 12.7. Estimating A3 at roughly 25k input and 5k output per case puts it near 0.75 dollars per case, about 3 to 4 dollars for five. A2, the metrics, the router, risk-reward, and time-series are deterministic and free.

**Reconciliation with the ~21 already spent:** the five S2 generations (~12.7) plus the A3 back-fill (~4) is about 16.7; the remainder of the 21 is the S1 case-mode batch, IC1, and dev retries, none of which a benchmark re-fire touches.

**Honest total for a clean five-case re-fire: about 13 dollars firm (e1-e7 plus s1), plus about 3 to 4 dollars for A3, so roughly 16 to 17 dollars.**

## Part 3: surgical versus clean

**Mechanically, a surgical re-fire saves little, and it is not coherence-safe. Recommend a clean full re-fire.**

What Option B actually changes is narrower than "all the numbers," and naming it precisely is what decides this:
- **Unchanged (already real):** `vol_3y`, `sharpe_3y`, the 3Y mean return (ADR-0014 pinned these to the real source values), plus all weights, classifications, and fundamentals.
- **Changed:** the beta and the other benchmark-relative three (cited only qualitatively in prose), the **path-dependent trailing returns** (1Y and shorter, the monthly path), and **max drawdown** (the real path restores the COVID crash, so drawdown deepens from about -10% synthetic to about -25% real).

The trailing returns and drawdown are exactly the values the **evidence verdicts cite by value to do their reasoning**: E7's `per_scheme_verdicts` carry "1Y return of 43.14%", "81.8%", "0.99%", and frame the skill-versus-beta judgment on them ("a single-regime beta event, not skill"). A3 in turn cites per-holding performance by value (`sharpe 1.0601`, weight percentages) and consumes the evidence verdicts. So the changed values are not isolated in a performance block; they are the premises of the verdicts and they flow downstream into A3's reconciliation.

That fails both axes of the surgical test:
1. **Cheaper?** Only marginally. To change "the 1Y is 43.14%, therefore regime beta" you must rewrite the verdict that reasons from it, which is re-firing E7; s1 synthesizes all evidence, so it re-fires; A3 reads the diagnostic, so it re-fires. The cascade reaches almost everything that costs credits. The only genuinely preservable prose is the parts resting on `vol_3y`/`sharpe_3y` (unchanged), but those are interleaved sentence-by-sentence with the changed returns inside the same verdicts, so they cannot be cleanly excised.
2. **Coherence-safe?** No. If you regenerated a performance block against the real numbers but kept verdict and so-what prose written against the synthetic numbers, the case would say one thing in its performance section and reason from a different number in its verdict. For a believability product an internally inconsistent case is worse than a slightly more expensive clean one. The kickoff's own guidance applies: at five cases and roughly 13 to 17 dollars, do not contort the regeneration to save a few dollars at the cost of case quality.

**Recommendation: clean full re-fire per case (e1-e7, s1, A3).** The surgical saving is small and not coherence-safe; the clean re-fire is the correct value.

## Part 4: the execution shape (specify, do not execute)

1. **Source the real series (deterministic, no API):** the 9 TRI indices and USD/INR from niftyindices.com / CRISIL, the 3 adjusted-close stock series from Yahoo or NSE, all monthly, total-return, covering 2019-05 to 2026-04. Validate coverage and the TRI basis (Part 1.2-1.3).
2. **Code change to undo the over-reach (deterministic, no API):** bypass `regenerate_fund_nav.py`, load the real fund `monthly_nav` for the window, swap the synthesized `indices` and the three stocks' `monthly_prices` for the sourced real series (Part 1.4). Decision to surface: write the snapshot back as a new data-repo version, or apply the swap as a deterministic pipeline transform.
3. **Recompute (deterministic, no API):** the benchmark-relative four against the real series via the ADR-0015 stat functions; leave `vol_3y`/`sharpe_3y` as-is.
4. **WA12 cost gate before any LLM spend:** surface the firm re-fire estimate (Part 2) and get the explicit go-ahead. This is the only step that spends.
5. **Clean full re-fire of the five cases (API, about 13 to 17 dollars):** run the real agents per case (WA16; never hand-authored), e1-e7, s1, A3. The deterministic risk-reward back-fill (the staged tooling) then refreshes `content.risk_reward_stats` against the real snapshot.
6. **Phase 2 re-validation (deterministic, no API):** confirm the betas land believable on real data (real large-cap fund vol versus real large-cap index vol should sit near 1 with no rescale), and confirm the drawdowns now reflect the real COVID path.
7. **Documentation (no API):** the correcting appends to the prior audits already specified, plus an ADR (next free 0041, confirm at landing) and a data-debt entry recording that ADR-0014's regeneration discarded real fund history and was reversed for the five cases, with the production path (real data throughout) noted.

**Cost flags:** steps 1-4, 6, 7 are deterministic and free; step 5 is the sole API spend, about 13 to 17 dollars, gated at step 4.

This scopes, costs, and recommends; it sources nothing, changes nothing, fires nothing. The build stays parked at the Phase 2 stop, the back-fill tooling uncommitted, awaiting the primary's go-ahead and the clean-versus-surgical decision.
