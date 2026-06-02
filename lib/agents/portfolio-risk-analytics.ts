/* M0.PortfolioRiskAnalytics, deterministic metrics module.
 *
 * Pure TypeScript, no LLM. Reads the investor's structured holdings, the
 * snapshot's mf_funds rows (for MF look-through), and the foundation's
 * indicative model portfolio constants. Produces a single PortfolioMetrics
 * object that downstream LLM agents reference by field name.
 *
 * The honesty boundary: every value in this object is auditable math.
 * Interpretations (whether HHI 0.27 is "elevated" for this mandate) belong
 * to the LLM layer.
 *
 * Constants are sourced from foundation §2 (model portfolio) and foundation
 * §3 (concentration definitions, liquidity buckets, deployment thresholds).
 */

import type {
  StructuredHoldings,
  Holding,
  SubCategory,
  AssetClass,
} from "@/db/fixtures/structured-holdings";
import type { Mandate } from "@/db/fixtures/structured-mandates";
import { sectorOf } from "@/db/fixtures/sector-map";
import type { Snapshot, MutualFundRow } from "./snapshot-loader";

/* ----- Foundation §2: Indicative model portfolio ----- */

export const MODEL_BANDS: Record<AssetClass, { target: number; min: number; max: number }> = {
  Equity: { target: 65, min: 60, max: 70 },
  Debt: { target: 25, min: 20, max: 30 },
  Alternatives: { target: 7, min: 5, max: 10 },
  Cash: { target: 3, min: 2, max: 5 },
};

/* Per-investor target bands (Finding 5; ADR-0032). The investor's mandate
 * (MANDATES_BY_INVESTOR, serialised to Investor.mandateJson) specifies a
 * tolerance band (min_pct, max_pct) per asset class and, optionally, an
 * explicit target_pct. The target resolves as: explicit target_pct when the
 * band sets one, else the band MIDPOINT. Midpoint is the standard "centre of
 * the tolerance band" reading and reproduces the foundation §2 targets exactly
 * on the standard aggressive Equity (65) and Debt (25) bands; the explicit
 * target_pct exists for the cases where the intended target is asymmetric
 * within the band (a permissive ceiling that should not be read as the target,
 * e.g. Menon's pre-IPO/runway-widened Alternatives and Cash). When no mandate
 * is supplied (or a class is missing from it), the flat MODEL_BANDS is the
 * fallback, so Samriddhi 1 and any unmandated path are unchanged.
 *
 * Cash is NOT a deployment destination (A3 funds the under-target sleeves and
 * lets cash be the residual), so the fact that per-class midpoints do not sum
 * to exactly 100 across a mandate is immaterial here: the target is used as
 * each sleeve's resting target and, for cash, as the dry-powder floor. */
export type ResolvedBand = { target: number; min: number; max: number };

export function resolveTargetBands(mandate: Mandate | null | undefined): Record<AssetClass, ResolvedBand> {
  const out = {} as Record<AssetClass, ResolvedBand>;
  const classes: AssetClass[] = ["Equity", "Debt", "Alternatives", "Cash"];
  for (const cls of classes) {
    const band = mandate?.bands.find((b) => b.asset_class === cls);
    if (band) {
      const target = typeof band.target_pct === "number" ? band.target_pct : round((band.min_pct + band.max_pct) / 2, 2);
      out[cls] = { target, min: band.min_pct, max: band.max_pct };
    } else {
      const m = MODEL_BANDS[cls];
      out[cls] = { target: m.target, min: m.min, max: m.max };
    }
  }
  return out;
}

/* ----- Foundation §3: Concentration thresholds ----- */

export const POSITION_FLAG_PCT = 10;
export const POSITION_ESCALATE_PCT = 15;
export const SECTOR_FLAG_PCT = 25;
export const SECTOR_ESCALATE_PCT = 35;
export const WRAPPER_COUNT_FLAG_PMS = 4;
export const WRAPPER_SHARE_FLAG_PCT = 25;

