# ADR 0037: The 2D credit-by-duration debt framework

## Status

Accepted, 2026-05; the credit read revised to SOV-aware (A2) after the classification-integrity audit. T-5.12 Finding 1 on `features/a3-so-what`, PR #11. Implemented in `lib/agents/instrument-selection.ts` (`creditBucketOf`, `durationBucketOf`, `buildDebtPlan`, `DEBT_2D_CATEGORIES`) with the thresholds in `SELECTION_PARAMS` (`AAA_HIGH_GRADE_MIN_PCT` 70, `SOV_SOVEREIGN_MIN_PCT` 80).

## Context

Debt allocates on two axes: credit quality (by risk appetite, ADR-0033) and duration (by time horizon). The look-through audit established the load-bearing constraint and its resolution: a debt fund's `sebi_category` is mutually exclusive (it is a credit category OR a duration category, never both), so the category alone cannot place a fund on both axes; but the per-fund `Duration` and `AAA %` metrics are near-complete on the eligible debt universe and carry the missing axis.

## Decision

**Category-primary, metric-secondary placement.** Each eligible debt fund is placed on both axes:

- **Credit axis** (`creditBucketOf`): `Gilt Fund` and `Gilt Fund with 10 year Constant` are sovereign by category; `Corporate Bond Fund` and `Banking and PSU Fund` are high-grade by category; `Credit Risk Fund` is credit-risk by category; a duration-category fund's credit reads from `SOV %` and `AAA %` (the SOV-aware three-way read, A2): sovereign if `SOV %` is high, else high-grade if `SOV %` + `AAA %` clears the cutoff, else credit-risk.
- **Duration axis** (`durationBucketOf`): from the per-fund `Duration` metric (short under 3 years, medium 3 to 5, long over 5), falling back to the duration category where the metric is absent.
- **Selection**: the debt deploy splits across the three credit buckets by the ADR-0033 credit split; within each bucket the funds are preferred to the horizon-target duration (filter to the duration-matched subset where non-empty, else relax to the full credit bucket), then ranked by the ADR-0034 lexicographic funnel.

**The credit-bucket-to-`sebi_category` mapping and its SEBI rationale (documented prominently so a future edit does not "correct" it wrongly).** `Corporate Bond Fund` maps to HIGH-GRADE, not to the corporate/credit-risk bucket, despite its name. This is the SEBI definition: a Corporate Bond Fund must hold at least 80 per cent in AAA/AA+ (high-grade), while a Credit Risk Fund must hold at least 65 per cent in AA-and-below (genuine credit risk). So the only category in the credit-risk bucket is `Credit Risk Fund`. `Banking and PSU Fund` is high-grade (AAA-quality quasi-sovereign bank and PSU paper), not a fourth bucket and not gilt. The four-fund eligible `Credit Risk Fund` pool is accepted (a three-from-four shortlist is real).

**Thresholds (named, tunable; the "why these values" lives here).**

- *Duration cutoffs (A1):* short < 3 years, medium 3 to 5, long > 5. The eligible-pool split is 46/22/30, it matches conventional fixed-income practice, it contains the SEBI Short Duration cluster (durations 1.2 to 2.7) in short, and it separates Long Duration (10+) and Medium-to-Long (~6.5) into long.
- *Credit read (A2), SOV-aware three-way:* for a duration-category fund (credit not given by category), **sovereign if `SOV %` >= 80, else high-grade if `SOV %` + `AAA %` >= 70, else credit-risk.** The read is `SOV %`-aware because sovereign (government-securities) paper is at least as safe as AAA and must count toward the safety read; an AAA-only test was an omission that mis-filed sovereign-heavy funds as credit-risk. The 70 high-grade cutoff stays 70 not 80 because `AAA %` excludes AA+ (which SEBI counts as high-grade), and now `SOV %` is added to the same numerator (sovereign is at least as safe as AAA); the 80 sovereign cutoff mirrors the gilt `SOV %` profile (gilts read 93 to 95). Government securities carry no corporate rating, so `AAA %` is null for a G-sec-heavy fund; `SOV %` is the signal that catches them.
  - *Why SOV-aware (the bug it closes).* The original AAA-only test put two classes of sovereign-quality fund into credit-risk: (1) the three no-`AAA %` long-duration G-sec funds (Nippon India Nivesh Lakshya, SBI Long Duration, HDFC Long Duration; `SOV %` 84 to 97), and (2) sovereign-heavy duration funds with `AAA %` below 70 but high `SOV %` (Aditya Birla Sun Life Income at `SOV %` 61 + `AAA %` 34 = 95, HDFC Income at 68 + 28 = 96), which had **surfaced** in the credit-risk shortlists of three investors (Bhatt, Menon, Surana) in the free preview. The SOV-aware read routes all of them correctly (the three to sovereign, the income funds to high-grade) and closes the whole gilt-ETF / long-duration-sovereign / income-fund bug family in one rule, so the next sovereign-heavy fund classifies right without a further special case. This subsumes the classification-integrity audit's narrower L1 (which keyed on null-`AAA %` alone, see `docs/audits/2026-05-30_classification_integrity.md`).
- *Gilt exception (A3):* gilt-category funds are sovereign regardless of `AAA %` (their `AAA %` is null because government securities are not corporate-rated); their duration is still read from the `Duration` metric.

**Credit-determinable universe scope.** The debt 2D pool (`DEBT_2D_CATEGORIES`) is the credit-determinable categories only: the credit-defined ones (Gilt, Corporate Bond, Banking and PSU, Credit Risk) plus the duration-ladder ones whose credit reads from `AAA %` (Short / Medium / Medium-to-Long / Long Duration). Passive and credit-indeterminate categories are EXCLUDED: `Debt Index Funds` and `ETFs- Debt` track an unknown index and carry no `AAA %`, so a gilt-index ETF would otherwise misclassify into credit-risk; `Dynamic Bond` spans credit by design; the ultra-short family (Liquid, Overnight, Money Market, Ultra Short, Low Duration) is cash-adjacent, not a duration-tilt bucket. Excluding them avoids a misclassification rather than guessing a credit a passive fund does not disclose. (This surfaced as a real misclassification in the free preview, a gilt-index ETF in the credit-risk bucket, and was scoped out here.)

## Consequences

- A debt fund is placed in a genuine credit-by-duration cell from its data, so a long-horizon aggressive investor gets longer-duration funds across sovereign/high-grade/credit-risk, while a short-horizon investor gets short-duration.
- The framework rests on the metric coverage (near-complete on eligible debt, sparser universe-wide) and the gilt credit-by-category exception; it is sound for selection-from-eligible, which is all the funnel does.
- Where a credit bucket has no fund at the horizon-target duration, the selection relaxes to the full credit bucket (debt's duration is a preference, not a hard constraint; the credit quality is the binding axis).
- A side effect of the SOV-aware read: the high-grade-by-long cell, previously empty (so a long-horizon high-grade deploy relaxed to short-duration Corporate Bond funds), now populates with the genuinely high-grade long-duration income funds, so a long-horizon investor's high-grade sub-bucket is duration-matched rather than relaxed.

## References

- `lib/agents/instrument-selection.ts` (`creditBucketOf`, `durationBucketOf`, `buildDebtPlan`, `DEBT_2D_CATEGORIES`, `SELECTION_PARAMS`).
- ADR-0033 (the credit split and duration-by-horizon it implements); ADR-0034 (the lexicographic funnel); the look-through audit Section C (the joint-observability constraint and the metric coverage). Product debt P45 (threshold calibration).
