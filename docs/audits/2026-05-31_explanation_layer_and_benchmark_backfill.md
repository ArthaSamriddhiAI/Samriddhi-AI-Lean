# Explanation-layer ownership and benchmark-fields-only back-fill: pre-build audit

**Date:** 2026-05-31
**Provisional task id:** T-5.14 (same workstream; resolve the live id at landing, WA24).
**Branch:** `features/client-weighted-benchmark` (continued; not re-cut).
**Mode:** Audit-only. Read-only grounding plus this one deliverable. No agent logic, no snapshot edits, no fixtures, no debt or ADR codification (write gate at the end).
**Follows:** `docs/audits/2026-05-31_client_weighted_benchmark.md` (`e1f521b`) and `docs/audits/2026-05-31_jensens_alpha_and_beta_levering.md` (`f5da162`). The mechanism, equity granularity, Jensen's alpha, R_f, and beta-levering calls are locked per the kickoff.

**First-move call (WA22): new dated file.** The convention is settled from the prior two audits: `docs/audits/` is one focused file per audit, no addendum-append precedent. This lands as a new file on `features/client-weighted-benchmark`.

---

## Question 1: explanation-layer ownership

### 1.1 What explanatory prose exists today, and where

**The risk-reward stats agent already emits prose, and it already narrates beta.** Its output is not numbers-only. `RiskRewardOutput` (`lib/agents/risk-reward-stats.ts:104-116`) carries two prose fields: `rollup` (a `RiskRewardRollup`, `:85-91`, with `text`, `generation_method`, `llm_fallback_trigger`, `is_synthetic_forward`, `synthetic_forward_disclosure`) and `reasoning_summary` (a fixed string, `:638-641`). The templated rollup writes the beta sentence today (`templatedRollup`, `lib/agents/risk-reward-stats.ts:582-585`):

```
582    parts.push(
583      `Portfolio 3Y Sharpe ${fmtNum(p.stats.sharpe_3y)} at ${fmtPct(p.stats.vol_3y_annualized)} annualised volatility` +
584        (p.stats.beta_3y != null ? `, beta ${fmtNum(p.stats.beta_3y)} versus Nifty 500 TRI (R-squared ${fmtNum(p.stats.r_squared_3y)})` : "") +
585        `; max drawdown ${fmtPct(p.stats.max_drawdown_3y)}.`,
```

The voice is strictly descriptive: the LLM-fallback prompt orders "Describe, do not recommend. No should, consider, trim, advise" and "No good or bad verdicts on a Sharpe value; state the number and its benchmark or sentinel context" (`lib/agents/risk-reward-stats.ts:707-710`). So the agent owns a register-correct, recommendation-free narration of its own statistics, and beta is already in it (today hardcoded as "versus Nifty 500 TRI").

**The time-series-performance path has its own rollup**, narrating portfolio return and cross-snapshot evolution (`lib/agents/time-series-performance.ts:585-590`); it does not narrate alpha at portfolio level, because there is no portfolio-level alpha there (the prior audit established that the simple alpha is per-holding read-through, `lib/agents/time-series-performance.ts:48-52, 242`).

**Both rollups are data, not yet rendered (WA9).** The S2 pipeline stores risk-reward as "data only (content.risk_reward_stats; the S2 renderer never reads it, WA9)" (`lib/agents/pipeline.ts:139-140`, with the store at `:405`). So the prose exists in the data layer and the render layer is genuinely downstream (T-5.09).

### 1.2 Does A3 own this? Grounded: no

**A3 consumes risk-reward, but only at the per-holding level, so the portfolio beta and Jensen's alpha are not in its input.** `lib/agents/a3-so-what.ts:35` imports `RiskRewardOutput`; `A3Input.riskReward` (`:256`) is read exclusively through `findHoldingStats`, which touches only `riskReward.per_holding` (`:336-339`):

```
336  function findHoldingStats(riskReward: RiskRewardOutput | null, ref: string): HoldingStats | null {
337    if (!riskReward) return null;
339    return riskReward.per_holding.find((s) => normalise(s.holding_ref) === key) ?? null;
```

