/* backfill-section06-series: persist the section 06 gross/net monthly series
 * into case fixtures (Package 07).
 *
 * Adds content.time_series_performance.gross_net_series to each named case,
 * additively (asserted: removing the new key reproduces the prior document
 * byte-for-byte). Cases whose coverage does not clear the 70% floor are
 * skipped with a message and stay bars-only (the honesty ruling); the write
 * refuses to overwrite an existing block without --force.
 *
 * P42 discipline: requires explicit --cases= enumeration, exits 1 without it;
 * --dry-run reports targets, coverage, and floor verdicts without writing.
 * Deterministic local compute on persisted fixtures and the local snapshot;
 * no agent invocation, no API (WA12 not engaged).
 *
 *   npx tsx scripts/backfill-section06-series.ts --dry-run --cases=...
 *   npx tsx scripts/backfill-section06-series.ts --cases=c-2026-05-15-surana-01,...
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { INVESTOR_TRANSACTIONS } from "../db/fixtures/investor-transactions";
import {
  computeSection06Series,
  type Section06Series,
} from "../lib/agents/section06-series";
import type { Snapshot } from "../lib/agents/snapshot-loader";

const ROOT = process.cwd();
const CASES_DIR = path.join(ROOT, "db", "fixtures", "cases");
const SNAPSHOT_PATH = path.join(
  ROOT, "fixtures", "snapshots", "enriched", "snapshot_t0_q2_2026.json",
);

function fail(msg: string): never {
  console.error("backfill-section06-series FAILED: " + msg);
  process.exit(1);
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const casesArg = args.find((a) => a.startsWith("--cases="));
  if (!casesArg) {
    fail(
      "--cases= is required (explicit enumeration per P42; no all-cases default). " +
        "Use --dry-run to preview.",
    );
  }
  const caseIds = casesArg.slice("--cases=".length).split(",").map((s) => s.trim()).filter(Boolean);
  if (caseIds.length === 0) fail("--cases= is empty");

  const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8")) as Snapshot;
  const meta = (snapshot.snapshot_metadata ?? {}) as Record<string, unknown>;
  if (!meta["real_data_build"]) {
    fail(
      "snapshot at " + SNAPSHOT_PATH + " has no real_data_build stamp; refusing " +
        "to compute the series against a non-real t0 (D14's failure mode).",
    );
  }
  const statementDate = String(meta["snapshot_date"] ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(statementDate)) fail("snapshot_date missing");
  const sd = statementDate.slice(0, 7);
  const anchorMonth =
    sd.slice(5) === "01"
      ? String(Number(sd.slice(0, 4)) - 1) + "-12"
      : sd.slice(0, 5) + String(Number(sd.slice(5)) - 1).padStart(2, "0");

  const byInvestor = new Map(INVESTOR_TRANSACTIONS.map((r) => [r.investorId, r]));

  for (const caseId of caseIds) {
    const file = path.join(CASES_DIR, caseId + ".json");
    const raw = readFileSync(file, "utf-8");
    const doc = JSON.parse(raw) as {
      investorId: string;
      workflow: string;
      content: { time_series_performance?: Record<string, unknown> };
    };
    if (doc.workflow !== "s2") fail(caseId + ": not a Samriddhi 2 diagnostic case fixture");
    const rec = byInvestor.get(doc.investorId);
    if (!rec) {
      console.log(caseId + ": no canonical record for investor '" + doc.investorId + "'; skipped");
      continue;
    }
    const series: Section06Series = computeSection06Series(rec, snapshot, anchorMonth);
    const cov = series.coverage;
    const verdict = cov.clears_floor ? "CLEARS floor, series persists" : "below floor, stays bars-only";
    console.log(
      caseId + ": covered " + cov.covered_weight_pct + "% (floor " + cov.floor_pct +
        "%), " + verdict + "; window " + series.window_start + ".." + series.anchor_month +
        ", " + series.monthly.length + " months",
    );
    if (!cov.clears_floor || dryRun) continue;

    const tsp = doc.content.time_series_performance;
    if (!tsp) fail(caseId + ": content.time_series_performance missing");
    if (tsp["gross_net_series"] && !force) {
      fail(caseId + ": gross_net_series already present (use --force to overwrite)");
    }
    tsp["gross_net_series"] = series;

    const out = JSON.stringify(doc, null, 2) + (raw.endsWith("\n") ? "\n" : "");
    // Additive assertion: removing the key must reproduce the prior bytes.
    const recheck = JSON.parse(out) as typeof doc;
    delete recheck.content.time_series_performance!["gross_net_series"];
    const restored = JSON.stringify(recheck, null, 2) + (raw.endsWith("\n") ? "\n" : "");
    if (restored !== raw) fail(caseId + ": write would not be purely additive; aborting");

    writeFileSync(file, out);
    console.log("  wrote " + path.relative(ROOT, file) + " (additive, verified)");
  }
}

main();