export const HHI_CEILING_BY_TIER: Record<string, number> = {
  Conservative: 0.20,
  "Moderate-Aggressive": 0.25,
  Aggressive: 0.30,
  "Ultra-Aggressive": 0.35,
};

/* ----- Foundation §3: Liquidity buckets ----- */

export type LiquidityBucket = "T_30" | "T_90" | "T_365" | "Locked";

export const BUCKET_BY_SUBCATEGORY: Record<SubCategory, LiquidityBucket> = {
  // Equity
  mf_active_large_cap: "T_90",
  mf_passive_index: "T_30",
  mf_active_flexi_cap: "T_90",
  mf_active_mid_cap: "T_90",
  mf_active_small_cap: "T_90",
  mf_hybrid_dynamic_aa: "T_90",
  pms_growth_quality: "T_365",
  pms_concentrated_quality: "T_365",
  pms_value: "T_365",
  pms_focused_midcap: "T_365",
  listed_large_cap: "T_30",
  intl_us_etf: "T_30",
  intl_us_individual: "T_30",
  unlisted_family_business: "Locked",
  unlisted_pre_ipo: "Locked",
  // Debt
  bank_fd: "T_365",
  tax_free_bond: "T_90",
  mf_corporate_debt: "T_90",
  mf_short_term_debt: "T_30",
  mf_arbitrage: "T_30",
  // Alternatives
  aif_cat_ii_pe: "Locked",
  aif_cat_ii_real_estate: "Locked",
  aif_cat_ii_private_credit: "T_365",
  aif_cat_iii_long_short: "T_365",
  physical_gold: "T_30",
  sovereign_gold_bond: "T_365",
  reit: "T_30",
  // Cash
  savings: "T_30",
};

const LIQUIDITY_TIER_FLOOR: Record<
  "essential" | "secondary" | "deep",
  { minPct: number; maxPct: number }
> = {
  essential: { minPct: 5, maxPct: 15 },
  secondary: { minPct: 15, maxPct: 30 },
  deep: { minPct: 30, maxPct: 100 },
};

/* ----- Output shape ----- */

export type PortfolioMetrics = {
  totalLiquidAumCr: number;
  holdingsCount: number;

  assetClass: Record<
    AssetClass,
    {
      actualPct: number;
      targetPct: number;
      band: [number, number];
      deviationPct: number;
      inBand: boolean;
    }
  >;

  concentration: {
    hhiHoldingLevel: number;
    hhiAssetClassLevel: number;
    top1: { instrument: string; weightPct: number };
    top5: Array<{ instrument: string; weightPct: number }>;
    bucketCeilingHhi: number;
    bucketTier: string;
    hhiBreach: boolean;

    positionFlags: Array<{
      instrument: string;
      weightPct: number;
      severity: "flag" | "escalate";
    }>;

    wrappers: {
      pmsCount: number;
      pmsAggregatePct: number;
      pmsList: Array<{ instrument: string; weightPct: number }>;
      aifCount: number;
      aifAggregatePct: number;
      aifList: Array<{ instrument: string; weightPct: number }>;
      wrapperCountFlag: boolean;
      wrapperShareFlag: boolean;
    };

    sectorExposureMfLookThrough: Array<{
      sector: string;
      weightPct: number;
      coveredFunds: string[];
    }>;
    mfCoverage: {
      coveredCount: number;
      uncoveredCount: number;
      coveredWeightPct: number;
      uncoveredWeightPct: number;
    };

    /* T-5.16 whole-book look-through (additive; the MF-only fields above stay for
     * A2). Per-stock weight roll-up across direct equity + MF Top 5 Holdings +
     * disclosed PMS top_holdings, and sector roll-up across MF Top 5 Sectors +
     * disclosed PMS top_sectors. Opaque or undisclosed weight is surfaced as a
     * coverage footnote (the D12 honest-degradation pattern), never dropped
     * silently. Ships data and footnote text; render is T-5.09 (WA9). */
    stockExposureLookThrough: Array<{ stock: string; weightPct: number; sources: string[] }>;
    sectorExposureLookThrough: Array<{ sector: string; weightPct: number; sources: string[] }>;
    lookThroughCoverage: {
      stock: { coveredWeightPct: number; uncoveredWeightPct: number; footnote: string | null };
      sector: { coveredWeightPct: number; uncoveredWeightPct: number; footnote: string | null };
    };
  };

  liquidity: {
    bucketBreakdown: Record<LiquidityBucket, number>;
    t30PlusT90Pct: number;
    tier: "essential" | "secondary" | "deep";
    tierFloor: { minPct: number; maxPct: number };
    floorBreach: boolean;
  };

  cashDeployment: {
    cashSharePct: number;
    /* Cash above the model band ceiling (5%) is treated as deployment gap;
     * for aggressive long-term investors this is the cash-drag signal. */
    deploymentGapPct: number;
    cashDragFlag: boolean;
  };

  computedAt: string;
};

