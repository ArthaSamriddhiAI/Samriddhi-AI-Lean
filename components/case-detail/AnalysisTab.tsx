/* Samriddhi 2 Case Detail, analysis surface (the page; no tab strip).
 *
 * Concept C (locked accordion redesign): the diagnostic tally and the
 * executive headline fold into an always-visible Diagnostic band; the
 * persisted seven-section BriefingContent maps, unchanged, onto a
 * signal-led accordion. This is a presentational layer only; no section
 * re-cut. Row severity is the most severe observation in the row, so
 * Escalate sections open by default and Flag sections stay closed with
 * their pill visible.
 */

import type { BriefingContent } from "@/lib/agents/s1-diagnostic";
import {
  dataSeverityToSeverity,
  getScannableField,
  maxSeverity,
} from "@/lib/format/case-accordion";
import { Accordion, type AccordionItem } from "./Accordion";

type Props = {
  investorName: string;
  snapshotDate: string;
  content: BriefingContent;
  holdings: Array<{ instrument: string; sub_category: string; value_cr: number; weight_pct: number }>;
};

/* section_headlines lands in Step 5 (schema additions); until the fixture
 * backfill, the band falls back to the first sentence of the lede so it is
 * never empty. */
type ContentWithHeadlines = BriefingContent & {
  section_headlines?: Record<string, string>;
};

function firstSentence(s: string): string {
  const i = s.indexOf(". ");
  return i === -1 ? s : s.slice(0, i + 1);
}

