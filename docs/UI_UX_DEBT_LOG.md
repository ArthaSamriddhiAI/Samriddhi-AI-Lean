# UI/UX debt log

Render-layer debt deferred to the Capability Surfaces Design workstream and beyond. Capability workstreams ship data only (WA9); this log captures the rendering decisions they defer. Companion to `docs/PRODUCT_DEBT_LOG.md` (tech / product / data / production-data / operational debt).

## UX-series

| ID | Description | Severity | Originating workstream | Target fix workstream |
|----|-------------|----------|------------------------|------------------------|
| UX1 | Per-stat benchmark disclosure. Every benchmark-relative number (beta, R-squared, tracking error, information ratio) must show which `index_id` it was computed against. Tooltip, footnote, or inline disclosure pattern; design call. | Medium | Risk-reward | Capability Surfaces Design |
| UX2 | Sentinel display register. How `benchmark_structurally_inapplicable`, `benchmark_not_in_snapshot`, `pms_disclosure_limited`, `opaque_wrapper`, `not_applicable_for_risk_reward`, `insufficient_history`, `currency_conversion_pending` visually present in the case detail UI (greyed cells, explicit text, tooltips). Design call. | Medium | Risk-reward | Capability Surfaces Design |
| UX3 | Canonical benchmark set visibility. Somewhere in the UI an advisor should be able to see the full list of benchmarks Samriddhi compares against, and which fund or stock category maps to which. | Low | Risk-reward | Capability Surfaces Design |

## Maintenance

UX-series is render-layer debt deferred by capability workstreams under WA9. When a workstream defers a rendering decision, add a row (ID, description, severity, originating workstream, target fix workstream). The Capability Surfaces Design workstream is the periodic consumer; it does not own resolution. Confirm the next available UX number against the current log state before adding (numbering discipline, per the PRODUCT_DEBT_LOG convention).