/* ----- Helpers ----- */

function isPMS(sub: SubCategory): boolean {
  return sub.startsWith("pms_");
}

function isAIF(sub: SubCategory): boolean {
  return sub.startsWith("aif_");
}

function isMF(sub: SubCategory): boolean {
  return sub.startsWith("mf_");
}

function normaliseTier(raw: string): "essential" | "secondary" | "deep" {
  const s = raw.toLowerCase();
  if (s.includes("essential")) return "essential";
  if (s.includes("secondary")) return "secondary";
  if (s.includes("deep")) return "deep";
  // Default for unrecognised: secondary (middle ground).
  return "secondary";
}

function resolveHhiTier(riskAppetite: string): { tier: string; ceiling: number } {
  const s = riskAppetite.toLowerCase();
  if (s.includes("ultra")) return { tier: "Ultra-Aggressive", ceiling: HHI_CEILING_BY_TIER["Ultra-Aggressive"] };
  if (s.includes("conservative")) return { tier: "Conservative", ceiling: HHI_CEILING_BY_TIER.Conservative };
  if (s.includes("moderate")) return { tier: "Moderate-Aggressive", ceiling: HHI_CEILING_BY_TIER["Moderate-Aggressive"] };
  if (s.includes("aggressive")) return { tier: "Aggressive", ceiling: HHI_CEILING_BY_TIER.Aggressive };
  return { tier: "Aggressive", ceiling: HHI_CEILING_BY_TIER.Aggressive };
}

function findFundInSnapshot(
  snapshot: Snapshot,
  instrument: string,
): MutualFundRow | undefined {
  /* Match by fund_name containing the investor's instrument label. The seed
   * uses the canonical fund name from the foundation tables (e.g.,
   * "Mirae Asset Large Cap Fund"); the snapshot's fund_name may include
   * "Regular Growth" suffix or "Direct Growth". Match the prefix. */
  const target = instrument.toLowerCase();
  return snapshot.mf_funds.find((f) => {
    const name = (f.fund_name ?? "").toLowerCase();
    return name.startsWith(target) || name.includes(target);
  });
}

type Top5SectorRow = { rank: number; sector: string; weight_pct: number };

function parseTopSectors(raw: unknown): Top5SectorRow[] | null {
  if (Array.isArray(raw)) return raw as Top5SectorRow[];
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Top5SectorRow[];
    } catch {
      return null;
    }
  }
  return null;
}

/* ----- T-5.16 look-through helpers ----- */

type Top5HoldingRow = { rank?: number; name: string; weight_pct: number };

function parseTopHoldings(raw: unknown): Top5HoldingRow[] | null {
  if (Array.isArray(raw)) return raw as Top5HoldingRow[];
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as Top5HoldingRow[]; } catch { return null; }
  }
  return null;
}

type PmsRecord = {
  identity?: { fund_name?: string };
  fund_name?: string;
  portfolio_composition?: {
    holdings_disclosed?: boolean;
    sectors_disclosed?: boolean;
    top_holdings?: Array<{ name: string; weight_pct: number }>;
    top_sectors?: Array<{ name: string; weight_pct: number }>;
  };
};