Audited: there is no read of `riskReward.portfolio` or `riskReward.per_sleeve` anywhere in `lib/agents/a3-so-what.ts`. A3 uses per-holding Sharpe and the like for its exit-judgment performance dimension; the portfolio-level and sleeve-level beta (where the believability story lives) never reach it. And A3's voice is advisor-action (exit, maintain, redeploy per holding), not metric-explanation. So A3 cannot narrate the corrected portfolio beta without a new input wire, and should not, because doing so would re-aim its voice. **A3 is not the owner.** The owner is the agent that already owns and already narrates these statistics: risk-reward.

### 1.3 Proposed owners (these do not all share one, as the kickoff anticipated)

| Narration | Proposed owner | Capability or render |
|---|---|---|
| (a) Corrected composition-matched beta, and the "beta near 1 is structural" sentence | the risk-reward agent's `rollup` (extend `templatedRollup`, `lib/agents/risk-reward-stats.ts:571-594`, where beta is already narrated) | Capability (agent-generated prose) |
| (b) Jensen's alpha | the same risk-reward `rollup`, alongside beta, since both come from the same regression in `aggregate()` / `benchRelative` | Capability |
| (c) Coverage-footnote | the footnote text as an agent-emitted field (computed from the existing `evaluable_weight_pct` / `sentinelled_weight_pct`, `lib/agents/risk-reward-stats.ts:419-420`); the caption layout under the number | Text is capability; caption layout is render (T-5.09) |

The sleeve-level signal already has a home too: `templatedRollup` carries a lead-sleeve sentence (`lib/agents/risk-reward-stats.ts:587-592`), which extends naturally to narrate the equity-sleeve and debt-sleeve betas against their composition-matched sleeve benchmarks. That is where "the signal is at sleeve level" gets said with numbers.

### 1.4 The counterintuitive-beta sentence: where it must live, and how

The load-bearing sentence ("portfolio beta near 1 is structural by design because the benchmark is composition-matched; the risk-reward signal is at the sleeve and holding level, and in the residual distance from 1") belongs in the risk-reward `rollup`, and it should be appended **deterministically on both rollup paths**, not left to the LLM. The codebase already has the exact pattern for a must-always-appear disclosure: the synthetic-forward disclosure is appended deterministically after both the templated and the LLM paths, and the model is explicitly instructed not to add it and is "not trusted to" (`lib/agents/risk-reward-stats.ts:626-627, 716-717, 768`). The structural-beta explanation is the same class of guarantee (it must appear whenever a composition-matched portfolio beta is reported), so it should ride the same deterministic-append seam rather than the LLM prose. This keeps it present on every case and keeps the back-fill diff reproducible (Section 2.4). This is capability.

One honesty hook to carry in that sentence: on the seed fixtures the near-1 pull is doubly reinforced because the NAVs were regenerated for co-movement (product debt P15 / ADR-0014), which the prior audit flagged. The disclosure should not oversell the residual-from-1 as pure selection signal on synthetic data.

### 1.5 WA9 split, so the build kickoff scopes only the capability half

- **Capability (in scope for this build):** everything the risk-reward agent generates into `content.risk_reward_stats`. The corrected beta narration, the Jensen's alpha narration, the deterministic structural-beta sentence, the sleeve-beta narration, and the coverage-footnote text field. All of it is prose and fields the agent emits; none of it is layout.
- **Render (out of scope, T-5.09):** the S2 renderer reading `content.risk_reward_stats` at all (today it does not, `lib/agents/pipeline.ts:139-140`), and the visual layout and caption of the beta, the Jensen's alpha, the coverage footnote, and the sleeve breakdown. That wiring and layout is design's half.

The clean line: the build produces the numbers and the sentences that explain them as data; T-5.09 decides how they sit on the page.

---

## Question 2: back-fill mechanics, benchmark fields only

### 2.1 The five S2 fixtures and where the new fields attach

**Audited: there are exactly five active S2 cases**, all `workflow: "s2"` with an existing `content.risk_reward_stats`:

