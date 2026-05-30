/* Instrument-selection funnel (T-5.12 Finding 1; ADR-0034).
 *
 * Deterministic funnel that fills an under-target sleeve with specific
 * candidate instruments. The funnel decides; the LLM (in A3's narration) only
 * articulates the deterministic pick citing the computed metrics; the advisor
 * owns the decision. Nothing here calls an LLM.
 *
 * Architecture and every numeric parameter is documented in ADR-0034. The
 * parameters below are NAMED and TUNABLE, not magic numbers; their rationale is
 * in the ADR so future readers find the "why these values" there, not by
 * reverse-engineering the code.
 *
 * Classification is data-driven (ADR-0034): an instrument's sleeve comes from
 * its data (the snapshot record's strategy_type / sebi_category), never from a
 * wrapper-type assumption. The current snapshot's PMS happen to be all-equity;
 * that falls out of reading strategy_type, it is not hard-coded.
 */

import type { Snapshot, MutualFundRow } from "./snapshot-loader";
import type { StructuredHoldings } from "@/db/fixtures/structured-holdings";
import type { SubSleeveTilt, EquityCapPreference, DebtCreditPreference } from "@/db/fixtures/structured-mandates";
import { HOUSE_VIEW_TILT_BY_RISK } from "@/db/fixtures/structured-mandates";
import { strictNameMatch } from "./operational-scope";

/* ----- Tunable parameters (ADR-0034; the "why these values" is in the ADR) ----- */

export const SELECTION_PARAMS = {
  /** Viable-AUM floor (Cr). Drops sub-scale funds; keeps ~53% of the MF
   * universe and 16 to 27 eligible per equity/debt sub-category. */
  MIN_AUM_CR: 500,
  /** Sufficient track record (years). Matches the 3-year ranking horizon: a
   * sub-3-year fund cannot be ranked on the primary risk-adjusted criterion. */
  MIN_TRACK_RECORD_YEARS: 3,
  /** Quality-gate cutoff on the risk-adjusted composite, the "consistently
   * strong" cohort before the lowest-TER pick. "top_half" or "top_tercile". */
  QUALITY_GATE: "top_half" as "top_half" | "top_tercile",
  /** Advisor-facing shortlist size (up to this; never padded). */
  SHORTLIST_SURFACE: 3,
  /** Internally ranked size; positions 4 to 5 are logged in the deterministic
   * preview for ranking-validation only, never surfaced to the advisor. */
  SHORTLIST_INTERNAL: 5,
  /** Cadence reference window (days). */
  CADENCE_WINDOW_DAYS: 14,
  /** Stage a sleeve deploy only when it exceeds this (Cr); below, one step. */
  CADENCE_STAGE_THRESHOLD_CR: 2,
  /** Base per-tranche size (Cr), scaled by the liquidity proxy. */
  CADENCE_PER_TRANCHE_CR: 1.5,
  /** Tranche cap. */
  CADENCE_MAX_TRANCHES: 4,
} as const;

/* ----- Sub-sleeve -> preferred sebi_category mapping (selection logic) ----- */

const EQUITY_CATEGORIES_BY_TILT: Record<EquityCapPreference, string[]> = {
  large_only: ["Large Cap Fund"],
  large_mid: ["Large Cap Fund", "Large & Mid Cap Fund"],
  small_mid_lean: ["Mid Cap Fund", "Small Cap Fund"],
};

const DEBT_CATEGORIES_BY_TILT: Record<DebtCreditPreference, string[]> = {
  high_grade_sovereign: ["Gilt Fund", "Corporate Bond Fund", "Banking and PSU Fund"],
  high_grade: ["Corporate Bond Fund", "Banking and PSU Fund"],
  may_include_credit_risk: ["Corporate Bond Fund", "Credit Risk Fund"],
};

/** Gold is deployable via commodity ETFs in mf_funds (audit Section A/D). */
const GOLD_CATEGORIES = ["ETFs- Commodity"];

export function resolveTilt(riskTier: string, override?: SubSleeveTilt): SubSleeveTilt {
  return override ?? HOUSE_VIEW_TILT_BY_RISK[riskTier] ?? HOUSE_VIEW_TILT_BY_RISK.Aggressive;
}

/* ----- Data-driven classification (no wrapper-type hard-code) ----- */

export type Sleeve = "Equity" | "Debt" | "Alternatives";

