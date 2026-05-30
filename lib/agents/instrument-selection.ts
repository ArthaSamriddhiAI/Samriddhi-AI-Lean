/* Instrument-selection funnel (T-5.12 Finding 1).
 *
 * Deterministic funnel that fills an under-target sleeve with specific
 * candidate instruments. The funnel decides; the LLM (in A3's narration) only
 * articulates the deterministic pick citing the computed metrics; the advisor
 * owns the decision. Nothing here calls an LLM (the bounded-inference fallback
 * for a composition-missing flexi is DEFERRED, ADR-0038; the reachable fallback
 * is the deterministic decline below).
 *
 * The selection mechanics (eligibility, lexicographic ranking, shortlist,
 * cadence, top-up) are ADR-0034. The allocation framework it fills is the
 * model-portfolio foundation slice: equity two-level (ADR-0033 + ADR-0035 flexi
 * look-through + ADR-0036 international), debt 2D credit-by-duration (ADR-0037).
 * Every numeric parameter is named and tunable; the "why these values" is in the
 * ADRs.
 *
 * Classification is data-driven: an instrument's sleeve and its credit/duration
 * placement come from its data (strategy_type, sebi_category, the per-fund
 * Duration / AAA% metrics), never from a wrapper-type assumption.
 */

import type { Snapshot, MutualFundRow } from "./snapshot-loader";
import type { StructuredHoldings, Holding } from "@/db/fixtures/structured-holdings";
import type { EquitySplit, DebtCreditSplit, DurationBucket, SubSleeveTilt } from "@/db/fixtures/structured-mandates";
import { EQUITY_SPLIT_BY_TIER, DEBT_CREDIT_SPLIT_BY_TIER, durationForHorizon } from "@/db/fixtures/structured-mandates";
import { strictNameMatch } from "./operational-scope";

/* ----- Tunable parameters (the "why these values" is in ADR-0034 / ADR-0037) ----- */

export const SELECTION_PARAMS = {
  /** Viable-AUM floor (Cr). Drops sub-scale funds (ADR-0034). */
  MIN_AUM_CR: 500,
  /** Sufficient track record (years), matches the 3-year ranking horizon. */
  MIN_TRACK_RECORD_YEARS: 3,
  /** Quality-gate cutoff on the risk-adjusted composite. */
  QUALITY_GATE: "top_half" as "top_half" | "top_tercile",
  SHORTLIST_SURFACE: 3,
  SHORTLIST_INTERNAL: 5,
  CADENCE_WINDOW_DAYS: 14,
  CADENCE_STAGE_THRESHOLD_CR: 2,
  CADENCE_PER_TRANCHE_CR: 1.5,
  CADENCE_MAX_TRANCHES: 4,
  /** Duration cutoffs (years), ADR-0037 A1: short < 3, medium 3 to 5, long > 5. */
  DURATION_SHORT_MAX_Y: 3,
  DURATION_LONG_MIN_Y: 5,
  /** High-grade cutoff, ADR-0037 A2: a duration-category fund with SOV% + AAA% at
   * or above this is high-grade; below it leans credit-risk. 70 not 80 because
   * AAA% excludes AA+ (which SEBI counts as high-grade), see ADR-0037. */
  AAA_HIGH_GRADE_MIN_PCT: 70,
  /** Sovereign cutoff, ADR-0037 A2 (SOV-aware): a duration-category fund with
   * SOV% at or above this is sovereign. 80 mirrors the gilt SOV% profile (gilts
   * read 93 to 95). Sovereign paper is at least as safe as AAA, so SOV% counts
   * toward the safety read; an AAA-only test mis-filed sovereign-heavy funds as
   * credit-risk (the ABSL/HDFC Income mis-pick). See ADR-0037. */
  SOV_SOVEREIGN_MIN_PCT: 80,
} as const;

/* ----- Category sets ----- */

const GOLD_CATEGORIES = ["ETFs- Commodity"];
const INTERNATIONAL_CATEGORIES = ["FoFs Overseas", "ETFs- Global", "Sectoral- Foreign Equity"];
const CAP_CATEGORY = { large: "Large Cap Fund", mid: "Mid Cap Fund", small: "Small Cap Fund" } as const;
const FLEXI_CATEGORIES = ["Flexi Cap Fund", "Multi Cap Fund", "Focused Fund"];
/* Hybrid categories (L2): a hybrid holds debt alongside equity, so its
 * non-domestic-non-cash residual is DEBT, not international (see decomposeHeldEquity). */
const HYBRID_CATEGORIES = ["Dynamic Asset Allocation or Bal", "Balanced Advantage Fund", "Aggressive Hybrid Fund", "Conservative Hybrid Fund", "Equity Savings", "Multi Asset Allocation", "Balanced Hybrid Fund"];
/* C1 (ADR-0033): the diversified-equity candidate set extends the flexi/multi
 * treatment to the other multi-exposure, not-pure-cap equity categories the
 * classification audit surfaced (Large & Mid spans buckets like a flexi; ELSS /
 * Value / Contra / Dividend Yield are cap-agnostic diversified equity). Offered
 * as distinct diversified candidates and top-up-eligible, NOT decomposed into the
 * pure-cap ranking pools (the lexicographic comparison stays apples-to-apples). */
