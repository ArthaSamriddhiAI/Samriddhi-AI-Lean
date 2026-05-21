# ADR 0025: G1 `mutual_fund_debt` target category (debt-MF asset-class modeling)

## Context

The Samriddhi 1 case batch surfaced a G1 (mandate gate) modeling gap. G1's `TARGET_ASSET_CLASS` mapped the single `mutual_fund` target category to Equity, with a comment noting that debt-versus-equity MF nuance was "intentionally not surfaced" and left to the rationale string. Two cases in this batch are debt-MF deployments (Iyengar's corporate bond fund; Surana's debt sleeve). Tagged `mutual_fund`, they were mis-modeled as adding equity: Iyengar's first retune dry-run showed a phantom post-action equity jump to 50.1% versus her 45% ceiling, and Surana's "add debt to fix the zero-debt design" would have modeled as worsening his 89.9% equity concentration. That corrupts the case semantics (gate gaps, materiality, synthesis all cascade from the asset-class model).

## Decision

Add a new target category `mutual_fund_debt` and model it as Debt.

- `TargetCategory` (proposal.ts) gains `mutual_fund_debt` alongside the existing `mutual_fund`.
- `mutual_fund` stays mapped to Equity for backward compatibility (no existing fixture uses `mutual_fund`; the Sharma scaffolding case is a PMS proposal). `mutual_fund_debt` maps to Debt in G1's `TARGET_ASSET_CLASS`.
- `mutual_fund_debt` is treated as a mutual fund where MF behavior is correct: G2 returns `requires_clarification` for it (same MF scheme-rule path as `mutual_fund`; see P25), and `involvesMutualFund` includes it so E7 evaluates the proposed debt fund.
- `mutual_fund_debt` carries no listed-equity look-through, so `targetInvolvesListedEquityLookThrough` does not include it; E1/E2 do not fire on a `mutual_fund_debt` target (consistent with the action-centric routing documented in ADR-0024).
- Iyengar and Surana proposals use `mutual_fund_debt`. Surana's three-instrument sleeve uses the single tag (the Proposal schema carries one `target_category`) with the composition documented in the proposal text (ADR-0023).
- Deterministic test `scripts/_verify-g1-target-class.ts` confirms `mutual_fund` flags the equity ceiling and `mutual_fund_debt` does not.

## Why this was pulled into the case-batch workstream

Without it, the batch's debt cases are mis-modeled and the case fixtures carry incoherent gate semantics (phantom equity breaches). The fix is small and self-contained (one enum value, one mapping entry, one G2 case, one helper line, two proposal tags, one test), so it lands here rather than blocking the batch on a separate workstream. The interim shape is deliberate: only `mutual_fund_debt` is added now. Full `target_category` coverage for other product types (hybrid MF variants, international ETFs, REITs, InvITs, gold MFs, SGBs, NCDs, gilts, commodity ETFs) is deferred to P26, to be extended incrementally as new proposal shapes surface.

## Why G2 MF scheme-rule curation was NOT pulled in

G2 returns `requires_clarification` for every mutual-fund target because SEBI MF scheme-level rules are not in the curated store (only PMS/AIF minimum-ticket rules are). Curating MF scheme rules (scheme eligibility, expense-ratio caps, exit-load tiers, category constraints) and wiring G2 to consume them is genuinely larger scope that deserves its own workstream with its own product thesis. It is deferred per P25, which carries the unblocking-fix definition and the mandatory re-fire protocol for the affected case fixtures (Iyengar, Surana, and any future MF-target cases) once the curation lands. Pulling it in here would balloon the case batch.

## Alternatives Considered

- **Leave `mutual_fund` mapped to Equity and accept the mis-model.** Rejected: it corrupts the debt cases' semantics, the opposite of what the batch needs.
- **Re-tag the debt proposals as `bond_listed` (already Debt-mapped).** Rejected: `bond_listed` means listed bonds, not a bond fund or sleeve, and it would route G2 away from the MF clarify path and E7 away from MF evaluation. `mutual_fund_debt` keeps the MF behaviors while fixing the asset class.
- **Surface debt-versus-equity MF via a sub-category instead of a new target category.** Rejected for now: the Proposal form and router branch on `target_category`; a new category is the smallest change that propagates correctly through G1, G2, and the router.

## Consequences

Debt-MF proposals are modeled as Debt in G1, so the case semantics are coherent (no phantom equity). G2 still clarifies for them (P25) and E7 still evaluates them. The enum is now incomplete-but-correct for the categories in use; P26 tracks incremental extension. P25 tracks the G2 MF curation dependency and the re-fire obligation. Files touched: `lib/agents/proposal.ts` (enum + `involvesMutualFund`), `lib/agents/case/governance/g1-mandate.ts` (mapping), `lib/agents/case/governance/g2-sebi.ts` (clarify case), `scripts/generate-s1-batch.ts` (Iyengar, Surana tags), `scripts/_verify-g1-target-class.ts` (test).
