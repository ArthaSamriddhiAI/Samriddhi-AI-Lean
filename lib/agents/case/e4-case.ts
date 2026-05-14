/* E4 case-mode: behavioural and historical analysis of the proposed
 * action against the investor's stated/revealed risk patterns. Always
 * activated on proposed_action per skill (the action itself is a new
 * behavioural data point worth surfacing). The agent reads the
 * investor profile, prior advisor interactions (when present), and the
 * action's behavioural signal.
 */

import { runCaseAgent } from "./runner";
import type { CaseAgentContext } from "./case-context";
import type { ActivatedVerdict } from "./case-verdict";
import type { AgentCallResult } from "../harness";

export type E4CaseScope = {
  /** Investor profile markdown (the foundation §4 character bible).
   * Includes stated risk, revealed patterns, prior decisions, household
   * structure, and biographical anchors. */
  profileMd: string;
  /** Number of prior advisor interactions on record. Zero for the MVP
   * demo set; populated when interaction history exists. */
  priorInteractionsCount: number;
};

export function runE4Case(
  ctx: CaseAgentContext,
  scope: E4CaseScope,
  opts: { stubKey?: { caseFixtureId: string } } = {},
): Promise<AgentCallResult<ActivatedVerdict>> {
  const scopeBlock = [
    "Investor profile (character bible):",
    "",
    scope.profileMd,
    "",
    `Prior advisor interactions on record: ${scope.priorInteractionsCount}`,
    "",
    "Evaluate the proposed action against the investor's stated/revealed",
    "risk tolerance, prior decision patterns, liquidity behaviour, and",
    "the structural signal the action carries (e.g., wrapper accumulation,",
    "reserve compression, peer-network influence). Surface alignment and",
    "divergence honestly; do not over-pathologise routine actions.",
  ].join("\n");

  return runCaseAgent({
    agentId: "e4_behavioural_historical",
    agentLabel: "E4 (Behavioural / Historical)",
    scopeBlock,
    ctx,
    stubKey: opts.stubKey,
  });
}
