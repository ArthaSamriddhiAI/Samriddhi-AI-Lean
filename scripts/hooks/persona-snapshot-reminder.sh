#!/usr/bin/env bash
# WA26: surface the persona-snapshot-alignment gate when a commit touches the persona
# fixtures. Warn-only (never blocks): the existing personas exit 1 by design
# (grandfathered, P40), so a blanket block would be wrong; only a NEW persona must
# reach exit 0 before it is locked. Points at the existing check script.
# Reference: docs/working_agreements/WA26_persona_snapshot_alignment.md
# PreToolUse hook, matcher Bash. Always exits 0 (informational).
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
INPUT="$(cat)"
if ! printf '%s' "$INPUT" | grep -q 'git commit'; then
  exit 0
fi
if git diff --cached --name-only 2>/dev/null | grep -Eq 'db/fixtures/structured-(holdings|mandates)\.ts'; then
  echo "WA26: this commit touches persona fixtures. Existing personas are exempt (exit 1 by design, P40), but any NEW persona must pass 'npm run check:persona-snapshot -- --investor=<name>' at exit 0 before it is locked and used to generate cases. See docs/working_agreements/WA26_persona_snapshot_alignment.md." >&2
fi
exit 0
