import Link from "next/link";
import type { Case, Investor } from "@prisma/client";
import { Chev, Filter } from "@/components/chrome/Icons";

type CaseWithInvestor = Case & { investor: Investor };

type Props = { cases: CaseWithInvestor[] };

/* Filter pill counts. Pills are visual-only in slice 1; clicking does not
 * filter the table. Click-to-filter lands when there is enough volume to
 * warrant it (slice 5 polish at the earliest). */
function pillCounts(cases: CaseWithInvestor[]) {
  return {
    all: cases.length,
    open: cases.filter((c) => c.status !== "archived").length,
    archived: cases.filter((c) => c.status === "archived").length,
    proposals: cases.filter((c) => c.workflow === "s1").length,
    diagnostics: cases.filter((c) => c.workflow === "s2").length,
  };
}

function formatGenerated(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function CaseList({ cases }: Props) {
  const counts = pillCounts(cases);
  const earliest = cases[cases.length - 1]?.frozenAt;
  const investorCount = new Set(cases.map((c) => c.investorId)).size;

  return (
    <>
      <div className="filter-row">
        <div className="filter-pills">
          <button className="pill is-active">
            All <span className="pill-count">{counts.all}</span>
          </button>
          <button className="pill">
            Open <span className="pill-count">{counts.open}</span>
          </button>
          <button className="pill">
            Archived <span className="pill-count">{counts.archived}</span>
          </button>
          <button className="pill">
            Proposals <span className="pill-count">{counts.proposals}</span>
          </button>
          <button className="pill">
            Diagnostics <span className="pill-count">{counts.diagnostics}</span>
          </button>
        </div>
        <div className="right-controls">
          <button className="ctl">
            <Filter size={12} />
            Investor
          </button>
          <button className="ctl">Sorted: most recent</button>
        </div>
      </div>

      <div className="case-table">
        <div className="ct-head">
          <span />
          <span>Investor</span>
          <span>Headline finding</span>
          <span>Generated</span>
          <span>Status</span>
          <span />
        </div>

        {cases.map((c) => (
          <Link href={`/cases/${c.id}`} key={c.id} className="contents no-underline">
            <div className="ct-row">
              <span className={`severity-mark sev-${c.severity}`} />
              <div className="investor-cell">
                <span className="investor-name">{c.investor.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="investor-meta">{c.investor.metaLine}</span>
                  <span className={`wf-tag ${c.workflow === "s1" ? "wt-s1" : "wt-s2"}`}>
                    {c.workflow === "s1" ? "prop" : "diag"}
                  </span>
                  {c.stubbed === true && (
                    <span className="stub-meta" title="Assembled from STUB_MODE replay">
                      · stub
                    </span>
                  )}
                </div>
              </div>
              <div className="headline">{c.headline}</div>
              <div className="timestamp">{formatGenerated(c.frozenAt)}</div>
              <div>
                {c.status === "ready" && (
                  <span className="status-tag ready">
                    <span className="sdot" />
                    Unread
                  </span>
                )}
                {c.status === "archived" && (
                  <span className="status-tag archived">
                    <span className="sdot" />
                    Archived
                  </span>
                )}
              </div>
              <div className="ct-chev">
                <Chev size={12} dir="r" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-[18px] text-[11.5px] text-ink-4 font-mono">
        {cases.length} case{cases.length === 1 ? "" : "s"} · {investorCount} investor
        {investorCount === 1 ? "" : "s"} · {counts.proposals} proposals · {counts.diagnostics} diagnostics
        {earliest ? ` · earliest ${formatGenerated(earliest)}` : ""}
      </div>
    </>
  );
}
