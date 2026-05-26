# WA25: Planner chat for planning, task chats for execution

## Agreement

Planner-chat conversations are reserved for planning work: roadmap shaping, workstream sequencing, convention curation, cross-workstream synthesis. Codebase engagement (reading code, writing code, opening PRs, debugging, capability ideation grounded in code) happens through task chats interfacing with Claude Code. Working agreements emerge from task chats at the point of friction; planner chat curates them into the canonical WAs index at workstream-handoff but does not author them in abstract.

## Exception

Strategically important planning conversations where stakeholder feedback or roadmap reframing requires checking specific codebase facts. "Strategically important" means: something that materially shapes or changes the roadmap itself. Routine implementation detail, debt discovery, capability friction, or bug surfaces do NOT qualify; those route to task chats with Claude Code.

The discipline protects planner-chat context from being polluted by execution-level noise, and protects task-chat work from being short-circuited by planner-chat-level shortcuts. Both chats stay good at what they do because they stay specialized.

## Provenance

The T-5.07 workstream operated this pattern by feel. Planner-chat handoff notes accumulated in task chat (thirteen items by mid-workstream). Decision-points that touched the codebase routed to task chat with CC. Decision-points that touched the plan stayed at planner level. Once during this workstream, the primary pulled the Plan v12 HTML artifact into the task chat to ground a question about canonical WA text; this is the kind of "strategically important" exception the WA's exception clause permits (resolving ambiguity about authoritative source where the answer materially shapes a downstream artifact). The pattern worked; codifying it makes it transferable to future workstreams and explicit for collaborators joining cold.

## Cross-references

All WAs implicitly; WA25 sets the frame within which other WAs are authored and curated.
