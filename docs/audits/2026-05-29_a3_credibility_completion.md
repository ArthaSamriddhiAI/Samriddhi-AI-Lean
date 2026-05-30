# A3 credibility-completion audit: tolerance bands, investable universe, operational data

**Date:** 2026-05-29
**Task:** T-5.12 (A3 So-What), credibility-completion phase. Findings 4 (redeployment leftover), 1 (investable universe), 2 (PMS/AIF operational data + governance).
**Branch:** `features/a3-so-what`, PR #11 (draft). Re-backfill committed at `96d9c8f`.
**Status:** Read-only audit (WA22). No code, no API, no merge. Reports what the codebase and snapshot actually carry; does not design the recommendation policy.

## Step 0: audit-coverage triage

| Question | Coverage | Action |
|---|---|---|
| Q1 tolerance bands + redeployment leftover | **Partially** by `docs/audits/2026-05-28_t512_a3_so_what.md` (section 1.2 quoted `MODEL_BANDS` and the `assetClass` shape, the band structure) | Audit the delta: the leftover-vs-upper-band behavior, not previously analyzed |
| Q2 investable instrument universe | **Not previously audited.** `docs/audits/2026-05-28_qualitative_data_snapshot.md` censused HELD-holding data, not the universe of what is available to buy | Investigate from scratch |
| Q3 PMS/AIF operational + M0.IndianContext + G2 | **Partially** by `docs/audits/2026-05-21_s1_case_batch.md` and `docs/BUILD_ROADMAP.md` (M0.IndianContext + G2 in the S1 context) and `2026-05-28_qualitative_data_snapshot.md` (E6 PMS/AIF qualitative verdicts) | Audit the delta: per-holding operational metadata census + A3-reachability classification |

## Q1 (Finding 4): tolerance bands and the redeployment leftover-to-cash

**The band structure exists, with an upper band above target.** `MODEL_BANDS` (portfolio-risk-analytics.ts:26):

```ts
export const MODEL_BANDS: Record<AssetClass, { target: number; min: number; max: number }> = {
  Equity: { target: 65, min: 60, max: 70 },
  Debt: { target: 25, min: 20, max: 30 },
  Alternatives: { target: 7, min: 5, max: 10 },
  Cash: { target: 3, min: 2, max: 5 },
};
```

`min` is the lower band, `target` the model weight, `max` the upper band. It is exposed on the metrics A3 receives as `assetClass[cls].band = [min, max]` (portfolio-risk-analytics.ts:108, populated at :425), alongside `actualPct`, `targetPct`, `deviationPct`, `inBand`.

**`computeRedeployment` deploys to TARGET, not the upper band.** a3-so-what.ts:506, inside the under-allocated-sleeve computation:

```ts
return { sleeve: c, current: a.actualPct, target: a.targetPct, gap: Math.max(0, a.targetPct - a.actualPct) };
```

The `gap` is `targetPct - actualPct`. Capital is distributed across these gaps until each sleeve reaches its `target`, then the remainder is reported as `leftover_to_cash_pct`. The upper band (`max`) is never consulted.

**The Bhatt crux: stopped-at-target, not no-capacity.** Bhatt's `assetClass` (from the committed fixture):

| Sleeve | actual | target | band [min, max] |
|---|---|---|---|
| Equity | 72.2 | 65 | [60, 70] |
| Debt | 14.2 | 25 | [20, 30] |
| Alternatives | 13.6 | 7 | [5, 10] |
| Cash | 0 | 3 | [2, 5] |

Equity (72.2) and Alternatives (13.6) are above their upper bands, so they have no deployment headroom. Debt is under: gap-to-target is 25 - 14.2 = 10.8, which is what the redeployment used; the freed 17.9 points exceeded 10.8, so 7.1 went to cash. But Debt's upper band is 30, so headroom-to-upper-band is 30 - 14.2 = 15.8. Deploying to the upper band would absorb 15.8 points (5 more than the 10.8 to target), reducing leftover-to-cash from 7.1 to 2.1.

So Bhatt's 7.1 leftover is **mostly "redeployment stopped at target while Debt's upper-band capacity remained" (5 recoverable points), with a small genuine residual (2.1) that no sleeve can absorb even at the upper band.** It is not a genuine no-capacity situation.

**On flagging a model-band review:** there is no surface in the codebase that flags or recommends a model-band review. The leftover is passively parked in cash with an honest note (`computeRedeployment` sets `note` to "Freed X points exceeds the Y points of under-allocation capacity; sleeves are filled to target and the remaining Z points are reported as leftover to cash", a3-so-what.ts). No mechanism distinguishes "recoverable at the upper band" from "genuinely uninvestable."

## Q2 (Finding 1): the investable instrument universe in the snapshot

