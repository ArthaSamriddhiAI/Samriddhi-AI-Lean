# ADR 0024: E1/E2 case-mode scope-builder enrichment (Samriddhi 1)

## Context

The Samriddhi 1 case batch needs the live proposed_action pipeline to produce non-trivial E1 (per-stock fundamental) and E2 (industry / business-model) verdicts. The follow-up audit found the bottleneck was the scope-builders, not the skill files: `pipeline-case.ts` passed E1/E2 a one-sentence templated string (`"Look-through universe of <instrument> (<category>)."`) while the agents' rich skills (`agents/e1_listed_fundamental_equity.md`, `agents/e2_industry_business.md`) and free-text input types (`E1CaseScope`, `E2CaseScope`) could carry rich content, and the data already existed in the enriched snapshot (`nifty500.companies` per-stock fundamentals; `mf_funds` top-5 holdings / sectors and fund-level P/E, P/B, Beta).

No Plan v8 slice owned this scope-builder work. Slice 3 shipped the evidence agents with thin scope; the code comments referenced a "future Slice item" (`pipeline-case.ts`) and "commit 9" (`e1-case.ts`) that were never pinned to a named slice. The case batch was prerequisite-blocked on it, so the work is pulled forward into this workstream as a deliberate scope expansion (acknowledged at the planning-chat sync point; the branch deviation is ADR-0022).

## Decision

A new module `lib/agents/case/scope-builders.ts` exports `buildE1Scope(snapshot, proposal, holdings)` and `buildE2Scope(...)`, returning the free-text scope strings consumed by `runE1Case` / `runE2Case`. `pipeline-case.ts` calls them in place of the templated strings. No change to `E1CaseScope` / `E2CaseScope` types, the skill files, the `ActivatedVerdict` output schema, or router activation. The only loader change is a minimal type extension in `snapshot-loader.ts` (per-stock fundamental fields on `Nifty500Company`; `Top5Holding` / `Top5Sector` types and a string-or-array union plus P/E, P/B, Beta on `MutualFundRow`; `Snapshot.nifty500` typed as `Nifty500`).

The builders follow three disciplines:

1. **Data-only, source-labeled.** Every figure comes from the snapshot and carries a source label (`[source: nifty500 snapshot]`, `[source: mf_funds snapshot]`) so the agent cites with attribution. There is no model-knowledge fallback for fundamental figures.
2. **Honest about coverage.** A holding that does not join is named and marked uncovered (`not in nifty500 coverage`, `not in mf_funds coverage`), never silently dropped or partially guessed. A fund that joins but lacks top-5 detail degrades to `top-5 holdings/sectors not disclosed in snapshot` plus the fund-level metrics it does carry. Name matching is one-directional (the holding name must identify the candidate, by normalized exact / prefix / substring) so a generic label like `US listed equities (legacy holding)` cannot false-positive onto a company whose name appears inside it.
3. **Wrapper and non-equity targets carry the look-through limitation note** (see below).

## PMS / AIF look-through limitation

PMS and AIF underlying-stock look-through is out of MVP scope (foundation.md:198, PMS/AIF treated as structurally opaque wrappers; v8:705, deferred per foundation stance). The builders do not attempt it. For PMS holdings in the existing portfolio, and for any wrapper or non-equity proposal target (pms, aif, fixed_deposit, bond_listed, cash, gold, unlisted_equity, other), the scope states the limitation explicitly and directs E1/E2 to evaluate the existing listed-equity context and the proposal's marginal impact on it (concentration shift, complementarity, redundancy), not the target's underlying securities.

## Routing philosophy: action-centric (Samriddhi 1) vs holdings-centric (Samriddhi 2)

The two top-level routes in `router.ts` activate evidence agents on different criteria. `route()` (Samriddhi 2 diagnostic; router.ts:140) consults the investor's existing holdings to decide which evidence agents fire; this is the holdings-centric path. `routeProposedAction()` (Samriddhi 1; router.ts:195) is action-centric and explicitly does NOT consult holdings (see `void holdings` and the inline comment at router.ts:188-194); it fires evidence agents based on what is in the proposed action. This is architecturally correct: Samriddhi 1 evaluates a proposed action's instruments; re-diagnosing the existing portfolio is Samriddhi 2's job. (An earlier draft of this ADR, inherited from the workstream brief, wrongly described Samriddhi 1 as holdings-centric; the first live dry-run surfaced the correction.)

