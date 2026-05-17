/* Dry-run verification for the M0.IndianContext integration (DEFERRED
 * item 6). Deterministic; no API spend.
 *
 * Confirms, against the canonical Sharma + Marcellus case input:
 *   1. The six curated YAML stores load and parse cleanly.
 *   2. buildIndianContext produces a structured bundle per the schema.
 *   3. getSebiTicketRule grounds G2's PMS minimum in sebi_boundaries.
 *   4. runG2 verdict is unchanged (PASS) with the YAML-grounded citation.
 *   5. The bundle renders into the downstream agent prompt header.
 *
 * Run via: npx tsx scripts/_verify-indian-context.ts
 */

import {
  buildIndianContext,
  getSebiTicketRule,
  loadStores,
} from "../lib/agents/m0-indian-context";
import { runG2 } from "../lib/agents/case/governance/g2-sebi";
import {
  formatCaseContextHeader,
  type CaseAgentContext,
} from "../lib/agents/case/case-context";
import type { Proposal } from "../lib/agents/proposal";

const SHARMA_PROPOSAL: Proposal = {
  action_type: "new_investment",
  target_category: "pms",
  target_instrument: "Marcellus Consistent Compounder PMS",
  ticket_size_cr: 3,
  source_of_funds: "fixed_deposits",
  timeline: "this_quarter",
  rationale:
    "Family wishes to redirect FD reserve into a quality-compounder PMS.",
};

function assert(cond: boolean, label: string): void {
  if (!cond) {
    console.error(`  FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`  ok: ${label}`);
  }
}

async function main() {
  console.log("M0.IndianContext integration dry-run");
  console.log("====================================\n");

  console.log("1. Stores load and parse");
  const stores = await loadStores();
  for (const [id, s] of Object.entries(stores)) {
    console.log(
      `  ${id}: v${(s.metadata as { version?: string }).version} (${s.entries.length} entries)`,
    );
    assert(s.entries.length > 0, `${id} has entries`);
  }

  console.log("\n2. buildIndianContext (Sharma: individual filer, PMS, Rs 3 Cr)");
  const ic = await buildIndianContext({
    caseId: "c-2026-05-14-sharma-01",
    asOfDate: "2026-04-02",
    investorStructureLine: "Family business · individual filer",
    proposalCategory: "pms",
    proposalInstrument: "Marcellus Consistent Compounder PMS",
    ticketSizeCr: 3,
  });
  console.log(JSON.stringify(ic, null, 2));
  assert(ic.mode === "bulk", "bundle mode=bulk");
  assert(
    ic.investor_structure.structure_type === "individual" &&
      ic.investor_structure.residency === "resident",
    "structure resolved individual/resident",
  );
  assert(ic.citations.length > 0, "bundle carries citations");
  assert(
    ic.store_versions.tax_matrix === "1.1" &&
      ic.store_versions.sebi_boundaries === "1.2",
    "store version pins surfaced (tax v1.1, sebi v1.2)",
  );

  console.log("\n3. getSebiTicketRule('pms') grounds in sebi_boundaries");
  const rule = await getSebiTicketRule("pms");
  console.log(`  ${JSON.stringify(rule)}`);
  assert(rule !== null, "pms ticket rule resolved");
  assert(rule?.source_entry_id === "sebi_001", "sourced from sebi_001");
  assert(rule?.min_ticket_cr === 0.5, "PMS minimum Rs 50 lakh (0.5 Cr)");
  const aifRule = await getSebiTicketRule("aif");
  assert(aifRule?.source_entry_id === "sebi_009", "aif sourced from sebi_009");
  assert(aifRule?.min_ticket_cr === 1, "AIF minimum Rs 1 crore (1.0 Cr)");

  console.log("\n4. runG2 verdict stable (PASS) with YAML-grounded citation");
  const g2 = await runG2({ proposal: SHARMA_PROPOSAL });
  console.log(`  status=${g2.status} | rationale=${g2.rationale}`);
  console.log(`  rule_trace=${JSON.stringify(g2.rule_trace)}`);
  assert(g2.status === "pass", "G2 PASS (3 Cr clears 0.5 Cr) — verdict unchanged");
  assert(
    JSON.stringify(g2.rule_trace).includes("sebi_001"),
    "G2 trace cites sebi_001 (YAML-grounded source of truth)",
  );

  console.log("\n5. Bundle renders into downstream agent prompt header");
  const ctx: CaseAgentContext = {
    caseId: "c-2026-05-14-sharma-01",
    asOfDate: "2026-04-02",
    investorName: "Sharma family",
    investorMandate: "equity band 50-70%",
    portfolioScope: "Liquid AUM Rs 18 Cr",
    proposal: SHARMA_PROPOSAL,
    indianContext: ic,
  };
  const header = formatCaseContextHeader(ctx);
  const hasBlock =
    header.includes("INDIAN CONTEXT") &&
    header.includes("sebi_001") &&
    header.includes("M0.IndianContext (deterministic");
  console.log("  --- header excerpt ---");
  console.log(
    header
      .split("\n")
      .filter((l) => l.includes("INDIAN CONTEXT") || l.includes("Source:") || l.includes("SEBI minimum"))
      .join("\n"),
  );
  assert(hasBlock, "downstream agents receive the structured IndianContext block");

  console.log(
    process.exitCode === 1
      ? "\nDRY-RUN FAILED (see FAIL lines above)"
      : "\nDRY-RUN PASSED",
  );
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
