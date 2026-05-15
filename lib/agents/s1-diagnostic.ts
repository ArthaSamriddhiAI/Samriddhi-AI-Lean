/* S1.diagnostic_mode synthesis.
 *
 * Skill: agents/s1_diagnostic_mode.md
 *
 * Per orientation Q2 (approved): the skill's authored output schema is
 * institutional health-report shaped (overall_health_verdict +
 * recommendations). The lean MVP's briefing PDF is advisor-talking-points
 * shaped per foundation §6 (seven fixed sections). We use the skill
 * prompt BODY as the system prompt unchanged (voice, no-decision
 * discipline, mandate anchoring all apply), but instruct the model at
 * runtime to return the foundation §6 seven-section structure as the
 * output schema. This is the "runtime override" interpretation of Slice 2
 * Q2.
 *
 * Output: BriefingContent. This is what gets persisted to
 * Case.contentJson and rendered by the Analysis tab + the React PDF.
 */

import { callAgent, type AgentCallResult } from "./harness";
import type { StitchedContext } from "./stitcher";

export type SourceTag = "metric" | "interpretation" | "hybrid" | "evidence_agent";

export type HeadlineObservation = {
  vocab: string;
  severity: "ok" | "info" | "flag" | "escalate";
  one_line: string;
  source: SourceTag;
};

export type PortfolioOverviewRow = {
  asset_class: "Equity" | "Debt" | "Alternatives" | "Cash";
  actual_pct: number;
  target_pct: number;
  band: [number, number];
  deviation_pp: number;
  in_band: boolean;
};

export type PortfolioOverview = {
  rows: PortfolioOverviewRow[];
  total_aum_line: string;
  liquidity_tier_line: string;
};

export type ConcentrationBreach = {
  kind: "Position" | "Sector" | "Wrapper";
  severity: "flag" | "escalate";
  detail: string;
  evidence: string;
  figure: string;
  source: SourceTag;
};

export type RiskFlag = {
  category: "Liquidity" | "Mandate drift" | "Behavioural" | "Fee" | "Deployment";
  severity: "ok" | "info" | "flag" | "escalate";
  title: string;
  body: string;
  source: SourceTag;
};

export type ModelComparisonRow = {
  sleeve: string;
  model_pct: string;
  actual_pct: string;
  note: string;
};

export type ModelComparison = {
  framing_line: string;
  rows: ModelComparisonRow[];
};

export type TalkingPoint = {
  number: string;
  body: string;
  emphasis?: string;
};

export type EvidenceAppendixRow = {
  name: string;
  sub_category: string;
  value_cr: string;
  weight_pct: string;
};

export type BriefingHeader = {
  investor_name: string;
  case_label: string;
  snapshot_date: string;
  liquid_aum_label: string;
  holdings_label: string;
  stated_revealed_label: string;
  severity_counts: { escalate: number; flag: number; total: number };
};

export type BriefingContent = {
  header: BriefingHeader;
  workbench_lede: string;
  section_1_headline_observations: HeadlineObservation[];
  section_2_portfolio_overview: PortfolioOverview;
  section_3_concentration_analysis: ConcentrationBreach[];
  section_4_risk_flags: RiskFlag[];
  section_5_comparison_vs_model: ModelComparison;
  section_6_talking_points: TalkingPoint[];
  section_7_evidence_appendix: EvidenceAppendixRow[];
  coverage_note: string;
};

export type S1Input = {
  stitched: StitchedContext;
  holdingsForAppendix: Array<{
    instrument: string;
    sub_category: string;
    value_cr: number;
    weight_pct: number;
  }>;
};

const FOUNDATION_VOCAB = [
  "position_over_concentration",
  "sector_over_concentration",
  "wrapper_over_accumulation",
  "cash_drag",
  "allocation_drift",
  "liquidity_gap",
  "stated_revealed_divergence",
  "fee_inefficiency",
  "complexity_premium_not_earned",
  "mandate_consistent",
];

