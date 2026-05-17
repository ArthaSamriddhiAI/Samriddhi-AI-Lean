# Product debt log

A living catalogue of debt taken on for demo expediency, organised into four categories: Tech, Product, Data, Design. Each entry is a brief description, a severity (Critical / High / Medium / Low), the workstream that originated or surfaced it, and the workstream expected to resolve it.

**This document catalogues; it does not resolve.** Entries are added as workstreams discover debt. Resolution happens in the workstream that owns the relevant area, not here. The Slice 7 product debt audit consumes this document, triages and sequences the entries against current `main`, and produces a production-readiness punch list (including a RAG roadmap entry per the Tech-section RAG scoping note). Initial entries are the load-bearing ones already known as of the post-M0.IndianContext housekeeping (2026-05-17); the list is not exhaustive by design.

Severity is read as production-readiness impact, not demo impact: most entries are acceptable for the demo and would block or degrade a production deployment.

## Section 1: Tech debt

Things in the codebase that work but are not production-grade.

| ID | Description | Severity | Originating workstream | Target fix workstream |
|----|-------------|----------|------------------------|------------------------|
| T1 | `STUB_MODE` default flipped to `false` post-M0 (live mode is the working default now that tier-2 access and budget exist). The runtime toggle (Settings: inherit env / force on / force off) is preserved for offline demos. Open question: whether `STUB_MODE` should become a deploy-time feature flag or stay env-driven. | Low | Post-M0 housekeeping (2026-05-17) | Slice 9 deployment (deploy-time flag decision); reviewed in the Slice 7 audit |
| T2 | Pre-M0 hardcoded MVP SEBI regulatory rules table in G2. Resolved 2026-05-17: G2 now grounds its minimum-ticket reference data in `sebi_boundaries` via M0.IndianContext (verdicts unchanged, now sebi_001-cited). Retained here for provenance. | Medium (resolved) | Slice 3 (MVP rules table) | M0.IndianContext integration (done, PR #1) |
| T3 | No test harnesses outside M0.IndianContext. M0 ships verify scripts (`scripts/_verify-indian-context.ts`, `_verify-governance-regrounding.ts`, `_verify-stub-replay-sharma.ts`); the pipeline, governance gates, IC1 orchestrator, and PDF renderers have none. | Medium | M0.IndianContext (surfaced the gap by contrast) | Slice 7 polish; per-module verify scripts as each area is next touched |
| T4 | Single-tenant assumption throughout the codebase. No firm-scoping on cases, investors, or settings; multi-firm tenancy is post-MVP. | Medium | Slice 1 scaffolding | Post-MVP tenancy workstream |
| T5 | No automated CI. Typecheck and verify scripts run manually; nothing gates a commit or a merge. | Medium | Slice 1 scaffolding | Slice 7 polish or a dedicated CI workstream |
| T6 | `.env` / `.env.local` carry configuration (API keys, runtime toggles) that should eventually move to a config management layer (Doppler, Vault, or similar) rather than living in dotfiles. | Medium | Slice 1 scaffolding | Slice 9 deployment |
| T7 | RAG scoping. RAG was evaluated for M0.IndianContext and rejected (deterministic discipline over a curated YAML store is the right shape for an auditability-first platform). RAG is still worth scoping for other use cases; see the prose note below. | Low | M0.IndianContext (evaluation) | Slice 7 audit produces a RAG roadmap entry |

**RAG scoping note (T7).** RAG implementation was assessed for M0.IndianContext and deliberately rejected: the platform's USP is deterministic, auditable, citation-grounded reasoning, and a curated YAML knowledge store with explicit citations serves that better than retrieval over an opaque index. RAG remains worth scoping for use cases where the corpus is large and the auditability bar is different:

- **Slice 6 read-only Q&A chat:** single-case scope. Low RAG benefit; the frozen case content is small and already structured, so direct context is sufficient.
- **Cross-case search:** high RAG benefit. Querying across many cases is a genuine retrieval problem.
- **Historical case archive search at firm scale:** highest RAG benefit. Large, growing corpus where retrieval quality dominates.

The Slice 7 product debt audit should turn this into an explicit RAG roadmap entry (which use cases, in what order, with what guardrails to preserve the auditability posture).

## Section 2: Product debt

Capabilities the product says it does, or could do, but defers for scope.

| ID | Description | Severity | Originating workstream | Target fix workstream |
|----|-------------|----------|------------------------|------------------------|
| P1 | NRI / RNOR / HUF investor case shapes deferred. The structural exotica (residency transitions, HUF eligibility, cross-border conversion) are out of scope for the current case set. | Medium | M0.IndianContext (the YAML stores carry the framing; cases do not exercise it) | Post-MVP investor-shape workstream |
| P2 | Full Cat III long-short AIF logic deferred; current handling is simplified. | Medium | Slice 3 evidence agents | Post-MVP capability build |
| P3 | Pairwise overlap analysis with judgment-grade recommendations. Lands via the Slice 4.6c capability build; post-MVP polish still needed beyond the initial build. | Medium | Slice 4.6c (planned) | Slice 4.6c, then post-MVP polish |
| P4 | Maintain / Monitor / Discuss / Review classification. Lands via Slice 4.6a; coverage across all holding types needs validation after the initial build. | Medium | Slice 4.6a (planned) | Slice 4.6a, then a coverage-validation pass |
| P5 | House view content sourcing. Lands via Slice 4.6e; real market-data feed integration is deferred (content is curated, not live). | Medium | Slice 4.6e (planned) | Slice 4.6e, then a market-data integration workstream |
| P6 | Investor onboarding workflow. Designed in the Slice 4.7 wireframes; build deferred to post-Slice-5. | Medium | Slice 4.7 design | Post-Slice-5 build |
| P7 | Cross-case search. Slice 6 read-only chat handles single-case Q&A only; cross-case search is deferred (see RAG note T7). | Low | Slice 6 scope | Post-MVP search workstream |

## Section 3: Data debt

Fixture and reference-data quality issues.

| ID | Description | Severity | Originating workstream | Target fix workstream |
|----|-------------|----------|------------------------|------------------------|
| D1 | 8 of 107 curated YAML entries are marked `confidence: indicative` (e.g., pmlt_001, dem_012). A future audit should upgrade these to authoritative where a citable source exists. | Medium | M0.IndianContext (Workstream C curation) | Workstream C follow-up or the Slice 7 audit |
| D2 | Synthetic investor profiles (A1-A5, A6-A14) stand in for real onboarded clients. Adequate for the demo; production credibility wants real or realistic onboarded data. | Medium | Slice 1 fixtures | Post-MVP, gated on real client onboarding |
| D3 | No eCAS parsing pipeline. Investor holdings fixtures are created manually; there is no ingestion path from a real eCAS statement. | Medium | Slice 1 fixtures | Post-MVP ingestion workstream |
| D4 | No `regulatory_changelog` automation. Regulatory updates require manual YAML edits; nothing watches sources or proposes diffs. | Low | M0.IndianContext (Workstream C) | Post-MVP, low priority until the store changes often |
| D5 | Sharma's IC1 stubs were re-recorded post-M0 (grounded in IndianContext); stubs for other cases predate M0. If `STUB_MODE` is ever used as the primary mode again, the non-Sharma stubs should be re-recorded so replay matches the post-M0 reasoning. | Low | M0.IndianContext (re-recorded Sharma only) | The workstream that next needs STUB_MODE as primary |

## Section 4: Design debt

UI and UX shortcuts taken for demo expediency.

| ID | Description | Severity | Originating workstream | Target fix workstream |
|----|-------------|----------|------------------------|------------------------|
| X1 | Case list is a flat sortable view. Production would want filters, segments, and saved searches. | Low | Slice 1 scaffolding | Slice 7 polish (filter pills already scoped there) |
| X2 | Settings is a single page. Production would organise it into Account / Firm Configuration / Demo Data / Diagnostic Tools categories. | Low | Slice 1 scaffolding | Slice 7 polish |
| X3 | No primary-vs-archive case distinction. All cases sit in one undifferentiated list. | Low | Slice 1 scaffolding | Slice 5 or Slice 7 (design the distinction) |
| X4 | No mobile-responsive treatment; the current design is desktop-only. | Medium | Slice 1 design system | Slice 7 polish or a dedicated responsive pass |
| X5 | No keyboard-navigation audit; accessibility (focus rings, ARIA, keyboard nav) is deferred. | Medium | Slice 1 design system | Slice 7 accessibility audit |
| X6 | Investor profile pages are dense. Likely worth reorganising after real-user feedback rather than speculatively. | Low | Slice 1 design system | Post-real-user-feedback |

## Maintenance

When a workstream discovers debt, add a row to the relevant section following the same format (ID, description, severity, originating workstream, target fix workstream). When a workstream resolves an entry, mark it resolved in place with the date and the resolving workstream (as T2 shows) rather than deleting it, so the log doubles as a provenance trail. The Slice 7 product debt audit is the periodic consumer; it does not own resolution.
