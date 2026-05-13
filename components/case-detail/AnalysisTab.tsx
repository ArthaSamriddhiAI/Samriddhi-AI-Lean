import { SHAILESH_BHATT_CASE } from "@/lib/fixtures/shailesh-bhatt-case";

/* Analysis tab content. Renders the Shailesh Bhatt workbench view as static
 * fixture content per the approved orientation Q5 option a. The investor
 * name shown in the workbench header is the investor on the actual case
 * row (passed in via props) so the chrome reflects what the user picked;
 * the analytical body remains Shailesh-flavoured. */

type Props = {
  investorName: string;
  snapshotDate: string;
};

export function AnalysisTab({ investorName, snapshotDate }: Props) {
  const f = SHAILESH_BHATT_CASE;
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
              <span>{f.header.liquidAumCr} liquid AUM</span>
              <span style={{ color: "var(--color-ink-5)" }}>·</span>
              <span>{f.header.holdingsLine}</span>
              <span style={{ color: "var(--color-ink-5)" }}>·</span>
              <span>{f.header.statedRevealed}</span>
            </div>
          </div>
          <div className="workbench-stats">
            <div className="workbench-stat">
              <span className="ws-mark" style={{ background: "var(--color-neg)" }} />
              <span className="ws-val">{f.header.severityCounts.escalate}</span>
              <span className="ws-label">escalate</span>
            </div>
            <div className="workbench-stat">
              <span className="ws-mark" style={{ background: "var(--color-warn)" }} />
              <span className="ws-val">{f.header.severityCounts.flag}</span>
              <span className="ws-label">flag</span>
            </div>
            <div className="workbench-stat">
              <span className="ws-mark" style={{ background: "var(--color-ink-5)" }} />
              <span className="ws-val">{f.header.severityCounts.total}</span>
              <span className="ws-label">total</span>
            </div>
          </div>
        </div>

        <div className="workbench-lede">{f.workbenchLede}</div>

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
              {f.allocationTable.map((row) => (
                <tr key={row.class}>
                  <td>{row.class}</td>
                  <td className="r">{row.actual}</td>
                  <td className="r">{row.target}</td>
                  <td className="r muted">{row.band}</td>
                  <td
                    className={`r${row.deviationTone === "muted" ? " muted" : ""}`}
                    style={row.deviationTone === "warn" ? { color: "var(--color-warn)" } : undefined}
                  >
                    {row.deviation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-[11.5px] text-ink-4 font-mono">{f.liquidityLine}</div>
        </section>

        <section className="workbench-section">
          <div className="workbench-section-head">
            Diagnostic observations · {f.observations.length} of {f.observations.length}
          </div>
          {f.observations.map((obs, i) => (
            <div key={i} className={`wb-obs sev-${obs.severity}`}>
              <div className="wb-obs-head">
                <div className="wb-obs-title">
                  <span className="wb-obs-name">{obs.name}</span>
                  <span className="wb-obs-meta">
                    {obs.category} · {obs.severity === "escalate" ? "Escalate" : "Flag"}
                  </span>
                </div>
                <span className="wb-obs-figure">{obs.figure}</span>
              </div>
              <div className="wb-obs-body">
                {obs.body}
                {"bodyTail" in obs && obs.bodyTail ? (
                  <em> {obs.bodyTail}</em>
                ) : null}
              </div>
              {"evidence" in obs && obs.evidence ? (
                <div className="wb-obs-evidence">
                  <div className="wb-obs-ev-eye">{obs.evidence.eye}</div>
                  <div className="wb-obs-ev-list">
                    {obs.evidence.rows.map((row, j) => (
                      <div className="wb-obs-ev-row" key={j}>
                        <span className="ev-label">{row.label}</span>
                        <span className="ev-val">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </section>

        <section className="workbench-section">
          <div className="workbench-section-head">
            Holdings reference · {f.holdings.length} of {f.holdings.length} analysed
          </div>
          <table className="audit-holdings">
            <thead>
              <tr>
                <th>Holding</th>
                <th>Sub-category</th>
                <th className="r">Value (Rs Cr)</th>
                <th className="r">Weight</th>
                <th className="r">Bucket</th>
              </tr>
            </thead>
            <tbody>
              {f.holdings.map((h) => (
                <tr key={h.name}>
                  <td>{h.name}</td>
                  <td>
                    <span className="sub-cat">{h.subCat}</span>
                  </td>
                  <td className="r">{h.value}</td>
                  <td className="r">{h.weight}</td>
                  <td className="r">{h.bucket}</td>
                </tr>
              ))}
              <tr className="subtotal">
                <td colSpan={2}>Liquid AUM total</td>
                <td className="r">{f.holdingsTotal.value}</td>
                <td className="r">{f.holdingsTotal.weight}</td>
                <td className="r" />
              </tr>
            </tbody>
          </table>
        </section>

        <section className="workbench-section">
          <div className="workbench-section-head">Coverage notes</div>
          <p className="text-[12.5px] text-ink-3 leading-[1.6] max-w-[720px] m-0">
            {f.coverageNote}
          </p>
        </section>
      </div>
    </div>
  );
}
