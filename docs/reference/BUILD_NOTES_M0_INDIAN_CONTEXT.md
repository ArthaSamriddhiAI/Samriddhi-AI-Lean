# Build Notes: M0.IndianContext Integration

**Workstream:** Slice 3 commit 3, deferred per DEFERRED.md item 6, resolved here.
**Branch:** `features/m0-indian-context`
**Date:** 2026-05-17
**Trigger:** Workstream C (six curated YAML knowledge stores) closed 2026-05-17.

This document covers the five pieces of work: what was wired, the E1-E7
skill consumption finding, governance comparison results per case, S1
re-run scope, and the Sharma IC1 changes.

No em dashes, en dashes, or long dashes are used in this document or in
the code and commits, per the standing project convention.

---

## Piece 1: Wiring M0.IndianContext into the pipeline

### Curated stores placed

The six final-package YAML stores from Workstream C landed at the
canonical path `agents/m0_indian_context/data/` alongside the curation
README and BUILD_NOTES:

| Store | Version | Entries |
|---|---|---|
| tax_matrix.yaml | v1.1 | 36 |
| sebi_boundaries.yaml | v1.2 | 25 |
| structure_matrix.yaml | v1.0 | 11 |
| demat_mechanics.yaml | v1.0 | 15 |
| gift_city_routing.yaml | v1.0 | 8 |
| regulatory_changelog.yaml | v1.0 | 12 |

107 entries total, matching the Workstream C BUILD_NOTES inventory and
the per-store version pins in README section 9.

### Deterministic agent

`lib/agents/m0-indian-context.ts` is a new rule-based agent (no LLM call,
consistent with the deterministic-vs-LLM honesty discipline). It:

- Parses the six stores with `js-yaml` (added as a runtime dependency;
  the existing hand-written frontmatter parser in `skill-loader.ts` is
  deliberately minimal and not suitable for the nested store schema, so a
  focused YAML parser was the correct call). Stores are cached after
  first load.
- `buildIndianContext()` assembles the bulk bundle: resolves the
  investor structure onto the canonical structure_type / residency axes,
  applies the `legacy_term_aliases` table for cross-store lookups, filters
  each store by its own keying axis (tax_matrix and sebi_boundaries by
  product plus investor_type; structure_matrix by structure; demat_
  mechanics by asset_class; gift_city_routing by product plus residency),
  surfaces `confidence: indicative` entries with an explicit flag rather
  than presenting them as authoritative, and consults regulatory_changelog
  for events effective on or before the case decision date via the
  `rule_pointer.affected_entries` inverse-reference pattern.
- `getSebiTicketRule()` is the inline surface G2 consumes.

The output schema (`IndianContextSummary`) supersedes the Slice 3
placeholder. It carries the human-readable framing strings the
evidence and IC1 prompts already render, plus structured audit-grade
fields: `sebi_minimums`, `citations` (every entry the bundle drew on
with its source entry_id and citation_source_type), `indicative_flags`,
`applicable_regulatory_changes`, `store_versions`, and
`edge_cases_flagged`. The curated type lives with the agent and is
re-exported from `case-context.ts` so existing imports keep resolving.

### Activation order

In `lib/agents/pipeline-case.ts`, `ctx.indianContext` is populated by
`buildIndianContext()` immediately after `routeProposedAction` routes
the case and before any evidence agent or governance gate runs, exactly
per the integration contract. The bundle persists on case content as
`indian_context` (the content shape is an opaque JSON blob on
`Case.contentJson`; no Prisma column change is needed, the seed
re-stringifies the content object verbatim).

### Dry-run verification

`scripts/_verify-indian-context.ts` (deterministic, zero API spend)
confirms against the canonical Sharma input: all six stores parse
(36, 25, 11, 15, 8, 12 entries); the bundle is structured per the skill
contract; the investor structure resolves to individual / resident with
the `resident_individual` alias applied; 14 entries match the PMS
proposal (2 indicative: pmlt_001 PMS pass-through and dem_012 PMS exit
window, both correctly flagged); four regulatory_changelog events are
in scope; G2 verdict is stable (PASS) carrying the sebi_001 citation;
and `formatCaseContextHeader` renders the block so downstream agents
receive it. Typecheck is clean.

