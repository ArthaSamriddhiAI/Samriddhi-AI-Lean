# WA18: Prompts ship as markdown files by default

## Agreement

Unless explicitly stated otherwise (e.g., this planning chat using HTML for the roadmap), any prompt requested by the primary (CC prompts, working-chat ideation prompts, cross-chat handoff prompts, update docs) shall be delivered as a `.md` file via the create_file plus present_files mechanism, not pasted inline in the chat response.

## Rationale

Portable, version-controllable locally, easy to carry between chats and into Claude Code sessions. Inline prompts get lost in the chat scroll; file-based prompts get a permanent local home, can be numbered for sequence tracking, can be edited before firing, can be shared with colleagues working on parallel packages. The build operates across multiple chats and across CC sessions; the prompt-as-file pattern is the connective tissue. Exceptions: format-shifted deliverables that have their own canonical format (like this HTML planner), trivial one-line clarifications, or when the primary explicitly asks for an inline response.

## Trigger

*(Extended from planner body.)* Adopted as the prompt-delivery default across the multi-chat / multi-CC-session build, where inline prompts were getting lost in chat scroll and could not be carried between sessions. Codified into the repo during T-5.06 alongside WA15, WA16, WA17.

## Examples

**Compliance:** The T-5.06 ping set (`02`-`05`) ships as numbered `.md` files carried into the Claude Code session and fired in sequence.

**Non-compliance:** Pasting a multi-section capability prompt inline into a chat response, where it cannot be numbered, edited before firing, or carried into a CC session.

## Cross-references

WA11 (dual-write hand-off, the cross-chat continuity model this supports). Codified from planner v11.3.
