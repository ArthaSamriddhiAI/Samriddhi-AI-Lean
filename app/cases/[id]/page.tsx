import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AnalysisTab } from "@/components/case-detail/AnalysisTab";
import { BriefingTab } from "@/components/case-detail/BriefingTab";
import { ChatPanel } from "@/components/case-detail/ChatPanel";
import { Lock, Download } from "@/components/chrome/Icons";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export const dynamic = "force-dynamic";

function formatFrozen(d: Date) {
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date}, ${time}`;
}

function formatSnapshot(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function CaseDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const c = await prisma.case.findUnique({
    where: { id },
    include: { investor: true, snapshot: true },
  });
  if (!c) notFound();

  const activeTab: "analysis" | "briefing" = tab === "briefing" ? "briefing" : "analysis";
  const snapshotDate = formatSnapshot(c.snapshot.date);
  const frozen = formatFrozen(c.frozenAt);

  return (
    <div className="case-detail h-[calc(100vh-52px)]">
      <div className="case-toolbar">
        <div className="breadcrumbs">
          <Link href="/cases" className="text-ink-3 no-underline hover:text-ink-1">
            Cases
          </Link>
          <span className="crumb-sep">/</span>
          <span className="crumb-current">
            {c.investor.name} · Quarterly review
          </span>
          <span className="frozen-pill">
            <Lock size={11} />
            Frozen {frozen}
          </span>
        </div>
        <div className="case-tabs">
          <Link
            href={`/cases/${id}`}
            className={`case-tab ${activeTab === "analysis" ? "is-active" : ""}`}
          >
            Analysis
          </Link>
          <Link
            href={`/cases/${id}?tab=briefing`}
            className={`case-tab ${activeTab === "briefing" ? "is-active" : ""}`}
          >
            Briefing PDF
          </Link>
        </div>
        <div className="case-toolbar-right">
          <button type="button" className="btn btn-ghost btn-sm" disabled>
            Share link
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled>
            <Download size={13} />
            Export briefing
          </button>
        </div>
      </div>

      <div className="case-body">
        {activeTab === "briefing" ? (
          <BriefingTab investorName={c.investor.name} snapshotDate={snapshotDate} caseId={id} />
        ) : (
          <AnalysisTab investorName={c.investor.name} snapshotDate={snapshotDate} />
        )}
        <ChatPanel />
      </div>
    </div>
  );
}
