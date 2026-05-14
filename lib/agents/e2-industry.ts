/* E2, industry & business model framing.
 *
 * Skill: agents/e2_industry_business.md
 *
 * E2 complements E1 by characterising the industry context for each stock
 * (sector cycle, competitive structure, moats, demand drivers,
 * supply-side dynamics). Where E1 cites per-stock fundamentals, E2 frames
 * those within the sector cycle.
 *
 * The snapshot's industry_reports section is raw PDF text dumps and is
 * not passed verbatim (foundation §3 data-coverage realism); E2 relies on
 * the skill body's framework plus the stocks in scope.
 */

import { callAgent, type AgentCallResult } from "./harness";
import type { StockInScope } from "./listed-equity-scope";

export type E2HoldingVerdict = {
  symbol: string;
  industry_classification: {
    capital_intensity: "asset_heavy" | "asset_light" | "mixed";
    cycle_pattern: "structural_growth" | "cyclical" | "defensive" | "mixed";
    regulatory_intensity: "heavy" | "moderate" | "light";
    concentration: "consolidated" | "fragmented" | "in_transition";
  };
  cycle_positioning: {
    current_phase: "early_cycle" | "mid_cycle" | "late_cycle" | "trough" | "rebuild";
    sector_growth_runway_pct_band: string;
    evidence: string;
  };
  competitive_positioning: {
    moat_sources: string[];
    moat_durability: "strengthening" | "stable" | "eroding" | "mixed";
    competitive_intensity: "high" | "moderate" | "low";
    disruption_risk: "low" | "moderate" | "high";
  };
  overall_e2_verdict:
    | "constructive"
    | "constructive_with_caution"
    | "neutral"
    | "cautious"
    | "negative"
    | "cannot_evaluate";
  key_drivers: string[];
  key_risks: string[];
  confidence: number;
};

export type E2Output = {
  analysis_scope: string[];
  per_holding_verdicts: E2HoldingVerdict[];
  cross_holding_sector_observations: string[];
  scope_notes: string;
  escalate_to_master: boolean;
  reasoning_summary: string;
};

export type E2Input = {
  asOfDate: string;
  investorName: string;
  investorMandate: string;
  stocksInScope: StockInScope[];
};

function buildPrompt(input: E2Input): string {
  const scope = input.stocksInScope.map((s) => ({
    symbol: s.symbol,
    source: s.source,
    effective_weight_pct: Number(s.effectiveWeightPct.toFixed(2)),
    via_instrument: s.viaInstrument,
  }));

  const scopeNote =
    input.stocksInScope.length === 0
      ? `No listed equity in analysable scope. Return per_holding_verdicts empty and explain in scope_notes.`
      : `${input.stocksInScope.length} stocks in scope. Industry context for each must be drawn from sector knowledge anchored in the skill's framework (capital intensity, cycle, regulatory intensity, concentration, demand drivers, supply dynamics). No machine-readable per-stock industry tags are attached; foundation §3 industry_reports are raw PDFs and out of scope for this pass.`;

  return [
    `# E2 Industry Framing Request`,
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
    `${scope.length > 0 ? "```json\n" + JSON.stringify(scope, null, 2) + "\n```" : ""}`,
    ``,
    `## Output schema`,
    ``,
    `Return a single fenced JSON block:`,
    ``,
    "```json",
    `{`,
    `  "analysis_scope": [<symbols>],`,
    `  "per_holding_verdicts": [`,
    `    {`,
    `      "symbol": "<string>",`,
    `      "industry_classification": {`,
    `        "capital_intensity": "<asset_heavy | asset_light | mixed>",`,
    `        "cycle_pattern": "<structural_growth | cyclical | defensive | mixed>",`,
    `        "regulatory_intensity": "<heavy | moderate | light>",`,
    `        "concentration": "<consolidated | fragmented | in_transition>"`,
    `      },`,
    `      "cycle_positioning": {`,
    `        "current_phase": "<early_cycle | mid_cycle | late_cycle | trough | rebuild>",`,
    `        "sector_growth_runway_pct_band": "<e.g., '8-10 pct CAGR'>",`,
    `        "evidence": "<specific signal>"`,
    `      },`,
    `      "competitive_positioning": {`,
    `        "moat_sources": [<scale | brand | regulatory | network | switching_costs | ip>],`,
    `        "moat_durability": "<strengthening | stable | eroding | mixed>",`,
    `        "competitive_intensity": "<high | moderate | low>",`,
    `        "disruption_risk": "<low | moderate | high>"`,
    `      },`,
    `      "overall_e2_verdict": "<constructive | constructive_with_caution | neutral | cautious | negative | cannot_evaluate>",`,
    `      "key_drivers": [<short strings>],`,
    `      "key_risks": [<short strings>],`,
    `      "confidence": <0.0 to 1.0>`,
    `    }`,
    `  ],`,
    `  "cross_holding_sector_observations": [<observations spanning multiple holdings, e.g., financials concentration commentary>],`,
    `  "scope_notes": "<one paragraph>",`,
    `  "escalate_to_master": <bool>,`,
    `  "reasoning_summary": "<150-300 word narrative>"`,
    `}`,
    "```",
    ``,
    `Honour the boundary: stay in industry / business-model framing.`,
    `Per-stock fundamentals (ROCE, P/E, etc.) belong to E1. Portfolio-level`,
    `rollups belong to M0.PortfolioRiskAnalytics. Cite specific sector`,
    `signals (capacity utilisation, pricing trajectory, regulatory inflection)`,
    `where confident.`,
    ``,
    `Respond with a single fenced JSON block. No prose outside the fence.`,
  ].join("\n");
}

function validate(parsed: unknown): E2Output {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("E2 output is not an object");
  }
  const o = parsed as Record<string, unknown>;
  for (const k of [
    "analysis_scope",
    "per_holding_verdicts",
    "cross_holding_sector_observations",
    "scope_notes",
    "escalate_to_master",
    "reasoning_summary",
  ]) {
    if (!(k in o)) throw new Error(`E2 output missing required field: ${k}`);
  }
  if (!Array.isArray(o.per_holding_verdicts)) throw new Error("E2 per_holding_verdicts must be array");
  return o as unknown as E2Output;
}

export async function runE2(input: E2Input): Promise<AgentCallResult<E2Output>> {
  return callAgent<E2Output>({
    skillId: "e2_industry_business",
    userPrompt: buildPrompt(input),
    validate,
  });
}
