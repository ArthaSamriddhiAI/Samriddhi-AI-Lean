# ADR 0033: Sub-sleeve tilt framework, the model-portfolio foundation slice

## Status

Accepted, 2026-05. Shipped as part of T-5.12 Finding 1 on `features/a3-so-what`, PR #11. The tilt type and house-view default live in `db/fixtures/structured-mandates.ts` (`SubSleeveTilt`, `HOUSE_VIEW_TILT_BY_RISK`, optional `Mandate.sub_sleeve_tilt`); the instrument-selection funnel consumes them (`lib/agents/instrument-selection.ts`).

## Context

Finding 1 selects specific instruments to fill an under-target sleeve. To do that well it must know not just how much equity or debt an investor should hold (the asset-class bands, ADR-0032) but what kind within the sleeve: an aggressive long-horizon investor and a conservative distribution-phase investor should both reach their equity target, but with different cap-mixes, and their debt with different credit quality. The instrument-selection pre-build audit (`docs/audits/2026-05-30_instrument_selection_prebuild.md`, Section C) confirmed that `sebi_category` fully distinguishes equity cap-mix (Large / Mid / Small / Flexi / Multi / Large-and-Mid / Focused) and debt credit-quality and duration (Gilt sovereign, Corporate Bond and Banking-and-PSU high-grade, Credit Risk, plus the duration ladder), so a risk-profile tilt is fully data-driven, with no fallback to category-level-only.

There is no risk-appetite-by-time-horizon to model-portfolio framework yet (product debt P43); the per-investor mandates are bespoke and hand-authored. So the sub-sleeve tilt is the first stated, reusable slice of that future framework, and it must be built to be extended rather than replaced.

## Decision

Add a sub-sleeve tilt to the mandate framework as a stated house-view mini-framework:

- `SubSleeveTilt` has two axes: `equity_cap` (`large_only` / `large_mid` / `small_mid_lean`) and `debt_credit` (`high_grade_sovereign` / `high_grade` / `may_include_credit_risk`).
- The house-view default is keyed by risk tier (`HOUSE_VIEW_TILT_BY_RISK`): Conservative leans large-only equity and high-grade sovereign debt; Moderate-Aggressive leans large-and-mid equity and high-grade debt; Aggressive and Ultra-Aggressive lean small-and-mid equity and may include credit-risk debt. This encodes the stated rule: aggressive leans small/mid, moderate large/mid, conservative large-only; conservative high-grade/sovereign debt, aggressive may include credit risk.
- A mandate may override the default with an optional `Mandate.sub_sleeve_tilt`, exactly the optional-field extension pattern ADR-0032 established for `target_pct`. When absent, the house-view default for the investor's risk tier applies.

The tilt resolves to a preferred ordered set of `sebi_category` values per sleeve inside the instrument-selection funnel; that mapping is selection logic and lives in `instrument-selection.ts`, not in the mandate data.

## Consequences

- The instrument funnel fills an aggressive investor's equity gap from mid and small cap categories, and a conservative investor's from large cap only, deterministically and by data.
- The tilt is per-risk-tier by default and per-investor-overridable, so the demo personas need no per-investor tilt authoring (the default is correct for all five), while a future investor with a specific tilt can state it.
- The change is additive: an optional mandate field plus a house-view default table, no change to the bands or to Samriddhi 1.

## Forward note

This is the foundation slice, not the final framework. When the model-portfolio framework is formalised (P43), the house-view tilt table is the seed it grows from: the same `SubSleeveTilt` shape extends with more axes (duration tilt, factor tilt, geography) and a richer keying (risk-appetite by time-horizon by life-stage) rather than a parallel structure. The optional mandate override is the seam that lets per-investor customisation arrive without a schema change.

## References

- `db/fixtures/structured-mandates.ts` (`SubSleeveTilt`, `HOUSE_VIEW_TILT_BY_RISK`, `Mandate.sub_sleeve_tilt`).
- `lib/agents/instrument-selection.ts` (the funnel that consumes the tilt; the preferred-category mapping).
- ADR-0032 (the optional-field extension pattern); ADR-0034 (the selection architecture); the instrument-selection pre-build audit Section C and E.
