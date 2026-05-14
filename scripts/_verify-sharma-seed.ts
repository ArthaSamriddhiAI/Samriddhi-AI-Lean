/* Throwaway verification script: confirms the Sharma case row loaded
 * via npm run db:seed and reads with the Slice 3 schema fields populated.
 * Run via: npx tsx scripts/_verify-sharma-seed.ts
 *
 * This script is a one-off check; remove after the Sharma quality gate
 * passes if it's no longer useful. */

import { prisma } from "../lib/prisma";

async function main() {
  const c = await prisma.case.findUnique({ where: { id: "c-2026-05-14-sharma-01" } });
  if (!c) throw new Error("Sharma case row missing after db:seed");
  console.log("id:", c.id);
  console.log("workflow:", c.workflow);
  console.log("status:", c.status);
  console.log("severity:", c.severity);
  console.log("stubbed:", c.stubbed);
  console.log("decisionJson:", c.decisionJson === null ? "(null)" : "(set)");
  console.log("headline:", c.headline.slice(0, 80));
  console.log("contentJson length:", c.contentJson.length, "chars");
  console.log("tokenUsageJson length:", c.tokenUsageJson?.length ?? 0, "chars");

  const content = JSON.parse(c.contentJson);
  const briefing = content.briefing;
  console.log("\nbriefing sections present:");
  for (const key of [
    "section_1_proposal_summary",
    "section_2_synthesis_verdict",
    "section_3_evidence_summary",
    "section_4_governance_status",
    "section_5_advisory_challenges",
    "section_6_talking_points",
    "section_7_coverage_methodology_note",
  ]) {
    console.log(" ", key, briefing[key] ? "yes" : "MISSING");
  }
  console.log("\nverdict:", briefing.section_2_synthesis_verdict.overall_verdict);
  console.log("risk:", briefing.section_2_synthesis_verdict.overall_risk_level);
  console.log("evidence_summary entries:", briefing.section_3_evidence_summary.length);
  console.log("governance entries:", briefing.section_4_governance_status.length);
  console.log("advisory challenges:", briefing.section_5_advisory_challenges.length);
  console.log("talking points:", briefing.section_6_talking_points.length);
  console.log("evidence_verdicts (top-level):", content.evidence_verdicts.length);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("FAILED:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
