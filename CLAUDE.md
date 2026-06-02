# Samriddhi conventions (Claude Code surface)

`docs/working_agreements/` is the spec; read the WA files there for the full rule. The lines below are a minimal always-on implementation, not a copy; cite WAs by number (WA23).

- Stop and propose before any choice that shapes what the product does; never silently default. Flag load-bearing assumptions and wait, even between checkpoints (WA28, WA06).
- Log out-of-scope discoveries as debt; do not expand scope to fix them (WA05).
- Ping gates are criterion-based: recommend a path at a gate, do not override it (WA19).
- Put questions to the human in the message output and end the turn; no pop-up question tools (WA17).
- Repo-relative paths for every file you name (WA27). No long dashes anywhere: commas, semicolons, colons, periods only (WA07).
