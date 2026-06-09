# Section 06 proof plots (Package 07)

Gross market value (solid) versus cumulative net invested cost (dashed) per
investor, rendered directly from the persisted
`content.time_series_performance.gross_net_series` blocks. These SVGs are
review evidence that the deferred section 06 line is now drawable from
reconciled, real-anchored data (P50/D14); the case-screen mount remains with
the case-screen single-writer thread (WA09).

| Case | Covered weight | Floor verdict (70%) | Window | Plot |
|---|---|---|---|---|
| surana | 81.2% | clears | 2019-05..2026-03 (83 months) | [surana.svg](surana.svg) |
| iyengar | 100.1% | clears | 2017-03..2026-03 (109 months) | [iyengar.svg](iyengar.svg) |
| malhotra | 91.5% | clears | 2017-09..2026-03 (103 months) | [malhotra.svg](malhotra.svg) |
| bhatt | below the floor | bars only (deferred) | n/a | none (honest deferral) |
| menon | below the floor | bars only (deferred) | n/a | none (honest deferral) |

Coverage counts only holdings whose value path is backed by real data: eCAS
transaction ladders on real `monthly_nav`, listed-stock `monthly_prices`,
the real `sp_500_tri_inr` index for the GIFT-route ETF, and contractual-rate
accrual for FDs and bonds (rates and maturities from the holdings rows). PMS,
AIF, physical gold (the gold index is synthetic), savings balances, and mixed
US equities are excluded with reasons recorded in each block. Bhatt (35.5%)
and Menon (6.8%) do not clear the floor on real data and stay bars-only, said
plainly per the honesty ruling.

Regenerate: `npx tsx scripts/render-section06-proof.ts` (after the
section 06 series backfill).
