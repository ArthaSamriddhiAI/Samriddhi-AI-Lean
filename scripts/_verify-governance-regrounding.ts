/* Piece 3 verification: re-run the governance gates against the
 * YAML-grounded reference data and diff verdicts against every stored
 * fixture. Deterministic; zero API spend.
 *
 * Scope reconciliation: governance gates G1/G2/G3 exist only in the
 * Samriddhi 1 pipeline (pipeline-case.ts). Of the seven case fixtures on
 * disk, exactly one is Samriddhi 1 (c-2026-05-14-sharma-01); the other
 * six are Samriddhi 2 diagnostic cases whose content carries no
 * gate_results. The integration contract's "6 case fixtures, re-run
 * G1/G2/G3" maps onto the codebase as: one s1 case has gates to
 * re-evaluate; the s2 cases have nothing to re-evaluate. Both facts are
 * asserted here so the build notes are evidence-backed.
 *
 * Run via: npx tsx scripts/_verify-governance-regrounding.ts
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { runG1 } from "../lib/agents/case/governance/g1-mandate";
import { runG2 } from "../lib/agents/case/governance/g2-sebi";
import { runG3 } from "../lib/agents/case/governance/g3-permission";
import { HOLDINGS_BY_INVESTOR } from "../db/fixtures/structured-holdings";
import { MANDATES_BY_INVESTOR } from "../db/fixtures/structured-mandates";
import type { Proposal } from "../lib/agents/proposal";

const CASES_DIR = path.resolve(process.cwd(), "db", "fixtures", "cases");
const ADVISOR_NAME = "Priya Nair";

let failed = false;
function check(cond: boolean, label: string): void {
  console.log(`  ${cond ? "ok" : "FAIL"}: ${label}`);
  if (!cond) failed = true;
}

async function main() {
  console.log("Piece 3: governance verdict re-grounding verification");
  console.log("=====================================================\n");

  const files = (await fs.readdir(CASES_DIR)).filter((f) => f.endsWith(".json")).sort();
  let s1Count = 0;
  let s2Count = 0;

  for (const file of files) {
    const fixture = JSON.parse(await fs.readFile(path.join(CASES_DIR, file), "utf-8"));
    const content =
      typeof fixture.content === "string" ? JSON.parse(fixture.content) : fixture.content;
    const workflow = fixture.workflow;
    const hasGates = Array.isArray(content.gate_results);

    if (workflow !== "s1") {
      s2Count += 1;
      console.log(`${file}: workflow=${workflow}, no governance gates`);
      check(!hasGates, `${file} carries no gate_results (s2 diagnostic, nothing to re-evaluate)`);
      continue;
    }

    s1Count += 1;
    console.log(`\n${file}: workflow=s1, re-running G1/G2/G3 YAML-grounded`);
    const investorId: string = fixture.investorId;
    const holdings = HOLDINGS_BY_INVESTOR[investorId];
    const mandate = MANDATES_BY_INVESTOR[investorId];
    const proposal = content.proposal as Proposal;
    const stored: Record<string, string> = Object.fromEntries(
      content.gate_results.map((g: { gate_id: string; status: string }) => [
        g.gate_id,
        g.status,
      ]),
    );

    const g1 = runG1({
      investorId,
      investorName: fixture.investorId === "sharma" ? "Sharma family" : investorId,
      liquidAumCr: holdings.totalLiquidAumCr,
      holdings,
      mandate,
      proposal,
    });
    const g2 = await runG2({ proposal });
    const g3 = runG3({ proposal, advisorName: ADVISOR_NAME });

    for (const g of [g1, g2, g3]) {
      const before = stored[g.gate_id];
      const after = g.status;
      const verdictMatch = before === after;
      console.log(
        `  ${g.gate_id}: stored=${before} -> regrounded=${after} ${verdictMatch ? "(match)" : "(SHIFT)"}`,
      );
      check(verdictMatch, `${g.gate_id} verdict stable (${before})`);
    }

    /* G2's rule citations vary by target_category (mirrors g2-sebi.ts):
     *   - pms: cites sebi_001 (PMS minimum-ticket rule, Rs 50 lakh)
     *   - aif: cites sebi_009 (AIF minimum-ticket rule, Rs 1 crore)
     *   - mutual_fund / mutual_fund_debt: requires_clarification per P25
     *     (scheme-level MF rules not curated; no sebi entry is cited)
     *   - listed_equity_direct / fixed_deposit / bond_listed / cash / gold:
     *     pass, no SEBI ticket gate applies (no sebi entry is cited)
     *   - unlisted_equity / other: requires_clarification (route-dependent)
     * Each assertion mirrors actual G2 behavior; update both when G2 evolves.
     * The reference_data_source stamp is present on every trace regardless. */
    const g2TraceStr = JSON.stringify(g2.rule_trace);
    const targetCategory = proposal.target_category;
    if (targetCategory === "pms") {
      check(
        g2TraceStr.includes("sebi_001"),
        `G2 rule_trace cites sebi_001 for ${targetCategory} (PMS minimum-ticket rule, YAML-grounded)`,
      );
    } else if (targetCategory === "aif") {
      check(
        g2TraceStr.includes("sebi_009"),
        `G2 rule_trace cites sebi_009 for ${targetCategory} (AIF minimum-ticket rule, YAML-grounded)`,
      );
    } else if (targetCategory === "mutual_fund" || targetCategory === "mutual_fund_debt") {
      check(
        g2.status === "requires_clarification",
        `G2 returns requires_clarification for ${targetCategory} (MF scheme rules not curated; P25)`,
      );
    } else if (targetCategory === "unlisted_equity" || targetCategory === "other") {
      check(
        g2.status === "requires_clarification",
        `G2 returns requires_clarification for ${targetCategory} (SEBI route depends on structure)`,
      );
    } else {
      check(
        g2.status === "pass",
        `G2 passes with no SEBI ticket gate for ${targetCategory}`,
      );
    }
    check(
      g2TraceStr.includes("m0_indian_context:sebi_boundaries"),
      "G2 rule_trace records reference_data_source = m0_indian_context",
    );
  }

  console.log(
    `\nSummary: ${s1Count} Samriddhi 1 case (governance re-evaluated), ${s2Count} Samriddhi 2 cases (no governance gates).`,
  );
  console.log(
    failed
      ? "RESULT: a verdict SHIFTED. Piece 4 (S1 re-run) is required; flag for review."
      : "RESULT: all governance verdicts stable. Piece 4 (S1 re-run) is correctly skipped.",
  );
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