const DIVERSIFIED_EQUITY_CATEGORIES = [...FLEXI_CATEGORIES, "Large & Mid Cap Fund", "ELSS", "Value Fund", "Contra Fund", "Dividend Yield Fund"];
const GILT_CATEGORIES = ["Gilt Fund", "Gilt Fund with 10 year Constant"];
const HIGH_GRADE_CREDIT_CATEGORIES = ["Corporate Bond Fund", "Banking and PSU Fund"];
const CREDIT_RISK_CATEGORIES = ["Credit Risk Fund"];
const DEBT_DURATION_CATEGORIES = ["Short Duration Fund", "Medium Duration Fund", "Medium to Long Duration Fund", "Long Duration Fund"];
/* The debt 2D credit-by-duration universe (ADR-0037): the credit-determinable
 * categories only, the credit-defined ones (Gilt, Corporate Bond, Banking & PSU,
 * Credit Risk) plus the duration-ladder ones whose credit reads from AAA%
 * (Short/Medium/Medium-to-Long/Long Duration). Passive and credit-indeterminate
 * categories are EXCLUDED: a Debt Index or ETF-Debt fund tracks an unknown index
 * and carries no AAA% reading, so a gilt-index ETF would otherwise misclassify as
 * credit-risk; Dynamic Bond spans credit by design; the ultra-short family
 * (Liquid/Overnight/Money Market/Ultra Short/Low Duration) is cash-adjacent, not
 * a duration-tilt bucket. Excluding them avoids a misclassification rather than
 * guessing a credit a passive fund does not disclose. */
const DEBT_2D_CATEGORIES = new Set([...GILT_CATEGORIES, ...HIGH_GRADE_CREDIT_CATEGORIES, ...CREDIT_RISK_CATEGORIES, ...DEBT_DURATION_CATEGORIES]);

/* ----- The resolved per-investor framework ----- */

export type SubSleeveFramework = {
  equity: EquitySplit;
  debt_credit: DebtCreditSplit;
  debt_duration: DurationBucket;
};

export function resolveFramework(riskTier: string, timeHorizon: string, override?: SubSleeveTilt): SubSleeveFramework {
  const equity = override?.equity ?? EQUITY_SPLIT_BY_TIER[riskTier] ?? EQUITY_SPLIT_BY_TIER.Aggressive;
  const debt_credit = override?.debt_credit ?? DEBT_CREDIT_SPLIT_BY_TIER[riskTier] ?? DEBT_CREDIT_SPLIT_BY_TIER.Aggressive;
  return { equity, debt_credit, debt_duration: durationForHorizon(timeHorizon) };
}

/* ----- Data-driven sleeve classification (no wrapper-type hard-code) ----- */

export type Sleeve = "Equity" | "Debt" | "Alternatives";

const EQUITY_CAT_HINTS = ["cap fund", "flexi", "focused", "elss", "value", "contra", "dividend yield", "etfs- equity", "equity index"];
const DEBT_CAT_HINTS = ["bond", "gilt", "duration", "liquid", "money market", "overnight", "credit risk", "banking and psu", "debt index", "etfs- debt", "dynamic bond"];
const ALT_CAT_HINTS = ["commodity", "gold", "silver"];

export function classifyMfSleeve(sebiCategory: string | null | undefined): Sleeve | null {
  const c = (sebiCategory ?? "").toLowerCase();
  if (!c) return null;
  if (ALT_CAT_HINTS.some((h) => c.includes(h))) return "Alternatives";
  if (DEBT_CAT_HINTS.some((h) => c.includes(h))) return "Debt";
  if (EQUITY_CAT_HINTS.some((h) => c.includes(h))) return "Equity";
  return null;
}

/** Classify a PMS by its strategy_type, NOT by the fact it is a PMS. All current
 * snapshot PMS are strategy_type "equity" (so they classify Equity by reading the
 * data); a future debt or long-short PMS classifies correctly. */
export function classifyPmsSleeve(strategyType: string | null | undefined): Sleeve {
  const s = (strategyType ?? "").toLowerCase();
  if (s.includes("debt") || s.includes("fixed income") || s.includes("credit")) return "Debt";
  if (s.includes("long short") || s.includes("long-short") || s.includes("absolute") || s.includes("hedge")) return "Alternatives";
  return "Equity";
}

/* ----- Candidate type ----- */

