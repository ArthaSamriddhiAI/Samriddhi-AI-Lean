# ADR 0048: The render bundle is a capability-plus-render workstream; the section 06 performance line is deferred to the data-management workstream

## Status

Accepted, 2026-06-09. Built on `features/render-bundle-sweep`. The re-scope and the
section 06 deferral were both surfaced and ratified at gates (WA28 stop-and-propose,
WA30 disposition). The section 06 data audit is
`docs/audits/2026-06-09_section06_performance_line_data.md` (with the
reconciliation-outcome addendum).

## Context

The render bundle began as a render-only pass (T-5.08 Analyst Reports port, T-5.09
capability-surface render, T-5.11 fixture sweep). Two scope expansions were
surfaced and ratified:

1. The v7.2 composed-page rebuild (ADR-0047), once the layout-gap audit showed the
   wireframe was a composed page, not the accordion that was first built.
2. An attempt to build section 06 (portfolio performance) as a new capability. The
   wireframe's centerpiece performance chart is a continuous gross (market value)
   versus net (invested cost) line over time, a data series none of the shipped
   capabilities produced. The section 06 data audit found the eCAS statements carry
   the full mutual-fund transaction history and `holdings_a1_a5.json` carries
   per-holding cost basis, so the capability was designed with a strict
   reconciliation gate (per folio, parsed units times the t0 snapshot NAV must tie
   to the eCAS and holdings values; parsed cost must tie to the eCAS cost) and a 70%
   coverage honesty floor (draw the line only when covered_weight_pct is 70 or
   more).

## Decision

The render bundle is a capability-plus-render workstream (WA09), not render-only:
it ships the composed render fidelity and it attempted the section 06 capability.

The reconciliation gate fired. The eCAS NAV-and-unit basis and the snapshot
`monthly_nav` are inconsistent universes: per folio the snapshot t0 NAV is 9 to 35%
off the eCAS closing NAV, and the eCAS units valued at the snapshot NAV do not
reconcile to the canonical holding value (Surana's Mirae folio values at Rs 4.00 Cr
against the snapshot NAV versus the canonical Rs 3.00 Cr). The eCAS-alone
construction is internally reconciled but mutual-fund-only (46 to 52% coverage),
below the 70% floor; adding the snapshot for the listed equity to reach 70% fails
reconciliation. Per WA16, no line is drawn from data that does not reconcile.

Section 06 ships the window bars (the persisted `trailing_returns`, scale-independent
NAV ratios that reconcile fine). The continuous line is deferred to the
data-management workstream, tracked as product debt P50 and data debt D14, with the
precise root cause (`generate_ecas.py`'s `simulate_history` synthesizes NAVs from an
assumed CAGR, not the snapshot `monthly_nav`) and fix (re-anchor to the snapshot
series, resolve the fund-name mismatches, regenerate the eCAS set).

## Consequences

- The workstream is recorded as capability-plus-render, not render-only; the
  re-scope is no longer silent.
- The interim transaction-data shape and ingestion method (parse the eCAS with the
  reconciliation gate) was designed but not implemented, because the gate fired
  before any series was emitted. The design is captured in the section 06 audit and
  P50; a production onboarding pipeline may supersede the interim parse approach
  when it lands.
- The reconciliation gate is the WA16 enforcement that prevented a plausible but
  fabricated performance line. "Fail loudly, never emit a partial or unreconciled
  series" held: the build stopped at the gate and shipped the honest bars.
- The eCAS, the holdings file, and the snapshots stay external read-only input;
  nothing from them is committed.

## References

WA28 (stop-and-propose), WA30 (this disposition), WA09 (capability ships data,
design ships render), WA16 (real values, no fabrication), WA05 (log debt, do not
expand scope), ADR-0047 (the v7.2 composed page), the section 06 data audit
(`docs/audits/2026-06-09_section06_performance_line_data.md`), product debt P50,
data debt D14.
