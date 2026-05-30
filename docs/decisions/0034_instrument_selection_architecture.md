# ADR 0034: Instrument-selection architecture and its tunable parameters

## Status

Accepted, 2026-05. Shipped as T-5.12 Finding 1 on `features/a3-so-what`, PR #11. Implemented in `lib/agents/instrument-selection.ts`; consumed by A3 (`lib/agents/a3-so-what.ts`) after the deterministic redeployment. Every threshold below is a named, tunable parameter in `SELECTION_PARAMS`, not a magic number; this ADR is the record of why each value was chosen, so future readers find the rationale here rather than reverse-engineering it from code.

## Context

Findings 4, 2, 5 made the diagnostic foundation correct: per-investor targets, cash-as-funding, deploy-to-target. The redeployment now says how much to put into each under-target sleeve. Finding 1 fills those sleeve gaps with specific candidate instruments. The instrument-selection pre-build audit (`docs/audits/2026-05-30_instrument_selection_prebuild.md`) confirmed the data supports a deterministic funnel for mutual funds (rich metrics) and that PMS and AIF degrade to advisor-select (opaque, no risk-adjusted metrics). The primary ruled five product decisions that the funnel could not be built without; this ADR records them.

## Decision: the funnel

Instrument selection is a deterministic funnel; the LLM (in A3's narration) only articulates the pick citing the computed metrics; the advisor owns the decision. Per under-target sleeve, per sub-sleeve (defined by the ADR-0033 tilt), per investor:

- **Stage 1, eligibility (hard filters, exclude):** `sebi_category` fit to the sub-sleeve, viable AUM, sufficient track record, and the 3-year risk-adjusted set present.
- **Stage 2, ranking (lexicographic):** establish the risk-adjusted-consistent cohort first (the quality gate, on the Sharpe / Sortino / Calmar 3-year composite), then pick the lowest TER within that cohort, with the raw 3-year return breaking remaining ties.
- **Classification is data-driven:** an instrument's sleeve comes from its data (`strategy_type` for PMS, `sebi_category` for mutual funds), never from a wrapper-type assumption. The current snapshot's PMS being all-equity falls out of reading `strategy_type`; it is not hard-coded. A future debt or long-short PMS classifies correctly.

## The five ruled parameters (with rationale)

1. **Eligibility thresholds.** `MIN_AUM_CR = 500`, `MIN_TRACK_RECORD_YEARS = 3`. The 3-year floor matches the ranking metrics' horizon: a sub-3-year fund cannot be ranked on the primary risk-adjusted criterion, so admitting it would mean ranking it on something weaker. 500 Cr drops sub-scale funds (keeps roughly 53 percent of the universe) while leaving healthy 16 to 27 fund pools per equity and debt sub-category. Both are tunable.

2. **Shortlist size, internal 5 surface 3.** `SHORTLIST_SURFACE = 3`, `SHORTLIST_INTERNAL = 5`. The advisor-facing deliverable is up to 3 candidates, never padded: a genuinely thin sub-sleeve surfaces 1 or 2 honestly rather than forcing a weak third. The funnel ranks the top 5 internally; positions 4 and 5 are logged in the deterministic preview for ranking-validation only (the primary can confirm during the free preview that 4 and 5 are clearly weaker on the lexicographic criteria and that nothing strong is hiding just below the cut). The 4-to-5 visibility is a v1-calibration aid, zero narration or API cost, never in the advisor-facing narration or the committed fixture; it may be retained or dropped once the ranking is trusted.

3. **Ranking, lexicographic not weighted.** `QUALITY_GATE = "top_half"`. The cohort is the top-half of the eligible pool by the risk-adjusted composite (the mean percentile rank across Sharpe, Sortino, Calmar over 3 years); the surfaced picks are the lowest-TER members of that cohort, return-tiebroken. Lexicographic was chosen over a weighted score deliberately: there is no tunable weight to argue about, and "cheapest among the consistently strong risk-adjusted performers" is the defensible, advisor-grade story. The cohort cutoff (top-half versus top-tercile) is itself a tunable parameter; top-half is the starting value and the funnel surfaces the choice if it materially changes the shortlists.

4. **Top-up, rank-banded.** Top up an eligible existing holding if it sits in the top-half quality cohort of its sub-sleeve; if it is eligible but below the cohort (mediocre but not bad), surface both the top-up and the better fresh candidate as advisor-choice. Never silently drop the incumbent, never silently force the switch. This uses the same quality gate as the ranking. The top-up join is reliable for mutual-fund and listed holdings; PMS and AIF holdings frequently do not match the universe (product debt P40), so they fall through to add-new or advisor-select.

5. **Cadence, size and liquidity aware.** `CADENCE_WINDOW_DAYS = 14`, `CADENCE_STAGE_THRESHOLD_CR = 2`, `CADENCE_PER_TRANCHE_CR = 1.5`, `CADENCE_MAX_TRANCHES = 4`. A sleeve deploy at or below 2 Cr goes in one step; above it, the tranche count is the deploy size divided by a per-tranche size that scales with the destination's AUM liquidity proxy, capped at 4 over a roughly two-week window. Daily traded volume is absent from the snapshot (audit Section D), so the pacing is sized on the deploy amount and the destination AUM, not live turnover; this is a documented fallback, not a blocker. The numbers are computed deterministically and presented to the LLM to reason over, never invented by it.

## Per-sleeve degradation (settled, not a parameter)

Mutual funds run the full funnel. PMS has no risk-adjusted metrics (opaque), so its ranking degrades to fee plus track-record plus returns and leans advisor-select. AIF has no performance metrics, so it is advisor-select by necessity. Degradation to advisor-select is honest where the data is absent; it is surfaced as Reading-B guidance and never fabricated. The alternatives split follows the settled design: under 5 percent of portfolio in alternatives is gold only (a sub-5-percent allocation implies a conservative investor, unsuitable for funky AIFs); at 5 percent or more, 5 percent gold plus the remainder in non-gold AIF as advisor-select, never forcing gold to absorb the unmatchable non-gold remainder.

## The LLM-justification leash

The LLM receives the deterministic shortlist with its qualifying metrics and writes a few-line rationale citing only those computed metrics. It explains the deterministic pick; it never re-ranks, never adds a reason absent from the data (no "good management team", no unquantified qualitative claim), never overclaims. Same hard-constraint discipline as all A3 narration.

## Consequences

- The deployment story becomes concrete: an under-deployed investor sees specific candidate funds for each sleeve gap, with cited cost and risk-adjusted metrics, a staged cadence, and a top-up-first preference, all deterministic and advisor-owned.
- Every numeric is tunable in one place (`SELECTION_PARAMS`) with its rationale here, so v1 calibration is a parameter edit plus this ADR, not a code rewrite.

## References

- `lib/agents/instrument-selection.ts` (`SELECTION_PARAMS`, the funnel, cadence, top-up, alternatives split).
- ADR-0033 (the sub-sleeve tilt the funnel fills); ADR-0032 (the per-investor targets the redeployment fills toward); the instrument-selection pre-build audit.
