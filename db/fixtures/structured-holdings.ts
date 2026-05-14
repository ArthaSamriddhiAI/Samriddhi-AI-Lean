/* Structured portfolio holdings for the six seeded investors.
 *
 * The foundation document Section 4 has each archetype's holdings as a
 * markdown table inside the profile prose. The pipeline needs the same data
 * in a structured form for deterministic computation (HHI, top-N, sector
 * roll-ups, look-through against the snapshot's mf_funds top-5 holdings).
 *
 * This file is the structured source of truth. db/seed.ts serialises each
 * record into Investor.holdingsJson at seed time. The pipeline reads from
 * the DB and parses back into StructuredHoldings.
 *
 * The sub_category enum tracks foundation §3's Asset Class Taxonomy exactly.
 *
 * Each investor's total is computed against the sum of holding values; the
 * weights match the foundation §4 tables. For Surana, advisory-scope weights
 * exclude the Rs 165 Cr unlisted_pre_ipo founder stake (recorded under
 * excludedHoldings instead).
 */

export type AssetClass = "Equity" | "Debt" | "Alternatives" | "Cash";

export type SubCategory =
  // Equity
  | "mf_active_large_cap"
  | "mf_passive_index"
  | "mf_active_flexi_cap"
  | "mf_active_mid_cap"
  | "mf_active_small_cap"
  | "mf_hybrid_dynamic_aa"
  | "pms_growth_quality"
  | "pms_concentrated_quality"
  | "pms_value"
  | "pms_focused_midcap"
  | "listed_large_cap"
  | "intl_us_etf"
  | "intl_us_individual"
  | "unlisted_family_business"
  | "unlisted_pre_ipo"
  // Debt
  | "bank_fd"
  | "tax_free_bond"
  | "mf_corporate_debt"
  | "mf_short_term_debt"
  | "mf_arbitrage"
  // Alternatives
  | "aif_cat_ii_pe"
  | "aif_cat_ii_real_estate"
  | "aif_cat_ii_private_credit"
  | "aif_cat_iii_long_short"
  | "physical_gold"
  | "sovereign_gold_bond"
  | "reit"
  // Cash
  | "savings";

export type Holding = {
  instrument: string;
  assetClass: AssetClass;
  subCategory: SubCategory;
  valueCr: number;
  weightPct: number;
};

export type ExcludedHolding = {
  instrument: string;
  subCategory: SubCategory;
  valueCr: number;
  note: string;
};

export type StructuredHoldings = {
  totalLiquidAumCr: number;
  holdings: Holding[];
  /* Out-of-advisory-scope positions: founder shares, family business equity,
   * locked stakes. Referenced in narrative; excluded from deterministic
   * metrics so weights stay sensible. */
  excludedHoldings?: ExcludedHolding[];
};

export const MALHOTRA_HOLDINGS: StructuredHoldings = {
  totalLiquidAumCr: 11.85,
  holdings: [
    { instrument: "Mirae Asset Large Cap Fund", assetClass: "Equity", subCategory: "mf_active_large_cap", valueCr: 1.85, weightPct: 15.6 },
    { instrument: "Axis Large Cap Fund", assetClass: "Equity", subCategory: "mf_active_large_cap", valueCr: 1.40, weightPct: 11.8 },
    { instrument: "Parag Parikh Flexi Cap Fund", assetClass: "Equity", subCategory: "mf_active_flexi_cap", valueCr: 1.68, weightPct: 14.2 },
    { instrument: "Kotak Emerging Equity Fund", assetClass: "Equity", subCategory: "mf_active_mid_cap", valueCr: 1.25, weightPct: 10.5 },
    { instrument: "NHAI Tax-Free Bonds 2032", assetClass: "Debt", subCategory: "tax_free_bond", valueCr: 2.15, weightPct: 18.1 },
    { instrument: "PFC Tax-Free Bonds 2031", assetClass: "Debt", subCategory: "tax_free_bond", valueCr: 0.97, weightPct: 8.2 },
    { instrument: "HDFC Bank FD", assetClass: "Debt", subCategory: "bank_fd", valueCr: 1.55, weightPct: 13.1 },
    { instrument: "Physical gold", assetClass: "Alternatives", subCategory: "physical_gold", valueCr: 1.00, weightPct: 8.4 },
  ],
};

