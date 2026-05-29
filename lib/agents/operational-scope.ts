/* A3 operational-metadata join + the shared strict name matcher.
 *
 * Two consumers share this module:
 *   - A3.so_what (buildOperationalScope): per-holding operational metadata
 *     (PMS lock-in / exit-load, AIF SEBI category / tenure / redemption /
 *     min-commitment, MF SEBI category / exit-load) for the holdings whose
 *     SPECIFIC product variant matches a snapshot record. Reading B: where a
 *     holding does not match, or matches only a wrong-category record, A3
 *     stays SILENT on its operational fields (never fabricates).
 *   - scripts/verify-persona-snapshot-alignment.ts: the curator-facing
 *     alignment check that reports matches, near-misses, and category
 *     violations so a new persona can be reconciled to the snapshot universe
 *     before it is locked.
 *
 * Deliberately SEPARATE from wrapper-scope.ts's matcher (which E6 / E7 use).
 * Finding 2 / Option 2A: do not modify E6 / E7's matcher. This module carries
 * A3's stricter, category-guarded join. The strict name discipline mirrors
 * wrapper-scope's overlapsName (every distinctive holding token must be
 * present in the snapshot name) but adds a category-consistency guard so a
 * mid-cap holding cannot bind to an overseas FoF (the documented Kotak
 * false-positive). When the consistent match is absent, the holding is silent.
 */

import type { StructuredHoldings, SubCategory } from "@/db/fixtures/structured-holdings";
import type { Snapshot } from "./snapshot-loader";

/* ----- strict name matcher (mirrors wrapper-scope.ts overlapsName) ----- */

const NAME_STOP = new Set([
  "fund", "limited", "ltd", "pms", "aif", "pvt", "private", "company", "the",
  "of", "for", "and", "a", "asset", "management", "amc", "growth", "regular",
  "direct", "plan", "option", "scheme", "co", "sun", "life",
]);

function simplify(s: string): string {
  return s.toLowerCase().replace(/[-_,/()]+/g, " ").replace(/\s+/g, " ").trim();
}

function distinctiveTokens(name: string): string[] {
  return simplify(name).split(" ").filter((w) => w.length > 1 && !NAME_STOP.has(w));
}

/* Strict containment: true only when the holding's distinctive vocabulary is
 * fully contained in the snapshot record's name (or one is a prefix of the
 * other). Identical discipline to wrapper-scope.ts, copied so A3 owns its
 * matcher and E6 / E7 stay untouched. */
export function strictNameMatch(snapshotName: string, holdingName: string): boolean {
  if (!snapshotName || !holdingName) return false;
  const sn = simplify(snapshotName);
  const hn = simplify(holdingName);
  if (sn === hn || sn.startsWith(hn) || hn.startsWith(sn)) return true;
  const snapshotTokens = new Set(distinctiveTokens(snapshotName));
  const holdingTokens = distinctiveTokens(holdingName);
  if (holdingTokens.length < 2) return false;
  return holdingTokens.every((t) => snapshotTokens.has(t));
}

/* Soft overlap ratio for near-miss ranking only (NOT a match decision):
 * fraction of the holding's distinctive tokens present in the candidate. */
export function nameOverlapScore(holdingName: string, candidateName: string): number {
  const h = distinctiveTokens(holdingName);
  if (h.length === 0) return 0;
  const c = new Set(distinctiveTokens(candidateName));
  let n = 0;
  for (const t of h) if (c.has(t)) n++;
  return Math.round((n / h.length) * 100) / 100;
}

/* ----- snapshot collection dispatch ----- */

export type SnapshotCollection = "pms" | "aif" | "mf" | "listed" | "na";

/* Dispatch a holding to the snapshot collection that could carry its record,
 * by sub-category prefix. intl_*, debt allocation (bank_fd, tax_free_bond),
 * cash, gold, REIT, and unlisted positions have no fund/company collection in
 * the Indian snapshot universe and are "na" (not checkable, not a mismatch). */
export function dispatchCollection(subCategory: SubCategory): SnapshotCollection {
  if (subCategory.startsWith("pms_")) return "pms";
  if (subCategory.startsWith("aif_")) return "aif";
  if (subCategory.startsWith("mf_")) return "mf";
  if (subCategory.startsWith("listed_")) return "listed";
  return "na";
}

export type SnapshotRecordView = {
  name: string;
  category: string | null;
  raw: Record<string, unknown>;
};

/* Uniform record view over the heterogeneous snapshot collections so the
 * matcher, the extractor, and the alignment utility iterate the same shape. */
