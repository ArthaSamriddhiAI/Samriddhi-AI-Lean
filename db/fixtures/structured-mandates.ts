/* Structured mandate data for the six seeded investors.
 *
 * Slice 2 ignored mandate data; the diagnostic agents read risk_appetite
 * and time_horizon directly from the Investor row. Slice 3 introduces the
 * G1 mandate-compliance governance gate, which requires structured bands
 * and ceilings to evaluate against. This file is the source of truth;
 * db/seed.ts serialises each record into Investor.mandateJson at seed
 * time, and the pipeline reads back via JSON.parse.
 *
 * Mandate authoring policy:
 * - Asset-class bands track the foundation §1 model portfolio (65/25/7/3
 *   split with 60-70 / 20-30 / 5-10 / 2-5 bands) for aggressive long-term
 *   investors. Investors with different risk/horizon pairs get widened or
 *   tightened bands as appropriate (Iyengar's conservative medium-term
 *   mandate has lower equity ceiling and higher debt floor; Sharma's
 *   mandate widens equity to 50-70 per the verdicts file context).
 * - Wrapper-count ceilings are present-but-empty by default; the Slice 3
 *   demo specifically does not assume a hard wrapper-count ceiling for
 *   Sharma (per the verdicts file "no explicit wrapper-count ceiling in
 *   mandate"). Future investors can specify.
 * - Position concentration ceilings default to 15% of liquid AUM for any
 *   single position (industry-standard institutional discipline). Specific
 *   investors may tighten or loosen.
 * - Sector and instrument exclusions are empty by default. The architecture
 *   supports them for future investors with stated exclusions (e.g., ESG
 *   mandates).
 */

export type AssetClassBand = {
  asset_class: "Equity" | "Debt" | "Alternatives" | "Cash";
  min_pct: number;
  max_pct: number;
  /** Optional explicit target within the band (ADR-0032). When present it is
   * the deploy-to-target destination; when absent the target defaults to the
   * band midpoint. Use it where the intended target is asymmetric within the
   * band (a permissive ceiling that should not be read as the target, e.g.
   * Menon's pre-IPO/runway-widened Alternatives and Cash bands). */
  target_pct?: number;
};

export type WrapperCountCeiling = {
  wrapper_type: "pms" | "aif" | "any_wrapper";
  max_count: number;
};

export type PositionConcentrationCeiling = {
  scope: "single_position" | "single_sector" | "single_strategy";
  max_pct_of_liquid_aum: number;
};

/* ----- Sub-sleeve tilt framework (ADR-0033, the model-portfolio foundation
 * slice) -----
 *
 * The asset-class bands say HOW MUCH equity / debt / alternatives an investor
 * should hold. The sub-sleeve tilt says WHAT KIND within a sleeve. It is the
 * usable foundation of a model portfolio, built to be extended (not replaced)
 * when the full risk-appetite-by-time-horizon framework is formalised (product
 * debt P43). It drives the instrument-selection funnel (instrument-selection.ts).
 *
 * Equity allocates on TWO levels (ADR-0033, ADR-0035, ADR-0036):
 *   Level 1, domestic vs international (% of the equity sleeve), by risk tier.
 *   Level 2, domestic cap-split (% of the DOMESTIC portion), by risk tier.
 * International is its own bucket alongside the domestic cap-split, not inside
 * it. Every tier keeps a non-zero domestic large-cap core AND a non-zero,
 * non-dominant international allocation (the never-zero principle).
 *
 * Debt allocates on TWO axes (ADR-0037):
 *   Credit axis (% of the debt sleeve), by risk appetite.
 *   Duration axis, by the investor's time horizon (a selection preference).
 * Debt is the portfolio's ballast: even aggressive debt stays predominantly
 * sovereign+high-grade (credit-risk caps at 20%). */

/** Equity Level 1 + Level 2 split. international_pct is % of the equity sleeve;
 * domestic_{large,mid,small}_pct are % of the DOMESTIC portion (they sum to 100
 * within domestic), so the domestic share of the sleeve is 100 - international_pct. */
export type EquitySplit = {
  international_pct: number;
  domestic_large_pct: number;
  domestic_mid_pct: number;
  domestic_small_pct: number;
};

/** Debt credit split (% of the debt sleeve); sums to 100. */
export type DebtCreditSplit = {
  sovereign_pct: number;
  high_grade_pct: number;
  credit_risk_pct: number;
};

export type DurationBucket = "short" | "medium" | "long";

