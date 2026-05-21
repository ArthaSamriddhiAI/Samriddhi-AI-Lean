/* E1 / E2 case-mode scope-builders.
 *
 * The Samriddhi 1 pipeline activates E1 (per-stock fundamentals) and E2
 * (industry / business model) whenever the investor's existing holdings
 * include listed equity, MF, or PMS (router.ts:140-141), independent of the
 * proposal target. Before this module, pipeline-case.ts passed each agent a
 * one-sentence templated string, so the agents had nothing to cite. These
 * builders read the enriched snapshot (nifty500 per-stock fundamentals;
 * mf_funds top-5 holdings / sectors) and assemble data-grounded scope strings.
 *
 * Discipline (ADR-0024):
 *   - Data-only. Every figure is sourced from the snapshot and carries a
 *     source label so the agent cites with attribution. No model-knowledge
 *     fallback for fundamental figures.
 *   - Honest about coverage. A holding that does not join the snapshot is
 *     named and marked uncovered, not silently dropped or partially guessed.
 *   - PMS / AIF underlying-stock look-through is out of MVP scope
 *     (foundation.md:198, v8:705). For wrapper holdings and wrapper / non-equity
 *     proposal targets the scope says so explicitly; E1/E2 then assess the
 *     existing listed-equity context and the proposal's marginal impact, not
 *     the target's underlying securities (the activation-mismatch pattern).
 */

import type {
  Snapshot,
  Nifty500Company,
  MutualFundRow,
  Top5Holding,
  Top5Sector,
} from "../snapshot-loader";
import type { StructuredHoldings, Holding } from "@/db/fixtures/structured-holdings";
import type { Proposal, TargetCategory } from "../proposal";

/* ---- name matching ------------------------------------------------------ */

const FUND_PLAN_WORDS = new Set([
  "regular", "direct", "growth", "idcw", "payout", "reinvestment", "plan",
  "dividend", "option",
]);
const STOCK_SUFFIX_WORDS = new Set(["limited", "ltd"]);

function normName(raw: string | undefined, mode: "fund" | "stock"): string {
  const drop = mode === "fund" ? FUND_PLAN_WORDS : STOCK_SUFFIX_WORDS;
  return (raw ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !drop.has(w))
    .join(" ")
    .trim();
}

/* Match in one direction only: the holding name must identify the candidate
 * (exact, or a prefix/substring of the candidate). The reverse direction is
 * deliberately not allowed, so a generic holding label like
 * "US listed equities (legacy holding)" cannot false-positive onto a company
 * whose name happens to appear inside it. */
function nameMatches(normHolding: string, normCandidate: string): boolean {
  if (!normHolding || !normCandidate) return false;
  if (normHolding === normCandidate) return true;
  if (normHolding.length >= 4 && normCandidate.startsWith(normHolding)) return true;
  if (normHolding.length >= 6 && normCandidate.includes(normHolding)) return true;
  return false;
}

type Indexed<T> = { norm: string; row: T };

function indexCompanies(snapshot: Snapshot): Indexed<Nifty500Company>[] {
  const companies = snapshot.nifty500?.companies ?? [];
  return companies.map((c) => ({ norm: normName(c.name, "stock"), row: c }));
}

function indexFunds(snapshot: Snapshot): Indexed<MutualFundRow>[] {
  return (snapshot.mf_funds ?? []).map((f) => ({
    norm: normName(f.fund_name, "fund"),
    row: f,
  }));
}

function findCompany(idx: Indexed<Nifty500Company>[], name: string): Nifty500Company | null {
  const n = normName(name, "stock");
  const hit = idx.find((e) => nameMatches(n, e.norm));
  return hit ? hit.row : null;
}

function findFund(idx: Indexed<MutualFundRow>[], name: string): MutualFundRow | null {
  const n = normName(name, "fund");
  const hit = idx.find((e) => nameMatches(n, e.norm));
  return hit ? hit.row : null;
}

/* ---- formatting --------------------------------------------------------- */

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function part(label: string, v: number | null, suffix = ""): string | null {
  return v === null ? null : `${label} ${v}${suffix}`;
}

const SRC = "[source: nifty500 snapshot]";