export type SelectionCandidate = {
  fund_name: string;
  source: "mf";
  sub_category: string;
  ter_pct: number | null;
  aum_cr: number | null;
  age_years: number | null;
  sharpe_3y: number | null;
  sortino_3y: number | null;
  calmar_3y: number | null;
  return_3y: number | null;
  /** Debt 2D (ADR-0037): the per-fund metrics that bridge the mutually-exclusive
   * credit/duration sebi_category, near-complete on eligible debt funds. sov_pct
   * is the sovereign (government-securities) share; the credit read is SOV-aware. */
  duration_y: number | null;
  aaa_pct: number | null;
  sov_pct: number | null;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return null;
}
function round2(n: number): number { return Math.round(n * 100) / 100; }
function round1(n: number): number { return Math.round(n * 10) / 10; }
/** TER and period returns are stored as fractions despite the "(%)" label. */
function pct(v: unknown): number | null { const n = num(v); return n === null ? null : round2(n * 100); }

function mfToCandidate(row: MutualFundRow): SelectionCandidate {
  const tb = (row.tier_b_stats ?? {}) as Record<string, unknown>;
  const r = row as Record<string, unknown>;
  return {
    fund_name: String(row.fund_name ?? ""), source: "mf", sub_category: String(row.sebi_category ?? ""),
    ter_pct: pct(r["TER (%)"]), aum_cr: num(r["AUM (Cr)"]), age_years: num(r["Age (Yrs)"]),
    sharpe_3y: num(tb.sharpe_3y), sortino_3y: num(tb.sortino_3y), calmar_3y: num(tb.calmar_3y),
    return_3y: pct(r["3Y"]), duration_y: num(r["Duration"]), aaa_pct: num(r["AAA %"]), sov_pct: num(r["SOV %"]),
  };
}

function isEligibleMf(c: SelectionCandidate): boolean {
  return (
    c.aum_cr !== null && c.aum_cr >= SELECTION_PARAMS.MIN_AUM_CR &&
    c.age_years !== null && c.age_years >= SELECTION_PARAMS.MIN_TRACK_RECORD_YEARS &&
    c.sharpe_3y !== null && c.sortino_3y !== null && c.calmar_3y !== null
  );
}

/* ----- Universe ----- */

export type InstrumentUniverse = {
  /** Eligible candidates keyed by sebi_category (equity caps, debt cats, gold, intl). */
  mf_by_category: Record<string, SelectionCandidate[]>;
  /** All eligible debt funds (for the 2D credit-by-duration placement). */
  debt_funds: SelectionCandidate[];
  /** Held-fund composition lookup: the raw snapshot mf row by fund_name match is
   * resolved at look-through time, so keep the raw equity rows for decomposition. */
  raw_mf: MutualFundRow[];
  raw_pms: Record<string, unknown>[];
  pms_equity_count: number;
  aif_by_sebi: Record<string, number>;
};

export function buildInstrumentUniverse(snapshot: Snapshot): InstrumentUniverse {
  const mf_by_category: Record<string, SelectionCandidate[]> = {};
  const debt_funds: SelectionCandidate[] = [];
  for (const row of snapshot.mf_funds) {
    const cat = String(row.sebi_category ?? "");
    if (!cat) continue;
    const cand = mfToCandidate(row);
    if (!isEligibleMf(cand)) continue;
    (mf_by_category[cat] ??= []).push(cand);
    // The debt 2D pool is the credit-determinable categories only (ADR-0037).
    if (DEBT_2D_CATEGORIES.has(cat)) debt_funds.push(cand);
  }
  const pmsFunds = ((snapshot.pms as { funds?: Record<string, unknown>[] })?.funds) ?? [];
  let pms_equity_count = 0;
  for (const p of pmsFunds) {
    const st = ((p.identity as Record<string, unknown>)?.strategy_type) as string | undefined;
    if (classifyPmsSleeve(st) === "Equity") pms_equity_count += 1;
  }
  const aifProfiles = ((snapshot.aif as { "Fund Profiles"?: Record<string, unknown>[] })?.["Fund Profiles"]) ?? [];
  const aif_by_sebi: Record<string, number> = {};
  for (const a of aifProfiles) {
    const c = String(a["SEBI Category"] ?? "(uncategorised)");
    aif_by_sebi[c] = (aif_by_sebi[c] ?? 0) + 1;
  }
  return { mf_by_category, debt_funds, raw_mf: snapshot.mf_funds, raw_pms: pmsFunds, pms_equity_count, aif_by_sebi };
}

/* ----- Credit + duration bucketing (ADR-0037, category-primary, metric-secondary) ----- */

export type CreditBucket = "sovereign" | "high_grade" | "credit_risk";