const EQUITY_CAT_HINTS = ["cap fund", "flexi", "focused", "elss", "value", "contra", "dividend yield", "etfs- equity", "equity index"];
const DEBT_CAT_HINTS = ["bond", "gilt", "duration", "liquid", "money market", "overnight", "credit risk", "banking and psu", "debt index", "etfs- debt", "dynamic bond"];
const ALT_CAT_HINTS = ["commodity", "gold", "silver"];

/** Classify a mutual-fund sebi_category to its economic sleeve, from the data. */
export function classifyMfSleeve(sebiCategory: string | null | undefined): Sleeve | null {
  const c = (sebiCategory ?? "").toLowerCase();
  if (!c) return null;
  if (ALT_CAT_HINTS.some((h) => c.includes(h))) return "Alternatives";
  if (DEBT_CAT_HINTS.some((h) => c.includes(h))) return "Debt";
  if (EQUITY_CAT_HINTS.some((h) => c.includes(h))) return "Equity";
  return null;
}

/** Classify a PMS to its economic sleeve from its strategy_type (NOT from the
 * fact that it is a PMS). All current snapshot PMS are strategy_type "equity",
 * so they classify Equity by reading the data; a future debt or long-short PMS
 * classifies correctly. */
export function classifyPmsSleeve(strategyType: string | null | undefined): Sleeve {
  const s = (strategyType ?? "").toLowerCase();
  if (s.includes("debt") || s.includes("fixed income") || s.includes("credit")) return "Debt";
  if (s.includes("long short") || s.includes("long-short") || s.includes("absolute") || s.includes("hedge")) return "Alternatives";
  return "Equity";
}

/* ----- Candidate + shortlist types ----- */

export type SelectionCandidate = {
  fund_name: string;
  source: "mf" | "pms";
  sub_category: string;
  ter_pct: number | null;
  aum_cr: number | null;
  age_years: number | null;
  sharpe_3y: number | null;
  sortino_3y: number | null;
  calmar_3y: number | null;
  return_3y: number | null;
};

export type Shortlist = {
  sleeve: Sleeve;
  sub_sleeve_label: string;
  categories: string[];
  /** Advisor-facing, up to SHORTLIST_SURFACE; never padded. */
  surfaced: SelectionCandidate[];
  /** Positions 4 to 5, calibration-only (preview, never narration/fixture). */
  overflow: SelectionCandidate[];
  eligible_count: number;
  cohort_count: number;
  /** Set when ranking could not run on data (advisor-select); Reading B. */
  degraded: boolean;
  degradation_reason: string | null;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return null;
}
function round2(n: number): number { return Math.round(n * 100) / 100; }

/* ----- Universe curation (eligible MF candidates per category) ----- */

export type InstrumentUniverse = {
  mf_by_category: Record<string, SelectionCandidate[]>;
  /** Counts for the advisor-select degradation context (PMS/AIF). */
  pms_equity_count: number;
  aif_by_sebi: Record<string, number>;
};

/** The snapshot stores TER and the period returns as fractions (0.0136 = 1.36
 * percent, 0.223 = 22.3 percent) despite the "(%)" column label. Convert to
 * percent values so the stored figure matches its name and the narration cites
 * the right number. Sharpe / Sortino / Calmar are ratios, kept as-is. */
function pct(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : round2(n * 100);
}

function mfToCandidate(row: MutualFundRow): SelectionCandidate {
  const tb = (row.tier_b_stats ?? {}) as Record<string, unknown>;
  return {
    fund_name: String(row.fund_name ?? ""),
    source: "mf",
    sub_category: String(row.sebi_category ?? ""),
    ter_pct: pct((row as Record<string, unknown>)["TER (%)"]),
    aum_cr: num((row as Record<string, unknown>)["AUM (Cr)"]),
    age_years: num((row as Record<string, unknown>)["Age (Yrs)"]),
    sharpe_3y: num(tb.sharpe_3y),
    sortino_3y: num(tb.sortino_3y),
    calmar_3y: num(tb.calmar_3y),
    return_3y: pct((row as Record<string, unknown>)["3Y"]),
  };
}

/** Stage 1 eligibility: viable AUM, sufficient track record, and the 3-year
 * risk-adjusted set present (so the fund is rankable on the primary criterion). */
function isEligibleMf(c: SelectionCandidate): boolean {
  return (
    c.aum_cr !== null && c.aum_cr >= SELECTION_PARAMS.MIN_AUM_CR &&
    c.age_years !== null && c.age_years >= SELECTION_PARAMS.MIN_TRACK_RECORD_YEARS &&
    c.sharpe_3y !== null && c.sortino_3y !== null && c.calmar_3y !== null
  );
}

