# ADR 0037: The 2D credit-by-duration debt framework

## Status

Accepted, 2026-05. T-5.12 Finding 1 on `features/a3-so-what`, PR #11. Implemented in `lib/agents/instrument-selection.ts` (`creditBucketOf`, `durationBucketOf`, `buildDebtPlan`, `DEBT_2D_CATEGORIES`) with the thresholds in `SELECTION_PARAMS`.

## Context

Debt allocates on two axes: credit quality (by risk appetite, ADR-0033) and duration (by time horizon). The look-through audit established the load-bearing constraint and its resolution: a debt fund's `sebi_category` is mutually exclusive (it is a credit category OR a duration category, never both), so the category alone cannot place a fund on both axes; but the per-fund `Duration` and `AAA %` metrics are near-complete on the eligible debt universe and carry the missing axis.

## Decision

**Category-primary, metric-secondary placement.** Each eligible debt fund is placed on both axes:

- **Credit axis** (`creditBucketOf`): `Gilt Fund` and `Gilt Fund with 10 year Constant` are sovereign by category; `Corporate Bond Fund` and `Banking and PSU Fund` are high-grade by category; `Credit Risk Fund` is credit-risk by category; a duration-category fund's credit reads from its `AAA %` (at or above the cutoff is high-grade, below is credit-risk; never sovereign).
- **Duration axis** (`durationBucketOf`): from the per-fund `Duration` metric (short under 3 years, medium 3 to 5, long over 5), falling back to the duration category where the metric is absent.
- **Selection**: the debt deploy splits across the three credit buckets by the ADR-0033 credit split; within each bucket the funds are preferred to the horizon-target duration (filter to the duration-matched subset where non-empty, else relax to the full credit bucket), then ranked by the ADR-0034 lexicographic funnel.

**The credit-bucket-to-`sebi_category` mapping and its SEBI rationale (documented prominently so a future edit does not "correct" it wrongly).** `Corporate Bond Fund` maps to HIGH-GRADE, not to the corporate/credit-risk bucket, despite its name. This is the SEBI definition: a Corporate Bond Fund must hold at least 80 per cent in AAA/AA+ (high-grade), while a Credit Risk Fund must hold at least 65 per cent in AA-and-below (genuine credit risk). So the only category in the credit-risk bucket is `Credit Risk Fund`. `Banking and PSU Fund` is high-grade (AAA-quality quasi-sovereign bank and PSU paper), not a fourth bucket and not gilt. The four-fund eligible `Credit Risk Fund` pool is accepted (a three-from-four shortlist is real).

**Thresholds (named, tunable; the "why these values" lives here).**

- *Duration cutoffs (A1):* short < 3 years, medium 3 to 5, long > 5. The eligible-pool split is 46/22/30, it matches conventional fixed-income practice, it contains the SEBI Short Duration cluster (durations 1.2 to 2.7) in short, and it separates Long Duration (10+) and Medium-to-Long (~6.5) into long.
- *AAA% high-grade cutoff (A2): 70 per cent, NOT 80.* This applies to duration-category funds whose credit is not given by category. `AAA %` understates high-grade because it counts only AAA and excludes AA+, which SEBI also counts as high-grade; so the bar is set below the naive SEBI AAA/AA+ number to compensate. The data shows a clean gap (credit-risk funds 5 to 18 per cent AAA, high-grade 69 to 87), so 70 sits cleanly between the clusters. Do not "correct" this to 80: that would push genuinely high-grade short-duration funds (72 to 77 per cent AAA) into credit-risk.
- *Gilt exception (A3):* gilt-category funds are sovereign regardless of `AAA %` (their `AAA %` is null because government securities are not corporate-rated); their duration is still read from the `Duration` metric.

**Credit-determinable universe scope.** The debt 2D pool (`DEBT_2D_CATEGORIES`) is the credit-determinable categories only: the credit-defined ones (Gilt, Corporate Bond, Banking and PSU, Credit Risk) plus the duration-ladder ones whose credit reads from `AAA %` (Short / Medium / Medium-to-Long / Long Duration). Passive and credit-indeterminate categories are EXCLUDED: `Debt Index Funds` and `ETFs- Debt` track an unknown index and carry no `AAA %`, so a gilt-index ETF would otherwise misclassify into credit-risk; `Dynamic Bond` spans credit by design; the ultra-short family (Liquid, Overnight, Money Market, Ultra Short, Low Duration) is cash-adjacent, not a duration-tilt bucket. Excluding them avoids a misclassification rather than guessing a credit a passive fund does not disclose. (This surfaced as a real misclassification in the free preview, a gilt-index ETF in the credit-risk bucket, and was scoped out here.)

## Consequences

- A debt fund is placed in a genuine credit-by-duration cell from its data, so a long-horizon aggressive investor gets longer-duration funds across sovereign/high-grade/credit-risk, while a short-horizon investor gets short-duration.
- The framework rests on the metric coverage (near-complete on eligible debt, sparser universe-wide) and the gilt credit-by-category exception; it is sound for selection-from-eligible, which is all the funnel does.
- Where a credit bucket has no fund at the horizon-target duration, the selection relaxes to the full credit bucket (debt's duration is a preference, not a hard constraint; the credit quality is the binding axis).

## References

- `lib/agents/instrument-selection.ts` (`creditBucketOf`, `durationBucketOf`, `buildDebtPlan`, `DEBT_2D_CATEGORIES`, `SELECTION_PARAMS`).
- ADR-0033 (the credit split and duration-by-horizon it implements); ADR-0034 (the lexicographic funnel); the look-through audit Section C (the joint-observability constraint and the metric coverage). Product debt P45 (threshold calibration).
