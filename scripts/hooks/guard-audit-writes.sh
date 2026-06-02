#!/usr/bin/env bash
# Audit write-guard: the grounding-audit subagent may write only under docs/audits/.
# Registered in the subagent's own frontmatter (.claude/agents/grounding-audit.md),
# so it fires only for that subagent's Write and Edit calls and cannot affect
# main-thread writes. This hardens the prose-only write-scoping in the subagent's
# system prompt into a mechanical guarantee (the gap flagged at wave 1). The
# subagent stays single (not split); this hook is the hardening.
# Reference: docs/working_agreements/WA22_audit_phase_as_deliverable.md
# (the audit produces a versioned doc under docs/audits/ and writes nothing else).
set -uo pipefail
INPUT="$(cat)"
FILE_PATH="$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch(e){process.stdout.write("")}})' 2>/dev/null)"
case "$FILE_PATH" in
  ""|docs/audits/*|*/docs/audits/*)
    exit 0 ;;
  *)
    echo "Audit write-guard: the grounding-audit subagent may write only under docs/audits/ (attempted: $FILE_PATH). Record any other needed change as a finding for the main thread; do not write it. See docs/working_agreements/WA22_audit_phase_as_deliverable.md." >&2
    exit 2 ;;
esac
