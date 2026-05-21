import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CaseList } from "@/components/case-list/CaseList";
import { EmptyState } from "@/components/case-list/EmptyState";
import { Plus, Search } from "@/components/chrome/Icons";

export const dynamic = "force-dynamic";

/* Demo curation: show exactly these six cases, in exactly this order,
 * regardless of frozenAt. The first two are the clickable demo cases. */
const DEMO_CASE_IDS_ORDERED = [
  "c-2026-05-15-surana-01",
  "c-2026-05-21-iyengar-01",
  "c-2026-05-15-sharma-s2-01",
  "c-2026-05-21-malhotra-01",
  "c-2026-05-21-menon-01",
  "c-2026-05-21-bhatt-01",
];

export default async function CasesPage() {
  const fetched = await prisma.case.findMany({
    where: { id: { in: DEMO_CASE_IDS_ORDERED } },
    include: { investor: true },
  });
  const cases = DEMO_CASE_IDS_ORDERED
    .map((id) => fetched.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => c != null);

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