function buildPrompt(input: S1Input): string {
  return [
    `# S1 Diagnostic Synthesis Request`,
    ``,
    `You are synthesising the briefing for case ${input.stitched.case_meta.case_id}.`,
    `Investor: ${input.stitched.case_meta.investor_name}`,
    `As of: ${input.stitched.case_meta.as_of_date}`,
    `Bucket: ${input.stitched.case_meta.bucket_tier}`,
    ``,
    `## Stitched context`,
    ``,
    `The deterministic metrics, evidence agent verdicts (where activated),`,
    `and router decision are below. The pre_observations array points at`,
    `synthesis material with suggested foundation §3 vocabulary names; you`,
    `decide which to surface and how to phrase them.`,
    ``,
    "```json",
    JSON.stringify(input.stitched, null, 2),
    "```",
    ``,
    `## Holdings list (for evidence appendix)`,
    ``,
    `Holdings the diagnostic operated on, with weights. Use these verbatim`,
    `for section 7. For section 7 surface only the holdings that drove`,
    `observations in sections 1, 3, and 4.`,
    ``,
    "```json",
    JSON.stringify(input.holdingsForAppendix, null, 2),
    "```",
    ``,
    `## OUTPUT SCHEMA: foundation §6 seven-section briefing`,
    ``,
    `Per Slice 2 runtime override, the output is the foundation §6 briefing`,
    `structure (seven fixed sections), NOT the s1_diagnostic_mode skill's`,
    `authored output_schema_ref. The skill's voice, discipline, and`,
    `no-decision principles all apply; only the output shape is overridden.`,
    ``,
    `Diagnostic vocabulary: every observation must reference a named item`,
    `from this fixed list (foundation §3). Do not invent new names; if a`,
    `signal would warrant a name not on this list, omit it.`,
    ``,
    `Allowed vocabulary: ${FOUNDATION_VOCAB.join(", ")}.`,
    ``,
    `Source tagging on every observation: "metric" = deterministic number`,
    `from the metrics object; "interpretation" = LLM judgement; "hybrid" =`,
    `deterministic metric paired with LLM context. Use this honestly so the`,
    `Analysis tab can footnote metric-source observations in the Evidence`,
    `Appendix.`,
    ``,
    `Return a single fenced JSON block with this exact shape:`,
    ``,
    "```json",
    `{`,
    `  "header": {`,
    `    "investor_name": "<string>",`,
    `    "case_label": "Quarterly review",`,
    `    "snapshot_date": "<short readable date e.g. '2 Apr 2026'>",`,
    `    "liquid_aum_label": "<e.g. 'Rs 22.10 Cr'>",`,
    `    "holdings_label": "<e.g. '12 holdings'>",`,
    `    "stated_revealed_label": "<one-liner like 'Aggressive stated; moderate-aggressive revealed'>",`,
    `    "severity_counts": { "escalate": <int>, "flag": <int>, "total": <int> }`,
    `  },`,
    `  "workbench_lede": "<3-5 sentence overview anchoring the diagnostic: number of observations, top concerns, deterministic-vs-qualitative split; matches the wireframe's lede density>",`,
    `  "section_1_headline_observations": [`,
    `    { "vocab": "<from allowed list>", "severity": "<ok|info|flag|escalate>", "one_line": "<one bullet, declarative, no hedging, cites specific number>", "source": "<metric|interpretation|hybrid>" }`,
    `  ],`,
    `  "section_2_portfolio_overview": {`,
    `    "rows": [{ "asset_class": "<Equity|Debt|Alternatives|Cash>", "actual_pct": <num>, "target_pct": <num>, "band": [<min>, <max>], "deviation_pp": <num>, "in_band": <bool> }],`,
    `    "total_aum_line": "<e.g. 'Liquid AUM Rs 22.10 Cr'>",`,
    `    "liquidity_tier_line": "<e.g. 'Liquidity tier essential (5-15% floor); actual T+30 + T+90 share 40.0%, within tier'>"`,
    `  },`,
    `  "section_3_concentration_analysis": [`,
    `    { "kind": "<Position|Sector|Wrapper>", "severity": "<flag|escalate>", "detail": "<what the breach is>", "evidence": "<threshold + figure context>", "figure": "<short display value, e.g. '13.6%'>", "source": "<metric|interpretation|hybrid>" }`,
    `  ],`,
    `  "section_4_risk_flags": [`,
    `    { "category": "<Liquidity|Mandate drift|Behavioural|Fee|Deployment>", "severity": "<ok|info|flag|escalate>", "title": "<short observation name>", "body": "<1-2 sentences>", "source": "<metric|interpretation|hybrid>" }`,
    `  ],`,
    `  "section_5_comparison_vs_model": {`,
    `    "framing_line": "<one line on whether direct comparison applies; for aggressive long-term investors it does, for others it is informational>",`,
    `    "rows": [{ "sleeve": "<e.g. 'Large cap (active + passive)'>", "model_pct": "<e.g. '50%' or '-'>", "actual_pct": "<e.g. '23%'>", "note": "<one phrase>" }]`,
    `  },`,
    `  "section_6_talking_points": [`,
    `    { "number": "01", "body": "<advisor-facing conversation opener, collegial voice>", "emphasis": "<optional italic emphasis phrase>" }`,
    `  ],`,
    `  "section_7_evidence_appendix": [`,
    `    { "name": "<instrument>", "sub_category": "<foundation §3 sub-category>", "value_cr": "<e.g. '2.50'>", "weight_pct": "<e.g. '11.3%'>" }`,
    `  ],`,
    `  "coverage_note": "<one paragraph on what the diagnostic could and could not see: PMS/AIF opacity, MF coverage limits, sector look-through caveats>"`,
    `}`,
    "```",
    ``,
    `## Voice and discipline`,
    ``,
    `Maintain the system prompt's voice: institutional, declarative,`,
    `evidence-grounded, no hedging, no advisory framing. Avoid "we recommend",`,
    `"you should", "could potentially". Section 6 talking points are`,
    `conversation openers, not recommendations.`,
    ``,
    `Headline observations: 3 to 5. Each references a named vocabulary item.`,
    `Cites specific numbers from the metrics object or evidence verdicts.`,
    ``,
    `Concentration analysis: if no breaches surfaced, return a single-item`,
    `array with kind/severity describing the no-breach finding, or an empty`,
    `array with a note in coverage_note. Be honest about what the foundation`,
    `data coverage permits.`,
    ``,
    `Severity counts in the header must match the actual escalate/flag`,
    `severities surfaced in sections 1, 3, 4 combined (deduplicating where`,
    `the same observation appears in multiple sections).`,
    ``,
    `Respond with a single fenced JSON block. No prose outside the fence.`,
  ].join("\n");
}

