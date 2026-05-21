# Samriddhi 1 case batch: workstream audit (2026-05-21)

Workstream `s1-case-generation`. Authors the first five generated Samriddhi 1 (proposal-evaluation) case fixtures, one per investor archetype 01-05, against an enriched pipeline. Shape: Case Generation, expanded with a Phase 1 pipeline-enrichment step (closer to Capability Phase). Branch deviation from Plan v8 documented in ADR-0022.

## 1. Existing-coverage audit (carried forward)

From the prior repo audit: before this batch there were zero generated Samriddhi 1 cases for investors 01-05. All of their existing fixtures are `workflow: s2` (diagnostic). The only `s1` fixture was `c-2026-05-14-sharma-01` (Sharma + Marcellus), which is structural scaffolding (hand-assembled from `sharma_marcellus_evidence_verdicts.md`), not a generated case. So this batch creates the first generated Samriddhi 1 coverage.

## 2. Phase 1: E1/E2 scope-builder enrichment + G1 fix

- **Scope-builders** (`lib/agents/case/scope-builders.ts`, ADR-0024): E1/E2 receive data-grounded scope from the enriched snapshot (nifty500 per-stock fundamentals; mf_funds top-5 holdings/sectors and fund-level P/E, P/B, Beta), source-labeled, honest about coverage misses, with the PMS/AIF look-through limitation per foundation.md:198. E2 carries a no-supplementation guardrail (DP2) that fires when sector data is absent.
- **G1 fix** (ADR-0025): added `mutual_fund_debt` target category mapped to Debt, so debt-MF proposals are not mis-modeled as adding equity.
- **Phase 1.5 (ADR-0026):** `buildE6Scope` and `buildE7Scope` extend the same pattern to the wrapper (PMS/AIF) and mutual-fund agents, which were also model-knowledge-supplementing (E7 cited an AUM contradicting the snapshot on the first Iyengar run). They read `pms.funds`, `aif["E6 Agent Input Ready"]`, and `mf_funds`, with a token-overlap matcher for noisy wrapper names, honest-miss for uncovered instruments, and the no-supplementation guardrail. Surana's debt sleeve lead (to Kotak Bond Short Term Plan) and Bhatt's PMS (to Ambit Build India) were re-picked to snapshot-covered instruments; Menon's Cat II private credit AIF honest-misses (D9).
- **Tests:** `_verify-scope-builders.ts` (9), `_verify-g1-target-class.ts` (2), and `_verify-e6-e7-scope-builders.ts` (7) all pass (no API). Typecheck clean. `npm run db:seed` round-trips 12 fixtures (7 existing + 5 new).

## 3. Findings

**Architectural finding: Samriddhi 1 evidence-agent activation is action-centric.** Prior framing in ideation-chat workstream materials assumed E1/E2 fire on existing-holdings for all Samriddhi 1 cases; the live pipeline implements action-centric routing in `routeProposedAction()` (router.ts:195) which explicitly does not consult holdings. The architecture produces naturally differentiated evidence packs by proposal type (PMS/equity proposals exercise E1/E2 deeply; debt proposals lean on E3/E4/E7; AIF proposals lean on E6). This is documented in ADR-0024 and reflected in ADR-0023's per-case coverage table. Future case batches benefit from the corrected mental model; future routing-touching workstreams should preserve this property deliberately.

**Snapshot coverage realities.** The enriched snapshot covers 220 of 1,773 funds with top-5 holdings and 160 with top-5 sectors. The workhorse funds the seeded investors hold (Axis Large Cap, ICICI Pru Balanced Advantage, Mirae, Parag Parikh, SBI Small Cap, Franklin Corp Debt) carry no top-5 look-through, so MF look-through resolves to fund-level metrics plus an honest "not disclosed" note; direct listed equity (Reliance, HDFC Bank, ITC) resolves to full per-stock fundamentals. Honest coverage, not a gap.

**Pipeline gaps logged as debt.** G2 returns `requires_clarification` for every MF target (SEBI MF scheme rules not curated; P25, with a mandatory re-fire protocol). G1 `target_category` enum is incomplete beyond `mutual_fund_debt` (P26). Samriddhi 1 coverage for investors 06-13 and ESOP scenarios deferred (P27).