**The snapshot carries per-sleeve catalogs, not a single universe table.** Top-level keys of `fixtures/snapshots/enriched/snapshot_t0_q2_2026.json`: `_meta, mf_funds, aif, pms, nifty500, unlisted_equity, industry_reports, macro, snapshot_metadata, indices, fx`.

The investable-universe catalogs and their per-instrument metadata:

- **`mf_funds`: 1773 mutual funds**, each with `amfi_code`, `fund_name`, `sebi_category` (the sleeve/category, e.g. "Large & Mid Cap Fund"), `TER (%)` (expense ratio), `AUM (Cr)`, `Sharpe`, `Sortino`, `Volatility`, `VaR (H/I)`, `Beta`, multi-period returns (MTD..15Y plus calendar years), holdings/sector/cap-split composition, `P/E`, `P/B`, `Benchmark Index`, `Exit Load (JSON)`, `Top 5 Holdings (JSON)`, `tier_b_stats`. This is the richest catalog and supports category-filtered deploy selection (e.g., debt funds via `sebi_category`).
- **`pms.funds`: 513 PMS strategies**, each with `identity` (category, strategy_type, benchmark, inception), `scale` (aum_cr), `fee_structure`, `portfolio_composition`, `data_quality`.
- **`aif` (`Fund Profiles`): 162 AIF funds**, with `SEBI Category`, `Structure`, `Fund Tenure`, `Min Commitment (Cr)`, `Exit / Redemption Terms`, fees; plus a `Category Summary` aggregating CAT I/II/III.
- **`nifty500.companies`**: the listed-equity universe, with an `e1_financial_risk_agent_snapshot`.
- `unlisted_equity`: present (out of scope for liquid deployment).

**Coverage is uneven across sleeves.** Mutual funds are richest (1773, full stats plus TER plus `sebi_category`), then listed equity (Nifty 500), then PMS (513) and AIF (162). There is no standalone "gold" or "physical alternatives" deploy catalog (gold is a commodity; a gold MF would appear in `mf_funds` under its `sebi_category`, and broader alternatives are the AIF catalog). So debt and equity have a rich MF universe to deploy into; alternatives route through AIF; a pure gold top-up has no fund catalog.

**Held holdings are a subset of the universe.** The held funds resolve into `mf_funds`: "Mirae Asset Large Cap Fund", "Axis Large Cap Fund", and "Franklin India Corporate Debt Fund" all match rows in the 1773-fund catalog. risk-reward-stats already reads tier_b through from `mf_funds` for held funds, so the precedent for the held-to-universe join exists. This means "top up an existing holding" (a held fund, already in `mf_funds`) versus "add a new instrument" (any `mf_funds` row not currently held) is feasible from the data.

## Q3 (Finding 2): PMS/AIF operational data, M0.IndianContext, G2

**Per-holding operational metadata is present in the snapshot.**
- **PMS** (`pms.funds[].fee_structure`): `effective_lock_in_years` (lock-in), `exit_load` (by year, e.g. `{year_1_pct: 3.0, year_2_pct: 0.0}`), plus `fee_model`, `variable_amc_pct`, `hurdle_rate_pct`. Category and strategy in `identity`. There is no explicit per-investor minimum-ticket field on the PMS row (the SEBI Rs 50 lakh minimum lives in G2 / sebi_boundaries) and no explicit redemption-window field (lock-in plus exit-load is the proxy).
- **AIF** (`aif["Fund Profiles"][]`, 162 funds): `SEBI Category` (CAT I/II/III, summarized in `Category Summary`), `Fund Tenure`, `Tenure Extendable`, `Min Commitment (Cr)`, `Initial Drawdown`, `Exit / Redemption Terms`, `Exit Type (Classified)`, plus fee fields. This is rich and covers lock-in (tenure), minimums, and redemption terms.
- **MF** (`mf_funds[].Exit Load (JSON)`): exit-load schedule per scheme.

**M0.IndianContext is present, deterministic, and wired to S1 only.** `lib/agents/m0-indian-context.ts` is a rule-based (no-LLM) agent retrieving six curated YAML stores under `agents/m0_indian_context/data/`: `tax_matrix`, `sebi_boundaries`, `structure_matrix`, `demat_mechanics`, `gift_city_routing`, `regulatory_changelog` (m0-indian-context.ts:34). It exposes `buildIndianContext()` (m0-indian-context.ts:409, the bulk bundle consumed by S1.case_mode and the IC1 sub-agents) and `getSebiTicketRule()` (m0-indian-context.ts:376, the inline lookup G2 uses). It is invoked in the S1 proposal pipeline (`pipeline-case.ts:131`) and is **absent from the S2 diagnostic pipeline** (`grep` of pipeline.ts returns nothing). `tax_matrix` carries the category-specific tax treatment (including the Cat III AIF fund-level question), so that data exists but is not reachable from A3 today.