function formatStock(c: Nifty500Company): string {
  const parts = [
    part("ROCE", num(c.roce_pct), "%"),
    part("ROE", num(c.roe_pct), "%"),
    num(c.pe) !== null
      ? `P/E ${c.pe}${num(c.industry_pe) !== null ? ` (industry ${c.industry_pe})` : ""}`
      : null,
    part("P/B", num(c.cmp_bv)),
    part("D/E", num(c.debt_equity)),
    part("interest cover", num(c.interest_coverage), "x"),
    part("3Y sales growth", num(c.sales_growth_3yr_pct), "%"),
    part("3Y profit growth", num(c.profit_growth_3yr_pct), "%"),
    num(c.promoter_holding_pct) !== null
      ? `promoter ${c.promoter_holding_pct}%${num(c.pledged_pct) !== null ? ` (pledged ${c.pledged_pct}%)` : ""}`
      : null,
  ].filter((x): x is string => x !== null);
  return `${c.name}: ${parts.join(", ")} ${SRC}`;
}

function parseTop5Holdings(v: MutualFundRow["Top 5 Holdings (JSON)"]): Top5Holding[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? (p as Top5Holding[]) : [];
  } catch {
    return [];
  }
}

function parseTop5Sectors(v: MutualFundRow["Top 5 Sectors (JSON)"]): Top5Sector[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? (p as Top5Sector[]) : [];
  } catch {
    return [];
  }
}

function fundLevelLine(f: MutualFundRow): string {
  const parts = [
    part("P/E", num(f["P/E"])),
    part("P/B", num(f["P/B"])),
    part("Beta", num(f.Beta)),
  ].filter((x): x is string => x !== null);
  return parts.length ? ` fund-level: ${parts.join(", ")}.` : "";
}

/* MF look-through line: top-5 holdings with weights, a few joined to nifty500
 * for per-stock fundamentals, plus an honest coverage note on the uncovered
 * remainder of the fund. */
function mfLookThrough(
  f: MutualFundRow,
  compIdx: Indexed<Nifty500Company>[],
  maxExpand = 3,
): string {
  const holdings = parseTop5Holdings(f["Top 5 Holdings (JSON)"]);
  if (!holdings.length) {
    return `${f.fund_name}: top-5 holdings not disclosed in snapshot.${fundLevelLine(f)}`;
  }
  const top5Weight = holdings.reduce((s, h) => s + (num(h.weight_pct) ?? 0), 0);
  const lines: string[] = [];
  holdings.slice(0, maxExpand).forEach((h) => {
    if (!h.name) return;
    const c = findCompany(compIdx, h.name);
    if (c) {
      lines.push(`    - ${h.name} (${h.weight_pct ?? "?"}%): ${formatStock(c)}`);
    } else {
      lines.push(`    - ${h.name} (${h.weight_pct ?? "?"}%): not in nifty500 coverage`);
    }
  });
  const rest = holdings.slice(maxExpand).map((h) => `${h.name} (${h.weight_pct ?? "?"}%)`);
  if (rest.length) lines.push(`    - also: ${rest.join(", ")}`);
  const coverage = `    top-5 holdings cover ~${top5Weight.toFixed(1)}% of the fund; remaining ~${(100 - top5Weight).toFixed(1)}% is not look-through-available in the snapshot.`;
  return `${f.fund_name}:${fundLevelLine(f)}\n${lines.join("\n")}\n${coverage}`;
}

/* ---- holding partitioning ----------------------------------------------- */

function isDirectIndianEquity(h: Holding): boolean {
  return h.assetClass === "Equity" && h.subCategory.startsWith("listed_");
}
function isIntlEquity(h: Holding): boolean {
  return h.subCategory.startsWith("intl_");
}
function isEquityMf(h: Holding): boolean {
  return (
    h.subCategory.startsWith("mf_active_") ||
    h.subCategory === "mf_passive_index" ||
    h.subCategory === "mf_hybrid_dynamic_aa"
  );
}
function isPmsWrapper(h: Holding): boolean {
  return h.subCategory.startsWith("pms_");
}

function targetHasListedEquityLookThrough(t: TargetCategory): boolean {
  return t === "listed_equity_direct" || t === "mutual_fund";
}

/* ---- E1 scope ----------------------------------------------------------- */

