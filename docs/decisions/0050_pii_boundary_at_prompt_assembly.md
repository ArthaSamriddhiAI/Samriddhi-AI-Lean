# ADR-0050: The PII boundary sits at prompt assembly, minimise-first with deterministic tokenisation

## Status

Accepted, 2026-06-10 (Package 07 build; encodes the primary's B2 ruling, which adopted the audit's proposal). WA30 disposition: net-new.

## Context

When real investor data is eventually sent to a model for reasoning, identity must never leave the machine. The mechanism had to be deterministic, locally testable with zero spend, and structurally unable to be bypassed by a future call site.

## Decision

1. **Minimise first.** Structured agent context carries no identity at all: `minimiseInvestorContext` (`lib/privacy/sanitiser.ts`) strips identity keys and substitutes a pseudonymous reference. For structured context there is nothing to tokenise because nothing identity-bearing is present.
2. **One choke point for free text.** `sanitiseForPrompt` is the single function every model-facing string passes through: known identities (names and word variants, emails, mobiles, PANs, folios, addresses) tokenise against a local-only vault; pattern residue (PAN format, Indian mobiles, emails, Aadhaar-like runs, folio phrases) is stripped; a residual scan reports anything surviving.
3. **The ordering is a compile-time property.** Model-facing surfaces accept only the `SanitisedText` brand (`lib/privacy/sanitised.ts`), mintable only by the sanitiser; the B3 ingestion fallback is the first such surface. Unsanitised text cannot reach a model path and still typecheck.
4. **The vault is local-only.** Token-to-value mappings live on the operator's machine (tier 2 of ADR-0049); detokenisation exists for local render surfaces only. No model call exists anywhere in the sanitisation path.
5. **Build, do not live-test.** Validation is offline, on the synthetic corpus (`scripts/_verify-pii-sanitiser.ts`: zero residue across all corpus documents, substance survives, determinism, entity stability, round-trip, idempotence). Live-prompt validation is deliberately deferred, recorded as WA12-gated debt (T24).

## Known limits, recorded honestly

Free-prose locations and relationships (a city, a relative abroad) are not pattern-detectable and are stripped only when supplied as known identities; the known-identity list for real clients is assembled at onboarding (the intake captures document identity strings for exactly this). This limit is restated in T24.

## References

WA12 (the spend gate the deferral honours); WA07's `stripLongDashes` (the deterministic-sanitiser precedent); ADR-0049 (where the vault lives); P30 (the real-client gate this layer is one precondition of); the Package 07 audit (B2).
