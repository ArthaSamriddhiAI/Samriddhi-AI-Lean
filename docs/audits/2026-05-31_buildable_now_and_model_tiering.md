# Buildable now before the data lands, and model-tiering with a corrected re-fire cost

**Date:** 2026-05-31
**Branch:** `features/client-weighted-benchmark` (code repo). Audit-only; changes nothing, builds nothing.
**Mode:** Read-only. Two threads in the waiting window before tomorrow's Bloomberg pull. WA2, WA9 (data/capability not render), WA12 (the re-fire stays unauthorized; this informs the number), WA21, WA27, WA7, WA28 (model-tiering and coverage-gap framing are the primary's calls). First-move: new dated `docs/audits/` file.

---

## Thread 1: the buildable-now work front

The test: does it depend only on structure and logic that exist today (the real cross-section, the classifiers, the stat functions), or does it depend on the new monthly series? Built-now work rides the single gated re-fire or a free deterministic back-fill; it does not need a separate paid pass.

### 1. T-5.16 stock and sector look-through (deterministic, fully buildable now) [highest value]

`lib/agents/portfolio-risk-analytics.ts` is deterministic (no LLM). Its sector roll-up is MF-only today: the loop at `:373-406` does `if (!isMF(h.subCategory)) continue` (`:381`), so direct equity and PMS are dropped from sector aggregation, and per-stock weight roll-up across wrappers does not exist. Extending it (decompose wrappers into constituents for a per-stock roll-up across direct equity, MF `Top 5 Holdings (JSON)`, and PMS `top_holdings`; complete sector aggregation beyond MF via the snapshot `sector_map` for direct equity and PMS) runs entirely on the holdings structure and the cross-sectional `Top 5 Holdings`/`Top 5 Sectors` data, which are real today and untouched by the data restoration. Opaque wrappers surface as an uncovered-percentage footnote, the same honest-degradation pattern as the D12 benchmark footnote (WA9: this ships the data and the footnote text; the per-holding donut is render, T-5.09). **Genuinely buildable now**, deterministic, zero token cost; it back-fills free or rides the re-fire.

### 2. Ingestion, merge, and validation machinery (mostly buildable now, dry-runnable today)

The pipeline that reads the two Bloomberg files into a real t0 is logic plus checks: read and parse the BDH output, validate by script (the March 2020 COVID crash present for equity and inverted for debt, total-return not price-return, window 2019-05 to 2026-04 covered at monthly frequency), bypass the ADR-0014 NAV regeneration, and wire the real series into the snapshot. The validation and the merge can be built now and **dry-run against the one real file the primary already pulled today**, so tomorrow's second file just runs the tested pipeline. **Buildable now**; only the final merge run waits for the second file.

### 3. Time-varying R_f plumbing (buildable now)