export const IYENGAR_HOLDINGS: StructuredHoldings = {
  totalLiquidAumCr: 3.41,
  holdings: [
    { instrument: "HDFC Bank FD", assetClass: "Debt", subCategory: "bank_fd", valueCr: 0.93, weightPct: 27.3 },
    { instrument: "SBI FD", assetClass: "Debt", subCategory: "bank_fd", valueCr: 0.92, weightPct: 27.0 },
    { instrument: "Franklin India Corporate Debt Fund", assetClass: "Debt", subCategory: "mf_corporate_debt", valueCr: 0.35, weightPct: 10.3 },
    { instrument: "Axis Large Cap Fund", assetClass: "Equity", subCategory: "mf_active_large_cap", valueCr: 0.40, weightPct: 11.7 },
    { instrument: "HDFC Index Fund Nifty 50", assetClass: "Equity", subCategory: "mf_passive_index", valueCr: 0.48, weightPct: 14.1 },
    { instrument: "ICICI Prudential Balanced Advantage Fund", assetClass: "Equity", subCategory: "mf_hybrid_dynamic_aa", valueCr: 0.33, weightPct: 9.7 },
  ],
};

/* Snapshot-alignment cleanup, post-Gate 1.
 *
 * The foundation §4 archetype tables were authored independently of the
 * snapshot's actual fund inventory. Four instrument labels diverged and
 * were corrected here:
 *
 *   - Bhatt: "Motilal Oswal Value Strategy PMS" → "Motilal Oswal Value
 *     Migration PMS" (snapshot has 7 Motilal Oswal PMS strategies;
 *     "Value Migration" is the closest to the foundation's pms_value
 *     intent. "Value Strategy" does not exist.)
 *   - Bhatt: "Aditya Birla Arbitrage Fund" → "HDFC Arbitrage Fund"
 *     (94 Aditya Birla funds in snapshot, none of them arbitrage; HDFC
 *     Arbitrage Fund is a real fund that keeps Shailesh's mf_arbitrage
 *     intent.)
 *   - Malhotra / Iyengar / Surana: "Axis Bluechip Fund" → "Axis Large
 *     Cap Fund" (the fund was renamed under SEBI category rebranding;
 *     the snapshot reflects the post-rename "Axis Large Cap Fund".)
 *   - Iyengar: "ICICI Pru Balanced Advantage Fund" → "ICICI Prudential
 *     Balanced Advantage Fund" (snapshot uses the full "Prudential"
 *     style.)
 *
 * The existing Shailesh case (c-2026-05-14-bhatt-01) was generated
 * against the pre-cleanup labels and retains them in its frozen
 * contentJson per "case is a frozen artefact" semantics. Subsequent
 * cases generated after this cleanup will reference the corrected names. */
export const BHATT_HOLDINGS: StructuredHoldings = {
  totalLiquidAumCr: 22.10,
  holdings: [
    { instrument: "Marcellus Consistent Compounder PMS", assetClass: "Equity", subCategory: "pms_concentrated_quality", valueCr: 2.50, weightPct: 11.3 },
    { instrument: "White Oak India Pioneers PMS", assetClass: "Equity", subCategory: "pms_growth_quality", valueCr: 2.20, weightPct: 10.0 },
    { instrument: "Motilal Oswal Value Migration PMS", assetClass: "Equity", subCategory: "pms_value", valueCr: 2.10, weightPct: 9.5 },
    { instrument: "Alchemy Smart Alpha 250 PMS", assetClass: "Equity", subCategory: "pms_focused_midcap", valueCr: 1.90, weightPct: 8.6 },
    { instrument: "Reliance Industries", assetClass: "Equity", subCategory: "listed_large_cap", valueCr: 2.70, weightPct: 12.2 },
    { instrument: "HDFC Bank", assetClass: "Equity", subCategory: "listed_large_cap", valueCr: 2.50, weightPct: 11.3 },
    { instrument: "ITC Limited", assetClass: "Equity", subCategory: "listed_large_cap", valueCr: 1.10, weightPct: 5.0 },
    { instrument: "Mirae Asset Large Cap Fund", assetClass: "Equity", subCategory: "mf_active_large_cap", valueCr: 0.50, weightPct: 2.3 },
    { instrument: "Parag Parikh Flexi Cap Fund", assetClass: "Equity", subCategory: "mf_active_flexi_cap", valueCr: 0.45, weightPct: 2.0 },
    { instrument: "Avendus Absolute Return Fund", assetClass: "Alternatives", subCategory: "aif_cat_iii_long_short", valueCr: 3.00, weightPct: 13.6 },
    { instrument: "HDFC Bank FD", assetClass: "Debt", subCategory: "bank_fd", valueCr: 1.55, weightPct: 7.0 },
    { instrument: "HDFC Arbitrage Fund", assetClass: "Debt", subCategory: "mf_arbitrage", valueCr: 1.60, weightPct: 7.2 },
  ],
};

export const MENON_HOLDINGS: StructuredHoldings = {
  totalLiquidAumCr: 60.65,
  holdings: [
    { instrument: "Bank savings account", assetClass: "Cash", subCategory: "savings", valueCr: 52.50, weightPct: 86.6 },
    { instrument: "HDFC Bank FD", assetClass: "Debt", subCategory: "bank_fd", valueCr: 4.15, weightPct: 6.8 },
    { instrument: "US listed equities (legacy holding)", assetClass: "Equity", subCategory: "intl_us_individual", valueCr: 4.00, weightPct: 6.6 },
  ],
};

