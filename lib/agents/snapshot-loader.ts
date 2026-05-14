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

const SNAPSHOTS_DIR = path.resolve(process.cwd(), "fixtures", "snapshots");
const CAPACITY = 3;

/* The snapshot is a large nested structure. We type only the top-level
 * sections we know about and leave their contents as unknown; downstream
 * consumers (E1, E3, E7, deterministic metrics) cast and destructure
 * what they need.
 *
 * Sections (per snapshot _meta block):
 *   mf_funds, aif, pms, nifty500, unlisted_equity, industry_reports, macro
 */
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
  snapshot_metadata?: SnapshotMetadata;
};

export type MutualFundRow = {
  amfi_code: number;
  fund_name: string;
  sebi_category?: string;
  monthly_nav?: Record<string, number>;
  rolling_metrics?: Record<string, number | string>;
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
