# ADR 0042: Real-data t0 restoration (reverses ADR-0014's NAV regeneration)

## Status

Accepted. Implemented in the T-5.14 Option B build (`scripts/build_real_t0.py`) and landed as data-repo `v2.0.0` (real t0 on the canonical filename; synthetic preserved at `v1.0.0-frozen`). Reverses ADR-0014; restores the ADR-0007 posture (preserve real fund NAVs) on the real-data foundation.

## Context

ADR-0014 regenerated fund `monthly_nav` so it would co-move with the synthesised canonical indices, because the real source NAVs had "no engineered relationship to the synthesised indices" (a Sensex ETF versus the synthesised Sensex TRI returned R-squared about 0.01). That was a correct fix for a synthetic world: with fabricated indices (ADR-0009) and real NAVs, benchmark-relative statistics were noise, so the NAVs were regenerated to match the fabrication. The cost, recorded honestly in ADR-0014, was discarding real fund history.

The data foundation has since changed. The T-5.14 Option B build sourced real Bloomberg data: real equity total-return indices (Nifty 50/100/500/Midcap150/Smallcap250/Bank), real FX and direct-stock prices, a yield-to-TR debt grid (ADR-0041), and real fund monthly NAVs from the curated colleague source. With REAL indices, the real NAVs co-move naturally, because they are the same real market; the R-squared-0.01 pathology was an artifact of the synthetic indices, not of the real NAVs. So ADR-0014's root cause is gone, and its regeneration is no longer needed; keeping it would discard real history for no benefit.

The believability evidence is decisive. On the synthetic foundation, the composition-matched (World A) portfolio betas came back about 1.39 to 1.51, implausible for a benchmark blended to match the portfolio's own composition. On the real foundation, the same cases land at 0.84 to 0.94, the structural near-1 the design predicts, with per-holding betas correcting from about 1.5 to believable sub-1 values (e.g. a large-cap fund versus Nifty 50 from 1.52 to 0.97, with R-squared rising from 0.86 to 0.98 because real NAVs track their benchmarks more tightly than the regenerated synthetic ones did).

## Decision

- **Reverse ADR-0014 (funds-only NAV regeneration).** Real fund `monthly_nav` (the curated colleague source) flows through into t0, bypassing the regeneration. This restores the ADR-0007 posture (preserve real source NAVs), which ADR-0014 had superseded; the methodology assumption ADR-0007 rested on (source NAV is comparable to the index) now holds because the index is real.
- **Restore real data across t0.** Real equity TRIs, FX, and direct-stock prices (Bloomberg); the yield-to-TR debt grid superseding the synthetic ADR-0009 debt indices (ADR-0041); real Nifty 1D Overnight for cash; per-instrument `tier_b_stats` recomputed on the real series with the canonical convention and calendar-aligned benchmark-relative statistics (matching the risk-reward layer, ADR-0015).
- **New permanent data version.** Real t0 lands as data-repo `v2.0.0` on the canonical filename; the synthetic baseline is preserved at the `v1.0.0-frozen` tag and in history (additive, never destructive). Provenance is stamped in the snapshot (`snapshot_metadata.real_data_build`), the manifest, and the data-repo `docs/methodology/real_t0_v2_provenance.md`.

## Scope and what is NOT reversed

- **Synthetic stock prices and indices were the right call for their world; the real pulls supersede them, not "undo" them.** ADR-0008/0009 stand as the record of the synthetic baseline; this ADR moves the foundation to real data, it does not retroactively fault the synthetic build.
- **The successors t1..t8 stay synthetic forward-projections** (regime-test artifacts, not forecasts; ADR-0020), pending a separate deterministic re-derivation forward from real t0. The forward path is synthetic by design (real future data does not exist); only the t0 anchor is real here.
- **ADR-0015 (calendar-aligned recompute) is unchanged and reinforced**: it is the convention the real-data tier_b and the World A benchmark-relative statistics use.

## Consequences

- **Real history is restored.** Fund NAVs carry the actual market's path (real drawdowns, real co-movement), correcting the smooth synthetic series ADR-0014 produced.
- **The capability is believable.** The client-weighted benchmark, which read broken on synthetic data, produces advisor-trustworthy betas on real data; the five Samriddhi 2 cases were re-fired on real t0 with every number traced to the deterministic layer.
- **A data-version boundary now exists.** Consumers pin `v2.0.0` (real t0) versus `v1.0.0-frozen` (synthetic); the manifest's SHA256 and provenance make the boundary explicit and reproducible.

## References

- ADR-0007 (preserve real source NAVs; the posture this restores).
- ADR-0014 (regenerate fund NAVs for index co-movement; the decision this reverses). Its status is annotated to point here.
- ADR-0008, ADR-0009 (synthetic stock/index synthesis; superseded by the real pulls, recorded not faulted).
- ADR-0015 (calendar-aligned fund benchmark recompute; unchanged, the convention the real tier_b uses).
- ADR-0041 (yield-to-TR debt conversion and synthetic-debt supersession; the debt half of this restoration).
- ADR-0020 (synthetic-forward disclosure; the successors t1..t8 stay synthetic pending re-derivation).
- `docs/audits/2026-06-02_data_repo_structure_clean.md` (the v2.0.0 data-version plan); data repo `docs/methodology/real_t0_v2_provenance.md` (provenance).
