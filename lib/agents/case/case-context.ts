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

/* Placeholder for M0.IndianContext output. Commit 3 (blocked on
 * Workstream C YAML knowledge stores) replaces this with the
 * deterministic schema derived from the curated stores. Until then,
 * commits 4-7 carry IndianContext as a nullable optional context
 * field; agents include it in their prompts when present and proceed
 * without it when null. BUILD_NOTES at slice close documents this
 * soft dependency. */
export type IndianContextSummary = {
  tax_structure?: string;
  lock_in_mechanics?: string;
  regulatory_eligibility?: string;
  surcharge_implications?: string;
  structure_specific_considerations?: string;
  /** Escape hatch for fields the commit-3 schema may introduce. */
  raw?: Record<string, unknown>;
};

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
    return "INDIAN CONTEXT\nNot yet integrated (Slice 3 commit 3 pending Workstream C YAML curation). Proceed using investor mandate, structure, and product-category defaults.";
  }
  const lines: string[] = ["INDIAN CONTEXT"];
  if (ic.tax_structure) lines.push(`Tax structure: ${ic.tax_structure}`);
  if (ic.lock_in_mechanics) lines.push(`Lock-in mechanics: ${ic.lock_in_mechanics}`);
  if (ic.regulatory_eligibility) lines.push(`Regulatory eligibility: ${ic.regulatory_eligibility}`);
  if (ic.surcharge_implications) lines.push(`Surcharge implications: ${ic.surcharge_implications}`);
  if (ic.structure_specific_considerations) {
    lines.push(`Structure-specific considerations: ${ic.structure_specific_considerations}`);
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
