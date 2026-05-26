/* Portfolio Overlap, the pairwise concentration-evidence layer.
 *
 * Placement: ADR-0030 (sibling to risk-reward-stats and time-series-performance).
 * Deterministic, single-snapshot, synchronous. Ships data only
 * (content.portfolio_overlap); S1 does not read it (WA9), following
 * risk-reward's S1-bypass precedent (ADR-0021), not time-series's
 * StitchedContext threading (ADR-0029).
 *
 * Three resolution layers (ADR-0030, amended), most specific first; each
 * emitted pair reports the finest layer BOTH sides support:
 *   Layer 1 "stock_level"           — disclosed top holdings from three sources
 *                                     normalized to {name, weight_fraction}:
 *                                     MF "Top 5 Holdings (JSON)", PMS
 *                                     portfolio_composition.top_holdings, and
 *                                     direct listed stocks (the holding itself).
 *                                     Metric family: min-weight intersection,
 *                                     sum of min(w_a, w_b) over shared names.
 *                                     This is a LOWER BOUND on true overlap
 *                                     because fund disclosure is top-5 only.
 *   Layer 2 "structural_similarity" — cap-split vectors (Large/Mid/Small %).
 *                                     Named "similarity" not "overlap": it
 *                                     compares structure, not holdings.
 *                                     Metric family: 1 - (L1 distance / 2)
 *                                     over cap vectors each normalized to 1.
 *   Layer 3 "categorical"           — sub-category / asset-class match. Always
 *                                     available. Discrete {same sub_cat = 1,
 *                                     same asset class = 0.5, else 0}.
 *
 * Scores are interpreted RELATIVE TO resolution_layer and are not directly
 * comparable across layers. No verdict layer at any level (P3a/P3b split in
 * P3; ADR-0030 "no verdict layer" decision): output is descriptive evidence,
 * interpretation lives in a future workstream.
 *
 * Pairs are formed WITHIN sleeves (asset class); cross-sleeve pairs are
 * categorically ~0 (different asset class) and are omitted as noise. Disclosure
 * lookup reuses buildMutualFundScope / buildWrapperScope (the vetted snapshot
 * name-matching, ADR-0024/0026), so this agent does not re-coin fund/wrapper
 * resolution.
 *
 * Sibling-shape parity with risk-reward-stats.ts: a pure Layer-1
 * (computePortfolioOverlap), a templated descriptive rollup, and a
 * { per_pair, per_sleeve, portfolio, rollup, reasoning_summary } output.
 */

import type { Snapshot } from "./snapshot-loader";
import type { StructuredHoldings, Holding, AssetClass } from "@/db/fixtures/structured-holdings";
import type { EvidenceSentinel } from "./case/sentinels";
import { buildMutualFundScope, buildWrapperScope } from "./wrapper-scope";

/* ----- Output shape (mirrors RiskRewardOutput / TimeSeriesPerformanceOutput) ----- */

export type OverlapResolutionLayer = "stock_level" | "structural_similarity" | "categorical";

export type DisclosedHolding = { name: string; weight_fraction: number };

export type HoldingPairOverlap = {
  holding_a: string;
  holding_b: string;
  asset_class: AssetClass; // pairs are within-sleeve, so both share this
  sub_category_a: string;
  sub_category_b: string;
  weight_pct_a: number;
  weight_pct_b: number;
  resolution_layer: OverlapResolutionLayer;
  score: number; // 0..1, interpreted relative to resolution_layer
  shared_holdings: string[] | null; // stock_level only
  shared_holding_count: number | null; // stock_level only
  /* "opaque_wrapper" when an opaque side (AIF, or undisclosed PMS) blocked a
   * finer layer and the pair fell to categorical; null otherwise. The pair
   * still carries a categorical score, so this annotates rather than voids. */
  limited_by: EvidenceSentinel | null;
};

export type SleeveOverlap = {
  sleeve: AssetClass;
  holding_count: number;
  pair_count: number;
  /* "single_holding_sleeve_overlap" when the sleeve has fewer than two
   * holdings (no intra-sleeve pair to compare); scores are null in that case. */
  sentinel: EvidenceSentinel | null;
  mean_score: number | null;
  max_score: number | null;
  max_pair: [string, string] | null;
  layer_breakdown: Record<OverlapResolutionLayer, number>;
};

