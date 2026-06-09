/* Shared SVG geometry for the Samriddhi 2 diagnostic charts (T-5.09).
 *
 * Ported one-to-one from the locked v7.2 wireframe's own render functions
 * (donutArc / pieSlice): angle 0 sits at twelve o'clock and sweeps clockwise,
 * x = cx + sin(a) * r, y = cy - cos(a) * r. Hand-rolled SVG, no charting
 * library, per the chart-render-technology ADR. These are pure functions so
 * the chart components stay server-renderable.
 */

/** Point on a circle. Angle 0 at top, increasing clockwise. */
export function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + Math.sin(a) * r, cy - Math.cos(a) * r];
}

/** Annular-sector path (one donut slice) between two radii and two angles. */
export function donutArc(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startA: number,
  endA: number,
): string {
  const [sx1, sy1] = polar(cx, cy, rOuter, startA);
  const [ex1, ey1] = polar(cx, cy, rOuter, endA);
  const [sx2, sy2] = polar(cx, cy, rInner, endA);
  const [ex2, ey2] = polar(cx, cy, rInner, startA);
  const large = endA - startA > Math.PI ? 1 : 0;
  return [
    `M ${sx1.toFixed(2)} ${sy1.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${ex1.toFixed(2)} ${ey1.toFixed(2)}`,
    `L ${sx2.toFixed(2)} ${sy2.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${ex2.toFixed(2)} ${ey2.toFixed(2)}`,
    "Z",
  ].join(" ");
}

/** Linear interpolation between two hex colors. Used for the per-holding
 * donut's descending green ramp so any holding count renders cleanly. */
export function lerpHex(from: string, to: string, t: number): string {
  const f = hexToRgb(from);
  const g = hexToRgb(to);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return rgbToHex(mix(f[0], g[0]), mix(f[1], g[1]), mix(f[2], g[2]));
}

function hexToRgb(h: string): [number, number, number] {
  const m = h.replace("#", "");
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
