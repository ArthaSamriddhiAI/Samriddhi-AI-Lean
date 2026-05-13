import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CaseList } from "@/components/case-list/CaseList";
import { EmptyState } from "@/components/case-list/EmptyState";
import { Plus, Search } from "@/components/chrome/Icons";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const cases = await prisma.case.findMany({
    include: { investor: true },
    orderBy: { frozenAt: "desc" },
  });

  return (
    <div className="page-inner">
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">Workspace</div>
          <h1>Cases</h1>
          <p className="page-lede mt-1.5">
            All briefings and proposal evaluations you have prepared. Most recent at top.
          </p>
        </div>
        <div className="flex gap-2.5 shrink-0">
          <button type="button" className="btn btn-secondary" disabled>
            <Search size={13} />
            Search
          </button>
          <Link href="/cases/new" className="btn btn-primary no-underline">
            <Plus size={13} />
            New case
          </Link>
        </div>
      </div>

      {cases.length === 0 ? <EmptyState /> : <CaseList cases={cases} />}
    </div>
  );
}