export function creditBucketOf(c: SelectionCandidate): CreditBucket {
  const cat = c.sub_category;
  if (GILT_CATEGORIES.includes(cat)) return "sovereign"; // gilts sovereign by category, no metric test
  if (HIGH_GRADE_CREDIT_CATEGORIES.includes(cat)) return "high_grade"; // Corporate Bond is >=80% AAA/AA+ by SEBI, high-grade despite the name
  if (CREDIT_RISK_CATEGORIES.includes(cat)) return "credit_risk";
  // Duration-category fund: SOV-aware credit read (A2). Sovereign paper is at
  // least as safe as AAA, so SOV% counts toward the safety read; an AAA-only test
  // mis-filed sovereign-heavy duration funds as credit-risk (the three no-AAA%
  // long-duration G-sec funds, and ABSL/HDFC Income at SOV%+AAA% ~95). Govt
  // securities carry no corporate rating, so AAA% is null for them; read SOV%.
  const sov = c.sov_pct ?? 0;
  const aaa = c.aaa_pct ?? 0;
  if (sov >= SELECTION_PARAMS.SOV_SOVEREIGN_MIN_PCT) return "sovereign";
  if (sov + aaa >= SELECTION_PARAMS.AAA_HIGH_GRADE_MIN_PCT) return "high_grade";
  return "credit_risk";
}

export function durationBucketOf(c: SelectionCandidate): DurationBucket | null {
  if (c.duration_y !== null) {
    if (c.duration_y < SELECTION_PARAMS.DURATION_SHORT_MAX_Y) return "short";
    if (c.duration_y > SELECTION_PARAMS.DURATION_LONG_MIN_Y) return "long";
    return "medium";
  }
  // Fallback to the duration category where the metric is absent.
  const cat = c.sub_category.toLowerCase();
  if (cat.includes("short") || cat.includes("liquid") || cat.includes("overnight") || cat.includes("money market") || cat.includes("ultra")) return "short";
  if (cat.includes("long")) return "long";
  if (cat.includes("medium")) return "medium";
  return null;
}

/* ----- The lexicographic funnel (ADR-0034) ----- */

export type Shortlist = {
  label: string;
  surfaced: SelectionCandidate[];
  overflow: SelectionCandidate[];
  eligible_count: number;
  cohort_count: number;
  degraded: boolean;
  degradation_reason: string | null;
};

function riskAdjustedComposite(pool: SelectionCandidate[]): Map<SelectionCandidate, number> {
  const metrics: Array<keyof SelectionCandidate> = ["sharpe_3y", "sortino_3y", "calmar_3y"];
  const ranks = new Map<SelectionCandidate, number[]>();
  for (const c of pool) ranks.set(c, []);
  for (const m of metrics) {
    const sorted = [...pool].sort((a, b) => (a[m] as number) - (b[m] as number));
    sorted.forEach((c, i) => ranks.get(c)!.push(pool.length > 1 ? i / (pool.length - 1) : 1));
  }
  const out = new Map<SelectionCandidate, number>();
  for (const c of pool) { const arr = ranks.get(c)!; out.set(c, arr.reduce((s, x) => s + x, 0) / arr.length); }
  return out;
}

/** Quality cohort (top-half/tercile by risk-adjusted composite) -> lowest TER ->
 * 3y return tiebreak -> internal 5, surface 3. Never pads a thin pool. Degrades
 * honestly when the pool is empty. */
export function runFunnelOnPool(label: string, pool: SelectionCandidate[], emptyReason: string): Shortlist {
  if (pool.length === 0) {
    return { label, surfaced: [], overflow: [], eligible_count: 0, cohort_count: 0, degraded: true, degradation_reason: emptyReason };
  }
  const composite = riskAdjustedComposite(pool);
  const byComposite = [...pool].sort((a, b) => composite.get(b)! - composite.get(a)!);
  const cohortSize = Math.max(1, Math.ceil(pool.length * (SELECTION_PARAMS.QUALITY_GATE === "top_tercile" ? 1 / 3 : 1 / 2)));
  const cohort = byComposite.slice(0, cohortSize);
  const ranked = [...cohort].sort((a, b) => {
    const ta = a.ter_pct ?? Infinity, tb = b.ter_pct ?? Infinity;
    if (ta !== tb) return ta - tb;
    return (b.return_3y ?? -Infinity) - (a.return_3y ?? -Infinity);
  });
  const internal = ranked.slice(0, SELECTION_PARAMS.SHORTLIST_INTERNAL);
  return {
    label, surfaced: internal.slice(0, SELECTION_PARAMS.SHORTLIST_SURFACE),
    overflow: internal.slice(SELECTION_PARAMS.SHORTLIST_SURFACE),
    eligible_count: pool.length, cohort_count: cohort.length, degraded: false, degradation_reason: null,
  };
}

function poolFromCategories(universe: InstrumentUniverse, categories: string[]): SelectionCandidate[] {
  const pool: SelectionCandidate[] = [];
  for (const cat of categories) for (const c of universe.mf_by_category[cat] ?? []) pool.push(c);
  return pool;
}

/* ----- Cadence (ADR-0034) ----- */

export type Cadence = { deploy_cr: number; tranches: number; window_days: number; per_tranche_cr: number; note: string };

