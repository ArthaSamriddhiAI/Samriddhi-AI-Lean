/* Direct-equity sector_map (T-5.14 Phase 4).
 *
 * The whole-book look-through (portfolio-risk-analytics.ts) can roll MF and PMS
 * holdings up to sectors via their disclosed "Top 5 Sectors", but DIRECT listed
 * equity carries no per-stock sector in the snapshot (nifty500 companies have no
 * sector field), so direct stocks were sector-uncovered. This map supplies the
 * primary sector for each held / pulled listed name so direct equity contributes
 * to the sector look-through.
 *
 * Convention: the labels are the snapshot's own (the AMFI / NSE granular sectors
 * used in the MF "Top 5 Sectors (JSON)": Banks, Finance, IT - Software, Petroleum
 * Products, Diversified FMCG, Telecom - Services, Construction, ...), so direct
 * and fund-disclosed sector weights aggregate cleanly under one taxonomy. One
 * PRIMARY sector per stock.
 *
 * Confidence is flagged, never silently guessed (the honest-degradation
 * discipline, WA28): "high" for unambiguous single-sector large caps; "medium"
 * where a conglomerate spans sectors and a primary must be chosen (e.g. Larsen &
 * Toubro, engineering/construction vs capital goods; Reliance, refining vs telecom
 * vs retail, mapped to its dominant Petroleum Products line). A consumer can
 * choose to exclude or footnote medium/low assignments.
 *
 * Scope: the listed names the five cases hold (Reliance, HDFC Bank, ITC) plus the
 * direct-equity names pulled in the Bloomberg set. Unmapped names resolve to null
 * and the look-through degrades honestly to sector-uncovered (it does not guess).
 */
export type SectorAssignment = { sector: string; confidence: "high" | "medium" | "low" };

export const DIRECT_EQUITY_SECTOR_MAP: Record<string, SectorAssignment> = {
  "Reliance Industries": { sector: "Petroleum Products", confidence: "medium" }, // conglomerate; dominant reported line is refining/petroleum
  "HDFC Bank": { sector: "Banks", confidence: "high" },
  "ITC": { sector: "Diversified FMCG", confidence: "high" },
  "ICICI Bank": { sector: "Banks", confidence: "high" },
  "Tata Consultancy Services": { sector: "IT - Software", confidence: "high" },
  "Infosys": { sector: "IT - Software", confidence: "high" },
  "HCL Technologies": { sector: "IT - Software", confidence: "high" },
  "Tech Mahindra": { sector: "IT - Software", confidence: "high" },
  "Larsen & Toubro": { sector: "Construction", confidence: "medium" }, // engineering & construction; sometimes classed Capital Goods
  "Bharti Airtel": { sector: "Telecom - Services", confidence: "high" },
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* Resolve a holding / company name to its sector. Prefix-or-exact match on the
 * normalised name (mirroring the fund-name matching convention used elsewhere),
 * so e.g. the holding "ITC Limited" resolves to the "ITC" entry. Returns null when
 * unmapped, so the caller degrades honestly to sector-uncovered. */
export function sectorOf(name: string): SectorAssignment | null {
  const t = norm(name);
  if (!t) return null;
  for (const [k, v] of Object.entries(DIRECT_EQUITY_SECTOR_MAP)) {
    const nk = norm(k);
    if (t === nk || t.startsWith(nk) || nk.startsWith(t)) return v;
  }
  return null;
}
