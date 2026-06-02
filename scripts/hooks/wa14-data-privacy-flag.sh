#!/usr/bin/env bash
# WA14 (warn-only): when a commit ADDS files in data-suggestive paths
# (db/fixtures/, fixtures/) or new data files (.json/.csv/.tsv/.parquet/.xlsx),
# surface the origin-based privacy classification. Warn-only; the origin judgment
# is the author's (see the data-and-naming skill). A hard "require acknowledgment"
# gate is possible but would block normal fictional-fixture commits, so warn-only
# is the standing shape.
# Reference: docs/working_agreements/WA14_privacy_boundary_for_data_artifacts.md
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
INPUT="$(cat)"
if ! printf '%s' "$INPUT" | grep -q 'git commit'; then exit 0; fi
NEW="$(git diff --cached --name-only --diff-filter=A 2>/dev/null | grep -E '^(db/fixtures/|fixtures/)|\.(json|csv|tsv|parquet|xlsx)$' || true)"
if [ -n "$NEW" ]; then
  echo "WA14 reminder (warn-only): this commit adds data-suggestive files. Classify each by ORIGIN before it lands: real-world-sourced data (vendor, exchange, filing, scrape, paid database) is private and belongs in the private snapshots repo; data invented for the project (fictional holdings, synthetic fixtures) is public. Default to private when unsure. New files:" >&2
  printf '%s\n' "$NEW" | head -15 >&2
  echo "See docs/working_agreements/WA14_privacy_boundary_for_data_artifacts.md." >&2
fi
exit 0
