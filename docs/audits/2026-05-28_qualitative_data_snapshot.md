# Qualitative-data audit: opaque holdings and all-holdings look-through

**Date:** 2026-05-28
**Task:** T-5.12 (A3 So-What), guardrail-3 input. Blocks Step 2 (the trim/exit judgment's treatment of opaque holdings).
**Branch:** `features/a3-so-what`, PR #11 (held at WA1). Step 1 committed (`cb18181`).
**Status:** Read-only audit (WA22 deliverable). No code, no API, no merge. This is the canonical record of what qualitative data the `t0_q2_2026` snapshot carries for the 5 Samriddhi 2 fixtures; while the snapshot is unchanged, the question does not need re-investigating.

## Question

For every holding across the 5 Samriddhi 2 fixtures (bhatt, menon, surana, iyengar, malhotra; not sharma), what qualitative / non-numeric data exists, and which of the five trim-vs-exit dimensions can it honestly inform? In particular: do opaque (PMS/AIF) holdings carry enough decision-relevant signal to support an exit judgment on non-performance grounds, so that the guardrail-3 choice (never-exit-opaque vs exit-eligible-on-assessable-dimensions) rests on the data, not an assumption?

## 1. Per-holding data census

Sources per holding: `content.a2_classification` (holding list, sub_category), `content.risk_reward_stats.per_holding` (tier_b numeric), `content.evidence` (E1/E4/E6/E7). "tier_b" means a non-null `stats` with `source: tier_b_read_through`. Opaque = sub_category prefix `pms_` / `aif_`.

| Fixture | Holding | Class | Opaque | tier_b (Perf) | E-agent qualitative |
|---|---|---|---|---|---|
| bhatt | Marcellus Consistent Compounder PMS | Equity | yes | no | E6 |
| bhatt | White Oak India Pioneers PMS | Equity | yes | no | E6 |
| bhatt | Motilal Oswal Value Migration PMS | Equity | yes | no | E6 (name-mismatched, see 5) |
| bhatt | Alchemy Smart Alpha 250 PMS | Equity | yes | no | E6 |
| bhatt | Avendus Absolute Return Fund | Alternatives | yes (AIF) | no | E6 |
| bhatt | Reliance Industries, HDFC Bank, ITC | Equity | no | yes | E1 |
| bhatt | Mirae, Parag Parikh | Equity | no | yes | E7 |
| bhatt | HDFC Bank FD | Debt | no | yes | E1 (matched) |
| bhatt | HDFC Arbitrage Fund | Debt | no | yes | none |
| menon | Bank savings account (86.6%) | Cash | no | no | none |
| menon | HDFC Bank FD | Debt | no | no | none |
| menon | US listed equities (legacy) | Equity | no | no | E1 |
| surana | Parag Parikh, Axis, Mirae, SBI Small Cap | Equity | no | yes | E7 |
| surana | Kotak Emerging Equity | Equity | no | no | E7 |
| surana | White Oak India Pioneers PMS | Equity | yes | no | E6 |
| surana | Reliance, HDFC Bank | Equity | no | yes | E1 |
| surana | Vanguard S&P 500 ETF (GIFT) | Equity | no | no | E1 |
| surana | Physical gold, Bank savings | Alt / Cash | no | no | none |
| iyengar | Franklin Corp Debt, Axis, HDFC Index, ICICI Bal Adv | Debt/Equity | no | mixed | E7 |
| iyengar | HDFC Bank FD, SBI FD | Debt | no | no | none |
| malhotra | Mirae, Axis, Parag Parikh, Kotak | Equity | no | mixed | E7 |
| malhotra | NHAI / PFC tax-free bonds, HDFC FD | Debt | no | no | none |
| malhotra | Physical gold | Alternatives | no | no | none |

**Three coverage tiers emerge:**
- **Opaque PMS/AIF (6 holdings, all in bhatt and surana):** no tier_b, but a rich E6 evaluation each (see 2).
- **Transparent funds and direct equity:** numeric tier_b where history permits, plus a qualitative E1 (equity) or E7 (MF) verdict. tier_b is itself partial: Kotak, HDFC Index, intl ETFs, and FDs/bonds lack it.
- **FDs, tax-free bonds, physical gold, cash/savings:** essentially nothing beyond position and type (no tier_b, no evidence verdict). These are allocation instruments, not merit-exit candidates.

## 2. Opaque holdings: the E6 qualitative record

All 6 opaque holdings carry an E6 `per_product_evaluation`. The fields (per `E6PerProduct`, e6-wrappers.ts:18) are substantial and decision-relevant:

| Opaque holding | E6 verdict | complexity_premium_earned | fee_normalised_bps | manager_quality | performance_vs_benchmark (gist) |
|---|---|---|---|---|---|
| Marcellus (bhatt) | positive_with_caution | mixed | 310 | strong | ~14-16% vs Nifty500 ~17-18%, recent underperformance |
| White Oak (bhatt) | positive | yes | 320 | strong | ~18-22% vs ~17-18%, positive |
| Motilal Oswal (bhatt) | **negative** | **no** | 360 | adequate | negative since-inception alpha net of fees |
| Alchemy (bhatt) | positive_with_caution | mixed | 310 | adequate | factor mid-cap, marginal |
| Avendus AIF (bhatt) | positive_with_caution | mixed | 390 | strong | absolute return ~ passive at 390 bps |
| White Oak (surana) | positive_with_caution | mixed | 360 | strong | 3Y net alpha narrows to ~0-150 bps |

Each E6 record also carries `strategy_consistency`, `capacity_concern`, `fee_structure_assessment` (prose), `concentration_or_strategy_profile` (prose), `key_risks` (list), and `recommended_alternatives` (list). The `key_risks` and `concentration_or_strategy_profile` fields routinely name redundancy explicitly, e.g., White Oak: "Strategy overlap with Marcellus non-trivial: both screen for quality; potential double-counting of quality factor exposure"; Alchemy: "Strategy overlap with mid-cap allocation in other portfolio sleeves." `recommended_alternatives` sometimes names exit directly, e.g., Motilal: "Exit and redeploy into existing White Oak or Marcellus positions if PMS wrapper count rationalisation is pursued."

Confidence nuance: four of the six (Marcellus, White Oak, Alchemy, Avendus) carry "No snapshot record" and are anchored in published positioning at confidence ~0.55-0.60; Motilal has a partial snapshot record. The qualitative signal is real but confidence-discounted, which argues for conservative judgment, not for ignoring it.

## 3. Qualitative data mapped to the five dimensions (opaque holdings)

| Dimension | Opaque source | Honest coverage |
|---|---|---|
| Redundancy | E6 `concentration_or_strategy_profile` + `key_risks` (strategy-overlap prose). Numeric overlap is sentinelled (opaque wrappers resolve at categorical, `limited_by: opaque_wrapper`). | **Qualitative, present.** The strategy text names overlap (White Oak/Marcellus quality double-count; Alchemy mid-cap). Not a number, but a real signal. |
| Cost-efficiency | E6 `fee_normalised_bps` (numeric: 310-390), `fee_structure_assessment`, and `complexity_premium_earned` (whether the premium is earned). | **Present, richer than for MFs.** A numeric fee plus an explicit earned/not-earned verdict. Still no fee-vs-peer benchmark number, but the "is the premium justified" judgment is in the E6 verdict. |
| Performance | E6 `performance_vs_benchmark` (prose with alpha figures) + `complexity_premium_earned`. Numeric tier_b is **sentinelled** (no tier_b for opaque). | **Numeric sentinelled, qualitative present.** Motilal's "negative since-inception alpha net of fees" is a clear qualitative performance concern; the numeric Sharpe is simply absent. |
| Thesis/quality | E6 `overall_verdict`, `manager_quality`, `strategy_consistency`, `complexity_premium_earned`, `key_risks`. | **Rich.** This is E6's core output; per-instrument verdicts across all 6 opaque holdings. |
| Suitability/mandate | E4 `stated_vs_revealed_divergence` (portfolio-level only); no per-holding mandate-fit. | **Thin** (same as for transparent holdings). |

## 4. Broader finding (all holdings, not just opaque)

The ping asked for all-holdings scope to avoid later rework. Confirmed: qualitative evidence enriches Thesis (and partly Cost and a qualitative Performance) for transparent holdings too. E1 (direct equity) carries `metric_family_scores` across seven families plus `overall_verdict`; E7 (MF) carries `manager_strategy`, `performance_attribution` (1Y/3Y/5Y returns, `alpha_summary`), `fee_cost.ter_pct`, and `overall_verdict`. Notably, several transparent holdings lack tier_b (Kotak, HDFC Index, intl ETFs) but still carry an E7 verdict, so their Performance dimension is qualitative-only, exactly like opaque holdings. The clean split is therefore not transparent-vs-opaque but **evidence-covered (funds and equity, rich qualitative) vs non-covered (FDs, bonds, gold, cash, essentially position-only)**.

## 5. Risks and caveats for the build

- **Name-mismatch wiring risk (load-bearing).** The Motilal holding is named "Motilal Oswal Value Migration PMS" in the fixture, but its E6 record is "Motilal Oswal Value Strategy PMS", and the E6 record itself flags "Snapshot fund name is 'Motilal Oswal Ethical Strategy' not 'Value Strategy'." A normalized startsWith match (the approach A2 and A3 use) does NOT link "Value Migration" to "Value Strategy", so A3 would sentinel Motilal's E6 signals despite the data existing. Any opaque exit judgment that relies on linking a holding to its E6 record must handle this; otherwise the one clearly-exit-worthy opaque holding in the fixtures (Motilal: negative verdict, complexity not earned, negative alpha) is the one A3 would fail to wire.
- **The opaque signals are LLM-produced (E6), not deterministic numbers.** An opaque exit judgment reasons over E6's verdicts and prose, so the deterministic marker shifts from "Sharpe below zero" to "E6 overall_verdict is negative" and "complexity_premium_earned is no". These are fixed per case (persisted), but they are opinions, so conservative weighting is warranted.
- **Confidence discount.** Four of six opaque evals are published-knowledge-anchored at ~0.55-0.60 confidence (no snapshot record). Exit on opaque should require the stronger, lower-ambiguity signals (a negative verdict plus complexity-premium-not-earned), not a marginal read.

## 6. Guardrail-3 verdict

**(i) Rich qualitative data exists.** Opaque holdings carry a full E6 evaluation that honestly informs Thesis (richly), Cost (numeric fee plus an earned/not-earned verdict), a qualitative Performance read (`performance_vs_benchmark`, `complexity_premium_earned`), and a qualitative Redundancy read (strategy-overlap prose). Therefore **opaque holdings CAN be exit-eligible on assessable non-performance dimensions, judged conservatively, with numeric performance acknowledged as missing.** "Never exit opaque" would be a misread of the data, not an honest reflection of it.

The proof case is **Motilal Oswal** (bhatt): E6 `overall_verdict` negative, `complexity_premium_earned` no, negative since-inception alpha net of fees, 360 bps fee, and E6 itself recommends exit-and-redeploy. That is a multi-dimension convergence (Thesis negative + qualitative Performance negative + Cost premium not earned) that clearly supports exit. The Step-1 gate, which requires a numeric Sharpe below zero, would wrongly block it (Motilal has no tier_b).

**Implication for the exit gate (recommendation; primary decides at guardrail-3):** treat the E6 qualitative verdicts as assessable concern markers for opaque holdings, so the exit gate becomes: a transparent holding is exit-eligible on numeric Performance-concern plus Thesis-concern (Step-1 logic); an opaque holding is exit-eligible on a conservative qualitative convergence (E6 `overall_verdict` negative AND `complexity_premium_earned` is no, with the strategy-overlap and fee signals corroborating). Opaque holdings are not "never exit", but the bar is the stronger, lower-ambiguity E6 signals, and the Motilal name-mismatch must be resolved so the holding can be linked to its evidence.

This audit does not change code or the gate; it establishes the data reality so the primary can finalize guardrail-3.