export function buildE1Scope(
  snapshot: Snapshot,
  proposal: Proposal,
  holdings: StructuredHoldings,
): string {
  const compIdx = indexCompanies(snapshot);
  const fundIdx = indexFunds(snapshot);
  const out: string[] = [];

  out.push("== Existing portfolio: listed-equity look-through ==");

  const direct = holdings.holdings.filter(isDirectIndianEquity);
  const intl = holdings.holdings.filter(isIntlEquity);
  const equityMf = holdings.holdings.filter(isEquityMf);
  const pms = holdings.holdings.filter(isPmsWrapper);

  if (direct.length) {
    out.push("Direct listed equity:");
    direct.forEach((h) => {
      const c = findCompany(compIdx, h.instrument);
      out.push(
        c
          ? `  - (${h.weightPct}% of AUM) ${formatStock(c)}`
          : `  - ${h.instrument} (${h.weightPct}% of AUM): not in nifty500 coverage; per-stock fundamentals unavailable, omitted from detail.`,
      );
    });
  }

  if (equityMf.length) {
    out.push("Equity / hybrid mutual-fund look-through:");
    equityMf.forEach((h) => {
      const f = findFund(fundIdx, h.instrument);
      out.push(
        f
          ? `  - (${h.weightPct}% of AUM) ${mfLookThrough(f, compIdx)}`
          : `  - ${h.instrument} (${h.weightPct}% of AUM): not in mf_funds coverage; no look-through available, evaluate at category level only.`,
      );
    });
  }

  if (pms.length) {
    out.push(
      "PMS wrappers (opaque, no underlying-stock look-through per MVP scope, foundation.md:198):",
    );
    pms.forEach((h) =>
      out.push(`  - ${h.instrument} (${h.subCategory}, ${h.weightPct}% of AUM)`),
    );
  }

  if (intl.length) {
    out.push("Foreign listed equity (outside nifty500 Indian coverage; no per-stock fundamentals):");
    intl.forEach((h) => out.push(`  - ${h.instrument} (${h.weightPct}% of AUM)`));
  }

  if (!direct.length && !equityMf.length && !pms.length && !intl.length) {
    out.push("None. The existing portfolio carries no listed-equity exposure.");
  }

  out.push("");
  out.push("== Proposal target ==");
  out.push(buildTargetSectionE1(proposal, compIdx, fundIdx));

  return out.join("\n");
}

function buildTargetSectionE1(
  proposal: Proposal,
  compIdx: Indexed<Nifty500Company>[],
  fundIdx: Indexed<MutualFundRow>[],
): string {
  const { target_category, target_instrument, ticket_size_cr } = proposal;
  if (target_category === "listed_equity_direct") {
    const c = findCompany(compIdx, target_instrument);
    return c
      ? `Proposed direct equity (Rs ${ticket_size_cr} Cr): ${formatStock(c)}`
      : `Proposed direct equity ${target_instrument} (Rs ${ticket_size_cr} Cr): not in nifty500 coverage; per-stock fundamentals unavailable.`;
  }
  if (target_category === "mutual_fund") {
    const f = findFund(fundIdx, target_instrument);
    return f
      ? `Proposed mutual fund (Rs ${ticket_size_cr} Cr): ${mfLookThrough(f, compIdx)}`
      : `Proposed mutual fund ${target_instrument} (Rs ${ticket_size_cr} Cr): not in mf_funds coverage; evaluate at category level only.`;
  }
  return (
    `Proposal target is ${target_category} (${target_instrument}, Rs ${ticket_size_cr} Cr); ` +
    "no listed-equity look-through available per MVP scope (foundation.md:198, v8:705). " +
    "Evaluate the existing portfolio's listed-equity exposure and the proposal's marginal " +
    "impact on it (concentration shift, complementarity, redundancy), not the target's " +
    "underlying securities."
  );
}

/* ---- E2 scope ----------------------------------------------------------- */

function companySector(c: Nifty500Company): string | null {
  const s = c.tier_b_stats?._meta?.sector;
  return typeof s === "string" && s ? s : null;
}

/* Guardrail appended when the snapshot lacks sector data for any in-scope
 * fund or holding (ADR-0024 / DP2). Without it, E2 supplements sector context
 * from its own training-data category knowledge (observed in the Iyengar
 * dry-run); this instruction keeps the verdict data-only. */
const E2_NO_SECTOR_DATA_GUARDRAIL =
  "Sector-level data is not disclosed in the snapshot for the funds/holdings above. " +
  "Do not supplement from training-data category knowledge or peer-fund averages. " +
  "State explicitly that sector data is not available and proceed without sector-level " +
  "analysis. Your verdict should focus on the dimensions where data is present " +
  "(fund-level P/E, P/B, Beta where available).";

