/* E3, macro/policy/news evidence agent.
 *
 * E3 is the only mandatorily unconditional evidence agent (per
 * principles §3.1). Every diagnostic case gets an E3 verdict.
 *
 * Skill: agents/e3_macro_policy_news.md
 *
 * Input context: snapshot's macro section (5 dimensions of indicators),
 * the investor's mandate framing, the as-of date.
 *
 * Output: a structured macro verdict per the skill's output schema.
 */

import { callAgent, type AgentCallResult } from "./harness";

export type E3KeyDriver = {
  name: string;
  evidence: string;
  dimension: string;
};

export type E3KeyRisk = {
  name: string;
  evidence: string;
  severity: "low" | "medium" | "high";
};

export type E3Output = {
  rate_environment: {
    current_repo_pct: number | null;
    real_rate_pct: number | null;
    yield_curve_shape: string;
    forward_expectations: string;
    cycle_phase: string;
  };
  growth_inflation: {
    gdp_growth_pct: number | null;
    inflation_pct_cpi: number | null;
    inflation_pct_core: number | null;
    growth_inflation_tradeoff: string;
  };
  currency_external: {
    inr_usd: number | null;
    reer_assessment: string;
    current_account_pct_gdp: number | null;
    fii_flows_summary: string;
  };
  policy_regulatory: {
    recent_rbi: string;
    fiscal_stance: string;
    sectoral_regulatory: string;
    tax_policy: string;
  };
  material_news: string[];
  risk_overlay: {
    tail_risks: string;
    concentration_risks_macro: string;
    time_aware_windows: string;
  };
  overall_e3_assessment: "supportive" | "neutral" | "cautionary";
  key_drivers: E3KeyDriver[];
  key_risks: E3KeyRisk[];
  confidence: number;
  escalate_to_master: boolean;
  reasoning_summary: string;
};

export type E3Input = {
  asOfDate: string;
  investorName: string;
  investorMandate: string;
  investorScope: string;
  macroData: unknown;
};

function buildPrompt(input: E3Input): string {
  return [
    `# E3 Macro Verdict Request`,
    ``,
    `case_mode: diagnostic`,
    `as_of_date: ${input.asOfDate}`,
    `investor: ${input.investorName}`,
    `mandate: ${input.investorMandate}`,
    `portfolio_scope: ${input.investorScope}`,
    ``,
    `## Macro data snapshot`,
    ``,
    `The following is the macro data block from the as-of snapshot. Treat`,
    `it as the only available macro context; do not invent indicators not`,
    `present here. Cite specific values in your reasoning. The data block`,
    `is organised into 5 dimensions with indicator-level detail.`,
    ``,
    "```json",
    JSON.stringify(input.macroData, null, 2),
    "```",
    ``,
    `## Output schema`,
    ``,
    `Return a single fenced JSON block with this exact shape:`,
    ``,
    "```json",
    `{`,
    `  "rate_environment": {`,
    `    "current_repo_pct": <number | null>,`,
    `    "real_rate_pct": <number | null>,`,
    `    "yield_curve_shape": "<string>",`,
    `    "forward_expectations": "<string>",`,
    `    "cycle_phase": "<early_cycle | mid_cycle | late_cycle | trough | tightening | pause | cutting>"`,
    `  },`,
    `  "growth_inflation": {`,
    `    "gdp_growth_pct": <number | null>,`,
    `    "inflation_pct_cpi": <number | null>,`,
    `    "inflation_pct_core": <number | null>,`,
    `    "growth_inflation_tradeoff": "<string>"`,
    `  },`,
    `  "currency_external": {`,
    `    "inr_usd": <number | null>,`,
    `    "reer_assessment": "<string>",`,
    `    "current_account_pct_gdp": <number | null>,`,
    `    "fii_flows_summary": "<string>"`,
    `  },`,
    `  "policy_regulatory": {`,
    `    "recent_rbi": "<string>",`,
    `    "fiscal_stance": "<string>",`,
    `    "sectoral_regulatory": "<string>",`,
    `    "tax_policy": "<string>"`,
    `  },`,
    `  "material_news": [<short strings>],`,
    `  "risk_overlay": {`,
    `    "tail_risks": "<string>",`,
    `    "concentration_risks_macro": "<string>",`,
    `    "time_aware_windows": "<string>"`,
    `  },`,
    `  "overall_e3_assessment": "<supportive | neutral | cautionary>",`,
    `  "key_drivers": [{ "name": "<string>", "evidence": "<cite specific indicator>", "dimension": "<rate|growth|currency|policy|news>" }],`,
    `  "key_risks": [{ "name": "<string>", "evidence": "<cite specific indicator>", "severity": "<low|medium|high>" }],`,
    `  "confidence": <0.0 to 1.0>,`,
    `  "escalate_to_master": <bool>,`,
    `  "reasoning_summary": "<150-300 word narrative tying the indicators to the investor's mandate and holdings>"`,
    `}`,
    "```",
    ``,
    `## Voice and discipline`,
    ``,
    `Maintain the analytical voice in your system prompt: institutional,`,
    `declarative, evidence-grounded, no hedging, no advisory framing.`,
    `Cite specific indicator values from the macro block. If a dimension`,
    `cannot be evaluated from the available data, set the relevant field`,
    `to null and explain in reasoning_summary; do not fabricate.`,
    ``,
    `Respond with a single fenced JSON block (\`\`\`json ... \`\`\`) matching`,
    `the schema above. No prose outside the fence.`,
  ].join("\n");
}

function validate(parsed: unknown): E3Output {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("E3 output is not an object");
  }
  const o = parsed as Record<string, unknown>;
  const required = [
    "rate_environment",
    "growth_inflation",
    "currency_external",
    "policy_regulatory",
    "material_news",
    "risk_overlay",
    "overall_e3_assessment",
    "key_drivers",
    "key_risks",
    "confidence",
    "escalate_to_master",
    "reasoning_summary",
  ];
  for (const k of required) {
    if (!(k in o)) throw new Error(`E3 output missing required field: ${k}`);
  }
  if (!["supportive", "neutral", "cautionary"].includes(o.overall_e3_assessment as string)) {
    throw new Error(`E3 overall_e3_assessment must be supportive | neutral | cautionary, got: ${o.overall_e3_assessment}`);
  }
  if (typeof o.confidence !== "number" || o.confidence < 0 || o.confidence > 1) {
    throw new Error(`E3 confidence must be a number in [0, 1], got: ${o.confidence}`);
  }
  if (!Array.isArray(o.key_drivers) || !Array.isArray(o.key_risks) || !Array.isArray(o.material_news)) {
    throw new Error(`E3 key_drivers / key_risks / material_news must be arrays`);
  }
  return o as unknown as E3Output;
}

export async function runE3(input: E3Input): Promise<AgentCallResult<E3Output>> {
  return callAgent<E3Output>({
    skillId: "e3_macro_policy_news",
    userPrompt: buildPrompt(input),
    validate,
  });
}