/* House-view defaults by risk tier. Tier strings match resolveHhiTier /
 * HHI_CEILING_BY_TIER in portfolio-risk-analytics.ts. A mandate may override via
 * Mandate.sub_sleeve_tilt (the ADR-0032 optional-field pattern). */
export const EQUITY_SPLIT_BY_TIER: Record<string, EquitySplit> = {
  Conservative: { international_pct: 10, domestic_large_pct: 75, domestic_mid_pct: 20, domestic_small_pct: 5 },
  "Moderate-Aggressive": { international_pct: 15, domestic_large_pct: 55, domestic_mid_pct: 35, domestic_small_pct: 10 },
  Aggressive: { international_pct: 20, domestic_large_pct: 35, domestic_mid_pct: 40, domestic_small_pct: 25 },
  "Ultra-Aggressive": { international_pct: 20, domestic_large_pct: 35, domestic_mid_pct: 40, domestic_small_pct: 25 },
};

export const DEBT_CREDIT_SPLIT_BY_TIER: Record<string, DebtCreditSplit> = {
  Conservative: { sovereign_pct: 55, high_grade_pct: 42, credit_risk_pct: 3 },
  "Moderate-Aggressive": { sovereign_pct: 35, high_grade_pct: 55, credit_risk_pct: 10 },
  Aggressive: { sovereign_pct: 25, high_grade_pct: 55, credit_risk_pct: 20 },
  "Ultra-Aggressive": { sovereign_pct: 25, high_grade_pct: 55, credit_risk_pct: 20 },
};

/** Map a free-text time horizon to the preferred debt duration bucket (ADR-0037).
 * Short horizon prefers short duration (limit rate risk); long horizon can hold
 * longer duration for yield. Defaults to long (the modal persona). */
export function durationForHorizon(timeHorizon: string): DurationBucket {
  const s = (timeHorizon || "").toLowerCase();
  if (/\bshort\b|under 3|<\s*3|0-3|1-3 ?y|near[- ]?term/.test(s)) return "short";
  if (/3-5|3 to 5|\bmedium\b|operational/.test(s)) return "medium";
  return "long";
}

export type SubSleeveTilt = {
  equity?: EquitySplit;
  debt_credit?: DebtCreditSplit;
};

export type Mandate = {
  bands: AssetClassBand[];
  wrapper_count_ceilings: WrapperCountCeiling[];
  position_concentration_ceilings: PositionConcentrationCeiling[];
  sector_exclusions: string[];
  instrument_exclusions: string[];
  /** Optional per-investor sub-sleeve tilt override (ADR-0033). When absent,
   * the house-view default for the investor's risk tier applies. */
  sub_sleeve_tilt?: SubSleeveTilt;
  /** Free-text mandate review cadence / governance note. */
  review_cadence_note: string;
  /** Authoring provenance: "foundation_default" when derived from the
   * model portfolio bands; "investor_specified" when the investor or
   * the foundation §4 profile fixes specific values. */
  source: "foundation_default" | "investor_specified";
  source_notes: string;
};

const STANDARD_AGGRESSIVE_LONG_TERM: AssetClassBand[] = [
  { asset_class: "Equity", min_pct: 60, max_pct: 70 },
  { asset_class: "Debt", min_pct: 20, max_pct: 30 },
  { asset_class: "Alternatives", min_pct: 5, max_pct: 10 },
  { asset_class: "Cash", min_pct: 2, max_pct: 5 },
];

const STANDARD_CONCENTRATION: PositionConcentrationCeiling[] = [
  { scope: "single_position", max_pct_of_liquid_aum: 15 },
];

const SHARMA_MANDATE: Mandate = {
  /* Per sharma_marcellus_evidence_verdicts.md case context line:
   * "mandate band equity 50-70 percent, currently 55 percent". The
   * widened band reflects family-business households' tolerance for
   * equity-heavier positioning. */
  bands: [
    { asset_class: "Equity", min_pct: 50, max_pct: 70 },
    { asset_class: "Debt", min_pct: 20, max_pct: 35 },
    { asset_class: "Alternatives", min_pct: 5, max_pct: 15 },
    { asset_class: "Cash", min_pct: 2, max_pct: 8 },
  ],
  wrapper_count_ceilings: [],
  position_concentration_ceilings: STANDARD_CONCENTRATION,
  sector_exclusions: [],
  instrument_exclusions: [],
  review_cadence_note:
    "Annual review; family-anchored; father as principal decision-maker; mandate authored against the household balance sheet, not just liquid AUM.",
  source: "investor_specified",
  source_notes:
    "Equity band widened to 50-70% per the verdicts file case context. No explicit wrapper-count ceiling.",
};

