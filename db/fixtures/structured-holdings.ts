/* Structured portfolio holdings for the six seeded investors.
 *
 * The foundation document Section 4 has each archetype's holdings as a
 * markdown table inside the profile prose. The pipeline needs the same data
 * in a structured form for deterministic computation (HHI, top-N, sector
 * roll-ups, look-through against the snapshot's mf_funds top-5 holdings).
 *
 * Code/data split (ADR-0027, consumer side): the holding records themselves
 * are proprietary curated data and no longer live inline in this file. They
 * are published by the private Samriddhi-AI-Data-Snapshots repo as
 * structured_holdings.json and fetched into db/fixtures/ by
 * `npm run setup-data` (gitignored locally; pinned via data-version.txt).
 * This file keeps the TypeScript types and a thin synchronous loader; the
 * named exports below preserve the original import surface so every consumer
 * (db/seed.ts, the pipeline agents, the verify scripts) is unchanged.
 *
 * db/seed.ts serialises each record into Investor.holdingsJson at seed time.
 * The pipeline reads from the DB and parses back into StructuredHoldings.
 *
 * The sub_category enum tracks foundation §3's Asset Class Taxonomy exactly.
 *
 * Each investor's total is computed against the sum of holding values; the
 * weights match the foundation §4 tables. For Surana, advisory-scope weights
 * exclude the Rs 165 Cr unlisted_pre_ipo founder stake (recorded under
 * excludedHoldings instead).
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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

/* Snapshot-alignment cleanup, post-Gate 1.
 *
 * The foundation §4 archetype tables were authored independently of the
 * snapshot's actual fund inventory. Four instrument labels diverged and
 * were corrected in the curated data (now carried in structured_holdings.json):
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
 * cases generated after this cleanup reference the corrected names. */

const STRUCTURED_HOLDINGS_JSON = path.resolve(
  process.cwd(),
  "db",
  "fixtures",
  "structured_holdings.json",
);

/* Loads the curated holdings data fetched from the private data repo.
 * Synchronous because the named exports below are evaluated at module load
 * and consumed via synchronous imports across the pipeline and scripts. */
function loadStructuredHoldings(): Record<string, StructuredHoldings> {
  if (!existsSync(STRUCTURED_HOLDINGS_JSON)) {
    throw new Error(
      "Structured holdings data not found at " +
        STRUCTURED_HOLDINGS_JSON +
        ". Run `npm run setup-data` to fetch the proprietary data from the " +
        "private Samriddhi-AI-Data-Snapshots repo (see the README Data Setup section).",
    );
  }
  return JSON.parse(
    readFileSync(STRUCTURED_HOLDINGS_JSON, "utf-8"),
  ) as Record<string, StructuredHoldings>;
}

const _holdings = loadStructuredHoldings();

export const HOLDINGS_BY_INVESTOR: Record<string, StructuredHoldings> = _holdings;
export const MALHOTRA_HOLDINGS: StructuredHoldings = _holdings.malhotra;
export const IYENGAR_HOLDINGS: StructuredHoldings = _holdings.iyengar;
export const BHATT_HOLDINGS: StructuredHoldings = _holdings.bhatt;
export const MENON_HOLDINGS: StructuredHoldings = _holdings.menon;
export const SURANA_HOLDINGS: StructuredHoldings = _holdings.surana;
export const SHARMA_HOLDINGS: StructuredHoldings = _holdings.sharma;
