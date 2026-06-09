/* Asset-class composition donut (v7.2 section 02, left column above the
 * per-holding donut). Single-ring donut over metrics.assetClass with the
 * advisory corpus at the center. Hand-rolled SVG per the chart-render ADR. */
import type { PortfolioMetrics } from "@/lib/agents/portfolio-risk-analytics";
import { donutArc } from "./geometry";

const CLASS_COLOR: Record<string, string> = {
  Equity: "#3F5B47",
  Debt: "#9AA688",
  Alternatives: "#C28A1D",
  Cash: "#D3CCB7",
};
const ORDER = ["Equity", "Debt", "Alternatives", "Cash"];

export function CompositionDonut({
  assetClass,
  corpusCr,
}: {
  assetClass: PortfolioMetrics["assetClass"];
  corpusCr: number;
}) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 82;
  const rInner = 56;
  const slices = ORDER.filter((k) => k in assetClass)
    .map((k) => ({ label: k, w: assetClass[k as keyof typeof assetClass].actualPct, color: CLASS_COLOR[k] ?? "#9AA688" }))
    .filter((s) => s.w > 0);
  const total = slices.reduce((s, x) => s + x.w, 0) || 1;
  let a = 0;
  const arcs = slices.map((s) => {
    const span = (s.w / total) * Math.PI * 2;
    const d = donutArc(cx, cy, rOuter, rInner, a, a + span);
    a += span;
    return { d, color: s.color, key: s.label, w: s.w };
  });

  return (
    <div className="comp-donut-block">
      <div className="donut-section-eye">Asset class</div>
      <div className="comp-donut-wrap">
        <svg viewBox={`0 0 ${size} ${size}`} width="180" height="180" role="img" aria-label="Asset class composition">
          {arcs.map((p) => (
            <path key={p.key} d={p.d} fill={p.color} stroke="#FAF8F4" strokeWidth="1.5" />
          ))}
          <text x={cx} y={cy - 1} textAnchor="middle" fontSize="17" fill="#1A1A1A" fontWeight="500" style={{ fontFamily: "var(--font-serif)" }}>
            ₹{corpusCr.toFixed(2)} Cr
          </text>
          <text x={cx} y={cy + 15} textAnchor="middle" fontSize="8.5" fill="#8A8A8A" letterSpacing="1" style={{ fontFamily: "var(--font-mono)" }}>
            ADVISORY CORPUS
          </text>
        </svg>
        <div className="comp-donut-legend">
          {arcs.map((p) => (
            <div key={p.key} className="cdl-row">
              <span className="cdl-dot" style={{ background: p.color }} />
              <span className="cdl-name">{p.key}</span>
              <span className="cdl-w">{p.w.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
