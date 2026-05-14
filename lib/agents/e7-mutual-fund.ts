/* E7, mutual fund per-scheme evaluation.
 *
 * Skill: agents/e7_mutual_fund.md
 *
 * Per-scheme verdicts: classification, manager-strategy, performance
 * attribution, fee + cost structure, capacity / continuity, tax
 * efficiency. The lean MVP curates the snapshot's mf_funds row down to
 * roughly 20 fields per fund (full row is ~50 fields) for token economy.
 *
 * Empty scope for Menon (cash-heavy transitional).
 */

import { callAgent, type AgentCallResult } from "./harness";
import type { MutualFundScopeRow } from "./wrapper-scope";

export type E7PerScheme = {
  instrument: string;
  sebi_category: string;
  sub_category: string;
  weight_pct: number;
  manager_strategy: {
    manager_continuity: "strong" | "moderate" | "weak" | "in_transition" | "cannot_evaluate";
    style_consistency: "high" | "moderate" | "drift_detected" | "cannot_evaluate";
    philosophy: string;
  };
  performance_attribution: {
    one_year_pct: number | null;
    three_year_pct: number | null;
    five_year_pct: number | null;
    alpha_summary: string;
    peer_relative: string;
    skill_vs_beta: string;
  };
  fee_cost: {
    ter_pct: number | null;
    fee_impact_5y_summary: string;
  };
  capacity_continuity: {
    aum_cr: number | null;
    capacity_concern: "low" | "moderate" | "high" | "cannot_evaluate";
    aum_growth_notes: string;
  };
  tax_efficiency: string;
  overall_verdict:
    | "positive"
    | "positive_with_caution"
    | "hold"
    | "negative"
    | "cannot_evaluate";
  key_drivers: string[];
  key_risks: string[];
  recommended_alternatives: string[];
  confidence: number;
  reasoning_trace: string;
};

export type E7Output = {
  analysis_scope: string[];
  per_scheme_verdicts: E7PerScheme[];
  scope_notes: string;
  escalate_to_master: boolean;
  reasoning_summary: string;
};

export type E7Input = {
  asOfDate: string;
  investorName: string;
  investorMandate: string;
  schemes: MutualFundScopeRow[];
};

function buildPrompt(input: E7Input): string {
  const scopeNote =
    input.schemes.length === 0
      ? `No mutual funds in scope. Return per_scheme_verdicts empty and explain in scope_notes.`
      : `${input.schemes.length} scheme(s) in scope. Snapshot metadata attached per scheme: SEBI category, AUM, TER, multi-period returns, Sharpe / Sortino / volatility, top-N concentration aggregates, market-cap split, P/E, P/B, rolling alpha metrics, and (where the snapshot has it) top 5 holdings / sectors.`;

  return [
    `# E7 Mutual Fund Verdict Request`,
    ``,
    `case_mode: diagnostic`,
    `as_of_date: ${input.asOfDate}`,
    `investor: ${input.investorName}`,
    `mandate: ${input.investorMandate}`,
    ``,
    `## Scope`,
    ``,
    scopeNote,
    ``,
    `${input.schemes.length > 0 ? "```json\n" + JSON.stringify(input.schemes, null, 2) + "\n```" : ""}`,
    ``,
    `## Per-scheme analytical dimensions`,
    ``,
    `For each scheme: classification + sub-category positioning, manager`,
    `and strategy (continuity, style consistency, philosophy), performance`,
    `attribution (1Y / 3Y / 5Y returns, alpha vs benchmark, peer-relative,`,
    `skill versus beta drift), fee and cost, capacity and continuity, tax`,
    `efficiency, overall verdict.`,
    ``,
    `Distinguish skill from beta. Sustained alpha across multiple regimes`,
    `is skill; recent alpha in a single regime may be beta drift. Use the`,
    `rolling_metrics.alpha_trend_direction signal.`,
    ``,
    `For schemes where snapshot_curated is null (rare), state the gap`,
    `explicitly and reduce confidence. Do not fabricate returns.`,
    ``,
    `## Output schema`,
    ``,
    `Return a single fenced JSON block:`,
    ``,
    "```json",
    `{`,
    `  "analysis_scope": [<scheme names>],`,
    `  "per_scheme_verdicts": [`,
    `    {`,
    `      "instrument": "<string>",`,
    `      "sebi_category": "<from snapshot or 'cannot_evaluate'>",`,
    `      "sub_category": "<foundation §3 sub-category>",`,
    `      "weight_pct": <number>,`,
    `      "manager_strategy": {`,
    `        "manager_continuity": "<strong | moderate | weak | in_transition | cannot_evaluate>",`,
    `        "style_consistency": "<high | moderate | drift_detected | cannot_evaluate>",`,
    `        "philosophy": "<one sentence>"`,
    `      },`,
    `      "performance_attribution": {`,
    `        "one_year_pct": <number | null>,`,
    `        "three_year_pct": <number | null>,`,
    `        "five_year_pct": <number | null>,`,
    `        "alpha_summary": "<vs benchmark>",`,
    `        "peer_relative": "<vs category median>",`,
    `        "skill_vs_beta": "<short narrative on attribution>"`,
    `      },`,
    `      "fee_cost": {`,
    `        "ter_pct": <number | null>,`,
    `        "fee_impact_5y_summary": "<short>"`,
    `      },`,
    `      "capacity_continuity": {`,
    `        "aum_cr": <number | null>,`,
    `        "capacity_concern": "<low | moderate | high | cannot_evaluate>",`,
    `        "aum_growth_notes": "<short>"`,
    `      },`,
    `      "tax_efficiency": "<short>",`,
    `      "overall_verdict": "<positive | positive_with_caution | hold | negative | cannot_evaluate>",`,
    `      "key_drivers": [<short strings>],`,
    `      "key_risks": [<short strings>],`,
    `      "recommended_alternatives": [<short strings or empty array>],`,
    `      "confidence": <0.0 to 1.0>,`,
    `      "reasoning_trace": "<2-4 sentence narrative>"`,
    `    }`,
    `  ],`,
    `  "scope_notes": "<one paragraph>",`,
    `  "escalate_to_master": <bool>,`,
    `  "reasoning_summary": "<150-300 word narrative>"`,
    `}`,
    "```",
    ``,
    `Voice and discipline per the skill: cite specific numbers (returns,`,
    `AUM, TER, manager tenure where derivable). Capacity awareness on mid /`,
    `small cap categories. Fee impact multi-period, not just annual TER.`,
    `Do not manufacture alternatives; "no alternative is materially better"`,
    `is a valid output for high-quality schemes.`,
    ``,
    `Respond with a single fenced JSON block. No prose outside the fence.`,
  ].join("\n");
}

function validate(parsed: unknown): E7Output {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("E7 output is not an object");
  }
  const o = parsed as Record<string, unknown>;
  for (const k of ["analysis_scope", "per_scheme_verdicts", "scope_notes", "escalate_to_master", "reasoning_summary"]) {
    if (!(k in o)) throw new Error(`E7 output missing required field: ${k}`);
  }
  if (!Array.isArray(o.per_scheme_verdicts)) throw new Error("E7 per_scheme_verdicts must be array");
  return o as unknown as E7Output;
}

export async function runE7(input: E7Input): Promise<AgentCallResult<E7Output>> {
  return callAgent<E7Output>({
    skillId: "e7_mutual_fund",
    userPrompt: buildPrompt(input),
    validate,
  });
}
