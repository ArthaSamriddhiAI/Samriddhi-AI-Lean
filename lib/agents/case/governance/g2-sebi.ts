/* G2, SEBI and regulatory gate.
 *
 * Deterministic rule evaluation against SEBI minimum-ticket rules for the
 * proposal's target category. The deterministic logic is unchanged from
 * the Slice 3 MVP; only the SOURCE OF TRUTH moved: the PMS / AIF minimum
 * ticket and its citation now come from the curated sebi_boundaries store
 * via M0.IndianContext.getSebiTicketRule (Workstream C closed 2026-05-17,
 * DEFERRED item 6 resolved) instead of a hardcoded MVP table.
 *
 *   - PMS: minimum ticket from sebi_boundaries sebi_001 (Rs 50 lakh)
 *   - AIF Cat I / II / III: minimum ticket from sebi_009 (Rs 1 crore)
 *   - Mutual funds: no SEBI per-investor minimum (scheme-level minimums
 *     vary by scheme; handled by E7 in the live-mode path)
 *   - Listed equity, FDs, cash, gold: no SEBI ticket gates
 *
 * The curated YAML minima are byte-identical to the prior MVP table
 * values (PMS Rs 50 lakh, AIF Rs 1 crore), so no verdict shifts; the
 * gate now emits the audit-grade YAML citation and source entry_id in
 * its rule_trace rather than a short hardcoded string.
 *
 * Future additions (out of scope): AIF Cat II structure-fit (HUF
 * eligibility, NRI routing through GIFT city), SIF scheme-level rules
 * when SIF activates, MF scheme rules from sebi_boundaries.
 */

import type { Proposal } from "../../proposal";
import { getSebiTicketRule } from "../../m0-indian-context";
import { failResult, passResult, requiresClarificationResult, type GateResult } from "./types";

export async function runG2(opts: { proposal: Proposal }): Promise<GateResult> {
  const trace: Record<string, unknown> = {
    target_category: opts.proposal.target_category,
    ticket_cr: opts.proposal.ticket_size_cr,
    action_type: opts.proposal.action_type,
    reference_data_source: "m0_indian_context:sebi_boundaries",
  };

  const ticketRule = await getSebiTicketRule(opts.proposal.target_category);
  if (ticketRule) {
    const ruleApplied = {
      category: opts.proposal.target_category,
      min_ticket_cr: ticketRule.min_ticket_cr,
      source_store: ticketRule.source_store,
      source_entry_id: ticketRule.source_entry_id,
      confidence: ticketRule.confidence,
      citation: ticketRule.citation,
    };
    if (opts.proposal.ticket_size_cr < ticketRule.min_ticket_cr) {
      const breach = `${opts.proposal.target_category.toUpperCase()} minimum ticket: SEBI requires Rs ${ticketRule.min_ticket_cr * 100} lakh; proposed Rs ${(opts.proposal.ticket_size_cr * 100).toFixed(0)} lakh.`;
      return failResult(
        "g2_sebi_regulatory",
        breach,
        [breach, ticketRule.citation],
        { ...trace, rule_applied: ruleApplied },
      );
    }
    return passResult(
      "g2_sebi_regulatory",
      `SEBI ${opts.proposal.target_category.toUpperCase()} minimum ticket cleared (Rs ${ticketRule.min_ticket_cr * 100} lakh required, Rs ${(opts.proposal.ticket_size_cr * 100).toFixed(0)} lakh proposed).`,
      { ...trace, rule_applied: ruleApplied },
    );
  }

  /* Targets without a SEBI minimum-ticket rule in sebi_boundaries. */
  switch (opts.proposal.target_category) {
    case "pms":
    case "aif":
      /* Unreachable in practice: sebi_001 / sebi_009 always resolve for
       * these. Retained so the switch stays exhaustive and the gate
       * fails closed (clarification, not silent pass) if the curated
       * store ever lacks the minimum-ticket entry. */
      return requiresClarificationResult(
        "g2_sebi_regulatory",
        `SEBI minimum-ticket rule for ${opts.proposal.target_category.toUpperCase()} not found in the curated sebi_boundaries store; cannot evaluate the ticket gate.`,
        [
          `Expected a minimum_ticket entry for ${opts.proposal.target_category} in agents/m0_indian_context/data/sebi_boundaries.yaml. Validate the store before opening this case.`,
        ],
        trace,
      );
    case "mutual_fund":
      return requiresClarificationResult(
        "g2_sebi_regulatory",
        "SEBI MF scheme-level rules not in the curated store; clarification on the specific scheme's SEBI category and minimum applies.",
        [
          "M0.IndianContext sebi_boundaries does not carry scheme-level SEBI rules for mutual funds (category, sub-scheme limits, exit load tiers). E7 handles scheme-level analysis in the evidence layer; G2 will activate scheme-level rules in a future slice.",
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
