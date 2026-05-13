import { prisma } from "@/lib/prisma";
import { DiagnosticForm } from "@/components/new-case/DiagnosticForm";

export const dynamic = "force-dynamic";

export default async function DiagnosticIntakePage() {
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
      <div className="nc-eyebrow">Cases / New / Portfolio diagnostic (Samriddhi 2)</div>
      <h1 className="nc-title">Open a new case</h1>
      <p className="nc-sub">
        Pick the investor and the portfolio snapshot to analyse. The briefing renders
        immediately in this slice; real reasoning lands in slice 2.
      </p>
      <DiagnosticForm investors={investors} snapshots={snapshots} />
    </div>
  );
}
