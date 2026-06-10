/* The onboarding workbench core (Package 07, B4): pure assembly from parsed
 * documents to the workbench view-model, the four gate tiles, and, when the
 * gate is green, the canonical transaction-bearing record (ADR-0052) plus its
 * derived demo-surface shape.
 *
 * Pure and deterministic so the whole flow is offline-verifiable
 * (scripts/_verify-onboarding.ts); the server actions stay thin wrappers.
 * The gate vocabulary mirrors the ratified wireframe exactly: totals tie,
 * statement ladders, NAV basis versus snapshot, name resolution (the WA26
 * check running inline; the lock is impossible while a name is unresolved
 * and not explicitly accepted).
 *
 * Gate 2 boundary, deliberately unbuilt: heuristic rows that carry NO parsed
 * value (prose mentions like "some gold with the family jeweller") are PARKED,
 * excluded from the record, and surfaced as such; no freehand value entry
 * exists anywhere in this build pending the primary's provenance ruling.
 */

import type { ParsedDocument, ParsedFolio, ParsedHolding } from "../ingestion/types";
import {
  reconcileEcas,
  resolveFundName,
  type AliasMap,
  type FundUniverseEntry,
  type GateCheck,
} from "../ingestion/reconcile";
import type {
  CanonicalExcludedHolding,
  CanonicalHolding,
  CanonicalInvestorRecord,
  CanonicalTransaction,
} from "../../db/fixtures/canonical-holdings";
import { deriveStructuredHoldings } from "../../db/fixtures/canonical-holdings";
import type { AssetClass, SubCategory, StructuredHoldings } from "../../db/fixtures/structured-holdings";

export type RowSource = "statement" | "listing" | "both" | "notes";

export type WorkbenchRow = {
  /* Stable key for resolutions, confirmations, and overrides. */
  key: string;
  instrument: string;
  rawLabel: string;
  source: RowSource;
  valueInr: number | null;
  provenance: string[];
  confidence: "exact" | "heuristic";
  /* Confirmed by the advisor (heuristic rows only; exact rows are implicit). */
  confirmed: boolean;
  subCategory: SubCategory | null;
  /* Fund-identity resolution state (MF rows). */
  resolution:
    | { state: "resolved"; fundName: string }
    | { state: "unresolved"; candidates: string[] }
    | { state: "accepted_mismatch"; note: string }
    | { state: "not_applicable" };
  /* Cross-source agreement detail when both sources carry the row. */
  crossSource: string | null;
  /* Parked pending the Gate 2 ruling: heuristic with no parsed value. */
  parked: boolean;
};

export type GateTile = {
  id: "totals" | "ladders" | "nav_basis" | "names";
  label: string;
  ok: boolean;
  value: string;
};

export type WorkbenchState = {
  rows: WorkbenchRow[];
  tiles: GateTile[];
  checks: GateCheck[];
  blockers: string[];
  parked: WorkbenchRow[];
  clears: boolean;
  anchorMonth: string;
  identityStrings: string[];
};

export type AdvisorInputs = {
  investorId: string;
  investorName: string;
  notes: string;
  tier: "synthetic_public" | "real_local_only";
  /* rawLabel -> chosen snapshot fund name, or explicit mismatch acceptance. */
  resolutions: Record<string, { fundName: string } | { acceptMismatch: string }>;
  /* row keys the advisor confirmed (heuristic rows with values). */
  confirmations: string[];
  /* row key -> advisor-assigned sub-category override. */
  subCategories: Record<string, SubCategory>;
};