export const SURANA_HOLDINGS: StructuredHoldings = {
  totalLiquidAumCr: 34.50,
  holdings: [
    { instrument: "Parag Parikh Flexi Cap Fund", assetClass: "Equity", subCategory: "mf_active_flexi_cap", valueCr: 4.00, weightPct: 11.6 },
    { instrument: "Axis Large Cap Fund", assetClass: "Equity", subCategory: "mf_active_large_cap", valueCr: 3.80, weightPct: 11.0 },
    { instrument: "Mirae Asset Large Cap Fund", assetClass: "Equity", subCategory: "mf_active_large_cap", valueCr: 3.00, weightPct: 8.7 },
    { instrument: "Kotak Emerging Equity Fund", assetClass: "Equity", subCategory: "mf_active_mid_cap", valueCr: 3.00, weightPct: 8.7 },
    { instrument: "SBI Small Cap Fund", assetClass: "Equity", subCategory: "mf_active_small_cap", valueCr: 2.20, weightPct: 6.4 },
    { instrument: "White Oak India Pioneers PMS", assetClass: "Equity", subCategory: "pms_growth_quality", valueCr: 3.00, weightPct: 8.7 },
    { instrument: "Reliance Industries", assetClass: "Equity", subCategory: "listed_large_cap", valueCr: 7.00, weightPct: 20.3 },
    { instrument: "HDFC Bank", assetClass: "Equity", subCategory: "listed_large_cap", valueCr: 2.00, weightPct: 5.8 },
    { instrument: "Vanguard S&P 500 ETF (GIFT)", assetClass: "Equity", subCategory: "intl_us_etf", valueCr: 3.00, weightPct: 8.7 },
    { instrument: "Physical gold", assetClass: "Alternatives", subCategory: "physical_gold", valueCr: 2.00, weightPct: 5.8 },
    { instrument: "Bank savings", assetClass: "Cash", subCategory: "savings", valueCr: 1.50, weightPct: 4.3 },
  ],
  excludedHoldings: [
    {
      instrument: "B2B SaaS Pvt Ltd founder shares",
      subCategory: "unlisted_pre_ipo",
      valueCr: 165.00,
      note: "Pre-IPO founder stake (26% of company; Series D 2025 post-money). Outside advisory scope per foundation §4; the dominant wealth driver but not a diversification.",
    },
  ],
};

export const SHARMA_HOLDINGS: StructuredHoldings = {
  totalLiquidAumCr: 18.00,
  holdings: [
    { instrument: "Mirae Asset Large Cap Fund", assetClass: "Equity", subCategory: "mf_active_large_cap", valueCr: 3.20, weightPct: 17.8 },
    { instrument: "Parag Parikh Flexi Cap Fund", assetClass: "Equity", subCategory: "mf_active_flexi_cap", valueCr: 3.00, weightPct: 16.7 },
    { instrument: "Kotak Emerging Equity Fund", assetClass: "Equity", subCategory: "mf_active_mid_cap", valueCr: 2.26, weightPct: 12.6 },
    { instrument: "White Oak India Pioneers PMS", assetClass: "Equity", subCategory: "pms_growth_quality", valueCr: 1.44, weightPct: 8.0 },
    { instrument: "HDFC Bank FD", assetClass: "Debt", subCategory: "bank_fd", valueCr: 2.80, weightPct: 15.6 },
    { instrument: "SBI FD", assetClass: "Debt", subCategory: "bank_fd", valueCr: 2.60, weightPct: 14.4 },
    { instrument: "Cat II private credit AIF (2024 vintage)", assetClass: "Alternatives", subCategory: "aif_cat_ii_private_credit", valueCr: 1.80, weightPct: 10.0 },
    { instrument: "Bank savings", assetClass: "Cash", subCategory: "savings", valueCr: 0.90, weightPct: 5.0 },
  ],
  excludedHoldings: [
    {
      instrument: "Sharma specialty chemicals family business",
      subCategory: "unlisted_family_business",
      valueCr: 50.00,
      note: "Operating family business equity (Rs 40-60 Cr estimated). Outside advisory scope per foundation §3; tracked as wealth reference, not deployed-corpus concentration.",
    },
  ],
};

export const HOLDINGS_BY_INVESTOR: Record<string, StructuredHoldings> = {
  malhotra: MALHOTRA_HOLDINGS,
  iyengar: IYENGAR_HOLDINGS,
  bhatt: BHATT_HOLDINGS,
  menon: MENON_HOLDINGS,
  surana: SURANA_HOLDINGS,
  sharma: SHARMA_HOLDINGS,
};
