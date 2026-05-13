import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InvestorDetail } from "@/components/investors/InvestorDetail";
import { Plus } from "@/components/chrome/Icons";

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function InvestorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const investor = await prisma.investor.findUnique({ where: { id } });
  if (!investor) notFound();

  return (
    <div className="page-inner">
      <div className="case-toolbar" style={{ height: "auto", padding: "0 0 14px", borderBottom: "1px solid var(--color-rule)", marginBottom: 28, background: "transparent" }}>
        <div className="breadcrumbs">
          <Link href="/investors" className="text-ink-3 no-underline hover:text-ink-1">
            Investors
          </Link>
          <span className="crumb-sep">/</span>
          <span className="crumb-current">{investor.name}</span>
        </div>
        <div className="case-toolbar-right">
          <button type="button" className="btn btn-ghost btn-sm" disabled>
            Edit profile
          </button>
          <Link href="/cases/new" className="btn btn-primary btn-sm no-underline">
            <Plus size={13} />
            New case for this investor
          </Link>
        </div>
      </div>

      <InvestorDetail investor={investor} />
    </div>
  );
}
