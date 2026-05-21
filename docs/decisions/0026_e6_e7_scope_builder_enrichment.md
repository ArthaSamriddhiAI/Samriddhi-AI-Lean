# ADR 0026: E6 / E7 case-mode scope-builder enrichment (Phase 1.5)

## Context

The case 1 (Iyengar) live run showed E7 citing a fund AUM (~Rs 18-20k Cr "estimate") that contradicted the snapshot (Rs 31,712 Cr). The Phase 1.5 audit confirmed the cause is the same scope-builder thinness fixed for E1/E2 in ADR-0024, applied to two more agents: E6 (PMS/AIF wrapper) and E7 (mutual fund) received only a name + category + ticket string and supplemented manager / fee / AUM / returns from model knowledge. The audit also confirmed E3 (rich `macro` block + anti-invention instruction), E4 (the bible), M0.IndianContext (curated YAML), and M0.PortfolioRiskAnalytics (deterministic) are grounded, and IC1 / A1 reason over case state and inherit evidence figures (so fixing E6/E7 fixes the downstream propagation).

This is the second application of the established Phase 1 pattern, not a new pattern.

## Decision

Add `buildE6Scope` and `buildE7Scope` to `lib/agents/case/scope-builders.ts`, mirroring the E1/E2 discipline (data-only, source-labeled, honest about coverage, no-supplementation guardrail). They build the enriched **target** context; the existing wrapper / MF inventory and the post-action arithmetic remain computed deterministically in `pipeline-case.ts`.

- **E7** reads `mf_funds` for the target scheme: SEBI category, AUM, TER, Beta, 1Y/3Y/5Y returns, benchmark, fund managers (name + tenure), exit load, and a couple of `tier_b_stats`, each source-labeled `[source: mf_funds snapshot]`. Reuses the strict name matcher (MF names are clean).
- **E6** reads `pms.funds[]` for a PMS target (manager, category, benchmark, AUM where disclosed, fee structure, performance) and `aif["E6 Agent Input Ready"][]` for an AIF target (category, min investment, management/performance fee, hurdle, manager, redemption). Uses a **token-overlap matcher** (threshold 0.6) because wrapper names carry corporate noise ("Pvt Ltd", "Investment Managers Ltd") and strategy suffixes that defeat the strict substring matcher.
- **Honest-miss:** when the proposed instrument is not in the relevant block, the scope states it explicitly (E7: "fund-level data not available in snapshot"; E6 AIF: "wrapper-level data not available in snapshot for this product class") and instructs the agent to proceed without supplementing. The no-supplementation guardrail is appended in every case.
- Tests: `scripts/_verify-e6-e7-scope-builders.ts` (7 groups, no API).

## Instrument-coverage realities (the product-substantive finding)

E6/E7 grounding requires the proposed instrument to be present in the snapshot. Coverage shaped the picks:

- **Iyengar (ICICI Pru Corporate Bond Fund):** in `mf_funds`. E7 grounds.
- **Malhotra (Stallion Asset Core Fund):** in `pms.funds` as "Stallion Asset Pvt Ltd - Core Fund" (token-overlap 1.0). E6 grounds.
- **Surana: re-picked within the snapshot universe.** The original sleeve lead (HDFC Short Term Debt Fund) is absent from `mf_funds`. Re-picked to **Kotak Bond Short Term Plan** (Short Duration Fund, AUM ~Rs 17,461 Cr, established Kotak debt desk, standard TER), the most plausible covered short-duration lead. Alternatives considered: Aditya Birla Sun Life Short Term Fund (smaller AUM ~Rs 8,590 Cr) and Aditya Birla Sun Life Corporate Bond Fund (corporate-bond, overlaps Iyengar's pick). The sleeve narrative (lead + AAA corporate bond MF + tax-free bond ladder) is unchanged; only the lead name changed. E7 grounds.
- **Bhatt: re-picked within the snapshot universe.** The original pick (an invented ASK Capital Goods PMS) is absent; an earlier audit reported it "FOUND" via a loose substring hit on a different ASK strategy, which the token-overlap matcher correctly rejects (overlap 0.4). Re-picked to **Ambit Build India** (Ambit Global Private Client - Build India, a covered Thematic infrastructure/capital-goods PMS, token-overlap 1.0), which preserves the case's sector-thematic / peer-introduced character and grounds E6. The load-bearing character (a redundant fifth wrapper lifting aggregate exposure ~39% to ~45%) is unchanged.
- **Menon: honest-miss accepted (not re-picked).** A Cat II private-credit AIF (Vivriti Alpha Debt) is absent, and the `aif` block carries mostly Cat I venture / angel / stressed-asset funds; no Cat II private-credit option exists to re-pick to. The Cat II private-credit framing is load-bearing for the case's character, so substituting a Cat I fund would change the case. E6 honest-misses with the guardrail; the case lands on substantive grounds (M0.IndianContext capital-call mechanics, E3 macro, E4 behavioural, synthesis on liquidity carve-out and capital-call timing). The coverage asymmetry is logged as D9.

## Alternatives Considered

- **Enrich only E7 (the one with the proven hallucination), defer E6.** Rejected: E6 has the same shape and is load-bearing for three cases (Malhotra, Bhatt, Menon); fixing both now is the systematic fix the audit recommended.
- **Re-pick Menon to a covered Cat I AIF.** Rejected: it would change the case from a Cat II private-credit deployment to a venture/angel commitment, losing the case's character. Honest-miss preserves it.
- **Token-overlap for MF names too.** Not needed: MF names are clean enough for the strict matcher used in Phase 1; token-overlap is reserved for the noisier PMS/AIF names.

## Consequences

E6 and E7 cite snapshot-grounded, attributable figures for covered instruments and honest-miss (no fabrication) for uncovered ones, so the post-case sanity check can verify "no figures contradict the snapshot" for the wrapper and MF agents too. Surana and Bhatt now reference covered instruments; Iyengar and Malhotra already did; Menon honest-misses by design. Files: `lib/agents/case/scope-builders.ts` (buildE6Scope, buildE7Scope, token matcher), `lib/agents/pipeline-case.ts` (E6/E7 wiring), `scripts/generate-s1-batch.ts` (Surana, Bhatt re-picks), `scripts/_verify-e6-e7-scope-builders.ts` (tests). Cross-references ADR-0024 (Phase 1 pattern), ADR-0025 (G1 enum), D9 (AIF Cat II coverage).