function liquidityFactor(medianAumCr: number | null): number {
  if (medianAumCr === null) return 1;
  if (medianAumCr >= 5000) return 1.5;
  if (medianAumCr >= 1000) return 1.0;
  return 0.67;
}

export function computeCadence(deployCr: number, medianAumCr: number | null): Cadence {
  const p = SELECTION_PARAMS;
  if (deployCr <= p.CADENCE_STAGE_THRESHOLD_CR) {
    return { deploy_cr: round2(deployCr), tranches: 1, window_days: 0, per_tranche_cr: round2(deployCr), note: `Deploy in a single step; ${round2(deployCr)} Cr is below the ${p.CADENCE_STAGE_THRESHOLD_CR} Cr staging threshold.` };
  }
  const perTranche = p.CADENCE_PER_TRANCHE_CR * liquidityFactor(medianAumCr);
  const tranches = Math.min(p.CADENCE_MAX_TRANCHES, Math.max(1, Math.ceil(deployCr / perTranche)));
  return { deploy_cr: round2(deployCr), tranches, window_days: p.CADENCE_WINDOW_DAYS, per_tranche_cr: round2(deployCr / tranches), note: `Stage the ${round2(deployCr)} Cr deploy over ${tranches} tranches across roughly ${p.CADENCE_WINDOW_DAYS} days, about ${round2(deployCr / tranches)} Cr per tranche, to manage entry risk; daily traded volume is unavailable, so the pacing is sized on the deploy amount and the destination AUM, not live turnover.` };
}

function medianAum(cands: SelectionCandidate[]): number | null {
  const a = cands.map((c) => c.aum_cr).filter((x): x is number => x !== null).sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : null;
}

/* ----- Equity held-fund look-through (ADR-0035) ----- */

export type HeldEquityComposition = {
  instrument: string;
  weight_pct: number; // of portfolio
  domestic_large_pct: number; // of portfolio
  domestic_mid_pct: number;
  domestic_small_pct: number;
  international_pct: number; // of portfolio (the residual for a flexi; 100% for a dedicated intl holding)
  type_label: string;
  composition_source: "snapshot" | "category_default" | "declined";
};

function findRawMf(universe: InstrumentUniverse, instrument: string): MutualFundRow | null {
  return universe.raw_mf.find((r) => strictNameMatch(String(r.fund_name ?? ""), instrument)) ?? null;
}

/** Decompose a held equity holding into domestic large/mid/small + international.
 * Domestic cap fractions come from the snapshot LargeCap/MidCap/SmallCap %;
 * international is the residual (not-domestic-not-cash, ADR-0036, no labelled
 * field exists). Pure-cap and direct-listed use their category; PMS uses the
 * matched record's cap_split or a domestic default. */