| Fixture | investor | snapshot | current portfolio beta (vs static `nifty_500_tri`) | evaluable % |
|---|---|---|---|---|
| `db/fixtures/cases/c-2026-05-14-bhatt-01.json` | bhatt | t0_q2_2026 | 1.058 | 40% |
| `db/fixtures/cases/c-2026-05-15-iyengar-01.json` | iyengar | t0_q2_2026 | 0.8111 | 22% |
| `db/fixtures/cases/c-2026-05-15-malhotra-01.json` | malhotra | t0_q2_2026 | 1.3995 | 41.6% |
| `db/fixtures/cases/c-2026-05-15-menon-01.json` | menon | t0_q2_2026 | null | 0% |
| `db/fixtures/cases/c-2026-05-15-surana-01.json` | surana | t0_q2_2026 | 1.3592 | 63.8% |

The `c-2026-05-21-*` set is `workflow: "s1"` (Samriddhi 1 case-mode) and the Sharma S2 case is archived at `db/fixtures/cases/_archived/c-2026-05-15-sharma-s2-01.json`; none are touched by an S2 back-fill (the script is S2-only, `scripts/backfill-risk-reward.ts:61`, and reads the cases directory non-recursively, `:133`, so `_archived/` is excluded). The "six of six" in the script header (`scripts/backfill-risk-reward.ts:13`) predates the Sharma-S2 archival; the live count is five.

**Fixture structure (audited from `c-2026-05-15-iyengar-01.json`):** the top level is `{ id, investorId, snapshotId, workflow, content, contextNote, headline, severity, status, frozenAt, tokenUsage, errorMessage }`. `content` has eight sibling keys: `a2_classification`, `a3_so_what`, `briefing`, `evidence`, `metrics`, `risk_reward_stats`, `router_decision`, `usage_summary`. **All new benchmark fields attach inside `content.risk_reward_stats`**, whose keys are `agent_id, as_of_date, case_id, per_holding, per_sleeve, portfolio, pms_aif_framework_notice, reasoning_summary, risk_free_rate, rollup, snapshot_context`. Specifically:

- the **composition-matched beta** replaces the value at `content.risk_reward_stats.portfolio.stats.beta_3y` and each `per_sleeve[].stats.beta_3y`;
- the **Jensen's alpha** is a new key in those same `stats` objects (portfolio and sleeve);
- the **blended benchmark series** descriptor replaces the single `benchmark_index_id: "nifty_500_tri"` on `portfolio` (and the sleeve entries) with the blend (its weighted constituents, and whatever series form the build settles);
- the **coverage footnote** attaches on `portfolio` (the `evaluable_weight_pct` 22 / `sentinelled_weight_pct` 78.1 already there, plus the footnote text field).

### 2.2 The injection path, and that it runs the real agent (WA16)

**The injection path is `scripts/backfill-risk-reward.ts`, re-run after the agent is updated.** It is exactly the mechanism the T-5.11 sweep would have used. It loads each fixture, pulls the investor's structured holdings (`HOLDINGS_BY_INVESTOR[fixture.investorId]`, `:65`) and the case snapshot (`loadSnapshot(fixture.snapshotId)`, `:70`), runs the **real risk-reward agent** (`runRiskRewardStats(input)` on the write path, `runRiskRewardDeterministic` on dry-run, `:75-77`), and writes the result to `content.risk_reward_stats` (`:92`). It never hand-authors values, so WA16's real-reasoning-over-stubs binds the method even though the primary is pulling the timing forward from T-5.11. The write is the proven additive form `JSON.stringify(fixture, null, 2) + "\n"` (`:93`), which "does NOT regenerate the case; the frozen briefing / evidence / metrics stay byte-identical" (`:1-8`), the D7 discipline.

### 2.3 Per-case validation expectations

Grounded from the holdings (`db/fixtures/structured-holdings.ts`) and the prior audit's evaluability finding:

