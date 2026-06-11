/* Hand-authored SVG line chart for a monthly series (ADR-0045: charts are
 * server-rendered SVG, no charting library). Server component; pure
 * projection of the values it is given. */

type Props = {
  series: Record<string, number>;
  title: string;
  subtitle?: string;
  height?: number;
};

export function SeriesChart({ series, title, subtitle, height = 120 }: Props) {
  const months = Object.keys(series).sort();
  const values = months.map((m) => series[m]).filter((v) => typeof v === "number" && Number.isFinite(v));
  if (months.length < 2 || values.length < 2) {
    return (
      <div style={{ fontSize: 12, color: "var(--color-ink-4)" }}>
        {title}: series too short to chart ({months.length} points).
      </div>
    );
  }
  const W = 720;
  const H = height;
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => PAD_L + (i / (months.length - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - (v - min) / span) * (H - PAD_T - PAD_B);
  const pts = months
    .map((m, i) => {
      const v = series[m];
      return typeof v === "number" && Number.isFinite(v) ? `${x(i).toFixed(1)},${y(v).toFixed(1)}` : null;
    })
    .filter(Boolean)
    .join(" ");
  const first = months[0];
  const last = months[months.length - 1];
  const lastVal = series[last];
  const gridYs = [0.25, 0.5, 0.75].map((f) => PAD_T + f * (H - PAD_T - PAD_B));

  return (
    <figure style={{ margin: 0 }}>
      <figcaption
        style={{
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontSize: 10.5,
          color: "var(--color-ink-3)",
          marginBottom: 6,
        }}
      >
        {title}
        {subtitle ? <span style={{ color: "var(--color-ink-4)" }}> · {subtitle}</span> : null}
        <span style={{ color: "var(--color-ink-4)" }}>
          {" "}
          · {months.length} pts · {first} to {last} · last {Math.round(lastVal * 100) / 100}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`${title} monthly series`}>
        {gridYs.map((gy, i) => (
          <line key={i} x1={PAD_L} y1={gy} x2={W - PAD_R} y2={gy} stroke="var(--color-rule-faint)" strokeWidth={1} />
        ))}
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="var(--color-rule)" strokeWidth={1} />
        <polyline fill="none" stroke="#3F5B47" strokeWidth={1.5} points={pts} />
        <text x={PAD_L} y={H - 5} fontSize={9} fill="var(--color-ink-4)" fontFamily="var(--font-geist-mono), monospace">
          {first}
        </text>
        <text
          x={W - PAD_R}
          y={H - 5}
          fontSize={9}
          fill="var(--color-ink-4)"
          textAnchor="end"
          fontFamily="var(--font-geist-mono), monospace"
        >
          {last}
        </text>
      </svg>
    </figure>
  );
}
