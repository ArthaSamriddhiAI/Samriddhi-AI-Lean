# Look-through, international, and credit-by-duration audit: data for the expanded sub-sleeve framework

**Date:** 2026-05-30
**Task:** T-5.12 (A3 So-What), targeted data audit before expanding the sub-sleeve framework (Finding 1). Confirms what the snapshot supports for flexi/multi-cap look-through, international-equity representation, and a two-dimensional credit-by-duration debt framework.
**Branch:** `features/a3-so-what`, PR #11 (draft). Held at WA12; the Finding 1 + Finding 3 code is committed (`7fc0232`) but the sub-sleeve framework is being expanded before any backfill.
**Mode:** Read-only. No code, no API, no commit beyond this doc. No placement decided.

## Step 0: existing-coverage triage

| Question | Prior coverage | This audit |
|---|---|---|
| A flexi look-through composition data | **Partially.** `2026-05-29_a3_deployment_and_profile.md` Section A.2 noted `LargeCap %` / `MidCap %` / `SmallCap %` exist as fields | Audit the delta: coverage counts, the unit, the international gap, the persona holdings, the fallback |
| B international representation | **Not previously audited** | Fresh (done) |
| C duration data and the 2D constraint | **Partially.** `2026-05-30_instrument_selection_prebuild.md` Section C listed the duration categories and said "a duration tilt is available if wanted" | Audit the delta: the mutually-exclusive-category constraint, and the per-fund Duration / AAA% metrics that resolve it |
| D time-horizon wiring | **Partially.** `2026-05-29_a3_deployment_and_profile.md` Section B noted `timeHorizon` exists and is used only for the HHI tier | Audit the delta: is it structured-reachable from A3 for a duration tilt |

## Section A: equity composition for flexi-cap look-through

**Domestic cap composition is present and persona-covered; international is not labeled, only inferable as a residual.**