function normPms(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* Match a held PMS to its snapshot record by normalised-name overlap (the seed
 * names and the snapshot's full legal names diverge, P40). An unmatched PMS
 * stays uncovered (the coverage footnote), never silently dropped. */
function findPmsInSnapshot(snapshot: Snapshot, instrument: string): PmsRecord | undefined {
  const funds = ((snapshot.pms as { funds?: PmsRecord[] })?.funds) ?? [];
  const t = normPms(instrument);
  if (!t) return undefined;
  // Strongest signal: a shared distinctive token (the manager/strategy name).
  const tokens = instrument.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 5 && w !== "fund" && w !== "strategy");
  return funds.find((p) => {
    const n = normPms(p.identity?.fund_name ?? p.fund_name ?? "");
    if (n.length === 0) return false;
    if (n.includes(t) || t.includes(n)) return true;
    return tokens.some((tok) => n.includes(tok));
  });
}

/* ----- Main computation ----- */

export function computeMetrics(
  holdings: StructuredHoldings,
  snapshot: Snapshot,
  investor: { riskAppetite: string; liquidityTier: string },
  mandate?: Mandate | null,
): PortfolioMetrics {
  const total = holdings.totalLiquidAumCr;
  const wrapperAggregated = aggregateWrappers(holdings.holdings);

  /* Finding 5: the asset-class targets and bands A3 reasons against come from
   * the investor's mandate (per-investor), falling back to the flat
   * MODEL_BANDS when no mandate is supplied. */
  const bands = resolveTargetBands(mandate);

  // Asset-class weights
  const assetClassSum: Record<AssetClass, number> = {
    Equity: 0,
    Debt: 0,
    Alternatives: 0,
    Cash: 0,
  };
  for (const h of holdings.holdings) {
    assetClassSum[h.assetClass] += h.weightPct;
  }

  const assetClass: PortfolioMetrics["assetClass"] = {
    Equity: buildAssetClassBlock("Equity", assetClassSum.Equity, bands),
    Debt: buildAssetClassBlock("Debt", assetClassSum.Debt, bands),
    Alternatives: buildAssetClassBlock("Alternatives", assetClassSum.Alternatives, bands),
    Cash: buildAssetClassBlock("Cash", assetClassSum.Cash, bands),
  };

  // HHI at holding level (wrapper-aggregated positions)
  const hhiHoldingLevel = wrapperAggregated.reduce(
    (sum, p) => sum + Math.pow(p.weightPct / 100, 2),
    0,
  );

  // HHI at asset-class level (informational only per foundation §3)
  const hhiAssetClassLevel =
    Math.pow(assetClassSum.Equity / 100, 2) +
    Math.pow(assetClassSum.Debt / 100, 2) +
    Math.pow(assetClassSum.Alternatives / 100, 2) +
    Math.pow(assetClassSum.Cash / 100, 2);

  // Top-1 and top-5 (wrapper-aggregated)
  const sortedByWeight = [...wrapperAggregated].sort((a, b) => b.weightPct - a.weightPct);
  const top1 = sortedByWeight[0] ?? { instrument: "(none)", weightPct: 0 };
  const top5 = sortedByWeight.slice(0, 5);

  // HHI bucket ceiling
  const { tier: bucketTier, ceiling: bucketCeilingHhi } = resolveHhiTier(investor.riskAppetite);
  const hhiBreach = hhiHoldingLevel > bucketCeilingHhi;

  // Position-level threshold flags (against the wrapper-aggregated view;
  // individual PMS instruments above 10% are also flagged because foundation
  // §3 thresholds apply to "any single instrument's share of liquid AUM").
  //
  // Finding 5: cash and cash-equivalents are EXCLUDED. Cash is dry powder, not
  // an idiosyncratic concentration: an 86% savings balance is undeployed
  // capital to be deployed (modelled by cashDeployment below as a gap to fund),
  // not a position to trim toward the 10% ceiling. Excluding the Cash asset
  // class is the clean discriminant (the only Cash sub-category is savings;
  // fixed deposits sit in Debt and are a separate question, product debt P14).
  const positionFlags: PortfolioMetrics["concentration"]["positionFlags"] = [];
  for (const h of holdings.holdings) {
    if (h.assetClass === "Cash") continue;
    if (h.weightPct >= POSITION_ESCALATE_PCT) {
      positionFlags.push({ instrument: h.instrument, weightPct: h.weightPct, severity: "escalate" });
    } else if (h.weightPct >= POSITION_FLAG_PCT) {
      positionFlags.push({ instrument: h.instrument, weightPct: h.weightPct, severity: "flag" });
    }
  }

  // Wrapper composition
  const pmsList = holdings.holdings.filter((h) => isPMS(h.subCategory)).map((h) => ({
    instrument: h.instrument,
    weightPct: h.weightPct,
  }));
  const aifList = holdings.holdings.filter((h) => isAIF(h.subCategory)).map((h) => ({
    instrument: h.instrument,
    weightPct: h.weightPct,
  }));
  const pmsAggregatePct = pmsList.reduce((s, p) => s + p.weightPct, 0);
  const aifAggregatePct = aifList.reduce((s, p) => s + p.weightPct, 0);

  // Liquidity buckets
  const bucketBreakdown: Record<LiquidityBucket, number> = { T_30: 0, T_90: 0, T_365: 0, Locked: 0 };
  for (const h of holdings.holdings) {
    const bucket = BUCKET_BY_SUBCATEGORY[h.subCategory];
    if (bucket) bucketBreakdown[bucket] += h.weightPct;
  }
  const t30PlusT90Pct = bucketBreakdown.T_30 + bucketBreakdown.T_90;
  const tier = normaliseTier(investor.liquidityTier);
  const tierFloor = LIQUIDITY_TIER_FLOOR[tier];
  const floorBreach = t30PlusT90Pct < tierFloor.minPct;

  // Cash deployment
  const cashSharePct = assetClassSum.Cash;
  const deploymentGapPct = Math.max(0, cashSharePct - MODEL_BANDS.Cash.max);
  const cashDragFlag = deploymentGapPct > 0;

  // MF look-through sector exposure
  const sectorAcc: Map<string, { weightPct: number; coveredFunds: Set<string> }> = new Map();
  let coveredCount = 0;
  let uncoveredCount = 0;
  let coveredWeightPct = 0;
  let uncoveredWeightPct = 0;

  for (const h of holdings.holdings) {
    if (!isMF(h.subCategory)) continue;
    const fund = findFundInSnapshot(snapshot, h.instrument);
    if (!fund) {
      // Not found in snapshot; treat as uncovered.
      uncoveredCount += 1;
      uncoveredWeightPct += h.weightPct;
      continue;
    }
    const sectors = parseTopSectors(fund["Top 5 Sectors (JSON)"]);
    if (!sectors || sectors.length === 0) {
      uncoveredCount += 1;
      uncoveredWeightPct += h.weightPct;
      continue;
    }
    coveredCount += 1;
    coveredWeightPct += h.weightPct;
    for (const s of sectors) {
      const contribution = (h.weightPct * s.weight_pct) / 100;
      const entry = sectorAcc.get(s.sector) ?? { weightPct: 0, coveredFunds: new Set<string>() };
      entry.weightPct += contribution;
      entry.coveredFunds.add(h.instrument);
      sectorAcc.set(s.sector, entry);
    }
  }

  const sectorExposureMfLookThrough = Array.from(sectorAcc.entries())
    .map(([sector, v]) => ({
      sector,
      weightPct: round(v.weightPct, 2),
      coveredFunds: Array.from(v.coveredFunds),
    }))
    .sort((a, b) => b.weightPct - a.weightPct);

  /* ----- T-5.16: whole-book per-stock + sector look-through with honest coverage.
   * Per axis (stock, sector) each equity-exposed holding is counted once as
   * covered or uncovered; debt / cash / gold / FD carry no equity underlying and
   * are out of the look-through scope. Direct equity is stock-covered but
   * sector-uncovered (the snapshot has no per-stock sector / sector_map). ----- */
  const stockAcc = new Map<string, { weightPct: number; sources: Set<string> }>();
  const sectorAccAll = new Map<string, { weightPct: number; sources: Set<string> }>();
  let stCovered = 0, stUncovered = 0, secCovered = 0, secUncovered = 0;
  const addStock = (name: string, w: number, src: string) => {
    const e = stockAcc.get(name) ?? { weightPct: 0, sources: new Set<string>() };
    e.weightPct += w; e.sources.add(src); stockAcc.set(name, e);
  };
  const addSector = (sector: string, w: number, src: string) => {
    const e = sectorAccAll.get(sector) ?? { weightPct: 0, sources: new Set<string>() };
    e.weightPct += w; e.sources.add(src); sectorAccAll.set(sector, e);
  };
  for (const h of holdings.holdings) {
    const w = h.weightPct;
    if (h.assetClass === "Equity") {
      if (h.subCategory.startsWith("listed_")) {
        addStock(h.instrument, w, "direct"); stCovered += w;
        // Direct-equity sector via the sector_map (T-5.14 Phase 4); unmapped names
        // (e.g. international/unlisted listed_ names) degrade honestly to uncovered.
        const sec = sectorOf(h.instrument);
        if (sec) { addSector(sec.sector, w, "direct"); secCovered += w; }
        else secUncovered += w;
        continue;
      }
      if (isMF(h.subCategory)) {
        // Equity-classed MF (incl. hybrids): roll up its equity Top 5 Holdings / Sectors.
        const fund = findFundInSnapshot(snapshot, h.instrument);
        const hr = fund ? parseTopHoldings(fund["Top 5 Holdings (JSON)"]) : null;
        const sr = fund ? parseTopSectors(fund["Top 5 Sectors (JSON)"]) : null;
        if (hr && hr.length) { for (const r of hr) addStock(r.name, (w * r.weight_pct) / 100, "mf"); stCovered += w; } else stUncovered += w;
        if (sr && sr.length) { for (const s of sr) addSector(s.sector, (w * s.weight_pct) / 100, "mf"); secCovered += w; } else secUncovered += w;
        continue;
      }
      if (isPMS(h.subCategory)) {
        const pc = findPmsInSnapshot(snapshot, h.instrument)?.portfolio_composition;
        const ph = pc?.holdings_disclosed ? pc.top_holdings : null;
        const ps = pc?.sectors_disclosed ? pc.top_sectors : null;
        if (ph && ph.length) { for (const r of ph) addStock(r.name, (w * r.weight_pct) / 100, "pms"); stCovered += w; } else stUncovered += w;
        if (ps && ps.length) { for (const s of ps) addSector(s.name, (w * s.weight_pct) / 100, "pms"); secCovered += w; } else secUncovered += w;
        continue;
      }
      // International or unlisted equity: equity-exposed but the underlying is not
      // in the snapshot, so it cannot be looked through (uncovered, not dropped).
      stUncovered += w; secUncovered += w;
      continue;
    }
    if (isAIF(h.subCategory)) { stUncovered += w; secUncovered += w; continue; } // opaque alternatives wrapper
    // Debt / Cash / gold / FD: no equity underlying, out of look-through scope.
  }
  const stockExposureLookThrough = Array.from(stockAcc.entries())
    .map(([stock, v]) => ({ stock, weightPct: round(v.weightPct, 2), sources: Array.from(v.sources) }))
    .sort((a, b) => b.weightPct - a.weightPct);
  const sectorExposureLookThrough = Array.from(sectorAccAll.entries())
    .map(([sector, v]) => ({ sector, weightPct: round(v.weightPct, 2), sources: Array.from(v.sources) }))
    .sort((a, b) => b.weightPct - a.weightPct);
  const stockFootnote = stUncovered > 0
    ? `Per-stock roll-up covers ${round(stCovered, 1)}% of portfolio weight; ${round(stUncovered, 1)}% is not looked through (opaque AIF, undisclosed or unmatched PMS, or funds with no disclosed holdings).`
    : null;
  const sectorFootnote = secUncovered > 0
    ? `Sector look-through covers ${round(secCovered, 1)}% of portfolio weight; ${round(secUncovered, 1)}% is uncovered (unmapped or international direct equity, opaque AIF, and undisclosed PMS are not seen through).`
    : null;

  return {
    totalLiquidAumCr: total,
    holdingsCount: holdings.holdings.length,
    assetClass,
    concentration: {
      hhiHoldingLevel: round(hhiHoldingLevel, 4),
      hhiAssetClassLevel: round(hhiAssetClassLevel, 4),
      top1: { instrument: top1.instrument, weightPct: round(top1.weightPct, 2) },
      top5: top5.map((t) => ({ instrument: t.instrument, weightPct: round(t.weightPct, 2) })),
      bucketCeilingHhi,
      bucketTier,
      hhiBreach,
      positionFlags,
      wrappers: {
        pmsCount: pmsList.length,
        pmsAggregatePct: round(pmsAggregatePct, 2),
        pmsList,
        aifCount: aifList.length,
        aifAggregatePct: round(aifAggregatePct, 2),
        aifList,
        wrapperCountFlag: pmsList.length >= WRAPPER_COUNT_FLAG_PMS,
        wrapperShareFlag: pmsAggregatePct > WRAPPER_SHARE_FLAG_PCT || aifAggregatePct > WRAPPER_SHARE_FLAG_PCT,
      },
      sectorExposureMfLookThrough,
      mfCoverage: {
        coveredCount,
        uncoveredCount,
        coveredWeightPct: round(coveredWeightPct, 2),
        uncoveredWeightPct: round(uncoveredWeightPct, 2),
      },
      stockExposureLookThrough,
      sectorExposureLookThrough,
      lookThroughCoverage: {
        stock: { coveredWeightPct: round(stCovered, 2), uncoveredWeightPct: round(stUncovered, 2), footnote: stockFootnote },
        sector: { coveredWeightPct: round(secCovered, 2), uncoveredWeightPct: round(secUncovered, 2), footnote: sectorFootnote },
      },
    },
    liquidity: {
      bucketBreakdown: {
        T_30: round(bucketBreakdown.T_30, 2),
        T_90: round(bucketBreakdown.T_90, 2),
        T_365: round(bucketBreakdown.T_365, 2),
        Locked: round(bucketBreakdown.Locked, 2),
      },
      t30PlusT90Pct: round(t30PlusT90Pct, 2),
      tier,
      tierFloor,
      floorBreach,
    },
    cashDeployment: {
      cashSharePct: round(cashSharePct, 2),
      deploymentGapPct: round(deploymentGapPct, 2),
      cashDragFlag,
    },
    computedAt: new Date().toISOString(),
  };
}

/* ----- Internal helpers ----- */

function buildAssetClassBlock(cls: AssetClass, actualPct: number, bands: Record<AssetClass, ResolvedBand>) {
  const b = bands[cls];
  const deviationPct = actualPct - b.target;
  const inBand = actualPct >= b.min && actualPct <= b.max;
  return {
    actualPct: round(actualPct, 2),
    targetPct: b.target,
    band: [b.min, b.max] as [number, number],
    deviationPct: round(deviationPct, 2),
    inBand,
  };
}

function aggregateWrappers(holdings: Holding[]): Array<{ instrument: string; weightPct: number }> {
  /* Foundation §3: HHI at holding level uses wrapper-level aggregation
   * (PMS aggregate, AIF aggregate). Other instruments stay as themselves. */
  const out: Array<{ instrument: string; weightPct: number }> = [];
  let pmsSum = 0;
  let aifSum = 0;
  for (const h of holdings) {
    if (isPMS(h.subCategory)) {
      pmsSum += h.weightPct;
    } else if (isAIF(h.subCategory)) {
      aifSum += h.weightPct;
    } else {
      out.push({ instrument: h.instrument, weightPct: h.weightPct });
    }
  }
  if (pmsSum > 0) out.push({ instrument: "PMS aggregate", weightPct: pmsSum });
  if (aifSum > 0) out.push({ instrument: "AIF aggregate", weightPct: aifSum });
  return out;
}

function round(n: number, places: number): number {
  const factor = Math.pow(10, places);
  return Math.round(n * factor) / factor;
}
