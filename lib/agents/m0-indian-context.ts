/* M0.IndianContext, deterministic reference-data agent.
 *
 * Per the agents/m0_indian_context.md skill contract, this agent is
 * rule-based, NOT an LLM agent: it retrieves and structures curated YAML
 * knowledge against the case context. No model call, no reasoning, no
 * speculation. The six stores under agents/m0_indian_context/data/ are
 * the sole authority (Workstream C, closed 2026-05-17).
 *
 * Two surfaces:
 *   buildIndianContext()  - the bulk bundle assembled once per case at
 *                           opening, attached to ctx.indianContext and
 *                           consumed by S1.case_mode and the IC1 sub-
 *                           agents (Chair, Devil's Advocate, Risk
 *                           Assessor, Counterfactual Engine).
 *   getSebiTicketRule()   - the inline lookup G2 uses to ground its SEBI
 *                           minimum-ticket evaluation in sebi_boundaries
 *                           instead of a hardcoded MVP table. The gate's
 *                           deterministic logic is unchanged; only the
 *                           source of truth moves to the YAML store.
 *
 * Curation discipline carried through honestly: confidence:indicative
 * entries are surfaced with a flag, never presented as authoritative;
 * every framing carries the source entry_id and citation; the canonical
 * legacy_term_aliases table resolves cross-store lookups between the
 * pre-lock investor_type axis and the post-lock structure_type axis.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const DATA_DIR = path.resolve(process.cwd(), "agents", "m0_indian_context", "data");

const STORE_FILES = {
  tax_matrix: "tax_matrix.yaml",
  sebi_boundaries: "sebi_boundaries.yaml",
  structure_matrix: "structure_matrix.yaml",
  demat_mechanics: "demat_mechanics.yaml",
  gift_city_routing: "gift_city_routing.yaml",
  regulatory_changelog: "regulatory_changelog.yaml",
} as const;

export type StoreId = keyof typeof STORE_FILES;

export type KnowledgeEntry = {
  entry_id: string;
  topic: string;
  applicability: Record<string, unknown>;
  rule?: Record<string, unknown>;
  change_summary?: Record<string, unknown> | string;
  rule_pointer?: { affected_entries?: string[]; [k: string]: unknown };
  citation_source_type: string;
  citation: string;
  effective_date: string;
  confidence: "authoritative" | "indicative";
  notes?: string;
  /** Provenance tags added at load; not part of the on-disk envelope. */
  __store: StoreId;
  __section?: string;
};

type ParsedStore = {
  metadata: Record<string, unknown>;
  entries: KnowledgeEntry[];
};

let storeCache: Record<StoreId, ParsedStore> | null = null;

/* js-yaml resolves unquoted YYYY-MM-DD scalars to Date objects via the
 * default timestamp type. Normalise back to the canonical string form so
 * downstream date comparisons stay lexicographic and stable. */
function normaliseDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" ? value : String(value ?? "");
}

function asEntry(
  raw: Record<string, unknown>,
  store: StoreId,
  section?: string,
): KnowledgeEntry {
  return {
    ...(raw as object),
    entry_id: String(raw.entry_id),
    topic: String(raw.topic ?? ""),
    applicability: (raw.applicability as Record<string, unknown>) ?? {},
    citation_source_type: String(raw.citation_source_type ?? ""),
    citation: String(raw.citation ?? ""),
    effective_date: normaliseDate(raw.effective_date),
    confidence: raw.confidence === "indicative" ? "indicative" : "authoritative",
    notes: raw.notes === undefined ? undefined : String(raw.notes),
    __store: store,
    __section: section,
  } as KnowledgeEntry;
}

