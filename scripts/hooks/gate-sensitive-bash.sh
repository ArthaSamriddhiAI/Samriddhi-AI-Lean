#!/usr/bin/env bash
# WA01 (squash-merge gate) and WA12 (API or cost gate) backstop on Bash commands.
# References: docs/working_agreements/WA01_no_self_merge.md, docs/working_agreements/WA12_api_call_gate.md
# A sensitive command proceeds only when a one-shot approval marker is present in
# .claude/.approvals/ (created after the primary's explicit gate is satisfied, then
# consumed here). PreToolUse hook, matcher Bash. Exit 2 blocks; exit 0 allows.
set -uo pipefail
INPUT="$(cat)"
# Fast path: nothing sensitive in the raw input, allow immediately.
if ! printf '%s' "$INPUT" | grep -Eq 'gh pr merge|refire|pipeline|backfill'; then
  exit 0
fi
CMD="$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&j.tool_input.command)||"")}catch(e){process.stdout.write("")}})' 2>/dev/null)"
PROJ="${CLAUDE_PROJECT_DIR:-.}"
APPROVALS="$PROJ/.claude/.approvals"

# WA01: squash-merge gate.
if printf '%s' "$CMD" | grep -Eq 'gh +pr +merge'; then
  if [ -f "$APPROVALS/merge" ]; then
    rm -f "$APPROVALS/merge"
    exit 0
  fi
  echo "WA01: no merge-approval marker. The primary must explicitly confirm the squash-merge first. On a 'yes', record it with: mkdir -p .claude/.approvals && touch .claude/.approvals/merge   then retry. See docs/working_agreements/WA01_no_self_merge.md." >&2
  exit 2
fi

# WA12: an LLM or pipeline run that may incur Anthropic spend (heuristic match; the
# allow-list also leaves these to default-prompt, so this is a hard-block backstop).
if printf '%s' "$CMD" | grep -Eq '(tsx|node|npx)[^&|;]*(refire|pipeline|backfill)'; then
  if [ -f "$APPROVALS/api-cost" ]; then
    rm -f "$APPROVALS/api-cost"
    exit 0
  fi
  echo "WA12: this looks like an LLM or pipeline run that may incur API spend. Surface the call count and a rough cost estimate to the primary first. On approval, record it with: mkdir -p .claude/.approvals && touch .claude/.approvals/api-cost   then retry. See docs/working_agreements/WA12_api_call_gate.md." >&2
  exit 2
fi
exit 0