export function buildE2Scope(
  snapshot: Snapshot,
  proposal: Proposal,
  holdings: StructuredHoldings,
): string {
  const compIdx = indexCompanies(snapshot);
  const fundIdx = indexFunds(snapshot);
  const out: string[] = [];
  let sectorMissing = false;

  out.push("== Existing portfolio: sector and business-model context ==");

  const direct = holdings.holdings.filter(isDirectIndianEquity);
  const equityMf = holdings.holdings.filter(isEquityMf);
  const pms = holdings.holdings.filter(isPmsWrapper);

  if (direct.length) {
    out.push("Direct listed equity sectors:");
    direct.forEach((h) => {
      const c = findCompany(compIdx, h.instrument);
      const sector = c ? companySector(c) : null;
      if (sector) {
        out.push(`  - ${h.instrument} (${h.weightPct}% of AUM): sector ${sector} [source: nifty500 snapshot]`);
      } else {
        out.push(`  - ${h.instrument} (${h.weightPct}% of AUM): sector not classified in snapshot.`);
        sectorMissing = true;
      }
    });
  }

  if (equityMf.length) {
    out.push("Mutual-fund top-5 sector exposure:");
    equityMf.forEach((h) => {
      const f = findFund(fundIdx, h.instrument);
      if (!f) {
        out.push(`  - ${h.instrument} (${h.weightPct}% of AUM): not in mf_funds coverage.`);
        sectorMissing = true;
        return;
      }
      const sectors = parseTop5Sectors(f["Top 5 Sectors (JSON)"]);
      if (sectors.length) {
        out.push(
          `  - ${f.fund_name} (${h.weightPct}% of AUM): ${sectors
            .map((s) => `${s.sector} ${s.weight_pct ?? "?"}%`)
            .join(", ")} [source: mf_funds snapshot]`,
        );
      } else {
        out.push(`  - ${f.fund_name} (${h.weightPct}% of AUM): top-5 sectors not disclosed in snapshot.`);
        sectorMissing = true;
      }
    });
  }

  if (pms.length) {
    out.push(
      "PMS wrappers (opaque; sector look-through unavailable per MVP scope, foundation.md:198):",
    );
    pms.forEach((h) => out.push(`  - ${h.instrument} (${h.weightPct}% of AUM)`));
  }

  if (!direct.length && !equityMf.length && !pms.length) {
    out.push("None. The existing portfolio carries no listed-equity sector exposure.");
  }

  out.push("");
  out.push("== Proposal target ==");
  out.push(buildTargetSectionE2(proposal, compIdx, fundIdx));

  /* Did the proposal target supply snapshot sector data? */
  if (proposal.target_category === "listed_equity_direct") {
    const c = findCompany(compIdx, proposal.target_instrument);
    if (!(c && companySector(c))) sectorMissing = true;
  } else if (proposal.target_category === "mutual_fund") {
    const f = findFund(fundIdx, proposal.target_instrument);
    if (!(f && parseTop5Sectors(f["Top 5 Sectors (JSON)"]).length)) sectorMissing = true;
  }

  if (sectorMissing) {
    out.push("");
    out.push(E2_NO_SECTOR_DATA_GUARDRAIL);
  }

  return out.join("\n");
}

function buildTargetSectionE2(
  proposal: Proposal,
  compIdx: Indexed<Nifty500Company>[],
  fundIdx: Indexed<MutualFundRow>[],
): string {
  const { target_category, target_instrument, ticket_size_cr } = proposal;
  if (target_category === "listed_equity_direct") {
    const c = findCompany(compIdx, target_instrument);
    const sector = c ? companySector(c) : null;
    return sector
      ? `Proposed direct equity ${target_instrument} (Rs ${ticket_size_cr} Cr): sector ${sector} [source: nifty500 snapshot].`
      : `Proposed direct equity ${target_instrument} (Rs ${ticket_size_cr} Cr): sector not classified in snapshot.`;
  }
  if (target_category === "mutual_fund") {
    const f = findFund(fundIdx, target_instrument);
    if (!f) return `Proposed mutual fund ${target_instrument} (Rs ${ticket_size_cr} Cr): not in mf_funds coverage.`;
    const sectors = parseTop5Sectors(f["Top 5 Sectors (JSON)"]);
    return sectors.length
      ? `Proposed mutual fund ${f.fund_name} (Rs ${ticket_size_cr} Cr) top-5 sectors: ${sectors
          .map((s) => `${s.sector} ${s.weight_pct ?? "?"}%`)
          .join(", ")} [source: mf_funds snapshot].`
      : `Proposed mutual fund ${f.fund_name} (Rs ${ticket_size_cr} Cr): top-5 sectors not disclosed in snapshot.`;
  }
  return (
    `Proposal target is ${target_category} (${target_instrument}, Rs ${ticket_size_cr} Cr); ` +
    "no listed-equity sector look-through available per MVP scope (foundation.md:198, v8:705). " +
    "Evaluate the existing portfolio's sector exposure and the proposal's marginal impact on it."
  );
}
