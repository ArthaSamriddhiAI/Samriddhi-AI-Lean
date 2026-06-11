# Nine-cell SAA band specification: proposal for cell-by-cell ratification

- Date: 2026-06-11 (Package 10 continuation, Part 2)
- Status: **PROPOSAL ONLY. Nothing here is codified.** No cell's bands are written into the grid, no fixture exists, no ADR is written. The primary ratifies cell by cell; only a ratified proposal gets codified in a later pass.
- Branch: `features/package-10` (app repo head at the Part 1 landing; data repo at the v2.1.0 release).
- Scope of this artifact: the strategic-asset-allocation (SAA) targets and tolerance bands for the nine (risk appetite x time horizon) cells, with per-cell rationale, cited provenance, coherence checks against everything that already exists, and the WA30 classification of what codification would force.

## 1. What is inherited, not reinvented

- **The grid, the enum, the mapping**: FR Entry 13.0 section 3 as given. Axes: risk appetite (aggressive, moderate, conservative) by time horizon (over 5 years, 3 to 5 years, up to 3 years); cell ids `<risk>_<horizon>`; the investor-field-to-cell mapping direct from `risk_appetite` and `time_horizon`. The Lean implementation of this vocabulary already exists (`lib/explorer/cells.ts`, ADR-0053) and is used unchanged.
- **The reserved slot this fills**: FR Entry 13.0 section 3.3 reserved a cell-level guidance schema and deliberately left it unpopulated: "If a future cluster wants explicit cell-level percentage targets ... the schema accommodates additive extension without breaking changes." This proposal populates exactly that reserved slot. **Confirmed additive**: in the Lean codebase the codification target is a new typed fixture keyed by the existing `CellId` (consumed by the explorer's grid render), no schema change, no migration, no change to any existing store; ADR-0053 point 2 explicitly anticipated this arrival.
- **The anchor cell**: the established indicative 65/25/7/3 split with bands 60-70 / 20-30 / 5-10 / 2-5 (foundation section 2, `MODEL_BANDS`). This proposal adopts it **exactly, with no refinement** (section 4, cell 1); the other eight cells are constructed coherently around it.

## 2. Boundaries held

- **Distinct from the held house-view framework (P54).** This register sets per-cell asset-CLASS targets and tolerances. The tier-keyed house-view framework (held with in-flight colleague work) sets WITHIN-sleeve composition (equity cap splits, debt credit splits). They compose at render and reference each other; neither writes the other. Codifying these bands does not unhold P54, and nothing here touches ADR-0033/0036/0037 or `EQUITY_SPLIT_BY_TIER` / `DEBT_CREDIT_SPLIT_BY_TIER`.
- **Distinct from the portfolio-risk-analytics rubric.** The HHI ceilings by tier (0.20 / 0.25 / 0.30 / 0.35), concentration thresholds, and liquidity-bucket rules are a separate risk-ceiling table. This grid does not merge into or modify it. Observations, not reconciliations: (a) no numeric contradiction exists, the two systems measure different dimensions (SAA class shares versus concentration and liquidity ceilings); (b) the rubric's four risk tiers (including Ultra-Aggressive and Moderate-Aggressive) are a finer labelling than the grid's three FR-specified rows; an investor whose stated appetite maps to a rubric refinement still lands in one of the three grid rows per FR 13.0; (c) the foundation section 3 liquidity-tier floors (for example essential, 5 to 15 percent highly liquid) are satisfied through the T+30/T+90 buckets (liquid and short debt funds, listed equity), not through the Cash class alone, which is why the anchor cell's 3 percent cash coexists with the essential floor today and the proposed cells inherit the same logic.

## 3. Construction principles (the rationale skeleton)

1. **Equity scales with horizon.** Equity needs a window long enough to ride a drawdown-and-recovery cycle. Over 5 years carries the full risk budget; 3 to 5 years roughly one cycle, stepped down about 10 points; under 3 years is capped hard (a drawdown in year one may not recover before the money is needed). The Indian regulatory embodiment of horizon tapering is the NPS lifecycle family (LC75/LC50/LC25 caps with age-based glide); it is cited for the taper PRINCIPLE and the 75/50/25 risk-ladder structure, not for exact levels (NPS is a retirement glide product, not an HNI SAA register).
2. **Equity scales with risk appetite.** The three rows step roughly 15 points of equity apart, the conservative/balanced/aggressive ladder that SEBI's own scheme categorization encodes for India: Conservative Hybrid 10-25 percent equity, Balanced Hybrid 40-60, Aggressive Hybrid 65-80 (SEBI categorization and rationalization circular, October 2017). The grid's long-term column lands its rows at 65 / 50 / 35, each inside or adjacent to its SEBI analogue; the short-term column lands at 30 / 20 / 10, the conservative end of each analogue.
3. **Debt is the ballast residual** and grows toward short horizons and conservative appetites. The grid sets only the class share; duration preference per horizon is already shipped (`durationForHorizon`: short horizon prefers short duration) and credit posture belongs to the held house-view, so this register deliberately says nothing about either.
4. **Alternatives are bounded by lock-up versus horizon.** The snapshot's own AIF profiles run closed-ended with 5-plus-year tenures and 0.25 Cr-plus commitments, so AIF-bearing alternatives are a long-horizon allocation by construction. Short-horizon and conservative cells hold alternatives small and liquid-weighted (gold: SGB, ETF, physical; REIT), never locked vehicles. The 5-10 band ceiling at the anchor reflects the foundation's "non-institutional HNI mandate ceiling" rationale; no cell exceeds it.
5. **Cash rises as the horizon shortens.** Cash here is the tactical and near-term-spending buffer (the foundation's reading), not the liquidity floor (see section 2c). Long-horizon cells hold 3 to 8; short-horizon cells hold 10 to 13 with wider upside room.
6. **Tolerance bands follow the anchor cell's own convention**: plus or minus 5 percentage points on the two major classes (equity, debt), roughly minus 2 / plus 3 around small alternatives targets (floored at 0 where opting out is legitimate), and minus 2 / plus 3 to plus 5 on cash with the wider upside where the target is 10 or more. The plus or minus 5 absolute threshold on majors is the standard institutional IPS and rebalancing-band convention (threshold-rebalancing practice as popularised in Vanguard's rebalancing research and IPS practice generally; practice convention, from training knowledge). Targets are carried explicitly (the ADR-0032 pattern), so a band's midpoint need not equal its target.
7. **Targets sum to exactly 100 in every cell** (verified below).

## 4. The nine cells

Asset classes: Equity / Debt / Alternatives / Cash. Format: target (band).

### Aggressive row

| Cell | Equity | Debt | Alternatives | Cash | Sum |
|---|---|---|---|---|---|
| `aggressive_long_term` (ANCHOR) | 65 (60-70) | 25 (20-30) | 7 (5-10) | 3 (2-5) | 100 |
| `aggressive_medium_term` | 55 (50-60) | 33 (28-38) | 7 (5-10) | 5 (3-8) | 100 |
| `aggressive_short_term` | 30 (25-35) | 55 (50-60) | 5 (2-8) | 10 (8-15) | 100 |

- **aggressive_long_term**: adopted from foundation section 2 **exactly**; no refinement. This is the reconciliation the kickoff requires: targets 65/25/7/3, bands 60-70 / 20-30 / 5-10 / 2-5, byte-for-byte the anchor.
- **aggressive_medium_term**: equity steps down 10 points (one full drawdown cycle of headroom, not two); the freed risk budget moves to debt ballast (33) and a slightly deeper cash runway (5). Alternatives hold at 7 with a tenor caveat: new Cat II commitments at the start of a 3-to-5-year window are marginal against 5-plus-year fund tenures; in practice this sleeve weights toward gold and already-seasoned commitments. SEBI analogue: between Aggressive Hybrid (65-80) and Balanced Hybrid (40-60); deliberately below the Aggressive Hybrid floor because this is a multi-asset book carrying alternatives and cash that a hybrid fund does not.
- **aggressive_short_term**: under 3 years even an aggressive temperament gets a capped equity engine (30): a year-one drawdown may not recover inside the window. Debt dominates (55, short-duration preference per the shipped `durationForHorizon`); alternatives 5, gold-weighted, no new locked vehicles (band floor 2 allows trimming toward liquid-only); cash 10 for near-term needs.

### Moderate row

| Cell | Equity | Debt | Alternatives | Cash | Sum |
|---|---|---|---|---|---|
| `moderate_long_term` | 50 (45-55) | 38 (33-43) | 7 (5-10) | 5 (3-8) | 100 |
| `moderate_medium_term` | 40 (35-45) | 47 (42-52) | 6 (4-9) | 7 (5-10) | 100 |
| `moderate_short_term` | 20 (15-25) | 63 (58-68) | 4 (2-7) | 13 (10-18) | 100 |

- **moderate_long_term**: the classic balanced-growth book: half equity for the long engine, deep ballast. SEBI analogue: the upper half of Balanced Hybrid (40-60). Alternatives keep the anchor's 7 (the long horizon services Cat II tenures); cash 5.
- **moderate_medium_term**: equity 40 sits at the Balanced Hybrid floor; debt approaches half the book; alternatives trim to 6 with the same tenor caveat as the aggressive row; cash 7.
- **moderate_short_term**: equity 20 (mid Conservative-Hybrid territory, deliberately: a moderate temperament on a short window behaves conservatively); debt 63; alternatives 4 liquid-weighted; cash 13.

### Conservative row

| Cell | Equity | Debt | Alternatives | Cash | Sum |
|---|---|---|---|---|---|
| `conservative_long_term` | 35 (30-40) | 52 (47-57) | 5 (3-8) | 8 (6-11) | 100 |
| `conservative_medium_term` | 25 (20-30) | 62 (57-67) | 4 (2-7) | 9 (7-12) | 100 |
| `conservative_short_term` | 10 (5-15) | 75 (70-80) | 3 (0-5) | 12 (9-16) | 100 |

- **conservative_long_term**: capital protection first, but a multi-decade window still earns a meaningful equity sleeve (35) against inflation; above the NPS LC25 cap (25) deliberately, because LC25 is a retirement-glide cap while this is an HNI stewardship book with a perpetual tail; flagged for ratification attention. Debt 52; alternatives 5 (gold-leaning); cash 8.
- **conservative_medium_term**: equity 25 lands exactly at the Conservative Hybrid top edge (10-25). **Iyengar coherence flag (the one live instance in this cell)**: her investor_specified mandate runs equity 25-45 with debt 45-65, wider and equity-friendlier than this cell default, because it was authored around inherited equity holdings with emotional weight and a perpetual stewardship tail beyond the 3-to-5-year operational window. No conflict arises: per ADR-0053 precedence her mandate governs her; the cell default is the firm's clean-slate stance for the profile. The gap (cell 20-30 versus mandate 25-45) is itself information the surface can render. Ratify with this comparison visible.
- **conservative_short_term**: the preservation cell: equity 10 (Conservative Hybrid floor region), debt 75 short-duration, alternatives 3 with a 0 floor (gold only, opting out is legitimate), cash 12.

## 5. Coherence checks

- **Anchor**: `aggressive_long_term` is byte-identical to foundation section 2. No refinement proposed.
- **Row and column monotonicity**: equity rises left-to-right within every row (horizon) and bottom-to-top within every column (appetite); debt does the reverse; no inversions.
- **Existing bespoke mandates versus their cells** (mandates always govern; this is an information check, not a retrofit): Bhatt/Malhotra/Surana sit on the anchor bands exactly. Sharma (50-70 equity, widened per the verdicts file) brackets the anchor target from below; his band's floor matches `moderate_long_term`'s ceiling region, consistent with his "aggressive stated, closer to moderate by revealed pattern" file. Menon's explicit targets (65/15/15/5) sit inside his widened bands but his Alternatives 15 exceeds the anchor cell's 10 ceiling, which is exactly why his mandate carries explicit targets (ADR-0032) and why mandate-over-cell precedence exists. Iyengar: section 4, conservative row.
- **Rubric observation (per the kickoff)**: no proposed band contradicts a rubric ceiling; the systems measure different dimensions. The only naming overlap (Conservative/Aggressive labels) is handled by FR 13.0's three-row mapping; the rubric's finer tiers remain rubric-only.
- **Snapshot universe serviceability**: every cell is constructible from the live universe (equity and debt funds across the needed categories, gold ETFs and SGB analogues, liquid funds for cash); the funnel (ADR-0034) already demonstrates instrument selection for equity sub-buckets, debt cells, and gold.

## 6. Provenance

External (informing, not determining; the numbers above are reasoned for Samriddhi's Indian HNI context):

- SEBI, Categorization and Rationalization of Mutual Fund Schemes (October 2017): the Indian regulatory equity-band ladder for conservative/balanced/aggressive hybrid allocations (10-25 / 40-60 / 65-80). [sebi.gov.in circular](https://www.sebi.gov.in/legal/circulars/oct-2017/categorization-and-rationalization-of-mutual-fund-schemes_36199.html); secondary summaries: [AMFI knowledge centre](https://www.amfiindia.com/investor/knowledge-center-info?zoneName=CategorizationOfMutualFundSchemes), [PwC note](https://www.pwc.in/assets/pdfs/financial-service/categorisation-of-mutual-fund-schemes.pdf).
- NPS lifecycle funds (LC75/LC50/LC25): the Indian embodiment of risk-laddered equity caps with horizon tapering. [Zerodha Varsity, NPS investment options](https://zerodha.com/varsity/chapter/investment-options-in-nps/), [PIB on LC75 extension](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2182253&reg=3&lang=2), [Aditya Birla pension fund, auto choice](https://pensionfund.adityabirlacapital.com/nps_investment_choices.aspx).
- Tolerance-band convention (plus or minus 5 percentage points absolute on major classes as the standard IPS rebalancing threshold; threshold-rebalancing practice as in Vanguard's rebalancing research): practice convention, from training knowledge, labelled as such.

Internal: foundation section 2 (the anchor cell and its band pattern, the alternatives-ceiling rationale) and section 3 (liquidity tiers); `MANDATES_BY_INVESTOR` (the four bespoke mandates as live instances); ADR-0032 (explicit-target-or-midpoint), ADR-0053 (cell vocabulary and precedence), ADR-0034/0037 (what the funnel and duration logic already cover, hence what this register deliberately omits); the snapshot AIF tenure data (lock-up grounding); P43 (the debt this resolves at codification), P54 (the held house-view this does not touch).

## 7. WA30 classification at codification (classify only; nothing written now)

- **One net-new ADR** at codification: "the nine-cell SAA band register" (values, provenance, and its slot in the ADR-0053 precedence chain: mandate over cell default over anchor fallback). It **amends ADR-0053 point 2 forward** (ADR-0053 anticipated exactly this: "will supersede or amend this ADR's point 2 when it lands"); the annotation goes on ADR-0053's point 2 at codification. No supersedes: nothing reverses.
- **P43 resolves at that codification** (the risk-by-horizon to bands mapping then exists as data plus the already-shipped resolution seam). P45 and P54 are untouched; codifying this register does not unhold the house-view.
- **Codification shape** (for sizing, not execution): a typed fixture keyed by `CellId` (the `structured-mandates.ts` pattern), rendered by the existing grid (the `cellEmpty` states fill in); explicitly NOT consumed by the agents or the comparison pipeline in that pass (decision-support display only; the operative comparison stays mandate-first per ADR-0032) unless separately ratified.

## 8. Ratification ask (WA17; cell by cell)

Recommend ratifying in this order, which front-loads the cells with live instances:

1. `aggressive_long_term`: adopt as the anchor, exact (no decision content beyond confirming no refinement).
2. `conservative_medium_term`: the Iyengar-adjacent cell; ratify with the section 4 comparison visible.
3. `aggressive_medium_term` and `aggressive_short_term`.
4. `moderate_long_term`, `moderate_medium_term`, `moderate_short_term`.
5. `conservative_long_term` (note the flagged NPS-cap divergence rationale) and `conservative_short_term`.

Each cell can be ratified as proposed, ratified with amended numbers, or held; the codification pass takes only the ratified set.
