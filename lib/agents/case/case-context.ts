/* Shared context passed to every Samriddhi 1 evidence agent.
 *
 * The case context anchors the per-agent prompts to the same proposal,
 * investor, mandate, and (when commit 3 lands) IndianContext output.
 * Each agent function builds its user prompt from this context plus
 * agent-specific scope (e.g., listed-equity look-through for E1/E2,
 * macro snapshot data for E3, behavioural history for E4, wrapper
 * inventory for E6). The system prompt is loaded via skill-loader and
 * is unchanged from the byte-identical skill files; only the user
 * prompt changes between modes per the Slice 2 Q2 pattern.
 */

import type { Proposal } from "../proposal";
import type { IndianContextSummary } from "../m0-indian-context";

/* M0.IndianContext output. The Slice 3 placeholder is superseded: the
 * curated deterministic schema now lives with the agent in
 * lib/agents/m0-indian-context.ts (Workstream C closed 2026-05-17,
 * DEFERRED item 6 resolved). Re-exported here so existing call sites
 * importing the type from case-context keep resolving. */
export type { IndianContextSummary };

export type CaseAgentContext = {
  caseId: string;
  asOfDate: string;
  investorName: string;
  /** Pre-formatted human-readable mandate line, e.g.
   *  "risk_appetite: Aggressive; time_horizon: Over 5y; ...
   *   equity band 50-70%; current equity 55%; wrapper ceilings: none explicit". */
  investorMandate: string;
  /** Pre-formatted scope description, e.g.
   *  "Liquid AUM Rs 18 Cr across 8 holdings: 1 PMS, 1 AIF, 3 MF, 2 FD, 1 cash". */
  portfolioScope: string;
  /** Full proposal capture from the case opening form. */
  proposal: Proposal;
  /** Null until commit 3 lands; populated by M0.IndianContext when wired. */
  indianContext: IndianContextSummary | null;
};

/* Helpers — format the case context as plain text blocks for inclusion in
 * agent user prompts. Each agent inserts these blocks plus its own scope
 * data and instructs the model to produce a verdict in the case-verdict
 * shape. */

export function formatProposalBlock(p: Proposal): string {
  const rationaleLine = p.rationale ? `\nRationale: ${p.rationale}` : "";
  return [
    "PROPOSED ACTION",
    `Action type: ${p.action_type}`,
    `Target instrument: ${p.target_instrument} (category: ${p.target_category})`,
    `Ticket size: Rs ${p.ticket_size_cr} Cr`,
    `Source of funds: ${p.source_of_funds}`,
    `Timeline: ${p.timeline}${rationaleLine}`,
  ].join("\n");
}

export function formatIndianContextBlock(ic: IndianContextSummary | null): string {
  if (!ic) {
    return "INDIAN CONTEXT\nNot available for this case. Proceed using investor mandate, structure, and product-category defaults.";
  }
  const lines: string[] = [
    "INDIAN CONTEXT",
    `Source: M0.IndianContext (deterministic; curated YAML stores tax_matrix v${ic.store_versions.tax_matrix}, sebi_boundaries v${ic.store_versions.sebi_boundaries}, structure_matrix v${ic.store_versions.structure_matrix}, demat_mechanics v${ic.store_versions.demat_mechanics}, gift_city_routing v${ic.store_versions.gift_city_routing}, regulatory_changelog v${ic.store_versions.regulatory_changelog}). Indicative reference data; not validated by credentialed domain experts as a whole.`,
    `Investor structure: ${ic.investor_structure.structure_type} / ${ic.investor_structure.residency}${ic.investor_structure.legacy_alias_applied ? ` (alias: ${ic.investor_structure.legacy_alias_applied})` : ""}`,
    `Tax structure: ${ic.tax_structure}`,
    `Surcharge implications: ${ic.surcharge_implications}`,
    `Lock-in mechanics: ${ic.lock_in_mechanics}`,
    `Regulatory eligibility: ${ic.regulatory_eligibility}`,
    `Structure-specific considerations: ${ic.structure_specific_considerations}`,
  ];
  if (ic.sebi_minimums.length > 0) {
    lines.push(
      `SEBI minimum tickets: ${ic.sebi_minimums
        .map(
          (m) =>
            `${m.product} Rs ${(m.min_ticket_inr / 100000).toFixed(0)} lakh [${m.source_entry_id}, ${m.confidence}]`,
        )
        .join("; ")}`,
    );
  }
  if (ic.applicable_regulatory_changes.length > 0) {
    lines.push(
      `Time-aware regulatory events on/before the decision date: ${ic.applicable_regulatory_changes
        .map((c) => `${c.entry_id} ${c.topic} (eff ${c.effective_date})`)
        .join("; ")}`,
    );
  }
  if (ic.indicative_flags.length > 0) {
    lines.push(
      `Indicative-confidence framings (treat as practitioner practice, not authoritative): ${ic.indicative_flags.join(" | ")}`,
    );
  }
  if (ic.edge_cases_flagged.length > 0) {
    lines.push(`Edge cases flagged: ${ic.edge_cases_flagged.join(" | ")}`);
  }
  return lines.join("\n");
}

export function formatCaseContextHeader(ctx: CaseAgentContext): string {
  return [
    `Case ID: ${ctx.caseId}`,
    `As of: ${ctx.asOfDate}`,
    `Investor: ${ctx.investorName}`,
    `Mandate: ${ctx.investorMandate}`,
    `Portfolio scope: ${ctx.portfolioScope}`,
    "",
    formatProposalBlock(ctx.proposal),
    "",
    formatIndianContextBlock(ctx.indianContext),
  ].join("\n");
}

/* The verdict-shape instruction is identical across the activated
 * agents (E1, E2, E3, E4, E6 for the canonical Sharma case). Centralised
 * here so the wording stays uniform; small wording shifts between
 * agents would create spurious training-distribution noise. */
export function verdictShapeInstruction(agentLabel: string): string {
  return [
    `Produce a single fenced JSON block matching this ${agentLabel} verdict shape:`,
    "",
    "```json",
    "{",
    `  "activation_status": "activated",`,
    `  "risk_level": "low" | "moderate" | "elevated" | "high",`,
    `  "confidence": 0.0–1.0,`,
    `  "drivers": ["..."],`,
    `  "flags": ["..."],`,
    `  "reasoning_paragraph": "...",`,
    `  "data_points_cited": ["..."]`,
    "}",
    "```",
    "",
    "Drivers list the specific evidence points the verdict rests on; flags name structural concerns in snake_case; reasoning_paragraph is one institutional-voice paragraph; data_points_cited lists the numeric and factual anchors used. Match the institutional register of the Lean Samriddhi MVP foundation document's analytical voice (calm, deterministic, no decision language).",
  ].join("\n");
}

export function nonActivationInstruction(agentLabel: string, reasonHint: string): string {
  return [
    `${agentLabel} is not activated for this case. Produce a single fenced JSON block:`,
    "",
    "```json",
    "{",
    `  "activation_status": "not_activated",`,
    `  "reason_for_non_activation": "..."`,
    "}",
    "```",
    "",
    `The reason should be specific to this case (not boilerplate) and ground the non-activation in the architecture's activation rules. Hint: ${reasonHint}`,
  ].join("\n");
}
