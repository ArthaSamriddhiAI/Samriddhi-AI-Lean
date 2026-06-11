/* Read-only row builders for the data-universe explorer (Package 10, RE2).
 *
 * Pure projections over the loaded snapshot: no recompute, no mutation, no
 * model calls. Numeric conventions follow the instrument-selection readers
 * (ADR-0034 lineage): TER and period returns are stored as fractions despite
 * their "(%)" labels; the cap-split fields are fractions of 1; Cash % is a
 * percent. The builders convert to display percent where the column says so.
 */

import type { Snapshot, MutualFundRow, Nifty500Company, SnapshotIndexSeries } from "@/lib/agents/snapshot-loader";

export const FAMILIES = [
  "mf_funds",
  "listed",
  "pms",
  "aif",
  "unlisted",
  "indices",
  "fx",
  "yields",
  "macro",
] as const;
export type Family = (typeof FAMILIES)[number];

export const FAMILY_LABELS: Record<Family, string> = {
  mf_funds: "Mutual funds",
  listed: "Listed equity",
  pms: "PMS",
  aif: "AIF",
  unlisted: "Unlisted",
  indices: "Indices",
  fx: "FX",
  yields: "Debt yields",
  macro: "Macro",
};

export const TABLE_LIMIT = 200;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
/** Fraction-stored fields rendered as percent (TER, period returns, cap split). */
function pct(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.round(n * 10000) / 100;
}
function r2(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.round(n * 100) / 100;
}

export type ProvenanceKind = "real_t0" | "forward_v2" | "forward_v1_stale" | "baseline_unknown";

export type SnapshotProvenance = {
  kind: ProvenanceKind;
  evolutionType: string | null;
  generationNotes: string | null;
  enrichmentVersion: string | null;
  forwardDerivation: Record<string, unknown> | null;
  realDataBuild: Record<string, unknown> | null;
  yieldsNote: string | null;
};

export function snapshotProvenance(snap: Snapshot): SnapshotProvenance {
  const sm = (snap as Record<string, unknown>).snapshot_metadata as Record<string, unknown> | undefined;
  const rdb = (sm?.real_data_build as Record<string, unknown>) ?? null;
  const fd = (sm?.forward_derivation as Record<string, unknown>) ?? null;
  const evolution = (sm?.evolution_type as string) ?? null;
  let kind: ProvenanceKind = "baseline_unknown";
  if (rdb) kind = "real_t0";
  else if (fd) kind = "forward_v2";
  else if (evolution && evolution !== "baseline") kind = "forward_v1_stale";
  return {
    kind,
    evolutionType: evolution,
    generationNotes: (sm?.generation_notes as string) ?? null,
    enrichmentVersion: (sm?.enrichment_version as string) ?? null,
    forwardDerivation: fd,
    realDataBuild: rdb,
    yieldsNote: (fd?.debt_yield_primitives as string) ?? null,
  };
}

/* ----- mutual funds ----- */

export type MfRow = {
  name: string;
  category: string;
  aumCr: number | null;
  terPct: number | null;
  ageYears: number | null;
  ret3yPct: number | null;
  sharpe3y: number | null;
  beta3y: number | null;
  vol3y: number | null;
  capLarge: number | null;
  capMid: number | null;
  capSmall: number | null;
  benchmark: string | null;
  resolution: string | null;
};

export function mfRows(snap: Snapshot, q: string): { rows: MfRow[]; total: number } {
  const all = (snap.mf_funds ?? []) as MutualFundRow[];
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? all.filter((f) => {
        const r = f as Record<string, unknown>;
        return (
          String(f.fund_name ?? "").toLowerCase().includes(needle) ||
          String(f.sebi_category ?? "").toLowerCase().includes(needle) ||
          String(r["Benchmark Index"] ?? "").toLowerCase().includes(needle)
        );
      })
    : all;
  const rows = filtered.slice(0, TABLE_LIMIT).map((f) => {
    const r = f as Record<string, unknown>;
    const tb = (f.tier_b_stats ?? {}) as Record<string, unknown>;
    return {
      name: String(f.fund_name ?? ""),
      category: String(f.sebi_category ?? ""),
      aumCr: num(r["AUM (Cr)"]),
      terPct: pct(r["TER (%)"]),
      ageYears: num(r["Age (Yrs)"]),
      ret3yPct: pct(r["3Y"]),
      sharpe3y: r2(tb.sharpe_3y),
      beta3y: r2(tb.beta_3y),
      vol3y: r2(tb.vol_3y_annualized),
      capLarge: pct(r["LargeCap %"]),
      capMid: pct(r["MidCap %"]),
      capSmall: pct(r["SmallCap %"]),
      benchmark: (r["Benchmark Index"] as string) ?? null,
      resolution: (tb._benchmark_resolution as string) ?? null,
    };
  });
  return { rows, total: filtered.length };
}

