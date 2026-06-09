/* SAA two-ring donut (T-5.09 surface 3): strategic asset allocation, current
 * versus target. Outer ring is actual (solid), inner ring is target (striped,
 * same hue), per the locked v7.2 renderSAARadial. Data: metrics.assetClass.
 */
import type { PortfolioMetrics } from "@/lib/agents/portfolio-risk-analytics";
import { donutArc } from "./geometry";

const CLASS_COLOR: Record<string, string> = {
  Equity: "#3F5B47",
  Debt: "#9AA688",
  Alternatives: "#C28A1D",
  Cash: "#D3CCB7",
};
const CLASS_ORDER = ["Equity", "Debt", "Alternatives", "Cash"] as const;

export function SaaDonut({ assetClass }: { assetClass: PortfolioMetrics["assetClass"] }) {
  const cx = 65;
  const cy = 65;
  const rActOuter = 56;
  const rActInner = 44;
  const rTgtOuter = 41;
  const rTgtInner = 29;

  const slices = CLASS_ORDER.filter((k) => k in assetClass).map((k) => {
    const e = assetClass[k as keyof typeof assetClass];
    return {
      label: k,
      actual: e.actualPct,
      target: e.targetPct,
      deviation: e.deviationPct,
      inBand: e.inBand,
      color: CLASS_COLOR[k] ?? "#9AA688",
    };
  });

  const totalActual = slices.reduce((s, x) => s + x.actual, 0) || 1;
  const totalTarget = slices.reduce((s, x) => s + x.target, 0) || 1;

  let aA = 0;
  const actualPaths = slices.map((s) => {
    const span = (s.actual / totalActual) * Math.PI * 2;
    const d = donutArc(cx, cy, rActOuter, rActInner, aA, aA + span);
    aA += span;
    return { d, color: s.color, key: s.label };
  });

  let aT = 0;
  const targetPaths = slices.map((s, i) => {
    const span = (s.target / totalTarget) * Math.PI * 2;
    const d = donutArc(cx, cy, rTgtOuter, rTgtInner, aT, aT + span);
    aT += span;
    return { d, key: s.label, idx: i };
  });

  const flags = slices.filter((s) => !s.inBand);

  return (
    <div className="saa-radial">
      <div className="saa-radial-eye">Strategic allocation deviation</div>
      <div className="saa-radial-body">
        <svg
          className="saa-radial-svg"
          viewBox="0 0 130 130"
          role="img"
          aria-label="Strategic asset allocation, current outer ring versus target inner ring"
        >
          <defs>
            {slices.map((s, i) => (
              <pattern
                key={s.label}
                id={`saa-stripe-${i}`}
                patternUnits="userSpaceOnUse"
                width="4"
                height="4"
                patternTransform="rotate(-45)"
              >
                <rect x="0" y="0" width="4" height="4" fill={s.color} opacity="0.22" />
                <line x1="0" y1="0" x2="0" y2="4" stroke={s.color} strokeWidth="1.6" opacity="0.7" />
              </pattern>
            ))}
          </defs>
          {actualPaths.map((p) => (
            <path key={`a-${p.key}`} d={p.d} fill={p.color} stroke="#FAF8F4" strokeWidth="1.2" />
          ))}
          {targetPaths.map((p) => (
            <path key={`t-${p.key}`} d={p.d} fill={`url(#saa-stripe-${p.idx})`} stroke="#FAF8F4" strokeWidth="1.2" />
          ))}
          <circle cx={cx} cy={cy} r="2" fill="#D8D2C5" />
        </svg>
        <div className="saa-legend">
          {slices.map((s) => {
            const cls = s.inBand ? "inband" : s.deviation > 0 ? "over" : "under";
            const sign = s.deviation > 0 ? "+" : "";
            return (
              <div key={s.label} className="sl-row">
                <span className="sl-name">
                  <span className="sl-dot" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className={`sl-delta ${cls}`}>
                  {sign}
                  {s.deviation.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {flags.length > 0 && (
        <div className="saa-flags">
          {flags.map((s) => {
            const word = s.deviation > 0 ? "overweight" : "underweight";
            return (
              <span key={s.label} className={`saa-flag ${s.deviation > 0 ? "" : "under"}`}>
                {s.label} {word}, {s.deviation > 0 ? "+" : ""}
                {s.deviation.toFixed(1)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
