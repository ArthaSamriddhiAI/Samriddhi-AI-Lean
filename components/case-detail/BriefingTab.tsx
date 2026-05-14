import type { BriefingContent } from "@/lib/agents/s1-diagnostic";

/* Briefing PDF tab. Renders an on-screen approximation of the eventual
 * PDF. Foundation §6 seven-section layout. Pipeline output is consumed
 * directly; nothing fixture here. */

type Props = {
  investorName: string;
  snapshotDate: string;
  caseId: string;
  content: BriefingContent;
  generatedAt: string;
};

export function BriefingTab({ investorName, snapshotDate, caseId, content, generatedAt }: Props) {
  const h = content.header;
  return (
    <div className="pdf-area">
      <article className="pdf-doc">
        <header className="pdf-head">
          <div className="pdf-head-left">
            <div className="pdf-eyebrow">Investor briefing · Lean Samriddhi</div>
            <h1 className="pdf-title">{investorName}</h1>
            <div className="pdf-subtitle">
              <span>{h.case_label}</span>
              <span className="dot-sep">·</span>
              <span>Snapshot {snapshotDate}</span>
              <span className="dot-sep">·</span>
              <span>
                Liquid AUM <span className="mono">{h.liquid_aum_label}</span>
              </span>
              <span className="dot-sep">·</span>
              <span>{h.stated_revealed_label}</span>
            </div>
          </div>
          <div className="pdf-head-right">
            <div>Case {caseId}</div>
            <div>Generated {generatedAt}</div>
            <div>Frozen artefact</div>
          </div>
        </header>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">01</span>Headline observations
          </h2>
          <ul className="pdf-bullets">
            {content.section_1_headline_observations.map((o, i) => (
              <li key={i}>
                <span className="vocab-term">{o.vocab.replace(/_/g, " ")}.</span>{" "}
                {o.one_line}
              </li>
            ))}
          </ul>
        </section>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">02</span>Portfolio overview
          </h2>
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
                  <td className="r">
                    {row.deviation_pp > 0 ? "+" : ""}
                    {row.deviation_pp.toFixed(1)} pp
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pdf-line">{content.section_2_portfolio_overview.total_aum_line}</div>
          <div className="pdf-line">{content.section_2_portfolio_overview.liquidity_tier_line}</div>
        </section>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">03</span>Concentration analysis
          </h2>
          {content.section_3_concentration_analysis.length === 0 ? (
            <div className="pdf-line">No concentration breaches surfaced.</div>
          ) : (
            content.section_3_concentration_analysis.map((br, i) => (
              <div key={i} className="pdf-breach">
                <span className={`b-kind ${br.severity === "escalate" ? "escalate" : ""}`}>{br.kind}</span>
                <span className="b-detail">
                  {br.detail} <em>{br.evidence}</em>
                </span>
                <span className="b-figure">{br.figure}</span>
              </div>
            ))
          )}
        </section>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">04</span>Risk flags
          </h2>
          <div className="pdf-flag-list">
            {content.section_4_risk_flags.map((flag, i) => {
              const tone =
                flag.severity === "escalate" ? "neg" : flag.severity === "flag" ? "warn" : flag.severity === "info" ? "info" : "ok";
              return (
                <div key={i} className={`pdf-flag fl-${tone}`}>
                  <span className="fl-cat">{flag.category}</span>
                  <div className="fl-body">
                    <strong>{flag.title}.</strong> {flag.body}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">05</span>Comparison versus model portfolio
          </h2>
          <div className="pdf-line" style={{ marginBottom: 14 }}>
            {content.section_5_comparison_vs_model.framing_line}
          </div>
          <table className="pdf-table">
            <thead>
              <tr>
                <th>Equity sleeve</th>
                <th className="r">Model</th>
                <th className="r">Actual</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {content.section_5_comparison_vs_model.rows.map((row, i) => (
                <tr key={i}>
                  <td>{row.sleeve}</td>
                  <td className="r">{row.model_pct}</td>
                  <td className="r">{row.actual_pct}</td>
                  <td className="muted">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">06</span>Suggested talking points
          </h2>
          <div className="pdf-talk">
            {content.section_6_talking_points.map((tp, i) => (
              <div key={i} className="pdf-talk-item">
                <span className="pdf-talk-num">{tp.number}</span>
                <div className="pdf-talk-body">
                  {tp.body}
                  {tp.emphasis ? <em> {tp.emphasis}</em> : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">07</span>Evidence appendix
          </h2>
          <div className="text-[11.5px] text-ink-3 mb-2">
            Holdings the diagnostic operated on for the observations above.
          </div>
          <table className="pdf-table">
            <thead>
              <tr>
                <th>Holding</th>
                <th>Sub-category</th>
                <th className="r">Value</th>
                <th className="r">Weight</th>
              </tr>
            </thead>
            <tbody>
              {content.section_7_evidence_appendix.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td className="muted">{row.sub_category}</td>
                  <td className="r">{row.value_cr}</td>
                  <td className="r">{row.weight_pct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="pdf-foot">
          <span>Prepared, not generated. {content.coverage_note ? "" : ""}</span>
          <span>Lean Samriddhi MVP</span>
        </div>
      </article>
    </div>
  );
}
