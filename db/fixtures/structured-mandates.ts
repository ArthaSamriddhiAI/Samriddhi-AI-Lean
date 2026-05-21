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
};

export type WrapperCountCeiling = {
  wrapper_type: "pms" | "aif" | "any_wrapper";
  max_count: number;
};

export type PositionConcentrationCeiling = {
  scope: "single_position" | "single_sector" | "single_strategy";
  max_pct_of_liquid_aum: number;
};

export type Mandate = {
  bands: AssetClassBand[];
  wrapper_count_ceilings: WrapperCountCeiling[];
  position_concentration_ceilings: PositionConcentrationCeiling[];
  sector_exclusions: string[];
  instrument_exclusions: string[];
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
   * ceiling by 2.2 pp" — confirms the 60-70 band. */
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
   * alternatives band to accommodate venture / pre-IPO positions. */
  bands: [
    { asset_class: "Equity", min_pct: 55, max_pct: 70 },
    { asset_class: "Debt", min_pct: 15, max_pct: 30 },
    { asset_class: "Alternatives", min_pct: 5, max_pct: 20 },
    { asset_class: "Cash", min_pct: 2, max_pct: 10 },
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