export async function loadStores(): Promise<Record<StoreId, ParsedStore>> {
  if (storeCache) return storeCache;

  const out = {} as Record<StoreId, ParsedStore>;
  for (const [storeId, fileName] of Object.entries(STORE_FILES) as [
    StoreId,
    string,
  ][]) {
    const filePath = path.join(DATA_DIR, fileName);
    const text = await fs.readFile(filePath, "utf-8");
    const doc = yaml.load(text) as Record<string, unknown>;
    if (!doc || typeof doc !== "object") {
      throw new Error(`M0.IndianContext store ${storeId} parsed to a non-object`);
    }
    const metadata = (doc.metadata as Record<string, unknown>) ?? {};
    const entries: KnowledgeEntry[] = [];

    if (Array.isArray(doc.entries)) {
      /* Flat-list stores (sebi_boundaries, structure_matrix,
       * demat_mechanics, gift_city_routing, regulatory_changelog). */
      for (const e of doc.entries as Record<string, unknown>[]) {
        if (e && e.entry_id) entries.push(asEntry(e, storeId));
      }
    } else {
      /* Sectioned store (tax_matrix): each non-metadata key is a list of
       * entries; the section name is retained as provenance. */
      for (const [key, val] of Object.entries(doc)) {
        if (key === "metadata" || !Array.isArray(val)) continue;
        for (const e of val as Record<string, unknown>[]) {
          if (e && e.entry_id) entries.push(asEntry(e, storeId, key));
        }
      }
    }

    if (entries.length === 0) {
      throw new Error(`M0.IndianContext store ${storeId} yielded zero entries`);
    }
    out[storeId] = { metadata, entries };
  }

  storeCache = out;
  return out;
}

/* ---- Investor structure resolution -------------------------------------- */

export type ResolvedStructure = {
  structure_type: string;
  residency: "resident" | "non_resident" | "rnor";
  legacy_alias_applied?: string;
};

/* Maps the seed Investor.structureLine free text onto the canonical
 * structure_type / residency axes locked in Step 4. Demo-fidelity
 * keyword resolution; production would key off a structured investor
 * record rather than a display line. */
export function resolveStructure(structureLine: string): ResolvedStructure {
  const s = (structureLine || "").toLowerCase();
  const residency: ResolvedStructure["residency"] =
    /\bnre\b|\bnro\b|\bnri\b|non[- ]?resident|→ ?resident|to ?resident/.test(s)
      ? /→ ?resident|to ?resident|rnor/.test(s)
        ? "rnor"
        : "non_resident"
      : "resident";

  let structure_type = "individual";
  let legacy_alias_applied: string | undefined;

  if (/\bhuf\b|hindu undivided/.test(s)) structure_type = "huf";
  else if (/\bllp\b/.test(s)) structure_type = "llp";
  else if (/partnership/.test(s)) structure_type = "partnership_firm";
  else if (/family trust/.test(s)) structure_type = "family_trust";
  else if (/\btrust\b/.test(s)) structure_type = "private_discretionary_trust";
  else if (/pvt ?ltd|private limited|\bcompany\b|\bcorp/.test(s))
    structure_type = "private_limited_company";
  else structure_type = "individual";

  if (structure_type === "individual" && residency === "non_resident") {
    legacy_alias_applied = "nri -> individual + residency=non_resident";
  } else if (structure_type === "individual" && residency === "resident") {
    legacy_alias_applied =
      "resident_individual -> individual + residency=resident";
  }

  return { structure_type, residency, legacy_alias_applied };
}

/* Maps the proposal target_category enum onto the curated product
 * vocabulary used in store applicability blocks. */
function mapCategoryToProducts(targetCategory: string): string[] {
  switch (targetCategory) {
    case "pms":
      return ["pms"];
    case "aif":
      return ["aif_cat_i", "aif_cat_ii", "aif_cat_iii"];
    case "mutual_fund":
      return ["mutual_fund"];
    case "listed_equity_direct":
      return ["listed_equity_direct", "listed_equity"];
    case "unlisted_equity":
      return ["unlisted_equity"];
    case "bond_listed":
      return ["listed_debt", "bond_listed"];
    case "gold":
      return ["gold", "sgb"];
    default:
      return [targetCategory];
  }
}