---

## Piece 2: E1-E7 skill consumption finding

**Finding: E1-E7 do NOT consume the M0.IndianContext bundle as a
structured input. No halt condition triggered.**

Inspection of each evidence-agent skill file in `agents/`:

| Skill | M0.IndianContext references | Consumes the bundle? |
|---|---|---|
| e1_listed_fundamental_equity | 2 incidental: a "(Indian context: pledged promoter shares ...)" descriptive parenthetical in the risk-signals family, and Edge case 4 "Indian-context-specific risk concentrations" as an escalation risk category | No |
| e2_industry_business | none | No |
| e3_macro_policy_news | none | No |
| e4_behavioural_historical | none | No |
| e5_unlisted_equity | 1 incidental: Edge case 4 "coordinate with M0.IndianContext for cross-border pass-through" as an escalation note | No |
| e6_pms_aif_sif | none | No |
| e7_mutual_fund | none | No |

The E1 and E5 mentions are advisory escalation notes inside edge-case
sections; neither reads the bundle's fields as a structured input. The
actual structured consumers are S1.case_mode (skill line 23 input list,
line 91 worked example) and the IC1 sub-agents (Chair and Devil's
Advocate reference the bundle in their skills; Risk Assessor and
Counterfactual Engine consume it via their runner prompts).

Mechanically, the shared case-mode runner (`lib/agents/case/runner.ts`)
injects `formatCaseContextHeader`, which now carries the populated
IndianContext block, into every E1-E7 case-mode user prompt. This does
not change the finding: the E1-E7 skill system prompts do not direct the
model to reason over IndianContext, so the block is ambient context, not
a consumed input. Furthermore, no E1-E7 re-run is warranted because the
only Samriddhi 1 fixture (sharma-01) replays frozen E1-E7 stubs, and the
six Samriddhi 2 fixtures use the diagnostic pipeline, which does not use
the case-mode agents or IndianContext at all.

Per the integration contract decision rule, since E1-E7 do not consume
IndianContext: E1-E7 re-runs are skipped; governance gates are
re-evaluated deterministically (Piece 3); S1 is re-run only if a
governance verdict shifts (Piece 4); Sharma IC1 is re-run (Piece 5).

---

## Piece 3: Governance comparison

**Finding: all governance verdicts are stable across every fixture. The
curated sebi_boundaries store and the prior hardcoded MVP table agree on
the major regulatory facts.**

### Scope reconciliation

The integration contract describes "the 6 case fixtures, re-run G1/G2/G3."
The codebase reality: governance gates G1/G2/G3 exist only in the
Samriddhi 1 pipeline (`pipeline-case.ts`). Of the seven case fixtures on
disk, exactly one is Samriddhi 1 (`c-2026-05-14-sharma-01`); the other
six (bhatt, sharma-s2, surana, iyengar, malhotra, menon) are Samriddhi 2
diagnostic cases whose content carries no `gate_results`. So the
governance re-grounding has exactly one case to re-evaluate; the six
diagnostic cases have no governance state to compare. This is the honest
mapping of the contract onto the codebase, not a deviation from intent.

### Which gate's reference data actually changed

| Gate | Reference data | Effect of YAML grounding |
|---|---|---|
| G1 mandate | investor mandate bands, holdings | None. G1 does not consult regulatory reference data; logic unchanged. |
| G2 SEBI | SEBI minimum-ticket table | Source of truth moved from a hardcoded MVP table to sebi_boundaries via M0.IndianContext. The curated minima (sebi_001 PMS Rs 50 lakh, sebi_009 AIF Rs 1 crore) are byte-identical to the prior MVP values, so the verdict is unchanged; the citation is now the audit-grade YAML citation and the rule_trace records the source entry_id. |
| G3 permission | firm permission policy | None. Single-advisor MVP; always passes. |

