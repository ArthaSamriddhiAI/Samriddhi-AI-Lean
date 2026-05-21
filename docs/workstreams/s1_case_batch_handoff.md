# Samriddhi 1 case batch: cross-workstream hand-off

Workstream `s1-case-generation`. Produced the first five generated Samriddhi 1 (proposal-evaluation) case fixtures (investors 01-05) plus the pipeline enrichment they required. This note carries the conventions, debt, and forward-looking items that propagate beyond the workstream. The workstream-specific detail is in `docs/audits/2026-05-21_s1_case_batch.md`.

## Conventions adopted / reaffirmed

- **WA13 (new): Samriddhi 1 / Samriddhi 2 naming discipline.** Use the full workflow names in prose; reserve "S1" for the synthesis agent. Applied throughout this workstream's artifacts.
- **Branch deviation from Plan v8 (ADR-0022).** Case Generation ran on a feature branch (`s1-case-generation`) with per-commit pushes and a pre-PR pause, not "on main directly." Documented as a deliberate one-off; future Case Generation workstreams inherit the v8 default unless re-decided.
- **Scope-builder pattern now covers E1/E2/E6/E7 (ADR-0024, ADR-0026).** Data-only, source-labeled, honest-miss for uncovered instruments, no-supplementation guardrail. The pattern is the template for any future agent found to model-knowledge-supplement. E3 (macro feed + anti-invention instruction), E4 (the bible), M0.IndianContext (curated YAML), and M0.PortfolioRiskAnalytics (deterministic) were confirmed grounded and not enriched.
- **`mutual_fund_debt` target category (ADR-0025).** Debt MFs model as Debt in G1 while remaining MF for G2 (clarify) and E7 (evaluation). The `target_category` enum is now incomplete-but-correct for the categories in use; extend per P26 as new shapes appear.

## Architectural property to preserve

**Samriddhi 1 evidence activation is action-centric** (`routeProposedAction`, router.ts:195, `void holdings`), unlike the holdings-centric Samriddhi 2 `route()`. E1/E2 fire only when the proposed action involves listed-equity look-through; debt/AIF proposals correctly lean on E3/E4/E6/E7. This produces differentiated evidence packs by proposal type. Future workstreams touching routing should preserve this deliberately (it was an unstated assumption that the first live run corrected).

## Debt surfaced (all originate in this workstream)

- **P25 (High):** G2 returns `requires_clarification` for every MF target (SEBI MF scheme rules not curated). Carries a **mandatory re-fire protocol**: when the G2 MF curation lands, re-fire the MF-target fixtures (iyengar, surana) cleanly (clear case row, re-run, overwrite fixture, re-record stubs); do not surgically inject G2 verdicts. ~Rs 600-800 to re-fire the pair.
- **P26 (Medium):** G1 `target_category` enum incomplete beyond `mutual_fund_debt`; extend as new proposal shapes appear.
- **P27 (Medium):** Samriddhi 1 coverage for investors 06-13 and ESOP scenarios is unbuilt.
- **D9 (Medium):** snapshot `aif` block lacks Cat II private-credit coverage (Menon honest-misses).
- **T14 (Low):** E2 may bring model-knowledge industry context on strongly thematic targets even with the guardrail (accepted per DP2).
- Existing **P1** (NRI/RNOR/HUF) referenced for Menon; not re-logged.

## Forward-looking notes for the next Samriddhi 1 batch (investors 06-13, P27)

- Carry the action-centric routing mental model from the start (do not assume E1/E2 fire on holdings).
- Instrument coverage shapes grounding: choose proposed PMS/MF/AIF instruments that exist in `pms.funds` / `mf_funds` / `aif["E6 Agent Input Ready"]` where you want E6/E7 grounded; otherwise the honest-miss + guardrail keeps the case safe (no fabrication) but thinner.
- All Samriddhi 1 cases fire IC1 in the current pipeline state (IC1-skip unreachable until the G2 MF curation lands, P25/ADR-0023).
- The mandate gate evaluates absolute post-action compliance; far-out-of-band investors (Menon cash, Surana equity) will G1-breach even on sensible incremental proposals. Frame such cases as "a step, clarification warranted."
- If the G2 MF curation (P25) has landed by then, honor the re-fire protocol for the earlier MF-target fixtures.

## Verification

Typecheck clean; `_verify-scope-builders.ts` (9), `_verify-g1-target-class.ts` (2), `_verify-e6-e7-scope-builders.ts` (7) pass with no API; `npm run db:seed` round-trips 12 fixtures.