export function buildInstrumentUniverse(snapshot: Snapshot): InstrumentUniverse {
  const mf_by_category: Record<string, SelectionCandidate[]> = {};
  for (const row of snapshot.mf_funds) {
    const cat = String(row.sebi_category ?? "");
    if (!cat) continue;
    const cand = mfToCandidate(row);
    if (!isEligibleMf(cand)) continue;
    (mf_by_category[cat] ??= []).push(cand);
  }
  // PMS: data-driven equity count (classifyPmsSleeve), for advisor-select context.
  const pmsFunds = ((snapshot.pms as { funds?: Record<string, unknown>[] })?.funds) ?? [];
  let pms_equity_count = 0;
  for (const p of pmsFunds) {
    const st = ((p.identity as Record<string, unknown>)?.strategy_type) as string | undefined;
    if (classifyPmsSleeve(st) === "Equity") pms_equity_count += 1;
  }
  // AIF: count per SEBI Category, for the alternatives advisor-select context.
  const aifProfiles = ((snapshot.aif as { "Fund Profiles"?: Record<string, unknown>[] })?.["Fund Profiles"]) ?? [];
  const aif_by_sebi: Record<string, number> = {};
  for (const a of aifProfiles) {
    const cat = String(a["SEBI Category"] ?? "(uncategorised)");
    aif_by_sebi[cat] = (aif_by_sebi[cat] ?? 0) + 1;
  }
  return { mf_by_category, pms_equity_count, aif_by_sebi };
}

/* ----- The lexicographic funnel (ADR-0034 ruling 3) ----- */

/** Risk-adjusted composite: the mean of the candidate's percentile rank on each
 * of sharpe_3y / sortino_3y / calmar_3y within the pool. Higher is better. */
function riskAdjustedComposite(pool: SelectionCandidate[]): Map<SelectionCandidate, number> {
  const metrics: Array<keyof SelectionCandidate> = ["sharpe_3y", "sortino_3y", "calmar_3y"];
  const pct = new Map<SelectionCandidate, number[]>();
  for (const c of pool) pct.set(c, []);
  for (const m of metrics) {
    const sorted = [...pool].sort((a, b) => (a[m] as number) - (b[m] as number));
    sorted.forEach((c, i) => pct.get(c)!.push(pool.length > 1 ? i / (pool.length - 1) : 1));
  }
  const out = new Map<SelectionCandidate, number>();
  for (const c of pool) {
    const arr = pct.get(c)!;
    out.set(c, arr.reduce((s, x) => s + x, 0) / arr.length);
  }
  return out;
}

/** Run the funnel over a sub-sleeve (union of the tilt's preferred categories):
 * quality cohort (top-half/tercile by composite) -> lowest TER -> 3y return
 * tiebreak -> internal 5, surface 3. Never pads a thin pool. */
export function runFunnel(
  sleeve: Sleeve,
  subSleeveLabel: string,
  categories: string[],
  universe: InstrumentUniverse,
): Shortlist {
  const pool: SelectionCandidate[] = [];
  for (const cat of categories) for (const c of universe.mf_by_category[cat] ?? []) pool.push(c);

  if (pool.length === 0) {
    return { sleeve, sub_sleeve_label: subSleeveLabel, categories, surfaced: [], overflow: [], eligible_count: 0, cohort_count: 0, degraded: true, degradation_reason: "no eligible instrument in the preferred sub-sleeve categories" };
  }

  const composite = riskAdjustedComposite(pool);
  const byComposite = [...pool].sort((a, b) => composite.get(b)! - composite.get(a)!);
  const cohortSize = Math.max(1, Math.ceil(pool.length * (SELECTION_PARAMS.QUALITY_GATE === "top_tercile" ? 1 / 3 : 1 / 2)));
  const cohort = byComposite.slice(0, cohortSize);

  // Within the quality cohort: lowest TER first, raw 3y return breaks ties.
  const ranked = [...cohort].sort((a, b) => {
    const ta = a.ter_pct ?? Infinity, tb = b.ter_pct ?? Infinity;
    if (ta !== tb) return ta - tb;
    return (b.return_3y ?? -Infinity) - (a.return_3y ?? -Infinity);
  });

  const internal = ranked.slice(0, SELECTION_PARAMS.SHORTLIST_INTERNAL);
  return {
    sleeve, sub_sleeve_label: subSleeveLabel, categories,
    surfaced: internal.slice(0, SELECTION_PARAMS.SHORTLIST_SURFACE),
    overflow: internal.slice(SELECTION_PARAMS.SHORTLIST_SURFACE),
    eligible_count: pool.length,
    cohort_count: cohort.length,
    degraded: false,
    degradation_reason: null,
  };
}

