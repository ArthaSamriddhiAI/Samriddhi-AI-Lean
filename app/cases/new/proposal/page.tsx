import { prisma } from "@/lib/prisma";
import { ProposalForm } from "@/components/new-case/ProposalForm";

export const dynamic = "force-dynamic";

export default async function ProposalIntakePage() {
  const [investors, snapshots] = await Promise.all([
    prisma.investor.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        metaLine: true,
        riskAppetite: true,
        liquidAumCr: true,
      },
    }),
    prisma.snapshot.findMany({
      orderBy: { date: "asc" },
      select: { id: true, date: true, type: true, holdingsCount: true },
    }),
  ]);

  return (
    <div className="new-case-page">
      <div className="nc-eyebrow">Cases / New / Proposal evaluation (Samriddhi 1)</div>
      <h1 className="nc-title">Evaluate a proposed action</h1>
      <p className="nc-sub">
        Capture the proposal against an investor mandate. The pipeline runs evidence agents
        E1-E7 with conditional activation, deterministic governance gates G1-G3, S1 synthesis,
        and A1 adversarial challenge. Outputs a seven-section verdict-shaped briefing.
      </p>
      <ProposalForm investors={investors} snapshots={snapshots} />
    </div>
  );
}