export function decomposeHeldEquity(h: Holding, universe: InstrumentUniverse): HeldEquityComposition {
  const w = h.weightPct;
  const base = { instrument: h.instrument, weight_pct: round1(w), domestic_large_pct: 0, domestic_mid_pct: 0, domestic_small_pct: 0, international_pct: 0 };
  const sc = h.subCategory;

  // Dedicated international holdings: 100% international.
  if (sc.startsWith("intl_")) {
    return { ...base, international_pct: round1(w), type_label: "international equity", composition_source: "snapshot" };
  }
  // Direct listed equity: domestic large-cap (the personas' direct names are large).
  if (sc.startsWith("listed_")) {
    return { ...base, domestic_large_pct: round1(w), type_label: "direct large-cap equity", composition_source: "category_default" };
  }
  // Mutual fund: decompose from the snapshot composition where present.
  if (sc.startsWith("mf_")) {
    const row = findRawMf(universe, h.instrument);
    const r = row as Record<string, unknown> | null;
    const lg = r ? num(r["LargeCap %"]) : null, md = r ? num(r["MidCap %"]) : null, sm = r ? num(r["SmallCap %"]) : null, cash = r ? num(r["Cash %"]) : null;
    const isFlexi = row ? FLEXI_CATEGORIES.includes(String(row.sebi_category ?? "")) : false;
    const isHybrid = sc.startsWith("mf_hybrid") || (row ? HYBRID_CATEGORIES.includes(String(row.sebi_category ?? "")) : false);
    if (lg !== null && md !== null && sm !== null) {
      // A hybrid holds debt alongside equity; its non-domestic-non-cash residual
      // is DEBT, not international (L2). Count its domestic cap exposure, exclude
      // the debt residual from the equity look-through (international = 0). The
      // residual-is-international rule (ADR-0036) holds only for all-equity funds.
      const intl = isHybrid ? 0 : Math.max(0, 1 - lg - md - sm - (cash ?? 0) / 100); // fractions; cash is a percent
      const label = isHybrid
        ? `${row!.sebi_category} (hybrid; equity sleeve counted, debt residual excluded)`
        : isFlexi ? `${row!.sebi_category} (flexi-cap${intl > 0.05 ? `, ~${Math.round(intl * 100)}% international` : ""})` : String(row!.sebi_category ?? "mutual fund");
      return { ...base, domestic_large_pct: round1(w * lg), domestic_mid_pct: round1(w * md), domestic_small_pct: round1(w * sm), international_pct: round1(w * intl), type_label: label, composition_source: "snapshot" };
    }
    // Composition missing. Pure-cap categories take their category (no inference).
    if (sc === "mf_active_large_cap") return { ...base, domestic_large_pct: round1(w), type_label: "large-cap fund", composition_source: "category_default" };
    if (sc === "mf_active_mid_cap") return { ...base, domestic_mid_pct: round1(w), type_label: "mid-cap fund", composition_source: "category_default" };
    if (sc === "mf_active_small_cap") return { ...base, domestic_small_pct: round1(w), type_label: "small-cap fund", composition_source: "category_default" };
    // Passive index fund (L3): classify by what it tracks, never decline. Broad-
    // market and large indices (Nifty 50, Sensex, Next 50, Nifty 100 / 500) are
    // large-cap-dominant; a midcap / smallcap index tracker maps to mid / small.
    if (sc === "mf_passive_index") {
      const n = h.instrument.toLowerCase();
      if (/mid\s?cap|midcp/.test(n)) return { ...base, domestic_mid_pct: round1(w), type_label: "passive index (mid-cap)", composition_source: "category_default" };
      if (/small\s?cap|smallcp/.test(n)) return { ...base, domestic_small_pct: round1(w), type_label: "passive index (small-cap)", composition_source: "category_default" };
      return { ...base, domestic_large_pct: round1(w), type_label: "passive index (large-cap / broad market)", composition_source: "category_default" };
    }
    // A diversified (flexi/multi/focused) fund with NO composition. The bounded
    // LLM inference for this case is DEFERRED (ADR-0038): no flexi in the current
    // universe lacks composition, so this branch is unreachable today, and the
    // ring-fenced inference component will be built if and only if a real
    // composition-missing flexi appears in a future snapshot (product debt P46).
    // Until then, decline deterministically to advisor-select rather than guess.
    return { ...base, type_label: "diversified equity, composition unavailable, advisor-select", composition_source: "declined" };
  }
  // PMS or other equity: domestic, large-cap-leaning default (quality PMS).
  return { ...base, domestic_large_pct: round1(w), type_label: "PMS / other domestic equity", composition_source: "category_default" };
}

/* ----- Equity two-level sub-allocation + international residual counting ----- */

export type EquitySubBucket = {
  bucket: "international" | "domestic_large" | "domestic_mid" | "domestic_small";
  target_pct: number;     // of portfolio
  current_pct: number;    // of portfolio (from look-through)
  gap_pct: number;        // max(0, target - current)
  deploy_pct: number;     // share of the equity deploy allocated here
  deploy_cr: number;
  shortlist: Shortlist;
  cadence: Cadence;
};

export type EquityPlan = {
  equity_target_pct: number;
  look_through: HeldEquityComposition[];
  sub_buckets: EquitySubBucket[];
  /** Flexi/multi funds offered as a distinct diversified-equity candidate (ADR-0035
   * ruling B): not decomposed into the cap ranking pools, surfaced as their own option. */
  diversified_option: Shortlist;
};

function intlShortlist(universe: InstrumentUniverse): Shortlist {
  return runFunnelOnPool("international equity", poolFromCategories(universe, INTERNATIONAL_CATEGORIES), "no eligible international fund");
}