export function mfSeries(snap: Snapshot, name: string): Record<string, number> | null {
  const f = ((snap.mf_funds ?? []) as MutualFundRow[]).find((x) => String(x.fund_name ?? "") === name);
  return (f?.monthly_nav as Record<string, number>) ?? null;
}

/* ----- listed equity ----- */

export type ListedRow = {
  name: string;
  cmpRs: number | null;
  mcapCr: number | null;
  pe: number | null;
  roePct: number | null;
  debtEquity: number | null;
  ret6mPct: number | null;
  sharpe3y: number | null;
  beta3y: number | null;
  sector: string | null;
};

export function listedRows(snap: Snapshot, q: string): { rows: ListedRow[]; total: number } {
  const all = ((snap.nifty500 as { companies?: Nifty500Company[] })?.companies ?? []) as Nifty500Company[];
  const needle = q.trim().toLowerCase();
  const filtered = needle ? all.filter((c) => String(c.name ?? "").toLowerCase().includes(needle)) : all;
  const rows = filtered.slice(0, TABLE_LIMIT).map((c) => {
    const r = c as Record<string, unknown>;
    const tb = (c.tier_b_stats ?? {}) as Record<string, unknown>;
    return {
      name: String(c.name ?? ""),
      cmpRs: num(r.cmp_rs),
      mcapCr: num(c.market_cap_rs_cr),
      pe: r2(c.pe),
      roePct: r2(c.roe_pct),
      debtEquity: r2(c.debt_equity),
      ret6mPct: r2(c.return_6m_pct),
      sharpe3y: r2(tb.sharpe_3y),
      beta3y: r2(tb.beta_3y),
      sector: ((tb._meta as Record<string, unknown>)?.sector as string) ?? null,
    };
  });
  return { rows, total: filtered.length };
}

export function stockSeries(snap: Snapshot, name: string): Record<string, number> | null {
  const all = ((snap.nifty500 as { companies?: Nifty500Company[] })?.companies ?? []) as Nifty500Company[];
  const c = all.find((x) => String(x.name ?? "") === name);
  return (c?.monthly_prices as Record<string, number>) ?? null;
}

/* ----- PMS ----- */

export type PmsRow = {
  name: string;
  category: string | null;
  strategyType: string | null;
  aumCr: number | null;
  ageYears: number | null;
  benchmark: string | null;
  dataQuality: string | null;
};

export function pmsRows(snap: Snapshot, q: string): { rows: PmsRow[]; total: number } {
  const all = ((snap.pms as { funds?: Record<string, unknown>[] })?.funds ?? []) as Record<string, unknown>[];
  const needle = q.trim().toLowerCase();
  const mapped = all.map((p) => {
    const id = (p.identity ?? {}) as Record<string, unknown>;
    const scale = (p.scale ?? {}) as Record<string, unknown>;
    const dq = p.data_quality;
    return {
      name: String(id.fund_name ?? p.fund_id ?? ""),
      category: (id.category as string) ?? null,
      strategyType: (id.strategy_type as string) ?? null,
      aumCr: num(scale.aum_cr),
      ageYears: r2(id.portfolio_age_years),
      benchmark: (id.benchmark as string) ?? null,
      dataQuality: typeof dq === "string" ? dq : dq ? JSON.stringify(dq).slice(0, 40) : null,
    };
  });
  const filtered = needle
    ? mapped.filter((p) => p.name.toLowerCase().includes(needle) || (p.category ?? "").toLowerCase().includes(needle))
    : mapped;
  return { rows: filtered.slice(0, TABLE_LIMIT), total: filtered.length };
}

/* ----- AIF ----- */

export type AifRow = {
  name: string;
  sebiCategory: string | null;
  amc: string | null;
  structure: string | null;
  minCommitmentCr: number | null;
  mgmtFeePct: string | null;
  perfFeePct: string | null;
  hurdlePct: string | null;
};

