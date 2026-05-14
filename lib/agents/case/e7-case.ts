/* E7 case-mode: mutual fund scheme analysis. Activates when the proposed
 * target is a specific mutual fund scheme (new MF entry, MF switch, MF
 * exit, MF allocation rebalance). For Sharma + Marcellus this does not
 * activate (target is a PMS, not an MF); the orchestrator constructs a
 * deterministic non-activation verdict.
 *
 * Where MF holdings provide listed-equity look-through in a non-MF
 * action, the look-through is handled by E1 at aggregate level rather
 * than by E7 at scheme level. E7 stays focused on scheme-level decisions
 * (manager, mandate, fee, scheme-level risk).
 */

import { runCaseAgent } from "./runner";
import type { CaseAgentContext } from "./case-context";
import type { ActivatedVerdict } from "./case-verdict";
import type { AgentCallResult } from "../harness";

export type E7CaseScope = {
  /** Target MF scheme description (or source MF being exited). */
  schemeContext: string;
  /** Existing MF allocation summary, when relevant for impact reads. */
  existingMfAllocation: string;
};

export function runE7Case(
  ctx: CaseAgentContext,
  scope: E7CaseScope,
  opts: { stubKey?: { caseFixtureId: string } } = {},
): Promise<AgentCallResult<ActivatedVerdict>> {
  const scopeBlock = [
    "Target scheme context:",
    scope.schemeContext,
    "",
    "Existing MF allocation:",
    scope.existingMfAllocation,
    "",
    "Evaluate at the scheme level: manager tenure and continuity,",
    "mandate adherence and style drift, fee structure (Direct vs Regular,",
    "TER, exit load), category positioning, risk-adjusted return profile",
    "(rolling beat frequency, alpha trend, regime stability, capture",
    "ratios), and capacity vs strategy. Surface the impact on existing",
    "MF allocation only when material.",
  ].join("\n");

  return runCaseAgent({
    agentId: "e7_mutual_fund",
    agentLabel: "E7 (Mutual Fund)",
    scopeBlock,
    ctx,
    stubKey: opts.stubKey,
  });
}
