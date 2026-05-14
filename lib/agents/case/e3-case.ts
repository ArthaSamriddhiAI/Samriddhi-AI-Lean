/* E3 case-mode: macro, policy, and news context for the proposed
 * action. Mandatorily unconditional (per skill §"Applicability Vector
 * Determination"). The agent reads the macro snapshot, regulatory
 * backdrop, and material news as the operating environment in which
 * the proposed action would land.
 */

import { runCaseAgent } from "./runner";
import type { CaseAgentContext } from "./case-context";
import type { ActivatedVerdict } from "./case-verdict";
import type { AgentCallResult } from "../harness";

export type E3CaseScope = {
  /** Macro data block from the as-of snapshot. JSON-stringified by the
   * orchestrator and embedded in the prompt; the agent treats it as the
   * authoritative macro context and does not invent indicators outside
   * it. */
  macroDataJson: string;
};

export function runE3Case(
  ctx: CaseAgentContext,
  scope: E3CaseScope,
  opts: { stubKey?: { caseFixtureId: string } } = {},
): Promise<AgentCallResult<ActivatedVerdict>> {
  const scopeBlock = [
    "Macro data snapshot (treat as the only available macro context;",
    "do not invent indicators not present here):",
    "",
    "```json",
    scope.macroDataJson,
    "```",
    "",
    "Evaluate the macro environment as it bears on the proposed action.",
    "Particular attention to: rate cycle (FD reinvestment compression",
    "matters when source_of_funds = fixed_deposits), equity valuation",
    "cycle phase, regulatory backdrop for the target's product category",
    "(SEBI rules where relevant), and any material news within the case",
    "decision window. Cite specific indicator values.",
  ].join("\n");

  return runCaseAgent({
    agentId: "e3_macro_policy_news",
    agentLabel: "E3 (Macro / Policy / News)",
    scopeBlock,
    ctx,
    stubKey: opts.stubKey,
  });
}