export function aifRows(snap: Snapshot, q: string): { rows: AifRow[]; total: number } {
  const all = ((snap.aif as { "Fund Profiles"?: Record<string, unknown>[] })?.["Fund Profiles"] ?? []) as Record<string, unknown>[];
  const needle = q.trim().toLowerCase();
  const mapped = all.map((a) => ({
    name: String(a["Fund Name"] ?? ""),
    sebiCategory: (a["SEBI Category"] as string) ?? null,
    amc: (a["AMC / Investment Manager"] as string) ?? null,
    structure: (a["Structure"] as string) ?? null,
    minCommitmentCr: num(a["Min Commitment (Cr)"]),
    mgmtFeePct: a["Mgmt Fee % (Primary)"] != null ? String(a["Mgmt Fee % (Primary)"]) : null,
    perfFeePct: a["Perf Fee % (Primary)"] != null ? String(a["Perf Fee % (Primary)"]) : null,
    hurdlePct: a["Hurdle % (Primary)"] != null ? String(a["Hurdle % (Primary)"]) : null,
  }));
  const filtered = needle
    ? mapped.filter((a) => a.name.toLowerCase().includes(needle) || (a.amc ?? "").toLowerCase().includes(needle))
    : mapped;
  return { rows: filtered.slice(0, TABLE_LIMIT), total: filtered.length };
}

/* ----- unlisted ----- */

export type UnlistedRow = {
  name: string;
  city: string | null;
  status: string | null;
  ageYears: number | null;
  businessModelTag: string | null;
  sector: string | null;
};

export function unlistedRows(snap: Snapshot, q: string): { rows: UnlistedRow[]; total: number } {
  const all = ((snap as Record<string, unknown>).unlisted_equity ?? []) as Record<string, unknown>[];
  const needle = q.trim().toLowerCase();
  const mapped = all.map((u) => {
    const id = (u.identity ?? {}) as Record<string, unknown>;
    const cl = (u.classification ?? {}) as Record<string, unknown>;
    const sector = (cl.sector as string) ?? (typeof cl.industry === "string" ? (cl.industry as string).split("|")[0].trim() : null);
    return {
      name: String(id.name ?? ""),
      city: (id.registered_city as string) ?? null,
      status: (id.status as string) ?? null,
      ageYears: r2(id.age_years),
      businessModelTag: (cl.business_model_tag as string) ?? null,
      sector,
    };
  });
  const filtered = needle ? mapped.filter((u) => u.name.toLowerCase().includes(needle)) : mapped;
  return { rows: filtered.slice(0, TABLE_LIMIT), total: filtered.length };
}

/* ----- indices, fx, yields ----- */

export type SeriesRow = {
  id: string;
  name: string | null;
  category: string | null;
  points: number;
  endMonth: string | null;
  endValue: number | null;
  provenance: string;
};

