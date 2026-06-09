# Section 06 performance-line data audit: can the gross and net lines be drawn honestly?

- Date: 2026-06-09
- Branch: `features/render-bundle-sweep` (milestone at 6f4a74c; Phase 3 and 4 paused)
- Status: read-only data-availability audit (WA22). No chart code written. Zero spend.
- Question: section 06 of the v7.2 wireframe draws two series, a continuous gross market-value line and a continuous net invested-cost line. Does the data exist to draw each honestly, per investor, without fabricating a cost basis (WA16)?
- External read-only sources (never committed to the repo): the per-investor ingestion data in `15.../14 - Factual Foundation Continued/` (eCAS PDFs, alt-format files, `holdings_a1_a5.json`, the package README), and the market-data snapshots in the private repo `ArthaSamriddhiAI/Samriddhi-AI-Data-Snapshots` (loaded on demand by `scripts/setup-data.ts`, not in this working tree).

## Headline: my earlier "blocked, no data" was wrong

I previously reported section 06's continuous line as blocked because "there is no cost-basis source and the snapshot is not in the render path." That conclusion was reached without reading the two sources I had not been pointed at, and it is wrong on the data. The honest finding:

- The **net line has the richest real source of all**: the eCAS statements carry the full dated transaction history (every purchase and SIP with date, amount, units, and NAV) for the mutual-fund holdings, and `holdings_a1_a5.json` carries `cost_basis_total_inr` and `purchase_date` for every one of the 41 holdings. The wireframe's "Nov 2025 cost-basis step" is literally a real contribution event visible in the statements.
- The **gross line is computable** from the snapshot's `monthly_nav` (funds) and `monthly_prices` (stocks) times units held at each month, the same data `time-series-performance.ts` already reads at agent runtime.
- BUT neither line is a render thread-through. The data is in external sources the case route does not load (the eCAS transactions are not ingested into the repo at all; the snapshot is not present in the working tree). Drawing the lines is a data-ingestion and capability build, not a render task. And the coverage is partial: it is true and complete for the mutual-fund-heavy investors, single-date-stepped for non-mutual-fund holdings, and genuinely thin or meaningless for the cash-dominant and the alt-format-only investors.

So the user's instinct (the data is probably there) is correct for the three mutual-fund-heavy investors, and a fabricated line is avoidable. The cost is real and is a separate build, not a render wire-up.

## The two lines are different questions

### Net line (cumulative invested cost over time): data EXISTS, partial by investor

The net line needs dated contribution events so a running cost basis steps up when money goes in. Two sources carry this:

1. eCAS transaction history (mutual funds). Quoted from `ecas_05_rajiv_surana.pdf`, Mirae Asset Large Cap folio 15404371: a transaction table from 05-Mar-2019 to 03-Mar-2026, for example `05-Mar-2019  Purchase-BSE  13,44,465.86  29444.095 units  @ 45.6616`, then periodic `SIP Purchase via Reg` rows, closing unit balance 294460.955. The Axis Bluechip folio runs from 05-Mar-2016. The `iyengar` eCAS shows the same for her four funds (Axis from 2019, HDFC Index from 2018, ICICI Pru BAF switch-ins through 2023, Franklin Corporate Debt lump 09-May-2021). Cumulative invested cost is the running sum of the Amount column; this is a real, dated, stepped series.
2. Per-holding cost basis (`holdings_a1_a5.json`). Every holding (41 rows across the five investors) carries `cost_basis_total_inr`, `cost_basis_per_unit_inr`, and a single `purchase_date` (range 2008-04-15 to 2025-11-15). For non-mutual-fund holdings (direct stocks, ETF, PMS, AIF, FD, gold), this single purchase date is the only contribution event available; the net line steps once per holding at its purchase date.

Per investor:

| Investor | eCAS MF transaction history | Non-MF holdings | Net line verdict |
|---|---|---|---|
| Malhotra (A1) | Yes, four funds | 2 FD, gold (single date) | MF portion true and stepped; FD and gold single steps. Honest line. |
| Iyengar (A2) | Yes, four funds incl debt | 2 FD (single date) | MF portion true; FD single steps. Honest line (she is MF plus FD). |
| Bhatt (A3) | None (PMS and AIF dominated; no eCAS by design) | 4 PMS, 3 direct stocks, 1 Cat III AIF, 2 small MF, FD, arbitrage (all single date) | All single-date steps from `holdings_a1_a5.json`. Coarse: every holding one step, no SIP cadence. Honest but blocky. |
| Menon (A4) | None (zero MF; pure cash plus FD plus intl) | savings 86.6% (no cost-basis concept), FD, US equity (single date) | Near-meaningless: cash has no invested-cost curve; only the FD and the legacy US equity are single steps. A net line here misleads. |
| Surana (A5) | Yes, five funds (2016 to 2026) | Reliance, HDFC Bank, Vanguard ETF, White Oak PMS, gold, cash (single date) | MF portion true and stepped; the six non-MF holdings single steps. Honest line, with a coarse non-MF tail. |

