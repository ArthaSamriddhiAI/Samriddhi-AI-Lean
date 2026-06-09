# ADR 0045: Chart-render technology for the Samriddhi 2 diagnostic surfaces, hand-rolled SVG

## Status

Accepted, 2026-06-09. Shipped as T-5.09 on `features/render-bundle-sweep`. The
decision was surfaced as the one architectural call of the render bundle and
ratified by the primary at the execution-plan gate (WA30 disposition: net-new).
The render bundle audit is `docs/audits/2026-06-04_render_bundle_audit.md`.

## Context

T-5.09 renders the five shipped capability surfaces onto the Samriddhi 2 case
screen against the locked v7.2 wireframe: the SAA two-ring donut, the per-holding
donut, the holdings overlap heatmap, the rebalance glide-path, and the so-what
advisor-action prose. Four of the five need charting.

Two facts framed the choice. First, the stack carries no charting library
(`package.json` dependencies are next, react, prisma, `@react-pdf/renderer`,
react-markdown; the codebase already hand-rolls SVG in
`components/chrome/Icons.tsx` and the accordion chevrons). Second, the locked
wireframe draws every one of its four charts as inline SVG (15 `<svg>` nodes, 14
`<path>`, `stroke-dasharray` for the striped target ring and the dashed policy
threshold, zero `<canvas>` and zero CSS gradients), with the donut and heatmap
geometry living in small render functions and the glide-path as hand-coded SVG.

## Decision

The five surfaces render as hand-rolled SVG React components, ported one-to-one
from the wireframe's own SVG, with no charting dependency added. They live under
`components/case-detail/charts/` and share one geometry helper
(`geometry.ts`: `donutArc`, `polar`, a color ramp), reproducing the wireframe's
angle convention (angle 0 at twelve o'clock, sweeping clockwise). They are pure
server components: the persisted data is read into static SVG, no client
interactivity and no imperative redraw.

Reasons: the four surfaces are bespoke, not standard chart types (a two-ring
donut with a striped target ring, a diagonal-blanked lower-triangular overlap
heatmap, an annotated glide-path with a threshold line and rupee trims), so a
generic charting library would be customized heavily to match a locked pixel
spec; the wireframe is already SVG, so the port is the lowest-divergence path;
SVG carries to JSX with zero new dependency and zero bundle cost; and the
surfaces stay fully customizable for future diagnostic charts.

Alternatives rejected:

- **A charting library (recharts, visx, or similar).** Faster for standard chart
  types, but these surfaces are non-standard, so the library would be fought to
  match the locked visuals and would still drop to custom SVG for the bespoke
  parts, while adding a net-new dependency and bundle weight. Net cost over
  hand-rolled SVG is negative here.
- **CSS only (conic-gradient donuts plus a DOM-grid heatmap).** No dependency,
  but it cannot cleanly express the two-ring striped donut, the triangular color
  ramp, or the glide-path, and it would fragment the approach away from the
  wireframe's SVG.

## Consequences

- **Positive.** Zero charting dependency and zero bundle cost; exact fidelity to
  the locked wireframe; server-renderable static SVG (verified: the five cases
  render at HTTP 200 with the surfaces present and no runtime errors); the shared
  geometry helper keeps the four components consistent.
- **Trade-off to watch.** Hand-rolled charts carry their own geometry and gain no
  library affordances (axis ticks, legends, tooltips, responsive reflow) for
  free; acceptable because the surfaces are static reads of persisted data, and
  the shared helper bounds the duplication.
- **Convention set.** Future Samriddhi 2 diagnostic charts, and the later slide
  deck (T-5.10) that consumes these surfaces, inherit this convention: hand-rolled
  SVG ported from the locked design, no charting library, unless and until a
  surface genuinely needs interactive charting, which would reopen this ADR.

## Cross-references

WA09 (capability ships data, design ships render; T-5.09 is the render half),
WA30 (this disposition), ADR-0031 (A3 so-what, which names T-5.09 as the render
pass for the glide-path and so-what surfaces), ADR-0046 (the Concept C tab
amendment, the render bundle's sibling decision), the render bundle audit
(`docs/audits/2026-06-04_render_bundle_audit.md`).

## Annotation, 2026-06-09 (the section 07 horizon toggle)

The v7.2 fidelity pass added the first client-interactive chart surface: the
section 07 risk-reward hero's 3Y/5Y horizon toggle
(`components/case-detail/charts/RrHero.tsx`). The Consequences above said a
surface that genuinely needs interactive charting would reopen this ADR; the
toggle is the first such need, and it reopens narrowly. It is plain React
`useState` over the same hand-rolled markup, switching which horizon's statistics
show; it introduces no charting library and no client-state framework. Metrics
that are 3Y-only in the data (beta, R-squared, information ratio, Jensen's alpha)
render an honest "3Y only" on the 5Y view rather than a blank or a fabricated 5Y
value (the partial-5Y data limitation, logged as debt). The hand-rolled-SVG
decision is unchanged; this records that interactivity, when needed, is added as
plain React state, not a library.