/* demat_mechanics keys on an asset_class axis distinct from the proposal
 * product enum (pms -> pms_holdings, aif -> aif_units, etc.). */
function mapCategoryToDematAssetClasses(targetCategory: string): string[] {
  switch (targetCategory) {
    case "pms":
      return ["pms_holdings"];
    case "aif":
      return ["aif_units"];
    case "mutual_fund":
      return ["mutual_fund"];
    case "listed_equity_direct":
      return ["listed_equity"];
    case "unlisted_equity":
      return ["unlisted_equity"];
    case "gold":
      return ["gold"];
    default:
      return [];
  }
}

/* ---- Applicability matching --------------------------------------------- */

function applicabilityList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).toLowerCase());
  if (value === undefined || value === null) return [];
  return [String(value).toLowerCase()];
}

function entryAppliesToProduct(entry: KnowledgeEntry, products: string[]): boolean {
  const ap = entry.applicability;
  const fields = [ap.product, ap.products, ap.asset_class, ap.product_type];
  const declared = new Set<string>();
  for (const f of fields) for (const v of applicabilityList(f)) declared.add(v);
  if (declared.size === 0) return false;
  return products.some((p) => declared.has(p.toLowerCase()));
}

function entryAppliesToStructure(
  entry: KnowledgeEntry,
  s: ResolvedStructure,
): boolean {
  const ap = entry.applicability;
  const st = applicabilityList(ap.structure_type);
  const res = applicabilityList(ap.residency);
  const invType = applicabilityList(ap.investor_type);

  /* structure_matrix entries key on structure_type (+ residency where the
   * axis applies). */
  if (st.length > 0) {
    const stOk = st.includes(s.structure_type) || st.includes("all");
    const resOk =
      res.length === 0 ||
      res.includes(s.residency) ||
      res.includes("all") ||
      (s.residency === "rnor" && res.includes("non_resident"));
    return stOk && resOk;
  }

  /* Pre-lock stores (tax_matrix, sebi_boundaries) key on the legacy
   * investor_type axis. Resolve the canonical structure onto it. */
  if (invType.length > 0) {
    const legacyTerms = new Set<string>([s.structure_type]);
    if (s.structure_type === "individual") {
      legacyTerms.add(s.residency === "resident" ? "individual" : "nri");
      legacyTerms.add("resident_individual");
    }
    if (
      s.structure_type === "private_limited_company" ||
      s.structure_type === "public_limited_company" ||
      s.structure_type === "llp" ||
      s.structure_type === "partnership_firm"
    ) {
      legacyTerms.add("corporate");
    }
    if (s.structure_type.includes("trust")) legacyTerms.add("trust");
    return invType.some((v) => legacyTerms.has(v));
  }

  /* No structure or investor axis declared: the entry is product-scoped
   * and applies regardless of investor structure. */
  return true;
}

/* ---- Output schema ------------------------------------------------------ */

export type IndianContextCitation = {
  source_store: StoreId;
  source_entry_id: string;
  topic: string;
  citation: string;
  citation_source_type: string;
  confidence: "authoritative" | "indicative";
};

/* The curated M0.IndianContext bundle. Replaces the Slice 3 placeholder
 * IndianContextSummary. The five human-readable framing strings preserve
 * the prompt-facing surface the evidence/IC1 prompts already render; the
 * structured fields (sebi_minimums, citations, indicative_flags,
 * applicable_regulatory_changes) carry the audit-grade provenance. */
