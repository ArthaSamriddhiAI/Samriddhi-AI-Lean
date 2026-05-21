# ADR 0022: Samriddhi 1 case batch runs on a feature branch, not on main

## Context

Plan v8 classifies the Case Generation Phase as running "on `main` directly" (v8:328, v8:334), and the Samriddhi 1 case batch is a Case Generation workstream. The first audit flagged this against the standard repo flow (feature branch, push, PR, reviewer squash-merge), and the product owner decided to deviate.

## Decision

The Samriddhi 1 case batch runs on the feature branch `s1-case-generation` (created during the audit at base commit `640644fac36930332e6f0eb7b2a79a043acd6ab8`), not on `main` directly. Commits push to the remote branch as they land (WA10); the workstream pauses before opening the PR, and the reviewer squash-merges via `gh` after approval (WA1).

## Alternatives Considered

- **Land on `main` directly per Plan v8.** Rejected by the product owner: a feature branch gives a discrete PR boundary for planning-chat review, supports the GitHub push needed for demo-seed inclusion, and preserves WA1 (no self-merge). The deviation became more clearly correct once Phase 1 (scope-builder enrichment) expanded the workstream beyond a pure single-shot fixture generation (ADR-0024), which is closer to Capability Phase shape and benefits from PR review.
- **Squash-merge from CC.** Rejected: WA1 holds (no self-merge); the reviewer merges.

## Consequences

The workstream is reviewable as a single PR. Plan v8's "Case Generation lands on main" guidance is overridden for this workstream only; future Case Generation workstreams inherit the v8 default unless similarly re-decided. This deviation is the reason the branch exists; it is recorded so a future reader does not mistake it for an accident.
