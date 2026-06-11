/* generate-investor-transactions: build the canonical transaction-bearing
 * fixture (db/fixtures/investor-transactions.ts) from the synthetic ingestion
 * corpus (Package 07, B5).
 *
 * Inputs (committed, fixtures/ingestion-corpus/a1_a5/):
 *   - holdings_a1_a5.json: the 41 canonical per-holding rows for the five
 *     demo investors (quantity, cost basis, purchase date, vehicle attrs).
 *   - transactions_*.json: structured eCAS truth for the MF folios of the
 *     three statement-bearing investors (real monthly_nav pricing).
 *
 * Mapping: within an investor, (subCategory, valueCr) uniquely identifies the
 * frozen structured-holdings entry for every one of the 41 rows (asserted),
 * which absorbs the label renames between the corpus rows and the frozen
 * fixtures (Axis Bluechip to Axis Large Cap, Motilal Value Strategy to Value
 * Migration, Aditya Birla Arbitrage to HDFC Arbitrage, and similar).
 *
 * The build refuses to emit unless deriveStructuredHoldings() reproduces the
 * frozen StructuredHoldings byte-identically for all five investors (the B5
 * freeze invariant). Deterministic; run via:
 *
 *   npx tsx scripts/generate-investor-transactions.ts
 *
 * Pure local computation; no network, no API (WA12 not engaged).
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { HOLDINGS_BY_INVESTOR } from "../db/fixtures/structured-holdings";
import {
  deriveStructuredHoldings,
  type CanonicalExcludedHolding,
  type CanonicalHolding,
  type CanonicalInvestorRecord,
  type CanonicalTransaction,
} from "../db/fixtures/canonical-holdings";

const ROOT = process.cwd();
const CORPUS = path.join(ROOT, "fixtures", "ingestion-corpus", "a1_a5");
const OUT = path.join(ROOT, "db", "fixtures", "investor-transactions.ts");

/* Corpus archetype id -> app investor id (the A1-A5 holdings file keys; note
 * these differ from the extended file's use of the same numbers). */
const ARCHETYPE_TO_INVESTOR: Record<string, string> = {
  investor_archetype_03: "malhotra",
  investor_archetype_01: "iyengar",
  investor_archetype_08: "bhatt",
  investor_archetype_05: "menon",
  investor_archetype_09: "surana",
};

const TXN_FILES: Record<string, string> = {
  malhotra: "transactions_01_malhotras.json",
  iyengar: "transactions_02_lalitha_iyengar.json",
  surana: "transactions_05_rajiv_surana.json",
};

type CorpusRow = {
  investor_id: string;
  instrument_display_name: string;
  asset_class: string;
  sub_category: string;
  quantity: number;
  cost_basis_per_unit_inr: number;
  cost_basis_total_inr: number;
  purchase_date: string;
  current_market_value_inr: number;
  vehicle_specific_attributes?: Record<string, unknown>;
};

type CorpusFolio = {
  fund_name: string;
  resolved_fund_name: string;
  amfi_code: number;
  folio_no: string;
  anchor_month: string;
  closing_nav: number;
  closing_units: number;
  transactions: Array<{
    date: string;
    type: string;
    amount_inr: number | null;
    units: number | null;
    nav: number | null;
    unit_balance: number | null;
  }>;
};

function fail(msg: string): never {
  console.error("generate-investor-transactions FAILED: " + msg);
  process.exit(1);
}

function key(subCategory: string, valueCr: number): string {
  return subCategory + "|" + valueCr.toFixed(4);
}