The risk-free is a single constant consumed only in `risk-reward-stats.ts` (`sharpe` `:272`, `sortino` `:277/:283`, Jensen's in `benchRelative` `:343`, output `:708`). Refactoring those to accept a risk-free rate *series* (a per-month lookup) instead of `RISK_FREE_ANN`, with the existing constant as the degenerate single-value series, is pure plumbing testable today (the degenerate case must reproduce the current numbers exactly). The per-holding `tier_b` recompute path needs the same threading. **Buildable now**; tomorrow's 91-day and 10yr G-Sec series feed the finished socket.

### 4. decomposeHeldDebt (the function buildable now; the blend waits)

Debt currently maps via the read-through `benchmark_index_id`; there is no held-debt decomposition analogous to `decomposeHeldEquity`. The classifier it would use already exists: `creditBucketOf` (`lib/agents/instrument-selection.ts:227`) and `durationBucketOf` (`:244`) over `DEBT_2D_CATEGORIES`, driven by the funds' existing `Duration` / `AAA%` / `sebi_category` (cross-sectional, real today). So the **decomposition function is buildable now** (classify a held debt fund into its duration-by-credit cell). The honest caveat: the blend it feeds (mapping each cell to a real debt index) **must wait** for tomorrow's debt-index grid (the sizing audit's ~11-13 Nifty Fixed Income series). Build the classifier-to-cell function now; wire the cell-to-index blend when the indices land.

### 5. Per-agent model selection (already exists; a config edit, not a build)

Per-agent model selection is already implemented: `LEAN_RUNTIME_OVERRIDES` in `lib/agents/skill-loader.ts:61` sets `llm_model` per skill. So Thread 2's tiering is a map edit, not new machinery. Trivially buildable now.

### Also buildable now (lower priority)
The deterministic recompute script (the ADR-0015 stat functions against the new series) and the validation/verify harness are buildable now as wiring; only their runs need the data.

**Prioritized:** (1) T-5.16 look-through, (2) ingestion/validation machinery dry-run on file 1, (3) R_f series plumbing, (4) decomposeHeldDebt classifier function, (5) the model-map edit. Items 1, 2, 3, 5 are fully buildable now; item 4 is half-now (function yes, blend no).

---

## Thread 2: model-tiering, and a large cost correction

### Correction A: the prior figures used the wrong (legacy) Opus pricing

Every cost figure in this workstream (~$12.7 for e1-e7+s1, ~$18-20 with A2 and A3) used roughly $15 input / $75 output. That is the **legacy Opus 4 / 4.1 rate**. The cases ran on Opus-class agents at the current rate of **$5 input / $25 output** (Opus 4.7 / 4.8). So those figures are about three times too high. I am correcting my own prior audits here.

### Correction B: the "everything defaults to Opus" premise is false

Per-agent models are already tiered. `LEAN_RUNTIME_OVERRIDES` (`lib/agents/skill-loader.ts:71-81`) puts **e1, e2, e3, e4, e5, e6, e7 and s1 on Sonnet 4.6** already (`SONNET = "claude-sonnet-4-6"`, `:21`; s1 reverted to Sonnet 2026-05-15, `:78-81`). Only **A2 and A3 are Opus 4.7** (their skill frontmatter, `a2_classification.md:7`, `a3_so_what.md:7`; A2's stay-on-Opus is noted at `:82`). So a re-fire today already runs the bulk on Sonnet, not Opus.

### The real numbers (current pricing, recorded tokens 258,002 input / 117,485 output for e1-e7+s1; A2/A3 estimated since they are not in the logs)

| scenario | composition | cost |
|---|---|---|
| **0. Actual current assignment** (what a re-fire incurs today) | e1-e7+s1 Sonnet ($3/$15) = ~$2.54; A2+A3 Opus 4.7 ($5/$25) ~$1.4 | **~$4.0** |
| **1. Opus-everywhere baseline at $5/$25** (all agents Opus 4.8) | e1-e7+s1 ~$4.23; A2 ~$0.43; A3 ~$1.00 | **~$5.7** |
| **2. Optimized tiered** (recommended below) | e1-e7 Sonnet ~$1.72; s1 Sonnet ~$0.82 (or Opus 4.8 ~$1.37); A3 Opus 4.8 ~$1.00; A2 Haiku 4.5 ~$0.09 | **~$3.6 to $4.2** |
| **3. Saving** | tiered vs Opus-everywhere | **~$1.5 to $2 (~30%)** |

The headline is not the tiering saving; it is that the re-fire is roughly **$4, not $18-20**. The 5x gap is the pricing correction plus the already-Sonnet assignment. The A2/A3 figures are estimates the re-fire would measure exactly; even doubling them does not move the conclusion.

### Recommended per-agent assignment (quality-safe)

- **Opus 4.8:** A3 (so-what / advisor-action, the product's headline judgment) move 4.7 to 4.8, which is **free** (same $5/$25) and strictly better, so there is no reason to re-fire A3 on 4.7. Consider s1 (the diagnostic synthesis): it is the load-bearing synthesis and is currently Sonnet; the kickoff's intent is Opus for synthesis. Upgrading s1 to Opus 4.8 costs about $0.55 more and is the one quality lever worth weighing (WA28, the primary's call); if s1 reads strong on Sonnet at re-validation, leave it.
- **Sonnet 4.6:** e1-e7 (evidence reasoning), already there, appropriate. Keep.
- **Haiku 4.5:** A2. Its Layer 1 verdicts are deterministic; Layer 2 only glosses them into reason text, a mechanical narration of pre-assigned verdicts (`a2-classification.ts:645,799`). This is the clean downgrade: Opus 4.7 to Haiku 4.5 cuts its output cost about 80% for a non-judgment task. The only WA28 caveat: confirm the gloss phrasing holds at Haiku (a believability product), but the underlying verdict is fixed, so the risk is low.

**Quality-safe posture:** this is a one-shot believability re-fire on a roughly $4 pass, so the tiering saving (~$0.35 from A2 to Haiku) is small. Do not chase it at any quality risk. The two clear, safe moves are A3 to Opus 4.8 (free, better) and A2 to Haiku (mechanical). The s1 upgrade is a quality call, not a cost one. Everything else is already right-sized.

### The tokenizer caveat (honesty)
Opus 4.7-and-later use a new tokenizer that can use up to 35% more tokens for the same text; Sonnet 4.6 and Haiku 4.5 use the prior tokenizer. So the recorded e1-e7+s1 counts (Sonnet) are prior-tokenizer and a Sonnet re-fire matches them; A2/A3 on Opus carry new-tokenizer counts. Moving A2 to Haiku shifts it to the prior tokenizer, so its real count drops somewhat below the naive estimate; upgrading s1 to Opus 4.8 raises its input count by up to ~35% above the recorded Sonnet count. These are second-order against the price moves; the estimate is honest about the count shift but the price drop dominates.

### The WA12 number
The re-fire gate should be authorized against roughly **$4 (current assignment) or ~$3.6 (optimized: A2 to Haiku, A3 to 4.8, s1 left on Sonnet)**, not the prior ~$18-20. If s1 is upgraded to Opus 4.8 for quality, ~$4.2.

---

This audit scopes and corrects; it builds nothing, changes no data, and authorizes no spend. The build stays parked at the Phase 2 stop; the staged tooling stays uncommitted; T-5.15 stays a runtime scrape (D11 live) and out of scope here.
