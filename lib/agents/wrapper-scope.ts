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
  const hit = pms.funds.find((p) => overlapsName(p.identity?.fund_name ?? "", instrument));
  return hit ?? null;
}

function findAIF(snapshot: Snapshot, instrument: string): AifRecord | null {
  const aif = snapshot.aif as { "Fund Profiles"?: AifRecord[] } | undefined;
  if (!aif?.["Fund Profiles"]) return null;
  const hit = aif["Fund Profiles"].find((a) => overlapsName(a["Fund Name"] ?? "", instrument));
  return hit ?? null;
}

function findMF(snapshot: Snapshot, instrument: string): MutualFundRow | null {
  const hit = snapshot.mf_funds.find((f) => overlapsName(f.fund_name ?? "", instrument));
  return hit ?? null;
}

function simplify(s: string): string {
  return s.toLowerCase().replace(/[-_,/()]+/g, " ").replace(/\s+/g, " ").trim();
}

const NAME_STOP_WORDS = new Set([
  "fund",
  "limited",
  "ltd",
  "pms",
  "aif",
  "pvt",
  "private",
  "company",
  "the",
  "of",
  "for",
  "and",
  "a",
  "asset",
  "management",
  "amc",
  "growth",
  "regular",
  "direct",
  "plan",
  "option",
  "scheme",
  "co",
  "sun",
  "life",
]);

function distinctiveTokens(name: string): string[] {
  return simplify(name)
    .split(" ")
    .filter((w) => w.length > 1 && !NAME_STOP_WORDS.has(w));
}

/* Tightened after Gate 1 surfaced false-positive matches: require ALL
 * distinctive holding tokens to appear in the snapshot record's name
 * tokens. Prevents "Aditya Birla Arbitrage Fund" matching the first
 * Aditya Birla * row in the snapshot, or "Motilal Oswal Value
 * Migration PMS" matching "Motilal Oswal AMC - Ethical Strategy".
 * Returns true only when the holding's distinctive vocabulary is
 * fully contained in the snapshot name. */
function overlapsName(snapshotName: string, holdingName: string): boolean {
  if (!snapshotName || !holdingName) return false;
  const sn = simplify(snapshotName);
  const hn = simplify(holdingName);
  if (sn === hn || sn.startsWith(hn) || hn.startsWith(sn)) return true;
  const snapshotTokens = new Set(distinctiveTokens(snapshotName));
  const holdingTokens = distinctiveTokens(holdingName);
  if (holdingTokens.length < 2) return false;
  return holdingTokens.every((t) => snapshotTokens.has(t));
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