### Gross line (market value over time): data EXISTS, partial coverage, snapshot not in the render path

The gross line needs a periodic market-value series: units held at each month times NAV or price at that month, summed across holdings.

- Units over time: from the eCAS cumulative Unit Balance (mutual funds) or the constant `quantity` after the single purchase date (non-MF).
- NAV or price over time: `lib/agents/snapshot-loader.ts` documents `monthly_nav` on `mf_funds[]` and `monthly_prices` on `nifty500.companies[]` in the enriched snapshots; `time-series-performance.ts` reads exactly these (`const series = isFund ? row.monthly_nav : row.monthly_prices; computeTrailingWindowReturns(series, STANDARD_WINDOWS, asOfDate)`). Index series live at `indices[benchId].monthly_values`.
- Depth: the persisted `risk_reward_stats` carry 3Y and 5Y statistics for every held instrument, which can only have been computed from a monthly series at least 5 years deep; the eCAS records NAVs back to 2016 for the oldest folio, and the package README states the eCAS NAVs are sourced from the t0 baseline snapshot. So a 5-year-plus monthly series exists for the held funds and stocks.
- Coverage: only mutual funds and listed Nifty 500 stocks carry a monthly series. PMS, AIF, physical gold, FD, and cash have no market-value series in the snapshot (the same opacity the risk-reward `coverage_footnote` already discloses). So the gross line covers the MF-plus-listed-equity portion and excludes the rest with a coverage caveat.

Per investor, the gross-covered share of the portfolio is roughly: Iyengar high (almost all MF, minus the two FDs), Surana high for the MF plus Reliance plus HDFC plus the ETF (about 75%, excluding PMS, gold, cash), Malhotra high (MF plus gold), Bhatt low (only about 25% is MF plus listed; PMS and AIF are about 60% and have no series), Menon near zero (cash and FD have no series; only the 6.6% US equity, and US tickers may not be in the Nifty 500 universe).

Two structural blockers, both real:
1. The case route (`app/cases/[id]/page.tsx`) loads only the snapshot metadata row from the database; the enriched snapshot JSON (about 11 MB) is read only at agent runtime via `snapshot-loader.ts`, and is not present in this working tree at all (`fixtures/snapshots/enriched` is empty; fetched on demand by `setup-data` from the private data repo).
2. The eCAS transaction histories are not ingested into the repo. The cases were built from `structured-holdings.ts` (current positions, which dropped the cost basis and purchase date) plus the snapshot; the eCAS transactions exist only as the external generated artifacts (`generate_ecas.py`, deterministic).

## Honest-chart verdict per case

| Case | Net line | Gross line | Honest section 06 |
|---|---|---|---|
| Surana | True for the 5 MFs, single-step for 6 non-MF | MF plus Reliance plus HDFC plus ETF (about 75%), PMS and gold and cash excluded | Both lines drawable with a coverage caveat on the non-MF tail. The strongest case. |
| Iyengar | True for the 4 MFs, single-step for 2 FD | Almost all (MF), FD excluded | Both lines drawable, high coverage. |
| Malhotra | True for the MFs, single-step for FD and gold | MF plus gold, FD excluded | Both lines drawable, high coverage. |
| Bhatt | All single-step (no eCAS); PMS and AIF cost bases only | About 25% (MF plus listed); PMS and AIF (60%+) excluded | A line would carry a heavy "most of the portfolio is not covered" caveat. Bars are the more honest default. |
| Menon | Near-meaningless (cash dominant) | Near-zero coverage | Bars only. A cash investor has no invested-cost or market-value curve worth drawing. |

The window-return bars remain the floor for every case and are already built (Phase 1); they read the always-present `trailing_returns` window data and never need the snapshot or the eCAS.

## Build cost of each option (the real cost on the table)

The clean path for both lines is a capability extension, not a render wire-up:

1. Ingest the per-investor transaction history into the data layer. The eCAS transactions are reproducible (`generate_ecas.py`), but the repo carries none of them today; this is a new ingestion step (parse the statements or regenerate the structured transactions, plus carry forward the `cost_basis_total_inr` and `purchase_date` that `structured-holdings.ts` dropped). Medium effort, and it is data work, not render.
2. Extend `time-series-performance.ts` to emit a persisted portfolio monthly series into `content.time_series_performance`: gross from snapshot `monthly_nav`/`monthly_prices` times units-over-time, net from the cumulative transaction cost, both with an honest coverage field for the uncovered sleeves. This reuses the snapshot read the capability already does. Medium effort, deterministic, zero spend.
3. Re-fire the five cases to persist the series (deterministic, zero spend), then render the dual line (small: a new hand-rolled SVG chart per the ADR-0045 convention).