export type PortfolioOverlapSummary = {
  total_holdings: number;
  evaluated_pair_count: number;
  layer_breakdown: Record<OverlapResolutionLayer, number>;
  strongest_pair: {
    holding_a: string;
    holding_b: string;
    sleeve: AssetClass;
    score: number;
    resolution_layer: OverlapResolutionLayer;
  } | null;
  /* "insufficient_overlap_coverage" when no within-sleeve pair exists at all
   * (every sleeve has <2 holdings). Defensive; honest "nothing to compare". */
  sentinel: EvidenceSentinel | null;
};

export type OverlapRollup = { text: string; generation_method: "templated" };

export type PortfolioOverlapOutput = {
  agent_id: "portfolio_overlap";
  case_id: string;
  as_of_date: string;
  per_pair: HoldingPairOverlap[];
  per_sleeve: SleeveOverlap[];
  portfolio: PortfolioOverlapSummary;
  rollup: OverlapRollup;
  reasoning_summary: string;
};

export type PortfolioOverlapInput = {
  caseId: string;
  asOfDate: string;
  holdings: StructuredHoldings;
  snapshot: Snapshot;
  investor: { riskAppetite?: string; liquidityTier?: string };
};

/* ----- Per-holding disclosure profile (the evaluable surface for each holding) ----- */

type CapSplit = { large: number; mid: number; small: number };

type HoldingDisclosure = {
  holding: Holding;
  /* Disclosed stock-level holdings (MF top-5, PMS top_holdings, or the direct
   * stock itself), normalized to fractions. null when no stock disclosure. */
  stock: DisclosedHolding[] | null;
  /* Cap-split vector, pre-normalization (normalized at compare time). null
   * when no cap-split disclosure. */
  cap: CapSplit | null;
  /* AIF, or PMS with neither holdings nor cap-split disclosed. Categorical-only,
   * and flagged so pairs involving it record why they could not resolve finer. */
  opaque: boolean;
};

function zeroLayerBreakdown(): Record<OverlapResolutionLayer, number> {
  return { stock_level: 0, structural_similarity: 0, categorical: 0 };
}

function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

/* Conservative stock-name normalizer for cross-source name matching: MF top-5
 * ("ICICI Bank Limited"), PMS top_holdings ("HDFC Bank Ltd"), and direct
 * holdings ("HDFC Bank") must collapse to the same key. Strips punctuation and
 * the common corporate-form suffixes only; deliberately does not strip
 * descriptive tokens (Industries, Motors, Laboratories) to avoid over-merging. */
