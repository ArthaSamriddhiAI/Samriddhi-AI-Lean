# ADR 0047: The v7.2 composed page supersedes the Concept C accordion as the Samriddhi 2 analysis-page structure

## Status

Accepted, 2026-06-09. Built on `features/render-bundle-sweep`. Surfaced by the
layout-gap audit (`docs/audits/2026-06-09_layout_gap.md`) and ratified at the
v7.2 rebuild-plan gate (WA30 disposition: structural supersede; WA28 stop-and-propose
on a product-shape decision).

## Context

The render bundle first rendered the Samriddhi 2 surfaces into a uniform
severity-driven accordion (the Concept C structure, the locked accordion redesign
from PR #2, commit f26ecee). Painted-DOM verification then exposed two faults: the
charts sat in collapsed rows and never painted for the reviewer, and, more
fundamentally, the locked v7.2 wireframe is not a uniform accordion at all. The
layout-gap audit decoded the wireframe (its body is JS-string-encoded) and found a
composed twelve-section editorial page: each section carries a bespoke layout (a
market-outlook frame, a two-donut composition block, a per-holding verdict roster,
observation cards, a risk-reward hero, an overlap heatmap, a sleeve map, a
rebalance glide-path), not a row of identical severity-keyed disclosures. Rendering
it as a uniform accordion was a structural mismatch; the charts and the so-what
prose were correct, the page skeleton was wrong.

## Decision

The Samriddhi 2 analysis page is the v7.2 composed page. The shell is a case
header, a headline takeaway, then native `<details>` sections (01 Market outlook,
02 Portfolio composition, 03 Per-holding verdicts, 04 Portfolio observations, 06
Portfolio performance, 07 Risk-reward, 08 Holdings overlap, 09 Overlap and
consolidation, 11 Rebalance framework) with 01 to 04 open and the rest
collapsible, then a disclaimer. Each section renders its own bespoke layout.
Severity pills are confined to section 04 (portfolio observations), not spread
across the page. The salvaged hand-rolled charts (ADR-0045) mount into their
sections.

Of the twelve wireframe sections: 05 (critical review) is omitted per ADR-0040
(the A1 collision); 10 (valuation) and 12 (decision history) are deferred; section
06's continuous gross-and-net performance line is deferred to the data-management
workstream per ADR-0048 (P50, D14), so 06 ships its window bars only.

## Consequences

- Supersedes the Concept C uniform-accordion page structure for Samriddhi 2.
  Concept C was a redesign PR, not a numbered ADR, so there is no prior ADR Status
  line to flip; this ADR is the superseding record.
- The Analyst Reports tab (ADR-0046) still holds: the composed Analysis page and
  the Analyst Reports tab coexist in the tab strip; ADR-0046 carries a forward
  annotation to here.
- The hand-rolled-SVG chart decision (ADR-0045) is unchanged; the charts mount
  into composed sections rather than accordion rows.
- The dead `.ar-c-*` accordion CSS from the Concept C skeleton is swept as debt.
- WA09: design ships render; the composed page is the render half of the shipped
  capabilities, built to the locked wireframe with no reinterpretation beyond the
  ratified Analyst Reports tab.

## References

WA28 (stop-and-propose), WA30 (this disposition), WA09 (capability ships data,
design ships render), ADR-0045 (chart-render technology), ADR-0046 (Analyst
Reports tab), ADR-0048 (render-bundle re-scope and section 06 line deferral),
ADR-0040 (section 05 omission), the layout-gap audit
(`docs/audits/2026-06-09_layout_gap.md`).

## Ratified divergences from the wireframe, 2026-06-09

The composed page tracks the locked v7.2 wireframe with two deliberate,
primary-approved divergences, recorded here as intentional design decisions, not
as unfinished work:

- The Analyst Reports tab (ADR-0046), the one structural exception.
- The section 03 MMDR proportion strip. The wireframe draws the maintain /
  monitor / discuss / review split as a pie; this build renders it as a
  horizontal proportion strip. The primary explicitly approved the strip as the
  better read for a four-way proportion at this size. It is a chosen divergence
  with sign-off, not a fidelity gap, and is not to be rebuilt into a pie.
