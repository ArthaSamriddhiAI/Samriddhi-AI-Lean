/* Holdings overlap heatmap (T-5.09 surface 2): the portfolio_overlap edge list
 * (per_pair) pivoted into a lower-triangular holdings matrix, diagonal blanked,
 * colored by the locked v7.2 ramp. Cells carry the pairwise overlap score; the
 * resolution layer (stock-level where disclosed, structural or categorical
 * otherwise) is surfaced in the cell title and the methodology note, since the
 * score is interpreted relative to that layer.
 */
import type { PortfolioOverlapOutput } from "@/lib/agents/portfolio-overlap";

/* Color ramp ported one-to-one from the wireframe renderHeatmap. v in 0..100. */
function ramp(v: number): string {
  if (v <= 0) return "transparent";
  if (v < 8) return "rgba(232, 228, 220, 0.55)";
  if (v < 16) return "rgba(217, 196, 144, 0.55)";
  if (v < 25) return "rgba(194, 138, 29, 0.55)";
  if (v < 35) return "rgba(194, 138, 29, 0.85)";
  if (v < 50) return "rgba(63, 91, 71, 0.78)";
  return "rgba(63, 91, 71, 0.95)";
}

function shortName(name: string): string {
  return name
    .replace(/\s*\((direct|GIFT)\)\s*/i, "")
    .replace(/\s+(Fund|ETF|PMS|AIF|SIF|Industries|Limited|Ltd|Bank)\b.*$/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .join(" ");
}

/* Column headers are rotated, so a long label projects up and to the right and
 * collides with the notes column. Match the wireframe: feed the columns a short
 * single token; the row labels and the cell titles still carry the full name. */
function colLabel(name: string): string {
  const first = shortName(name).split(/\s+/)[0];
  return first.length > 11 ? first.slice(0, 11) : first;
}

export function OverlapHeatmap({ overlap }: { overlap: PortfolioOverlapOutput }) {
  const pairs = overlap.per_pair ?? [];
  if (pairs.length === 0) {
    return (
      <div className="heatmap-empty">
        No within-sleeve holding pairs to compare; pairwise overlap is not applicable for this portfolio.
      </div>
    );
  }

  const weight = new Map<string, number>();
  for (const p of pairs) {
    weight.set(p.holding_a, Math.max(weight.get(p.holding_a) ?? 0, p.weight_pct_a));
    weight.set(p.holding_b, Math.max(weight.get(p.holding_b) ?? 0, p.weight_pct_b));
  }
  const names = [...weight.keys()].sort((a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0));
  const idx = new Map(names.map((n, i) => [n, i] as const));

  const m: (null | { v: number; layer: string })[][] = names.map(() => names.map(() => null));
  for (const p of pairs) {
    const i = idx.get(p.holding_a);
    const j = idx.get(p.holding_b);
    if (i === undefined || j === undefined) continue;
    const hi = Math.max(i, j);
    const lo = Math.min(i, j);
    m[hi][lo] = { v: Math.round(p.score * 100), layer: p.resolution_layer };
  }

  const strongest = overlap.portfolio?.strongest_pair ?? null;

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-grid">
        <table className="heatmap">
          <thead>
            <tr>
              <th className="corner" />
              {names.map((n) => (
                <th key={n} className="col-lbl">
                  <div>{colLabel(n)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {names.map((rn, i) => (
              <tr key={rn}>
                <th className="row-lbl">{shortName(rn)}</th>
                {names.map((cn, j) => {
                  if (j > i) return <td key={cn} className="blank" />;
                  if (j === i) return <td key={cn} className="diag" />;
                  const cell = m[i][j];
                  if (!cell) return <td key={cn} className="cell" />;
                  return (
                    <td
                      key={cn}
                      className={`cell${cell.v >= 30 ? " dark" : ""}`}
                      style={{ background: ramp(cell.v) }}
                      title={`${rn} and ${cn}: ${cell.v}% overlap (${cell.layer.replace(/_/g, " ")})`}
                    >
                      {cell.v}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="heatmap-legend-bar">
          <span>lower</span>
          <span className="heatmap-scale" />
          <span>higher</span>
        </div>
      </div>
      <div className="heatmap-notes">
        {strongest && (
          <div className="heatmap-note">
            <span className="hn-val">{Math.round(strongest.score * 100)}%</span>
            <div className="hn-pair">
              {shortName(strongest.holding_a)} × {shortName(strongest.holding_b)}
            </div>
            <div>
              <strong>Strongest overlap.</strong> {strongest.holding_a} and {strongest.holding_b} carry the
              highest pairwise overlap in the {strongest.sleeve} sleeve; consider whether both earn their place.
            </div>
          </div>
        )}
        <p>
          Cells show pairwise overlap, interpreted relative to the resolution layer: stock-level where the
          holdings disclose constituents, structural or categorical otherwise. The diagonal is blank.
        </p>
      </div>
    </div>
  );
}
