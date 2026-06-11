/* _verify-section06-series: deterministic verification of the persisted
 * section 06 gross/net series blocks (Package 07).
 *
 * Recomputes each investor's series from the canonical transaction store and
 * the local real t0 snapshot, and asserts:
 *  - the persisted block deep-equals the recomputation (no drift);
 *  - months are contiguous and end at the anchor;
 *  - the terminal gross ties to the sum of covered holding values (within a
 *    rupee per covered holding);
 *  - every persisted case clears the 70% floor, and the non-clearing cases
 *    (bhatt, menon) carry NO block (the honest deferral);
 *  - the snapshot in the working tree is the real t0 (real_data_build stamp).
 *
 * Offline, zero API (WA12 not engaged). Run:
 *   npx tsx scripts/_verify-section06-series.ts
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { INVESTOR_TRANSACTIONS } from "../db/fixtures/investor-transactions";
import {
  computeSection06Series,
  SECTION06_COVERAGE_FLOOR_PCT,
  type Section06Series,
} from "../lib/agents/section06-series";
import type { Snapshot } from "../lib/agents/snapshot-loader";

const ROOT = process.cwd();
const CLEARING = [
  "c-2026-05-15-surana-01",
  "c-2026-05-15-iyengar-01",
  "c-2026-05-15-malhotra-01",
];
const DEFERRED = ["c-2026-05-14-bhatt-01", "c-2026-05-15-menon-01"];

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (!ok) {
    failures += 1;
    console.error("  FAIL " + label + (detail ? ": " + detail : ""));
  } else {
    console.log("  ok   " + label);
  }
}

function loadCase(caseId: string): {
  investorId: string;
  content: { time_series_performance?: { gross_net_series?: Section06Series } };
} {
  return JSON.parse(
    readFileSync(path.join(ROOT, "db", "fixtures", "cases", caseId + ".json"), "utf-8"),
  );
}

const snapshot = JSON.parse(
  readFileSync(
    path.join(ROOT, "fixtures", "snapshots", "enriched", "snapshot_t0_q2_2026.json"),
    "utf-8",
  ),
) as Snapshot;
const meta = (snapshot.snapshot_metadata ?? {}) as Record<string, unknown>;
check("snapshot carries real_data_build stamp", Boolean(meta["real_data_build"]));

const byInvestor = new Map(INVESTOR_TRANSACTIONS.map((r) => [r.investorId, r]));

for (const caseId of CLEARING) {
  const doc = loadCase(caseId);
  const persisted = doc.content.time_series_performance?.gross_net_series;
  check(caseId + " carries gross_net_series", Boolean(persisted));
  if (!persisted) continue;

  const rec = byInvestor.get(doc.investorId)!;
  const recomputed = computeSection06Series(rec, snapshot, persisted.anchor_month);
  check(
    caseId + " persisted block equals recomputation",
    JSON.stringify(persisted) === JSON.stringify(recomputed),
  );
  check(
    caseId + " clears the floor",
    persisted.coverage.clears_floor &&
      persisted.coverage.covered_weight_pct >= SECTION06_COVERAGE_FLOOR_PCT,
  );

  const months = persisted.monthly.map((m) => m.month);
  let contiguous = true;
  for (let i = 1; i < months.length; i++) {
    const prev = months[i - 1];
    const y = Number(prev.slice(0, 4));
    const mm = Number(prev.slice(5, 7));
    const expect =
      mm === 12
        ? String(y + 1).padStart(4, "0") + "-01"
        : prev.slice(0, 5) + String(mm + 1).padStart(2, "0");
    if (months[i] !== expect) contiguous = false;
  }
  check(caseId + " months contiguous", contiguous);
  check(
    caseId + " ends at the anchor",
    months[months.length - 1] === persisted.anchor_month,
  );

  const coveredValueInr = rec.holdings
    .filter((h) =>
      persisted.coverage.covered.some((c) => c.instrument === h.instrument),
    )
    .reduce((s, h) => s + h.valueCr * 1e7, 0);
  const terminal = persisted.monthly[persisted.monthly.length - 1].gross_value_inr;
  check(
    caseId + " terminal gross ties to covered canonical values",
    Math.abs(terminal - coveredValueInr) <= persisted.coverage.covered.length + 1,
    terminal + " vs " + coveredValueInr,
  );
}

for (const caseId of DEFERRED) {
  const doc = loadCase(caseId);
  check(
    caseId + " carries NO gross_net_series (honest deferral)",
    !doc.content.time_series_performance?.gross_net_series,
  );
}

if (failures > 0) {
  console.error("\n_verify-section06-series: " + failures + " failure(s)");
  process.exit(1);
}
console.log("\n_verify-section06-series: PASS");
