# ADR 0033: Sub-sleeve allocation framework, the model-portfolio foundation slice

## Status

Accepted, 2026-05; expanded later in T-5.12 Finding 1 on `features/a3-so-what`, PR #11. The split tables live in `db/fixtures/structured-mandates.ts` (`EquitySplit`, `DebtCreditSplit`, `EQUITY_SPLIT_BY_TIER`, `DEBT_CREDIT_SPLIT_BY_TIER`, `durationForHorizon`, optional `Mandate.sub_sleeve_tilt`); the instrument-selection funnel consumes them (`lib/agents/instrument-selection.ts`).

This ADR carries the "what the target allocation should be" decisions. The "how instruments are picked" mechanics are ADR-0034; flexi look-through is ADR-0035; international placement is ADR-0036; the 2D credit-by-duration debt model is ADR-0037.

## Context

Finding 1 selects specific instruments to fill an under-target sleeve. To do that well it must know not just how much equity or debt an investor should hold (the asset-class bands, ADR-0032) but what kind within the sleeve. The pre-build and look-through audits confirmed `sebi_category` plus the per-fund composition and Duration/AAA% metrics make a risk-profile tilt fully data-driven. There is no risk-appetite-by-time-horizon to model-portfolio framework yet (product debt P43); the per-investor mandates are bespoke. So this is the first stated, reusable slice of that future framework, built to be extended rather than replaced.

An earlier version of this ADR used a directional tilt (`large_only` / `large_mid` / `small_mid_lean`), which the primary corrected: a directional tilt can zero out a sleeve's core (an aggressive investor still needs a large-cap ballast; aggression is a tilt, not the elimination of stability). It was replaced with explicit splits and a never-zero principle.

## Decision

The allocation framework is a set of explicit splits keyed by risk tier (and, for debt duration, by time horizon), with a never-zero core. A mandate may override via the optional `Mandate.sub_sleeve_tilt` (the ADR-0032 optional-field pattern); absent an override, the house-view default for the tier applies.

**Equity, two levels.** Level 1 splits the equity sleeve domestic vs international; Level 2 splits the domestic portion across large/mid/small cap. International is its own bucket alongside the domestic cap-split, not on the domestic cap axis (a different geography). Per cent of the equity sleeve (Level 1) and of the domestic portion (Level 2):

| Tier | Intl | Domestic large | mid | small |
|---|---|---|---|---|
| Conservative | 10 | 75 | 20 | 5 |
| Moderate-Aggressive | 15 | 55 | 35 | 10 |
| Aggressive / Ultra | 20 | 35 | 40 | 25 |

Monotonic by design (large descends 75 to 35 with rising risk, small ascends 5 to 25, mid is the growth engine that rises then plateaus, international rises 10 to 20). The never-zero core holds at both levels: every tier keeps a meaningful domestic large-cap core AND a real, non-dominant international allocation.

**Debt, credit axis** (per cent of the debt sleeve, by risk appetite):

| Tier | Sovereign/gilt | High-grade/AAA | Corporate/credit-risk |
|---|---|---|---|
| Conservative | 55 | 42 | 3 |
| Moderate-Aggressive | 35 | 55 | 10 |
| Aggressive / Ultra | 25 | 55 | 20 |

Principle: debt is the portfolio's ballast; even aggressive debt stays at least 80 per cent sovereign-plus-high-grade, and credit-risk caps at 20 per cent. The investor takes risk on the equity side, not in the safe bucket. The credit-bucket-to-`sebi_category` mapping and its SEBI rationale are in ADR-0037.

**Debt, duration axis** by time horizon (a selection preference, ADR-0037): short horizon prefers short duration, long horizon can hold longer duration for yield. `durationForHorizon` maps the free-text horizon to short/medium/long.

## Consequences

- Every tier reaches its sleeve target with a risk-appropriate composition and a non-zero core at every level.
- The splits are house-view-by-tier with a per-investor override seam, so the demo personas need no per-investor tilt authoring while a future investor can state one.
- This ADR's debt credit-only splits became the CREDIT AXIS of the ADR-0037 2D framework, and the earlier duration-deferred scope boundary is SUPERSEDED by ADR-0037 (recorded here so a reader does not reinstate the deferral).

## References

- `db/fixtures/structured-mandates.ts` (the split tables; `Mandate.sub_sleeve_tilt`).
- ADR-0032 (the optional-field pattern and the per-investor targets the redeployment fills toward); ADR-0034 (selection mechanics); ADR-0035 (flexi look-through); ADR-0036 (international placement); ADR-0037 (2D credit-by-duration). Product debt P43 (the future full framework), P45 (selection calibration).
