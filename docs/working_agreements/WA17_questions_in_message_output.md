# WA17: Questions live in the message output

## Agreement

When Claude (orchestration chat, working chat, or Claude Code) needs to ask the human a question, the question is written into the visible message output and the turn ends to await response. No interactive pop-up question mechanisms (modals, ask-user-input widgets, mid-response prompts). The question must be visible to the human as written content in the message stream, not as ephemeral UI state.

## Rationale

In-the-moment legibility for the orchestrator. Pop-up questions create state the human has to interact with mid-flow rather than read alongside the rest of Claude's reasoning. They also break the prompt-history reconstruction model: when prompts are saved but interactive UI state is not, a question that lived only in a modal becomes a transcript hole when the work needs to be revisited. Questions in message output stay queryable, editable, redirectable. Applies to all Claude surfaces working on Samriddhi.

## Trigger

*(Extended from planner body.)* Adopted after a Claude Code session used a pop-up question widget mid-task; the human asked for questions to live inline in the chat instead, with the turn ending to await the answer. Codified into the repo during T-5.06 alongside WA15, WA16, WA18.

## Examples

**Compliance:** Claude Code reaches a genuine fork it cannot resolve, writes the options as numbered text in its response, and ends the turn to wait for the human's choice.

**Non-compliance:** Surfacing the same fork through an interactive popup / ask-user-input widget that the human must click through, leaving no written record in the message stream.

## Cross-references

WA06 (flag and wait freely, the general form); WA11 (dual-write hand-off, the prompt-history reconstruction model this protects). Codified from planner v11.3.
