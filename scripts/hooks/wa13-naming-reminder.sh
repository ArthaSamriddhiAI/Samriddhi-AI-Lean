#!/usr/bin/env bash
# WA13 (warn-only, doc-scoped): when a commit stages files under docs/, surface
# any bare "S1" or "S2" that may be a workflow shorthand (write "Samriddhi 1" or
# "Samriddhi 2" in prose). The whole-word match (grep -w) excludes code identifiers
# (runS1Case, s1_case); agent and synthesis references are filtered out. Never
# blocks. Uses portable grep -E and -w (no grep -P, which BSD grep lacks).
# Reference: docs/working_agreements/WA13_samriddhi_1_2_naming.md
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
INPUT="$(cat)"
case "$INPUT" in *"git commit"*) : ;; *) exit 0 ;; esac
FILES="$(git diff --cached --name-only 2>/dev/null | grep -E '^docs/' || true)"
[ -z "$FILES" ] && exit 0
HITS="$(git diff --cached -U0 -- $FILES 2>/dev/null | grep -E '^\+[^+]' | grep -Ew 'S[12]' | grep -viE 'agent|synthesi' || true)"
if [ -n "$HITS" ]; then
  echo "WA13 reminder (warn-only): a bare 'S1' or 'S2' appears in staged docs. In prose, write the workflows in full as 'Samriddhi 1' or 'Samriddhi 2'; the bare forms name the synthesis agents and slices, not the workflows. Candidate added lines:" >&2
  printf '%s\n' "$HITS" | head -10 >&2
  echo "If these are agent or code references, ignore. See docs/working_agreements/WA13_samriddhi_1_2_naming.md." >&2
fi
exit 0