export type IndianContextSummary = {
  mode: "bulk";
  generated_by: "m0_indian_context_deterministic";
  store_versions: Record<StoreId, string>;
  investor_structure: ResolvedStructure;
  tax_structure: string;
  lock_in_mechanics: string;
  regulatory_eligibility: string;
  surcharge_implications: string;
  structure_specific_considerations: string;
  sebi_minimums: {
    product: string;
    min_ticket_inr: number;
    min_ticket_cr: number;
    source_store: StoreId;
    source_entry_id: string;
    citation: string;
    confidence: "authoritative" | "indicative";
  }[];
  applicable_regulatory_changes: {
    entry_id: string;
    topic: string;
    effective_date: string;
    affected_entries: string[];
  }[];
  indicative_flags: string[];
  citations: IndianContextCitation[];
  edge_cases_flagged: string[];
  reasoning_trace: string;
  /** Escape hatch retained from the Slice 3 placeholder for forward
   * compatibility; populated with the raw matched entry ids per store. */
  raw?: Record<string, unknown>;
};

export type IndianContextInput = {
  caseId: string;
  /** Case decision date, ISO yyyy-mm-dd. Time-aware lookups use this,
   * not the wall clock, per the skill discipline. */
  asOfDate: string;
  investorStructureLine: string;
  proposalCategory: string;
  proposalInstrument: string;
  ticketSizeCr: number;
};

function citationOf(e: KnowledgeEntry): IndianContextCitation {
  return {
    source_store: e.__store,
    source_entry_id: e.entry_id,
    topic: e.topic,
    citation: e.citation,
    citation_source_type: e.citation_source_type,
    confidence: e.confidence,
  };
}

function ruleNum(rule: Record<string, unknown> | undefined, ...keys: string[]): number | null {
  if (!rule) return null;
  for (const k of keys) {
    const v = rule[k];
    if (typeof v === "number") return v;
  }
  return null;
}

/* Inline SEBI minimum-ticket lookup. G2 consumes this so its regulatory
 * reference data is the curated sebi_boundaries store rather than the MVP
 * hardcoded table. Returns null for categories with no SEBI per-investor
 * ticket gate (the gate keeps its existing non-ticket handling). */
export async function getSebiTicketRule(targetCategory: string): Promise<{
  min_ticket_cr: number;
  min_ticket_inr: number;
  citation: string;
  source_store: StoreId;
  source_entry_id: string;
  confidence: "authoritative" | "indicative";
} | null> {
  const stores = await loadStores();
  const products = mapCategoryToProducts(targetCategory);
  for (const e of stores.sebi_boundaries.entries) {
    if (String(e.applicability.rule_type) !== "minimum_ticket") continue;
    if (!entryAppliesToProduct(e, products)) continue;
    const inr = ruleNum(
      e.rule,
      "threshold_inr",
      "standard_minimum_inr",
      "minimum_inr",
    );
    if (inr === null) continue;
    return {
      min_ticket_cr: inr / 1e7,
      min_ticket_inr: inr,
      citation: e.citation,
      source_store: "sebi_boundaries",
      source_entry_id: e.entry_id,
      confidence: e.confidence,
    };
  }
  return null;
}

