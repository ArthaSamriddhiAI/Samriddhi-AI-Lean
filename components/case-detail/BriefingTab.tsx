import { SHAILESH_BHATT_CASE } from "@/lib/fixtures/shailesh-bhatt-case";

/* Briefing PDF tab. Renders an on-screen approximation of the eventual PDF.
 * The real PDF export (React PDF) lands in slice 2 alongside real reasoning. */

type Props = {
  investorName: string;
  snapshotDate: string;
  caseId: string;
};

export function BriefingTab({ investorName, snapshotDate, caseId }: Props) {
  const b = SHAILESH_BHATT_CASE.briefing;
  return (
    <div className="pdf-area">
      <article className="pdf-doc">
        <header className="pdf-head">
          <div className="pdf-head-left">
            <div className="pdf-eyebrow">Investor briefing · Lean Samriddhi</div>
            <h1 className="pdf-title">{investorName}</h1>
            <div className="pdf-subtitle">
              <span>Quarterly review</span>
              <span className="dot-sep">·</span>
              <span>Snapshot {snapshotDate}</span>
              <span className="dot-sep">·</span>
              <span>
                Liquid AUM <span className="mono">{SHAILESH_BHATT_CASE.header.liquidAumCr}</span>
              </span>
              <span className="dot-sep">·</span>
              <span>{SHAILESH_BHATT_CASE.header.statedRevealed}</span>
            </div>
          </div>
          <div className="pdf-head-right">
            <div>Case {caseId}</div>
            {b.headerRight.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </header>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">01</span>Headline observations
          </h2>
          <ul className="pdf-bullets">
            {b.headlineObservations.map((o, i) => (
              <li key={i}>
                <span className="vocab-term">{o.vocab}</span> {o.body}
                {o.strong ? <strong>{o.strong}</strong> : null}
                {o.tail ?? ""}
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
              {SHAILESH_BHATT_CASE.allocationTable.map((row) => (
                <tr key={row.class}>
                  <td>{row.class}</td>
                  <td className="r">{row.actual}</td>
                  <td className="r">{row.target}</td>
                  <td className="r muted">{row.band}</td>
                  <td className="r">{row.deviation}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pdf-line">
            Liquid AUM <span className="val">{SHAILESH_BHATT_CASE.header.liquidAumCr}</span> · liquidity tier{" "}
            <span className="val">essential (5-15% floor)</span> · actual T+30 plus T+90 share{" "}
            <span className="val">16.2%</span>, within tier.
          </div>
        </section>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">03</span>Concentration analysis
          </h2>
          {b.concentrationBreaches.map((br, i) => (
            <div key={i} className="pdf-breach">
              <span className={`b-kind ${br.kindClass}`}>{br.kind}</span>
              <span className="b-detail">
                {br.detail} <em>{br.em}</em>
              </span>
              <span className="b-figure">{br.figure}</span>
            </div>
          ))}
        </section>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">04</span>Risk flags
          </h2>
          <div className="pdf-flag-list">
            {b.riskFlags.map((flag, i) => (
              <div key={i} className={`pdf-flag fl-${flag.tone}`}>
                <span className="fl-cat">{flag.cat}</span>
                <div className="fl-body">
                  <strong>{flag.title}</strong> {flag.body}
                  {"em" in flag && flag.em ? <em> {flag.em}</em> : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">05</span>Comparison versus model portfolio
          </h2>
          <div className="pdf-line" style={{ marginBottom: 14 }}>
            Direct comparison applies: investor mandate sits in the aggressive long-term cell. The model&apos;s{" "}
            <span className="val">65 / 25 / 7 / 3</span> split is the reference.
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
              {b.modelComparison.map((row, i) => (
                <tr key={i}>
                  <td>{row.sleeve}</td>
                  <td className="r">{row.model}</td>
                  <td className="r">{row.actual}</td>
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
            {b.talkingPoints.map((tp, i) => (
              <div key={i} className="pdf-talk-item">
                <span className="pdf-talk-num">{tp.num}</span>
                <div className="pdf-talk-body">
                  {tp.body}
                  {tp.em ? <em>{tp.em}</em> : null}
                  {tp.tail}
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
            Holdings the diagnostic operated on for the observations above. Full holdings detail is in the case audit view.
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
              {b.evidenceAppendix.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td className="muted">{row.sub}</td>
                  <td className="r">{row.value}</td>
                  <td className="r">{row.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="pdf-foot">
          <span>Prepared, not generated.</span>
          <span>Page 2 of 2 · Lean Samriddhi MVP</span>
        </div>
      </article>
    </div>
  );
}
