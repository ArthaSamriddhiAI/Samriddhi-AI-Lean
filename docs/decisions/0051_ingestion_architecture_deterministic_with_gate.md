# ADR-0051: Ingestion is deterministic-first into one canonical envelope, with the reconciliation gate as the spine

## Status

Accepted, 2026-06-10 (Package 07 build; encodes the primary's B3 ruling, option c). WA30 disposition: net-new. The interim parse-with-reconciliation-gate design recorded in ADR-0048's consequences is the provenance of the gate idea; this ADR is its canonical successor (ADR-0048 anticipated supersession by "a production onboarding pipeline").

## Context

Samriddhi must accept any file format an investor's data arrives in: registrar statements, four spreadsheet textures, columnar and free-form text dumps, email prose. The platform's register is deterministic and auditable (WA16); ingestion of real documents will eventually precede any model involvement, so the parse path must be honest about confidence and must never silently accept what it cannot ground.

## Decision

1. **One canonical envelope.** Every adapter emits `ParsedDocument` (`lib/ingestion/types.ts`): holdings and statement folios with per-field provenance (file plus page, line, or cell) and explicit confidence (`exact` for structured cells and reconciled tables, `heuristic` for prose extractions, which are advisor-confirm in the workbench, never auto-accepted).
2. **Deterministic adapters are the primary path.** eCAS PDFs parse via text-layer reconstruction (`lib/ingestion/ecas-pdf.ts`); spreadsheets via header detection with header-declared unit scaling; columnar, two-line, and email-prose text via conservative patterns (`lib/ingestion/table-adapters.ts`). What a deterministic adapter cannot ground lands in warnings, not in guesses.
3. **The reconciliation gate is non-negotiable.** Nothing parsed is stored until it reconciles (`lib/ingestion/reconcile.ts`): unit sums and printed ladders tie to closing balances; closing units times NAV tie to stated market values; fund labels resolve against the snapshot universe through the shared alias map (the same artifact the generator uses, carried in each corpus run manifest); the statement NAV must equal the snapshot series at the anchor month; totals tie to stated totals. Failures are findings with provenance for the workbench; the gate never auto-passes. This is the WA16 mechanism that caught D14, made permanent.
4. **LLM-assist is an edge-case fallback, sanitised-first, gated.** Documents the adapters cannot parse confidently route to a model-assisted extraction whose request builder accepts only `SanitisedText` (ADR-0050), whose output goes through the same gate, and whose executor refuses to run (build-but-do-not-live-test, WA12). The wiring point stays unimplemented until an approved budget exists (T24).

## Evidence at acceptance

Offline corpus verification (`scripts/_verify-ingestion.ts`): all 8 synthetic statements pass the full gate against the snapshot and the generated structured truth (26 to 56 checks each); all 13 listings tie row-for-row with pinned total-tie truth; the one hard-prose email yields zero confident rows plus the explicit route-to-fallback warning, which is the designed behaviour, not a failure.

## Amendment, 2026-06-10 (the Gate 2 ruling): the advisor_attested provenance kind

The primary's ruling on the Package 07 Gate 2 question adds a third provenance kind beside exact and heuristic_sourced: **advisor_attested**, for a prose-mentioned holding with no parseable amount whose value is entered by the advisor. Its contract, encoded in the workbench core (`lib/onboarding/build-record.ts`) and the canonical shape (`db/fixtures/canonical-holdings.ts`, the optional `attestation` field):

- The attestation captures who attested, when, and a REQUIRED one-line basis note; without the note there is no confirmation and the row keeps blocking the commit. The act of attesting is the row's confirmation.
- It is permanent: an attested value is never promoted to exact, renders amber in the row, and is marked attested-not-sourced in the commit provenance.
- It is excluded from the reconciliation gate's totals-tie arithmetic (a recollection must not make the books appear to tie), and the EXCLUSION IS VISIBLE, which is the point of the design, not a nicety: the totals tile carries a note naming the count and the rupee total excluded, and the commit summary and stored provenance repeat it. A green tie can never silently read as the whole portfolio.
- The attested holding itself joins the canonical record and the derived book at its attested value; honesty lives in the marking and the tie exclusion, not in dropping the investor's real wealth.

WA30 disposition: amends this ADR in place (the kind extends the envelope's confidence model this ADR defined; the behaviour was ruled by the primary at the Gate 2 stop and is verified by `scripts/_verify-onboarding.ts`).

## References

WA16 (no fabrication; the gate's mandate); WA12 (the fallback's gate); ADR-0048 (the interim design this supersedes in substance); ADR-0050 (the sanitised-input requirement); ADR-0052 (the store the gate feeds); D3 (the no-parsing debt this closes); the Package 07 audit (B3).