function validate(parsed: unknown): BriefingContent {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("S1 output is not an object");
  }
  const o = parsed as Record<string, unknown>;
  const required = [
    "header",
    "workbench_lede",
    "section_1_headline_observations",
    "section_2_portfolio_overview",
    "section_3_concentration_analysis",
    "section_4_risk_flags",
    "section_5_comparison_vs_model",
    "section_6_talking_points",
    "section_7_evidence_appendix",
    "coverage_note",
  ];
  for (const k of required) {
    if (!(k in o)) throw new Error(`S1 briefing missing required field: ${k}`);
  }
  if (!Array.isArray(o.section_1_headline_observations)) throw new Error("section_1 must be array");
  if (!Array.isArray(o.section_3_concentration_analysis)) throw new Error("section_3 must be array");
  if (!Array.isArray(o.section_4_risk_flags)) throw new Error("section_4 must be array");
  if (!Array.isArray(o.section_6_talking_points)) throw new Error("section_6 must be array");
  if (!Array.isArray(o.section_7_evidence_appendix)) throw new Error("section_7 must be array");
  return o as unknown as BriefingContent;
}

export async function runS1Diagnostic(input: S1Input): Promise<AgentCallResult<BriefingContent>> {
  return callAgent<BriefingContent>({
    skillId: "s1_diagnostic_mode",
    userPrompt: buildPrompt(input),
    validate,
  });
}
