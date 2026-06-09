# ADR-0049: Three-tier investor-data storage

## Status

Accepted, 2026-06-10 (Package 07 build; the primary's ruling on the Package 07 audit's B1 proposal, stricter than the proposal). WA30 disposition: net-new.

## Context

Package 07 owns investor onboarding, which forces the question of where investor data lives. The audit proposed two tiers (fictional corpora as private-repo release assets; real data never on GitHub). The primary ruled three tiers and drew the private line harder: personally identifiable information must never be on GitHub at all, not even as a private-repo release asset.

## Decision

1. **Tier 1, synthetic and fictional investors: the public codebase repository.** The demo five and the A6 to A14 synthetic cohort, including their generated ingestion corpus (statements, listings, notes, holdings rows), live as public fixtures (`fixtures/ingestion-corpus/`, `db/fixtures/`). This is WA14's origin-based rule applied: invented content is public.
2. **Tier 2, real or non-synthetic client data: local-only, in no repository.** When real client data first arrives, it is stored only on the operator's machine (the canonical transaction-bearing store and the PII vault, both local), never committed anywhere, public or private. P30's preconditions govern before any real client is onboarded at all.
3. **Tier 3, the end-state: a separate secure data service.** The ideal home for real client data is a dedicated secure server or database that Samriddhi queries. This is logged as data debt (D16) with local-only as the stated interim; it is not built in the lean MVP.

The market-data flow is unchanged: real-world-sourced market data stays in the private data repo per ADR-0027 (as amended 2026-06-10).

## Consequences

- The onboarding build and its tests run entirely on tier 1 with zero PII risk; the commit step of the onboarding flow names the tier explicitly (the B4 wireframe draws this).
- Tier 2 has no sync, no backup, and no multi-machine story by design; that is exactly the gap D16 records for tier 3 to close.
- Nothing in this decision moves the five demo investors; they remain frozen public fixtures (ADR-0052's invariant).

## References

WA14 (origin-based privacy boundary); P30 (real-client preconditions, the hard gate for tier 2); ADR-0027 and its 2026-06-10 amendment (market-data flow, the symlink incident); data repo ADR-0003; D16 (the tier 3 debt); the Package 07 audit (`docs/audits/2026-06-10_package_07_onboarding_data_audit.md`, B1).
