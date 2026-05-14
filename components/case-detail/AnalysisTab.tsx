import type { BriefingContent } from "@/lib/agents/s1-diagnostic";

/* Analysis tab. Renders the pipeline's BriefingContent in workbench
 * density. Sections 1 + 3 + 4 collapse into a single observations panel
 * (each rendered as a card with severity colouring); section 2 is the
 * allocation table; section 7 + the case's holdings reference make the
 * audit table; coverage_note becomes the footer block. */

type Props = {
  investorName: string;
  snapshotDate: string;
  content: BriefingContent;
  holdings: Array<{ instrument: string; sub_category: string; value_cr: number; weight_pct: number }>;
};

type SeverityVariant = "ok" | "info" | "flag" | "escalate";

function severityColor(sev: SeverityVariant): string {
  return sev === "escalate"
    ? "var(--color-neg)"
    : sev === "flag"
      ? "var(--color-warn)"
      : sev === "info"
        ? "var(--color-accent)"
        : "var(--color-ink-5)";
}

export function AnalysisTab({ investorName, snapshotDate, content, holdings }: Props) {
  const h = content.header;

  return (
    <div className="workbench-area">
      <div className="workbench-inner">
        <div className="workbench-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Portfolio analysis · Samriddhi 2 · Diagnostic
            </div>
            <h2>{investorName}</h2>
            <div className="workbench-head-meta">
              <span>Snapshot {snapshotDate}</span>
              <span style={{ color: "var(--color-ink-5)" }}>·</span>
              <span>{h.liquid_aum_label}</span>
              <span style={{ color: "var(--color-ink-5)" }}>·</span>
              <span>{h.holdings_label}</span>
              <span style={{ color: "var(--color-ink-5)" }}>·</span>
              <span>{h.stated_revealed_label}</span>
            </div>
          </div>
          <div className="workbench-stats">
            <div className="workbench-stat">
              <span className="ws-mark" style={{ background: "var(--color-neg)" }} />
              <span className="ws-val">{h.severity_counts.escalate}</span>
              <span className="ws-label">escalate</span>
            </div>
            <div className="workbench-stat">
              <span className="ws-mark" style={{ background: "var(--color-warn)" }} />
              <span className="ws-val">{h.severity_counts.flag}</span>
              <span className="ws-label">flag</span>
            </div>
            <div className="workbench-stat">
              <span className="ws-mark" style={{ background: "var(--color-ink-5)" }} />
              <span className="ws-val">{h.severity_counts.total}</span>
              <span className="ws-label">total</span>
            </div>
          </div>
        </div>

        <div className="workbench-lede">{content.workbench_lede}</div>

        <section className="workbench-section">
          <div className="workbench-section-head">Asset class allocation vs model</div>
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
                  <td className="r muted">{row.band[0]}-{row.band[1]}%</td>
                  <td
                    className={`r${row.in_band ? " muted" : ""}`}
                    style={!row.in_band ? { color: "var(--color-warn)" } : undefined}
                  >
                    {row.deviation_pp > 0 ? "+" : ""}{row.deviation_pp.toFixed(1)} pp {row.in_band ? "" : (row.deviation_pp > 0 ? "above band" : "below band")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-[11.5px] text-ink-4 font-mono">
            {content.section_2_portfolio_overview.liquidity_tier_line}
          </div>
        </section>

        <section className="workbench-section">
          <div className="workbench-section-head">
            Headline observations · {content.section_1_headline_observations.length}
          </div>
          {content.section_1_headline_observations.map((obs, i) => (
            <div key={i} className={`wb-obs sev-${obs.severity}`}>
              <div className="wb-obs-head">
                <div className="wb-obs-title">
                  <span className="wb-obs-name">{obs.vocab.replace(/_/g, " ")}</span>
                  <span className="wb-obs-meta">
                    source: {obs.source} · {obs.severity}
                  </span>
                </div>
                <span
                  className="wb-obs-figure"
                  style={{ color: severityColor(obs.severity as SeverityVariant) }}
                >
                  {obs.severity}
                </span>
              </div>
              <div className="wb-obs-body">{obs.one_line}</div>
            </div>
          ))}
        </section>

        {content.section_3_concentration_analysis.length > 0 ? (
          <section className="workbench-section">
            <div className="workbench-section-head">
              Concentration analysis · {content.section_3_concentration_analysis.length}
            </div>
            {content.section_3_concentration_analysis.map((br, i) => (
              <div key={i} className={`wb-obs sev-${br.severity}`}>
                <div className="wb-obs-head">
                  <div className="wb-obs-title">
                    <span className="wb-obs-name">{br.kind} concentration</span>
                    <span className="wb-obs-meta">source: {br.source} · {br.severity}</span>
                  </div>
                  <span className="wb-obs-figure">{br.figure}</span>
                </div>
                <div className="wb-obs-body">
                  {br.detail} <em>{br.evidence}</em>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {content.section_4_risk_flags.length > 0 ? (
          <section className="workbench-section">
            <div className="workbench-section-head">
              Risk flags · {content.section_4_risk_flags.length}
            </div>
            {content.section_4_risk_flags.map((flag, i) => (
              <div key={i} className={`wb-obs sev-${flag.severity}`}>
                <div className="wb-obs-head">
                  <div className="wb-obs-title">
                    <span className="wb-obs-name">{flag.title}</span>
                    <span className="wb-obs-meta">{flag.category} · source: {flag.source} · {flag.severity}</span>
                  </div>
                </div>
                <div className="wb-obs-body">{flag.body}</div>
              </div>
            ))}
          </section>
        ) : null}

        <section className="workbench-section">
          <div className="workbench-section-head">
            Holdings reference · {holdings.length} of {holdings.length} analysed
          </div>
          <table className="audit-holdings">
            <thead>
              <tr>
                <th>Holding</th>
                <th>Sub-category</th>
                <th className="r">Value (Rs Cr)</th>
                <th className="r">Weight</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((row) => (
                <tr key={row.instrument}>
                  <td>{row.instrument}</td>
                  <td>
                    <span className="sub-cat">{row.sub_category}</span>
                  </td>
                  <td className="r">{row.value_cr.toFixed(2)}</td>
                  <td className="r">{row.weight_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="workbench-section">
          <div className="workbench-section-head">Coverage notes</div>
          <p className="text-[12.5px] text-ink-3 leading-[1.6] max-w-[720px] m-0">
            {content.coverage_note}
          </p>
        </section>
      </div>
    </div>
  );
}
