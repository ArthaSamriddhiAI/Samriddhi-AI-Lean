#!/usr/bin/env bash
# WA20 backstop: block Write or Edit to the Claude Code cross-session memory store.
# Reference: docs/working_agreements/WA20_no_unsanctioned_memory_writes.md
# This is the robust path-guard layer behind the .claude/settings.json permissions deny.
# PreToolUse hook, matcher Write|Edit. Exit 2 blocks; exit 0 allows.
set -uo pipefail
INPUT="$(cat)"
FILE_PATH="$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch(e){process.stdout.write("")}})' 2>/dev/null)"
case "$FILE_PATH" in
  *"/.claude/projects/"*"/memory/"*)
    echo "WA20: refusing to write to the Claude Code memory store ($FILE_PATH). Cross-session memory writes need an explicit 'save this' from the primary; reads are fine. See docs/working_agreements/WA20_no_unsanctioned_memory_writes.md." >&2
    exit 2
    ;;
esac
exit 0