export function collectionRecords(snapshot: Snapshot, collection: SnapshotCollection): SnapshotRecordView[] {
  if (collection === "pms") {
    const funds = ((snapshot.pms as { funds?: Record<string, unknown>[] })?.funds) ?? [];
    return funds.map((p) => {
      const identity = (p.identity as Record<string, unknown>) ?? {};
      return { name: String(identity.fund_name ?? ""), category: identity.category != null ? String(identity.category) : null, raw: p };
    });
  }
  if (collection === "aif") {
    const profiles = ((snapshot.aif as { "Fund Profiles"?: Record<string, unknown>[] })?.["Fund Profiles"]) ?? [];
    return profiles.map((a) => ({ name: String(a["Fund Name"] ?? ""), category: a["SEBI Category"] != null ? String(a["SEBI Category"]) : null, raw: a }));
  }
  if (collection === "mf") {
    return snapshot.mf_funds.map((f) => ({ name: String(f.fund_name ?? ""), category: f.sebi_category != null ? String(f.sebi_category) : null, raw: f as Record<string, unknown> }));
  }
  if (collection === "listed") {
    const companies = (snapshot.nifty500?.companies ?? []) as Record<string, unknown>[];
    return companies.map((c) => ({ name: String(c.name ?? ""), category: null, raw: c }));
  }
  return [];
}

/* ----- category-consistency guard (Option 2A) ----- */

export type CategoryGuard = { label: string; test: (recordCategory: string) => boolean };

function lc(s: string): string { return (s ?? "").toLowerCase(); }

/* Trailing SEBI roman numeral from an AIF category string ("CAT III" -> "iii",
 * "Category II" -> "ii"). Longest-first alternation so "iii" never resolves to
 * "ii" (a plain substring test would: "cat iii" contains "cat ii"). */
function romanCat(c: string): string {
  const m = lc(c).match(/\b(iii|ii|i)\b/g);
  return m ? m[m.length - 1] : "";
}

const MF_GUARDS: Partial<Record<SubCategory, CategoryGuard>> = {
  mf_active_large_cap: { label: "Large Cap", test: (c) => lc(c).includes("large cap") },
  mf_active_mid_cap: { label: "Mid Cap", test: (c) => lc(c).includes("mid cap") || lc(c).includes("midcap") },
  mf_active_small_cap: { label: "Small Cap", test: (c) => lc(c).includes("small cap") },
  mf_active_flexi_cap: { label: "Flexi Cap", test: (c) => lc(c).includes("flexi cap") || lc(c).includes("flexicap") },
  mf_passive_index: { label: "Index", test: (c) => lc(c).includes("index") },
  mf_hybrid_dynamic_aa: { label: "Hybrid / Dynamic AA", test: (c) => { const x = lc(c); return x.includes("dynamic asset") || x.includes("balanced advantage") || x.includes("hybrid"); } },
  mf_corporate_debt: { label: "Corporate / Debt", test: (c) => { const x = lc(c); return x.includes("corporate bond") || x.includes("corporate debt") || x.includes("banking and psu") || x.includes("debt"); } },
  mf_short_term_debt: { label: "Short Duration / Debt", test: (c) => { const x = lc(c); return x.includes("short") || x.includes("low duration") || x.includes("debt"); } },
  mf_arbitrage: { label: "Arbitrage", test: (c) => lc(c).includes("arbitrage") },
};

/* The category a holding's snapshot match must satisfy, or null when no guard
 * applies (PMS strategy labels are free-form; listed equity carries no SEBI
 * scheme category). MF guards on the SEBI scheme family; AIF on Cat II / III. */
export function expectedCategory(subCategory: SubCategory): CategoryGuard | null {
  if (subCategory in MF_GUARDS) return MF_GUARDS[subCategory] ?? null;
  if (subCategory.startsWith("aif_cat_ii_")) return { label: "AIF Cat II", test: (c) => romanCat(c) === "ii" };
  if (subCategory.startsWith("aif_cat_iii_")) return { label: "AIF Cat III", test: (c) => romanCat(c) === "iii" };
  return null;
}

/* A strict name match that ALSO satisfies the category guard, if any. Returns
 * null when no name match exists, or when the name match is category-
 * inconsistent (the Kotak mid-cap vs overseas-FoF case): the caller stays
 * silent rather than surfacing the wrong record's operational data. */
