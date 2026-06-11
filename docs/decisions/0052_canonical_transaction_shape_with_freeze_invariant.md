# ADR-0052: The canonical investor shape is transaction-bearing; the demo five are frozen by a byte-identity invariant

## Status

Accepted, 2026-06-10 (Package 07 build; encodes the primary's B5 ruling, option b with the invariant asserted in a test). WA30 disposition: net-new.

## Context

The demo-surface holding shape (`db/fixtures/structured-holdings.ts`: instrument, asset class, sub-category, value, weight) carries no units, cost basis, dates, or identifiers, which is why the section 06 performance line was undrawable and why P51 existed. New investors arrive with full transaction histories; the five demo investors are a frozen public surface that must not drift.

## Decision

1. **The canonical store is transaction-bearing.** `db/fixtures/investor-transactions.ts` (generated deterministically from the ingestion corpus by `scripts/generate-investor-transactions.ts`) carries, per holding: the frozen demo label plus the corpus provenance label, quantity, cost basis, purchase date, contractual vehicle attributes (FD rates and maturities, bond yields), and, for statement folios, the full dated transaction history priced on the real `monthly_nav` series with the anchor-month closing tie.
2. **The demo surface is a derivation, frozen by byte-identity.** `deriveStructuredHoldings` (`db/fixtures/canonical-holdings.ts`) reproduces the hand-authored `StructuredHoldings` records exactly; JSON-stringify equality for all five investors is asserted by the fixture builder (which refuses to emit otherwise) and by `scripts/_verify-holdings-identity.ts`. The freeze is therefore a checked property, not a convention: the canonical layer can evolve beneath the five without any drift in what the demo renders or what the agents read.
3. **Migration is optional backfill, never a re-fire.** The five demo investors' canonical records were backfilled from the regenerated corpus in this build with zero change to their demo surface and zero case re-generation. Sharma has no canonical record (no corpus rows) and keeps its hand-authored fixture only, recorded in the verify script as the exempt case.
4. **New investors land canonical-first.** Onboarding (ADR-0051's pipeline, the B4 workbench when built) writes the canonical record; the demo-shape view is always derived.

## Consequences

- P51 closes: cost basis and dates now live at the holdings layer; the section 06 series capability reads them (the per-holding accrual and cost paths).
- The agents are untouched: they continue to read the derived shape; nothing in the pipeline changed because this layer exists.
- The row-level cost-basis fields for statement folios are superseded by the transaction sums where histories exist (both are carried; the transactions are the truth).

## References

WA09 (capability ships data); ADR-0051 (what writes this store); ADR-0042 and data repo ADR-0002 as amended (the real NAV basis the histories are priced on); P51 and D3 (the debts this closes); the Package 07 audit (B5, A1.6).
