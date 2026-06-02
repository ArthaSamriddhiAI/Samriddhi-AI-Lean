# ADR 0044: The working-agreement enforcement architecture

## Status

Accepted and built on branch `chore/v15-wa-enforcement-architecture` (waves 1 to 5). Implements ADR-0043 (the spec-versus-implementation north star). Proposal and per-WA triage: `docs/audits/2026-06-02_wa_enforcement_architecture.md` (Rev 2). Scope stops at the proposal's item 5; items 6 (slash commands) and 7 (the plugin) are deferred (O7, O8). Amended 2026-06-02 (wave 6): adds the ADR-disposition mechanism (WA30); see the Amendment section below.

## Context

The proposal triaged each of WA1 to WA28 to the native Claude Code primitive that best enforces it: mechanically-checkable rules to hooks, always-on judgment to a minimal `CLAUDE.md`, situational judgment to progressively-disclosed skills, and isolated-task patterns to a subagent. This ADR records the load-bearing decisions made while building that triage, and the why behind each, so future work greps the decision rather than re-deriving it.

## Decision

Per-WA mechanisms were realized as: a read-only grounding-audit subagent on a cheaper model plus plan mode (WA22, WA02; the usage-efficiency layer); a minimal repo `CLAUDE.md` and a chat-side conventions block as the two always-on implementations (WA05, WA06, WA17, WA19, WA27, WA28 on the code surface; WA17, WA18, WA23, WA24, WA25 and the planner halves of WA03, WA15 on the chat surface); a `/permissions` set (allow safe tools, deny the WA17 popup tool and WA20 memory writes, ask the WA01 merge); hooks (WA01 and WA12 marker gates, WA10 auto-push, WA20 memory guard, WA26 warn, WA07 two-layer, WA13 and WA14 warn, an audit write-guard); and three pointer-style skills (WA02/21/22, WA05/08/09/15/16, WA13/14/26).

The load-bearing sub-decisions:

- Two-layer WA07: mechanical on files and commits (a Claude Code PreToolUse hook for the commit message, plus a repo-resident git pre-commit hook for staged content, which closes the add-and-commit gap a PreToolUse hook cannot see), and prompt-enforced on free-text chat prose (the always-on blocks). Hooks gate tool-call payloads, not the assistant's free-text output, so the prompt layer is a legitimate, necessary layer, not a gap.
- Parallel reads, serial writes: read-only exploration may fan out; writes and commits stay sequential and gated. The grounding audit fans out to a subagent; writes stay on the main thread. Recorded as a candidate WA for ratification.
- Warn-only for WA13, WA14, WA26: a low-false-positive posture. WA26 cannot blanket-block because the existing personas exit 1 by design (P40); WA13 is doc-scoped and whitelisted; WA14 would block normal fictional-fixture commits if it hard-blocked.
- Marker-gated WA01 and WA12: a deny plus a one-shot approval marker in `.claude/.approvals/`, so the gate stays deliberate while still permitting the action after explicit approval.
- Model tiering for Claude Code's own usage: the grounding-audit subagent runs cheap (the heavy reads isolated, not compounded across the main thread), the main planning thread stays strong. Distinct from the locked product-pipeline tiering.
- Portable hooks: dash detection runs in node and naming uses grep -E with -w, because the hook environment may use BSD grep (no grep -P); enforcing scripts build the dash set from numeric code points, so they carry no long-dash glyph.

## Residency

Every enforcement component is repo-resident and versioned (`.claude/agents/`, `.claude/skills/`, `.claude/settings.json`, `scripts/hooks/`, `scripts/git-hooks/`), each referencing the spec by path. The plugin (the eventual distribution vehicle) is deferred (O8); components were built plugin-ready (pointers, not prose), so packaging is a bundling job, not a rewrite.

## Alternatives considered

- A project hook keyed on `agent_type` for the audit write-guard: rejected in favor of a subagent-frontmatter hook, which is auto-scoped to that subagent and cannot affect main-thread writes (a safer blast radius).
- Splitting the audit subagent into read-only and write-only agents: rejected; the primary kept it single and hardened it with the write-guard hook.
- A plain permissions deny (rather than a marker gate) for WA01: rejected; a deny would block the merge even after the primary approves, but WA01 permits the merge post-confirmation.
- Dumping situational WAs into `CLAUDE.md`, or one skill per WA: rejected (brevity, and trigger cleanliness); three broad progressively-disclosed skills instead.

## Consequences

- Conventions are enforced by tooling that references the spec, not by re-pasting; WA23 is realized in practice.
- Coverage boundaries are explicit, not hidden: WA12 detection is heuristic (the allow-list default-prompt is the first layer); WA13, WA14, and WA26 are warn-only; the WA07 Claude Code hook is complemented by the git pre-commit hook for staged content.
- Deferrals are logged: the candidate WA (parallel reads, serial writes), O6 (the WA26 block-new variant), O7 (slash commands), O8 (the plugin), and the parked proposal Section 8 items 1 (collaborator inheritance) and 7 (CI).

## Amendment (2026-06-02, wave 6): ADR disposition at the propose stage

Adds a sixth mechanism to the architecture above: at the audit-and-propose stage, each architectural decision a workstream forces is classified against the existing ADR set (read `docs/decisions/` first) as net-new, already-covered, supersedes, or amends, with only net-new and supersedes writing a new ADR and supersedes citing the prior by number (the bidirectional, by-number pattern this repo already uses, ADR-0014 to ADR-0042). The implementation: the audit-and-verify skill gains the disposition as a standing output; the audit doc carries a standing "ADR disposition" section; and the merge gate (`scripts/hooks/gate-sensitive-bash.sh`) requires a one-shot `.claude/.approvals/adr-disposition` marker, recorded when the disposition is done, so a workstream cannot land with an unclassified decision. Codified as WA30. This amendment is itself an instance of the mechanism: its own disposition is amends ADR-0044 in place, not a new ADR. Grounding and build: `docs/audits/2026-06-02_adr_capture_at_propose.md`.

## References

- ADR-0043 (the spec-versus-implementation north star this implements).
- WA30 (`docs/working_agreements/WA30_adr_disposition_at_propose.md`) and `docs/audits/2026-06-02_adr_capture_at_propose.md` (the wave-6 amendment, ADR disposition at the propose stage).
- `docs/audits/2026-06-02_wa_enforcement_architecture.md` (the proposal, the per-WA triage, the workflow-upgrade and model-tiering assessments).
- `docs/debt/operational_debt_log.md` (O6, O7, O8 deferrals).
- The build components live under the residency paths above; the proposal's residency map and the branch commits are the file-level record.