export function findConsistentMatch(
  snapshot: Snapshot,
  subCategory: SubCategory,
  instrument: string,
): { collection: SnapshotCollection; record: SnapshotRecordView } | null {
  const collection = dispatchCollection(subCategory);
  if (collection === "na") return null;
  const guard = expectedCategory(subCategory);
  for (const rec of collectionRecords(snapshot, collection)) {
    if (!strictNameMatch(rec.name, instrument)) continue;
    if (guard && !(rec.category != null && guard.test(rec.category))) continue;
    return { collection, record: rec };
  }
  return null;
}

/* ----- per-holding operational metadata (Reading B: present fields only) ----- */

export type A3OperationalMetadata = {
  holding_ref: string;
  kind: "pms" | "aif" | "mf";
  matched_record_name: string;
  /* PMS */
  effective_lock_in_years?: number;
  exit_load?: unknown;
  fee_model?: string;
  fixed_amc_pct?: number;
  /* AIF */
  sebi_category?: string;
  fund_tenure?: string;
  tenure_extendable?: string;
  min_commitment_cr?: number;
  exit_redemption_terms?: string;
  structure?: string;
};

/* Reading-B string setter: skip empty and the snapshot's "NA" placeholder so
 * absent operational facts stay genuinely absent (never narrated as known). */
function setStr(target: Record<string, unknown>, key: string, value: unknown): void {
  if (typeof value !== "string") return;
  const v = value.trim();
  if (v === "" || v.toUpperCase() === "NA") return;
  target[key] = v;
}

function pmsExitLoadHasCost(exitLoad: unknown): boolean {
  if (!exitLoad || typeof exitLoad !== "object") return false;
  return Object.values(exitLoad as Record<string, unknown>).some((v) => typeof v === "number" && v > 0);
}

function mfExitLoadHasCost(exitLoad: unknown): boolean {
  let arr: unknown = exitLoad;
  if (typeof exitLoad === "string") {
    try { arr = JSON.parse(exitLoad); } catch { return false; }
  }
  if (!Array.isArray(arr)) return false;
  return arr.some((t) => t && typeof t === "object" && typeof (t as Record<string, unknown>).load_pct === "number" && ((t as Record<string, unknown>).load_pct as number) > 0);
}

function extractOperational(
  holdingRef: string,
  kind: "pms" | "aif" | "mf",
  record: SnapshotRecordView,
): A3OperationalMetadata {
  const m: A3OperationalMetadata = { holding_ref: holdingRef, kind, matched_record_name: record.name };
  if (kind === "pms") {
    const fs = (record.raw.fee_structure as Record<string, unknown>) ?? {};
    if (typeof fs.effective_lock_in_years === "number") m.effective_lock_in_years = fs.effective_lock_in_years;
    if (pmsExitLoadHasCost(fs.exit_load)) m.exit_load = fs.exit_load;
    setStr(m, "fee_model", fs.fee_model);
    if (typeof fs.fixed_amc_pct === "number") m.fixed_amc_pct = fs.fixed_amc_pct;
    return m;
  }
  if (kind === "aif") {
    const r = record.raw;
    setStr(m, "sebi_category", r["SEBI Category"]);
    setStr(m, "fund_tenure", r["Fund Tenure"]);
    setStr(m, "tenure_extendable", r["Tenure Extendable"]);
    if (typeof r["Min Commitment (Cr)"] === "number") m.min_commitment_cr = r["Min Commitment (Cr)"];
    setStr(m, "exit_redemption_terms", r["Exit / Redemption Terms"]);
    setStr(m, "structure", r["Structure"]);
    return m;
  }
  /* mf */
  const r = record.raw;
  setStr(m, "sebi_category", r["sebi_category"]);
  if (mfExitLoadHasCost(r["Exit Load (JSON)"])) m.exit_load = r["Exit Load (JSON)"];
  return m;
}

/* Per-holding operational metadata for PMS / AIF / MF holdings whose specific
 * product variant matches a snapshot record under the category-guarded strict
 * join. Holdings with no consistent match are simply absent from the result
 * (Reading-B silence); A3 surfaces nothing operational for them. */
export function buildOperationalScope(holdings: StructuredHoldings, snapshot: Snapshot): A3OperationalMetadata[] {
  const out: A3OperationalMetadata[] = [];
  for (const h of holdings.holdings) {
    const collection = dispatchCollection(h.subCategory);
    if (collection !== "pms" && collection !== "aif" && collection !== "mf") continue;
    const hit = findConsistentMatch(snapshot, h.subCategory, h.instrument);
    if (!hit) continue;
    out.push(extractOperational(h.instrument, collection, hit.record));
  }
  return out;
}