export function AnalysisTab({ investorName, snapshotDate, content, holdings }: Props) {
  const h = content.header;
  const headlines = (content as ContentWithHeadlines).section_headlines;

  const rows: AccordionItem[] = [];

  rows.push({
    id: "portfolio",
    title: "Portfolio overview",
    severity: "muted",
    headline: headlines?.portfolio,
    body: (
      <>
        <table className="pdf-table">
          <thead>
            <tr>
              <th>Asset class</th>
              <th className="r">Actual</th>
              <th className="r">Model target</th>
              <th className="r">Band</th>
              <th className="r">Deviation</th>
            </tr>
          </thead>
          <tbody>
            {content.section_2_portfolio_overview.rows.map((row) => (
              <tr key={row.asset_class}>
                <td>{row.asset_class}</td>
                <td className="r">{row.actual_pct.toFixed(1)}%</td>
                <td className="r">{row.target_pct}%</td>
                <td className="r muted">
                  {row.band[0]}-{row.band[1]}%
                </td>
                <td
                  className={`r${row.in_band ? " muted" : ""}`}
                  style={!row.in_band ? { color: "var(--color-warn)" } : undefined}
                >
                  {row.deviation_pp > 0 ? "+" : ""}
                  {row.deviation_pp.toFixed(1)} pp{" "}
                  {row.in_band ? "" : row.deviation_pp > 0 ? "above band" : "below band"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 text-[11.5px] text-ink-4 font-mono">
          {content.section_2_portfolio_overview.liquidity_tier_line}
        </div>
      </>
    ),
  });

  {
    const obs = content.section_1_headline_observations;
    rows.push({
      id: "headline_observations",
      title: "Headline observations",
      severity: maxSeverity(obs.map((o) => dataSeverityToSeverity(o.severity))),
      headline: headlines?.headline_observations,
      body: (
        <>
          {obs.map((o, i) => (
            <div key={i} className={`wb-obs sev-${o.severity}`}>
              <div className="wb-obs-head">
                <div className="wb-obs-title">
                  <span className="wb-obs-name">{o.vocab.replace(/_/g, " ")}</span>
                  <span className="wb-obs-meta">
                    source: {o.source} · {o.severity}
                  </span>
                </div>
              </div>
              <div className="wb-obs-body">{getScannableField(o)}</div>
            </div>
          ))}
        </>
      ),
    });
  }

  if (content.section_3_concentration_analysis.length > 0) {
    const breaches = content.section_3_concentration_analysis;
    rows.push({
      id: "concentration",
      title: "Concentration analysis",
      severity: maxSeverity(breaches.map((b) => dataSeverityToSeverity(b.severity))),
      headline: headlines?.concentration,
      body: (
        <>
          {breaches.map((b, i) => (
            <div key={i} className={`wb-obs sev-${b.severity}`}>
              <div className="wb-obs-head">
                <div className="wb-obs-title">
                  <span className="wb-obs-name">{b.kind} concentration</span>
                  <span className="wb-obs-meta">
                    source: {b.source} · {b.severity}
                  </span>
                </div>
                <span className="wb-obs-figure">{getScannableField(b)}</span>
              </div>
              <div className="wb-obs-body">
                {b.detail} <em>{b.evidence}</em>
              </div>
            </div>
          ))}
        </>
      ),
    });
  }

  if (content.section_4_risk_flags.length > 0) {
    const flags = content.section_4_risk_flags;
    rows.push({
      id: "risk_flags",
      title: "Risk flags",
      severity: maxSeverity(flags.map((f) => dataSeverityToSeverity(f.severity))),
      headline: headlines?.risk_flags,
      body: (
        <>
          {flags.map((f, i) => (
            <div key={i} className={`wb-obs sev-${f.severity}`}>
              <div className="wb-obs-head">
                <div className="wb-obs-title">
                  <span className="wb-obs-name">{getScannableField(f)}</span>
                  <span className="wb-obs-meta">
                    {f.category} · source: {f.source} · {f.severity}
                  </span>
                </div>
              </div>
              <div className="wb-obs-body">{f.body}</div>
            </div>
          ))}
        </>
      ),
    });
  }

  rows.push({
    id: "comparison",
    title: "Comparison vs model",
    severity: "muted",
    headline: headlines?.comparison,
    body: (
      <>
        <p className="case-paragraph">{content.section_5_comparison_vs_model.framing_line}</p>
        <table className="pdf-table mt-3">
          <thead>
            <tr>
              <th>Sleeve</th>
              <th className="r">Model</th>
              <th className="r">Actual</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {content.section_5_comparison_vs_model.rows.map((r, i) => (
              <tr key={i}>
                <td>{r.sleeve}</td>
                <td className="r">{r.model_pct}</td>
                <td className="r">{r.actual_pct}</td>
                <td>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    ),
  });

  rows.push({
    id: "talking",
    title: "Talking points",
    severity: "muted",
    headline: headlines?.talking,
    body: (
      <div className="talking-points">
        {content.section_6_talking_points.map((t) => (
          <div key={t.number} className="talking-point">
            <span className="tp-num">{t.number}</span>
            <div>
              <p className="tp-body">{t.body}</p>
              {t.emphasis && <p className="tp-body"><em>{t.emphasis}</em></p>}
            </div>
          </div>
        ))}
      </div>
    ),
  });

  rows.push({
    id: "appendix",
    title: "Evidence appendix",
    severity: "muted",
    headline: headlines?.appendix,
    body: (
      <table className="audit-holdings">
        <thead>
          <tr>
            <th>Holding</th>
            <th>Sub-category</th>
            <th className="r">Value (₹ Cr)</th>
            <th className="r">Weight</th>
          </tr>
        </thead>
        <tbody>
          {(content.section_7_evidence_appendix.length > 0
            ? content.section_7_evidence_appendix.map((r) => ({
                instrument: r.name,
                sub_category: r.sub_category,
                value_cr: r.value_cr,
                weight_pct: r.weight_pct,
              }))
            : holdings.map((r) => ({
                instrument: r.instrument,
                sub_category: r.sub_category,
                value_cr: r.value_cr.toFixed(2),
                weight_pct: `${r.weight_pct.toFixed(1)}%`,
              }))
          ).map((r) => (
            <tr key={r.instrument}>
              <td>{r.instrument}</td>
              <td>
                <span className="sub-cat">{r.sub_category}</span>
              </td>
              <td className="r">{r.value_cr}</td>
              <td className="r">{r.weight_pct}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  });

  rows.push({
    id: "coverage",
    title: "Coverage and methodology",
    severity: "muted",
    headline: headlines?.coverage,
    body: <p className="case-paragraph">{content.coverage_note}</p>,
  });

  const numbered = rows.map((r, i) => ({
    ...r,
    num: String(i + 1).padStart(2, "0"),
  }));

  const bandHeadline = headlines?.summary ?? firstSentence(content.workbench_lede);

  return (
    <div className="ar-shell">
      <div className="ar-inner">
        <div className="ar-case-head">
          <div className="eye">Samriddhi 2 · Portfolio diagnostic</div>
          <h2>{investorName}</h2>
          <div className="ar-case-meta">
            <span>Data Snapshot {snapshotDate}</span>
            <span className="sep">·</span>
            <span>{h.liquid_aum_label}</span>
            <span className="sep">·</span>
            <span>{h.holdings_label}</span>
            <span className="sep">·</span>
            <span>{h.stated_revealed_label}</span>
          </div>
          <div className="ar-diag">
            <div>
              <div className="ar-vlabel">Executive summary</div>
              <div className="ar-diag-headline">{bandHeadline}</div>
            </div>
            <div className="ar-diag-tally">
              <div className="t">
                <span className="v esc">{h.severity_counts.escalate}</span>
                <span className="l">escalate</span>
              </div>
              <div className="t">
                <span className="v flg">{h.severity_counts.flag}</span>
                <span className="l">flag</span>
              </div>
              <div className="t">
                <span className="v">{h.severity_counts.total}</span>
                <span className="l">total</span>
              </div>
            </div>
          </div>
        </div>
        <Accordion items={numbered} eyebrow="Briefing sections" count={`${numbered.length} sections`} />
      </div>
    </div>
  );
}
