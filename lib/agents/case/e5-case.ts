/* E5 case-mode: unlisted equity specialist analysis. Activates when the
 * proposed target or source involves unlisted equity (founder shares,
 * pre-IPO holdings, ESOP in private companies, family business equity
 * within advisory scope, AIF Cat I venture with material private
 * look-through). For Sharma + Marcellus this does not activate (target
 * is a listed-equity PMS); the orchestrator constructs a deterministic
 * non-activation verdict from the router decision.
 *
 * When activated (e.g., a case where the action exits a founder-share
 * block into a wrapper), the function asks the agent to evaluate the
 * unlisted position's valuation framing, liquidity path, and structural
 * considerations.
 */

import { runCaseAgent } from "./runner";
import type { CaseAgentContext } from "./case-context";
import type { ActivatedVerdict } from "./case-verdict";
import type { AgentCallResult } from "../harness";

export type E5CaseScope = {
  /** Description of the unlisted exposure introduced or modified by the
   * action. For founder-share exits this is the company description and
   * stake size; for pre-IPO entries this is the round details and
   * valuation framing. */
  unlistedContext: string;
};

export function runE5Case(
  ctx: CaseAgentContext,
  scope: E5CaseScope,
  opts: { stubKey?: { caseFixtureId: string } } = {},
): Promise<AgentCallResult<ActivatedVerdict>> {
  const scopeBlock = [
    "Unlisted equity context:",
    scope.unlistedContext,
    "",
    "Evaluate valuation framing (last-priced-round, comparable-public,",
    "DCF where applicable), liquidity path (IPO timeline, secondary-",
    "market depth, ROFR / drag / tag dynamics), and structural",
    "considerations (lock-in, info rights, governance). Cite specific",
    "evidence; flag where the unlisted nature of the position materially",
    "shifts the risk read.",
  ].join("\n");

  return runCaseAgent({
    agentId: "e5_unlisted_equity",
    agentLabel: "E5 (Unlisted Equity Specialist)",
    scopeBlock,
    ctx,
    stubKey: opts.stubKey,
  });
}
