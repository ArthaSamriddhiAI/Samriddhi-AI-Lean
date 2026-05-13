import { prisma } from "@/lib/prisma";
import { InvestorList } from "@/components/investors/InvestorList";
import { Search } from "@/components/chrome/Icons";

export const dynamic = "force-dynamic";

function formatFinding(date: Date | null, headline: string | null) {
  if (!date || !headline) return null;
  const when = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const head = headline.length > 36 ? `${headline.slice(0, 36)}…` : headline;
  return `${head} · ${when}`;
}

export default async function InvestorsPage() {
  const investors = await prisma.investor.findMany({
    orderBy: { name: "asc" },
    include: {
      cases: {
        orderBy: { frozenAt: "desc" },
        take: 1,
        select: { headline: true, frozenAt: true },
      },
      _count: { select: { cases: true } },
    },
  });

  const enriched = investors.map((inv) => {
    const last = inv.cases[0];
    return {
      ...inv,
      caseCount: inv._count.cases,
      lastFindingLabel: last ? formatFinding(last.frozenAt, last.headline) : null,
    };
  });

  return (
    <div className="page-inner">
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">Workspace</div>
          <h1>Investors</h1>
          <p className="page-lede mt-1.5">
            Six pre-seeded demo profiles. The MVP does not onboard live.
          </p>
        </div>
        <div className="flex gap-2.5 shrink-0">
          <button type="button" className="btn btn-secondary" disabled>
            <Search size={13} />
            Search
          </button>
        </div>
      </div>

      <InvestorList investors={enriched} />
    </div>
  );
}