function main(): void {
  const holdingsDoc = JSON.parse(
    readFileSync(path.join(CORPUS, "holdings_a1_a5.json"), "utf-8"),
  ) as { rows: CorpusRow[] };

  const rowsByInvestor = new Map<string, CorpusRow[]>();
  for (const r of holdingsDoc.rows) {
    const inv = ARCHETYPE_TO_INVESTOR[r.investor_id];
    if (!inv) fail("unknown archetype id " + r.investor_id);
    if (!rowsByInvestor.has(inv)) rowsByInvestor.set(inv, []);
    rowsByInvestor.get(inv)!.push(r);
  }

  const foliosByInvestor = new Map<string, CorpusFolio[]>();
  for (const [inv, file] of Object.entries(TXN_FILES)) {
    const doc = JSON.parse(readFileSync(path.join(CORPUS, file), "utf-8")) as {
      folios: CorpusFolio[];
    };
    foliosByInvestor.set(inv, doc.folios);
  }

  const records: CanonicalInvestorRecord[] = [];
  const order = ["malhotra", "iyengar", "bhatt", "menon", "surana"];

  for (const inv of order) {
    const frozen = HOLDINGS_BY_INVESTOR[inv];
    const rows = rowsByInvestor.get(inv) ?? [];
    const archetypeId = Object.entries(ARCHETYPE_TO_INVESTOR).find(
      ([, v]) => v === inv,
    )![0];

    // Index corpus rows by (subCategory, valueCr); assert uniqueness.
    const rowIndex = new Map<string, CorpusRow>();
    for (const r of rows) {
      const k = key(r.sub_category, r.current_market_value_inr / 1e7);
      if (rowIndex.has(k)) fail(inv + ": ambiguous row key " + k);
      rowIndex.set(k, r);
    }

    const folios = foliosByInvestor.get(inv) ?? [];
    const folioByRawLabel = new Map(folios.map((f) => [f.fund_name, f]));
    const consumed = new Set<string>();

    const holdings: CanonicalHolding[] = frozen.holdings.map((fh) => {
      const k = key(fh.subCategory, fh.valueCr);
      const row = rowIndex.get(k);
      if (!row) fail(inv + ": no corpus row matches frozen holding '" + fh.instrument + "' (" + k + ")");
      consumed.add(k);
      const folio = folioByRawLabel.get(row.instrument_display_name) ?? null;
      const txns: CanonicalTransaction[] | null = folio
        ? folio.transactions.map((t) => ({
            date: t.date,
            type: t.type,
            amountInr: t.amount_inr,
            units: t.units,
            nav: t.nav,
            unitBalance: t.unit_balance,
          }))
        : null;
      return {
        instrument: fh.instrument,
        rawLabel: row.instrument_display_name,
        assetClass: fh.assetClass,
        subCategory: fh.subCategory,
        valueCr: fh.valueCr,
        quantity: folio ? folio.closing_units : row.quantity ?? null,
        costBasisTotalInr: row.cost_basis_total_inr ?? null,
        costBasisPerUnitInr: row.cost_basis_per_unit_inr ?? null,
        purchaseDate: row.purchase_date ?? null,
        vehicleAttributes:
          row.vehicle_specific_attributes &&
          Object.keys(row.vehicle_specific_attributes).length > 0
            ? row.vehicle_specific_attributes
            : null,
        resolvedInstrument: folio ? folio.resolved_fund_name : null,
        amfiCode: folio ? folio.amfi_code : null,
        folioNo: folio ? folio.folio_no : null,
        navAnchorMonth: folio ? folio.anchor_month : null,
        closingNav: folio ? folio.closing_nav : null,
        closingUnits: folio ? folio.closing_units : null,
        transactions: txns,
      };
    });

    const excluded: CanonicalExcludedHolding[] = (
      frozen.excludedHoldings ?? []
    ).map((fe) => {
      const k = key(fe.subCategory, fe.valueCr);
      const row = rowIndex.get(k);
      if (!row) fail(inv + ": no corpus row matches excluded holding '" + fe.instrument + "'");
      consumed.add(k);
      return {
        instrument: fe.instrument,
        rawLabel: row.instrument_display_name,
        subCategory: fe.subCategory,
        valueCr: fe.valueCr,
        note: fe.note,
        purchaseDate: row.purchase_date ?? null,
        costBasisTotalInr: row.cost_basis_total_inr ?? null,
      };
    });

    const leftover = rows.filter(
      (r) => !consumed.has(key(r.sub_category, r.current_market_value_inr / 1e7)),
    );
    if (leftover.length > 0) {
      fail(
        inv + ": corpus rows not matched to any frozen holding: " +
          leftover.map((r) => r.instrument_display_name).join(", "),
      );
    }

    // Every eCAS folio must have attached to exactly one holding.
    const attached = holdings.filter((h) => h.transactions !== null).length;
    if (attached !== folios.length) {
      fail(inv + ": " + folios.length + " corpus folios but " + attached + " attached");
    }

    const record: CanonicalInvestorRecord = {
      investorId: inv,
      archetypeId,
      totalLiquidAumCr: frozen.totalLiquidAumCr,
      holdings,
      excludedHoldings: excluded.length > 0 ? excluded : null,
    };

    // The B5 freeze invariant, enforced at build time.
    const derived = deriveStructuredHoldings(record);
    if (JSON.stringify(derived) !== JSON.stringify(frozen)) {
      fail(inv + ": derived StructuredHoldings is not byte-identical to the frozen fixture");
    }

    records.push(record);
  }

  const totalTxns = records
    .flatMap((r) => r.holdings)
    .reduce((n, h) => n + (h.transactions?.length ?? 0), 0);

  const banner =
    "/* GENERATED FILE, do not edit by hand.\n" +
    " *\n" +
    " * Canonical transaction-bearing records for the five demo investors\n" +
    " * (Package 07, B5). Generated by scripts/generate-investor-transactions.ts\n" +
    " * from fixtures/ingestion-corpus/a1_a5/ (holdings rows plus structured eCAS\n" +
    " * truth priced on the real snapshot monthly_nav series). The derived\n" +
    " * StructuredHoldings shape is byte-identical to db/fixtures/\n" +
    " * structured-holdings.ts for every investor (asserted at generation and by\n" +
    " * scripts/_verify-holdings-identity.ts). Regenerate with:\n" +
    " *\n" +
    " *   npx tsx scripts/generate-investor-transactions.ts\n" +
    " */\n\n" +
    'import type { CanonicalInvestorRecord } from "./canonical-holdings";\n\n' +
    "export const INVESTOR_TRANSACTIONS: CanonicalInvestorRecord[] = ";

  writeFileSync(OUT, banner + JSON.stringify(records, null, 2) + ";\n");
  console.log(
    "wrote " + path.relative(ROOT, OUT) + ": " + records.length +
      " investors, " + records.flatMap((r) => r.holdings).length +
      " holdings, " + totalTxns + " transactions; freeze invariant PASS x" +
      records.length,
  );
}

main();
