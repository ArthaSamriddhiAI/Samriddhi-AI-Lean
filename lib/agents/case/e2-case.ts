/* E2 case-mode: industry and business-model analysis of the proposed
 * action's look-through. Activated whenever E1 activates (per skill).
 * The agent reads sector concentration, business-model coherence, moat
 * positioning, and cycle-stage of the target instrument's underlying
 * sectors.
 */

import { runCaseAgent } from "./runner";
import type { CaseAgentContext } from "./case-context";
import type { ActivatedVerdict } from "./case-verdict";
import type { AgentCallResult } from "../harness";

export type E2CaseScope = {
  /** Sector and business-model context for the proposed target. For
   * PMS/MF proposals this is the disclosed top-sector weights and
   * business categorisation; for listed-equity-direct proposals it's
   * the single stock's sector. */
  sectorContext: string;
};

export function runE2Case(
  ctx: CaseAgentContext,
  scope: E2CaseScope,
  opts: { stubKey?: { caseFixtureId: string } } = {},
): Promise<AgentCallResult<ActivatedVerdict>> {
  const scopeBlock = [
    "Industry and business-model context for the proposed target:",
    scope.sectorContext,
    "",
    "Evaluate sector concentration, business-model coherence across the",
    "look-through, moat assessment, cycle-stage positioning for the",
    "dominant sectors, and Five Forces or equivalent industry-structure",
    "read. Cite specific weights and category-level evidence. Produce a",
    "single aggregate verdict on the target's industry exposure.",
  ].join("\n");

  return runCaseAgent({
    agentId: "e2_industry_business",
    agentLabel: "E2 (Industry / Business Model)",
    scopeBlock,
    ctx,
    stubKey: opts.stubKey,
  });
}
