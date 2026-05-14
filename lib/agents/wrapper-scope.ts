/* Shared scope builders for E6 (PMS / AIF) and E7 (MF).
 *
 * Walk an investor's structured holdings, pull the matching snapshot
 * records, and curate a token-economical subset of fields for the LLM
 * prompt. Foundation §3 marks PMS and AIF as structurally opaque at the
 * holding level; the snapshot's pms and aif sections do carry strategy-
 * level metadata (manager, AUM, fees, returns versus benchmark) which the
 * evidence agents can use without violating the look-through boundary.
 */

import type { Holding, StructuredHoldings } from "@/db/fixtures/structured-holdings";
import type { Snapshot, MutualFundRow } from "./snapshot-loader";

export type WrapperRow = {
  instrument: string;
  wrapper_type: "PMS" | "AIF";
  sub_category: string;
  weight_pct: number;
  value_cr: number;
  snapshot_record: Record<string, unknown> | null;
};

export type MutualFundScopeRow = {
  instrument: string;
  sub_category: string;
  weight_pct: number;
  value_cr: number;
  /** Curated subset of the snapshot's mf_funds row, token-economical. */
  snapshot_curated: Record<string, unknown> | null;
};

type PmsRecord = { identity?: { fund_name?: string }; [key: string]: unknown };
type AifRecord = { "Fund Name"?: string; [key: string]: unknown };

function findPMS(snapshot: Snapshot, instrument: string): PmsRecord | null {
  const pms = snapshot.pms as { funds?: PmsRecord[] } | undefined;
  if (!pms?.funds) return null;
  const target = simplify(instrument);
  const hit = pms.funds.find((p) => {
    const name = simplify(p.identity?.fund_name ?? "");
    return overlapsName(name, target);
  });
  return hit ?? null;
}

function findAIF(snapshot: Snapshot, instrument: string): AifRecord | null {
  const aif = snapshot.aif as { "Fund Profiles"?: AifRecord[] } | undefined;
  if (!aif?.["Fund Profiles"]) return null;
  const target = simplify(instrument);
  const hit = aif["Fund Profiles"].find((a) => {
    const name = simplify(a["Fund Name"] ?? "");
    return overlapsName(name, target);
  });
  return hit ?? null;
}

function findMF(snapshot: Snapshot, instrument: string): MutualFundRow | null {
  const target = simplify(instrument);
  const hit = snapshot.mf_funds.find((f) => {
    const name = simplify(f.fund_name ?? "");
    return overlapsName(name, target);
  });
  return hit ?? null;
}

function simplify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function overlapsName(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  // Substring overlap on the longer key segments (drop generic words).
  const stop = new Set(["fund", "limited", "pms", "aif", "pvt", "ltd", "the", "of", "for"]);
  const ka = a.split(" ").filter((w) => !stop.has(w));
  const kb = b.split(" ").filter((w) => !stop.has(w));
  return ka.length >= 2 && kb.length >= 2 && ka.slice(0, 2).join(" ") === kb.slice(0, 2).join(" ");
}

const MF_CURATED_KEYS = [
  "fund_name",
  "sebi_category",
  "AUM (Cr)",
  "TER (%)",
  "1Y",
  "3Y",
  "5Y",
  "Since Inception",
  "Sharpe",
  "Sortino",
  "Volatility",
  "Top 3 %",
  "Top 5 %",
  "Top 10 %",
  "Top 20 %",
  "LargeCap %",
  "MidCap %",
  "SmallCap %",
  "P/E",
  "P/B",
  "Top 5 Holdings (JSON)",
  "Top 5 Sectors (JSON)",
];

function curateMF(row: MutualFundRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of MF_CURATED_KEYS) {
    const v = (row as Record<string, unknown>)[k];
    if (v !== undefined) out[k] = v;
  }
  // Slim rolling_metrics: pick what's useful for performance attribution
  const rm = row.rolling_metrics as Record<string, number | string> | undefined;
  if (rm) {
    out["rolling_metrics"] = {
      rolling_3y_pct_beat_cat: rm.rolling_3y_pct_beat_cat,
      rolling_3y_avg_excess: rm.rolling_3y_avg_excess,
      rolling_5y_pct_beat_cat: rm.rolling_5y_pct_beat_cat,
      rolling_5y_avg_excess: rm.rolling_5y_avg_excess,
      alpha_trend_direction: rm.alpha_trend_direction,
      regime_stability: rm.regime_stability,
      max_drawdown: rm.max_drawdown,
      max_dd_recovery_months: rm.max_dd_recovery_months,
      upside_capture_3y: rm.upside_capture_3y,
      downside_capture_3y: rm.downside_capture_3y,
    };
  }
  return out;
}

export function buildWrapperScope(
  holdings: StructuredHoldings,
  snapshot: Snapshot,
): WrapperRow[] {
  const out: WrapperRow[] = [];
  for (const h of holdings.holdings) {
    if (h.subCategory.startsWith("pms_")) {
      out.push({
        instrument: h.instrument,
        wrapper_type: "PMS",
        sub_category: h.subCategory,
        weight_pct: h.weightPct,
        value_cr: h.valueCr,
        snapshot_record: findPMS(snapshot, h.instrument) as Record<string, unknown> | null,
      });
    } else if (h.subCategory.startsWith("aif_")) {
      out.push({
        instrument: h.instrument,
        wrapper_type: "AIF",
        sub_category: h.subCategory,
        weight_pct: h.weightPct,
        value_cr: h.valueCr,
        snapshot_record: findAIF(snapshot, h.instrument) as Record<string, unknown> | null,
      });
    }
  }
  return out;
}

export function buildMutualFundScope(
  holdings: StructuredHoldings,
  snapshot: Snapshot,
): MutualFundScopeRow[] {
  const out: MutualFundScopeRow[] = [];
  for (const h of holdings.holdings) {
    if (!h.subCategory.startsWith("mf_")) continue;
    const row = findMF(snapshot, h.instrument);
    out.push({
      instrument: h.instrument,
      sub_category: h.subCategory,
      weight_pct: h.weightPct,
      value_cr: h.valueCr,
      snapshot_curated: row ? curateMF(row) : null,
    });
  }
  return out;
}