### Per-case comparison (deterministic, zero API spend)

Verified by `scripts/_verify-governance-regrounding.ts`:

| Case | Workflow | G1 | G2 | G3 | Verdict shift |
|---|---|---|---|---|---|
| c-2026-05-14-sharma-01 | s1 | requires_clarification -> requires_clarification | pass -> pass | pass -> pass | none |
| c-2026-05-14-bhatt-01 | s2 | no gates | no gates | no gates | n/a |
| c-2026-05-15-sharma-s2-01 | s2 | no gates | no gates | no gates | n/a |
| c-2026-05-15-surana-01 | s2 | no gates | no gates | no gates | n/a |
| c-2026-05-15-iyengar-01 | s2 | no gates | no gates | no gates | n/a |
| c-2026-05-15-malhotra-01 | s2 | no gates | no gates | no gates | n/a |
| c-2026-05-15-menon-01 | s2 | no gates | no gates | no gates | n/a |

Sharma G2 was already PASS (PMS ticket Rs 3 Cr, well above the Rs 50 lakh
minimum). Post-grounding it is still PASS with rationale wording
unchanged (the YAML minimum is identical to the MVP value), now carrying
the sebi_001 citation and `reference_data_source: m0_indian_context` in
the rule_trace. No previously-passing gate now fails or vice versa. The
"governance verdict stability" watch item holds: the MVP table and the
curated YAMLs agree, so neither has an error to flag.

## Piece 4: S1 re-run scope

**Skipped, correctly.** No case had a governance verdict shift in Piece 3,
so per the integration contract S1 synthesis is not re-run for any case.
The Sharma S1.case_mode synthesis remains valid against its (unchanged)
governance state. Zero API spend on this piece. The expected commit 4
(`feat: re-run S1 synthesis for cases with shifted governance verdicts`)
does not exist because there were no shifts.

Note: S1.case_mode does consume the M0.IndianContext bundle (skill line
23). Sharma's S1 was generated pre-integration with the "not yet
integrated" sentinel in its context. It is NOT re-run here because the
integration contract scopes the S1 re-run strictly to governance verdict
shifts (of which there are none); a full Sharma S1 re-grounding is a
larger operation that belongs with the Phase 5 case regeneration, outside
this session's contained scope. The Sharma IC1 re-run (Piece 5) does pick
up the populated bundle.

## Piece 5: Sharma IC1 changes

**The Sharma IC1 four-step deliberation was re-run live with the
populated M0.IndianContext bundle. All `context_not_yet_available`
sentinels are gone; the Risk Assessor and Counterfactual Engine now
reason with full context and correctly carry the curation honesty
discipline forward.**

### Sentinel-instruction change

`lib/agents/ic1/risk-assessor.ts` and `lib/agents/ic1/counterfactual-engine.ts`
build their prompts; both carried an instruction to emit the literal
`context_not_yet_available` sentinel "pending Workstream C YAML curation
per DEFERRED item 6." That instruction is now conditional on
`input.ctx.indianContext`: when the bundle is present the prompt
instructs the model to ground the relevant bullet or path in the cited
entry and to treat `confidence=indicative` framings as practitioner
practice, not authoritative; when absent the original sentinel
instruction is retained. The other three IC1 runners (Chair, Devil's
Advocate, Minutes Recorder) had no sentinel instruction; they already
render the populated block via `formatCaseContextHeader` and pick up the
grounded context naturally.

### Re-run

`scripts/regenerate-sharma-ic1-grounded.ts` rebuilds ctx with the real
bundle, re-grounds the gate_results (verdicts unchanged, G2 now
sebi_001-cited), deletes the five existing IC1 stubs (recordStubIfMissing
never overwrites), runs the four-step orchestrator live, asserts all five
roles populated and zero sentinels, then refreshes the fixture and stubs.

One guarded false start, then success:

