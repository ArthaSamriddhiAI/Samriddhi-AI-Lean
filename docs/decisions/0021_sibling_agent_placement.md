# ADR 0021: Risk-reward-stats sibling-agent placement and pipeline integration

## Context

The recon resolved that risk-reward-stats is a sibling to the deterministic metrics module, not an extension of it, and that its output feeds Dimension 4 of the interpretive verdict skill. The naming is historically confusing (two things are called "M0.PortfolioRiskAnalytics"), so the placement is recorded explicitly.

## Decision

Risk-reward-stats (`lib/agents/risk-reward-stats.ts`) is a sibling to `lib/agents/portfolio-risk-analytics.ts` (the deterministic feeder, "M0.PortfolioAnalytics" in skill nomenclature). It is invoked the same way the feeder is: deterministic, reads holdings plus the snapshot, in `runDiagnosticPipeline` (`lib/agents/pipeline.ts`), gated by a `riskRewardStats` flag on the router's `ApplicabilityVector` (true on every diagnostic and proposed_action, parallel to `portfolioRiskAnalytics`, not in `activated` which lists only the E-series LLM agents). Its output is persisted as a new `content.risk_reward_stats` key alongside `content.a2_classification`; the S2 renderer reads only `briefing` and never touches the key (WA9). The output feeds Dimension 4 (return quality: net-of-costs returns, benchmark-relative returns, risk-adjusted returns) of the interpretive verdict skill `agents/m0_portfolio_risk_analytics.md` when that skill's real implementation ships in cluster 7; risk-reward does not modify that skill (its Dimension 4 slot already declares these inputs).

The pipeline uses the deterministic templated path (`runRiskRewardDeterministic`) for normal case generation; the async LLM-capable orchestrator (`runRiskRewardStats`) is used by the backfill and is available for a future pipeline wiring decision (gated by WA12 on API spend).

## Alternatives Considered

- **Extend `portfolio-risk-analytics.ts` to add risk-reward stats.** Rejected at the recon: per-instrument risk-reward stats and portfolio-metrics are different concerns; the interpretive skill consumes them as distinct inputs; a sibling keeps each module single-purpose.
- **Stitch risk-reward into the `StitchedContext` that S1 consumes.** Rejected: mirrors the A2 precedent (A2 output bypasses the stitcher and is persisted separately); risk-reward is data for the cluster-7 interpreter and the design pass, not an S1 narrative input.
- **Rename the modules to fix the M0.PortfolioRiskAnalytics / M0.PortfolioAnalytics collision.** Out of scope (the prompt said do not fix the historical naming in this workstream); the collision is documented in the thesis and the skill instead.

## Consequences

Risk-reward ships as a clean sibling with a single new persisted key and no renderer change. The router gate and pipeline call are minimal additions. The interpretive verdict skill is untouched and will read `content.risk_reward_stats` for Dimension 4 when it ships. Implemented in `lib/agents/risk-reward-stats.ts`, `lib/agents/router.ts` (`riskRewardStats`), and `lib/agents/pipeline.ts` (`content.risk_reward_stats`); the skill is `agents/risk_reward_stats.md`.