- **Iyengar: equity plus debt blend.** The clearest equity-plus-debt case. Its Debt sleeve is evaluable today (the Franklin India Corporate Debt Fund, 10.3%, currently `beta -0.0217` vs `crisil_composite_bond`) alongside an evaluable equity holding (11.7%). Portfolio evaluable is 22% (78.1% sentinelled: the two bank FDs and the rest). The current portfolio `beta 0.8111` vs the 500 is half near-zero debt and half high-beta equity blended against a pure-equity index; after composition-matching it should move toward 1 against the equity-plus-debt blend, with the believable signal being the equity sleeve's `beta 1.5042` and the debt sleeve's near-zero beta.
- **Bhatt: equity plus debt blend.** The HDFC Arbitrage Fund (7.2%, Debt-classed, benchmark `crisil_liquid`, cash-adjacent) is the evaluable debt; the rest of the debt is a bank FD (sentinelled). Equity is PMS-heavy and largely sentinelled, so evaluable is 40%.
- **Malhotra: equity-only blend plus footnote.** Debt is entirely tax-free bonds and a bank FD (sentinelled); the blend is equity-only and the debt weight is footnoted. Current beta 1.3995, evaluable 41.6%.
- **Surana: equity-only blend plus footnote.** No Debt-class holding at all; the international ETF (`intl_us_etf`) is sentinelled and footnoted. Current beta 1.3592, evaluable 63.8% (the highest, so the blend moves its beta most visibly).
- **Menon: footnote only, no blend.** Evaluable 0% (86.6% savings, a bank FD, and a sentinelled international legacy holding), so there is no portfolio series and no beta; the case validates the coverage footnote and the all-sentinelled path, not a blend.

So two cases exercise the equity-plus-debt path (Iyengar, Bhatt), two exercise equity-only-plus-footnote (Malhotra, Surana), and one exercises the all-sentinelled footnote-only path (Menon).

### 2.4 The field-only diff is achievable, and it is clean

Yes. The back-fill writes only `content.risk_reward_stats`; the other seven `content` siblings (including `a3_so_what`, `briefing`, `evidence`, `metrics`) are not touched. Two points make the diff genuinely field-scoped rather than merely file-scoped:

1. **Per-holding stays byte-identical, so `a3_so_what` stays valid.** The build changes only the sleeve-level and portfolio-level benchmark (the `aggregate()` seam); per-holding stats are read-through from the snapshot's `tier_b_stats` against each instrument's own benchmark and are unchanged. A3 reads only `per_holding` (Section 1.2), so the frozen `content.a3_so_what` remains consistent with the new `risk_reward_stats` and does not need re-backfilling. This is the structural reason the override can be benchmark-fields-only without a cascade.
2. **The one churn risk is the rollup, and it is controllable.** Re-running the write path fires the LLM fallback for triggered cases (`scripts/backfill-risk-reward.ts:75-77`), which would regenerate `rollup.text` non-deterministically and widen the within-`risk_reward_stats` diff beyond the numeric fields. To keep the diff tight and the validation reproducible, drive the back-fill so the rollup is deterministic (the templated path), which also aligns with the Question 1 recommendation to append the structural-beta sentence deterministically rather than via the LLM. With that, the diff inside `risk_reward_stats` is the new and changed numeric fields plus a deterministic rollup, and nothing else in the fixture moves.

Net: the build's fixture diff moves `content.risk_reward_stats` only, across the five S2 cases, with no unrelated fixture data touched. This satisfies the primary's tight-scope intent and does not widen into T-5.11's territory.

---

## Registry and write gate

**Registry (WA21, not written here):** next free D-series id D13, next free ADR 0041; the task id resolves at landing (WA24). This audit creates none.

**Write gate (WA1 / WA19):** this session wrote exactly one thing, this audit file, committed to `features/client-weighted-benchmark`. It did not write agent logic, modify the snapshot or fixtures, run the back-fill, or codify any ADR or debt entry. The decisions that are the primary's, surfaced as stop-and-propose (WA28): confirm the explanation-layer owner split (risk-reward `rollup` for the beta, Jensen's, structural sentence, and sleeve narration as capability; render deferred to T-5.09); confirm the benchmark-fields-only back-fill runs `scripts/backfill-risk-reward.ts` on the five S2 cases on the deterministic rollup path. Each, and the build itself, needs its own explicit single-purpose go-ahead before the next motion.