/* ----- Cadence (ADR-0034 ruling 5) ----- */

export type Cadence = {
  deploy_cr: number;
  tranches: number;
  window_days: number;
  per_tranche_cr: number;
  note: string;
};

/** Liquidity factor from the sub-sleeve's median AUM proxy: a more liquid
 * destination tolerates larger tranches (fewer steps). */
function liquidityFactor(medianAumCr: number | null): number {
  if (medianAumCr === null) return 1;
  if (medianAumCr >= 5000) return 1.5;
  if (medianAumCr >= 1000) return 1.0;
  return 0.67;
}

export function computeCadence(deployCr: number, medianAumCr: number | null): Cadence {
  const p = SELECTION_PARAMS;
  if (deployCr <= p.CADENCE_STAGE_THRESHOLD_CR) {
    return { deploy_cr: round2(deployCr), tranches: 1, window_days: 0, per_tranche_cr: round2(deployCr), note: `Deploy in a single step; the ${round2(deployCr)} Cr size is below the ${p.CADENCE_STAGE_THRESHOLD_CR} Cr staging threshold.` };
  }
  const perTranche = p.CADENCE_PER_TRANCHE_CR * liquidityFactor(medianAumCr);
  const tranches = Math.min(p.CADENCE_MAX_TRANCHES, Math.max(1, Math.ceil(deployCr / perTranche)));
  return {
    deploy_cr: round2(deployCr),
    tranches,
    window_days: p.CADENCE_WINDOW_DAYS,
    per_tranche_cr: round2(deployCr / tranches),
    note: `Stage the ${round2(deployCr)} Cr deploy over ${tranches} tranches across roughly ${p.CADENCE_WINDOW_DAYS} days, about ${round2(deployCr / tranches)} Cr per tranche, to manage entry risk; daily traded volume is unavailable so the pacing is sized on the deploy amount and the destination's AUM, not live turnover.`,
  };
}

function medianAum(cands: SelectionCandidate[]): number | null {
  const a = cands.map((c) => c.aum_cr).filter((x): x is number => x !== null).sort((x, y) => x - y);
  if (a.length === 0) return null;
  return a[Math.floor(a.length / 2)];
}

/* ----- Top-up join (ADR-0034 ruling 4, rank-banded) ----- */

export type TopUpAssessment = {
  holding_ref: string;
  matched_fund: string;
  in_cohort: boolean;       // top-half of the quality cohort -> top up
  recommendation: "top_up" | "top_up_or_switch";
};

/** For each existing holding in the deployed sleeve, decide whether to top it up
 * (it is in the quality cohort) or surface both top-up and the better fresh
 * candidate (it is eligible but mediocre, below the cohort). Holdings that do
 * not match the universe (PMS/AIF, P40) are simply absent (add-new/advisor-select). */
export function assessTopUps(
  holdings: StructuredHoldings,
  sleeve: Sleeve,
  shortlist: Shortlist,
  universe: InstrumentUniverse,
): TopUpAssessment[] {
  const out: TopUpAssessment[] = [];
  const cohortPool: SelectionCandidate[] = [];
  for (const cat of shortlist.categories) for (const c of universe.mf_by_category[cat] ?? []) cohortPool.push(c);
  if (cohortPool.length === 0) return out;
  const composite = riskAdjustedComposite(cohortPool);
  const byComposite = [...cohortPool].sort((a, b) => composite.get(b)! - composite.get(a)!);
  const cohortSize = Math.max(1, Math.ceil(cohortPool.length * (SELECTION_PARAMS.QUALITY_GATE === "top_tercile" ? 1 / 3 : 1 / 2)));
  const cohort = new Set(byComposite.slice(0, cohortSize));

  for (const h of holdings.holdings) {
    if (!h.subCategory.startsWith("mf_")) continue; // top-up join reliable for MF (P40)
    // Map the holding's asset class to the funnel sleeve via the candidate categories.
    const match = cohortPool.find((c) => strictNameMatch(c.fund_name, h.instrument));
    if (!match) continue;
    const inCohort = cohort.has(match);
    out.push({ holding_ref: h.instrument, matched_fund: match.fund_name, in_cohort: inCohort, recommendation: inCohort ? "top_up" : "top_up_or_switch" });
  }
  return out;
}

