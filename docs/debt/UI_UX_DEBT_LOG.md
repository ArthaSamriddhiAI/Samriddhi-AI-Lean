# UI/UX debt log

Render-layer debt deferred to the Capability Surfaces Design workstream and beyond. Capability workstreams ship data only (WA9); this log captures the rendering decisions they defer. Companion to `docs/debt/PRODUCT_DEBT_LOG.md` (tech / product / data / production-data / operational debt).

## UX-series

| ID | Description | Severity | Originating workstream | Target fix workstream |
|----|-------------|----------|------------------------|------------------------|
| UX1 | Per-stat benchmark disclosure. Every benchmark-relative number (beta, R-squared, tracking error, information ratio) must show which `index_id` it was computed against. Tooltip, footnote, or inline disclosure pattern; design call. | Medium | Risk-reward | Capability Surfaces Design |
| UX2 | Sentinel display register. How `benchmark_structurally_inapplicable`, `benchmark_not_in_snapshot`, `pms_disclosure_limited`, `opaque_wrapper`, `not_applicable_for_risk_reward`, `insufficient_history`, `currency_conversion_pending` visually present in the case detail UI (greyed cells, explicit text, tooltips). Design call. | Medium | Risk-reward | Capability Surfaces Design |
| UX3 | Canonical benchmark set visibility. Somewhere in the UI an advisor should be able to see the full list of benchmarks Samriddhi compares against, and which fund or stock category maps to which. | Low | Risk-reward | Capability Surfaces Design |
| UX4 | Render risk-reward stats on the S2 Analysis tab: where the per-holding, per-sleeve, and per-portfolio records and the rollup live (own accordion row, a column on the holdings table, both, or otherwise). Decided against all five Capability Phase outputs together. | Medium | Risk-reward | Capability Surfaces Design |
| UX5 | Synthetic-forward disclosure visual treatment for t1..t8 outputs (banner, watermark, or per-row badge) so a regime-test number is never mistaken for a forecast in the UI. | Medium | Risk-reward | Capability Surfaces Design |
| UX6 | Rollup placement in the case-detail UI, and whether the LLM-fallback versus templated provenance is surfaced to the advisor. | Low | Risk-reward | Capability Surfaces Design |
| UX7 | Risk-reward in the briefing PDF. | Low | Risk-reward | PDF-builder workstream |
| UX8 | Risk-reward on the slide deck. | Low | Risk-reward | Slide-deck workstream |
| UX9 | Archived-cases UI surface (one active S2 case per investor, prior cases archived; slice 5 design), which affects how a risk-reward time series across snapshots would be browsed. | Low | Risk-reward (noted) | Slice 5 / Capability Surfaces Design |
| UX10 | `pms_aif_framework_notice` rendering treatment. Risk-reward stats records carry a structured `pms_aif_framework_notice` field with verbatim four-thesis framework text when PMS or AIF holdings are present. The rendering design (separate panel, inline disclaimer, expandable detail, footnote-style, or first-view toast) is deferred to the Capability Surfaces Design workstream. The notice should be unmissable without crowding the stats surface. | Low | Risk-reward (architectural audit) | Capability Surfaces Design |

## Maintenance

UX-series is render-layer debt deferred by capability workstreams under WA9. When a workstream defers a rendering decision, add a row (ID, description, severity, originating workstream, target fix workstream). The Capability Surfaces Design workstream is the periodic consumer; it does not own resolution. Confirm the next available UX number against the current log state before adding (numbering discipline, per the PRODUCT_DEBT_LOG convention).
