# Lift Inventory

Audit trail of files lifted into the Lean Samriddhi MVP working folder from external sources. Recorded for provenance so any drift between lean and source can be reconciled later.

## Sources

| Source | Resolved location | Notes |
|---|---|---|
| Factual Foundation folder | `../02 - Factual Foundation/` | The canonical Lean Samriddhi MVP factual contract authored by the user. |
| Full-fat ArthaSamriddhiAI repo, `dev` branch | `https://github.com/ArthaSamriddhiAI/ArthaSamriddhiAI` | Cloned shallow into `/tmp/artha-fullfat/` for inspection. |
| Full-fat dev branch commit at lift time | `4a147ccff2f23f5ed97b0274b367df8dcdd18db2` | "feat(cluster9-stage3): unit tests for shims, cache layer, flag services + phases" |

## Lifted files

### 1. Foundation document (1 file)

| Source path | Destination path | Notes |
|---|---|---|
| `../02 - Factual Foundation/Lean_Samriddhi_MVP_Factual_Foundation.md` | `foundation/foundation.md` | The lean MVP factual contract. Defines the indicative model portfolio, asset class taxonomy, risk taxonomy, concentration thresholds, liquidity buckets, diagnostic vocabulary, the five archetype profiles A1-A5, two onboarding chat transcripts, and the briefing output spec. **Not** the full-fat repo's `foundation_reference_structure.md`, which is a meta-spec for full-fat documentation and not the factual contract. |

### 2. Agent skill files (21 files)

The previous orientation document referenced 23 skill files based on the background inspection agent's summary. The actual count in `/config/skills/` on the dev branch is 21. The discrepancy is benign: the agent counted Boss, Router, Portfolio Risk Analytics, Indian Context, and Stitcher under M0 (5 files, correct), and overcounted by 2 elsewhere. The 21 files below are the complete `/config/skills/` directory.

All files lifted with identical filenames into `agents/`. Each carries a YAML frontmatter block declaring `agent_id`, `skill_md_version`, `llm_model` (claude-opus-4-7 by default), `max_tokens`, `temperature`, and `output_schema_ref`. For the lean MVP, `max_tokens` may be tuned down per-agent for tighter demo latency when the reasoning layer lands; this is a runtime override, not a rewrite of the skill file.

#### Evidence layer (8 files)

| Source path | Destination path |
|---|---|
| `/tmp/artha-fullfat/config/skills/e1_listed_fundamental_equity.md` | `agents/e1_listed_fundamental_equity.md` |
| `/tmp/artha-fullfat/config/skills/e2_industry_business.md` | `agents/e2_industry_business.md` |
| `/tmp/artha-fullfat/config/skills/e3_macro_policy_news.md` | `agents/e3_macro_policy_news.md` |
| `/tmp/artha-fullfat/config/skills/e4_behavioural_historical.md` | `agents/e4_behavioural_historical.md` |
| `/tmp/artha-fullfat/config/skills/e5_unlisted_equity.md` | `agents/e5_unlisted_equity.md` |
| `/tmp/artha-fullfat/config/skills/e6_pms_aif_sif.md` | `agents/e6_pms_aif_sif.md` |
| `/tmp/artha-fullfat/config/skills/e7_mutual_fund.md` | `agents/e7_mutual_fund.md` |
| `/tmp/artha-fullfat/config/skills/a1_challenge.md` | `agents/a1_challenge.md` |

#### Master agent layer (5 files)

| Source path | Destination path |
|---|---|
| `/tmp/artha-fullfat/config/skills/m0_boss.md` | `agents/m0_boss.md` |
| `/tmp/artha-fullfat/config/skills/m0_router.md` | `agents/m0_router.md` |
| `/tmp/artha-fullfat/config/skills/m0_portfolio_risk_analytics.md` | `agents/m0_portfolio_risk_analytics.md` |
| `/tmp/artha-fullfat/config/skills/m0_indian_context.md` | `agents/m0_indian_context.md` |
| `/tmp/artha-fullfat/config/skills/m0_stitcher.md` | `agents/m0_stitcher.md` |

#### Synthesis layer (3 files)

| Source path | Destination path |
|---|---|
| `/tmp/artha-fullfat/config/skills/s1_briefing_mode.md` | `agents/s1_briefing_mode.md` |
| `/tmp/artha-fullfat/config/skills/s1_case_mode.md` | `agents/s1_case_mode.md` |
| `/tmp/artha-fullfat/config/skills/s1_diagnostic_mode.md` | `agents/s1_diagnostic_mode.md` |

#### Investment Committee layer (5 files)

| Source path | Destination path |
|---|---|
| `/tmp/artha-fullfat/config/skills/ic1_chair.md` | `agents/ic1_chair.md` |
| `/tmp/artha-fullfat/config/skills/ic1_devils_advocate.md` | `agents/ic1_devils_advocate.md` |
| `/tmp/artha-fullfat/config/skills/ic1_risk_assessor.md` | `agents/ic1_risk_assessor.md` |
| `/tmp/artha-fullfat/config/skills/ic1_counterfactual_engine.md` | `agents/ic1_counterfactual_engine.md` |
| `/tmp/artha-fullfat/config/skills/ic1_minutes_recorder.md` | `agents/ic1_minutes_recorder.md` |

## Wiring scope for this slice

Lifted now, not yet wired:
- M0 sub-agents (Boss, Router, Portfolio Risk Analytics, Indian Context, Stitcher), S1 modes (briefing, case, diagnostic), IC1 sub-agents (Chair, Devil's Advocate, Risk Assessor, Counterfactual Engine, Minutes Recorder), A1 challenge.

Wired in this slice:
- None. The Samriddhi 2 (diagnostic) slice wires E1 through E7 plus M0.Stitcher plus S1.briefing_mode plus S1.diagnostic_mode. The Samriddhi 1 (proposal evaluation) slice adds S1.case_mode plus the IC1 layer plus A1.

## Verification

After lift, the following invariants hold:
- 21 skill files in `agents/` matching the source set verbatim.
- 1 foundation document in `foundation/foundation.md` matching the source verbatim.
- No edits to lifted files; the lean MVP operates on the source content unchanged.

If the user requests an edit to any lifted file (e.g., tuning `max_tokens` for a specific agent), the edit happens to the lean MVP copy; the source is not updated.

## Notes on the meta-spec confusion

The earlier orientation document proposed lifting `/docs/doc1_v2/foundation_reference_structure.md` from the full-fat repo into `foundation/foundation.md`. That was incorrect: the file is a meta-specification of how full-fat documentation is structured, not the factual contract. The correct foundation file is the locally-authored `Lean_Samriddhi_MVP_Factual_Foundation.md` from `02 - Factual Foundation/`. The lift above reflects this correction.
