/* G2, SEBI and regulatory gate.
 *
 * Deterministic rule evaluation against SEBI tables for the proposal's
 * target category. Slice 3 MVP scope:
 *   - PMS: minimum ticket Rs 50 lakh (PMS Regulations 2020 §5)
 *   - AIF Cat I / II / III: minimum ticket Rs 1 Cr (AIF Regulations 2012)
 *   - Mutual funds: no SEBI per-investor minimum (scheme-level minimums
 *     vary by scheme; handled by E7 in the live-mode path)
 *   - Listed equity, FDs, cash, gold: no SEBI ticket gates
 *
 * Future additions (out of scope for Slice 3): AIF Cat II structure-fit
 * (HUF eligibility, NRI routing through GIFT city), SIF scheme-level
 * rules when SIF activates, MF scheme rules from M0.IndianContext
 * sebi_boundaries YAML once Workstream C completes.
 */

import type { Proposal, TargetCategory } from "../../proposal";
import { failResult, passResult, requiresClarificationResult, type GateResult } from "./types";

type SebiTicketRule = {
  category: TargetCategory;
  min_ticket_cr: number;
  citation: string;
};

const SEBI_TICKET_RULES: SebiTicketRule[] = [
  { category: "pms", min_ticket_cr: 0.5, citation: "SEBI PMS Regulations 2020 §5; minimum investment Rs 50 lakh per investor." },
  { category: "aif", min_ticket_cr: 1.0, citation: "SEBI AIF Regulations 2012; minimum investment Rs 1 crore (Rs 25 lakh for employees / directors of the manager, not covered here)." },
];

export function runG2(opts: { proposal: Proposal }): GateResult {
  const trace: Record<string, unknown> = {
    target_category: opts.proposal.target_category,
    ticket_cr: opts.proposal.ticket_size_cr,
    action_type: opts.proposal.action_type,
  };

  const ticketRule = SEBI_TICKET_RULES.find((r) => r.category === opts.proposal.target_category);
  if (ticketRule) {
    if (opts.proposal.ticket_size_cr < ticketRule.min_ticket_cr) {
      const breach = `${opts.proposal.target_category.toUpperCase()} minimum ticket: SEBI requires Rs ${ticketRule.min_ticket_cr * 100} lakh; proposed Rs ${(opts.proposal.ticket_size_cr * 100).toFixed(0)} lakh.`;
      return failResult(
        "g2_sebi_regulatory",
        breach,
        [breach, ticketRule.citation],
        { ...trace, rule_applied: ticketRule },
      );
    }
    return passResult(
      "g2_sebi_regulatory",
      `SEBI ${opts.proposal.target_category.toUpperCase()} minimum ticket cleared (Rs ${ticketRule.min_ticket_cr * 100} lakh required, Rs ${(opts.proposal.ticket_size_cr * 100).toFixed(0)} lakh proposed).`,
      { ...trace, rule_applied: ticketRule },
    );
  }

  /* Targets without a SEBI ticket rule in the MVP table. Categories that
   * appear in SEBI_TICKET_RULES (pms, aif) are handled above and listed
   * here only so the switch is exhaustive. */
  switch (opts.proposal.target_category) {
    case "pms":
    case "aif":
      // unreachable; the ticketRule branch returned above.
      return passResult(
        "g2_sebi_regulatory",
        "SEBI ticket rule applied above.",
        trace,
      );
    case "mutual_fund":
      return requiresClarificationResult(
        "g2_sebi_regulatory",
        "SEBI MF scheme-level rules not in MVP rules table; clarification on the specific scheme's SEBI category and minimum applies.",
        [
          "MVP G2 does not yet evaluate scheme-level SEBI rules for mutual funds (category, sub-scheme limits, exit load tiers). E7 handles scheme-level analysis in the evidence layer; G2 will activate scheme-level rules in a future slice.",
        ],
        trace,
      );
    case "listed_equity_direct":
    case "fixed_deposit":
    case "bond_listed":
    case "cash":
    case "gold":
      return passResult(
        "g2_sebi_regulatory",
        `No SEBI ticket gate applies to ${opts.proposal.target_category}.`,
        trace,
      );
    case "unlisted_equity":
      return requiresClarificationResult(
        "g2_sebi_regulatory",
        "Unlisted equity transactions: SEBI category depends on the structure (founder shares, pre-IPO via AIF route, direct private placement).",
        [
          "Clarify the legal route for the unlisted exposure (direct private placement, AIF Cat I venture, sponsor-route family business equity). The SEBI gate evaluation depends on which route applies.",
        ],
        trace,
      );
    case "other":
      return requiresClarificationResult(
        "g2_sebi_regulatory",
        "Target category is 'other'; SEBI rule evaluation requires the specific instrument structure.",
        ["target_category=other does not map to a known SEBI rule path. Clarify the instrument structure."],
        trace,
      );
  }
}
