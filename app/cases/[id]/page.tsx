import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AnalysisTab } from "@/components/case-detail/AnalysisTab";
import { BriefingTab } from "@/components/case-detail/BriefingTab";
import { ChatPanel } from "@/components/case-detail/ChatPanel";
import { CaseStubBadge } from "@/components/case-detail/CaseStubBadge";
import { Lock, Download } from "@/components/chrome/Icons";
import type { BriefingContent } from "@/lib/agents/s1-diagnostic";
import { transformRupeesDeep } from "@/lib/format/rupees";

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

  // While the pipeline is running, bounce to the generating screen.
  if (c.status === "generating") {
    redirect(`/cases/${id}/generating`);
  }

  const activeTab: "analysis" | "briefing" = tab === "briefing" ? "briefing" : "analysis";
  const snapshotDate = formatSnapshot(c.snapshot.date);
  const frozen = formatFrozen(c.frozenAt);

  // Failed cases: render an explanatory screen rather than the tabs.
  if (c.status === "failed") {
    return (
      <div className="case-detail h-[calc(100vh-52px)]">
        <div className="case-toolbar">
          <div className="breadcrumbs">
            <Link href="/cases" className="text-ink-3 no-underline hover:text-ink-1">
              Cases
            </Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">{c.investor.name} · Failed</span>
          </div>
        </div>
        <div className="p-8 max-w-[720px]">
          <h2 className="text-xl font-semibold mb-2">Pipeline failed</h2>
          <p className="text-ink-3 mb-4">The diagnostic pipeline could not complete for this case.</p>
          <pre className="bg-ink-7 p-3 rounded text-[12.5px] whitespace-pre-wrap">{c.errorMessage ?? "Unknown error"}</pre>
          <form action={`/api/cases/${id}/retry`} method="post" className="mt-4">
            <button type="submit" className="btn btn-primary">Retry pipeline</button>
          </form>
        </div>
      </div>
    );
  }

  // Real-content branch. contentJson encodes the briefing produced by S1
  // plus the deterministic provenance bundle.
  let content: BriefingContent | null = null;
  let generatedAt = frozen;
  let usageSummary: { total_input_tokens?: number; total_output_tokens?: number; elapsed_ms?: number; generated_at?: string } | null = null;
  try {
    const parsed = JSON.parse(c.contentJson);
    if (parsed && parsed.briefing) {
      content = transformRupeesDeep(parsed.briefing as BriefingContent);
      usageSummary = parsed.usage_summary ?? null;
      if (usageSummary?.generated_at) {
        const d = new Date(usageSummary.generated_at);
        generatedAt = formatFrozen(d);
      }
    }
  } catch {
    /* fallthrough: content stays null */
  }

  if (!content) {
    return (
      <div className="case-detail h-[calc(100vh-52px)]">
        <div className="case-toolbar">
          <div className="breadcrumbs">
            <Link href="/cases" className="text-ink-3 no-underline hover:text-ink-1">
              Cases
            </Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">{c.investor.name} · Empty content</span>
          </div>
        </div>
        <div className="p-8 max-w-[720px]">
          <h2 className="text-xl font-semibold mb-2">No content available</h2>
          <p className="text-ink-3">This case has no briefing content. Try retrying the pipeline.</p>
          <form action={`/api/cases/${id}/retry`} method="post" className="mt-4">
            <button type="submit" className="btn btn-primary">Retry pipeline</button>
          </form>
        </div>
      </div>
    );
  }

  /* Build the holdings list passed to AnalysisTab from the investor's
   * structured holdings JSON. */
  const holdings = (() => {
    try {
      const h = JSON.parse(c.investor.holdingsJson) as { holdings: Array<{ instrument: string; subCategory: string; valueCr: number; weightPct: number }> };
      return h.holdings.map((row) => ({
        instrument: row.instrument,
        sub_category: row.subCategory,
        value_cr: row.valueCr,
        weight_pct: row.weightPct,
      }));
    } catch {
      return [];
    }
  })();

  return (
    <div className="case-detail h-[calc(100vh-52px)]">
      <div className="case-toolbar">
        <div className="breadcrumbs">
          <Link href="/cases" className="text-ink-3 no-underline hover:text-ink-1">
            Cases
          </Link>
          <span className="crumb-sep">/</span>
          <span className="crumb-current">
            {c.investor.name} · {content.header.case_label}
          </span>
          <span className="frozen-pill">
            <Lock size={11} />
            Frozen {frozen}
          </span>
          <CaseStubBadge stubbed={c.stubbed} />
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
          <a
            href={`/api/cases/${id}/briefing.pdf`}
            className="btn btn-primary btn-sm"
            download={`briefing-${id}.pdf`}
          >
            <Download size={13} />
            Export briefing
          </a>
        </div>
      </div>

      <div className="case-body">
        {activeTab === "briefing" ? (
          <BriefingTab
            investorName={c.investor.name}
            snapshotDate={snapshotDate}
            caseId={id}
            content={content}
            generatedAt={generatedAt}
          />
        ) : (
          <AnalysisTab
            investorName={c.investor.name}
            snapshotDate={snapshotDate}
            content={content}
            holdings={holdings}
          />
        )}
        <ChatPanel />
      </div>
    </div>
  );
}