The per-fund domestic cap split exists: `LargeCap %` 977 of 1773 (55 percent), `MidCap %` 970 (55 percent), `SmallCap %` 766 (43 percent), `Cash %` 1345 (76 percent). The values are fractions of the total portfolio, not of the equity sleeve (Parag Parikh's `LargeCap %` is 0.63, meaning 63 percent of the whole fund).

The canonical case confirms both the capability and the gap. Parag Parikh Flexi Cap Fund: `LargeCap %` 0.63, `MidCap %` 0.022, `SmallCap %` 0.027 (so 63 + 2.2 + 2.7 = 67.9 percent domestic equity, matching its `Equity %` of 67.91), `Cash %` 3.57. That leaves roughly 28.5 percent of the fund unaccounted, which is its well-known international sleeve, but there is NO field that labels it: `Intl %`, `International %`, `Overseas %`, and `Foreign %` are all 0 of 1773. So a flexi fund's international exposure is detectable only as the residual after domestic cap plus cash, not as a typed, quantified field, and the kind of international (US, emerging markets) is not recoverable from the fund record.

The persona equity holdings carry the cap split, so look-through works on the demo set: Mirae Asset Large Cap (L 0.85 / M 0.089 / S 0.054), Axis Large Cap (L 0.90 / M 0.012), SBI Small Cap (M 0.028 / S 0.83), ICICI Balanced Advantage (L 0.58 / M 0.056 / S 0.032, plus a Duration of 3.24), and Parag Parikh itself.

The fallback for the roughly 45 percent of funds without a cap split is the `sebi_category`-implied default (a `Large Cap Fund` is approximately all large cap, a `Mid Cap Fund` approximately all mid, and so on); this is coarse but grounded, and the pure-cap categories rarely need look-through anyway since their category already states the cap.

**Read:** domestic-cap look-through is buildable (compute the cap contribution from the three fields, fall back to the category default when absent). The international portion inside a flexi fund is the partial-data piece: present as a residual, not labeled.

## Section B: international-equity representation

**International currently folds into Equity undifferentiated; a dedicated international universe exists for an explicit sub-sleeve.**

In the holdings taxonomy, overseas exposure is tagged at the sub-category level (`intl_us_etf`, `intl_us_individual`) but classified `assetClass: "Equity"` (`db/fixtures/structured-holdings.ts:35-36, 154, 169`), so it currently folds into the equity sleeve with no separation. Two of the five personas hold it: Arjun Menon (US listed equities, 6.6 percent, `intl_us_individual`) and Rajiv Surana (Vanguard S&P 500 ETF via GIFT, 8.7 percent, `intl_us_etf`).

The universe carries 66 dedicated international vehicles: `FoFs Overseas` 54, `ETFs- Global` 6, `Sectoral- Foreign Equity` 6 (`FoFs Domestic` 101 are domestic and not international). So an explicit international sub-sleeve has a real candidate universe, though the cap-split look-through does not apply to those funds (they are international, not domestic cap).

**Placement options (surfaced, not decided):**

1. **International as its own sub-sleeve under equity.** The data supports it: the 66-fund dedicated universe plus the `intl_*` holdings tags. A flexi fund's international residual could feed it. Cost: the international residual inside a flexi fund is imprecise (Section A), and the selection funnel for the international sub-sleeve runs on the same metrics as any other (TER, risk-adjusted), so it is mechanically straightforward.
2. **Fold international into domestic equity undifferentiated (current state).** Simplest, but it loses the international identity the narration wants to state, and it mis-counts a flexi fund's international residual as domestic cap, distorting the cap-mix look-through.

The data leans toward option 1 being feasible and more honest, but the decision (and how to treat the flexi-internal residual) is the primary's.

## Section C: duration data and the 2D credit-by-duration constraint

**This is the load-bearing finding, and the news is good: the mutually-exclusive-category constraint is real but resolved by per-fund metrics.**

The constraint the design must reckon with: the credit-defined categories (`Gilt Fund`, `Corporate Bond Fund`, `Credit Risk Fund`, `Banking and PSU Fund`) and the duration-defined categories (`Short`, `Medium`, `Long Duration`, and the ultra-short family) are SEPARATE `sebi_category` values. A fund carries exactly one category, so the category alone cannot place a fund on both axes: a `Short Duration Fund` has no credit category, and a `Corporate Bond Fund` has no duration category. On `sebi_category` alone, the two axes are only partially jointly observable.

The resolution is that the per-fund metrics carry the missing axis, and they are richly populated on the eligible debt universe:

- A per-fund **`Duration`** metric exists (685 of 1773 universe-wide, 39 percent), and on the eligible debt funds it is near-complete: Corporate Bond 17 of 17 eligible, Credit Risk 6 of 6, Banking and PSU 14 of 14, Gilt 16 of 16, Short Duration 16 of 16, Medium Duration 8 of 8, Long Duration 4 of 4.
- A per-fund **`AAA %`** metric exists (521 universe-wide, 29 percent), and on the eligible debt funds it is near-complete EXCEPT gilts: Corporate Bond 17 of 17, Credit Risk 6 of 6, Banking and PSU 14 of 14, Short Duration 16 of 16, Medium 8 of 8; Gilt 0 of 16 (gilts hold government securities, so they have no corporate AAA share, their credit is sovereign by category, not by `AAA %`).
- `YTM` / `Net YTM` corroborate (694 / 579). A full `Rating Profile (JSON)` exists but is sparse (95, 5 percent), so it is a nice-to-have, not the primary signal.

Concrete proof that the secondary axis reads cleanly: DSP Short Term Fund (a duration-category fund) carries `Duration` 2.48 and `AAA %` 76.52, so its credit quality is observable despite its category being duration; Franklin India Corporate Debt (a credit-category fund) carries `Duration` 2.93, so its duration is observable despite its category being credit.

**So a true 2D credit-by-duration placement IS buildable for the eligible debt universe**, by combining the category and the metric: place a fund's credit from its credit category, or from `AAA %` bucketing for a duration-category fund (gilts go sovereign by category); place its duration from the `Duration` metric, or from its duration category. It does not degrade to a primary-axis-plus-throwaway-secondary model; it is genuine 2D, resting on three things the design must state and own: (a) the metric coverage (near-complete on eligible debt, but sparse universe-wide, so the framework is sound for selection-from-eligible and weaker as a universe-wide census), (b) the gilt exception (credit by category, not `AAA %`), and (c) two new stated bucketing-threshold rules, an `AAA %` cut for the credit buckets (for example AAA above some threshold is high-grade) and a `Duration` cut for the duration buckets (for example under 3 years is short, 3 to 5 medium, over 5 long). Those thresholds are an ADR-grade stated rule, not a free parameter.

## Section D: time-horizon classification wiring

**The horizon exists per investor but is not structured-reachable from A3; duration-by-horizon is wiring plus new logic, not data work.**

`Investor.timeHorizon` (`db/seed.ts`) carries: "Over 5y" for malhotra, bhatt, menon, surana, sharma, and "3-5y operational" for iyengar. So five of six personas are long-horizon and one is medium; there is no short-horizon persona in the demo set (worth noting, since the short-duration tilt would not be exercised by any current fixture).

The wiring is the same pattern Findings 2 and 5 hit: `timeHorizon` is in the investor record and is embedded only as free text in the `mandate` narrative string passed to the evidence agents (`lib/agents/pipeline.ts:213`, "time_horizon: ${investor.timeHorizon}"); it is not part of the structured `metrics` A3 consumes, so A3 cannot read it today. Duration-by-horizon therefore needs `timeHorizon` threaded into A3 as a structured input (wiring, like Finding 5 threaded the mandate), plus a horizon-to-duration-tilt mapping (new logic, the sibling of the credit tilt). The data exists; the work is plumbing and a stated rule.

## Build-readiness read

| Piece | Readiness | Trichotomy |
|---|---|---|
| Flexi/multi-cap look-through (domestic cap) | **Ready.** Cap split present on 43 to 55 percent of funds and on the demo personas; category-default fallback for the rest. | New logic (the look-through computation and the proportional cap contribution). No data work for the domestic axis. |
| International representation | **Partially blocked, and a placement decision.** A dedicated 66-fund international universe and the `intl_*` holdings tags support an explicit international sub-sleeve; but the international portion inside a flexi fund is a residual only, not labeled or typed. | New structure (an international sub-sleeve) plus the primary's placement decision. The flexi-internal residual is the data gap. |
| 2D credit-by-duration debt | **Buildable (the constraint is resolved by metrics), with stated thresholds.** `Duration` and `AAA %` are near-complete on eligible debt funds; gilts are the credit exception (by category). | New logic (the 2D placement, the AAA-percent and duration bucketing thresholds). Data is sufficient for selection-from-eligible; the universe-wide sparsity is the honest caveat. |
| Horizon wiring | **Ready to wire.** The horizon exists per investor. | Wiring (thread `timeHorizon` into A3) plus new logic (the horizon-to-duration mapping). No data work. No current persona is short-horizon. |

## Proposed ADR breakdown

The primary prefers more, properly-scoped ADRs over fewer overloaded ones. The expansion carries three distinct decisions that each warrant their own ADR, plus a scope update to ADR-0033:

- **ADR-0035, flexi/multi-cap look-through method.** Classify a flexi / multi / focused fund by its actual `LargeCap %` / `MidCap %` / `SmallCap %` composition (contributing proportionally to the cap buckets), retain its diversified type-identity in the narration, infer international as the residual, and fall back to the `sebi_category`-implied default cap mix where composition is absent.
- **ADR-0036, international-equity placement.** Whether international sits as its own sub-sleeve under equity or folds into domestic equity, the decision and its rationale, and how a flexi fund's international residual is treated. (Decision is the primary's; the ADR records it once made.)
- **ADR-0037, the 2D credit-by-duration debt framework.** The credit axis (by risk appetite) and the duration axis (by time horizon), the per-fund-metric placement (`Duration` and `AAA %`), the gilt credit-by-category exception, the stated `AAA %` and `Duration` bucketing thresholds, and the joint-observability constraint and how it is handled.
- **ADR-0033 scope update.** Its credit-only debt splits become the credit axis of the ADR-0037 2D framework, and its duration-deferred scope boundary is superseded by ADR-0037 (record the supersession rather than leaving a stale deferral).

## The C3 constraint, flagged prominently

The one finding most likely to shape the design: on `sebi_category` alone, credit quality and duration are only partially jointly observable, because a debt fund carries exactly one category (credit OR duration). The 2D framework is nonetheless buildable because the per-fund `Duration` and `AAA %` metrics carry the missing axis and are near-complete on the eligible debt universe, with the gilt credit-by-category exception and two new stated bucketing thresholds. The design should adopt a category-primary, metric-secondary placement with stated thresholds, and own the universe-wide metric sparsity as a documented limit, rather than assume a clean two-category census exists (it does not).

## Stops

No build, no API, no placement decided. Holding at WA12; PR #11 stays in draft.