function normStockName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,&()/'\-]+/g, " ")
    .replace(/\b(ltd|limited|co|corp|corporation|company)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* MF "Top 5 Holdings (JSON)" is a JSON-encoded string in older snapshots and a
 * parsed array in the enriched suite; PMS top_holdings is always an array.
 * Both carry weight_pct in percent (0-100). Returns null on any malformed or
 * empty input rather than throwing (the agent degrades, never fails the case). */
function parseDisclosedHoldings(raw: unknown): DisclosedHolding[] | null {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const out: DisclosedHolding[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as { name?: unknown; weight_pct?: unknown };
    if (typeof o.name !== "string") continue;
    const wp = typeof o.weight_pct === "number" ? o.weight_pct : null;
    out.push({ name: o.name, weight_fraction: wp != null ? wp / 100 : 0 });
  }
  return out.length > 0 ? out : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/* Build the per-holding disclosure map. MF and wrapper records are resolved
 * through the existing scope builders (reusing their snapshot name-matching);
 * direct listed stocks and everything else are handled from the holding. */
function buildDisclosureMap(holdings: StructuredHoldings, snapshot: Snapshot): Map<string, HoldingDisclosure> {
  const mfScope = buildMutualFundScope(holdings, snapshot);
  const wrapperScope = buildWrapperScope(holdings, snapshot);
  const mfByInstrument = new Map(mfScope.map((r) => [r.instrument, r.snapshot_curated]));
  const wrapperByInstrument = new Map(wrapperScope.map((r) => [r.instrument, r]));

  const map = new Map<string, HoldingDisclosure>();

  for (const h of holdings.holdings) {
    const sub = h.subCategory;
    let stock: DisclosedHolding[] | null = null;
    let cap: CapSplit | null = null;
    let opaque = false;

    if (sub.startsWith("mf_")) {
      const curated = mfByInstrument.get(h.instrument);
      if (curated) {
        stock = parseDisclosedHoldings((curated as Record<string, unknown>)["Top 5 Holdings (JSON)"]);
        const lg = num((curated as Record<string, unknown>)["LargeCap %"]);
        const md = num((curated as Record<string, unknown>)["MidCap %"]);
        const sm = num((curated as Record<string, unknown>)["SmallCap %"]);
        if (lg != null || md != null || sm != null) {
          cap = { large: lg ?? 0, mid: md ?? 0, small: sm ?? 0 };
        }
      }
    } else if (sub.startsWith("pms_")) {
      const row = wrapperByInstrument.get(h.instrument);
      const rec = row?.snapshot_record as Record<string, unknown> | null | undefined;
      const pc = rec?.portfolio_composition as Record<string, unknown> | undefined;
      if (pc) {
        if (pc.holdings_disclosed === true) {
          stock = parseDisclosedHoldings(pc.top_holdings);
        }
        if (pc.cap_split_disclosed === true && typeof pc.cap_split === "object" && pc.cap_split !== null) {
          const cs = pc.cap_split as Record<string, unknown>;
          const lg = num(cs.large_cap_pct);
          const md = num(cs.mid_cap_pct);
          const sm = num(cs.small_cap_pct);
          if (lg != null || md != null || sm != null) {
            // PMS cap_split is in percent (0-100); normalizeCap rescales anyway.
            cap = { large: lg ?? 0, mid: md ?? 0, small: sm ?? 0 };
          }
        }
      }
      // PMS with neither holdings nor cap-split disclosed is opaque.
      opaque = stock === null && cap === null;
    } else if (sub.startsWith("aif_")) {
      // AIFs carry no holdings disclosure at any granularity (foundation §3).
      opaque = true;
    } else if (sub === "listed_large_cap") {
      // A direct listed stock is its own single "holding" at full weight, and
      // is large-cap by sub-category definition.
      stock = [{ name: h.instrument, weight_fraction: 1 }];
      cap = { large: 1, mid: 0, small: 0 };
    }
    // intl_*, debt (bank_fd, tax_free_bond, debt MFs that lack disclosure),
    // gold, reit, savings: no stock/cap disclosure -> categorical only.

    map.set(h.instrument, { holding: h, stock, cap, opaque });
  }

  return map;
}

/* ----- Layer metrics ----- */

function normalizeCap(c: CapSplit): CapSplit {
  const s = c.large + c.mid + c.small;
  if (s <= 0) return { large: 0, mid: 0, small: 0 };
  return { large: c.large / s, mid: c.mid / s, small: c.small / s };
}

function stockOverlap(a: DisclosedHolding[], b: DisclosedHolding[]): { score: number; shared: string[] } {
  const bWeight = new Map<string, number>();
  for (const h of b) {
    const k = normStockName(h.name);
    bWeight.set(k, (bWeight.get(k) ?? 0) + h.weight_fraction);
  }
  let score = 0;
  const shared: string[] = [];
  const seen = new Set<string>();
  for (const h of a) {
    const k = normStockName(h.name);
    if (seen.has(k)) continue;
    seen.add(k);
    const bw = bWeight.get(k);
    if (bw != null) {
      score += Math.min(h.weight_fraction, bw);
      shared.push(h.name);
    }
  }
  return { score: round4(score), shared };
}

function capSimilarity(a: CapSplit, b: CapSplit): number {
  const na = normalizeCap(a);
  const nb = normalizeCap(b);
  const l1 = Math.abs(na.large - nb.large) + Math.abs(na.mid - nb.mid) + Math.abs(na.small - nb.small);
  return round4(1 - l1 / 2); // l1 in [0,2]; (l1/2) is normalized distance in [0,1]
}

function categorical(a: Holding, b: Holding): number {
  if (a.subCategory === b.subCategory) return 1;
  if (a.assetClass === b.assetClass) return 0.5;
  return 0;
}

function computePair(da: HoldingDisclosure, db: HoldingDisclosure): {
  resolution_layer: OverlapResolutionLayer;
  score: number;
  shared_holdings: string[] | null;
  shared_holding_count: number | null;
  limited_by: EvidenceSentinel | null;
} {
  // Layer 1: stock-level overlap, when both sides disclose holdings.
  if (da.stock && da.stock.length > 0 && db.stock && db.stock.length > 0) {
    const { score, shared } = stockOverlap(da.stock, db.stock);
    return {
      resolution_layer: "stock_level",
      score,
      shared_holdings: shared,
      shared_holding_count: shared.length,
      limited_by: null,
    };
  }
  // Layer 2: structural similarity, when both sides disclose a cap split.
  if (da.cap && db.cap) {
    return {
      resolution_layer: "structural_similarity",
      score: capSimilarity(da.cap, db.cap),
      shared_holdings: null,
      shared_holding_count: null,
      limited_by: null,
    };
  }
  // Layer 3: categorical (always available).
  const limited_by: EvidenceSentinel | null = da.opaque || db.opaque ? "opaque_wrapper" : null;
  return {
    resolution_layer: "categorical",
    score: categorical(da.holding, db.holding),
    shared_holdings: null,
    shared_holding_count: null,
    limited_by,
  };
}

/* ----- Layer 1 orchestration (pure, deterministic) ----- */

const SLEEVES: AssetClass[] = ["Equity", "Debt", "Alternatives", "Cash"];

export function computePortfolioOverlap(
  input: PortfolioOverlapInput,
): Omit<PortfolioOverlapOutput, "rollup" | "reasoning_summary"> {
  const { holdings, snapshot } = input;
  const disclosure = buildDisclosureMap(holdings, snapshot);

  const per_pair: HoldingPairOverlap[] = [];
  const per_sleeve: SleeveOverlap[] = [];

  for (const sleeve of SLEEVES) {
    const hs = holdings.holdings.filter((h) => h.assetClass === sleeve);
    if (hs.length === 0) continue;

    const layer_breakdown = zeroLayerBreakdown();

    if (hs.length < 2) {
      per_sleeve.push({
        sleeve,
        holding_count: hs.length,
        pair_count: 0,
        sentinel: "single_holding_sleeve_overlap",
        mean_score: null,
        max_score: null,
        max_pair: null,
        layer_breakdown,
      });
      continue;
    }

    const sleeveScores: number[] = [];
    let maxScore = -1;
    let maxPair: [string, string] | null = null;

    for (let i = 0; i < hs.length; i++) {
      for (let j = i + 1; j < hs.length; j++) {
        const a = hs[i];
        const b = hs[j];
        const da = disclosure.get(a.instrument)!;
        const db = disclosure.get(b.instrument)!;
        const r = computePair(da, db);
        layer_breakdown[r.resolution_layer] += 1;
        sleeveScores.push(r.score);
        if (r.score > maxScore) {
          maxScore = r.score;
          maxPair = [a.instrument, b.instrument];
        }
        per_pair.push({
          holding_a: a.instrument,
          holding_b: b.instrument,
          asset_class: sleeve,
          sub_category_a: a.subCategory,
          sub_category_b: b.subCategory,
          weight_pct_a: a.weightPct,
          weight_pct_b: b.weightPct,
          resolution_layer: r.resolution_layer,
          score: r.score,
          shared_holdings: r.shared_holdings,
          shared_holding_count: r.shared_holding_count,
          limited_by: r.limited_by,
        });
      }
    }

    const pairCount = sleeveScores.length;
    const mean = pairCount > 0 ? round4(sleeveScores.reduce((x, y) => x + y, 0) / pairCount) : null;
    per_sleeve.push({
      sleeve,
      holding_count: hs.length,
      pair_count: pairCount,
      sentinel: null,
      mean_score: mean,
      max_score: pairCount > 0 ? round4(maxScore) : null,
      max_pair: maxPair,
      layer_breakdown,
    });
  }

  // Portfolio summary: aggregate layer counts and find the strongest pair.
  const portfolioBreakdown = zeroLayerBreakdown();
  let strongest: PortfolioOverlapSummary["strongest_pair"] = null;
  for (const p of per_pair) {
    portfolioBreakdown[p.resolution_layer] += 1;
    if (strongest === null || p.score > strongest.score) {
      strongest = {
        holding_a: p.holding_a,
        holding_b: p.holding_b,
        sleeve: p.asset_class,
        score: p.score,
        resolution_layer: p.resolution_layer,
      };
    }
  }

  const portfolio: PortfolioOverlapSummary = {
    total_holdings: holdings.holdings.length,
    evaluated_pair_count: per_pair.length,
    layer_breakdown: portfolioBreakdown,
    strongest_pair: strongest,
    sentinel: per_pair.length === 0 ? "insufficient_overlap_coverage" : null,
  };

  return {
    agent_id: "portfolio_overlap",
    case_id: input.caseId,
    as_of_date: input.asOfDate,
    per_pair,
    per_sleeve,
    portfolio,
  };
}

/* ----- Layer 2: templated descriptive rollup (no verdict language) ----- */

const LAYER_LABEL: Record<OverlapResolutionLayer, string> = {
  stock_level: "stock-level",
  structural_similarity: "structural-similarity",
  categorical: "categorical",
};

function fmtScore(x: number): string {
  return x.toFixed(2);
}

export function templatedRollup(
  layer1: Omit<PortfolioOverlapOutput, "rollup" | "reasoning_summary">,
): string {
  const { portfolio } = layer1;
  if (portfolio.evaluated_pair_count === 0) {
    return (
      "No within-sleeve holding pairs are available to compare: each asset-class " +
      "sleeve holds at most one position, so there is no pairwise overlap to compute. " +
      "See the per-sleeve single_holding_sleeve_overlap sentinels."
    );
  }
  const parts: string[] = [];
  const sp = portfolio.strongest_pair;
  if (sp) {
    parts.push(
      `Strongest pairwise signal: ${sp.holding_a} and ${sp.holding_b} ` +
        `(${sp.sleeve} sleeve) at ${fmtScore(sp.score)} on the ${LAYER_LABEL[sp.resolution_layer]} layer.`,
    );
  }
  const lb = portfolio.layer_breakdown;
  parts.push(
    `Across ${portfolio.evaluated_pair_count} within-sleeve pair(s): ` +
      `${lb.stock_level} stock-level, ${lb.structural_similarity} structural-similarity, ` +
      `${lb.categorical} categorical.`,
  );
  if (lb.stock_level === 0) {
    parts.push(
      "No pair resolved at the stock-level layer; the holdings in scope carry no " +
        "overlapping disclosed top-holdings in this snapshot, so signals are " +
        "structural or categorical only.",
    );
  }
  return parts.join(" ");
}

/* ----- Orchestrator (deterministic; no LLM path, WA12) ----- */

export function runPortfolioOverlapDeterministic(input: PortfolioOverlapInput): PortfolioOverlapOutput {
  const layer1 = computePortfolioOverlap(input);
  return {
    ...layer1,
    rollup: {
      text: templatedRollup(layer1),
      generation_method: "templated",
    },
    reasoning_summary:
      "Pairwise overlap is computed within each asset-class sleeve at the finest " +
      "resolution both holdings support: stock-level (min-weight intersection over " +
      "disclosed top holdings), else structural similarity (cap-split distance), else " +
      "categorical (sub-category / asset-class match). Scores are layer-relative and " +
      "not comparable across layers. Stock-level scores are lower bounds because fund " +
      "disclosure is top-5 only. Output is descriptive evidence; no verdict is applied " +
      "(per ADR-0030 and the P3a/P3b split).",
  };
}