/* ----- Alternatives split (ADR-0034 / settled design) ----- */

export type AlternativesPlan = {
  alt_target_pct: number;
  gold_pct: number;
  non_gold_aif_pct: number;
  gold_shortlist: Shortlist | null;
  non_gold_advisor_select: { reason: string; aif_universe_count: number } | null;
};

/** Under 5% alt -> gold only (sub-5% implies conservative, unsuitable for AIFs).
 * 5%+ -> 5% gold + remainder non-gold AIF as advisor-select (AIF has no
 * performance metrics; never force gold to absorb the non-gold remainder). */
export function buildAlternativesPlan(altTargetPct: number, universe: InstrumentUniverse): AlternativesPlan {
  const goldShort = runFunnel("Alternatives", "gold (commodity ETF)", GOLD_CATEGORIES, universe);
  if (altTargetPct < 5) {
    return { alt_target_pct: round2(altTargetPct), gold_pct: round2(altTargetPct), non_gold_aif_pct: 0, gold_shortlist: goldShort, non_gold_advisor_select: null };
  }
  const aifCount = Object.values(universe.aif_by_sebi).reduce((s, n) => s + n, 0);
  return {
    alt_target_pct: round2(altTargetPct),
    gold_pct: 5,
    non_gold_aif_pct: round2(altTargetPct - 5),
    gold_shortlist: goldShort,
    non_gold_advisor_select: { reason: "AIF carries no performance metrics and the snapshot AIF universe does not reliably match a deployable product for this investor (product debt P40); the non-gold alternatives portion is surfaced for advisor selection, not auto-ranked.", aif_universe_count: aifCount },
  };
}

/* ----- Per-sleeve deployment plan ----- */

export type SleeveDeploymentPlan = {
  sleeve: Sleeve;
  add_pct_points: number;
  deploy_cr: number;
  shortlist: Shortlist | null;     // Equity/Debt sub-sleeve shortlist
  alternatives: AlternativesPlan | null;
  top_ups: TopUpAssessment[];
  cadence: Cadence;
};

export type DeploymentInput = {
  deployments: Array<{ sleeve: string; add_pct_points: number; target_pct: number; resulting_pct: number }>;
  holdings: StructuredHoldings;
  universe: InstrumentUniverse;
  tilt: SubSleeveTilt;
  liquidAumCr: number;
};

export function buildDeploymentPlan(input: DeploymentInput): SleeveDeploymentPlan[] {
  const out: SleeveDeploymentPlan[] = [];
  for (const d of input.deployments) {
    const sleeve = d.sleeve as Sleeve;
    const deployCr = (d.add_pct_points / 100) * input.liquidAumCr;

    if (sleeve === "Equity" || sleeve === "Debt") {
      const cats = sleeve === "Equity" ? EQUITY_CATEGORIES_BY_TILT[input.tilt.equity_cap] : DEBT_CATEGORIES_BY_TILT[input.tilt.debt_credit];
      const label = sleeve === "Equity" ? `equity (${input.tilt.equity_cap})` : `debt (${input.tilt.debt_credit})`;
      const shortlist = runFunnel(sleeve, label, cats, input.universe);
      const pool: SelectionCandidate[] = [];
      for (const cat of cats) for (const c of input.universe.mf_by_category[cat] ?? []) pool.push(c);
      out.push({ sleeve, add_pct_points: round2(d.add_pct_points), deploy_cr: round2(deployCr), shortlist, alternatives: null, top_ups: assessTopUps(input.holdings, sleeve, shortlist, input.universe), cadence: computeCadence(deployCr, medianAum(pool)) });
    } else if (sleeve === "Alternatives") {
      const alt = buildAlternativesPlan(d.resulting_pct, input.universe);
      const goldPool = input.universe.mf_by_category[GOLD_CATEGORIES[0]] ?? [];
      out.push({ sleeve, add_pct_points: round2(d.add_pct_points), deploy_cr: round2(deployCr), shortlist: null, alternatives: alt, top_ups: [], cadence: computeCadence(deployCr, medianAum(goldPool)) });
    }
  }
  return out;
}
