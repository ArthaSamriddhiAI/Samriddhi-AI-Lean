# ADR 0030: Portfolio overlap sibling agent and EvidenceSentinel union refactor

## Status

Proposed. Primary review is the next gate; moves to Accepted only after that
gate clears. Capability ships as T-5.07 on `features/portfolio-overlap`.

## Context

T-5.07 introduces pairwise portfolio overlap as a new deterministic capability
in the Samriddhi 2 diagnostic pipeline. Overlap is computed across holdings in
a single portfolio at three resolution layers: top-5-stock overlap (on the
~220 of 1,773 funds with top-5 disclosure), wrapper-level overlap (on all
wrappers with any holdings disclosure), and sub-category / asset-class overlap
(on all holdings).

A grounding correction surfaced during T-5.07/T-5.08 discovery: the pair-aware
loader introduced by ADR-0028 (`loadSnapshotPair`) operates on the snapshot
axis, not the holdings axis. Time-series uses it because time-series compares
one snapshot to a prior snapshot. T-5.07's pairwise work is holding-pair within
a single snapshot — a different problem. ADR-0028's loader is therefore not a
reusable mechanism for T-5.07.

## Decision

- **Placement — sibling agent.** T-5.07 ships as `lib/agents/portfolio-overlap.ts`,
  a sibling to `risk-reward-stats.ts` and `time-series-performance.ts`. Reasons:
  precedent gravity (both prior return/evidence layers went sibling); role
  separation (M0.PortfolioAnalytics is single-portfolio aggregate metrics —
  HHI, top-N concentration, asset-class breakdowns — whereas overlap is
  between-holding relational math); and commit-history clarity.
- **Call shape — synchronous, single-snapshot.** Inherits the synchronous
  single-snapshot shape from `risk-reward-stats.ts`, not the async pair-aware
  shape from `time-series-performance.ts`. The pipeline call is
  `runPortfolioOverlapDeterministic({ caseId, asOfDate, holdings, snapshot, investor })`,
  gated on `routerDecision.portfolioOverlap`. No try/catch wrapping (no async
  loader, no skeleton TODO). The router gains a `portfolioOverlap` flag, true
  when the portfolio has at least two holdings with overlap-evaluable
  disclosure.
- **Persistence — data-only, S1-bypass.** Overlap output persists as a new
  top-level `content.portfolio_overlap` key, mirroring `content.risk_reward_stats`
  and `content.time_series_performance`. It is threaded as a standalone variable
  in `runDiagnosticPipeline`; it is NOT a member of `EvidenceBundle`
  (`lib/agents/stitcher.ts`), which holds only the E-series agent outputs.
  Overlap follows risk-reward's S1-bypass precedent (ADR-0021): it is not
  threaded into `StitchedContext` and S1 does not read it (WA9), unlike
  time-series (ADR-0029 Option II). It is descriptive evidence for a future
  interpretive layer, not an S1 narrative input.
- **Sentinel taxonomy — refactor `RiskRewardSentinel` to a shared `EvidenceSentinel`.**
  The existing union (defined in `risk-reward-stats.ts`, imported by
  `time-series-performance.ts` — confirmed those are the only two referencing
  files) is renamed and relocated to `lib/agents/case/sentinels.ts`. T-5.07
  adds two new members: `insufficient_overlap_coverage` (fewer than two
  holdings with evaluable overlap data) and `single_holding_sleeve_overlap`
  (sleeve contains only one holding). The refactor is mechanical (rename,
  relocate, update two imports; no behaviour change) and ships as a separate
  commit before T-5.07 capability code.
- **Rollup — per-holding-pair → per-sleeve → per-portfolio.** Matches the
  rollup shape from risk-reward and time-series. The per-pair layer computes
  overlap at the finest available resolution; per-sleeve aggregates within
  asset class or sub-category; per-portfolio surfaces the cross-sleeve signal
  as a descriptive summary. No verdict layer (per the P3a/P3b split in P3).
- **Resolution-layer reporting.** Every emitted overlap pair carries a
  `resolution_layer` field: `"top_5_stocks"`, `"wrapper_level"`, or
  `"sub_category"`. Mixed-coverage pairs fall back to the coarsest layer
  required by either side and report it.

## Alternatives Considered

- **Extension on M0.PortfolioAnalytics.** Rejected on role separation: M0's
  role is single-portfolio aggregate metrics, not between-holding relational
  math.
- **Inherit kickoff sentinel names verbatim (`insufficient_coverage`,
  `single_holding_sleeve`).** Rejected: `insufficient_coverage` collides
  semantically with the existing `insufficient_history` and
  `no_constituents_evaluable`; `single_holding_sleeve` would shadow the
  existing `single_holding_passthrough` method value. Overlap-specific
  suffixes avoid the collision. (`opaque_wrapper`, the one kickoff name that
  exists verbatim, is reused as-is.)
- **Async pair-aware loader inherited from ADR-0028.** Rejected: ADR-0028's
  pair-awareness is snapshot-axis, not holdings-axis. Not applicable.
- **Verdict layer at the per-portfolio rollup.** Rejected: the judgment-grade
  layer is the P3b deferred ambition, requires LLM synthesis, and is out of
  scope for this deterministic Capability Phase ship.

## Consequences

**Easier.**
- The next sibling agent inherits `EvidenceSentinel` from a shared location
  rather than re-importing a per-agent taxonomy.
- The synchronous call site avoids the try/catch degradation pattern
  time-series needs.
- The `resolution_layer` field makes mixed-coverage cases self-documenting.

**Harder.**
- The `EvidenceSentinel` rename touches the two existing siblings (risk-reward,
  time-series), so the work is a refactor-plus-add, not a pure add.
- Two new sentinel names introduce vocabulary the kickoff drafted differently;
  reconciled explicitly above.

**New surface area.**
- The router gains a `portfolioOverlap` flag.
- A new top-level `content.portfolio_overlap` key in `runDiagnosticPipeline`'s
  persisted output (the inline `fullContent` object; there is no named content
  type). `EvidenceBundle` is unchanged.
- `lib/agents/case/sentinels.ts` (new shared module).
- The T-5.08 Analyst Reports adapter (separate ship) consumes the new key.

## References

- ADR-0019: Sentinel taxonomy and do-not-mix.
- ADR-0021: Sibling agent placement (risk-reward); the S1-bypass precedent.
- ADR-0028: Time-series-performance sibling and pair-aware snapshot loader.
- ADR-0029: Time-series into the S1 stitcher (Option II; the threading
  precedent this ADR deliberately does NOT follow).
- P3 / P3a / P3b: pairwise overlap capability and the deferred judgment layer.
- P28 (resolution arm (D), the `workflow` schema rename).
- T16: E5 inert dispatch (related to the no-E5-row decision in T-5.08).
