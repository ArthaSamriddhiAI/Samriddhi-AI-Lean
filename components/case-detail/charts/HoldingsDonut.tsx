/* Per-holding donut (T-5.09 surface 4): every holding by weight, the heaviest
 * named at the center. Flagged holdings (the concentration positionFlags) read
 * ochre; the rest descend a green ramp. Ported from the locked v7.2
 * renderHoldingsDonut. Data: the holdings prop plus the flagged set.
 */
import { donutArc, lerpHex } from "./geometry";

type Holding = { instrument: string; weight_pct: number };

export function HoldingsDonut({
  holdings,
  flagged,
}: {
  holdings: Holding[];
  flagged: Set<string>;
}) {
  const sorted = holdings
    .filter((h) => h.weight_pct > 0)
    .sort((a, b) => b.weight_pct - a.weight_pct);
  if (sorted.length === 0) return null;

  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 100;
  const rInner = 64;
  const total = sorted.reduce((s, h) => s + h.weight_pct, 0) || 1;

  let a = 0;
  const arcs = sorted.map((h, i) => {
    const span = (h.weight_pct / total) * Math.PI * 2;
    const d = donutArc(cx, cy, rOuter, rInner, a, a + span);
    a += span;
    const isFlag = flagged.has(h.instrument);
    const green = sorted.length === 1 ? "#3F5B47" : lerpHex("#3F5B47", "#E0E5DD", i / (sorted.length - 1));
    return { d, color: isFlag ? "#C28A1D" : green, key: h.instrument, weight: h.weight_pct, isFlag };
  });

  const top = sorted[0];

  return (
    <div className="holdings-donut-block">
      <div className="donut-section-eye">By holding, weight visible</div>
      <div className="holdings-donut-wrap">
        <svg viewBox={`0 0 ${size} ${size}`} width="240" height="240" role="img" aria-label="Per-holding portfolio weights">
          {arcs.map((p) => (
            <path key={p.key} d={p.d} fill={p.color} stroke="#FAF8F4" strokeWidth={p.isFlag ? 1.8 : 1.2} />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="10" letterSpacing="1.5" fill="#8A8A8A" style={{ fontFamily: "var(--font-mono)" }}>
            TOP HOLDING
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="20" fill="#1A1A1A" fontWeight="500" style={{ fontFamily: "var(--font-serif)" }}>
            {top.weight_pct.toFixed(1)}%
          </text>
          <text x={cx} y={cy + 28} textAnchor="middle" fontSize="11" fontStyle="italic" fill="#C28A1D" style={{ fontFamily: "var(--font-serif)" }}>
            {top.instrument}
          </text>
        </svg>
      </div>
      <div className="holdings-donut-legend">
        {arcs.map((p) => (
          <div key={p.key} className="hl-row">
            <span className="hl-dot" style={{ background: p.color }} />
            <span className={`hl-name${p.isFlag ? " flag" : ""}`}>{p.key}</span>
            <span className="hl-val">{p.weight.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
