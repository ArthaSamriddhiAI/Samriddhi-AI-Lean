/* The canonical ingestion envelope (Package 07, B3).
 *
 * Every format adapter emits this one shape; the reconciliation gate consumes
 * it. Per-field provenance keeps each parsed number traceable to its file and
 * location, so the onboarding workbench can show where a value came from and
 * the gate can point at exactly what failed.
 */

export type Provenance = {
  file: string;
  /* Human-readable locator: a page and line for PDFs, a sheet cell for
   * spreadsheets, a line number for text. */
  locator: string;
};

export type ParsedTransaction = {
  /* ISO date. */
  date: string;
  type: string;
  amountInr: number | null;
  units: number | null;
  nav: number | null;
  unitBalance: number | null;
  provenance: Provenance;
};

export type ParsedFolio = {
  fundLabel: string;
  folioNo: string | null;
  isin: string | null;
  transactions: ParsedTransaction[];
  closingUnits: number | null;
  closingNav: number | null;
  closingNavDate: string | null;
  marketValueInr: number | null;
  provenance: Provenance;
};

export type ParsedHolding = {
  rawLabel: string;
  valueInr: number | null;
  /* Optional texture from the source (a category column, a notes cell). */
  detail: string | null;
  /* Adapter confidence: exact (structured cell or reconciled table row) or
   * heuristic (pattern-extracted from prose). The workbench surfaces this;
   * heuristic rows are advisor-confirm, never silently accepted. */
  confidence: "exact" | "heuristic";
  provenance: Provenance;
};

export type ParsedDocument = {
  sourceFile: string;
  format: "ecas_pdf" | "xlsx" | "text_tabular" | "email_text";
  /* Statement-level identity strings found in the document (names, PANs,
   * emails). Kept verbatim here (ingestion is local-only); the PII layer
   * strips them before anything model-facing. */
  identityStrings: string[];
  holdings: ParsedHolding[];
  folios: ParsedFolio[];
  /* Honest notes about what the adapter could not parse. */
  warnings: string[];
};
