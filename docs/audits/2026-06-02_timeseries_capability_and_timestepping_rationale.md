# The time-series capability (T-5.06), and what the t1-t8 time-stepping is for

**Date:** 2026-06-02
**Branch:** `features/client-weighted-benchmark` (code repo). Read-only grounding audit; no agent run, no re-fire, no data or code change, no spend; commit only this deliverable. WA2/WA21 (ground against the ADRs and the code, quote evidence; where the record is silent, say so), WA22 (versioned `docs/audits/` deliverable), WA28 (whether/when to time-step is the primary's call), WA5/WA8 (a surfaced gap is debt to log, not to silently fix), WA27, WA7. First-move: new dated `docs/audits/` file.

---

## Bottom line, and a correction to the premise

**T-5.06 is implemented and verified, not an unimplemented skeleton.** The prior sequencing audit (`docs/audits/2026-06-02_timeseries_dependency_and_sequencing.md`) and this kickoff both rest on the claim that the time-series-performance feature "was never built." Grounded against the actual code, that is wrong. It is built, verified 45/45 deterministic, wired into the pipeline, threaded into S1's narrative, and persisted. The claim came from two stale code comments that contradict the file's own header; my prior audit read the stale comments. So there is no "data exists but the feature was never built" gap to explain: both the data (t0..t8) and the feature (T-5.06) exist. The sequencing CONCLUSION the prior audit reached (t1-t8 are not a re-fire prerequisite) still holds, but on a corrected basis: the re-fire cases run at t0, where the evolution dimension correctly has no prior to read, while the trailing-window dimension computes from t0's own (now real) series.

## The contradiction in the record, and how it resolves

`lib/agents/time-series-performance.ts` says two opposite things:
- Header (lines 9-10): "**Implementation complete. Verified 45/45 deterministic (5 archetypes x 9 snapshots) and 3/3 live S1 smoke (see docs/verification/T-5.06-verification.md).**"
- A mid-file section comment (line 124): "Layer 1 helpers (deterministic). **Bodies are TODO T-5.06-impl stubs.**"

And `lib/agents/pipeline.ts:179-181` repeats the stub framing: "SKELETON: the agent's Layer-1 helpers are TODO T-5.06-impl ... until the implementation lands."

The actual code is the arbiter, and it shows real implementations, not stubs:
- `computeTrailingWindowReturns` (`time-series-performance.ts:179`) has a full body (binary-search `valueAsOf`, `monthKeyMinus`, per-window return computation, `insufficient_history` sentinels).
- `runTimeSeriesPerformanceDeterministic` (`:466`) iterates holdings, classifies sentinels, computes trailing-window returns from `monthly_nav` / `monthly_prices`, resolves the read-through benchmark, computes benchmark-relative alpha and the per-sleeve/portfolio rollups, and emits `no_prior_snapshot_available` only when the reference is null.
- `docs/verification/T-5.06-verification.md` records "**45/45 PASS**" (5 archetypes x 9 snapshots), with the diagnostic detail that matters here: at t0 `Evolution = false` (no prior) with real trailing returns (Malhotra 1Y 7.7%, 3Y 40.9%, against the synthetic suite), and at t1+ `Evolution = true`.
- The pipeline computes it (`pipeline.ts:197,199`), threads it into S1 (`:282`, "Option II (ADR-0029): thread time-series into S1's StitchedContext"), and persists it to `content.time_series_performance` (`:406`). The surrounding `try/catch` is now a defensive guard, not a skeleton-degradation (it nulls only on a thrown error).

So the header and the verification doc are accurate; the line-124 and pipeline-179 comments are stale leftovers from the skeleton era. They are the sole basis for the "unbuilt" reading, and they are wrong. (Logging this stale-comment debt is in item 5.)

## 1. What the time-series capability is

From ADR-0028 and ADR-0029 (both `docs/decisions/`): T-5.06 is "**the return-evolution evidence layer for Samriddhi 2: trailing-window returns, benchmark-relative returns, sleeve and portfolio rollups, and cross-snapshot evolution ('how performance moved since the prior quarter')**" (ADR-0028 context). It is a deterministic sibling to risk-reward-stats, computed after risk-reward and before S1.

Its product surface is narrative, and it is core, not peripheral. ADR-0029 departs from the risk-reward bypass precedent specifically to thread time-series into S1: "its cross-snapshot evolution facts ... are narrative-relevant to the Samriddhi 2 diagnostic in a way that risk-reward's point-in-time risk statistics are not ... leaving them out of S1 would mean the briefing cannot say 'performance moved X since the prior quarter,' which is the point of the capability." The S1 diagnostic skill names `time_series_performance` as the return-evidence source for Output 3 (the performance summary). So it is one of the S1 diagnostic's outputs.

Two scope notes from the record: the DATA and the S1 narrative are live; only the render component is deferred under WA9 (the whole product ships data, render is the separate T-5.09 / UX11 slice), and the LLM rollup is fixture-only (P23), with the live path templated. Configurable evolution reference points ("since the bank shock at t5") are deferred (T19). None of those deferrals make the capability unbuilt; the deterministic evidence layer and its S1 threading are implemented.

## 2. Why is T-5.06 "unimplemented"? It is not

The honest, grounded answer is that the premise is false: T-5.06 is implemented (section above). There is no recorded deferral of the implementation, no blocked-dependency note, and no "skeleton" task status; the verification doc and the file header both assert completion, and the code bears it out. The only artifacts that say "unbuilt" are the two stale comments, which the actual function bodies contradict.

One adjacent doc-hygiene fact: ADR-0028 and ADR-0029 still carry **Status: Proposed**, even though the implementation and verification landed. That is a status-lag in the ADRs, not evidence of non-implementation; they should be moved to Accepted. (Item 5 logs both this and the stale comments as debt.)

## 3. What the t1-t8 time-stepping was scoped to serve (recorded)

The forward extension that produced t1-t8 is the snapshot-enrichment Phase C (`scripts/enrich_snapshots.py`: "Phase C will add forward extension to t1..t8"; the `Phase C: Forward extension` routines). Its recorded purpose is in the enrichment thesis (`docs/reference/SnapshotEnrichment_Thesis.md`): it adds monthly-frequency series across "the Lean Samriddhi MVP's 9 time-stepped snapshots (t0 through t8)" so that "concentrated direct-stock claims [can be] supported by computable risk metrics," and it explicitly lists the consumer: "**Time-series performance: reads monthly_prices, monthly_nav, indices.monthly_values directly for rolling analyses**" (thesis line 115). So the record ties the t1-t8 series directly to the time-series capability.

Their nature is set by ADR-0020: "**eight of the nine demo snapshots are synthetic forward-projections, and any number computed against them must not be mistaken for a forecast**," enforced by the hard synthetic-forward disclosure ("regime-test artifact, not a forecast"). The forward path also encodes a regime event (a "post-bank-shock state" by t8 in the thesis; ADR-0028's deferral T19 references "the bank shock at t5"), and the enrichment even computes a `regime_stability` statistic.

So both of the primary's rationales are in the record, and they are the same artifact, not competitors:
- The t1-t8 are the data the time-series evolution dimension reads (thesis line 115; ADR-0028's pair-aware loader).
- They are a synthetic forward-projection that walks through regime events (bank shock), disclosed as a regime-test, not a forecast (ADR-0020).

## 4. Is time-stepping needed, when, and for which rationale

Kept separate, grounded:

**(a) To feed T-5.06's evolution dimension.** T-5.06 is built and consumes the `t_n` / `t_{n-1}` pair, so a case run at t1+ produces real cross-snapshot evolution (the verification shows `Evolution = true` at t1+). The existing t1-t8 are synthetic-forward from the OLD synthetic t0 and in the old enriched format (per the sequencing audit and the format table there). So for a t1+ case to show evolution anchored on real data and in the current format, the t1-t8 must be re-derived (time-stepped) forward from real t0. One precision the record forces: this re-derivation re-anchors the successors to real t0 and the new format; the forward MOVES stay synthetic by design (ADR-0020 makes them regime-tests, not forecasts; real future data does not exist), so the evolution at t1+ remains a disclosed regime-test artifact either way. "Real t1-t8" means real-anchored, not a real future.

**(b) Regime coverage, independent of the feature.** The record supports this as a purpose of the same artifact: ADR-0020 frames the successors as synthetic forward-projections / regime-test, and the path encodes a bank-shock regime with a `regime_stability` metric. So regime/stress coverage (windows and drawdowns outside t0's own history) is a recorded value of the t1-t8, not just a feed for T-5.06. It is not framed as a separate independent dataset; it is the same forward projection serving the regime-test purpose.

**Therefore:** time-stepping is genuinely optional for the re-fire and is needed later only for the evolution dimension on real-anchored data. It is not essential-but-early (the re-fire does not touch it) and not blocked-on-T-5.06 (T-5.06 is built). The point at which it is needed is when Samriddhi 2 runs a case at t1+ and wants that case's evolution facts anchored on real t0 in the current format rather than on the synthetic baseline. That is exactly the post-re-fire cleanup thread the sequencing audit recommended.

## 5. Dependency chain and sequencing implication

The chain is: the t1-t8 forward extension (data) feeds T-5.06's evolution dimension (feature), which is one of the S1 diagnostic's outputs (value proposition). All three exist today; the only thing that is synthetic-and-old at the t1-t8 link is the data anchor and format, which the cleanup fixes.

- **No roadmap gap on T-5.06.** Contrary to the kickoff's premise, the capability is not a core-feature-left-unbuilt. The deterministic evidence layer and the S1 threading are implemented and verified. So there is nothing to flag to the roadmap as a missing capability; there is doc-hygiene debt to flag (below).
- **The re-fire path is unchanged.** The re-fire cases run at t0. At t0, T-5.06 computes real trailing-window returns from real t0 and emits `no_prior_snapshot_available` for the evolution sub-dimension (verification: `Evolution = false` at t0). So the re-fire reads only t0; t1-t8 are not a prerequisite. Time-stepping and any further T-5.06 work sit AFTER the re-fire, as the series-consistency cleanup, not before it.
- **Debt to log (WA5/WA8), the primary's to action, not this workstream's to fix:**
  1. The stale "TODO stubs / SKELETON ... until the implementation lands" comments at `lib/agents/time-series-performance.ts:124` and `lib/agents/pipeline.ts:179-181` are actively misleading (they caused the prior audit's wrong premise) and should be corrected to match the implemented reality.
  2. ADR-0028 and ADR-0029 should move from Status: Proposed to Accepted.
  3. The prior audit (`2026-06-02_timeseries_dependency_and_sequencing.md`) should carry a one-line correction: its conclusion stands, but its "unimplemented skeleton" premise was based on the stale comments; T-5.06 is built.

---

This audits and corrects the record; it builds nothing, runs nothing, changes no code or data, and spends nothing. Whether and when to time-step, and whether to clear the doc-hygiene debt before the re-fire, are the primary's calls.
