# WA30: ADR disposition at the propose stage

## Agreement

At the audit-and-propose stage of every workstream, each architectural decision the proposal forces is classified against the existing ADR set, never blind to it. The propose step first reads docs/decisions/ (the ADR index), then assigns each decision a disposition: net-new (write a fresh ADR), already-covered (cite the existing ADR by number, write nothing), supersedes (write a new ADR that explicitly reverses or replaces the named prior ADR, and annotate the prior ADR's Status line forward, the ADR-0014-to-0042 pattern), or amends (sharpen an existing ADR in place). Only net-new and supersedes warrant a new ADR; supersedes must cite the prior ADR by number so the decision log stays a single coherent chain, not an accreting pile of contradictions. The disposition is recorded as a standing section in the workstream's audit doc and surfaced in the hand-off or PR body; a workstream does not land with an architectural decision left unclassified.

The classification is quiet when a decision is already covered (it cites the ADR and moves on) and loud only on net-new or supersedes. It does not fire on reversible, contained implementation choices (a variable name, a helper signature); those are not architectural decisions, the same boundary WA28 draws.

## Rationale

Architectural decisions get made in the course of building, and an ADR that should have been written gets caught only by the primary's manual vigilance. The audit-and-propose stage is the one checkpoint where decisions reliably surface and where the primary's attention already is, so it is the place to make the capture automatic. Classifying against the existing ADR set, rather than always writing a new ADR, keeps the decision log coherent: a decision already covered cites its ADR rather than duplicating it; a decision that reverses a prior one names that prior so the log reads as a chain, not a contradiction. The failure mode it prevents: the decision log silently going stale or self-contradictory because new decisions were never reconciled against the old ones.

## Trigger

Surfaced during the WA enforcement build. The recurring failure mode is architectural decisions made without an ADR, caught only by manual vigilance. The primary scoped the fix to the audit-and-propose stage (not a detection problem, since decisions are not mechanically detectable, but a make-the-propose-step-ask-the-question problem) and required that the classification not be blind to the existing ADRs (the ADR-0014-to-0042 supersession pattern is the model). Codified so the discipline is a standing output of the propose stage, not a thing the primary has to remember to check.

## Examples

**Compliance:** A proposal forces a decision about debt-numbering. The propose step reads docs/decisions/, finds it already covered by an existing ADR, cites it by number, and writes nothing new. A second decision reverses a prior ADR; the propose step classifies it supersedes, writes a new ADR naming the prior by number, and annotates the prior ADR's Status line forward.

**Non-compliance:** A workstream changes the model-tiering approach, lands, and only weeks later does the primary notice no ADR was written and the change quietly contradicts an existing one.

## Cross-references

WA22 (audit phase as a versioned deliverable), the stage WA30 attaches to; WA28 (product-shape stop-and-propose), the sibling propose-stage discipline and the same architectural-versus-implementation boundary; WA08 (surface debt before PR), the analogous land-nothing-uncaptured discipline for debt; WA21 (verify before adding), the read-the-live-registry discipline the disposition read uses. ADR-0043 and ADR-0044 (the enforcement architecture this extends). The audit-and-verify skill (.claude/skills/audit-and-verify/SKILL.md), the implementation.
