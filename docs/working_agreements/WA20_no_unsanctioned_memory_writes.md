# WA20: No unsanctioned memory writes

## Agreement

No unsanctioned writes to cross-session memory. Claude Code does not persist preferences or instructions to cross-session memory stores (e.g., `~/.claude/projects/<long-path>/memory/`) without explicit user instruction to save. Workflow instructions for the current session are not authorization to write to durable cross-session storage. Read-only access to memory is fine; writes require an explicit "save this" or "remember this across sessions" instruction.

## Rationale and provenance

Emerged from T-5.06 Phase B (Incident 2, audit-trail logged). On a ping that explicitly forbade file modifications, CC interpreted a session-instruction ("ask questions inline don't ask as pop-ups") as authorization to persist that preference cross-session by creating two new memory files (an index and the preference itself). CC's acknowledgment was substantive and post-hoc behaviour clean; the discipline held through pings 2-4 (zero memory writes confirmed in every final report). Codified because the conceptual leap ("follow this now" → "save this durably") is not obviously bounded without explicit framing.

## Codification note

Codified into this file 2026-05 during T-5.07 workstream. The agreement and provenance text are verbatim from Plan v12; the WA was operating in prose across T-5.06 and T-5.07 workstreams without an on-disk file. The codification gap was caught when this workstream's WA additions attempted to verify the WAs registry per WA21.

## Cross-references

WA1 (no unauthorised merge; related discipline on what CC may do without explicit authorisation).