- First attempt short-circuited every role to the `infrastructure_ready`
  sentinel at zero token spend. Cause: the base `.env` carries the local
  dev convention `STUB_MODE=true`, which the tsx process loads;
  resolveStubMode fell through to it (Setting.stubMode is null). The
  script's all-roles-populated assertion caught this before any fixture
  write, so no corruption and no spend. Fix: the script now sets
  `process.env.STUB_MODE="false"` at module scope, which the runtime
  flag resolution honors.
- Second attempt ran live: five sequential Opus 4.7 calls, 64,529 input
  / 7,814 output tokens, 128s wall-clock, approximately USD 1.55 (within
  the USD 2-4 estimate and the budget envelope).

### Result quality (watch items)

- **Sentinels cleared.** Risk Assessor went from 2 sentinels to 0;
  Counterfactual Engine from 1 to 0. The grounded re-run produces real
  content in those fields.
- **Curation honesty discipline carried end-to-end.** The deterministic
  M0.IndianContext flagged `pmlt_001` (PMS pass-through) and `dem_012`
  (PMS exit window) as `confidence=indicative` / `practitioner_practice`.
  The Risk Assessor independently surfaced two risks naming exactly these
  entries and explicitly cautioning the committee not to treat them as
  authoritative. Deterministic retrieval plus honest LLM reasoning over
  it; no hallucinated authority.
- **Counterfactual supersession renders with full content.** The
  Counterfactual Engine produced five concrete structured alternative
  paths (ticket recalibration to the mandate ceiling, staged two-tranche
  deployment, hybrid PMS plus quality MF, existing-PMS consolidation,
  reserve-preserving partial deployment), no sentinels. These supersede
  S1's counterfactual_framing on the Outcome tab when materiality fires.

### Fixture and stub state

`db/fixtures/cases/c-2026-05-14-sharma-01.json` now carries
`indian_context` (the bulk bundle), `gate_results` re-grounded to
sebi_boundaries (same verdicts), and the new `ic1_deliberation`. The
five `fixtures/stub-responses/c-2026-05-14-sharma-01/ic1_*.json` stubs
are re-recorded so STUB_MODE replay reproduces the post-integration
state exactly.

---

## Summary

| Piece | Outcome | API spend |
|---|---|---|
| 1. Wire skill | Done: deterministic agent, six stores, schema, pipeline, dry-run | 0 |
| 2. E1-E7 inspection | E1-E7 do not consume the bundle; S1 and IC1 do | 0 |
| 3. Governance re-grounding | All verdicts stable; G2 now sebi_001-grounded | 0 |
| 4. S1 re-run | Skipped (no verdict shifts) | 0 |
| 5. Sharma IC1 re-run | Re-run grounded; sentinels cleared; discipline held | ~USD 1.55 |

DEFERRED item 6 is resolved. The deterministic-vs-LLM honesty discipline
held throughout: M0.IndianContext and the governance gates are
deterministic; only the Sharma IC1 re-run incurred spend.

## Verification (watch items)

- **Governance verdict stability (1).** Confirmed: the curated minima
  equal the prior MVP values; no verdict shifted (Piece 3).
- **Sharma IC1 quality post-integration (2).** Confirmed: sentinels
  cleared; the Counterfactual supersession renders with full structured
  content (Piece 5).
- **STUB_MODE replay integrity (3).** Confirmed by
  `scripts/_verify-stub-replay-sharma.ts`: replaying the Sharma IC1 under
  STUB_MODE reproduces all five populated roles with zero sentinels from
  the re-recorded stubs.
- **Schema migration cleanliness (4).** No Prisma schema or migration
  changed: `indian_context` lives inside the opaque `Case.contentJson`
  string, not a new column, so there is no migration to break. The
  non-destructive `npm run db:seed` re-seeds all seven fixtures cleanly
  including the updated Sharma fixture. The destructive
  `npm run db:reset` (`prisma db push --force-reset`) was not run: Prisma
  guards it behind an explicit-consent prompt for AI-initiated runs, and
  with the schema unchanged the force-reset is a schema-level no-op. The
  operator can run `npm run db:reset` directly for a belt-and-suspenders
  full rebuild; it is expected to be clean.