This is roughly a few days of capability-plus-data work and is its own task (WA9: capability ships data), not part of a render pass. The render-only alternative (load the 11 MB snapshot in the case route and compute at render) is worse: an 11 MB parse per page render, and it still cannot draw the net line because the eCAS transactions are not in the render path.

The window bars cost nothing further; they are built.

## Recommendation (for the primary to rule)

The data genuinely exists to draw both lines honestly for the three mutual-fund-heavy investors (Surana, Iyengar, Malhotra), with a coverage caveat on the non-MF tail; it degrades to a coarse single-step line for Bhatt and to bars-only for Menon. Drawing the continuous lines is a real capability-and-data build (ingest the eCAS transactions, extend the time-series capability to persist a gross and net monthly series, re-fire), not the render thread-through Decision 1 assumed.

My recommendation: keep the window bars as section 06's floor for all five cases (built, honest everywhere), and scope the continuous gross and net line as a separate performance-series capability task, gated on that build, rather than forcing it into this render pass. If you want the journey-and-reassurance line in this pass for the strong cases, it is feasible for Surana, Iyengar, and Malhotra with the caveat, but it pulls a capability-and-data build into the render workstream, which is the WA28 scope decision for you to make. The one thing I will not do is draw a cash-basis line from data that is not there (WA16); for Menon and Bhatt that line would be invented or near-empty, and bars are the honest answer.

## Evidence index

- eCAS transaction history: `ecas_05_rajiv_surana.pdf` (Mirae, PPFAS, Axis, Kotak, SBI folios, dated transactions 2016 to 2026); `ecas_02_lalitha_iyengar.pdf` (Axis, HDFC Index, ICICI Pru BAF, Franklin Corporate Debt).
- Per-holding cost basis: `holdings_a1_a5.json` (41 rows; `cost_basis_total_inr`, `purchase_date`, `quantity` present on all; no transaction-list field).
- Snapshot series: `lib/agents/snapshot-loader.ts` (`monthly_nav`, `monthly_prices`, enriched dir); `lib/agents/time-series-performance.ts` (reads the series for trailing windows); `scripts/setup-data.ts` (fetches the snapshots from `ArthaSamriddhiAI/Samriddhi-AI-Data-Snapshots`).
- Coverage and consistency: the package `README.md` (9 quarterly snapshots with full schema; eCAS NAVs sourced from the t0 baseline; eCAS covers MF-heavy investors, alt-format for the MF-light ones).
- Render-path gap: `app/cases/[id]/page.tsx` (loads snapshot metadata only); `fixtures/snapshots/enriched` empty in the working tree.

## Addendum, 2026-06-09: reconciliation outcome (the line is not built)

The Step 2 build fetched the snapshot (`setup-data`, v1.0.0-frozen) and ran the reconciliation gate. It fails systematically. Per folio, the snapshot t0 monthly NAV does not match the eCAS closing NAV: Mirae snapshot 137.44 versus eCAS 101.89 (off 35%); Parag 68.37 versus 79.03 (off 13%); Axis 49.64 versus 54.54 (off 9%); SBI 133.34 versus 151.04 (off 12%); Franklin 113.14 versus 103.28 (off 10%); Kotak Emerging Equity, ICICI Balanced Advantage, and HDFC Index Nifty 50 have no clean share-class match in the snapshot universe. The value test: Surana's Mirae folio (294,460 units) values at Rs 4.00 Cr at the snapshot NAV, not the canonical Rs 3.00 Cr.

Root cause: `generate_ecas.py`'s `simulate_history` synthesizes the eCAS NAV path from an assumed CAGR (working backwards from the current value at the current NAV), not from the snapshot `monthly_nav` series. The eCAS and the snapshot therefore share only the final market value, not a NAV basis, and cannot be combined into one coherent performance line. The eCAS-alone construction is internally reconciled but mutual-fund-only (46% Surana, 46% Iyengar, 52% Malhotra), below the 70% honesty floor; adding the snapshot for listed equity to reach 70% fails reconciliation.

Decision: per WA16 and the reconcile-or-fail mandate, no line is drawn. Section 06 ships the window bars (real, scale-independent, case-consistent). The continuous line is logged as product debt P50 and data debt D14 and handed to the data-management workstream. The bars are honest and shipped; the line is a tracked, precisely-scoped future task.
