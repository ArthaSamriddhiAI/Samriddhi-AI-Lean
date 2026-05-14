/* E1, listed/fundamental equity per-stock analysis.
 *
 * Skill: agents/e1_listed_fundamental_equity.md
 *
 * Critical scope boundary (per skill §Role and principles §3.8): E1 does
 * NOT produce portfolio-level rollups. M0.PortfolioRiskAnalytics owns the
 * concentration / leverage / liquidity / etc. interpretations. E1 stays
 * at per-stock fundamentals.
 *
 * Slice 2 reality: most of our investors' MFs are outside the snapshot's
 * top-5-holdings coverage set, so E1's per-stock scope is dominated by
 * direct listed holdings (Reliance, HDFC Bank, ITC) plus occasional
 * MF-look-through stocks where coverage permits.
 */

import { callAgent, type AgentCallResult } from "./harness";
import type { StockInScope } from "./listed-equity-scope";

type FamilyScore = "strong" | "adequate" | "moderate" | "weak" | "clean" | "mixed" | "premium";

export type E1StockVerdict = {
  symbol: string;
  source: "direct_listed" | "mf_lookthrough";
  effective_weight_pct: number;
  metric_family_scores: {
    capital_efficiency: FamilyScore;
    capital_structure: FamilyScore;
    earnings_quality: FamilyScore;
    valuation: FamilyScore;
    growth: FamilyScore;
    quality_moats: FamilyScore;
    risk_signals: FamilyScore;
  };
  framework_classification: {
    quality_or_cyclicality: "quality" | "cyclical" | "mixed";
    growth_or_maturity: "growth" | "maturity" | "mixed";
    sector_relative_positioning: "best_in_class" | "middle_pack" | "laggard" | "cannot_evaluate";
    special_situation: string | null;
  };
  overall_verdict:
    | "positive"
    | "positive_with_caution"
    | "neutral"
    | "hold_with_attention"
    | "negative"
    | "cannot_evaluate";
  key_drivers: string[];
  key_risks: string[];
  confidence: number;
  reasoning_trace: string;
};

export type E1Output = {
  analysis_scope: string[];
  per_stock_verdicts: E1StockVerdict[];
  scope_notes: string;
  escalate_to_master: boolean;
  reasoning_summary: string;
};

export type E1Input = {
  asOfDate: string;
  investorName: string;
  investorMandate: string;
  stocksInScope: StockInScope[];
};

function buildPrompt(input: E1Input): string {
  const scopePayload = input.stocksInScope.map((s) => ({
    symbol: s.symbol,
    source: s.source,
    effective_weight_pct: Number(s.effectiveWeightPct.toFixed(2)),
    via_instrument: s.viaInstrument,
    nifty500_record: s.niftyData ?? null,
  }));

  const scopeNote =
    input.stocksInScope.length === 0
      ? `No listed equity in analysable scope. Direct holdings absent and MF look-through unavailable (foundation §3 coverage constraint: roughly 220 of 1,773 funds carry Top 5 Holdings data). Return per_stock_verdicts as an empty array and explain in scope_notes.`
      : `${input.stocksInScope.length} stocks in scope, ${input.stocksInScope.filter((s) => s.source === "direct_listed").length} direct and ${input.stocksInScope.filter((s) => s.source === "mf_lookthrough").length} via MF look-through. Per-stock nifty500 records are attached where the snapshot has them.`;

  return [
    `# E1 Per-Stock Verdict Request`,
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
    `${scopePayload.length > 0 ? "```json\n" + JSON.stringify(scopePayload, null, 2) + "\n```" : ""}`,
    ``,
    `## Important boundary`,
    ``,
    `Do NOT produce portfolio-level rollups (concentration, fee aggregation,`,
    `liquidity). M0.PortfolioRiskAnalytics owns those. You produce per-stock`,
    `verdicts only. Cite specific metric values from each stock's`,
    `nifty500_record when assigning family scores. Where the record is`,
    `missing or partial, set the relevant dimension to "cannot_evaluate"`,
    `with reduced confidence; do not guess.`,
    ``,
    `## Output schema`,
    ``,
    `Return a single fenced JSON block with this exact shape:`,
    ``,
    "```json",
    `{`,
    `  "analysis_scope": [<stock symbols analysed>],`,
    `  "per_stock_verdicts": [`,
    `    {`,
    `      "symbol": "<string>",`,
    `      "source": "<direct_listed | mf_lookthrough>",`,
    `      "effective_weight_pct": <number>,`,
    `      "metric_family_scores": {`,
    `        "capital_efficiency": "<strong | adequate | moderate | weak | mixed>",`,
    `        "capital_structure": "<strong | adequate | moderate | weak | mixed>",`,
    `        "earnings_quality": "<strong | adequate | moderate | weak | mixed>",`,
    `        "valuation": "<strong | adequate | moderate | premium | mixed>",`,
    `        "growth": "<strong | adequate | moderate | weak | mixed>",`,
    `        "quality_moats": "<strong | adequate | moderate | weak | mixed>",`,
    `        "risk_signals": "<clean | adequate | mixed | weak>"`,
    `      },`,
    `      "framework_classification": {`,
    `        "quality_or_cyclicality": "<quality | cyclical | mixed>",`,
    `        "growth_or_maturity": "<growth | maturity | mixed>",`,
    `        "sector_relative_positioning": "<best_in_class | middle_pack | laggard | cannot_evaluate>",`,
    `        "special_situation": "<string | null>"`,
    `      },`,
    `      "overall_verdict": "<positive | positive_with_caution | neutral | hold_with_attention | negative | cannot_evaluate>",`,
    `      "key_drivers": [<short strings citing metrics>],`,
    `      "key_risks": [<short strings citing risk signals>],`,
    `      "confidence": <0.0 to 1.0>,`,
    `      "reasoning_trace": "<2-4 sentence narrative for this stock>"`,
    `    }`,
    `  ],`,
    `  "scope_notes": "<one paragraph describing what is and is not in analytical scope>",`,
    `  "escalate_to_master": <bool>,`,
    `  "reasoning_summary": "<150-300 word narrative across the stocks in scope>"`,
    `}`,
    "```",
    ``,
    `Maintain institutional analytical voice: declarative, evidence-grounded,`,
    `cite specific ROCE / D/E / P/E / promoter holding values from the`,
    `nifty500 records. Sector-relative claims should be acknowledged as`,
    `qualitative when sector peer data is unavailable.`,
    ``,
    `Respond with a single fenced JSON block. No prose outside the fence.`,
  ].join("\n");
}

function validate(parsed: unknown): E1Output {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("E1 output is not an object");
  }
  const o = parsed as Record<string, unknown>;
  for (const k of ["analysis_scope", "per_stock_verdicts", "scope_notes", "escalate_to_master", "reasoning_summary"]) {
    if (!(k in o)) throw new Error(`E1 output missing required field: ${k}`);
  }
  if (!Array.isArray(o.analysis_scope)) throw new Error("E1 analysis_scope must be array");
  if (!Array.isArray(o.per_stock_verdicts)) throw new Error("E1 per_stock_verdicts must be array");
  return o as unknown as E1Output;
}

export async function runE1(input: E1Input): Promise<AgentCallResult<E1Output>> {
  return callAgent<E1Output>({
    skillId: "e1_listed_fundamental_equity",
    userPrompt: buildPrompt(input),
    validate,
  });
}
