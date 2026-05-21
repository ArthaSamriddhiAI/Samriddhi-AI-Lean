/* Structured mandate data for the six seeded investors.
 *
 * Slice 2 ignored mandate data; the diagnostic agents read risk_appetite
 * and time_horizon directly from the Investor row. Slice 3 introduces the
 * G1 mandate-compliance governance gate, which requires structured bands
 * and ceilings to evaluate against. This file is the type surface and a thin
 * loader; db/seed.ts serialises each record into Investor.mandateJson at seed
 * time, and the pipeline reads back via JSON.parse.
 *
 * Code/data split (ADR-0027, consumer side): the mandate records themselves
 * are proprietary curated data and no longer live inline here. They are
 * published by the private Samriddhi-AI-Data-Snapshots repo as
 * structured_mandates.json and fetched into db/fixtures/ by
 * `npm run setup-data` (gitignored locally; pinned via data-version.txt).
 * MANDATES_BY_INVESTOR preserves the original import surface. The per-investor
 * authoring rationale that previously sat in inline comments is carried in
 * each record's source_notes field.
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

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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

const STRUCTURED_MANDATES_JSON = path.resolve(
  process.cwd(),
  "db",
  "fixtures",
  "structured_mandates.json",
);

/* Loads the curated mandate data fetched from the private data repo.
 * Synchronous because MANDATES_BY_INVESTOR is evaluated at module load and
 * consumed via synchronous imports across the pipeline and scripts. */
function loadStructuredMandates(): Record<string, Mandate> {
  if (!existsSync(STRUCTURED_MANDATES_JSON)) {
    throw new Error(
      "Structured mandates data not found at " +
        STRUCTURED_MANDATES_JSON +
        ". Run `npm run setup-data` to fetch the proprietary data from the " +
        "private Samriddhi-AI-Data-Snapshots repo (see the README Data Setup section).",
    );
  }
  return JSON.parse(
    readFileSync(STRUCTURED_MANDATES_JSON, "utf-8"),
  ) as Record<string, Mandate>;
}

export const MANDATES_BY_INVESTOR: Record<string, Mandate> = loadStructuredMandates();
