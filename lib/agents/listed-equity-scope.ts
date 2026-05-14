/* Shared helper used by E1 and E2 to assemble the listed-equity scope from
 * an investor's holdings.
 *
 * For each holding, decide whether it contributes listed-equity exposure
 * that E1/E2 should analyse:
 *   - Direct listed (listed_large_cap, intl_us_etf, intl_us_individual):
 *     yes; the holding is itself a stock position.
 *   - Mutual fund look-through: only when the snapshot has Top 5 Holdings
 *     data for that fund (foundation §3 coverage constraint).
 *   - PMS look-through: never; foundation §3 treats PMS as structurally
 *     opaque. PMS stocks are not added to the scope.
 *
 * Each stock is paired with its nifty500 record where available, giving
 * E1 per-stock fundamentals and E2 industry framing.
 */

import type { StructuredHoldings } from "@/db/fixtures/structured-holdings";
import type { Snapshot } from "./snapshot-loader";

export type StockInScope = {
  symbol: string;
  source: "direct_listed" | "mf_lookthrough";
  /** Weight in investor's portfolio attributable to this stock.
   *  For direct holdings, the holding's weight. For MF look-through,
   *  (fund_weight × stock_weight_in_fund). */
  effectiveWeightPct: number;
  /** The instrument label that gave rise to this scope entry. */
  viaInstrument: string;
  /** Full nifty500 record where the stock was found in the snapshot. */
  niftyData?: Record<string, unknown> | null;
};

type NiftyCompany = Record<string, unknown> & { name?: string };

function findNiftyCompany(snapshot: Snapshot, name: string): NiftyCompany | null {
  const n5 = snapshot.nifty500 as { companies?: NiftyCompany[] } | undefined;
  if (!n5 || !Array.isArray(n5.companies)) return null;
  const target = name.toLowerCase();
  const hit = n5.companies.find((c) => {
    const n = (c.name ?? "").toString().toLowerCase();
    return n === target || n.startsWith(target) || target.startsWith(n);
  });
  return hit ?? null;
}

type Top5Holding = { rank: number; name: string; weight_pct: number };

function parseTopHoldings(raw: unknown): Top5Holding[] | null {
  if (Array.isArray(raw)) return raw as Top5Holding[];
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Top5Holding[];
    } catch {
      return null;
    }
  }
  return null;
}

export function buildListedScope(
  holdings: StructuredHoldings,
  snapshot: Snapshot,
): StockInScope[] {
  const out: StockInScope[] = [];

  for (const h of holdings.holdings) {
    if (
      h.subCategory === "listed_large_cap" ||
      h.subCategory === "intl_us_etf" ||
      h.subCategory === "intl_us_individual"
    ) {
      // Direct. Intl stocks won't have an Indian nifty500 record but still
      // belong in scope as a portfolio-level position.
      out.push({
        symbol: h.instrument,
        source: "direct_listed",
        effectiveWeightPct: h.weightPct,
        viaInstrument: h.instrument,
        niftyData: h.subCategory === "listed_large_cap" ? findNiftyCompany(snapshot, h.instrument) : null,
      });
      continue;
    }

    if (h.subCategory.startsWith("mf_")) {
      // Look-through only for funds the snapshot has Top 5 Holdings for.
      const fund = snapshot.mf_funds.find((f) => {
        const name = (f.fund_name ?? "").toLowerCase();
        return name.includes(h.instrument.toLowerCase());
      });
      if (!fund) continue;
      const top = parseTopHoldings(fund["Top 5 Holdings (JSON)"]);
      if (!top) continue;
      for (const stock of top) {
        out.push({
          symbol: stock.name,
          source: "mf_lookthrough",
          effectiveWeightPct: (h.weightPct * stock.weight_pct) / 100,
          viaInstrument: h.instrument,
          niftyData: findNiftyCompany(snapshot, stock.name),
        });
      }
    }
  }

  return out;
}