export function buildEquityPlan(
  equityDeployPct: number,
  equityTargetPct: number,
  framework: SubSleeveFramework,
  holdings: StructuredHoldings,
  universe: InstrumentUniverse,
  liquidAumCr: number,
): EquityPlan {
  const split = framework.equity;
  // Level 1 + Level 2 sub-targets (% of portfolio).
  const intlTarget = round1((split.international_pct / 100) * equityTargetPct);
  const domesticTarget = equityTargetPct - intlTarget;
  const largeTarget = round1((split.domestic_large_pct / 100) * domesticTarget);
  const midTarget = round1((split.domestic_mid_pct / 100) * domesticTarget);
  const smallTarget = round1((split.domestic_small_pct / 100) * domesticTarget);

  // Current exposure from look-through (residual counting, ADR-0036).
  const look_through = holdings.holdings.filter((h) => h.assetClass === "Equity").map((h) => decomposeHeldEquity(h, universe));
  const cur = (k: keyof Pick<HeldEquityComposition, "domestic_large_pct" | "domestic_mid_pct" | "domestic_small_pct" | "international_pct">) =>
    round1(look_through.reduce((s, x) => s + x[k], 0));
  const buckets: Array<{ bucket: EquitySubBucket["bucket"]; target: number; current: number; pool: () => Shortlist }> = [
    { bucket: "international", target: intlTarget, current: cur("international_pct"), pool: () => intlShortlist(universe) },
    { bucket: "domestic_large", target: largeTarget, current: cur("domestic_large_pct"), pool: () => runFunnelOnPool("domestic large cap", poolFromCategories(universe, [CAP_CATEGORY.large]), "no eligible large-cap fund") },
    { bucket: "domestic_mid", target: midTarget, current: cur("domestic_mid_pct"), pool: () => runFunnelOnPool("domestic mid cap", poolFromCategories(universe, [CAP_CATEGORY.mid]), "no eligible mid-cap fund") },
    { bucket: "domestic_small", target: smallTarget, current: cur("domestic_small_pct"), pool: () => runFunnelOnPool("domestic small cap", poolFromCategories(universe, [CAP_CATEGORY.small]), "no eligible small-cap fund") },
  ];

  const gaps = buckets.map((b) => ({ ...b, gap: Math.max(0, round1(b.target - b.current)) }));
  const totalGap = gaps.reduce((s, b) => s + b.gap, 0);
  const deployable = Math.min(equityDeployPct, totalGap);

  const sub_buckets: EquitySubBucket[] = gaps.map((b) => {
    const deployPct = totalGap > 0 && b.gap > 0 ? round1((b.gap / totalGap) * deployable) : 0;
    const deployCr = round2((deployPct / 100) * liquidAumCr);
    const sl = b.pool();
    return { bucket: b.bucket, target_pct: round1(b.target), current_pct: round1(b.current), gap_pct: round1(b.gap), deploy_pct: deployPct, deploy_cr: deployCr, shortlist: sl, cadence: computeCadence(deployCr, medianAum(poolForBucket(b.bucket, universe))) };
  });

  return { equity_target_pct: round1(equityTargetPct), look_through, sub_buckets, diversified_option: runFunnelOnPool("diversified equity (flexi / multi / large-and-mid / ELSS / value / contra / dividend-yield)", poolFromCategories(universe, DIVERSIFIED_EQUITY_CATEGORIES), "no eligible diversified-equity fund") };
}

function poolForBucket(bucket: EquitySubBucket["bucket"], universe: InstrumentUniverse): SelectionCandidate[] {
  if (bucket === "international") return poolFromCategories(universe, INTERNATIONAL_CATEGORIES);
  if (bucket === "domestic_large") return poolFromCategories(universe, [CAP_CATEGORY.large]);
  if (bucket === "domestic_mid") return poolFromCategories(universe, [CAP_CATEGORY.mid]);
  return poolFromCategories(universe, [CAP_CATEGORY.small]);
}

/* ----- Debt 2D credit-by-duration (ADR-0037) ----- */

export type DebtCreditBucketPlan = {
  bucket: CreditBucket;
  target_duration: DurationBucket;
  split_pct: number;     // % of the debt sleeve allocated to this credit bucket
  deploy_pct: number;    // % of portfolio
  deploy_cr: number;
  shortlist: Shortlist;
  cadence: Cadence;
};

export type DebtPlan = {
  target_duration: DurationBucket;
  credit_buckets: DebtCreditBucketPlan[];
};

export function buildDebtPlan(
  debtDeployPct: number,
  framework: SubSleeveFramework,
  universe: InstrumentUniverse,
  liquidAumCr: number,
): DebtPlan {
  const split = framework.debt_credit;
  const targetDur = framework.debt_duration;
  const order: Array<{ bucket: CreditBucket; pctOfSleeve: number }> = [
    { bucket: "sovereign", pctOfSleeve: split.sovereign_pct },
    { bucket: "high_grade", pctOfSleeve: split.high_grade_pct },
    { bucket: "credit_risk", pctOfSleeve: split.credit_risk_pct },
  ];
  const credit_buckets = order.map(({ bucket, pctOfSleeve }) => {
    const deployPct = round1((pctOfSleeve / 100) * debtDeployPct);
    const deployCr = round2((deployPct / 100) * liquidAumCr);
    // Candidates: eligible debt funds in this credit bucket; prefer the
    // horizon-target duration (filter to it where the duration-matched pool is
    // non-empty, else relax to the full credit-bucket pool).
    const inBucket = universe.debt_funds.filter((c) => creditBucketOf(c) === bucket);
    const durMatched = inBucket.filter((c) => durationBucketOf(c) === targetDur);
    const pool = durMatched.length > 0 ? durMatched : inBucket;
    const label = `${bucket.replace("_", " ")} debt${durMatched.length > 0 ? `, ${targetDur} duration` : ` (no ${targetDur}-duration fund eligible; credit-bucket-wide)`}`;
    return { bucket, target_duration: targetDur, split_pct: pctOfSleeve, deploy_pct: deployPct, deploy_cr: deployCr, shortlist: runFunnelOnPool(label, pool, `no eligible ${bucket.replace("_", " ")} debt fund`), cadence: computeCadence(deployCr, medianAum(pool)) };
  });
  return { target_duration: targetDur, credit_buckets };
}

