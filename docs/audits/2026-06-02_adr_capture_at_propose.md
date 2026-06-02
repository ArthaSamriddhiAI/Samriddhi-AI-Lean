# Audit and build: ADR disposition at the propose stage (wave 6)

- **Date:** 2026-06-02
- **Branch:** `chore/v15-wa-enforcement-architecture`
- **Mode:** Audit-first grounding plus build, within the WA enforcement workstream. The grounding ran as three parallel read-only Explore agents (WA29, parallel reads), returning a distilled findings map; the build is serial on the main thread.
- **WAs governing:** WA22 (this audit is a versioned deliverable), WA29 (parallel reads), WA30 (the agreement this builds), WA21 (verify before adding), WA27 (repo-relative paths), WA07 (no long dashes).

## 1. Grounding findings

Distilled from the parallel audit:

- **ADR supersession is bidirectional and by-number** (the ADR-0014 to ADR-0042 model): the superseding ADR names the prior in its title, Status, Decision, and References; the prior ADR's Status line is rewritten in place to `Reversed by ADR-NNNN (date)`. Partial supersession is common ("for funds only"). There is no ADR index, README, or template file; the pattern is convention. Next free ADR is 0045. (`docs/decisions/`)
- **The audit-and-verify skill already reads the ADR index, but only before writing to it** (numbering), not as a discovery read to classify decisions against; the disposition step is a small, named addition. (`.claude/skills/audit-and-verify/SKILL.md`)
- **No CI or PR template** (`.github/` absent); merges go through the WA01 marker gate (`scripts/hooks/gate-sensitive-bash.sh`, the `.claude/.approvals/` pattern). Hand-offs and PR bodies live in `docs/workstreams/` (WA11) and carry an "ADRs landed" section but not a disposition line.

## 2. The mechanism (WA30)

- **Skill extension:** `.claude/skills/audit-and-verify/SKILL.md` gains a disposition step (read `docs/decisions/`, classify each architectural decision as net-new / already-covered / supersedes / amends, cite prior ADRs by number, record a standing "ADR disposition" section). Quiet when covered, loud on net-new or supersedes.
- **Thin pre-merge backstop:** the merge gate (`scripts/hooks/gate-sensitive-bash.sh`) requires a one-shot `.claude/.approvals/adr-disposition` marker, recorded when the disposition is done at propose-time. The marker is a byproduct of doing the disposition, so the normal flow has no extra merge-time click (light, non-reflexive); the gate fires only when the disposition was skipped.
- **Audit-doc template:** a standing "ADR disposition" section (Section 3 below is the first instance).

## 3. ADR disposition (this workstream)

- **Decision:** the ADR-capture mechanism (the disposition step, WA30, and the merge marker-gate).
- **Disposition: amends ADR-0044 in place.** This mechanism extends the enforcement architecture ADR-0044 records, so it sharpens that ADR rather than writing a new one. No new ADR is written. Cited: ADR-0044 (amended), ADR-0043 (the north star).

## 4. References

- `docs/working_agreements/WA30_adr_disposition_at_propose.md` (the agreement).
- `docs/decisions/0044_wa_enforcement_architecture.md` (amended to record the mechanism).
- `docs/audits/2026-06-02_wa_enforcement_architecture.md` (the parent proposal).
- `.claude/skills/audit-and-verify/SKILL.md` and `scripts/hooks/gate-sensitive-bash.sh` (the implementation).
