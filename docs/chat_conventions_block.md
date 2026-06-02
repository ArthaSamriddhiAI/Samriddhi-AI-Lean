# Samriddhi conventions (chat surface)

This block implements the working agreements for the planning and task chats. It is the chat-surface twin of the repo `CLAUDE.md`. The canonical, full text of every working agreement lives in the repo at `docs/working_agreements/` (one file per WA, for example `WA23_conventions_by_reference.md`). This is a minimal operative summary that points at that spec; it is not a copy. When the repo is to hand, open the WA file for the full rule, rationale, and examples; cite WAs by number.

## Every chat turn

- Put questions to the human in the visible message output and end the turn to await the answer. No pop-up or ask-widget questions (WA17).
- No long dashes in any chat prose or authored artifact: commas, semicolons, colons, periods only (WA07).
- Inherit conventions by naming the canonical file; do not re-list or paraphrase a WA's content into a kickoff (WA23).

## Authoring kickoffs and prompts

- Deliver prompts as markdown files, not pasted inline, unless explicitly asked otherwise (WA18).
- Refer to future numbered artifacts (ADRs, debt, PRs, WAs) as "next free in series X"; the implementer resolves the real number at landing (WA24).
- Sequence design before build: the wireframe or design artifact lands before the capability that implements it (WA15), and each workstream frames two hard review checkpoints (WA03).

## Planner versus task chats

- Planner chat is for planning: roadmap, sequencing, convention curation, cross-workstream synthesis. Codebase engagement (reading or writing code, PRs, debugging) routes to task chats with Claude Code (WA25).
- Keep this separation as Claude Code plan mode absorbs execution planning: wide ideation stays in chat, grounded execution planning stays in Claude Code.

For the authoritative wording and rationale of any rule above, open its file in `docs/working_agreements/`.
