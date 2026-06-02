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

# WA30 (ADR disposition recorded) and WA01 (explicit squash-merge confirmation) gates.
if printf '%s' "$CMD" | grep -Eq 'gh +pr +merge'; then
  # WA30: the ADR disposition must be recorded for this workstream before it can land.
  if [ ! -f "$APPROVALS/adr-disposition" ]; then
    echo "WA30: ADR disposition not recorded for this workstream. At the audit-and-propose stage, classify each architectural decision (net-new, already-covered, supersedes, amends, or none) against docs/decisions/, record it in the audit doc and the PR body, then run: mkdir -p .claude/.approvals && touch .claude/.approvals/adr-disposition   and retry. See docs/working_agreements/WA30_adr_disposition_at_propose.md." >&2
    exit 2
  fi
  # WA01: the primary must explicitly confirm the squash-merge.
  if [ ! -f "$APPROVALS/merge" ]; then
    echo "WA01: no merge-approval marker. The primary must explicitly confirm the squash-merge first. On a 'yes', record it with: mkdir -p .claude/.approvals && touch .claude/.approvals/merge   then retry. See docs/working_agreements/WA01_no_self_merge.md." >&2
    exit 2
  fi
  # Both gates satisfied: consume the one-shot markers and allow the merge.
  rm -f "$APPROVALS/adr-disposition" "$APPROVALS/merge"
  exit 0
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
