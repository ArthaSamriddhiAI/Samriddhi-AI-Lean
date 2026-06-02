# ADR 0043: Working agreements are the specification, everything else is an implementation

## Status

Accepted. The architectural principle behind the WA enforcement build (branch `chore/v15-wa-enforcement-architecture`); ADR-0044 records the specific architecture that realizes it. Proposal: `docs/audits/2026-06-02_wa_enforcement_architecture.md` (Rev 2), where this is the opening framing.

## Context

The 28 working agreements in `docs/working_agreements/` were enforced by re-pasting them into prompts (kickoffs, pings). That is the drift WA23 names: the lister works from memory, the canonical files are the truth, and a re-listed WA silently diverges from its source (the T-5.07 kickoff operated against a superseded WA1 for several turns). The build that replaces re-pasting with native tooling needed one rule to govern where each convention lives, so that adding tooling does not re-create the very drift it is meant to kill.

## Decision

The `docs/working_agreements/` files are the specification: the single source of truth. Every other artifact, `CLAUDE.md`, the chat-side conventions block, skills, hooks, subagent definitions, permissions, and any eventual plugin, is an implementation of that specification on a particular surface. Implementations reference the spec (by path, by WA number, by pointer); they never copy its prose.

## Consequences

- Drift is impossible by construction: when no implementation carries a second copy of a rule, there is no second copy to diverge.
- The plugin tension resolves cleanly: a plugin, if ever built, is one more implementation that references the spec, never a second source of truth. Claude Code plugins copy component text, so a plugin packages pointers and check logic, not WA prose (ADR-0044 and the proposal section 4.2 carry the mechanics).
- Every enforcement component reads as a pointer back at the canonical files: a skill body says "read `docs/working_agreements/WA02...`"; a hook comment cites the WA file; `CLAUDE.md` carries a pointer line, not the WAs themselves.
- Brevity follows: the always-on files (`CLAUDE.md`, the chat block) stay minimal because they point rather than reproduce.

## Alternatives considered

- Dump all WAs into `CLAUDE.md` (always-on): rejected. It is the longest, least-adhered version of the system (an overlong always-on file reduces instruction-following) and it copies WA text into a second always-loaded file, re-creating drift.
- Copy each WA's text into the skill or hook that enforces it: rejected. That forks the spec into many drifting copies, the exact WA23 failure mode.
- Leave enforcement as prompt re-pasting (the status quo): rejected. It is the drift this build exists to end.

## References

- `docs/working_agreements/WA23_conventions_by_reference.md` (the agreement this realizes).
- ADR-0044 (the WA enforcement architecture that implements this principle).
- `docs/audits/2026-06-02_wa_enforcement_architecture.md` (the proposal).
