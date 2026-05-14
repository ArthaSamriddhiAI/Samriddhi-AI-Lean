/* A1, adversarial challenge agent.
 *
 * Skill: agents/a1_challenge.md
 *
 * Per Slice 3 orientation Q3: A1 fires once after S1.case_mode synthesis,
 * standalone, no feedback to S1. The output renders alongside S1's
 * verdict in the Case Detail Outcome tab (section 5 of the seven-section
 * briefing). A1's job is to surface the hard questions a critical
 * reviewer would ask — counter-arguments to the synthesis, stress tests
 * the verdict has not yet considered, edge cases that warrant explicit
 * thought.
 *
 * The discipline is "critical reviewer, not antagonist." A1 does not
 * argue against the action; it asks the questions the synthesis layer
 * should be ready to answer. The advisor weighs both S1 and A1 in the
 * conversation with the investor.
 */

import { callAgent, type AgentCallResult } from "../harness";
import { formatCaseContextHeader, type CaseAgentContext } from "./case-context";
import type { CaseEvidenceVerdict } from "./case-verdict";
import type { GateResult } from "./governance/types";
import type { AdvisoryChallengeItem, S1CaseOutput } from "./briefing-case-content";

const CATEGORIES: AdvisoryChallengeItem["category"][] = [
  "counter_argument",
  "stress_test",
  "edge_case",
];

export type A1Output = {
  challenges: AdvisoryChallengeItem[];
};

export type A1CaseInput = {
  ctx: CaseAgentContext;
  s1_synthesis: S1CaseOutput;
  evidence_verdicts: CaseEvidenceVerdict[];
  gate_results: GateResult[];
};

function buildPrompt(input: A1CaseInput): string {
  return [
    `# A1 Adversarial Challenge Request`,
    ``,
    `## Case context`,
    ``,
    formatCaseContextHeader(input.ctx),
    ``,
    `## S1 synthesis verdict`,
    ``,
    `The synthesis you are challenging. Read it, then surface the questions a critical reviewer would ask. Do not argue against the action; ask the hard questions the synthesis should be ready to answer in the advisor's conversation with the investor.`,
    ``,
    "```json",
    JSON.stringify(input.s1_synthesis, null, 2),
    "```",
    ``,
    `## Evidence verdicts (the same bundle S1 consumed)`,
    ``,
    "```json",
    JSON.stringify(input.evidence_verdicts, null, 2),
    "```",
    ``,
    `## Governance gate results (the same bundle S1 consumed)`,
    ``,
    "```json",
    JSON.stringify(input.gate_results, null, 2),
    "```",
    ``,
    `## Output schema`,
    ``,
    `Return a single fenced JSON block with this exact shape:`,
    ``,
    "```json",
    `{`,
    `  "challenges": [`,
    `    {`,
    `      "category": "<${CATEGORIES.join(" | ")}>",`,
    `      "title": "<short headline; sentence case; specific to this case (not generic)>",`,
    `      "body": "<one paragraph posing the challenge as a question the synthesis should be ready to answer; cite specific evidence from the verdicts or gates where relevant; institutional voice, no rhetoric>"`,
    `    }`,
    `  ]`,
    `}`,
    "```",
    ``,
    `## Challenge discipline`,
    ``,
    `- Specificity: every challenge must be specific to this case. If a challenge could equally apply to any PMS proposal, drop it; that is generic boilerplate, not adversarial review. Anchor in the specific evidence (driver, flag, data point) or gate result (gap, breach) that motivates the challenge.`,
    `- Three categories. counter_argument poses an alternative reading of the same evidence. stress_test asks how the verdict holds under a specific adverse scenario (rate shock, FII outflow, regulatory shift, manager departure, capacity inflection). edge_case names a configuration the synthesis may not have considered (illiquidity window, tax-year boundary, household-life-event coincidence).`,
    `- Volume: 3-7 challenges total across the three categories. More than 7 reads as a kitchen sink; fewer than 3 reads as box-ticking. Distribute roughly evenly across categories where the case warrants; concentrate where the evidence concentrates concerns.`,
    `- Voice: critical reviewer, not antagonist. The challenge respects the synthesis's read; it asks what the synthesis must be ready to answer. Avoid "this is wrong" framings; prefer "the verdict assumes X — what if Y?"`,
    `- No decision language. A1 does not recommend; it questions. "Should the household defer?" is fine; "We recommend deferring" is not.`,
    `- Cite. Where a challenge draws on a specific evidence verdict or gate result, name the agent or gate ("E4's wrapper_count_accumulation_pattern flag pairs with E6's equity_band_at_upper_boundary — what is the threshold at which this combination warrants pause?").`,
    ``,
    `Respond with a single fenced JSON block. No prose outside the fence.`,
  ].join("\n");
}

function validate(raw: unknown): A1Output {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("A1 output is not an object");
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.challenges)) {
    throw new Error("A1 output.challenges must be an array");
  }
  for (const item of o.challenges as unknown[]) {
    const c = item as Record<string, unknown>;
    if (typeof c.category !== "string" || !CATEGORIES.includes(c.category as AdvisoryChallengeItem["category"])) {
      throw new Error(`A1 challenge category invalid: ${c.category}`);
    }
    if (typeof c.title !== "string" || c.title.trim().length === 0) {
      throw new Error("A1 challenge title missing or empty");
    }
    if (typeof c.body !== "string" || c.body.trim().length === 0) {
      throw new Error("A1 challenge body missing or empty");
    }
  }
  return { challenges: o.challenges as AdvisoryChallengeItem[] };
}

export function runA1Case(
  input: A1CaseInput,
  opts: { stubKey?: { caseFixtureId: string } } = {},
): Promise<AgentCallResult<A1Output>> {
  return callAgent<A1Output>({
    skillId: "a1_challenge",
    userPrompt: buildPrompt(input),
    validate,
    stubKey: opts.stubKey,
  });
}
