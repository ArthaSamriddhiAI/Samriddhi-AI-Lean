# T-5.06 Time-series Performance — Ping 1 structural recon report

> Read-only recon, re-fired from a clean base after the repo-split remediation (local `main` hard-reset onto `origin/main` @ `43ac82d`, PR #7). No capability code, no `features/time-series-performance` branch, no snapshot edits, no `~/.claude/` memory writes. **Zero Anthropic API calls (WA12).** Naming per WA13 ("Samriddhi 2", not "S2").

Package 5 (Samriddhi 2 Enrichment). T-5.06 is the time-series-performance capability, data layer only, sibling to risk-reward-stats (T-5.03, shipped) and to the deterministic metrics feeder. Planning chat has locked: **Window Option B** (compute standard windows 1M/3M/6M/1Y/3Y/SI fresh from `monthly_nav`/`monthly_prices` at agent time; consume existing `rolling_metrics` for cross-snapshot evolution), and **cross-snapshot evolution in scope** (two-snapshot-aware).

---

### Section 0: Repo hygiene

**Status:** CLEAN

**Findings:**
- **Remediation landed.** Local `main` is now identical to `origin/main` (`43ac82d`, "Samriddhi 1 case batch + pipeline scope-builder enrichment (#7)"). The earlier no-common-ancestor divergence (76 vs 78 disjoint commits, history rewritten by the split) is resolved by the hard reset. Pre-split history is preserved in the local-only `backup-pre-split-main` (never pushed).
- **Working tree clean** in both repos; `main` tracks `origin/main` with no ahead/behind.
- **Contamination resolved.** The 9 enriched snapshot JSONs that the pre-split tree carried at `fixtures/snapshots/enriched/` are gone from the code repo (the directory no longer exists). Per ADR-0027 they now live only in the private data repo and are fetched on setup. `find` for `snapshot_t*.json` in the code repo returns 0.
- **Data repo CLEAN.** `Samriddhi-AI-Data-Snapshots` is in sync with its origin, zero untracked, zero TS/Py contamination. It holds `snapshots/` (9 files t0–t8), `manifest.json`, `sector_map.json`, `docs/`, `README.md`.
- ADRs 0022–0027 and the stale-relevant source files (`snapshot-loader.ts`, `case/scope-builders.ts`, `pipeline-case.ts`) are now present/current locally (verified empty diff vs origin during remediation).

**Open questions for planning chat:**
- None. Foundation is trustworthy; Sections 1–4 ran against the real post-PR-#7 tree.

---

### Section 1: T-5.03 sibling recon

**Status:** CLEAN

#### File-by-file

**1. `agents/risk_reward_stats.md`** (skill; the path is `.md`, not `.skill.md`).
- *What it does:* System prompt + contract for the risk-reward agent. Declares two-layer operation (deterministic Layer 1 + templated/LLM-fallback Layer 2 rollup), inputs consumed, the 8-sentinel taxonomy, the three-way do-not-mix rule, edge-case (LLM-fallback) triggers, and discipline. Explicitly "descriptive, not a verdict layer; below the decision boundary."
- *Frontmatter:* `agent_id`, `skill_md_version`, `draft_version: provisional`, `authored_in_cluster`, `finalised_in_cluster`, `llm_model: claude-opus-4-7`, `max_tokens`, `temperature`, `output_schema_ref: schemas/risk_reward_stats_output.schema.json`, `source_files[]`.

**2. `lib/agents/risk-reward-stats.ts`** (implementation, ~790 lines).
- *What it does:* The full two-layer engine. Layer 1 (`computeRiskReward`) is pure/deterministic: per-holding stats are **read-through** from snapshot `tier_b_stats` (never recomputed); per-sleeve and per-portfolio stats are computed fresh on a **market-value-weighted synthesised return series** over evaluable constituents (never weighted-average-of-Sharpes). Layer 2 is a templated rollup with an enumerated LLM-fallback (the only API-calling path, WA12-gated).
- *Public interface (exports):*
  - `RISK_FREE_ANN = 0.0525` (const; repo rate, ADR-0012; not configurable).
  - Types: `RiskRewardSentinel` (8-member union), `TierBValues`, `SnapshotContext`, `HoldingStats`, `SleeveStats`, `RiskRewardRollup`, `PmsAifFrameworkNotice`, `RiskRewardOutput`, `RiskRewardInput`, `RiskRewardResult`. Const arrays `TIER_B_FIELDS` (13), `LLM_FALLBACK_TRIGGERS` (5).
  - `deriveSnapshotContext(snapshot: Snapshot): SnapshotContext` — derives `is_synthetic_forward` from `snapshot_metadata.evolution_type !== "baseline"`.
  - `computeRiskReward(input: RiskRewardInput): Omit<RiskRewardOutput, "rollup"|"reasoning_summary"|"pms_aif_framework_notice">` — Layer 1 orchestration.
  - `detectLlmFallbackTrigger(layer1): Trigger | null`.
  - `templatedRollup(layer1): string`.
  - `assertSyntheticForwardDisclosure(out): void` — **hard runtime guard**: throws if a t1..t8 output lacks the synthetic-forward disclosure.
  - `buildPmsAifFrameworkNotice(holdings): PmsAifFrameworkNotice`; const `PMS_AIF_FRAMEWORK_TEXT`.
  - `runRiskRewardDeterministic(input): RiskRewardOutput` — sync, no API; the pipeline path.
  - `runRiskRewardStats(input): Promise<RiskRewardResult>` — async, LLM-capable; backfill/future path.
  - `RiskRewardInput = { caseId, asOfDate, holdings: StructuredHoldings, snapshot: Snapshot, investor: { riskAppetite?, liquidityTier? } }`. Note: **takes one `snapshot`.**
- *Benchmark handling inside it:* a small local `SLEEVE_BENCHMARK` map (Equity→`nifty_500_tri`, Debt→`crisil_composite_bond`, Alternatives/Cash→null); per-holding benchmark is **read-through** from `tier_b_stats._meta.benchmark_index_id` / `_benchmark_resolution`; benchmark monthly series pulled from `snapshot.indices[benchId].monthly_values`.

**3. `lib/agents/pipeline.ts` → `runDiagnosticPipeline`** (Samriddhi 2 diagnostic orchestrator).
- *Signature:* `runDiagnosticPipeline(opts: { caseId, investorId, snapshotId }): Promise<void>`.
- *Ordering and what risk-reward consumes:* loads investor (Prisma) → loads **one** snapshot via `loadSnapshot(opts.snapshotId)` → `computeMetrics(holdings, snapshot, …)` (M0 feeder) → `route(holdings)` → **risk-reward fires here**: `routerDecision.riskRewardStats ? runRiskRewardDeterministic({ caseId, asOfDate, holdings, snapshot, investor }) : null` → builds scopes → evidence agents E1/E2/E3/E4/E6/E7 in parallel (`Promise.all`, router-gated) → token-budget check → `stitch(...)` → `runS1Diagnostic` → `runA2Diagnostic` → persists. Risk-reward runs **before/independent of** the evidence agents, on the deterministic path, and its output is stored at `content.risk_reward_stats`. The renderer never reads it (WA9).

**4. ADR-0021 (`docs/decisions/0021_sibling_agent_placement.md`).** Decision: risk-reward-stats is a **sibling** to `lib/agents/portfolio-risk-analytics.ts`, not an extension. Invoked deterministically in `runDiagnosticPipeline`, gated by a `riskRewardStats` flag on the router's `ApplicabilityVector` (parallel to `portfolioRiskAnalytics`; **not** in `activated`, which lists only the E-series LLM agents). Output persisted as a new `content.risk_reward_stats` key (mirrors the A2 precedent of bypassing the stitcher). Feeds **Dimension 4 (return quality)** of the interpretive skill `agents/m0_portfolio_risk_analytics.md` when that ships in cluster 7. **This is the exact placement template T-5.06 should follow.** References ADR-0012/0014/0015 (methodology), ADR-0017 (benchmark), ADR-0019 (sentinels/do-not-mix).

**5. `agents/m0_portfolio_risk_analytics.md` + `lib/agents/portfolio-risk-analytics.ts`** (the naming-collision pair, flagged in ADR-0021).
- `lib/agents/portfolio-risk-analytics.ts` = **"M0.PortfolioAnalytics"**, the deterministic feeder. Exports `computeMetrics(holdings, snapshot, investor): PortfolioMetrics` (pure, no LLM) plus foundation constants (`MODEL_BANDS`, concentration thresholds, `BUCKET_BY_SUBCATEGORY`, `HHI_CEILING_BY_TIER`). `PortfolioMetrics` carries assetClass bands, concentration (HHI/top-1/top-5/wrappers/sector look-through), liquidity buckets, cashDeployment, `computedAt`. **The single-object deterministic shape T-5.06 should mirror.**
- `agents/m0_portfolio_risk_analytics.md` = **"M0.PortfolioRiskAnalytics"**, the interpretive verdict skill (six dimensions; ships real impl cluster 7). Dimension 4 is where risk-reward (and plausibly time-series) feed.

#### Sentinel inventory (every sentinel risk-reward uses)

Defined in `lib/agents/risk-reward-stats.ts` (`RiskRewardSentinel` union + `classifyHolding`), codified in ADR-0019, restated in the skill. *(Doc-drift note: the code comment at risk-reward-stats.ts:39 calls this "ADR-0017 candidate"; the shipped sentinel ADR is **0019** — 0017 became benchmark-resolution. Harmless, worth a one-line fix later.)*

| Sentinel | Meaning |
|---|---|
| `opaque_wrapper` | AIF; no return data exists (opaque-by-design) |
| `pms_disclosure_limited` | PMS; no monthly NAV, rolling stats not computable |
| `not_applicable_for_risk_reward` | FD, tax-free bond, gold, REIT, savings; no return series |
| `insufficient_history` | `tier_b_stats.data_window_insufficient` is set |
| `benchmark_structurally_inapplicable` | fund design resists single-index comparison (self-stats valid, benchmark-relative null) |
| `benchmark_not_in_snapshot` | comparator exists but not in the canonical 16 (self-stats valid, benchmark-relative null) |
| `currency_conversion_pending` | foreign-currency holding, FX series absent (schema-ready; unused in current fixtures) |
| `no_constituents_evaluable` | sleeve where every constituent is sentinelled |

Time-series should inherit all eight where they apply. Likely **new** sentinels needed for the cross-snapshot axis (e.g. instrument present in one snapshot of the pair but not the other; snapshot pair non-comparable). Per the ping, coining new ones needs explicit justification.

#### Benchmark-resolution seam

- **There is no `benchmark-resolver.ts` module.** Resolution is **pre-computed at snapshot-onboarding time** and read through from the snapshot.
- *Policy:* **ADR-0017** defines the fund→canonical-16 cascade (source-string → tracked-index detector → category-clean → defensible-default → two-way sentinel partition), implemented in the **enrichment script `scripts/regenerate_fund_nav.py resolve()`** (data-side, not in code-repo `lib/`). Stocks resolve via the ADR-0012 stock map (banking→`nifty_bank_tri`, IT→`nifty_it_tri`, large→`nifty_50_tri`, mid→`nifty_midcap_150_tri`, small→`nifty_smallcap_250_tri`).
- *Where it lands:* per-instrument `tier_b_stats._meta.benchmark_index_id` + `tier_b_stats._benchmark_resolution` (`"resolved"` or one of the two sentinels). Benchmark monthly series live at `snapshot.indices[benchId].monthly_values`.
- **T-5.06 MUST share this seam:** read the benchmark id from `_meta.benchmark_index_id`, honour `_benchmark_resolution`, and pull the comparator series from `snapshot.indices[...]`. Do not reinvent a mapping. The sleeve-level default map (`SLEEVE_BENCHMARK`) is the only in-`lib` benchmark logic and can be reused verbatim.

#### Phase-B emphasis 1 — ADR-0027 in full (snapshot access + privacy boundary)

- *Decision:* real-world-sourced data (the 9 enriched snapshots + `sector_map.json`) lives in the **private** `ArthaSamriddhiAI/Samriddhi-AI-Data-Snapshots` repo and is delivered via **GitHub-releases-as-assets**: the private repo publishes versioned releases (initial `v1.0.0-frozen`) with a `manifest.json`; the public repo pins a version in `data-version.txt`; `scripts/setup-data.ts` runs `gh release download`, verifies SHA256 against the manifest, and places files at `fixtures/snapshots/enriched/` and `scripts/sector_map.json`; `.gitignore` excludes both paths.
- *Consequence for agents reaching into snapshot data:* **the loader path is unchanged** — `snapshot-loader.ts` still reads `fixtures/snapshots/enriched/snapshot_<id>.json` from local disk. T-5.06 needs no new access mechanism; it consumes the already-loaded `Snapshot` object exactly as risk-reward does. The only operational constraint is that a working tree must have run `setup-data.ts` (gh-authenticated) for the files to exist.
- *Constraint on a two-snapshot-aware agent:* loading a **second** snapshot is mechanically free (call `loadSnapshot` again with a second id; the LRU cache holds 3). No privacy/access constraint blocks reading two snapshots — both come from the same fetched suite. The open question is purely the in-process contract (Section 3), not data access.
- *Privacy principle for any new T-5.06 artifact:* real-world-sourced → private; invented/hand-authored → public. Any time-series fixture derived from snapshot values is product-output (public-eligible); raw snapshot extracts are not.

#### Phase-B emphasis 2 — what PR #7 changed in `scope-builders.ts` / `pipeline-case.ts`

- PR #7 (with ADR-0024 for E1/E2 and ADR-0026 for E6/E7) added **`lib/agents/case/scope-builders.ts`** — `buildE1Scope` / `buildE2Scope` / `buildE6Scope` / `buildE7Scope` — which read the enriched snapshot (nifty500 per-stock fundamentals; `mf_funds` top-5 holdings/sectors, fund-level P/E, P/B, Beta, `tier_b_stats`; `pms.funds[]`; `aif["E6 Agent Input Ready"][]`) and assemble **data-grounded, source-labelled** scope strings. Previously `pipeline-case.ts` passed each agent a one-sentence templated string.
- *Path from case-context to agent input (Samriddhi 1, post-#7):* `runProposedActionPipeline` (pipeline-case.ts) loads one snapshot, builds the `CaseAgentContext` (investor/mandate/proposal text — **no snapshot data**), then calls the scope-builders with `(snapshot, proposal, holdings)` and passes the returned strings into `runE1Case`/etc. So the snapshot reaches the agents **via the scope-builders as a function argument**, not via `case-context.ts`.
- *Relevance to T-5.06:* this is the established "deterministic builder reads the snapshot, hands a typed payload to the agent" pattern. A time-series agent would slot in the same way (a builder that reads `monthly_nav`/`monthly_prices`/`tier_b_stats`/`rolling_metrics` and assembles the agent's input). It does **not** change how snapshots are loaded — still single-snapshot per pipeline run.

**Open questions for planning chat:**
- T-5.06 placement should copy ADR-0021 (sibling module, own `timeSeriesPerformance` router flag parallel to `riskRewardStats`/`portfolioRiskAnalytics`, own `content.time_series_performance` key, feeds an interpretive dimension). Confirm the target dimension/skill (risk-reward feeds Dimension 4 "return quality"; time-series may feed the same dimension or a new one).
- New cross-snapshot sentinels: confirm the set and justify each (the ping requires justification for net-new sentinels).

---

### Section 2: Snapshot enrichment fields (data repo)

**Status:** CLEAN — opened `snapshots/snapshot_t0_q2_2026.json` (baseline; 12.95 MB). Top-level keys: `_meta`, `aif`, `fx`, `indices`, `industry_reports`, `macro`, `mf_funds`, `nifty500`, `pms`, `snapshot_metadata`, `unlisted_equity`.

**Findings (structure only, not full series):**

1. **`mf_funds[].monthly_nav`** — 1,773 funds. `monthly_nav` is an **object keyed by `"YYYY-MM"`** → NAV (number). Length is **per-fund variable, back to inception** (sample fund: 241 months, 2006-05 → 2026-05; `total_months` field records this). **Monthly frequency confirmed.** Funds are NOT clipped to the 84-month window — they carry full history.

2. **Stock `monthly_prices`** — under `nifty500.companies[]` (500 companies). `monthly_prices` is an **object keyed by `"YYYY-MM"`** → price (number), **84 months, 2019-05 → 2026-04** (the standardised lookback). Note the asymmetry: **stocks = fixed 84-month window; funds = full inception history.** T-5.06's standard-window computation must handle both lengths.

3. **The 16 canonical indices** — `indices` is an object keyed by index_id, **16 entries:** `bse_sensex_tri`, `crisil_composite_bond`, `crisil_dynamic_gilt`, `crisil_liquid`, `crisil_short_term_bond`, `gold_inr`, `nifty_100_tri`, `nifty_10y_gsec`, `nifty_500_tri`, `nifty_50_tri`, `nifty_bank_tri`, `nifty_it_tri`, `nifty_midcap_150_tri`, `nifty_next_50_tri`, `nifty_smallcap_250_tri`, `sp_500_tri_inr`. Each: `{ name, category, synthesis_method, monthly_values (object "YYYY-MM"→number), metadata }`. `nifty_500_tri` → 84 months, 2019-05 → 2026-04.

4. **USD/INR FX** — `fx` keyed by pair: `aed_inr`, `eur_inr`, `gbp_inr`, `usd_inr`. `usd_inr` = `{ metadata, monthly_values }`, **84 months, 2019-05 → 2026-04**. Per the loader type comment, eur/gbp/aed are reserved (likely null-valued); `usd_inr` is the populated series. Relevant only if T-5.06 evaluates `intl_` holdings (none in current fixtures → `currency_conversion_pending`).

5. **`mf_funds[].tier_b_stats`** — keys: the 13 windowed metrics (`vol_3y_annualized`, `vol_5y_annualized`, `sharpe_3y/5y`, `sortino_3y/5y`, `max_drawdown_3y/5y`, `calmar_3y`, `beta_3y`, `r_squared_3y`, `tracking_error_3y`, `information_ratio_3y`) + `_benchmark_resolution` + (when resolved) `_meta.benchmark_index_id`; `data_window_insufficient`/`reason` instead when the series is too short. **Already pre-computed (ADR-0012)** — this is exactly the duplication risk for open seam #2: standard 3Y/5Y vol/Sharpe/etc. already exist here.

6. **`mf_funds[].rolling_metrics`** — **NOT a t1–t8 block.** It is a **flat per-fund object** of ~12 fields: `rolling_3y_pct_beat_cat`, `rolling_3y_avg_excess`, `rolling_5y_pct_beat_cat`, `rolling_5y_avg_excess`, `alpha_trend_slope`, `alpha_trend_direction` (string: "improving"/"deteriorating"), `regime_stability`, `max_drawdown`, `max_dd_recovery_months`, `upside_capture_3y`, `downside_capture_3y`, `rolling_ir_current`. Mixed number/string values (type is `Record<string, number | string>`).

**Cross-reference (per the kick-off's claim that per-stock `tier_b_stats` and `rolling_metrics` exist):**
- Per-stock **`tier_b_stats` EXISTS** — confirmed. Includes `_meta: { sector, cap_tier, benchmark_index_id }` (sample: Reliance → `nifty_50_tri`), and stocks DO get beta/r²/te/ir populated (unlike most funds).
- Per-stock **`rolling_metrics` does NOT exist** — `nifty500.companies[].has("rolling_metrics") === false`. **`rolling_metrics` is funds-only.** The kick-off's expectation is wrong for stocks. This materially shapes T-5.06: cross-snapshot evolution via `rolling_metrics` is available for funds but **not** for direct stocks — stock evolution must be computed from `monthly_prices`/`tier_b_stats` across snapshots instead.

**Open questions for planning chat:**
- **The "rolling_metrics t1–t8" framing in the kick-off and ping is a data-model misconception.** Reconcile scope language: evolution comes from the **9 snapshot files** each carrying their own flat `rolling_metrics`/`tier_b_stats`/`monthly_nav`, not from a t-keyed block. This directly affects open seam #4 (agent input contract) — the agent needs N snapshots, not one snapshot with an internal t-series.
- **Stocks have no `rolling_metrics`.** Decide how T-5.06 expresses cross-snapshot evolution for direct equity (compute from `monthly_prices` deltas across the snapshot pair? read `tier_b_stats` deltas?). Funds and stocks will need different evolution sources — flag for the data-contract design.
- **Open seam #2 (where `tier_b_return_stats` lives):** ADR-0012 already pre-computes windowed stats and **explicitly names "Time-series performance: rolling window analyses" as an intended consumer**, i.e. the established architecture leans *pre-compute*. Option B's agent-time computation of standard windows is a real, justified exception to that pattern (acknowledged) — worth noting the precedent points the other way, which strengthens the case for the T-5.02 follow-up to pre-compute `tier_b_return_stats`.

---

### Section 3: Cross-snapshot evolution plumbing

**Status:** NEEDS ATTENTION (no blocker; structural decision required of the planning chat)

**Findings (against the post-PR-#7 tree):**

1. **No agent today consumes more than one snapshot.** Both orchestrators load exactly one:
   - `runDiagnosticPipeline` (pipeline.ts): `const snapshot = await loadSnapshot(opts.snapshotId)`.
   - `runProposedActionPipeline` (pipeline-case.ts): `const snapshot = await loadSnapshot(snapshotId)`.
   That single `snapshot` object is threaded to `computeMetrics`, `runRiskRewardDeterministic`, all scope-builders, and every evidence agent. **No array/plural/date-range shape exists anywhere.**

2. **Snapshot load path.** `case-context.ts` does **not** load or carry the snapshot — `CaseAgentContext` is investor/mandate/proposal/IndianContext text only. The **pipeline orchestrator** loads it: `prisma.snapshot.findUnique({ where: { id: snapshotId } })` yields the DB row (for `date`), and `loadSnapshot(snapshotId)` reads `fixtures/snapshots/enriched/snapshot_${snapshotId}.json` from local disk (LRU cache, capacity 3). **Loading is by snapshot-id (a t-key-like string, e.g. `"t0_q2_2026"`) mapped to a filename — not by date range.** `loadSnapshot(snapshotId: string): Promise<Snapshot>` is the only entry point; `_cacheKeys`/`_cacheClear` are test helpers. Post-ADR-0027 the JSON is sourced from the private repo via `setup-data.ts`, but the loader signature/path is unchanged.

3. **Cross-snapshot evolution signal is real (verified t0 vs t5).** Same fund (Aditya Birla SL Large & Mid Cap), t0 (baseline) vs t5 (`stress_bank_shock`): `tier_b_stats.sharpe_3y` 0.5172 → −0.0138; `rolling_metrics.rolling_ir_current` −1.0433 → 0.0915; `alpha_trend_direction` "improving" → "deteriorating"; `monthly_nav` extends 2026-05 → 2027-07 (rolls forward ~15 months). So Option B (compute fresh per snapshot; read `rolling_metrics` per snapshot) **has genuine signal to work with.**
   - **Caution:** `snapshot_metadata.evolved_fields` is **not** a reliable manifest. t5 lists only NAV/AUM/MTD/YTD/1M/Top-5/macro as "evolved" and does **not** list `monthly_nav`, `tier_b_stats`, or `rolling_metrics` — yet all three demonstrably changed. T-5.06 must derive evolution by **comparing actual field values across the two loaded snapshots**, never by trusting `evolved_fields`/`static_fields`.

**Open questions for planning chat (flagged, not answered — per ping):**
- **The structural decision:** today every agent gets one snapshot; T-5.06 is the first two-snapshot-aware agent and there is **no existing plumbing** to thread a second snapshot. Two shapes to choose between (do not read this as a recommendation): (a) extend the pipeline/agent-input contract to load and pass a snapshot **pair** (or list); or (b) let the time-series agent itself call `loadSnapshot` for the comparison snapshot id(s). This is open seam #4 (agent input contract) made concrete.
- **Which pair?** `t_current` vs `t_prior`, vs `t0`-baseline vs `t_current`, vs full t0..t_current trajectory. The data supports any (all 9 files load independently); the contract decision is the planning chat's.
- **Which pipeline?** Risk-reward wired into the Samriddhi 2 `runDiagnosticPipeline`. Confirm T-5.06 targets the same diagnostic pipeline (and whether the comparison snapshot id is a new field on the pipeline `opts`).

---

### Section 4: Skill and ADR conventions

**Status:** CLEAN

**Findings:**
- **Skill frontmatter convention** (sampled `risk_reward_stats.md`, `m0_portfolio_risk_analytics.md`, `e7_mutual_fund.md`): required keys are `agent_id`, `skill_md_version` (quoted, e.g. `"1.1"`), `draft_version` (`provisional`/`production`), `authored_in_cluster`, `finalised_in_cluster` (nullable), `llm_model` (`claude-opus-4-7` for deterministic-heavy agents, `claude-sonnet-4-6` for some E-agents), `max_tokens`, `temperature`, `output_schema_ref`, `source_files[]`. Optional `enriched_in_cluster`. **`output_schema_ref` pattern is `schemas/<agent_id>_output.schema.json`** → T-5.06 would use `agent_id: time_series_performance` and `schemas/time_series_performance_output.schema.json`. Skill body sections are conventionally: Role, When Activated, (Two-Layer Operation), Inputs, Output Schema, Discipline, Sentinel/Edge Cases, Anti-Patterns.
- **ADRs** live in `docs/decisions/`, named `NNNN_snake_case_title.md` (4-digit zero-padded, 0001–0027). ADR-0021 is `docs/decisions/0021_sibling_agent_placement.md`. Body format: `# ADR NNNN: Title` then `## Context`, `## Decision`, `## Alternatives Considered`, `## Consequences` (newer ones add `## Status`). **ADR-0024 and ADR-0026 are the pattern templates** (per planning-chat note): both follow Context → Decision (with numbered disciplines) → coverage/empirical findings → Alternatives → Consequences with explicit file lists and a no-API verify-script reference (`scripts/_verify-*.ts`). If T-5.06 writes an ADR (not this ping), that's the shape to match.
- **Branch naming:** T-5.03 branched as **`features/risk-reward-stats`** (the branch still exists locally), alongside `features/snapshot-enrichment`, `features/a2-classification`, `samriddhi-1-case-generation`, `snapshot-data-extraction`. So **`features/time-series-performance` is consistent** with house style (`features/<kebab-case>`).

**Open questions for planning chat:**
- None blocking. Confirm `agent_id: time_series_performance` and the schema filename so the skill frontmatter and `output_schema_ref` are pinned before the capability ping.

---

## Summary for the second ping (capability skeleton)

- **Placement (ADR-0021 template):** new sibling `lib/agents/time-series-performance.ts` + skill `agents/time_series_performance.md`; `timeSeriesPerformance` router flag (parallel to `riskRewardStats`); persisted at `content.time_series_performance`; feeds an interpretive dimension. Mirror the pure-deterministic single-output-object shape of `portfolio-risk-analytics.ts` / `computeRiskReward`.
- **Reuse, do not reinvent:** benchmark via `tier_b_stats._meta.benchmark_index_id` + `snapshot.indices[...]` (ADR-0017/0012); the 8 risk-reward sentinels; `SLEEVE_BENCHMARK`; the read-through discipline; the `is_synthetic_forward` derivation + hard disclosure guard.
- **Honour ADR-0019:** time-series consuming `rolling_metrics` is **explicitly permitted** ("if a downstream surface wants a `rolling_metrics` field it reads it independently") — but the do-not-mix rule means `rolling_metrics`-derived evolution must stay methodologically separate from `tier_b_stats`-derived window stats; never blend them in one statistic.
- **Four open seams remain for the planning chat** (this ping only reports state): UX placement (deferred); `tier_b_return_stats` location (ADR-0012 leans pre-compute; Option B is the agent-time exception); PMS wrapper opacity (the existing `pms_disclosure_limited` / `opaque_wrapper` sentinels are the precedent); and the **two-snapshot agent-input contract** (the genuinely new structural decision — Section 3).
- **Two data-model corrections the capability ping must absorb:** `rolling_metrics` is a flat per-fund object (funds-only; stocks have none), and cross-snapshot evolution lives across the 9 snapshot files, not in a t-keyed block. `evolved_fields` metadata is unreliable; compare values directly.

*Recon complete. WA12: zero Anthropic API calls across both phases. Pushed to `recon/t506-ping1` (branched off the remediated `main` @ `43ac82d`); `backup-pre-split-main` not pushed.*
