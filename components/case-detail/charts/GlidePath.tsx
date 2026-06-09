/* Rebalance glide-path (T-5.09 surface 5): one position's weight trajectory
 * from current, through each staged trim, to target, against the policy
 * threshold. Ported from the locked v7.2 hand-coded glide-path SVG, generalized
 * from the wireframe's single hardcoded path to N points off the data. Data:
 * a3_so_what.rebalance_proposal.computed.positions[]. Rupee trims are a render
 * time conversion of trim_pct_points against the liquid corpus.
 */
import type { A3RebalancePosition } from "@/lib/agents/a3-so-what";

const POINT_COLOR = ["#C28A1D", "#9AA688", "#3F5B47", "#3F5B47", "#3F5B47", "#3F5B47"];

export function GlidePath({
  position,
  corpusCr,
}: {
  position: A3RebalancePosition;
  corpusCr: number;
}) {
  const W = 780;
  const H = 220;
  const xLeft = 120;
  const xRight = 680;
  const yTop = 30;
  const yBottom = 170;

  const pts = [
    { sub: "NOW", w: position.current_weight_pct },
    ...position.glide_path.map((g, i) => ({
      sub: i === position.glide_path.length - 1 ? "TARGET" : `STEP ${g.step}`,
      w: g.resulting_weight_pct,
    })),
  ];

  const domainVals = [...pts.map((p) => p.w), position.breach_threshold_pct, position.target_weight_pct];
  const wHi = Math.max(...domainVals);
  const wLo = Math.min(...domainVals);
  const pad = Math.max(0.5, (wHi - wLo) * 0.18);
  const dHi = wHi + pad;
  const dLo = wLo - pad;

  const yOf = (w: number) => yTop + ((dHi - w) / (dHi - dLo || 1)) * (yBottom - yTop);
  const xOf = (i: number) =>
    pts.length === 1 ? (xLeft + xRight) / 2 : xLeft + (i / (pts.length - 1)) * (xRight - xLeft);
  const yThresh = yOf(position.breach_threshold_pct);
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(p.w).toFixed(1)}`).join(" ");
  const gradId = `glide-grad-${position.instrument.replace(/\W/g, "")}`;

  const fontMono = { fontFamily: "var(--font-mono)" };
  const fontSerif = { fontFamily: "var(--font-serif)" };
  const fontSans = { fontFamily: "var(--font-sans)" };

  return (
    <div className="glide-path">
      <div className="glide-path-eye">Portfolio-level rebalance proposal</div>
      <h3 className="glide-path-title">{position.instrument}, weight glide path</h3>
      <div className="glide-path-svg-wrap">
        <svg className="glide-path-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${position.instrument} weight trajectory toward target`}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#C28A1D" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#3F5B47" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          <line x1="60" y1={yBottom} x2="740" y2={yBottom} stroke="#D8D2C5" strokeWidth="1" />
          <line x1="60" y1={yThresh} x2="740" y2={yThresh} stroke="#B23A2D" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
          <text x="744" y={yThresh + 4} fontSize="10" fill="#B23A2D" fontWeight="500" style={fontMono}>
            {position.breach_threshold_pct}% policy threshold
          </text>

          <path d={linePath} stroke={`url(#${gradId})`} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {pts.map((p, i) => {
            const end = i === 0 || i === pts.length - 1;
            return (
              <g key={i}>
                <circle cx={xOf(i)} cy={yOf(p.w)} r={end ? 7 : 6} fill={POINT_COLOR[Math.min(i, POINT_COLOR.length - 1)]} stroke="#FAF8F4" strokeWidth="2.5" />
                <text x={xOf(i)} y={yOf(p.w) - 13} textAnchor="middle" fontSize={end ? 22 : 18} fill="#1A1A1A" fontWeight="500" style={fontSerif}>
                  {p.w.toFixed(1)}%
                </text>
                <text x={xOf(i)} y="195" textAnchor="middle" fontSize="11" fill="#8A8A8A" letterSpacing="1.2" style={fontSans}>
                  {p.sub}
                </text>
              </g>
            );
          })}

          {position.glide_path.map((g, i) => {
            const xm = (xOf(i) + xOf(i + 1)) / 2;
            const ym = Math.min(yOf(pts[i].w), yOf(pts[i + 1].w)) - 22;
            const cr = (g.trim_pct_points / 100) * corpusCr;
            return (
              <g key={`trim-${i}`} transform={`translate(${xm.toFixed(1)}, ${ym.toFixed(1)})`}>
                <text x="0" y="0" textAnchor="middle" fontSize="11" fill="#4A4A4A" fontWeight="500" style={fontMono}>
                  trim approx
                </text>
                <text x="0" y="14" textAnchor="middle" fontSize="14" fill="#1A1A1A" fontWeight="500" style={fontMono}>
                  ₹{cr.toFixed(2)} Cr
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="glide-meta-strip">
        <div className="gm-item">
          <span className="gm-label">Trigger</span>
          <span className="gm-val">
            Single-position weight above the <strong>{position.breach_threshold_pct}% threshold</strong>; the trim is
            staged over {position.glide_path.length} step{position.glide_path.length > 1 ? "s" : ""} to spread market impact and the tax event.
          </span>
        </div>
        <div className="gm-item">
          <span className="gm-label">Total trim</span>
          <span className="gm-val">
            <strong>{position.total_trim_pct_points.toFixed(1)} pp</strong> from {position.current_weight_pct.toFixed(1)}% toward the {position.target_weight_pct.toFixed(1)}% target.
          </span>
        </div>
        <div className="gm-item">
          <span className="gm-label">Tax implication</span>
          <span className="gm-val">
            <em>Capital gains subject to LTCG or STCG per holding period; trimming the older lots first is more tax-efficient.</em>
          </span>
        </div>
      </div>
    </div>
  );
}
