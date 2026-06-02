# Re-grounding: is t0 real or synthetic, where do the betas come from, and what in the prior audits needs correcting

**Date:** 2026-05-31
**Branch:** `features/client-weighted-benchmark` (build held at the Phase 2 stop; nothing changed by this audit).
**Mode:** Read-only, adversarial toward my own prior conclusions. Re-derived from primary evidence (the data on disk, the ADR text, the generation code), not from any prior audit's summary. WA2, WA21 (verbatim), WA27, WA7, WA28, WA24.
**First-move call:** new dated `docs/audits/` file.

---

## Verdict

The loaded `t0_q2_2026` snapshot's **monthly time series are synthetic**, both the 16 index series and the fund `monthly_nav`. This is proven directly from the data, not inferred: the series contain no real market history. The primary is **right** that t0's cross-section is real-world-sourced and that t1..t8 are forward-steps derived from t0; the dispute resolves at the **layer**. t0's point-in-time, cross-sectional fields (fundamentals, fund and PMS and AIF metadata, the canonical `vol_3y` and `sharpe_3y`) are real-sourced and match the colleague file; t0's **monthly NAV and index series**, which are exactly what beta regresses over, are synthesized by the enrichment. "t0 is the real baseline" and "t0's monthly series are synthetic" are both true because they describe different layers.

My prior "synthetic series" conclusion therefore **survives**, but I must correct the **proof**: the argument in `docs/audits/2026-05-31_snapshot_provenance_beta_origin.md` that "my regression reproduces the stored betas to four decimals, therefore the NAV is regenerated" was **circular and invalid** (the stored `tier_b` beta is computed *from* the on-disk NAV, so a match is guaranteed for any internally consistent snapshot, real or synthetic). The valid proof is below.

This is the genuine contradiction the kickoff anticipated, and it is worth halting on: the on-disk series the cases use are synthetic, which contradicts "t0 has no synthetic fields" at the series level. The most likely reconciliation is that the **loader reads the enriched suite, not the colleague source**: the real source is upstream, and the monthly series were added or regenerated during enrichment.

---

## 1. The decisive test: t0 contains no real market history

A real Indian-equity series spanning 2019-05 to 2026-04 must contain the COVID crash of March 2020 (Nifty 50 about -23% that month, Nifty Bank about -35%). The loaded t0 shows the opposite, an unbroken rise:

```
nifty_50_tri   2020-02: 396.44  ->  2020-03: 413.10  (+4.2%)  ->  2020-04: 430.06
nifty_500_tri  2020-02: 365.50  ->  2020-03: 382.15  (+4.6%)  ->  2020-04: 399.65
nifty_bank_tri 2020-02: 450.89  ->  2020-03: 469.19  (+4.1%)  ->  2020-04: 498.20
```

The fund NAVs agree:

```
Axis Large Cap   2020-02: 28.16  ->  2020-03: 29.11  (+3.4%)  ->  2020-04: 30.19
Mirae Large Cap  2020-02: 56.07  ->  2020-03: 59.58  (+6.3%)  ->  2020-04: 64.15
```

And the worst single month across all 84 months is far too shallow for real data: `nifty_50_tri` -5.3%, `nifty_bank_tri` -7.2%, `Axis Large Cap` -10.2%. Real 2019-2026 data has a -23% to -35% month. A normalization base cannot hide this, because month-over-month returns are scale-invariant; a real -23% would still read -23% after any rebasing. The series are smooth synthetic drift with no real event. **t0's monthly series are synthetic. This is incontrovertible.**

## 2. What the ADRs and metadata actually say about t0, by layer

The verbs and scope, separated:

- **The cross-section is the real base; t1..t8 evolve from it.** ADR-0007 (`docs/decisions/0007_*.md:10`): "The existing `generate_snapshots.py` engine evolves snapshots t1..t8 from a baseline t0 by computing one quarterly return per fund ... and applying it to NAV, AUM, CMP." This confirms the primary's dependency model exactly: t0 is the base, t1..t8 are forward-steps.
- **The monthly series are synthesized by the enrichment, on top of that base.** ADR-0007 (`:14`): "Snapshot enrichment needs to add monthly-frequency series ... This requires extending `monthly_nav` forward (fixing the freeze) and synthesizing monthly_prices for stocks and FX." ADR-0009 (`docs/decisions/0009_snapshot_index_synthesis_and_set.md:43-44`): the indices are the "Market-cap-weighted average of constituent monthly returns from the synthesized Nifty 500 universe." ADR-0014 (`docs/decisions/0014_*.md:13`): "the index-overlap portion of `mf_funds[].monthly_nav` is regenerated as a single-factor series on the resolved benchmark."
- **The series are engineered, not observed.** ADR-0007 (`:51`) describes constructing regime moves by hand: "Our calibration faithfully reproduces +10% by having May/June pump moves to offset the surgical -18% in July." That is synthetic series construction.
- **t0's own metadata marks the split.** `snapshot_metadata.static_fields` includes `monthly_nav` (a field carried from the source, not evolved across t0..t8), while `new_fields_added` includes "indices (new top-level block, 16 canonical indices)" and "nifty500.companies[].monthly_prices". So the indices and stock prices were **added** during enrichment, not present in the colleague source; `generation_notes` ("Baseline snapshot, identical to source") describes the cross-sectional baseline, and predates the ADR-0014 NAV regeneration that the data on disk reflects.