const SUBCATEGORY_TO_ASSET_CLASS: Record<string, AssetClass> = {
  mf_active_large_cap: "Equity", mf_passive_index: "Equity",
  mf_active_flexi_cap: "Equity", mf_active_mid_cap: "Equity",
  mf_active_small_cap: "Equity", mf_hybrid_dynamic_aa: "Equity",
  pms_growth_quality: "Equity", pms_concentrated_quality: "Equity",
  pms_value: "Equity", pms_focused_midcap: "Equity",
  listed_large_cap: "Equity", intl_us_etf: "Equity",
  intl_us_individual: "Equity", unlisted_family_business: "Equity",
  unlisted_pre_ipo: "Equity",
  bank_fd: "Debt", tax_free_bond: "Debt", mf_corporate_debt: "Debt",
  mf_short_term_debt: "Debt", mf_arbitrage: "Debt",
  aif_cat_ii_pe: "Alternatives", aif_cat_ii_real_estate: "Alternatives",
  aif_cat_ii_private_credit: "Alternatives", aif_cat_iii_long_short: "Alternatives",
  physical_gold: "Alternatives", sovereign_gold_bond: "Alternatives", reit: "Alternatives",
  savings: "Cash",
};

/* Snapshot sebi_category -> demo-surface sub-category, deterministic and
 * advisor-overridable in the workbench (the selects the wireframe draws). */
export function subCategoryFromSebi(sebi: string | undefined): SubCategory | null {
  if (!sebi) return null;
  const s = sebi.toLowerCase();
  if (s.includes("large & mid") || s.includes("flexi") || s.includes("multi")) return "mf_active_flexi_cap";
  if (s.includes("index") || s.includes("etf")) return "mf_passive_index";
  if (s.includes("large")) return "mf_active_large_cap";
  if (s.includes("mid")) return "mf_active_mid_cap";
  if (s.includes("small")) return "mf_active_small_cap";
  if (s.includes("balanced advantage") || s.includes("dynamic asset")) return "mf_hybrid_dynamic_aa";
  if (s.includes("arbitrage")) return "mf_arbitrage";
  if (s.includes("corporate bond") || s.includes("credit")) return "mf_corporate_debt";
  if (s.includes("liquid") || s.includes("low duration") || s.includes("ultra short") || s.includes("money market") || s.includes("overnight") || s.includes("short duration")) return "mf_short_term_debt";
  if (s.includes("elss") || s.includes("focused") || s.includes("value") || s.includes("contra") || s.includes("dividend yield") || s.includes("sectoral") || s.includes("thematic")) return "mf_active_flexi_cap";
  return null;
}

function subCategoryFromText(label: string, detail: string | null): SubCategory | null {
  const t = (label + " " + (detail ?? "")).toLowerCase();
  const table: Array<[RegExp, SubCategory]> = [
    [/fixed deposit|bank fd|\bfd\b/, "bank_fd"],
    [/tax.free bond|bonds 20\d\d|ncd|debenture/, "tax_free_bond"],
    [/sovereign gold/, "sovereign_gold_bond"],
    [/gold/, "physical_gold"],
    [/savings|current account/, "savings"],
    [/s&p 500|nasdaq|etf.*(us|gift)|(us|gift).*etf/, "intl_us_etf"],
    [/us (listed |)equit|us stocks/, "intl_us_individual"],
    [/\bpms\b|portfolio management/, "pms_growth_quality"],
    [/\baif\b|alternate investment|long.short/, "aif_cat_iii_long_short"],
    [/reit/, "reit"],
    [/index fund|nifty 50|sensex/, "mf_passive_index"],
    [/balanced advantage|hybrid/, "mf_hybrid_dynamic_aa"],
    [/arbitrage/, "mf_arbitrage"],
    [/corporate (debt|bond)/, "mf_corporate_debt"],
    [/liquid fund|ultra short|low duration/, "mf_short_term_debt"],
    [/small cap/, "mf_active_small_cap"],
    [/mid ?cap|emerging equit/, "mf_active_mid_cap"],
    [/flexi|multi ?cap/, "mf_active_flexi_cap"],
    [/large cap|bluechip|blue chip/, "mf_active_large_cap"],
  ];
  for (const [re, sc] of table) {
    if (re.test(t)) return sc;
  }
  return null;
}

