/* Samriddhi 2 Analyst Reports tab (T-5.08).
 *
 * Ports the Samriddhi 1 Analyst Reports surface (the Concept C per-agent
 * accordion) onto the Samriddhi 2 case screen, fed by the Samriddhi 2 evidence
 * shape (content.evidence.e1..e7, which carries per-stock verdicts rather than
 * the Samriddhi 1 single agent-level CaseEvidenceVerdict). No new computation
 * and no new persisted schema: this reads the persisted evidence as is and
 * reuses the existing accordion and memo styling.
 *
 * E5 is omitted at render because the Samriddhi 2 diagnostic does not activate
 * the unlisted-equity agent, so the evidence object carries no e5 key; the
 * omission falls out of the data and needs no special case. See the Concept C
 * tab-amendment ADR for why this surface earns a re-introduced tab.
 *
 * The Samriddhi 1 CaseEvidenceVerdict shape (one agent-level risk_level and
 * confidence) does not fit the Samriddhi 2 per-stock evidence, so the fields
 * render natively in the same visual language rather than being coerced into
 * the Samriddhi 1 shape, which would drop the per-stock detail.
 */
import { Accordion, type AccordionItem } from "./Accordion";
import type { Severity } from "@/lib/format/case-accordion";

const AGENT_LABELS: Record<string, string> = {
  e1: "E1, Listed and Fundamental Equity Analysis Agent",
  e2: "E2, Industry and Business Model Agent",
  e3: "E3, Macro, Policy, and News Agent",
  e4: "E4, Behavioural and Historical Agent",
  e6: "E6, PMS and AIF Fund Analysis Agent",
  e7: "E7, Mutual Fund Analysis Agent",
};

/* e5 (unlisted equity) is intentionally absent: the Samriddhi 2 diagnostic does
 * not activate it, so it never appears in content.evidence. */
const AGENT_ORDER = ["e1", "e2", "e3", "e4", "e6", "e7"];

type S2StockVerdict = {
  symbol?: string;
  source?: string;
  effective_weight_pct?: number;
  overall_verdict?: string;
  key_drivers?: string[];
};

export type S2Evidence = {
  analysis_scope?: string[];
  per_stock_verdicts?: S2StockVerdict[];
  scope_notes?: string | string[] | null;
  escalate_to_master?: unknown;
  reasoning_summary?: string;
};

export type S2EvidenceMap = Record<string, S2Evidence>;

function firstSentence(s: string): string {
  const i = s.indexOf(". ");
  return i === -1 ? s : s.slice(0, i + 1);
}

export function AnalystReportsTabS2({
  investorName,
  evidence,
}: {
  investorName: string;
  evidence: S2EvidenceMap;
}) {
  const present = AGENT_ORDER.filter((k) => evidence[k]);

  const rows: AccordionItem[] = present.map((k) => {
    const ev = evidence[k];
    const escalate = ev.escalate_to_master === true;
    const stocks = ev.per_stock_verdicts ?? [];
    const scopeNotes = Array.isArray(ev.scope_notes)
      ? ev.scope_notes
      : ev.scope_notes
        ? [ev.scope_notes]
        : [];

    return {
      id: k,
      num: k.toUpperCase(),
      title: AGENT_LABELS[k] ?? k.toUpperCase(),
      headline: ev.reasoning_summary ? firstSentence(ev.reasoning_summary) : undefined,
      severity: (escalate ? "flg" : "muted") as Severity,
      status: escalate ? "Escalated" : undefined,
      body: (
        <>
          {ev.reasoning_summary && (
            <div className="agent-memo-block">
              <h4>Reasoning</h4>
              <p>{ev.reasoning_summary}</p>
            </div>
          )}
          {ev.analysis_scope && ev.analysis_scope.length > 0 && (
            <div className="agent-memo-block">
              <h4>Scope</h4>
              <div className="flag-row">
                {ev.analysis_scope.map((s, i) => (
                  <span key={i} className="flag-pill">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {stocks.length > 0 && (
            <div className="agent-memo-block">
              <h4>Per-holding verdicts</h4>
              <div className="ar-s2-stocks">
                {stocks.map((s, i) => (
                  <div key={i} className="ar-s2-stock">
                    <div className="ar-s2-stock-head">
                      <span className="ar-s2-stock-name">{s.symbol}</span>
                      {s.overall_verdict && (
                        <span className="ar-s2-stock-verdict">{s.overall_verdict.replace(/_/g, " ")}</span>
                      )}
                      {typeof s.effective_weight_pct === "number" && (
                        <span className="ar-s2-stock-wt">{s.effective_weight_pct.toFixed(1)}%</span>
                      )}
                    </div>
                    {s.key_drivers && s.key_drivers.length > 0 && (
                      <ul className="pdf-bullets">
                        {s.key_drivers.map((d, j) => (
                          <li key={j}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {scopeNotes.length > 0 && (
            <div className="agent-memo-block">
              <h4>Scope notes</h4>
              <ul className="pdf-bullets mono">
                {scopeNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ),
    };
  });

  return (
    <div className="ar-shell">
      <div className="ar-inner">
        <div className="ar-case-head">
          <div className="eye">Reasoning trail, per-agent analyst memos</div>
          <h2>Analyst reports</h2>
          <div className="ar-case-meta">
            <span>{investorName}</span>
            <span className="sep">·</span>
            <span>Each activated evidence agent carries its Samriddhi 2 per-holding verdicts and reasoning.</span>
          </div>
        </div>
        <Accordion items={rows} eyebrow="Memos" count={`${present.length} reports`} />
      </div>
    </div>
  );
}
