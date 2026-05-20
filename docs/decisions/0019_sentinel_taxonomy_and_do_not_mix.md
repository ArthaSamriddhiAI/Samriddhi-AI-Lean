# ADR 0019: Sentinel taxonomy and the three-way do-not-mix rule

## Context

Risk-reward must be honest about what it cannot compute rather than fabricate a number, and it must read statistics from exactly one source. Two disciplines codify this: a sentinel taxonomy for unevaluable holdings and sleeves, and a hard rule about which of the three "stat-shaped" surfaces on a fund row is canonical.

## Decision

**Sentinel taxonomy** (a holding or sleeve carries one sentinel and null `stats`):

- `opaque_wrapper`: AIF (no return data exists; foundation opaque-by-design).
- `pms_disclosure_limited`: PMS (no monthly NAV; rolling stats not computable).
- `not_applicable_for_risk_reward`: FD, tax-free bond, gold, REIT, savings (no return series).
- `insufficient_history`: the instrument's `tier_b_stats` carries `data_window_insufficient`.
- `benchmark_structurally_inapplicable` / `benchmark_not_in_snapshot`: the two fund benchmark-resolution failure modes (ADR-0017); self-stats remain valid, only the four benchmark-relative metrics are null.
- `currency_conversion_pending`: foreign-currency holding with no FX series (none in current S2 fixtures; schema-ready).
- `no_constituents_evaluable`: a sleeve where every constituent is sentinelled.

**Three-way do-not-mix rule (hard).** Per-instrument statistics come from `tier_b_stats` exclusively. The source flat scalars (`Sharpe`, `Sortino`, `Beta`, `Volatility`, `VaR`) are opaque (undocumented RF baseline, implausible values; ADR-0012) and are never consumed. `rolling_metrics` uses a different methodology and window convention and is never mixed with `tier_b_stats`; if a downstream surface wants a `rolling_metrics` field it reads it independently.

## Alternatives Considered

- **Compute partial stats for PMS from trailing returns.** Rejected: the snapshot `pms` block is opaque-by-design; no monthly NAV exists to compute rolling stats from, so `pms_disclosure_limited` is the honest sentinel (Trade-off 1).
- **Use the source flat `Sharpe` where `tier_b_stats` is null.** Rejected: it mixes two incompatible methodologies and produces silently inconsistent numbers; the do-not-mix rule forbids it.
- **A single generic "not_computable" sentinel.** Rejected: the reason (opaque wrapper vs disclosure-limited vs not-applicable vs benchmark-gap) is diagnostically meaningful and routes to different downstream owners.

## Consequences

Every unevaluable slot is labelled with why, so a consumer (and the rollup) can state the gap honestly; the unevaluable share is itself the load-bearing observation for complexity-heavy portfolios. The do-not-mix rule keeps every per-instrument number traceable to one documented methodology. Implemented in `lib/agents/risk-reward-stats.ts` (`classifyHolding`, the `RiskRewardSentinel` union) and stated in the skill (`agents/risk_reward_stats.md`); the source-scalar opacity is also recorded in the Step 1 audit and `PRODUCT_DEBT_LOG.md` (cluster-3).
