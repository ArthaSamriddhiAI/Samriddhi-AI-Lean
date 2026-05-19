/* Verification script for the risk-reward loader consolidation (ADR-0013).
 * Run via: npx tsx scripts/_verify-loader-enriched.ts
 *
 * Asserts that the enriched snapshot suite is reachable THROUGH loadSnapshot
 * (not by reading the file directly), proving the SNAPSHOTS_DIR repoint. Also
 * asserts backward-compat: pre-enrichment fields still read unchanged, since
 * enriched t0 is a superset of source t0 for pre-existing fields (ADR-0007
 * zero-tolerance principle). Deterministic, no API spend; asserts and exits
 * non-zero on failure (the going-forward _verify-* convention). */

import { loadSnapshot } from "../lib/agents/snapshot-loader";

type Failure = { name: string; detail: string };
const failures: Failure[] = [];

function assert(cond: boolean, name: string, detail: string) {
  if (!cond) failures.push({ name, detail });
  const tag = cond ? "PASS" : "FAIL";
  console.log(`  [${tag}] ${name}${cond ? "" : ` :: ${detail}`}`);
}

async function main() {
  console.log("Probe: enriched fields reachable through loadSnapshot (t0)");
  const s0 = await loadSnapshot("t0_q2_2026");

  /* Enrichment-only top-level blocks. */
  const idxKeys = s0.indices ? Object.keys(s0.indices) : [];
  assert(idxKeys.length === 16, "indices has 16 canonical entries", `got ${idxKeys.length}`);
  assert(
    !!s0.indices?.["nifty_50_tri"]?.monthly_values,
    "indices.nifty_50_tri.monthly_values present",
    "missing",
  );
  assert(!!s0.fx?.["usd_inr"], "fx.usd_inr populated", "missing");
  assert(s0.fx?.["aed_inr"] == null, "fx.aed_inr reserved as null", "expected null");

  /* Per-instrument enrichment on funds. */
  const fundWithTierB = s0.mf_funds.find(
    (f) => f.tier_b_stats && !f.tier_b_stats.data_window_insufficient,
  );
  assert(!!fundWithTierB, "a fund carries populated tier_b_stats", "none found");
  assert(
    typeof fundWithTierB?.tier_b_stats?.sharpe_3y === "number",
    "fund tier_b_stats.sharpe_3y is numeric",
    `got ${typeof fundWithTierB?.tier_b_stats?.sharpe_3y}`,
  );
  assert(
    fundWithTierB?.tier_b_stats?.beta_3y == null,
    "fund tier_b_stats.beta_3y is null pre benchmark_resolution",
    `got ${fundWithTierB?.tier_b_stats?.beta_3y}`,
  );

  /* Per-instrument enrichment on stocks (nifty500). */
  const n5 = s0.nifty500 as { companies?: Array<Record<string, unknown>> };
  const co = n5.companies?.find(
    (c) => (c["tier_b_stats"] as { _meta?: unknown } | undefined)?._meta,
  ) as { tier_b_stats?: { _meta?: { benchmark_index_id?: string } } } | undefined;
  assert(
    !!co?.tier_b_stats?._meta?.benchmark_index_id,
    "a stock carries tier_b_stats._meta.benchmark_index_id",
    "none found",
  );

  /* Provenance. */
  assert(
    !!s0.snapshot_metadata?.enrichment_version,
    "snapshot_metadata.enrichment_version present",
    "missing",
  );

  /* Backward-compat: pre-enrichment fields unchanged. */
  const f0 = s0.mf_funds[0];
  assert(typeof f0.amfi_code === "number", "pre-existing fund amfi_code intact", "missing");
  assert(typeof f0.fund_name === "string", "pre-existing fund fund_name intact", "missing");

  console.log("");
  if (failures.length === 0) {
    console.log("OK: loader consolidation verified; enriched suite reachable via loadSnapshot.");
    process.exit(0);
  } else {
    console.error(`FAILED: ${failures.length} assertion(s) failed.`);
    for (const f of failures) console.error(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FAILED: unexpected error", e);
  process.exit(1);
});
