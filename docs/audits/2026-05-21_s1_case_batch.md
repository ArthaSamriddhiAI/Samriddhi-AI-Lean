# Samriddhi 1 case batch: workstream audit (2026-05-21)

Workstream `s1-case-generation`. Authors the first five generated Samriddhi 1 (proposal-evaluation) case fixtures, one per investor archetype 01-05, against an enriched pipeline. Shape: Case Generation, expanded with a Phase 1 pipeline-enrichment step (closer to Capability Phase). Branch deviation from Plan v8 documented in ADR-0022.

## 1. Existing-coverage audit (carried forward)

From the prior repo audit: before this batch there were zero generated Samriddhi 1 cases for investors 01-05. All of their existing fixtures are `workflow: s2` (diagnostic). The only `s1` fixture was `c-2026-05-14-sharma-01` (Sharma + Marcellus), which is structural scaffolding (hand-assembled from `sharma_marcellus_evidence_verdicts.md`), not a generated case. So this batch creates the first generated Samriddhi 1 coverage.

## 2. Phase 1: E1/E2 scope-builder enrichment + G1 fix

- **Scope-builders** (`lib/agents/case/scope-builders.ts`, ADR-0024): E1/E2 receive data-grounded scope from the enriched snapshot (nifty500 per-stock fundamentals; mf_funds top-5 holdings/sectors and fund-level P/E, P/B, Beta), source-labeled, honest about coverage misses, with the PMS/AIF look-through limitation per foundation.md:198. E2 carries a no-supplementation guardrail (DP2) that fires when sector data is absent.
- **G1 fix** (ADR-0025): added `mutual_fund_debt` target category mapped to Debt, so debt-MF proposals are not mis-modeled as adding equity.
- **Tests:** `_verify-scope-builders.ts` (9, no API) and `_verify-g1-target-class.ts` (2, no API) pass. Typecheck clean.

## 3. Findings

**Architectural finding: Samriddhi 1 evidence-agent activation is action-centric.** Prior framing in ideation-chat workstream materials assumed E1/E2 fire on existing-holdings for all Samriddhi 1 cases; the live pipeline implements action-centric routing in `routeProposedAction()` (router.ts:195) which explicitly does not consult holdings. The architecture produces naturally differentiated evidence packs by proposal type (PMS/equity proposals exercise E1/E2 deeply; debt proposals lean on E3/E4/E7; AIF proposals lean on E6). This is documented in ADR-0024 and reflected in ADR-0023's per-case coverage table. Future case batches benefit from the corrected mental model; future routing-touching workstreams should preserve this property deliberately.

**Snapshot coverage realities.** The enriched snapshot covers 220 of 1,773 funds with top-5 holdings and 160 with top-5 sectors. The workhorse funds the seeded investors hold (Axis Large Cap, ICICI Pru Balanced Advantage, Mirae, Parag Parikh, SBI Small Cap, Franklin Corp Debt) carry no top-5 look-through, so MF look-through resolves to fund-level metrics plus an honest "not disclosed" note; direct listed equity (Reliance, HDFC Bank, ITC) resolves to full per-stock fundamentals. Honest coverage, not a gap.

**Pipeline gaps logged as debt.** G2 returns `requires_clarification` for every MF target (SEBI MF scheme rules not curated; P25, with a mandatory re-fire protocol). G1 `target_category` enum is incomplete beyond `mutual_fund_debt` (P26). Samriddhi 1 coverage for investors 06-13 and ESOP scenarios deferred (P27).

**IC1-skip currently unreachable.** Because every MF target trips G2 clarify and wrappers trip materiality, no plausible Samriddhi 1 proposal in the current pipeline state skips IC1. All five cases fire IC1 (the honest output); IC1-skip is an architectural property that becomes demonstrable once the G2 MF curation (P25) lands. See ADR-0023.

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

To be filled as each case runs (verdict, confidence, materiality triggers, IC1 flavor, gate statuses, agents fired, tokens, INR, anomalies).

| Case | Verdict (conf) | Materiality | IC1 | Gates (G1/G2/G3) | Agents fired | Tokens (in/out) | INR | Notes |
|---|---|---|---|---|---|---|---|---|
| Iyengar | _pending_ | | | | | | | |
| Surana | _pending_ | | | | | | | |
| Malhotra | _pending_ | | | | | | | |
| Menon | _pending_ | | | | | | | |
| Bhatt | _pending_ | | | | | | | |

## 7. Post-batch cost summary

To be filled after case 5 (actual aggregate tokens + INR versus the Section 4 estimate).

## 8. Operational notes

- **max_tokens tuning:** the enriched evidence makes S1 synthesis output exceed the skill-default `s1_case_mode` cap of 4500 (first dry-run failed there at 4660 output). Raised `s1_case_mode` to 9000 and the A1 / IC1 caps proactively in `LEAN_RUNTIME_OVERRIDES`; raising a cap does not increase spend.
- **Run env:** live runs use `set -a; source .env; set +a; env -u ANTHROPIC_BASE_URL -u ANTHROPIC_API_KEY npx tsx scripts/generate-s1-batch.ts <slug>` so the SDK uses the saved `settings.apiKey` against the default endpoint (the harness proxy var is unset).
- **Stub recording:** `.env.local` sets `STUB_RECORD=true`, so the 16-file stub set per case records automatically under `fixtures/stub-responses/<case-id>/` during the live run.
