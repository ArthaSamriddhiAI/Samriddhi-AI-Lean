# Debt logs

Per-series debt logs for the Samriddhi AI build. The combined `PRODUCT_DEBT_LOG.md` has been restructured into one file per series (a redirect notice sits at the top of that file, with its original content preserved beneath for historical traceability). New entries land in the per-series files going forward.

## Series

| Series | File | Scope |
|--------|------|-------|
| T | `tech_debt_log.md` | Technical debt about the codebase or the engineering / audit-trail process itself. |
| P | `product_debt_log.md` | Product-stance questions ("what should Samriddhi do?"), routed to the Slice 7 product debt audit. |
| D | `data_debt_log.md` | Data-quality issues ("the data is wrong"), routed to fixture refresh. |
| X | `design_debt_log.md` | UI / UX design shortcuts taken for demo expediency. |
| DD | `production_data_debt_log.md` | Forward-looking production / enterprise data debt (data not wrong, not yet sourced for production). |
| O | `operational_debt_log.md` | Operational and forward-audit obligations, routed to the periodic Slice 7 audit. |
| UX | `ui_ux_debt_log.md` | Render-layer debt deferred by capability workstreams under WA09. |

DM-series (Data Mirror) debt lives in the private `Samriddhi-AI-Data-Snapshots` repository's debt log (entries DM1, DM2); this public repo only cross-references it (see the P-series snapshot-refresh entry). No local DM file exists by design.

## Entry convention

Each entry is a table row: `| ID | Description | Severity | Originating workstream | Target fix workstream |`. Severity is Critical / High / Medium / Low, read as production-readiness impact, not demo impact (most entries are acceptable for the demo and would block or degrade a production deployment). Long entries may carry a prose `**<ID> detail (…)**` block beneath the table. When a workstream resolves an entry, mark it resolved in place with the date and resolving workstream rather than deleting it, so the log doubles as a provenance trail.

## Numbering discipline

When adding an entry, confirm the next available number against the current state of the relevant per-series file rather than trusting a hard-coded number from a prompt or chat context (chat context does not always reflect current repo state; this is how the historical D6 renumbering was caught). The Slice 7 product debt audit is the periodic consumer of these logs; it does not own resolution.
