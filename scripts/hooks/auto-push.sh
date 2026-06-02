#!/usr/bin/env bash
# WA10: push every commit. After a successful git commit, push the branch.
# Reference: docs/working_agreements/WA10_push_every_commit.md
# PostToolUse hook, matcher Bash. Non-blocking (push runs after the commit lands);
# surfaces a message only on push failure.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
INPUT="$(cat)"
if ! printf '%s' "$INPUT" | grep -q 'git commit'; then
  exit 0
fi
CMD="$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&j.tool_input.command)||"")}catch(e){process.stdout.write("")}})' 2>/dev/null)"
case "$CMD" in
  *"git commit"*)
    if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
      git push >/dev/null 2>&1 || echo "WA10: auto-push failed; run git push manually and surface it. See docs/working_agreements/WA10_push_every_commit.md." >&2
    else
      BR="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
      git push -u origin "$BR" >/dev/null 2>&1 || echo "WA10: auto-push (set-upstream) failed for $BR; run git push manually. See docs/working_agreements/WA10_push_every_commit.md." >&2
    fi
    ;;
esac
exit 0
