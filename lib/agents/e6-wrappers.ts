/* E6, PMS / AIF Cat I-III / SIF wrapper evaluation.
 *
 * Skill: agents/e6_pms_aif_sif.md
 *
 * E6 is the deepest evidence agent (8 internal sub-agents collapsed into
 * one consolidated skill in cluster 5/6). For Slice 2 diagnostic mode,
 * Gate is not load-bearing (no proposed action; we're evaluating
 * existing holdings). The output is per-wrapper verdicts plus an
 * overall E6 verdict.
 *
 * Empty scope for Malhotra, Iyengar, Menon (no PMS / AIF). E6 still
 * activates per router; returns empty verdicts with scope_notes.
 */

import { callAgent, type AgentCallResult } from "./harness";
import type { WrapperRow } from "./wrapper-scope";

export type E6PerProduct = {
  instrument: string;
  wrapper_type: "PMS" | "AIF" | "SIF";
  sub_category: string;
  weight_pct: number;
  manager_quality: "strong" | "adequate" | "weak" | "in_transition" | "cannot_evaluate";
  strategy_consistency: "high" | "moderate" | "low" | "drift_detected" | "cannot_evaluate";
  fee_structure_assessment: string;
  fee_normalised_bps: number | null;
  liquidity_terms: string;
  concentration_or_strategy_profile: string;
  performance_vs_benchmark: string;
  complexity_premium_earned: "yes" | "no" | "mixed" | "cannot_evaluate";
  capacity_concern: "low" | "moderate" | "high" | "cannot_evaluate";
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

export type E6Output = {
  analysis_scope: string[];
  per_product_evaluations: E6PerProduct[];
  cross_product_observations: string[];
  scope_notes: string;
  overall_e6_verdict: "positive" | "positive_with_caution" | "hold" | "negative" | "cannot_evaluate";
  escalate_to_master: boolean;
  reasoning_summary: string;
};

export type E6Input = {
  asOfDate: string;
  investorName: string;
  investorMandate: string;
  wrappers: WrapperRow[];
};

function buildPrompt(input: E6Input): string {
  const scopeNote =
    input.wrappers.length === 0
      ? `No PMS / AIF / SIF wrappers in scope. Return per_product_evaluations empty and explain in scope_notes.`
      : `${input.wrappers.length} wrapper(s) in scope: ${input.wrappers.filter((w) => w.wrapper_type === "PMS").length} PMS, ${input.wrappers.filter((w) => w.wrapper_type === "AIF").length} AIF. Snapshot records attached where matched; where the snapshot has no specific record, fall back to general published positioning knowledge for that named strategy and reduce confidence.`;

  return [
    `# E6 Wrapper Evaluation Request`,
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
    `${input.wrappers.length > 0 ? "```json\n" + JSON.stringify(input.wrappers, null, 2) + "\n```" : ""}`,
    ``,
    `## Slice 2 framing`,
    ``,
    `This is a diagnostic case, not a proposed_action. There is no Gate`,
    `check to perform; you are evaluating existing wrappers in the portfolio.`,
    `For each wrapper produce a per-product evaluation covering manager`,
    `quality, strategy consistency, fee structure, liquidity terms,`,
    `concentration profile, performance vs benchmark, complexity-premium`,
    `assessment, capacity concern, and overall verdict.`,
    ``,
    `For Cat III long-short specifically: the foundation §3 vocabulary item`,
    `is "complexity_premium_earned". Map this carefully against published`,
    `performance net of the 2-and-20 fee structure and an appropriate passive`,
    `comparator.`,
    ``,
    `For aggregate PMS wrapper observations across multiple strategies`,
    `(e.g., four PMS strategies on Bhatt), use cross_product_observations.`,
    `Do NOT compute aggregate concentration; that is M0.PortfolioRiskAnalytics's`,
    `job. Surface qualitative observations like wrapper differentiation,`,
    `strategy overlap, fee aggregation.`,
    ``,
    `## Output schema`,
    ``,
    `Return a single fenced JSON block:`,
    ``,
    "```json",
    `{`,
    `  "analysis_scope": [<wrapper names>],`,
    `  "per_product_evaluations": [`,
    `    {`,
    `      "instrument": "<string>",`,
    `      "wrapper_type": "<PMS | AIF | SIF>",`,
    `      "sub_category": "<foundation §3 sub-category>",`,
    `      "weight_pct": <number>,`,
    `      "manager_quality": "<strong | adequate | weak | in_transition | cannot_evaluate>",`,
    `      "strategy_consistency": "<high | moderate | low | drift_detected | cannot_evaluate>",`,
    `      "fee_structure_assessment": "<specific fee mechanics: mgmt + perf + hurdle + HWM>",`,
    `      "fee_normalised_bps": <number | null>,`,
    `      "liquidity_terms": "<redemption window, notice, exit load>",`,
    `      "concentration_or_strategy_profile": "<published positioning>",`,
    `      "performance_vs_benchmark": "<specific multi-period comparison>",`,
    `      "complexity_premium_earned": "<yes | no | mixed | cannot_evaluate>",`,
    `      "capacity_concern": "<low | moderate | high | cannot_evaluate>",`,
    `      "overall_verdict": "<positive | positive_with_caution | hold | negative | cannot_evaluate>",`,
    `      "key_drivers": [<short strings>],`,
    `      "key_risks": [<short strings>],`,
    `      "recommended_alternatives": [<short strings or empty array>],`,
    `      "confidence": <0.0 to 1.0>,`,
    `      "reasoning_trace": "<2-4 sentences citing snapshot or positioning>"`,
    `    }`,
    `  ],`,
    `  "cross_product_observations": [<observations spanning wrappers>],`,
    `  "scope_notes": "<one paragraph>",`,
    `  "overall_e6_verdict": "<positive | positive_with_caution | hold | negative | cannot_evaluate>",`,
    `  "escalate_to_master": <bool>,`,
    `  "reasoning_summary": "<200-400 word narrative>"`,
    `}`,
    "```",
    ``,
    `Maintain institutional voice. Cite specific numbers when available`,
    `(e.g., "Marcellus 3Y CAGR 18.4% vs Nifty 500 TRI 17.7%"). When the`,
    `snapshot record is null, anchor in published positioning and reduce`,
    `confidence to 0.65 max for that product.`,
    ``,
    `Respond with a single fenced JSON block. No prose outside the fence.`,
  ].join("\n");
}

function validate(parsed: unknown): E6Output {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("E6 output is not an object");
  }
  const o = parsed as Record<string, unknown>;
  for (const k of [
    "analysis_scope",
    "per_product_evaluations",
    "cross_product_observations",
    "scope_notes",
    "overall_e6_verdict",
    "escalate_to_master",
    "reasoning_summary",
  ]) {
    if (!(k in o)) throw new Error(`E6 output missing required field: ${k}`);
  }
  if (!Array.isArray(o.per_product_evaluations)) throw new Error("E6 per_product_evaluations must be array");
  return o as unknown as E6Output;
}

export async function runE6(input: E6Input): Promise<AgentCallResult<E6Output>> {
  return callAgent<E6Output>({
    skillId: "e6_pms_aif_sif",
    userPrompt: buildPrompt(input),
    validate,
  });
}
