/* E4, behavioural and historical reading.
 *
 * Skill: agents/e4_behavioural_historical.md
 *
 * Slice 2 activation: every diagnostic case. Per the orientation Q2
 * approval, the foundation §4 archetype profile is treated as the
 * character bible the skill's worked examples cite. There is no prior
 * decision history in the DB (all six investors have zero prior cases at
 * Slice 2 start), so historical_decision_pattern carries the limited-
 * history flag and downstream confidence is reduced.
 */

import { callAgent, type AgentCallResult } from "./harness";

export type E4StatedRiskTolerance = {
  bucket: string;
  specific_language: string;
  horizon: string;
};

export type E4RevealedPatterns = {
  market_event_response: string;
  initiative_pattern: string;
  engagement_style: string;
  product_addition_pattern: string;
  notes: string[];
};

export type E4FamilyDynamics = {
  decision_structure: string;
  formal_authority: string;
  practical_influence: string;
  friction_points: string[];
};

export type E4HistoricalPattern = {
  prior_cases_count: number;
  trajectory_summary: string;
  acceptance_rate: string;
  time_to_decision: string;
};

export type E4StatedRevealedDivergence = {
  direction: "stated_more_aggressive_than_revealed" | "stated_more_conservative_than_revealed" | "aligned" | "unknown";
  magnitude: "material" | "moderate" | "minor" | "none";
  implication: string;
};

export type E4KeyDriver = { name: string; evidence: string };
export type E4KeyRisk = { name: string; evidence: string; severity: "low" | "medium" | "high" };

export type E4Output = {
  stated_risk_tolerance: E4StatedRiskTolerance;
  revealed_behavioural_patterns: E4RevealedPatterns;
  family_advisor_dynamics: E4FamilyDynamics;
  historical_decision_pattern: E4HistoricalPattern;
  stated_vs_revealed_divergence: E4StatedRevealedDivergence;
  limited_history_flag: boolean;
  key_drivers: E4KeyDriver[];
  key_risks: E4KeyRisk[];
  confidence: number;
  escalate_to_master: boolean;
  reasoning_summary: string;
};

export type E4Input = {
  asOfDate: string;
  investorName: string;
  investorMandate: string;
  characterBibleMd: string;
  priorCasesCount: number;
  advisorRelationshipLengthYears: number;
};

function buildPrompt(input: E4Input): string {
  return [
    `# E4 Behavioural Verdict Request`,
    ``,
    `case_mode: diagnostic`,
    `as_of_date: ${input.asOfDate}`,
    `investor: ${input.investorName}`,
    `mandate: ${input.investorMandate}`,
    `prior_cases_count: ${input.priorCasesCount}`,
    `advisor_relationship_length_years: ${input.advisorRelationshipLengthYears}`,
    ``,
    `## Character bible`,
    ``,
    `The foundation §4 archetype profile is the authored character bible`,
    `for this investor. Per the skill's Discipline section, bible takes`,
    `precedence over per-case reasoning for repeat archetypes. Treat it`,
    `as the authoritative source for revealed behavioural patterns,`,
    `family/advisor dynamics, and stated-vs-revealed divergence signals.`,
    ``,
    "```markdown",
    input.characterBibleMd,
    "```",
    ``,
    `## Limited-history context`,
    ``,
    `Prior cases in the DB: ${input.priorCasesCount}. Advisor relationship`,
    `length: ${input.advisorRelationshipLengthYears} years. Set`,
    `limited_history_flag = true if prior cases < 5 or relationship < 1`,
    `year. The bible mitigates limited history but does not eliminate the`,
    `confidence reduction.`,
    ``,
    `## Output schema`,
    ``,
    `Return a single fenced JSON block:`,
    ``,
    "```json",
    `{`,
    `  "stated_risk_tolerance": {`,
    `    "bucket": "<conservative | moderate | aggressive | etc.>",`,
    `    "specific_language": "<direct quote or paraphrase from bible>",`,
    `    "horizon": "<stated horizon language>"`,
    `  },`,
    `  "revealed_behavioural_patterns": {`,
    `    "market_event_response": "<cite specific events: 2018-19, 2020 COVID, 2022 drawdown>",`,
    `    "initiative_pattern": "<advisor-driven | investor-driven | mixed>",`,
    `    "engagement_style": "<analytical | deferential | contesting | distant>",`,
    `    "product_addition_pattern": "<analytical | relationship_trust | peer_network | mixed>",`,
    `    "notes": [<short observations citing specific bible passages>]`,
    `  },`,
    `  "family_advisor_dynamics": {`,
    `    "decision_structure": "<sole | joint | committee | influence-by-family>",`,
    `    "formal_authority": "<who has formal authority>",`,
    `    "practical_influence": "<who actually influences decisions>",`,
    `    "friction_points": [<short observations>]`,
    `  },`,
    `  "historical_decision_pattern": {`,
    `    "prior_cases_count": <number>,`,
    `    "trajectory_summary": "<cite bible for prior pattern even when DB is empty>",`,
    `    "acceptance_rate": "<descriptive label or 'unknown'>",`,
    `    "time_to_decision": "<fast | deliberative | unknown>"`,
    `  },`,
    `  "stated_vs_revealed_divergence": {`,
    `    "direction": "<stated_more_aggressive_than_revealed | stated_more_conservative_than_revealed | aligned | unknown>",`,
    `    "magnitude": "<material | moderate | minor | none>",`,
    `    "implication": "<one sentence on what this means for the current diagnostic case>"`,
    `  },`,
    `  "limited_history_flag": <bool>,`,
    `  "key_drivers": [{ "name": "<short>", "evidence": "<cite bible passage>" }],`,
    `  "key_risks": [{ "name": "<short>", "evidence": "<cite bible passage>", "severity": "<low|medium|high>" }],`,
    `  "confidence": <0.0 to 1.0; reduce when limited_history_flag>,`,
    `  "escalate_to_master": <bool>,`,
    `  "reasoning_summary": "<200-400 word narrative>"`,
    `}`,
    "```",
    ``,
    `Voice and discipline per the skill: cite specific decision events`,
    `("Lalitha withdrew Rs 30 L in 2022"), specific dialogue evidence`,
    `where available, specific bible passages. Avoid gendered or`,
    `community-based generalisation; use facts about this investor.`,
    `Stated vs revealed divergence is the most consequential output;`,
    `always include it even when alignment is clean.`,
    ``,
    `Respond with a single fenced JSON block. No prose outside the fence.`,
  ].join("\n");
}

function validate(parsed: unknown): E4Output {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("E4 output is not an object");
  }
  const o = parsed as Record<string, unknown>;
  const required = [
    "stated_risk_tolerance",
    "revealed_behavioural_patterns",
    "family_advisor_dynamics",
    "historical_decision_pattern",
    "stated_vs_revealed_divergence",
    "limited_history_flag",
    "key_drivers",
    "key_risks",
    "confidence",
    "escalate_to_master",
    "reasoning_summary",
  ];
  for (const k of required) {
    if (!(k in o)) throw new Error(`E4 output missing required field: ${k}`);
  }
  return o as unknown as E4Output;
}

export async function runE4(input: E4Input): Promise<AgentCallResult<E4Output>> {
  return callAgent<E4Output>({
    skillId: "e4_behavioural_historical",
    userPrompt: buildPrompt(input),
    validate,
  });
}
