# ADR 0030: Portfolio overlap sibling agent and EvidenceSentinel union refactor

## Status

Proposed. Primary review is the next gate; moves to Accepted only after that
gate clears. Capability ships as T-5.07 on `features/portfolio-overlap`.

## Context

T-5.07 introduces pairwise portfolio overlap as a new deterministic capability
in the Samriddhi 2 diagnostic pipeline. Overlap is computed across holdings in
a single portfolio at three resolution layers, each pair reported at the finest
layer both holdings support: stock-level overlap (over disclosed top holdings —
MF top-5 and PMS `portfolio_composition.top_holdings`), structural similarity
(over cap-split vectors, when stock-level disclosure is absent), and categorical
similarity (sub-category / asset-class match, always available). The layer model
is detailed in the Decision section below.

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
- **Rollup, per-holding-pair → per-sleeve → per-portfolio.** Matches the
  rollup shape from risk-reward and time-series. The per-pair layer emits
  resolution-layer-tagged overlap or similarity results; the per-sleeve
  layer aggregates within asset class or sub-category; the per-portfolio
  layer surfaces the cross-sleeve signal as a descriptive summary. No
  verdict layer at any level (per the P3a/P3b split in P3 and per the
  "Verdict layer" alternative rejected below).
- **Resolution layers, three.** Overlap is computed at three layers and the
  agent reports which layer was used per emitted pair. The layer model below
  reflects what the snapshot data actually carries, verified during Phase B
  discovery (snapshot `t0_q2_2026`, all six Samriddhi 2 production fixtures):
  - **Layer 1, stock-level overlap.** Computed over disclosed stock-level
    holdings from two heterogeneous sources: MF top-5 holdings (~233 of 1,773
    funds carry this in snapshot `t0_q2_2026`) and PMS `portfolio_composition.top_holdings`
    (carried by a subset of PMS records; the rest are opaque). The two sources
    use different field names and different weight scales; the agent
    normalizes both to a common `{name, weight_fraction}` shape before
    computing. Metric family: min-weight intersection over shared holdings
    (sum of `min(weight_a, weight_b)` across name matches), with shared-name
    count emitted as a secondary signal. AIFs carry no stock-level disclosure
    and always sentinel to `opaque_wrapper` at this layer.
  - **Layer 2, structural similarity.** Named honestly as similarity, not
    overlap, because it does not compare holdings; it compares portfolio
    *structure*. Computed over cap-split data (the `LargeCap %` / `MidCap %`
    / `SmallCap %` fields on MF rows, broadly populated across ~977 of 1,773
    funds) when available. Metric family: one minus the normalized L1
    distance between the two cap-split vectors (after normalizing each to
    sum to 1), bounded to [0, 1]. Sector data is sparsely populated in the
    current snapshot (~170 MFs); sector similarity is reserved for a later
    workstream when coverage justifies it. The middle layer in earlier
    drafting was called "wrapper-level"; that name was misleading because
    PMS holdings disclosure is itself stock-level (Layer 1), and AIFs carry
    no disclosure at any granularity. The honest middle-granularity signal
    available on current data is structural similarity, not wrapper holdings.
  - **Layer 3, categorical similarity.** Sub-category and asset-class match
    between the two holdings. Discrete scoring: same sub-category = 1, same
    asset class but different sub-category = 0.5, different asset class = 0.
    Always available because every holding carries `assetClass` and
    `subCategory` by schema invariant.
  - **Resolution-layer reporting.** Every emitted pair includes a
    `resolution_layer` field with one of three values: `"stock_level"`,
    `"structural_similarity"`, `"categorical"`. The agent tries layers in
    order (most specific first); the field reports which layer produced the
    emitted result. Mixed-coverage pairs (one side has Layer 1 data, the
    other doesn't) fall back to the coarsest layer both sides support.
  - **Metric formulae are implementation discretion within the named
    families.** This ADR fixes the metric *family* per layer; exact
    arithmetic (handling of edge cases like zero-weight holdings,
    floating-point tolerance, normalization conventions) is implementation
    discretion with quoted code comments. If implementation surfaces a
    case where the metric family genuinely doesn't fit the data, stop and
    surface; do not redefine the family silently.

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
  time-series), so the work is a refactor-plus-add, not a pure add. (Shipped
  in Phase A, commit `ce56ec5`.)
- Layer 1 spans two heterogeneous data sources (MF `Top 5 Holdings (JSON)`
  and PMS `portfolio_composition.top_holdings`) with different field names
  and weight scales. Normalization is a real implementation cost; not
  technically hard, but easy to get subtly wrong if the two scales are
  conflated.
- Current Samriddhi 2 production fixtures exercise Layer 1 thinly: across
  the six fixtures, only Bhatt's portfolio includes two PMS records that
  both carry stock-level disclosure (Marcellus and Motilal Value Migration),
  and none of the MF holdings across the other five fixtures are in the
  ~233-with-top-5-disclosure set. T-5.07 verification therefore relies on
  dedicated synthetic test fixtures (per kickoff's original four-case plan),
  not on production fixtures. Production-fixture coverage is a curation
  observation noted in P3's addendum, not a sequencing change to T-5.11.
- Two new sentinel names introduce vocabulary the kickoff drafted
  differently; reconciled in the original ADR-0030 text. Under the amended
  layer model, `insufficient_overlap_coverage` is a defensive sentinel
  reserved for true data-degenerate cases (holdings with no category) and
  is unlikely to fire under the current holdings schema. Retained for
  defensive posture rather than removed.

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
- This ADR was amended in place before reaching Accepted status; the
  resolution-layer model and Consequences "Harder" subsection were revised
  during Phase B discovery (2026-05) when CC surfaced a data-vs-model
  divergence per WA19. The amendment preserved Phase A's `EvidenceSentinel`
  refactor (already shipped at commit `ce56ec5`) and refined the
  resolution-layer Decision bullets to match the snapshot data's actual
  shape. Status remains Proposed pending the next primary review gate.
