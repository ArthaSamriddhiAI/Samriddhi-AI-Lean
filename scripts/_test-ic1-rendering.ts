/* Throwaway: temporarily inject materiality + ic1_deliberation sentinel
 * payload into the Sharma case's contentJson so the Outcome tab can be
 * visually verified before commit 7 adds these fields to the fixture
 * itself.
 *
 * Run via: npx tsx scripts/_test-ic1-rendering.ts
 * Revert via: npm run db:seed (re-loads the fixture without these fields). */

import { prisma } from "../lib/prisma";
import { evaluateMateriality } from "../lib/agents/materiality";
import type { IC1Deliberation } from "../lib/agents/ic1/types";

async function main() {
  const c = await prisma.case.findUnique({ where: { id: "c-2026-05-14-sharma-01" } });
  if (!c) throw new Error("Sharma case row missing");
  const content = JSON.parse(c.contentJson);

  const materiality = evaluateMateriality({
    synthesis: content.briefing.section_2_synthesis_verdict,
    gates: content.gate_results,
    evidence: content.evidence_verdicts,
    ticketSizeCr: content.proposal.ticket_size_cr,
  });

  const ic1Deliberation: IC1Deliberation = {
    fires: true,
    minutes_recorder: { status: "infrastructure_ready" },
    chair: { status: "infrastructure_ready" },
    devils_advocate: { status: "infrastructure_ready" },
    risk_assessor: { status: "infrastructure_ready" },
    counterfactual_engine: { status: "infrastructure_ready" },
  };

  content.materiality = materiality;
  content.ic1_deliberation = ic1Deliberation;

  await prisma.case.update({
    where: { id: c.id },
    data: { contentJson: JSON.stringify(content) },
  });

  console.log("Injected materiality + ic1_deliberation sentinel into Sharma case row.");
  console.log("materiality.fires:", materiality.fires);
  console.log("ic1_deliberation.fires:", ic1Deliberation.fires);
  console.log("To revert: npm run db:seed");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
