# ADR 0029: Time-series-performance threaded into S1 (Option II stitcher-contract change)

## Status

Accepted. The stitcher-contract change and the S1 threading are implemented (the `time_series_performance` field on `StitchedContext`, the pipeline pass-through, and the S1 skill update); T-5.06 is verified 45/45.

## Context

ADR-0021 (risk-reward-stats) and ADR-0028 (time-series-performance sibling placement) both followed the same pattern: a deterministic sibling computes data, persists it to a `content.*` key, and **bypasses** S1's `StitchedContext` (the renderer and S1 narrative do not read it; WA9). ADR-0021 explicitly rejected stitching risk-reward into S1.

Time-series-performance is different in one product-relevant way: its cross-snapshot evolution facts ("the large-cap sleeve outran its benchmark by 2% since the prior quarter") are narrative-relevant to the Samriddhi 2 diagnostic in a way that risk-reward's point-in-time risk statistics are not. The planning chat decided **Option II**: thread time-series output into S1 so the diagnostic narrative can cite time-series facts. This is a deliberate departure from the bypass pattern, scoped to time-series only.

## Decision

- `StitchedContext` (and `StitchInput`) gain a `time_series_performance: TimeSeriesPerformanceOutput | null` field (`lib/agents/stitcher.ts`).
- `runDiagnosticPipeline` (`lib/agents/pipeline.ts`) passes the time-series output (the same object persisted at `content.time_series_performance`) into `stitch(...)`; `stitch` populates the new field.
- `s1-diagnostic.ts`'s `buildPrompt` already serialises the whole `StitchedContext` into the user prompt, so the field is visible to S1 with no prompt-construction change beyond a one-line pointer.
- The S1 diagnostic-mode skill (`agents/s1_diagnostic_mode.md`) is updated: Output 3 (performance summary) names `time_series_performance` as its return-evidence source, and the Discipline section adds three rules: cite both snapshot IDs for any cross-snapshot figure, never invent return numbers (every figure traces to the block or an evidence verdict), and surface sentinels honestly.

## Alternatives considered

- **Option I, keep the bypass (mirror risk-reward / ADR-0021).** Rejected: time-series evolution facts are narrative-load-bearing for the diagnostic; leaving them out of S1 would mean the briefing cannot say "performance moved X since the prior quarter," which is the point of the capability.
- **Thread risk-reward into S1 too (for symmetry).** Out of scope. Risk-reward's bypass (ADR-0021) is preserved; this change is additive and time-series only. Editing the shared stitcher was done without disturbing the risk-reward path.
- **Supersession note on ADR-0028 instead of a new ADR.** Rejected: the stitcher-contract change is a distinct architectural decision (it changes a shared type consumed by S1), so it earns its own ADR rather than muddying ADR-0028's sibling-placement record.

## Consequences

- **Easier:** the S1 diagnostic narrative can cite time-series facts (trailing-window returns, benchmark-relative alpha, cross-snapshot evolution) with figures and snapshot IDs.
- **Harder:** the `StitchedContext` contract now carries a capability-specific field; future capabilities deciding bypass-vs-thread have two precedents (risk-reward bypasses, time-series threads) and must choose explicitly.
- **Unchanged:** risk-reward still bypasses S1; the renderer still does not read `content.time_series_performance` (WA9); the field is nullable so S1 degrades gracefully when time-series did not run.

## References

- ADR-0021 (risk-reward sibling placement; the bypass precedent this departs from).
- ADR-0028 (time-series-performance sibling placement and pair-aware loader).
- Files: `lib/agents/stitcher.ts`, `lib/agents/pipeline.ts`, `lib/agents/s1-diagnostic.ts`, `agents/s1_diagnostic_mode.md`.
