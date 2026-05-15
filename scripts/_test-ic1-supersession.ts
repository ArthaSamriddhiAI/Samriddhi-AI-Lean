/* Throwaway: inject materiality + a partially-populated IC1 deliberation
 * payload (counterfactual_engine populated; other roles sentinel) into
 * the Sharma case row, so the counterfactual supersession on the
 * Outcome tab can be visually verified before commit 7 lands.
 *
 * Run via: npx tsx scripts/_test-ic1-supersession.ts
 * Revert via: npm run db:seed. */

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
    counterfactual_engine: {
      status: "populated",
      framing: [
        "The deliberation surfaces three coherent alternative shapes the family could take that resolve the mandate boundary signals without abandoning the underlying conviction in quality-compounder PMS exposure.",
        "Each path is anchored to a specific concern raised by the Risk Assessor: ticket sizing against architecture rather than product attractiveness, wrapper-count duplication risk, and reserve compression sensitivity to manufacturing-business liquidity calls.",
      ],
      alternative_paths: [
        {
          label: "Mandate-fit ticket sizing",
          description:
            "Rs 2.0-2.2 Cr ticket holds equity at the 70 percent ceiling, preserves debt above floor, and keeps single-position concentration at or below 15 percent of liquid AUM; redirects roughly 40 percent of the FD reserve rather than 56 percent.",
        },
        {
          label: "Two-tranche staged deployment",
          description:
            "Rs 1.5 Cr now, Rs 1.5 Cr at an intermediate mandate review six months later; allows wrapper-count and style-overlap architecture to settle before doubling the PMS line.",
        },
        {
          label: "Consolidate within existing PMS",
          description:
            "Top up the existing growth-quality PMS by Rs 2 Cr rather than adding a second wrapper; preserves single-mandate clarity and addresses the wrapper-count flag at the root rather than after-the-fact.",
        },
      ],
    },
  };

  content.materiality = materiality;
  content.ic1_deliberation = ic1Deliberation;

  await prisma.case.update({
    where: { id: c.id },
    data: { contentJson: JSON.stringify(content) },
  });

  console.log("Injected materiality + partially-populated IC1 (counterfactual_engine populated).");
  console.log("To revert: npm run db:seed");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
