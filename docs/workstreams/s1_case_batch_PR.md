# PR: Samriddhi 1 case batch (investors 01-05) + E1/E2/E6/E7 scope-builder enrichment

Branch `s1-case-generation` (base `640644f`). The first five generated Samriddhi 1 (proposal-evaluation) case fixtures, plus the pipeline enrichment they required to produce data-grounded evidence.

## Summary

- Authors five Samriddhi 1 cases (one per investor 01-05): Iyengar, Surana, Malhotra, Menon, Bhatt. The Sharma + Marcellus fixture remains the structural scaffolding; these are the first generated cases.
- Enriches the E1/E2/E6/E7 case-mode scope-builders to read the enriched snapshot (data-only, source-labeled, honest-miss, no-supplementation guardrail), replacing one-sentence templated scope that had agents supplementing fund-level figures from model knowledge.
- Adds the `mutual_fund_debt` target category so debt MFs model as Debt in G1.
- Ran live, sequentially, with per-case commits and recorded stub sets, on the saved `settings.apiKey`.

## What shipped

**Phase 1 (ADR-0024, ADR-0025):** `lib/agents/case/scope-builders.ts` (E1/E2 builders), `snapshot-loader.ts` types, `pipeline-case.ts` wiring, `skill-loader.ts` max_tokens overrides for the enriched evidence, G1 `mutual_fund_debt` (proposal.ts, g1-mandate.ts, g2-sebi.ts). Tests `_verify-scope-builders.ts` (9), `_verify-g1-target-class.ts` (2).

**Phase 1.5 (ADR-0026):** `buildE6Scope` / `buildE7Scope` (PMS/AIF and mutual-fund target enrichment from `pms.funds`, `aif["E6 Agent Input Ready"]`, `mf_funds`; token-overlap matcher for wrapper names). Test `_verify-e6-e7-scope-builders.ts` (7). Surana and Bhatt re-picked to snapshot-covered instruments; Menon Cat II AIF honest-misses.

**Phase 2:** five case fixtures in `db/fixtures/cases/c-2026-05-21-*.json` + per-case stub sets under `fixtures/stub-responses/`. `db/seed.ts` auto-globs the cases dir, so the new fixtures register without an edit (verified by `db:seed`).

**Docs / governance:** WA13 (Samriddhi 1/2 naming), ADR-0022 (branch deviation), ADR-0023 (scenario design), ADR-0024/0025/0026 (enrichment + G1), the workstream audit doc, this PR body, and the hand-off note. Debt: P25 (G2 MF curation, with re-fire protocol), P26 (G1 enum coverage), P27 (investors 06-13), D9 (AIF Cat II coverage), T14 (E2 thematic supplementation).

## Outcomes (all five fire IC1; matrix values were directional)

| Case | Verdict | Note |
|---|---|---|
| Iyengar | requires_clarification (0.72) | small-ticket mandate-gap clarification; E7 grounded |
| Surana | positive_with_caveat (0.70) | support flavor, ticket-only materiality; residual equity gap |
| Malhotra | requires_clarification (0.62) | first PMS; E6 grounded Stallion; E2 guardrail held |
| Menon | requires_clarification (0.70, risk high) | E6 honest-miss on absent Cat II AIF; honest G1 cash/equity breach |
| Bhatt | negative (0.82) | engineered decline achieved decisively; E1 richly grounded |

## Architectural finding

Samriddhi 1 evidence activation is **action-centric** (`routeProposedAction` does not consult holdings), so E1/E2 fire only on equity-look-through proposals (Malhotra, Bhatt here). Documented in ADR-0024; corrects a prior assumption.

## Test plan

- [x] `npm run typecheck`
- [x] `_verify-scope-builders.ts`, `_verify-g1-target-class.ts`, `_verify-e6-e7-scope-builders.ts` (no API)
- [x] `npm run db:seed` round-trips 12 fixtures (7 existing + 5 new)
- [x] Per-case sanity: E1/E6/E7 figures trace to the snapshot (no contradiction); E2 guardrail; honest-miss confirmed where data absent; G1 debt modeling correct
- [ ] Reviewer visual review of the five fixtures' briefing/verdict content

## Post-merge dependency

When the **G2 MF scheme-rule curation** workstream (P25) lands, re-fire the MF-target fixtures (iyengar, surana) per the re-fire protocol in P25 (clear, re-run, overwrite, re-record stubs; no surgical injection).

## Notes

- Per-case runtime ~6.5 to 8.5 min; recorded S1+A1+IC1 cost ~Rs 1,410, total workstream spend ~Rs 2,400-2,700 (audit doc Section 7).
- Two within-batch corrections (Surana funding source `cash_balance` to `fresh_inflow`; Iyengar/Surana re-fired post-enrichment) and the honest divergences (Menon/Surana G1 on pre-existing breaches; Bhatt landed full negative) are documented in the audit doc.