/* ----- Top-up (ADR-0034 rank-banded), MF holdings against a cap-bucket pool ----- */

export type TopUpAssessment = { holding_ref: string; matched_fund: string; in_cohort: boolean; recommendation: "top_up" | "top_up_or_switch" };

export function assessTopUps(holdings: StructuredHoldings, pool: SelectionCandidate[]): TopUpAssessment[] {
  const out: TopUpAssessment[] = [];
  if (pool.length === 0) return out;
  const composite = riskAdjustedComposite(pool);
  const byComposite = [...pool].sort((a, b) => composite.get(b)! - composite.get(a)!);
  const cohortSize = Math.max(1, Math.ceil(pool.length * (SELECTION_PARAMS.QUALITY_GATE === "top_tercile" ? 1 / 3 : 1 / 2)));
  const cohort = new Set(byComposite.slice(0, cohortSize));
  for (const h of holdings.holdings) {
    if (!h.subCategory.startsWith("mf_")) continue;
    const match = pool.find((c) => strictNameMatch(c.fund_name, h.instrument));
    if (!match) continue;
    out.push({ holding_ref: h.instrument, matched_fund: match.fund_name, in_cohort: cohort.has(match), recommendation: cohort.has(match) ? "top_up" : "top_up_or_switch" });
  }
  return out;
}

/* ----- Alternatives split (settled design) ----- */

export type AlternativesPlan = {
  alt_target_pct: number; gold_pct: number; non_gold_aif_pct: number;
  gold_shortlist: Shortlist; non_gold_advisor_select: { reason: string; aif_universe_count: number } | null;
};

export function buildAlternativesPlan(altTargetPct: number, universe: InstrumentUniverse): AlternativesPlan {
  const gold = runFunnelOnPool("gold (commodity ETF)", poolFromCategories(universe, GOLD_CATEGORIES), "no eligible commodity ETF");
  if (altTargetPct < 5) return { alt_target_pct: round2(altTargetPct), gold_pct: round2(altTargetPct), non_gold_aif_pct: 0, gold_shortlist: gold, non_gold_advisor_select: null };
  const aifCount = Object.values(universe.aif_by_sebi).reduce((s, n) => s + n, 0);
  return { alt_target_pct: round2(altTargetPct), gold_pct: 5, non_gold_aif_pct: round2(altTargetPct - 5), gold_shortlist: gold, non_gold_advisor_select: { reason: "AIF carries no performance metrics and the snapshot AIF universe does not reliably match a deployable product for this investor (product debt P40); the non-gold alternatives portion is advisor-select, not auto-ranked.", aif_universe_count: aifCount } };
}

/* ----- The per-sleeve deployment plan ----- */

export type SleeveDeploymentPlan = {
  sleeve: Sleeve;
  add_pct_points: number;
  deploy_cr: number;
  equity: EquityPlan | null;
  debt: DebtPlan | null;
  alternatives: AlternativesPlan | null;
  top_ups: TopUpAssessment[];
};

export type DeploymentInput = {
  deployments: Array<{ sleeve: string; add_pct_points: number; target_pct: number; resulting_pct: number }>;
  holdings: StructuredHoldings;
  universe: InstrumentUniverse;
  framework: SubSleeveFramework;
  liquidAumCr: number;
};

export function buildDeploymentPlan(input: DeploymentInput): SleeveDeploymentPlan[] {
  const out: SleeveDeploymentPlan[] = [];
  for (const d of input.deployments) {
    const sleeve = d.sleeve as Sleeve;
    const deployCr = round2((d.add_pct_points / 100) * input.liquidAumCr);
    if (sleeve === "Equity") {
      const equity = buildEquityPlan(d.add_pct_points, d.target_pct, input.framework, input.holdings, input.universe, input.liquidAumCr);
      const topUps = assessTopUps(input.holdings, [...poolFromCategories(input.universe, [CAP_CATEGORY.large, CAP_CATEGORY.mid, CAP_CATEGORY.small]), ...poolFromCategories(input.universe, DIVERSIFIED_EQUITY_CATEGORIES)]);
      out.push({ sleeve, add_pct_points: round1(d.add_pct_points), deploy_cr: deployCr, equity, debt: null, alternatives: null, top_ups: topUps });
    } else if (sleeve === "Debt") {
      const debt = buildDebtPlan(d.add_pct_points, input.framework, input.universe, input.liquidAumCr);
      out.push({ sleeve, add_pct_points: round1(d.add_pct_points), deploy_cr: deployCr, equity: null, debt, alternatives: null, top_ups: assessTopUps(input.holdings, input.universe.debt_funds) });
    } else if (sleeve === "Alternatives") {
      out.push({ sleeve, add_pct_points: round1(d.add_pct_points), deploy_cr: deployCr, equity: null, debt: null, alternatives: buildAlternativesPlan(d.resulting_pct, input.universe), top_ups: [] });
    }
  }
  return out;
}
