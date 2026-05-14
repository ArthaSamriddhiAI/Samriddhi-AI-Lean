/* Deterministic non-activation reasons for the Samriddhi 1 evidence
 * agents that the router did not dispatch. The orchestrator (commit 9)
 * calls this directly without an LLM round-trip, since the verdict
 * shape for non-activated agents is short and grounded in the router's
 * activation rules (principles §3.1).
 *
 * The Sharma + Marcellus canonical case's E5 and E7 non-activation
 * reasons are richer than these templates because they ship as stub
 * fixtures parsed from sharma_marcellus_evidence_verdicts.md in
 * commit 9. These templates are the fallback for live-mode case
 * generation where no stub fixture exists.
 */

import type { Proposal } from "../proposal";
import type { CaseAgentId, NonActivatedVerdict } from "./case-verdict";

function describeAction(p: Proposal): string {
  return `${p.action_type} targeting ${p.target_instrument} (category: ${p.target_category}) of Rs ${p.ticket_size_cr} Cr, sourced from ${p.source_of_funds}`;
}

const TEMPLATES: Record<CaseAgentId, (p: Proposal) => string> = {
  e1_listed_fundamental_equity: (p) =>
    `The proposed action (${describeAction(p)}) does not introduce listed equity exposure via direct, MF, or PMS look-through. Per principles §3.1, E1 activates only when the case involves listed equity in any of these forms. None apply.`,
  e2_industry_business: (p) =>
    `The proposed action (${describeAction(p)}) does not introduce listed equity exposure with sector tags. Per principles §3.1, E2 follows E1's trigger and stays dormant when E1 does not activate.`,
  e3_macro_policy_news: () =>
    `E3 is mandatorily unconditional per the router skill; this template should not fire. If you see this, the router has a bug.`,
  e4_behavioural_historical: () =>
    `E4 is always activated on proposed_action per the router skill; this template should not fire. If you see this, the router has a bug.`,
  e5_unlisted_equity: (p) =>
    `The proposed action (${describeAction(p)}) does not introduce unlisted equity exposure. Per principles §3.1, E5 activates only when the case scope includes founder shares, pre-IPO holdings, ESOP in privately held companies, family business equity within advisory scope, or AIF Cat I venture positions with material look-through to private companies. None of these conditions apply.`,
  e6_pms_aif_sif: (p) =>
    `The proposed action (${describeAction(p)}) does not target a PMS, AIF, or SIF wrapper and the source of funds is not an existing wrapper-tier position. Per principles §3.1, E6 activates only when the case involves wrapper-tier products in target or source. None apply.`,
  e7_mutual_fund: (p) =>
    `The proposed action (${describeAction(p)}) does not specifically target a mutual fund scheme, nor does the source involve an MF being exited or switched. Per principles §3.1, E7 activates when the case involves an MF scheme at the decision boundary. Where MF holdings contribute listed-equity look-through to a non-MF action, the look-through is handled by E1 at aggregate level rather than by E7 at scheme level.`,
};

export function buildNonActivationVerdict(
  agentId: CaseAgentId,
  proposal: Proposal,
): NonActivatedVerdict {
  return {
    agent_id: agentId,
    activation_status: "not_activated",
    reason_for_non_activation: TEMPLATES[agentId](proposal),
  };
}