No ADR claims t0's monthly series are real. They claim t0 is the base and that the monthly series are synthesized or regenerated onto it. The data confirms the synthesis (Section 1).

## 3. The t0 to t1..t8 dependency, and which file the cases load

**Dependency direction: t1..t8 are derived from t0** (ADR-0007:10), so the primary's model is correct here, and any change to t0's series would cascade forward to t1..t8 if they were re-derived. The forward extension lives in `scripts/enrich_snapshots.py` (`derive_index_extension`, `:1468`; `enrich_snapshot`, `:1921`).

**Which file: the enriched suite, not the colleague source.** The loader reads `fixtures/snapshots/enriched` (`lib/agents/snapshot-loader.ts:26`), and its own comment says "The pre-enrichment source directory (fixtures/snapshots/) is retained only as a rollback path ... deleted before that workstream's PR opens" (`:21-22`). On disk, `fixtures/snapshots/` holds only the `enriched` symlink; the pre-enrichment real source is not present. So the cases regress betas over the **enriched** snapshot, whose monthly series are synthetic, which is a different artifact from the primary's real colleague JSON. This is the cleanest reconciliation of the dispute: the primary verified the real source; the pipeline loads the enriched derivative of it.

## 4. The true origin of the ~1.5 betas

The betas are regressed over t0's synthetic fund NAVs against t0's synthetic indices. Both sides are synthetic, so the inflation is a property of the synthetic generation, specifically the index volatility envelope: `nifty_50_tri` realised vol is 0.0875 with a worst month of -5.3%, where a real Nifty would carry roughly 0.18 with a -23% month. By `beta = corr * vol_fund / vol_index`, a synthetic index that is too smooth pushes beta up. The benchmark-mismatch (broad 500 versus a cap-blend) is a second, smaller contributor that the World A blend already addresses; the dominant driver is the synthetic index vol.

The honest limit, stronger than the prior audits stated: because **both** series are synthetic, this snapshot cannot tell us what the beta would be on real data. ADR-0014's note that "production data with real historical index volatility would yield beta values in conventional ranges" is the design team's expectation, not a measured fact, and it is unverifiable here. So the rescale (2-lite-B) is a **cosmetic normalization of synthetic betas**: it makes the synthetic numbers look believable, but it does not make them real, and only real data (Option 2) yields real betas. The believability concern is not a phantom (the synthetic betas genuinely read as implausible), but the fix is appearance, not truth. That distinction should be explicit when the primary chooses.

## 5. Corrections the prior audits need (appends, not edits; specify, do not write)

- **`2026-05-31_snapshot_provenance_beta_origin.md`:** append a correction that the "regression reproduces the stored betas to four decimals, therefore the NAV is the regenerated series" argument is circular and is withdrawn; the valid proof that t0's series are synthetic is the absence of the March 2020 COVID crash and the -5% to -10% worst-month ceiling. The audit's **conclusion** (cross-section real, monthly series synthetic) stands and is now correctly proven. Add that the loader reads the enriched suite, distinct from the colleague source.
- **`2026-05-31_synthetic_data_cost_strategic.md` and `2026-05-31_rescale_verification_and_design.md`:** append that the synthetic-series diagnosis is now confirmed by the COVID test (not the withdrawn circular argument), and that the rescale is a cosmetic normalization of confirmed-synthetic betas, not a route to real betas; phrasings that read as a flat "t0 is synthetic" should be sharpened to "t0's monthly series are synthetic; its cross-section is real-sourced," to sit correctly beside the primary's verified cross-section finding. The $0 prose-reuse verification is a fact about the prose and is unaffected.
- **`2026-05-31_client_weighted_benchmark.md` and `2026-05-31_jensens_alpha_and_beta_levering.md`:** no correction needed. They concern the mechanism (World A blend, Jensen's), which is data-agnostic and makes no real-versus-synthetic claim.

## 6. The reconciliation the primary should run

The data is unambiguous, so the open question is why it diverges from the primary's source-comparison. A single concrete check settles it: **look at March 2020 in the colleague-supplied JSON.** If the colleague file shows the real -23% crash, then the colleague source is real and the **enrichment replaced its monthly series with synthetic ones** (the pipeline loads the enriched derivative, not the source); the fix is to decide whether real monthly series should flow through instead. If the colleague file also shows the smooth +4%, then the monthly series were synthetic before the handoff and "Bloomberg-sourced" applies to the cross-section only. Either way, the betas the five cases use are synthetic today.

This audit re-grounds the facts and recommends corrections; it changes no data and writes no appends. The build stays parked at the Phase 2 stop, the back-fill tooling uncommitted, awaiting the primary's reconciliation and direction.
