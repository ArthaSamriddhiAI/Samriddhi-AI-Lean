# FIMMDA debt-cell sizing: which cells the universe needs, what is covered, the corporate-credit shopping list

**Date:** 2026-06-01
**Branch:** `features/client-weighted-benchmark` (code repo). Read-only sizing audit; no pull, no data change, no agent run, no spend. WA2, WA21, WA22, WA27, WA7, WA28 (the pull scope is the primary's call).
**First-move:** new dated `docs/audits/` file.

---

## 1. The debt cells the universe actually occupies

Classifying the full snapshot debt-fund universe through ADR-0037's 2D framework (`creditBucketOf` `lib/agents/instrument-selection.ts:227`, `durationBucketOf :244`), the populated duration-by-credit cells are:

| count | cell (credit x duration) | what sits here |
|---|---|---|
| 55 | high_grade x short | Corporate Bond, Banking & PSU, Short Duration (AAA/AA, < 3y) |
| 40 | sovereign x long | Gilt funds (long G-Sec) |
| 20 | high_grade x medium | high-grade 3 to 5y |
| 19 | credit_risk x short | Credit Risk funds, short |
| 11 | high_grade x long | high-grade > 5y |
| 7 | credit_risk x medium | Credit Risk funds, medium |
| 1 | sovereign x medium | a single gilt |
| 1 | sovereign x short | a single gilt |
| 1 | credit_risk x long | a single long credit-risk |

Plus, outside the 2D grid: **cash-adjacent 171** (Liquid 48, Overnight 34, Money Market 26, Ultra Short 26, Low Duration 25, Floater 12), **Dynamic Bond 24** (spans credit and duration by design, stays `benchmark_structurally_inapplicable`, footnoted), and **Debt Index / ETFs-Debt 126** (these track an index already; their benchmark is whichever curve they replicate, not a new pull).

**The mass is exactly where the primary expected.** High-grade corporate credit dominates: 86 funds (55 short + 20 medium + 11 long). Credit-risk is real but a third the size: 27 funds (19 + 7 + 1). Sovereign is 42 (almost all long gilt). So the FIMMDA pull should be AAA-heavy with a thinner AA/A tail, not the full BBB/A/NBFC surface.

## 2. What the already-pulled series already cover

- **The G-Sec curve** (91-day T-bill, 1/3/5/7/10/15/30yr) covers the **sovereign cells across the whole duration axis** (the 42 gilt funds: sovereign x short/medium/long). No FIMMDA needed for sovereign.
- **Overnight (NIFTY1D) + Liquid (LIX15)** cover the **cash-adjacent floor** (the 171 Liquid/Overnight/Money Market/Ultra Short/Low/Floater funds).

So FIMMDA only has to fill the **corporate-credit middle**: high_grade (86) and credit_risk (27), across the duration axis. It is not a re-pull of duration the G-Sec curve already gives.

## 3. The FIMMDA cell shopping list (credit x tenor, TR variant)

Sized to the occupied corporate-credit cells plus a sensible buffer, resolving the duration buckets to FIMMDA tenors (ADR-0037: short < 3y, medium 3 to 5y, long > 5y). The primary resolves each cell to its `BCOP...` ticker via SECF; pull the **total-return variant** (Section 4).

| credit tier | tenors to pull | serves | priority |
|---|---|---|---|
| **AAA** | 3M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y | the 86 high-grade funds across short/medium/long; the dominant mass | core, full ladder |
| **AA / AA+** | 1Y, 3Y, 5Y | lower high-grade and the AA edge of Corporate Bond | core |
| **A** | 2Y, 3Y | the 27 credit-risk funds (mostly short/medium) | core (thinner) |
| **BBB** | 3Y | the credit-risk tail (a single representative); buffer | buffer |
| **PSU (AAA)** | 3Y, 5Y | the 21 Banking & PSU funds (a distinct PSU credit cut) | core |
| **NBFC** | 2Y, 3Y | NBFC-tilted corporate exposure; future funds | buffer |

That is roughly 16 to 18 cells, not the 454-surface. The AAA full ladder is the load-bearing pull (it lets the blend map a fund's actual Duration to the nearest AAA tenor precisely); AA/A/PSU fill the credit_risk and PSU mass; BBB/NBFC are the generous-but-bounded buffer for future funds the primary asked for. Pull more AAA tenors freely if the template makes it trivial; do not pull the deep BBB/A x every-tenor grid, the universe does not occupy it.

(No `BCOP...` tickers are visible to this audit; the 454-list is partial. Resolve cells to tickers at the terminal via SECF.)

## 4. TR-vs-yield: the load-bearing storage check

**The snapshot stores debt benchmarks as total-return levels, not yields. Confirmed.** The 5 shipped debt indices are base-1000 growing levels:

```
crisil_composite_bond  2019-05=1000.0  2022-01=1248.97  2026-04=1772.23
crisil_short_term_bond 2019-05=1000.0  2022-01=1175.64  2026-04=1478.71
crisil_dynamic_gilt    2019-05=1000.0  2022-01=968.30   2026-04=1379.26  (dips when rates rose, but a level)
nifty_10y_gsec         2019-05=1000.0  2022-01=1232.73  2026-04=1536.98
crisil_liquid          2019-05=1000.0  2022-01=1204.91  2026-04=1562.38
```

A yield series would oscillate around 6 to 7 percent; these accrue upward (dynamic_gilt even dips on rate moves, the signature of a total-return bond level, not a yield). The ingestion and recompute consume them as `indices[id].monthly_values` and take log returns (`benchRelative`, `blendIndexReturns` in `lib/agents/risk-reward-stats.ts`). So:

- **Pull the FIMMDA total-return variant.** A TR curve drops straight into `indices[cell_id].monthly_values` with no conversion. The FIMMDA yield variant would need a yield-to-return conversion (duration-weighted accrual plus price change), which is avoidable, so do not pull yields for the benchmark cells.
- **The G-Sec curve has a dual-flavor requirement, flag this.** The 91-day and 10yr "double as the risk-free rates" and are consumed by the new `seriesRiskFree(annualByMonth, ...)` (Task 3) as annualised **rates/yields**, while the gilt-as-benchmark use (e.g. the existing `nifty_10y_gsec` is a TR level) wants **total-return levels**. So the 10yr G-Sec is needed in **both** flavors: the yield series for the CAPM risk-free in Jensen's, and the TR level for the sovereign-cell benchmark. The 91-day T-bill is needed as a **yield** only (the short risk-free for sharpe/sortino). The rest of the curve (1/3/5/7/15/30yr) is needed as **TR levels** (the sovereign-tenor benchmarks). Confirm the already-pulled G-Sec covers both the yield (for R_f) and the TR level (for the gilt benchmarks); if only one flavor was pulled, the other must be added (cheap) rather than converted.

## 5. How the FIMMDA curves slot into decomposeHeldDebt

The per-cell curve approach is exactly what the blend seam expects. `decomposeHeldDebt` (`lib/agents/instrument-selection.ts`, built in Task 4) returns `{credit_bucket, duration_bucket}` per held debt fund; the open blend seam maps that cell to one benchmark series. So the wiring, when these land, is:

- A `DEBT_CELL_INDEX` mapping constant, the debt analog of the equity `EQUITY_CAP_INDEX`: `(credit_bucket, duration_bucket) -> index_id`. Sovereign cells map to the G-Sec curve at the matching tenor; cash maps to liquid/overnight; high_grade maps to the AAA FIMMDA curve at the bucket's tenor; credit_risk maps to the AA/A FIMMDA curve. One curve series per occupied cell in the `indices` block (TR levels), keyed by a stable id.
- For finer matching, the blend can use the fund's actual `Duration` (the `duration_y` the candidate already carries) to pick the nearest FIMMDA tenor within the credit tier, rather than only the coarse short/medium/long bucket; the AAA full-ladder pull (Section 3) is what makes that precision possible. The coarse bucket-to-representative-tenor mapping also works if the simpler path is preferred.

Net: one TR-level series per occupied cell, keyed so `(credit_bucket, duration_bucket)` resolves to it. Nothing else in the blend wiring is blocked; the cell-to-index step completes cleanly once the FIMMDA TR curves and the dual-flavor G-Sec are in the snapshot.

---

This sizes and recommends; it pulls nothing and changes nothing. The build stays parked at the Phase 2 stop. The next terminal trip is a short, precise pull: the AAA tenor ladder plus a thin AA/A/PSU set in the FIMMDA total-return flavor, and a check that the G-Sec is held in both yield and TR.