**G2 is present, deterministic, proposal-shaped, and wired to S1 only.** `lib/agents/case/governance/g2-sebi.ts` evaluates SEBI minimum-ticket rules for a proposal's target category: PMS Rs 50 lakh (sebi_001), AIF Cat I/II/III Rs 1 crore (sebi_009); MF has no SEBI per-investor minimum (g2-sebi.ts:10-14). `runG2` takes a `Proposal` (g2-sebi.ts:30), so the gate wrapper is S1-shaped; the reusable piece for a diagnostic context is the underlying `getSebiTicketRule(targetCategory)`, a plain function call. G2 is wired into S1 (`pipeline-case.ts:254`) and is absent from S2. Per product debt P25, SEBI MF scheme-level rules are not in the store (G2 returns requires_clarification for MF targets).

**A3 cannot reach any of it today.** `A3Input` (a3-so-what.ts:209) is `{ caseId, asOfDate, a2Output, metrics, preObservations, riskReward, overlap, evidence }`. It does not include the raw snapshot, M0.IndianContext, or G2. A3's only window onto PMS/AIF operational reality is E6's `liquidity_terms` prose (a synthesized string), not the structured fields.

**Classification:**

| Data | Status |
|---|---|
| PMS lock-in / exit-load (snapshot `pms.funds.fee_structure`) | Present in snapshot; **not wired to A3** (A3 gets E6 prose) |
| AIF category / tenure / min commitment / redemption terms (snapshot `aif`) | Present and rich; **not wired to A3** |
| MF exit load (snapshot `mf_funds`) | Present; **not wired to A3** |
| PMS explicit minimum-ticket / redemption window | **Thin**: minimum lives in sebi_boundaries (via G2), not on the PMS row; explicit redemption window absent (lock-in plus exit-load is the proxy) |
| Tax treatment incl. Cat III AIF (M0.IndianContext `tax_matrix`) | Present; **wired to S1 only, not A3** |
| SEBI minimum-ticket lookup (`getSebiTicketRule`) | Present and directly callable; **not wired to A3** |
| G2 gate (proposal-shaped) | Present; **not wired to A3, and proposal-shaped** (the reusable piece is getSebiTicketRule) |
| SEBI MF scheme-level rules | **Absent** (product debt P25) |

So Finding 2 is **code-task-dominant**: the operational data, the tax/SEBI YAML, and `getSebiTicketRule` all exist and need wiring into A3 (and, for the structured PMS/AIF fields, either passing the snapshot or having E6 surface them structurally). The only genuine data gaps are PMS explicit minimum/redemption-window (thin) and MF SEBI scheme rules (absent, P25).

## Blast-radius read (for sequencing)

- **Finding 4 (tolerance-band redeployment): SMALL.** The data needed (the upper band) is already on `metrics.assetClass[cls].band[1]`, which A3 receives. The change is localized to one expression in `computeRedeployment` (deploy against the upper band, or deploy-to-target-then-flag a model-band review), plus possibly a small marker distinguishing "deployed to band" from "deployed to target." Deterministic, free to re-verify; only a re-backfill would re-spend. Self-contained within A3.

- **Finding 1 (investable universe / instrument-level deploy): MEDIUM to LARGE.** The universe data is rich and present, but A3 does not currently receive the snapshot, so the input contract expands again (add the universe, or a pre-filtered per-sleeve candidate set). On top of that sits a genuine new capability: selecting deploy candidates per sleeve (top-up-held versus add-new, filtered by `sebi_category`, weighing TER and quality), a recommendation policy, schema for per-sleeve deploy recommendations, and handling for uneven coverage (no gold catalog). This is a new sub-capability with its own design, not a one-liner; the recommendation policy itself is the post-audit design call.

- **Finding 2 (operational constraints / M0.IndianContext / G2): MEDIUM.** Code-task-dominant but multi-part: wire the snapshot PMS/AIF operational fields to A3 (or have E6 surface them structurally), wire M0.IndianContext / `getSebiTicketRule` into the S2 path, and reflect the constraints in the exit/trim recommendation (e.g., an exit qualified by a remaining lock-in, a partial-exit minimum-residual check, Cat III tax framing). The data mostly exists, so this is wiring plus recommendation-shaping rather than data creation, with two small data gaps to log (PMS minimum/redemption-window thin; MF SEBI scheme rules absent, P25).

This audit reports availability only; it does not design the redeployment policy, the deploy-candidate selection, or how A3 should reflect operational constraints. Those are the post-audit design calls once the primary sequences the builds.
