# ADR 0046: Concept C tab amendment, the Samriddhi 2 Analyst Reports tab

## Status

Accepted, 2026-06-09. Shipped as T-5.08 on `features/render-bundle-sweep`.
Surfaced during the render bundle plan (the v7.2 wireframe specifies no Analyst
Reports surface) and ratified by the primary at the execution-plan gate (WA30
disposition: net-new; amends the Concept C no-tab-strip decision). The render
bundle audit is `docs/audits/2026-06-04_render_bundle_audit.md`.

## Context

Concept C, the locked accordion redesign landed in PR #2 (commit f26ecee), made
the Samriddhi 2 diagnostic surface deliberately tab-free: the page comment in
`app/cases/[id]/page.tsx` records "the analysis surface is the page; there is no
tab strip," and the former Briefing PDF tab became a Download toolbar button.

T-5.08 ports the Samriddhi 1 Analyst Reports surface (the per-agent reasoning
memos) onto the Samriddhi 2 case screen. Two findings from the render bundle
audit framed the placement. First, the v7.2 wireframe contains no Analyst Reports
surface at all (zero mentions of "analyst"), so the port has no wireframe
placement to inherit; the existing Samriddhi 1 Concept C Analyst Reports
component is its design authority. Second, the Samriddhi 2 diagnostic screen is
tab-free by the Concept C decision, so there is no existing affordance to reach a
secondary view. Mounting the Analyst Reports surface therefore forces a decision
about how it is reached.

## Decision

The Samriddhi 2 diagnostics analysis surface stays tab-free as Concept C holds;
the Analyst Reports surface earns a re-introduced tab strip (Analysis, Analyst
reports) as the one deliberate exception. This is a bounded amendment, not a
reversal of Concept C: the analysis page itself remains a single scrolling,
signal-led accordion with no internal tabs; the only tab affordance is the
toggle between the analysis page and the Analyst Reports reasoning trail. It
mirrors the Samriddhi 1 case screen's existing Outcome, Analyst reports strip,
so the pattern is already in the product, not invented here.

Two render decisions are recorded alongside the placement:

- **Native render, not coercion.** The Samriddhi 2 Analyst Reports tab renders
  the Samriddhi 2 evidence shape (`content.evidence.e1..e7`, which carries
  per-stock verdicts) natively in the existing memo visual language, rather than
  coercing it into the Samriddhi 1 single agent-level `CaseEvidenceVerdict`
  shape, which would drop the per-stock detail and invent a risk level and
  confidence the Samriddhi 2 evidence does not carry. No new computation and no
  new persisted schema; the tab reads the persisted evidence as is (WA09).
- **E5 omitted at render.** The Samriddhi 2 diagnostic does not activate the
  unlisted-equity agent, so `content.evidence` carries no `e5` key; the omission
  falls out of the data and needs no special case. This is the render-side
  resolution of the no-E5-row decision recorded against tech debt T16.

## Consequences

- **Positive.** The per-agent reasoning trail is reachable on the Samriddhi 2
  case screen; Concept C's clean single-surface analysis page is preserved
  underneath; the exception is explicit and bounded rather than a silent
  re-tabbing.
- **Trade-off.** A tab strip reappears on a screen Concept C deliberately made
  tab-free; the departure is small (one toggle to a secondary reasoning view) and
  is justified by the absent wireframe placement and the need to surface the
  memos.
- **Scope of precedent.** Narrow. The amendment authorizes one toggle to a
  secondary reasoning view, not a general re-tabbing of the diagnostic surface.

## Cross-references

Concept C (PR #2, commit f26ecee; the no-tab-strip decision this amends; Concept
C was a redesign PR, not a numbered ADR, so there is no prior ADR Status line to
annotate forward), WA09 (capability ships data, design ships render), WA13
(Samriddhi 1 / Samriddhi 2 naming), WA30 (this disposition), ADR-0030 (the T-5.08
Analyst Reports adapter framing), ADR-0045 (the chart-render-technology sibling
decision), tech debt T16 (E5 inert dispatch), the render bundle audit
(`docs/audits/2026-06-04_render_bundle_audit.md`).
