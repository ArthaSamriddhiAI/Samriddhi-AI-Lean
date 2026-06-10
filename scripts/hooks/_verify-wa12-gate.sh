#!/usr/bin/env bash
# _verify-wa12-gate: proves the WA12 gate hook's structural no-spend detection
# (Package 07). The hook must NOT fire on a known no-spend invocation (proven
# by import-chain analysis), and must STILL fire on direct reach, transitive
# reach, and unprovable invocations, with the one-shot marker protocol intact.
# Runs the hook exactly as the harness does (stdin JSON, CLAUDE_PROJECT_DIR);
# nothing here executes any gated script, only the hook itself. Zero API.
#
#   bash scripts/hooks/_verify-wa12-gate.sh
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOOK="$ROOT/scripts/hooks/gate-sensitive-bash.sh"
APPROVALS="$ROOT/.claude/.approvals"
SAVED=""

fail_count=0
check() { # label expected_exit actual_exit
  if [ "$2" -eq "$3" ]; then
    echo "  ok   $1"
  else
    echo "  FAIL $1 (expected exit $2, got $3)"
    fail_count=$((fail_count + 1))
  fi
}

run_hook() { # command-string -> echoes hook exit code
  printf '{"tool_input":{"command":"%s"}}' "$1" \
    | CLAUDE_PROJECT_DIR="$ROOT" bash "$HOOK" >/dev/null 2>&1
  echo $?
}

# Preserve any real marker, run with a clean slate, restore at the end.
if [ -f "$APPROVALS/api-cost" ]; then SAVED="yes"; rm -f "$APPROVALS/api-cost"; fi

echo "WA12 gate hook behaviour:"

check "no-spend backfill (proven no-reach) is allowed without a marker" 0 \
  "$(run_hook 'npx tsx scripts/backfill-section06-series.ts --dry-run --cases=c-2026-05-15-surana-01')"

check "genuine SDK reach (backfill-a3) still fires without a marker" 2 \
  "$(run_hook 'npx tsx scripts/backfill-a3.ts --cases=c-2026-05-14-bhatt-01')"

check "direct-reach test fixture still fires" 2 \
  "$(run_hook 'npx tsx scripts/hooks/testdata/direct-spendy-pipeline.ts')"

check "transitive-reach test fixture still fires" 2 \
  "$(run_hook 'npx tsx scripts/hooks/testdata/transitive-spendy-backfill.ts')"

check "type-only SDK import is erased at runtime and is allowed" 0 \
  "$(run_hook 'npx tsx scripts/hooks/testdata/typeonly-clean-backfill.ts')"

check "unprovable invocation (no such file) fails closed" 2 \
  "$(run_hook 'npx tsx scripts/does-not-exist-backfill.ts')"

check "no extractable script path (npm alias) fails closed" 2 \
  "$(run_hook 'npm run backfill -- --cases=x')"

check "non-gated command with the word in a path is untouched" 0 \
  "$(run_hook 'ls fixtures/backfill-notes')"

mkdir -p "$APPROVALS" && touch "$APPROVALS/api-cost"
check "marker still admits an unproven invocation (one-shot)" 0 \
  "$(run_hook 'npx tsx scripts/backfill-a3.ts --cases=c-2026-05-14-bhatt-01')"
if [ -f "$APPROVALS/api-cost" ]; then
  echo "  FAIL marker was not consumed"
  fail_count=$((fail_count + 1))
else
  echo "  ok   marker consumed by the gated run"
fi

# Restore prior marker state.
if [ "$SAVED" = "yes" ]; then touch "$APPROVALS/api-cost"; fi

if [ "$fail_count" -gt 0 ]; then
  echo ""
  echo "_verify-wa12-gate: $fail_count failure(s)"
  exit 1
fi
echo ""
echo "_verify-wa12-gate: PASS"
