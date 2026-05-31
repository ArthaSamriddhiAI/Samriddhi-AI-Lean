# Snapshot provenance for the five Samriddhi 2 cases and the origin of the elevated betas

**Date:** 2026-05-31
**Branch:** `features/client-weighted-benchmark` (build held at the Phase 2 hard stop; capability committed at `acb6125`, no fixture written, back-fill tooling staged but uncommitted).
**Mode:** Read-only diagnostic, run inside the Phase 2 pause. No agent logic, no snapshot edits, no fixtures, no debt or ADR codification. This document is the only write.
**Conventions:** WA2 (codebase and data win over memory), WA21 (quote as evidence), WA27 (repo-relative paths), WA7 (no long dashes), WA22 (versioned audit).

**First-move call:** new dated `docs/audits/` file, not a chat-only finding. The provenance answer is load-bearing for the narration decision and will be cited by it (and by any debt entry the build's Phase 5 writes), so it belongs in the durable, citable audit corpus, consistent with the one-file-per-audit convention.

---

## Verdict: World 1 (synthetic). The elevated beta is a documented dev-phase artifact.

The five Samriddhi 2 cases run on the `t0_q2_2026` baseline snapshot, whose monthly NAV and index series are **synthetic by construction**: the canonical indices are synthesized (ADR-0009) and the evaluable funds' `monthly_nav` is regenerated as a single-factor series anchored to those synthetic indices (ADR-0014). The ~1.5 betas are not a real property of these funds; they are the direct, documented, and predicted consequence of the synthetic indices carrying a tighter volatility envelope than real index data. ADR-0014 states this in terms and says production data with real index volatility would yield conventional betas. So the narration should own the elevated beta as a dev-phase property that real data would change, with the synthetic-data caveat, not as a permanent truth about these funds.

The primary's recollection is confirmed and sharpened on one point: the decision to synthesize is documented (ADR-0009 and ADR-0014, with ADR-0007 and ADR-0008 upstream), so there is no undocumented-provenance gap. The refinement to the "initial snapshot is real, later ones synthetic" model: the t0 cross-sectional snapshot is source-identical, but the monthly time series a beta is computed over are synthetic even at t0.

---

## 1. Which snapshot the five cases load

**Audited.** All five Samriddhi 2 case fixtures carry `snapshotId: "t0_q2_2026"`:

- `db/fixtures/cases/c-2026-05-14-bhatt-01.json`, `db/fixtures/cases/c-2026-05-15-iyengar-01.json`, `db/fixtures/cases/c-2026-05-15-malhotra-01.json`, `db/fixtures/cases/c-2026-05-15-menon-01.json`, `db/fixtures/cases/c-2026-05-15-surana-01.json`, all `snapshotId=t0_q2_2026`.

The load path: `loadSnapshot(snapshotId)` builds `path.join(SNAPSHOTS_DIR, ...)` where `SNAPSHOTS_DIR = path.resolve(process.cwd(), "fixtures", "snapshots", "enriched")` (`lib/agents/snapshot-loader.ts:26`) and the file is `snapshot_${snapshotId}.json` (`:214`). `fixtures/snapshots/enriched` is a git-ignored symlink to the private data repo:

```
fixtures/snapshots/enriched -> .../17 - Claude Code Local Workflow - Samriddhi AI Data Snapshots - main branch/snapshots
```

So the real file is `snapshots/snapshot_t0_q2_2026.json` in the sibling private repo `Samriddhi-AI-Data-Snapshots` (sha256 `556e520f...` per that repo's `manifest.json`). All five cases regress over the 84-month series (2019-05 to 2026-04) in that one file.

## 2. Real or synthetic series

**Audited: synthetic series, real-sourced cross-section.** The split matters because a beta is a property of the series, not the t0 anchor.

- **Cross-sectional data is real-world-sourced.** The data repo's `README.md` describes "the real-world-sourced data assets" (Nifty 500 fundamentals, ~1,773 MFs, PMS/AIF metadata, macro), and the per-fund canonical stats (`vol_3y`, `sharpe_3y`) are preserved from source. This is the "real data" layer the primary remembers.

- **The monthly index series are synthesized.** ADR-0009 (`docs/decisions/0009_snapshot_index_synthesis_and_set.md`) synthesizes all 16 canonical indices: the 9 equity TRIs by `derive_from_constituents` ("Market-cap-weighted average of constituent monthly returns from the synthesized Nifty 500 universe", `:43-44`), the 5 debt indices by `synthesize_duration_model` (per-month Gaussian draws with stated drift and vol, e.g. `crisil_short_term_bond: drift 7.0%, vol 0.5%`, `:57-63`). "Real historical data for indices" was explicitly considered and rejected (`:100-101`).

- **The funds' `monthly_nav` is regenerated.** ADR-0014 (`docs/decisions/0014_fund_nav_regenerated_for_index_comovement.md`) regenerates "the index-overlap portion of `mf_funds[].monthly_nav` ... as a single-factor series on the resolved benchmark `B`" (`:13`), `r_F[t] = alpha + beta * r_B[t] + e[t]` with seeded noise. It "holds across all nine snapshots t0..t8" (`:31`), and validation confirms "all 857 regenerated funds in t0" (`:27`). The negative consequence is stated plainly: "source-history fidelity for funds is intentionally traded away (a query for a fund's real 2020 NAV path now returns a synthesised path) ... Accepted for a dev-phase artifact: production replaces the regeneration with real fund NAV and real index data" (`:58`).

- **The t0 metadata wording reconciled.** `snapshot_metadata.generation_notes` reads "Baseline snapshot, identical to source" with `evolution_type: "baseline"` and `evolved_fields: []`. That "identical to source" describes the t0-versus-t1..t8 evolution baseline (t0 evolves nothing), not real-versus-regenerated: the regeneration (ADR-0014) is upstream of that baseline, so the "source" the t0 baseline equals already carries the regenerated NAV. Empirical confirmation below removes any doubt.

So the primary's "t0 is real" holds for the cross-section but not for the monthly NAV and index series, which are synthetic at t0 by design. t1..t8 add synthetic forward steps on top (the `is_synthetic_forward` disclosure, ADR-0019); the five cases sit at t0 and still read synthetic series.

## 3. Where the ~14% vs ~8.5% vol gap comes from

**Audited: introduced by the synthetic generation, and named in the decision record.** ADR-0014's beta-interpretation note (`docs/decisions/0014_fund_nav_regenerated_for_index_comovement.md:33-35`), quoted verbatim:

> "Beta values for equity funds in the regenerated NAV run elevated relative to typical real-world expectations because the synthesised canonical indices use a tighter volatility envelope than real historical index data would show. Given Option A's preservation of each fund's own `vol_3y`, and given the algebraic identity `beta = sqrt(R-squared) * (vol_fund / vol_index)`, beta floats upward to maintain variance consistency. The qualitative signal (R-squared-controlled co-movement) is the load-bearing piece; absolute beta values in dev-phase data are not directly interpretable in real-world terms. Production data with real historical index volatility would yield beta values in conventional ranges."

This is the exact mechanism the Phase 2 steelman inferred, now confirmed from the record. The fund `vol_3y` is preserved (real-ish, ~14%); the synthetic indices carry a deliberately tighter vol envelope (~8.5% for `nifty_100`); so `beta = sqrt(R2) * vol_fund / vol_index` lands near 1.5. The header of that ADR section is itself "read this before treating an elevated beta as a bug", which matches the Phase 2 conclusion that this is not a computation error.

Empirical corroboration from the loaded t0 file (measured this session, then removed): annualised vols are `nifty_100_tri` 0.0845, `nifty_50_tri` 0.0875, `nifty_smallcap_250_tri` 0.1313, against fund NAV vols around 0.14 (Axis Large Cap 0.1409, Mirae 0.1442, SBI Small Cap 0.1552). And my regression reproduces the snapshot's stored, ADR-0014-calibrated betas to four decimals on the same benchmark (Axis Large Cap stored 1.466 vs computed 1.4660; Mirae 1.5243 vs 1.5243; SBI Small Cap 1.0204 vs 1.0204; Parag Parikh 1.1468 vs 1.1468). The exact match proves the loaded `monthly_nav` is the regenerated single-factor series, not a real path, since only the regenerated series reproduces the calibrated beta by construction.

So the vol gap, and therefore the ~1.5 beta, is a synthetic artifact of the index synthesis (low envelope) plus the NAV regeneration (fund vol preserved). It is not a real fund property.

## 4. The decision record

**Audited: the synthesize-and-regenerate decision is documented; there is no undocumented-provenance gap on the beta-relevant axis.**

- ADR-0009 (`docs/decisions/0009_snapshot_index_synthesis_and_set.md`): synthesizes the indices; rejects real historical indices.
- ADR-0014 (`docs/decisions/0014_fund_nav_regenerated_for_index_comovement.md`): regenerates fund NAV for index co-movement; documents the elevated-beta consequence and the production-differs caveat; supersedes ADR-0007's source-NAV preservation for funds.
- Upstream: ADR-0007 (synthesis and freeze posture) and ADR-0008 (stock price synthesis), both referenced by ADR-0014.
- The synthetic-forward layer for t1..t8 is ADR-0019 (the synthetic-forward disclosure the risk-reward agent already emits).

The data repo's own assembly methodology is a documented placeholder (its `docs/methodology/README.md` is "a placeholder pending the methodology-documentation workstream tracked as DM2", and `docs/debt/DATA_DEBT_LOG.md` DM2 records that "the assembly methodology ... is not currently documented in a reproducible form"). That DM2 gap is about per-block source-and-cleaning provenance, not the synthesize-and-regenerate decision, which is documented in the ADRs above. So no new debt entry is warranted for an undocumented provenance decision; DM2 is the existing, logged, and separate methodology-reproducibility gap.

---

## What this means for the pending narration decision (informing only, not deciding)

This diagnostic does not propose wording (the primary's call). It establishes the fact the wording rests on: the elevated beta is a dev-phase synthetic property, and ADR-0014 already commits in writing that real production data would move it toward conventional ranges. So an honest narration can carry the "real data would differ" caveat with a direct citation, rather than presenting ~1.5 as a permanent fund truth or asserting the contradicted "beta near 1 is structural." The mechanism, the math, and the locked design are not reopened here; only the data-provenance question the narration depends on is answered.
