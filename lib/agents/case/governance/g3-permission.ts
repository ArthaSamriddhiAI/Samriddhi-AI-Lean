/* G3, action permission filter gate.
 *
 * Evaluates whether the advisor is permitted to action the proposal at
 * this firm at this seniority level. The Slice 3 MVP ships with a
 * single advisor role (Priya Nair, UHNI desk), so the filter is a
 * placeholder that always passes; the gate structure exists so future
 * multi-role firms (CIO sign-off, compliance approval, junior advisor
 * limits) can enable rules without restructuring the governance layer.
 *
 * When future rules land, they will read:
 *   - Advisor role / seniority (from a Settings or User table)
 *   - Action class (proposed_action vs scenario vs diagnostic)
 *   - Ticket size against advisor's authority ceiling
 *   - Firm-specific delegated authority matrix
 */

import type { Proposal } from "../../proposal";
import { passResult, type GateResult } from "./types";

export function runG3(opts: { proposal: Proposal; advisorName: string }): GateResult {
  return passResult(
    "g3_action_permission",
    `Single-advisor MVP; ${opts.advisorName} has unrestricted action authority. Multi-role permission rules activate in a future slice.`,
    {
      advisor_name: opts.advisorName,
      action_type: opts.proposal.action_type,
      ticket_cr: opts.proposal.ticket_size_cr,
      rules_active: false,
    },
  );
}