/* Bulk bundle. Deterministic retrieval and structuring; no LLM. */
export async function buildIndianContext(
  input: IndianContextInput,
): Promise<IndianContextSummary> {
  const stores = await loadStores();
  const structure = resolveStructure(input.investorStructureLine);
  const products = mapCategoryToProducts(input.proposalCategory);
  const asOf = input.asOfDate;

  const dematAssetClasses = mapCategoryToDematAssetClasses(
    input.proposalCategory,
  );

  const matched: KnowledgeEntry[] = [];
  const seen = new Set<string>();
  const push = (e: KnowledgeEntry) => {
    if (seen.has(e.entry_id)) return;
    seen.add(e.entry_id);
    matched.push(e);
  };

  /* Per-store matching: each store keys on a different axis. tax_matrix
   * and sebi_boundaries are product + investor_type scoped; gift_city is
   * product + residency scoped; structure_matrix is structure-keyed by
   * design (its rule.eligible_products carries the product relation);
   * demat_mechanics keys on an asset_class axis. */
  for (const e of stores.tax_matrix.entries) {
    if (entryAppliesToProduct(e, products) && entryAppliesToStructure(e, structure)) push(e);
  }
  for (const e of stores.sebi_boundaries.entries) {
    if (entryAppliesToProduct(e, products) && entryAppliesToStructure(e, structure)) push(e);
  }
  for (const e of stores.gift_city_routing.entries) {
    if (entryAppliesToProduct(e, products) && entryAppliesToStructure(e, structure)) push(e);
  }
  for (const e of stores.structure_matrix.entries) {
    if (entryAppliesToStructure(e, structure)) push(e);
  }
  for (const e of stores.demat_mechanics.entries) {
    const ac = applicabilityList(e.applicability.asset_class);
    if (ac.some((v) => dematAssetClasses.includes(v))) push(e);
  }

  const bySection = (store: StoreId, section?: string) =>
    matched.filter((e) => e.__store === store && (!section || e.__section === section));

  /* SEBI minimum-ticket bundle entry for the proposal product. */
  const sebi_minimums: IndianContextSummary["sebi_minimums"] = [];
  const sebiRule = await getSebiTicketRule(input.proposalCategory);
  if (sebiRule) {
    sebi_minimums.push({
      product: input.proposalCategory,
      min_ticket_inr: sebiRule.min_ticket_inr,
      min_ticket_cr: sebiRule.min_ticket_cr,
      source_store: sebiRule.source_store,
      source_entry_id: sebiRule.source_entry_id,
      citation: sebiRule.citation,
      confidence: sebiRule.confidence,
    });
  }

  /* Time-aware regulatory_changelog: events effective on/before the case
   * decision date whose inverse-reference touches any matched entry. */
  const matchedIds = new Set(matched.map((e) => e.entry_id));
  const applicable_regulatory_changes: IndianContextSummary["applicable_regulatory_changes"] =
    [];
  for (const c of stores.regulatory_changelog.entries) {
    if (c.effective_date > asOf) continue;
    const affected = c.rule_pointer?.affected_entries ?? [];
    if (affected.some((id) => matchedIds.has(id))) {
      applicable_regulatory_changes.push({
        entry_id: c.entry_id,
        topic: c.topic,
        effective_date: c.effective_date,
        affected_entries: affected.filter((id) => matchedIds.has(id)),
      });
    }
  }

  const indicative = matched.filter((e) => e.confidence === "indicative");
  const indicative_flags = indicative.map(
    (e) =>
      `${e.entry_id} (${e.topic}): confidence=indicative, ${e.citation_source_type}; surface to S1 as practitioner framing, not authoritative.`,
  );

  const citations = matched.map(citationOf);

  /* Human-readable framings, composed deterministically from the matched
   * structured fields. These preserve the prompt-facing surface the
   * evidence and IC1 prompts render today. */
  const taxEntries = [
    ...bySection("tax_matrix", "capital_gains"),
    ...bySection("tax_matrix", "aif_passthrough"),
    ...bySection("tax_matrix", "mf_classification"),
    ...bySection("tax_matrix", "pms_lookthrough"),
    ...bySection("tax_matrix", "nri_treaty"),
  ];
  const tax_structure =
    taxEntries.length > 0
      ? taxEntries
          .slice(0, 4)
          .map((e) => `${e.topic} [${e.entry_id}]`)
          .join("; ")
      : "No product-specific tax-matrix entry matched the proposal and investor structure; advisor applies category defaults.";

  const surchargeEntries = bySection("tax_matrix", "surcharge");
  const surcharge_implications =
    surchargeEntries.length > 0
      ? surchargeEntries
          .slice(0, 3)
          .map((e) => `${e.topic} [${e.entry_id}]`)
          .join("; ")
      : "No surcharge-band entry matched; standard slab surcharge applies per investor income tier.";

  const dematEntries = matched.filter((e) => e.__store === "demat_mechanics");
  const lock_in_mechanics =
    dematEntries.length > 0
      ? dematEntries
          .slice(0, 4)
          .map((e) => `${e.topic} [${e.entry_id}]`)
          .join("; ")
      : "No demat/lock-in entry matched the proposal product.";

  const sebiEntries = matched.filter((e) => e.__store === "sebi_boundaries");
  const regulatory_eligibility =
    sebiEntries.length > 0
      ? sebiEntries
          .slice(0, 5)
          .map((e) => `${e.topic} [${e.entry_id}]`)
          .join("; ")
      : "No SEBI boundary entry matched the proposal product.";

  const structEntries = matched.filter((e) => e.__store === "structure_matrix");
  const giftEntries = matched.filter((e) => e.__store === "gift_city_routing");

  /* Product-eligibility check against the resolved structure's
   * eligible_products list (the structure_matrix product relation). */
  let eligibilityNote = "";
  const primaryStruct = structEntries[0];
  if (primaryStruct?.rule && Array.isArray(primaryStruct.rule.eligible_products)) {
    const eligible = (primaryStruct.rule.eligible_products as string[]).map((p) =>
      String(p).toLowerCase(),
    );
    const productOk = products.some((p) => eligible.includes(p.toLowerCase()));
    eligibilityNote = productOk
      ? `${input.proposalCategory} is an eligible product for ${structure.structure_type}/${structure.residency} [${primaryStruct.entry_id}].`
      : `${input.proposalCategory} is NOT listed in eligible_products for ${structure.structure_type}/${structure.residency} [${primaryStruct.entry_id}]; structure-fit requires advisor review.`;
  }

  const structure_specific_considerations =
    [
      eligibilityNote,
      structEntries
        .slice(0, 2)
        .map((e) => `${e.topic} [${e.entry_id}]`)
        .join("; "),
      giftEntries.length > 0
        ? `Foreign-routing: ${giftEntries
            .slice(0, 2)
            .map((e) => `${e.topic} [${e.entry_id}]`)
            .join("; ")}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ") ||
    `Resolved structure ${structure.structure_type} / ${structure.residency}; no structure-matrix entry matched.`;

  const edge_cases_flagged: string[] = [];
  if (matched.length === 0) {
    edge_cases_flagged.push(
      `edge_case_manual_review: no curated entry matched product=${input.proposalCategory} for structure=${structure.structure_type}/${structure.residency}. Per skill discipline M0.IndianContext does not guess applicability.`,
    );
  }
  if (structure.residency === "rnor") {
    edge_cases_flagged.push(
      "RNOR_partial_year_treatment: residency resolved as RNOR (transition); NRE/NRO and slab treatment require CA confirmation for the partial year.",
    );
  }

  const storeVersionOf = (id: StoreId) =>
    String((stores[id].metadata as { version?: unknown }).version ?? "unknown");

  return {
    mode: "bulk",
    generated_by: "m0_indian_context_deterministic",
    store_versions: {
      tax_matrix: storeVersionOf("tax_matrix"),
      sebi_boundaries: storeVersionOf("sebi_boundaries"),
      structure_matrix: storeVersionOf("structure_matrix"),
      demat_mechanics: storeVersionOf("demat_mechanics"),
      gift_city_routing: storeVersionOf("gift_city_routing"),
      regulatory_changelog: storeVersionOf("regulatory_changelog"),
    },
    investor_structure: structure,
    tax_structure,
    lock_in_mechanics,
    regulatory_eligibility,
    surcharge_implications,
    structure_specific_considerations,
    sebi_minimums,
    applicable_regulatory_changes,
    indicative_flags,
    citations,
    edge_cases_flagged,
    reasoning_trace: `Deterministic retrieval over six curated stores. Resolved investor structure ${structure.structure_type}/${structure.residency}${structure.legacy_alias_applied ? ` (alias: ${structure.legacy_alias_applied})` : ""}; product axis [${products.join(", ")}]; ${matched.length} entries matched (${indicative.length} indicative); ${applicable_regulatory_changes.length} regulatory-changelog events effective on/before ${asOf}.`,
    raw: {
      matched_entry_ids: matched.map((e) => `${e.__store}:${e.entry_id}`),
    },
  };
}