Because Samriddhi 1 is action-centric, E1 and E2 fire only for proposals whose action involves listed-equity look-through (PMS-target, equity-MF-target, direct-equity-target, or equity-source). In this batch, E1/E2 fire on Malhotra (PMS target with MF source) and Bhatt (PMS target with direct-equity source). They correctly do not fire on Iyengar (debt-MF target with FD source), Surana (debt-MF sleeve target with cash source), or Menon (AIF target with cash source), which lean on E3 (macro), E4 (behavioural), and E6 / E7 as appropriate. The scope-builder enrichment is pipeline infrastructure benefiting all future equity-proposal Samriddhi 1 cases; it is exercised on two of five cases in this batch.

When E1/E2 do fire on a proposal whose target is itself opaque (a PMS, as in Malhotra and Bhatt), the scope-builder applies the activation-mismatch pattern: an Existing-portfolio section (data-grounded where covered) plus a Proposal-target section carrying the look-through limitation note. The activation logic itself is unchanged; `mutual_fund_debt` was added to `involvesMutualFund` so E7 evaluates debt-MF targets (ADR-0025).

## Empirical coverage finding

The enriched snapshot covers 220 of 1,773 funds with top-5 holdings and 160 with top-5 sectors (foundation.md:196). The specific workhorse funds the seeded investors hold (Axis Large Cap, ICICI Prudential Balanced Advantage, Mirae Asset Large Cap, Parag Parikh Flexi Cap, SBI Small Cap, Franklin India Corporate Debt, and the proposed HDFC Balanced Advantage) carry no top-5 look-through. So for this batch, MF look-through resolves to fund-level metrics (P/E, P/B, Beta) plus an honest "not disclosed" note, while direct listed equity (Reliance, HDFC Bank, ITC via `nifty500`) resolves to full per-stock fundamentals and sector. The enrichment is a real improvement over the one-sentence baseline but does not manufacture look-through that is absent from the data. This is honest coverage, not a gap to close in this workstream.

## Alternatives Considered

- **Change `E1CaseScope` / `E2CaseScope` to structured types.** Rejected: free-text already carries rich content, the skill prompts consume prose, and a type change would ripple into the agents and the output schema for no benefit (workstream brief 1.2).
- **Model-knowledge fallback for fundamentals when a holding does not join.** Rejected: it violates the no-invention discipline and the hallucination-prevention requirement; an explicit "uncovered" note is the honest result.
- **Attempt PMS look-through from the snapshot `pms` block.** Rejected: that block is fact-sheet positioning, not underlying holdings; look-through is out of MVP scope (foundation.md:198).
- **Defer enrichment and run the batch on thin scope (audit option A).** Rejected by the ideation chat in favour of Shape B, because thin E1/E2 output would not be demo-seed quality.
- **Write a separate ADR for the look-through limitation.** Not warranted: the limitation is fully captured here and surfaced in the workstream audit doc and a product-debt entry, so a standalone ADR would duplicate. (ADR-0025 is instead used for the related G1 `mutual_fund_debt` fix this workstream pulled in.)

## Consequences

E1/E2 receive data-grounded, attributable scope on every live run, so the post-case sanity check can verify that cited figures trace to the snapshot. Files: `lib/agents/case/scope-builders.ts` (new), `lib/agents/pipeline-case.ts` (wiring plus updated comment), `lib/agents/snapshot-loader.ts` (types), `scripts/_verify-scope-builders.ts` (8 deterministic tests, no API). The PMS/AIF limitation and the workhorse-fund coverage reality are documented here and appear in the per-case actual-vs-expected notes in the workstream audit doc. Extending coverage (PMS look-through, more covered funds) is a future change gated on a foundation scope decision and is logged as product debt.