function isMfish(row: { subCategory: SubCategory | null; rawLabel: string; detail?: string | null }): boolean {
  if (row.subCategory && row.subCategory.startsWith("mf_")) return true;
  return /fund/i.test(row.rawLabel) && !/pms|aif/i.test(row.rawLabel);
}

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function baseLabel(s: string): string {
  return norm(s.split(" (")[0]);
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export type UniverseRow = FundUniverseEntry & { amfiCode: number; sebiCategory?: string };

export function buildWorkbench(
  docs: ParsedDocument[],
  universe: UniverseRow[],
  aliases: AliasMap,
  anchorMonth: string,
  inputs: AdvisorInputs,
): WorkbenchState {
  const universeNames = universe.map((u) => u.fundName);
  const byFund = new Map(universe.map((u) => [u.fundName, u]));

  const listings = docs.filter((d) => d.format !== "ecas_pdf");
  const statements = docs.filter((d) => d.format === "ecas_pdf");
  const identityStrings = [...new Set(docs.flatMap((d) => d.identityStrings))];

  /* Statement-side gate checks (ladders, closing-value ties, NAV basis,
   * folio name resolution) via the B3 gate, truthless mode. */
  const ecasChecks: GateCheck[] = [];
  const folioRows: Array<{ folio: ParsedFolio; doc: ParsedDocument; resolved: string | null; candidates: string[] }> = [];
  for (const doc of statements) {
    const report = reconcileEcas(doc, universe, aliases);
    ecasChecks.push(...report.checks);
    for (const folio of doc.folios) {
      const res = resolveFundName(folio.fundLabel, universeNames, aliases);
      folioRows.push({ folio, doc, resolved: res.resolved, candidates: res.candidates });
    }
  }

  /* Listing rows, deduplicated across listings by base label. */
  const listingRows: Array<ParsedHolding & { doc: ParsedDocument }> = [];
  for (const doc of listings) {
    for (const h of doc.holdings) {
      const dup = listingRows.find((r) => baseLabel(r.rawLabel) === baseLabel(h.rawLabel));
      if (!dup) listingRows.push({ ...h, doc });
      else dup.provenance = dup.provenance; // first occurrence wins; duplicates noted via cross-source below
    }
  }

  /* Merge: every listing row is a workbench row; statement folios attach to
   * their listing row (resolved-identity or label match) or stand alone. */
  const rows: WorkbenchRow[] = [];
  const usedFolios = new Set<ParsedFolio>();

  for (const lr of listingRows) {
    const key = "row:" + baseLabel(lr.rawLabel);
    const override = inputs.subCategories[key];
    let subCategory: SubCategory | null = override ?? subCategoryFromText(lr.rawLabel, lr.detail);
    const mfish = isMfish({ subCategory, rawLabel: lr.rawLabel, detail: lr.detail });

    let resolution: WorkbenchRow["resolution"] = { state: "not_applicable" };
    let matchedFolio: (typeof folioRows)[number] | undefined;
    if (mfish) {
      const chosen = inputs.resolutions[lr.rawLabel];
      const res = resolveFundName(lr.rawLabel, universeNames, aliases);
      const resolvedName = chosen && "fundName" in chosen ? chosen.fundName : res.resolved;
      if (chosen && "acceptMismatch" in chosen) {
        resolution = { state: "accepted_mismatch", note: chosen.acceptMismatch };
      } else if (resolvedName) {
        resolution = { state: "resolved", fundName: resolvedName };
        matchedFolio = folioRows.find((f) => f.resolved === resolvedName && !usedFolios.has(f.folio));
        if (!override && !subCategory) {
          subCategory = subCategoryFromSebi(byFund.get(resolvedName)?.sebiCategory);
        }
      } else {
        resolution = { state: "unresolved", candidates: res.candidates };
      }
    }
    if (matchedFolio) usedFolios.add(matchedFolio.folio);

    const statementValue = matchedFolio?.folio.marketValueInr ?? null;
    const valueInr = statementValue ?? lr.valueInr;
    let crossSource: string | null = null;
    if (statementValue !== null && lr.valueInr !== null) {
      const drift = Math.abs(statementValue - lr.valueInr) / Math.max(1, statementValue);
      crossSource =
        drift <= 0.02
          ? "listing and statement agree (" + (drift * 100).toFixed(1) + "% apart); statement value is authoritative"
          : "DISAGREE: listing " + lr.valueInr + " vs statement " + statementValue;
    }

    const parked = lr.valueInr === null && statementValue === null;
    rows.push({
      key,
      instrument: lr.rawLabel,
      rawLabel: lr.rawLabel,
      source: matchedFolio ? "both" : lr.doc.format === "email_text" ? "notes" : "listing",
      valueInr,
      provenance: [
        lr.provenance.file + ", " + lr.provenance.locator,
        ...(matchedFolio
          ? [matchedFolio.doc.sourceFile + ", folio " + (matchedFolio.folio.folioNo ?? "?") + ", " + matchedFolio.folio.transactions.length + " rows"]
          : []),
      ],
      confidence: lr.confidence,
      confirmed: lr.confidence === "exact" || inputs.confirmations.includes(key),
      subCategory,
      resolution,
      crossSource,
      parked,
    });
  }

  /* Statement folios with no listing row stand alone as exact rows. */
  for (const f of folioRows) {
    if (usedFolios.has(f.folio)) continue;
    const key = "folio:" + (f.folio.folioNo ?? norm(f.folio.fundLabel));
    const sebiSub = f.resolved ? subCategoryFromSebi(byFund.get(f.resolved)?.sebiCategory) : null;
    rows.push({
      key,
      instrument: f.folio.fundLabel,
      rawLabel: f.folio.fundLabel,
      source: "statement",
      valueInr: f.folio.marketValueInr,
      provenance: [f.doc.sourceFile + ", folio " + (f.folio.folioNo ?? "?") + ", " + f.folio.transactions.length + " rows"],
      confidence: "exact",
      confirmed: true,
      subCategory: inputs.subCategories[key] ?? sebiSub,
      resolution: f.resolved
        ? { state: "resolved", fundName: f.resolved }
        : { state: "unresolved", candidates: f.candidates },
      crossSource: "statement only; not in any listing",
      parked: false,
    });
  }

  const active = rows.filter((r) => !r.parked);
  const parked = rows.filter((r) => r.parked);

  /* The four tiles, the wireframe's vocabulary. */
  const listingTotal = listingRows.reduce((s, r) => s + (r.valueInr ?? 0), 0);
  const mergedTotal = active.reduce((s, r) => s + (r.valueInr ?? 0), 0);
  const totalsOk = listingTotal === 0 || Math.abs(mergedTotal - listingTotal) / listingTotal <= 0.02;

  const ladderChecks = ecasChecks.filter((c) => /unit sum|printed ladder|ties to stated market value|folios parsed/.test(c.label));
  const laddersOk = ladderChecks.every((c) => c.ok);
  const folioCount = folioRows.length;

  const navChecks = ecasChecks.filter((c) => /NAV matches the snapshot series/.test(c.label));
  const navOk = navChecks.every((c) => c.ok);

  const unresolved = active.filter((r) => r.resolution.state === "unresolved");
  const namesOk = unresolved.length === 0;

  const tiles: GateTile[] = [
    { id: "totals", label: "Totals tie", ok: totalsOk, value: (listingTotal / 1e7).toFixed(2) + " Cr = " + (mergedTotal / 1e7).toFixed(2) + " Cr" },
    { id: "ladders", label: "Statement ladders", ok: laddersOk, value: folioCount + " / " + folioCount + " folios" + (laddersOk ? " tie" : ": check failures") },
    { id: "nav_basis", label: "NAV basis vs snapshot", ok: navOk, value: navOk ? "anchor " + anchorMonth + " ties" : "statement NAV off the snapshot series" },
    { id: "names", label: "Name resolution", ok: namesOk, value: namesOk ? "all resolved" : unresolved.length + " unresolved" },
  ];

  const blockers: string[] = [];
  if (!totalsOk) blockers.push("totals do not tie across sources");
  if (!laddersOk) blockers.push("statement internal ties failed");
  if (!navOk) blockers.push("statement NAV basis does not match the snapshot");
  for (const r of unresolved) blockers.push("unresolved name: " + r.rawLabel);
  for (const r of active.filter((x) => x.confidence === "heuristic" && !x.confirmed)) {
    blockers.push("unconfirmed heuristic row: " + r.rawLabel);
  }
  for (const r of active.filter((x) => x.subCategory === null)) {
    blockers.push("sub-category needed: " + r.rawLabel);
  }
  if (parked.length > 0) {
    blockers.push(parked.length + " prose row(s) parked awaiting the value-entry ruling (Gate 2); excluded from this commit");
  }

  const clears = tiles.every((t) => t.ok) &&
    active.every((r) => (r.confidence === "exact" || r.confirmed) && r.subCategory !== null && r.valueInr !== null);

  return { rows, tiles, checks: ecasChecks, blockers, parked, clears, anchorMonth, identityStrings };
}

export function buildCanonicalRecord(
  state: WorkbenchState,
  inputs: AdvisorInputs,
  universe: UniverseRow[],
  statements: ParsedDocument[],
): { record: CanonicalInvestorRecord; derived: StructuredHoldings } {
  if (!state.clears) {
    throw new Error("buildCanonicalRecord: the gate is not green; commit is blocked");
  }
  const byFund = new Map(universe.map((u) => [u.fundName, u]));
  const folioByResolved = new Map<string, ParsedFolio>();
  for (const doc of statements) {
    for (const f of doc.folios) {
      const res = resolveFundName(f.fundLabel, universe.map((u) => u.fundName), { exact: {}, substitutions: {} });
      if (res.resolved) folioByResolved.set(res.resolved, f);
    }
  }

  const active = state.rows.filter((r) => !r.parked);
  const totalCr = active.reduce((s, r) => s + (r.valueInr ?? 0), 0) / 1e7;

  const holdings: CanonicalHolding[] = active.map((r) => {
    const sub = r.subCategory as SubCategory;
    const resolvedName = r.resolution.state === "resolved" ? r.resolution.fundName : null;
    const folio = resolvedName ? folioByResolved.get(resolvedName) ?? null : null;
    const txns: CanonicalTransaction[] | null = folio
      ? folio.transactions.map((t) => ({
          date: t.date, type: t.type, amountInr: t.amountInr, units: t.units,
          nav: t.nav, unitBalance: t.unitBalance,
        }))
      : null;
    return {
      instrument: r.instrument,
      rawLabel: r.rawLabel,
      assetClass: SUBCATEGORY_TO_ASSET_CLASS[sub],
      subCategory: sub,
      valueCr: (r.valueInr ?? 0) / 1e7,
      quantity: folio ? folio.closingUnits : null,
      costBasisTotalInr: folio
        ? folio.transactions.filter((t) => t.units !== null && t.amountInr !== null).reduce((s, t) => s + (t.amountInr ?? 0), 0)
        : null,
      costBasisPerUnitInr: null,
      purchaseDate: folio && folio.transactions.length > 0 ? folio.transactions[0].date : null,
      vehicleAttributes: null,
      resolvedInstrument: resolvedName,
      amfiCode: resolvedName ? byFund.get(resolvedName)?.amfiCode ?? null : null,
      folioNo: folio?.folioNo ?? null,
      navAnchorMonth: folio ? state.anchorMonth : null,
      closingNav: folio?.closingNav ?? null,
      closingUnits: folio?.closingUnits ?? null,
      transactions: txns,
    };
  });

  const accepted: CanonicalExcludedHolding[] = [];
  const record: CanonicalInvestorRecord = {
    investorId: inputs.investorId,
    archetypeId: "onboarded:" + inputs.investorId,
    totalLiquidAumCr: Math.round(totalCr * 100) / 100,
    holdings,
    excludedHoldings: accepted.length > 0 ? accepted : null,
  };

  const derived = deriveStructuredHoldings(record);
  /* Derivation sanity: weights are recomputed from values; assert they sum
   * near 100 (the same arithmetic the demo five freeze on). */
  const weightSum = derived.holdings.reduce((s, h) => s + h.weightPct, 0);
  if (Math.abs(weightSum - 100) > 1.5) {
    throw new Error("derived weights sum to " + round1(weightSum) + "; refusing to commit");
  }
  return { record, derived };
}