**IC1-skip currently unreachable.** Because every MF target trips G2 clarify and wrappers trip materiality, no plausible Samriddhi 1 proposal in the current pipeline state skips IC1. All five cases fire IC1 (the honest output); IC1-skip is an architectural property that becomes demonstrable once the G2 MF curation (P25) lands. See ADR-0023.

**E2 guardrail is effective for fund sector-weights, partial for thematic industry context.** The DP2 guardrail reliably stopped E2 inventing fund sector weights (Iyengar and Malhotra E2 state "sector data not available"). For a strongly thematic PMS target (Bhatt's Ambit Build India, infrastructure), E2 still brought model-knowledge industry context (Budget capex, L&T figures) because its skill is directive about industry analysis. Accepted for this batch and logged as T14, per the pre-agreed disposition; moderate (labeled, plausible, non-contradicting, not verdict-driving), unlike the E7 AUM contradiction which was a hard fix.

**The mandate gate evaluates absolute post-action compliance, not direction of travel.** Surana and Menon both land G1 breaches on pre-existing over-concentration (Surana's residual equity ~78.5%, Menon's 86.6% cash) that their proposals improve but do not resolve. The gate does not credit a proposal for moving toward compliance; a sensible incremental fix for a far-out-of-band portfolio still trips G1. This is honest and arguably correct (the advisor should know the proposal is a step, not a full fix), but it is a product-stance observation worth surfacing: a future "direction-of-travel" gate refinement could distinguish "this breaches" from "this reduces an existing breach." Not in scope here; noted for the Slice 7 product-debt audit.

**Single-tag funding source.** The Proposal schema carries one `source_of_funds`. Surana's Rs 5 Cr (founder distribution, not a drain on his ~Rs 1.5 Cr cash) was initially mis-tagged `cash_balance`, producing a spurious negative-cash G1 breach; corrected to `fresh_inflow`. The single-tag schema cannot express blended funding (cash + fresh inflow); document the dominant source and verify the G1 funding model does not produce an impossible-funding artifact.

**Minor data observations.** E1 surfaced HDFC Bank's `nifty500` ROCE of 751% (a banking-sector computation artefact) on the Bhatt case and correctly labeled it as such rather than treating it as a real signal. The new `mutual_fund_debt` category is not in M0.IndianContext's `eligible_products` list, so it raised a benign `str_007` structural-eligibility flag on the debt-MF cases (mutual funds are eligible for residents; the flag is a category-name gap in the curated YAML, not a real ineligibility). Both are low-stakes; noted for a future fixture/YAML refresh.

## 4. Pre-run cost estimate

Models (per skill frontmatter + `LEAN_RUNTIME_OVERRIDES`): evidence agents E1-E7 run on Sonnet; S1 case-mode, A1, and the four senior IC1 roles run on Opus; IC1 minutes on Haiku; router / IndianContext / materiality / gates are deterministic (no LLM). Grounded on the Iyengar dry-runs (S1 ~20.8k in / 4.6k out; A1 ~24k / 3k; each Opus IC1 role ~20-23k in / 1-2.7k out). Estimated ~Rs 250-350 per IC1-firing case; all five fire IC1, so the batch is roughly **Rs 1,300-1,800** (about USD 16-22), plus the dry-runs already spent and any retries. Cost is not the binding constraint; the binding constraint is per-case runtime (~7-8 minutes).

## 5. Scenario matrix

| # | Investor | Ticket | Horizon | Vehicle (target_category) | E1/E2 | Expected outcome |
|---|---|---|---|---|---|---|
| 1 | Iyengar | Rs 50 L | 3Y | ICICI Pru Corporate Bond Fund (`mutual_fund_debt`) | No | requires_clarification (mandate-gap) |
| 2 | Surana | Rs 5 Cr | 7Y | Debt sleeve (`mutual_fund_debt`) | No | requires_clarification / support |
| 3 | Malhotra | Rs 1 Cr | 7Y | Stallion Asset Core PMS (`pms`) | Yes | requires_clarification |
| 4 | Menon | Rs 5 Cr | 8Y+ | Vivriti Alpha Debt Cat II AIF (`aif`), snapshot t4_q2_2027 | No | requires_clarification |
| 5 | Bhatt | Rs 2 Cr | 5-7Y | ASK Capital Goods PMS (`pms`) | Yes | requires_clarification (decline-flavored) |

Outcomes are directional targets (ADR-0023). Bhatt may honestly diverge from decline-flavored.

## 6. Per-case actual-versus-expected

All five ran live and committed (one fixture + stub set per commit). All five fire IC1 (as the IC1-skip discussion in ADR-0023 predicted). Run order: Iyengar, Surana, Malhotra, Menon, Bhatt.

| Case | Verdict (conf) | Gates G1/G2/G3 | Agents fired | ~Rs (S1+A1+IC1) | Actual vs expected |
|---|---|---|---|---|---|
| Iyengar | requires_clarification (0.72) | reqclar / reqclar / pass | E3 E4 E7 | ~274 | As expected post-reframe: small-ticket mandate-gap clarification. E7 grounded (AUM Rs 31,712 Cr); E1/E2 skip (debt target). |
| Surana | positive_with_caveat (0.70) | reqclar / reqclar / pass | E3 E4 E7 | ~301 | Matches "support, ticket-only materiality, IC1 light" after the funding-source fix. G1 reqclar on a residual equity gap (~78.5% vs 60-70%). E7 grounded (Kotak). |
| Malhotra | requires_clarification (0.62) | reqclar / pass / pass | E1 E2 E3 E4 E6 E7 | ~313 | As expected. E6 grounded Stallion; E1 grounded MF P/E; E2 guardrail held; G2 pass (PMS ticket). |
| Menon | requires_clarification (0.70, risk high) | fail / pass / pass | E3 E4 E6 | ~241 | Honest divergence from "support with conditions": G1 fail on the genuine post-exit cash/equity breach (one AIF does not resolve 86.6% cash). E6 honest-miss on the absent Cat II AIF (no invented figures). |
| Bhatt | negative (0.82) | reqclar / pass / pass | E1 E2 E3 E4 E6 | ~281 | Decline achieved, more decisively than the matrix's requires_clarification ~0.65 (honest divergence). E1 richly grounded on direct equity; E6 grounded Ambit. E2 industry supplementation logged (T14). |

Two within-batch corrections: Surana's funding source was changed `cash_balance` to `fresh_inflow` (the prior tag produced a spurious negative-cash G1 breach because Rs 5 Cr exceeds his ~Rs 1.5 Cr cash; it is founder distribution); Iyengar and Surana were each run twice (the first runs predate the Phase 1.5 E6/E7 enrichment / the funding fix). Stub sets recorded per case (10 for the debt/AIF cases where E1/E2 skip; 12-13 for the PMS cases).

## 7. Post-batch cost summary

Recorded S1 + A1 + IC1 cost across the five committed fixtures: **~Rs 1,410** (per case ~Rs 241 to 313; INR at roughly USD/84, Opus $15/$75, Sonnet $3/$15, Haiku $1/$5 per million). The E-agent (E1-E7, Sonnet) calls are not captured in `usage_summary` (the orchestrator records only S1, A1, and IC1 tokens, per pipeline-case.ts), so add roughly Rs 60-120 for the Sonnet evidence layer. Including the dry-runs and the two re-fires (Iyengar twice plus the failed first dry-run; Surana twice), total workstream LLM spend is approximately **Rs 2,400 to 2,700 (about USD 29 to 32)**. This is within the Section 4 estimate (Rs 1,300 to 1,800 for the batch proper plus dry-runs/retries). Cost was never the binding constraint; per-case runtime (~6.5 to 8.5 minutes) was.

A note for future telemetry: `usage_summary` omitting the E-agent tokens means the recorded per-case cost understates the true cost by the Sonnet evidence layer. Not fixed here (out of scope); worth a telemetry-completeness pass when the cost record matters.

## 8. Operational notes

- **max_tokens tuning:** the enriched evidence makes S1 synthesis output exceed the skill-default `s1_case_mode` cap of 4500 (first dry-run failed there at 4660 output). Raised `s1_case_mode` to 9000 and the A1 / IC1 caps proactively in `LEAN_RUNTIME_OVERRIDES`; raising a cap does not increase spend.
- **Run env:** live runs use `set -a; source .env; set +a; env -u ANTHROPIC_BASE_URL -u ANTHROPIC_API_KEY npx tsx scripts/generate-s1-batch.ts <slug>` so the SDK uses the saved `settings.apiKey` against the default endpoint (the harness proxy var is unset).
- **Stub recording:** `.env.local` sets `STUB_RECORD=true`, so the 16-file stub set per case records automatically under `fixtures/stub-responses/<case-id>/` during the live run.