function indexProvenance(node: SnapshotIndexSeries & Record<string, unknown>): string {
  const meta = (node._meta ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (meta.source) parts.push(String(meta.source));
  else if (node.synthesis_method) parts.push(`synthetic (${node.synthesis_method})`);
  else parts.push("synthetic (phase-b)");
  if (meta.superseded_synthetic) parts.push("superseded in place");
  if (meta.forward_extension) parts.push(String(meta.forward_extension));
  return parts.join("; ");
}

export function indexRows(snap: Snapshot, q: string): { rows: SeriesRow[]; total: number } {
  const idx = ((snap as Record<string, unknown>).indices ?? {}) as Record<string, SnapshotIndexSeries & Record<string, unknown>>;
  const needle = q.trim().toLowerCase();
  const ids = Object.keys(idx).sort();
  const mapped = ids.map((id) => {
    const node = idx[id];
    const mv = (node.monthly_values ?? {}) as Record<string, number>;
    const months = Object.keys(mv).sort();
    const end = months[months.length - 1] ?? null;
    return {
      id,
      name: node.name ?? null,
      category: node.category ?? null,
      points: months.length,
      endMonth: end,
      endValue: end ? Math.round(mv[end] * 100) / 100 : null,
      provenance: indexProvenance(node),
    };
  });
  const filtered = needle ? mapped.filter((r) => r.id.includes(needle) || (r.name ?? "").toLowerCase().includes(needle)) : mapped;
  return { rows: filtered.slice(0, TABLE_LIMIT), total: filtered.length };
}

export function indexSeries(snap: Snapshot, id: string): Record<string, number> | null {
  const idx = ((snap as Record<string, unknown>).indices ?? {}) as Record<string, SnapshotIndexSeries>;
  return (idx[id]?.monthly_values as Record<string, number>) ?? null;
}

/** fx values are stored plain on the realv1 t0 and wrapped on machine-extended
 * forward snapshots; read both shapes. */
export function fxRows(snap: Snapshot): SeriesRow[] {
  const fx = ((snap as Record<string, unknown>).fx ?? {}) as Record<string, unknown>;
  return Object.keys(fx)
    .sort()
    .map((pair) => {
      const node = fx[pair];
      let mv: Record<string, number> | null = null;
      if (node && typeof node === "object") {
        const n = node as Record<string, unknown>;
        mv = (n.monthly_values as Record<string, number>) ?? (Object.keys(n).every((k) => /^\d{4}-\d{2}$/.test(k)) ? (n as Record<string, number>) : null);
      }
      const months = mv ? Object.keys(mv).sort() : [];
      const end = months[months.length - 1] ?? null;
      return {
        id: pair,
        name: pair.toUpperCase().replace("_", "/"),
        category: "fx",
        points: months.length,
        endMonth: end,
        endValue: end && mv ? Math.round(mv[end] * 1000) / 1000 : null,
        provenance: node == null ? "reserved placeholder (None)" : mv && "monthly_values" in (node as Record<string, unknown>) ? "machine-extended forward" : "real-pulled (Bloomberg), plain series",
      };
    });
}

export function fxSeries(snap: Snapshot, pair: string): Record<string, number> | null {
  const fx = ((snap as Record<string, unknown>).fx ?? {}) as Record<string, unknown>;
  const node = fx[pair];
  if (!node || typeof node !== "object") return null;
  const n = node as Record<string, unknown>;
  if (n.monthly_values) return n.monthly_values as Record<string, number>;
  if (Object.keys(n).every((k) => /^\d{4}-\d{2}$/.test(k))) return n as Record<string, number>;
  return null;
}

export function yieldRows(snap: Snapshot): SeriesRow[] {
  const y = ((snap as Record<string, unknown>).debt_yield_primitives ?? {}) as Record<string, Record<string, unknown>>;
  return Object.keys(y)
    .sort()
    .map((id) => {
      const node = y[id] ?? {};
      const mv = (node.annualised_yield_pct ?? {}) as Record<string, number>;
      const months = Object.keys(mv).sort();
      const end = months[months.length - 1] ?? null;
      const meta = (node._meta ?? {}) as Record<string, unknown>;
      return {
        id,
        name: id,
        category: "annualised yield (percent)",
        points: months.length,
        endMonth: end,
        endValue: end ? Math.round(mv[end] * 100) / 100 : null,
        provenance: String(meta.source ?? ""),
      };
    });
}

export function yieldSeries(snap: Snapshot, id: string): Record<string, number> | null {
  const y = ((snap as Record<string, unknown>).debt_yield_primitives ?? {}) as Record<string, Record<string, unknown>>;
  return (y[id]?.annualised_yield_pct as Record<string, number>) ?? null;
}

/* ----- macro ----- */

export type MacroIndicator = {
  sNo: string | null;
  indicator: string;
  value: string;
  direction: string | null;
  asOf: string | null;
  source: string | null;
};
export type MacroDimension = { dimension: string; indicators: MacroIndicator[] };

export function macroDimensions(snap: Snapshot): MacroDimension[] {
  const dims = (((snap as Record<string, unknown>).macro as Record<string, unknown>)?.data_snapshot as Record<string, unknown>)
    ?.dimensions as Record<string, unknown>[] | undefined;
  return (dims ?? []).map((d) => ({
    dimension: String(d.dimension ?? d.name ?? ""),
    indicators: ((d.indicators ?? []) as Record<string, unknown>[]).map((i) => ({
      sNo: i.s_no != null ? String(i.s_no) : null,
      indicator: String(i.indicator ?? ""),
      value: String(i.value ?? ""),
      direction: i.direction != null ? String(i.direction) : null,
      asOf: i.as_of_date != null ? String(i.as_of_date) : null,
      source: i.source_document != null ? String(i.source_document) : null,
    })),
  }));
}
