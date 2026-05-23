# Design debt log

X-series. UI and UX design shortcuts taken for demo expediency (distinct from the render-layer deferrals tracked in `ui_ux_debt_log.md`). Restructured out of the combined `PRODUCT_DEBT_LOG.md`; see `README.md` for the convention.

| ID | Description | Severity | Originating workstream | Target fix workstream |
|----|-------------|----------|------------------------|------------------------|
| X1 | Case list is a flat sortable view. Production would want filters, segments, and saved searches. | Low | Slice 1 scaffolding | Slice 7 polish (filter pills already scoped there) |
| X2 | Settings is a single page. Production would organise it into Account / Firm Configuration / Demo Data / Diagnostic Tools categories. | Low | Slice 1 scaffolding | Slice 7 polish |
| X3 | No primary-vs-archive case distinction. All cases sit in one undifferentiated list. | Low | Slice 1 scaffolding | Slice 5 or Slice 7 (design the distinction) |
| X4 | No mobile-responsive treatment; the current design is desktop-only. | Medium | Slice 1 design system | Slice 7 polish or a dedicated responsive pass |
| X5 | No keyboard-navigation audit; accessibility (focus rings, ARIA, keyboard nav) is deferred. | Medium | Slice 1 design system | Slice 7 accessibility audit |
| X6 | Investor profile pages are dense. Likely worth reorganising after real-user feedback rather than speculatively. | Low | Slice 1 design system | Post-real-user-feedback |

