/* Snapshot loader with an in-memory LRU cache, capacity 3.
 *
 * Each snapshot is roughly 11 MB on disk; parsing into V8 heap is the
 * expensive part (a few hundred ms). Cases routinely re-read the same
 * snapshot in successive pipeline calls; caching parsed snapshots keeps
 * later reads near-zero cost.
 *
 * Cache scope: module-scoped Map, lifetime of the Node process. Cleared
 * on dev-server restart. No filesystem-watch invalidation; snapshots are
 * immutable fixtures (copied locally by scripts/copy-fixtures.ts).
 *
 * Capacity 3 keeps memory bounded: worst case roughly 3 * 11 MB on disk,
 * which inflates to roughly 80-100 MB parsed in V8. Acceptable for the
 * local dev process.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

/* Risk-reward workstream consolidation (ADR-0013): the loader reads the
 * enriched snapshot suite as canonical. The pre-enrichment source directory
 * (fixtures/snapshots/) is retained only as a rollback path until the
 * risk-reward data review confirms the consolidation is sound; it is deleted
 * before that workstream's PR opens. Enriched filenames match source
 * filenames, so the loadSnapshot path construction is unchanged. */
const SNAPSHOTS_DIR = path.resolve(process.cwd(), "fixtures", "snapshots", "enriched");
const CAPACITY = 3;

/* The snapshot is a large nested structure. We type only the top-level
 * sections we know about and leave their contents as unknown; downstream
 * consumers (E1, E3, E7, deterministic metrics, risk-reward) cast and
 * destructure what they need.
 *
 * Top-level sections: mf_funds, aif, pms, nifty500, unlisted_equity,
 * industry_reports, macro, and the enrichment blocks indices and fx.
 * Per-instrument enrichment lives inside the rows: tier_b_stats and
 * monthly_nav on mf_funds[], tier_b_stats and monthly_prices on
 * nifty500.companies[].
 */

/* Pre-computed per-instrument risk-reward statistics (ADR-0012). Numeric
 * fields are number or null; null means the metric was not computed (for
 * funds, beta/r_squared/tracking_error/information_ratio are null until the
 * risk-reward benchmark_resolution pass populates them, ADR-0013 onward).
 * When the monthly series is too short the metric fields are absent and the
 * data_window_insufficient sentinel is present instead. The risk-free
 * baseline is NOT carried here; it is the documented 5.25% repo rate from
 * ADR-0012. Read-through only; consumers never recompute these. */
export type TierBStats = {
  vol_3y_annualized?: number | null;
  vol_5y_annualized?: number | null;
  sharpe_3y?: number | null;
  sharpe_5y?: number | null;
  sortino_3y?: number | null;
  sortino_5y?: number | null;
  max_drawdown_3y?: number | null;
  max_drawdown_5y?: number | null;
  calmar_3y?: number | null;
  beta_3y?: number | null;
  r_squared_3y?: number | null;
  tracking_error_3y?: number | null;
  information_ratio_3y?: number | null;
  data_window_insufficient?: boolean;
  reason?: string;
  /* Funds only (ADR-0014/0015): "resolved" once the four benchmark-relative
   * metrics are populated against _meta.benchmark_index_id, else a partition
   * sentinel ("benchmark_structurally_inapplicable", "benchmark_not_in_snapshot",
   * "insufficient_overlap"). Absent on stocks and on data_window_insufficient. */
  _benchmark_resolution?: string;
  _meta?: {
    sector?: string;
    cap_tier?: string;
    benchmark_index_id?: string;
  };
};

export type SnapshotIndexSeries = {
  name?: string;
  category?: string;
  synthesis_method?: string;
  monthly_values?: Record<string, number>;
  metadata?: unknown;
};

export type SnapshotFxSeries = {
  monthly_values?: Record<string, number>;
  [key: string]: unknown;
};

export type Nifty500Company = {
  name?: string;
  monthly_prices?: Record<string, number>;
  tier_b_stats?: TierBStats;
  [key: string]: unknown;
};

export type Nifty500 = {
  companies?: Nifty500Company[];
  [key: string]: unknown;
};

export type Snapshot = {
  _meta: {
    description: string;
    sections: string[];
    mf_funds_count: number;
    unlisted_equity_count: number;
    industry_reports_count: number;
  };
  mf_funds: MutualFundRow[];
  aif: unknown;
  pms: unknown;
  nifty500: unknown;
  unlisted_equity: unknown;
  industry_reports: unknown;
  macro: unknown;
  /* Enrichment top-level blocks (ADR-0009, ADR-0010, ADR-0012): 16 canonical
   * indices keyed by index_id; fx carries usd_inr with eur/gbp/aed reserved
   * as null. Optional so pre-enrichment shapes still type-check. */
  indices?: Record<string, SnapshotIndexSeries>;
  fx?: Record<string, SnapshotFxSeries | null>;
  snapshot_metadata?: SnapshotMetadata;
};

export type MutualFundRow = {
  amfi_code: number;
  fund_name: string;
  sebi_category?: string;
  monthly_nav?: Record<string, number>;
  total_months?: number;
  rolling_metrics?: Record<string, number | string>;
  tier_b_stats?: TierBStats;
  /* These are JSON-encoded strings in the source; consumers parse on access. */
  "Top 5 Holdings (JSON)"?: string;
  "Top 5 Sectors (JSON)"?: string;
  NAV?: number;
  "AUM (Cr)"?: number;
  [key: string]: unknown;
};

export type SnapshotMetadata = {
  snapshot_id?: string;
  date?: string;
  type?: string;
  test_axis?: string;
  /* Enrichment provenance (ADR-0007, ADR-0012). evolution_type is "baseline"
   * at t0 and a regime label (quiet, event, etc.) at t1..t8; risk-reward
   * derives the synthetic-forward disclosure from it. enrichment_version
   * differs t0 (phase-b prototype) vs t1..t8 (phase-c forward extension). */
  snapshot_date?: string;
  evolution_type?: string;
  days_elapsed_since_t0?: number;
  enrichment_version?: string;
  enrichment_applied_at?: string;
  [key: string]: unknown;
};

const cache = new Map<string, Snapshot>();

/* Move an accessed key to the back of the Map so insertion order tracks LRU
 * (Map iteration order is insertion order; the head is the least-recently
 * used, the tail is the most). */
function touch(key: string, value: Snapshot) {
  cache.delete(key);
  cache.set(key, value);
}

function evictIfFull() {
  while (cache.size >= CAPACITY) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) return;
    cache.delete(oldest);
  }
}

export async function loadSnapshot(snapshotId: string): Promise<Snapshot> {
  const cached = cache.get(snapshotId);
  if (cached) {
    touch(snapshotId, cached);
    return cached;
  }

  const filePath = path.join(SNAPSHOTS_DIR, `snapshot_${snapshotId}.json`);
  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as Snapshot;

  evictIfFull();
  cache.set(snapshotId, parsed);
  return parsed;
}

/* Test-friendly accessors. Not used by production code paths. */
export function _cacheKeys(): string[] {
  return Array.from(cache.keys());
}

export function _cacheClear(): void {
  cache.clear();
}
