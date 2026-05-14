/* E1 case-mode: listed/fundamental equity analysis of the proposed action's
 * look-through. For Samriddhi 1, E1 examines the target instrument's
 * underlying listed equity (e.g., Marcellus's ~25 top holdings) at the
 * portfolio-of-portfolios level, not per-stock as in Slice 2 diagnostic
 * mode. The verdict shape is the proposal-evaluation shape from
 * sharma_marcellus_evidence_verdicts.md (activation_status, risk_level,
 * confidence, drivers, flags, reasoning_paragraph, data_points_cited).
 */

import { runCaseAgent } from "./runner";
import type { CaseAgentContext } from "./case-context";
import type { ActivatedVerdict } from "./case-verdict";
import type { AgentCallResult } from "../harness";

export type E1CaseScope = {
  /** Free-text scope block describing the look-through universe for the
   * target instrument. For a PMS proposal this is typically the
   * strategy's top-25 holdings; for an MF proposal it's the scheme's
   * disclosed top holdings. The orchestrator builds this string from
   * available data (snapshot look-through where covered, model
   * knowledge of the strategy otherwise). For commit 4 this is just
   * the target instrument name and category; commit 9's live-mode
   * generation supplies richer scope when stubs aren't available. */
  lookthroughDescription: string;
};

export function runE1Case(
  ctx: CaseAgentContext,
  scope: E1CaseScope,
  opts: { stubKey?: { caseFixtureId: string } } = {},
): Promise<AgentCallResult<ActivatedVerdict>> {
  const scopeBlock = [
    "Listed-equity look-through for the proposed target:",
    scope.lookthroughDescription,
    "",
    "Evaluate the look-through universe on aggregate metrics relevant to a",
    "quality/valuation/growth read (ROCE, P/E, leverage, earnings growth,",
    "moat assessment). Cite specific figures. Do not generate per-stock",
    "verdicts; produce a single aggregate verdict on the target's listed-",
    "equity exposure.",
  ].join("\n");

  return runCaseAgent({
    agentId: "e1_listed_fundamental_equity",
    agentLabel: "E1 (Listed / Fundamental Equity)",
    scopeBlock,
    ctx,
    stubKey: opts.stubKey,
  });
}
