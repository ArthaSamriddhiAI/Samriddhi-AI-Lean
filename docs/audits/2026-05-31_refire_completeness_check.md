# Re-fire completeness check: the straggler beyond A3, and a cost correction

**Date:** 2026-05-31
**Branch:** `features/client-weighted-benchmark` (build held at the Phase 2 stop; read-only; nothing back-filled or fired).
**Mode:** Read-only completeness check. Short correcting note to `docs/audits/2026-05-31_option_b_realdata_scoping.md`. WA2, WA12 (estimate before spend), WA21, WA27, WA7.

## Finding: A2 is a second out-of-band LLM component, missed by the prior scoping

The prior scoping costed the re-fire as e1-e7 plus s1 (the recorded ~12.7 dollars) plus A3. It missed A2. **A2 also fires the LLM and is also out of band, so the re-fire cost corrects upward.**

### The S2 LLM reasoning components, enumerated

From `lib/agents/pipeline.ts` (`runDiagnosticPipeline`), the LLM-producing components are: the evidence agents e1, e2, e3, e4, e6, e7 (`:227-242`); s1, the briefing and diagnostic (`runS1Diagnostic`, `:292`); **A2** (`runA2Diagnostic`, `:312`); and A3 (`runA3Diagnostic`, `:369`). e5 is routed but not run; A1 is deliberately absent from S2 (ADR-0040). Deterministic (not LLM): risk-reward, portfolio-overlap, time-series, metrics, router, and the stitch.

A2 is hybrid: Layer 1 is the deterministic verdict assignment ("No LLM", `lib/agents/a2-classification.ts:7-8`), but Layer 2 is an LLM-glossed reason text (`:645`, `callAgent` at `:785`, `runA2Diagnostic` at `:799`, with `stripLongDashes` applied to the model payload). That Layer 2 is a real LLM call per case.

### Presence and currency across the five fixtures

All five fixtures (bhatt, iyengar, malhotra, menon, surana) carry the same eight content blocks: `a2_classification`, `a3_so_what`, `briefing`, `evidence`, `metrics`, `risk_reward_stats`, `router_decision`, `usage_summary`. So every LLM component (e1-e7 in `evidence`, s1 in `briefing`, A2 in `a2_classification`, A3 in `a3_so_what`) is present and consistent; nothing is missing in some cases but not others.

Two things are out of band, by the A3 signature (a backfill script plus absence from the recorded `tokenUsage`, whose `per_agent` lists only e1-e7 and s1):
- **A2 and A3 are both LLM components that were back-filled separately** (`scripts/backfill-a2.ts`, `scripts/backfill-a3.ts`) and whose cost is not in the recorded ~12.7. Both are present and current in all five fixtures, but neither was costed.
- **`portfolio_overlap` and `time_series_performance` are produced by the pipeline (`pipeline.ts:162,190`) but absent from all five fixtures.** They are deterministic (zero LLM call sites), ship data only (the renderer reads neither, WA9), so their absence is benign and back-filling them is free.

### Does the re-fire sweep them in

Yes. A clean full re-fire runs `runDiagnosticPipeline` per case, which produces every component in one pass: e1-e7, s1, A2, A3, and the deterministic blocks including the two currently missing. So no separate back-fill step is needed; the full re-fire regenerates A2, A3, and adds `portfolio_overlap` and `time_series_performance` at no extra API cost. And A2 must re-fire under Option B on its own merits: its Layer 2 gloss cites the changing trailing returns by value ("1Y return", "52.7% over"), so reusing it would leave stale numbers.

### Cost correction (WA12)

The firm recorded figure stands for what it covers: ~12.7 dollars for e1-e7 plus s1 (258,002 input and 117,485 output tokens, Opus, no caching). On top of that, two out-of-band LLM components re-fire, not one:
- A3: estimated ~3 to 4 dollars for five cases (its blocks run 26k to 49k characters each, the largest LLM output in the case).
- A2: estimated ~2 to 3 dollars for five cases (Layer 2 gloss; blocks run 1.4k to 13k characters each).

Neither A2 nor A3 is in the logs, so these are estimates the re-fire itself would measure precisely. **Corrected clean full re-fire: about 18 to 20 dollars** (the prior ~13 to 17 omitted A2). The `portfolio_overlap` and `time_series_performance` additions are deterministic and free.

This note corrects the figure; it back-fills nothing and fires nothing. The build stays parked at the Phase 2 stop.