const BHATT_MANDATE: Mandate = {
  /* Per Slice 2 fixture briefing: "equity at 72.2% breaches the 60-70%
   * ceiling by 2.2 pp", confirms the 60-70 band. */
  bands: STANDARD_AGGRESSIVE_LONG_TERM,
  wrapper_count_ceilings: [],
  position_concentration_ceilings: STANDARD_CONCENTRATION,
  sector_exclusions: [],
  instrument_exclusions: [],
  review_cadence_note: "Annual review; principal decision-maker; family-business income.",
  source: "investor_specified",
  source_notes: "Standard aggressive long-term bands per foundation §1; matches Slice 2 fixture read.",
};

const MALHOTRA_MANDATE: Mandate = {
  bands: STANDARD_AGGRESSIVE_LONG_TERM,
  wrapper_count_ceilings: [],
  position_concentration_ceilings: STANDARD_CONCENTRATION,
  sector_exclusions: [],
  instrument_exclusions: [],
  review_cadence_note: "Annual review; dual-professional household.",
  source: "foundation_default",
  source_notes: "Standard aggressive long-term bands per foundation §1.",
};

const MENON_MANDATE: Mandate = {
  /* Aggressive long-term but post-exit accumulation-stage; widened
   * alternatives band to accommodate venture / pre-IPO positions, widened
   * cash band for the deployment runway. These widenings are one-sided
   * (permissive ceilings), so the band midpoint would overstate the intended
   * Alternatives and Cash targets; explicit target_pct states the intent
   * directly (ADR-0032). Targets 65/15/15/5 sum to 100 and sit within bands. */
  bands: [
    { asset_class: "Equity", min_pct: 55, max_pct: 70, target_pct: 65 },
    { asset_class: "Debt", min_pct: 15, max_pct: 30, target_pct: 15 },
    { asset_class: "Alternatives", min_pct: 5, max_pct: 20, target_pct: 15 },
    { asset_class: "Cash", min_pct: 2, max_pct: 10, target_pct: 5 },
  ],
  wrapper_count_ceilings: [],
  position_concentration_ceilings: STANDARD_CONCENTRATION,
  sector_exclusions: [],
  instrument_exclusions: [],
  review_cadence_note:
    "Annual review; tech-founder post-exit; expects to deploy NRE conversion proceeds over 18-24 months.",
  source: "investor_specified",
  source_notes:
    "Alternatives band widened to 5-20% to accommodate venture / pre-IPO positions; cash band widened for deployment runway.",
};

const SURANA_MANDATE: Mandate = {
  bands: STANDARD_AGGRESSIVE_LONG_TERM,
  wrapper_count_ceilings: [],
  position_concentration_ceilings: STANDARD_CONCENTRATION,
  sector_exclusions: [],
  instrument_exclusions: [],
  review_cadence_note: "Annual review; tech-founder; equity sleeve drives the AUM total.",
  source: "foundation_default",
  source_notes:
    "Standard aggressive long-term bands; advisory scope excludes the Rs 165 Cr unlisted founder stake.",
};

const IYENGAR_MANDATE: Mandate = {
  /* Conservative medium-term widow: tighter equity ceiling, deeper debt
   * floor, alternatives only for capital-protected vehicles. */
  bands: [
    { asset_class: "Equity", min_pct: 25, max_pct: 45 },
    { asset_class: "Debt", min_pct: 45, max_pct: 65 },
    { asset_class: "Alternatives", min_pct: 0, max_pct: 10 },
    { asset_class: "Cash", min_pct: 3, max_pct: 10 },
  ],
  wrapper_count_ceilings: [{ wrapper_type: "any_wrapper", max_count: 1 }],
  position_concentration_ceilings: [
    { scope: "single_position", max_pct_of_liquid_aum: 12 },
  ],
  sector_exclusions: [],
  instrument_exclusions: ["aif_cat_iii_long_short", "unlisted_pre_ipo"],
  review_cadence_note:
    "Semi-annual review; distribution phase; capital protection prioritised over compounding.",
  source: "investor_specified",
  source_notes:
    "Mandate tightened for conservative-medium-term profile: equity 25-45%, debt 45-65%, no Cat III AIF, no pre-IPO.",
};

export const MANDATES_BY_INVESTOR: Record<string, Mandate> = {
  sharma: SHARMA_MANDATE,
  bhatt: BHATT_MANDATE,
  malhotra: MALHOTRA_MANDATE,
  menon: MENON_MANDATE,
  surana: SURANA_MANDATE,
  iyengar: IYENGAR_MANDATE,
};
