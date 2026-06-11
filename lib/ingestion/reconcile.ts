/* The reconciliation gate (Package 07, B3): the non-negotiable spine between
 * parse and store.
 *
 * Nothing parsed is stored until it reconciles: statement unit ladders must
 * tie to closing balances, closing units times the closing NAV must tie to
 * the stated market value, fund labels must resolve against the snapshot
 * universe (through the shared alias map the generator also uses), the
 * statement NAV must match the snapshot series at the anchor month, and,
 * where the corpus carries structured truth, the parse must tie to it.
 * Failures are findings with provenance, surfaced to the human; the gate
 * never auto-passes and never silently drops a folio. This is the WA16
 * mechanism that caught D14, kept as the permanent spine.
 */

import type { ParsedDocument } from "./types";

export type FundUniverseEntry = {
  fundName: string;
  monthlyNav: Record<string, number>;
};

export type AliasMap = {
  exact: Record<string, string>;
  substitutions: Record<string, string>;
};

export type GateCheck = {
  label: string;
  ok: boolean;
  detail: string;
};

export type GateReport = {
  pass: boolean;
  checks: GateCheck[];
  unresolved: Array<{ label: string; candidates: string[] }>;
};

/* TS port of the generator-side resolver (data repo
 * generators/fund_name_aliases.json is the shared artifact; the corpus run
 * manifest carries the copy used at generation time). */
export function resolveFundName(
  label: string,
  universe: string[],
  aliases: AliasMap,
): { resolved: string | null; candidates: string[] } {
  const names = new Set(universe);
  if (names.has(label)) return { resolved: label, candidates: [label] };
  const base = label.split(" (")[0].trim();
  if (names.has(base)) return { resolved: base, candidates: [base] };
  for (const cand of [label, base]) {
    const t = aliases.exact[cand];
    if (t && names.has(t)) return { resolved: t, candidates: [t] };
  }
  let test = aliases.exact[base] ?? base;
  for (const [k, v] of Object.entries(aliases.substitutions)) {
    if (test.includes(k)) test = test.replace(k, v);
  }
  let candidates = universe.filter((sn) => sn.includes(test) || test.includes(sn));
  if (candidates.length === 0) {
    const keyWords = test.split(/\s+/).slice(0, 4).join(" ");
    if (keyWords) candidates = universe.filter((sn) => sn.includes(keyWords));
  }
  if (candidates.length === 0) return { resolved: null, candidates: [] };
  const sorted = [...candidates].sort((a, b) => {
    const da = a.includes("Direct") ? 1 : 0;
    const db = b.includes("Direct") ? 1 : 0;
    if (da !== db) return da - db;
    if (a.length !== b.length) return a.length - b.length;
    return a < b ? -1 : 1;
  });
  return { resolved: sorted[0], candidates: sorted.slice(0, 5) };
}

export type EcasTruth = {
  folios: Array<{
    fund_name: string;
    resolved_fund_name: string;
    closing_units: number;
    anchor_month: string;
  }>;
};

export function reconcileEcas(
  doc: ParsedDocument,
  universe: FundUniverseEntry[],
  aliases: AliasMap,
  truth?: EcasTruth,
): GateReport {
  const checks: GateCheck[] = [];
  const unresolved: GateReport["unresolved"] = [];
  const byName = new Map(universe.map((u) => [u.fundName, u]));
  const names = universe.map((u) => u.fundName);

  checks.push({
    label: doc.sourceFile + ": folios parsed",
    ok: doc.folios.length > 0,
    detail: String(doc.folios.length),
  });

  for (const f of doc.folios) {
    const tag = doc.sourceFile + " / " + (f.fundLabel || "folio " + f.folioNo);
    const unitRows = f.transactions.filter((t) => t.units !== null);

    const unitSum = unitRows.reduce((s, t) => s + (t.units ?? 0), 0);
    checks.push({
      label: tag + ": unit sum ties to closing balance",
      ok: f.closingUnits !== null && Math.abs(unitSum - f.closingUnits) < 0.01,
      detail: unitSum.toFixed(3) + " vs " + String(f.closingUnits),
    });

    const lastBal = unitRows.length ? unitRows[unitRows.length - 1].unitBalance : null;
    checks.push({
      label: tag + ": printed ladder ties to closing balance",
      ok:
        lastBal !== null &&
        f.closingUnits !== null &&
        Math.abs(lastBal - f.closingUnits) < 0.01,
      detail: String(lastBal) + " vs " + String(f.closingUnits),
    });

    const value =
      f.closingUnits !== null && f.closingNav !== null
        ? f.closingUnits * f.closingNav
        : null;
    checks.push({
      label: tag + ": closing units x NAV ties to stated market value",
      ok:
        value !== null &&
        f.marketValueInr !== null &&
        Math.abs(value - f.marketValueInr) <= Math.max(1, (f.marketValueInr ?? 0) * 1e-4),
      detail: String(value?.toFixed(2)) + " vs " + String(f.marketValueInr),
    });

    const res = resolveFundName(f.fundLabel, names, aliases);
    if (!res.resolved) {
      unresolved.push({ label: f.fundLabel, candidates: res.candidates });
      checks.push({ label: tag + ": fund resolves in the snapshot universe", ok: false, detail: "no candidate" });
    } else {
      checks.push({ label: tag + ": fund resolves in the snapshot universe", ok: true, detail: res.resolved });
      const row = byName.get(res.resolved);
      const anchorMonth = f.closingNavDate ? f.closingNavDate.slice(0, 7) : null;
      const seriesNav = row && anchorMonth ? row.monthlyNav[anchorMonth] : undefined;
      checks.push({
        label: tag + ": statement NAV matches the snapshot series at the anchor",
        ok:
          seriesNav !== undefined &&
          f.closingNav !== null &&
          Math.abs(seriesNav - f.closingNav) < 0.01,
        detail: String(f.closingNav) + " vs series " + String(seriesNav) + " at " + String(anchorMonth),
      });
    }
  }

  if (truth) {
    checks.push({
      label: doc.sourceFile + ": folio count matches structured truth",
      ok: doc.folios.length === truth.folios.length,
      detail: doc.folios.length + " vs " + truth.folios.length,
    });
    /* PDF text reconstruction collapses whitespace runs; normalise both
     * sides before matching truth labels. */
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    for (const tf of truth.folios) {
      const pf = doc.folios.find((f) => norm(f.fundLabel) === norm(tf.fund_name));
      checks.push({
        label: doc.sourceFile + " / " + tf.fund_name + ": closing units match truth",
        ok: pf !== undefined && pf.closingUnits !== null && Math.abs(pf.closingUnits - tf.closing_units) < 0.005,
        detail: String(pf?.closingUnits) + " vs " + tf.closing_units.toFixed(3),
      });
    }
  }

  return { pass: checks.every((c) => c.ok), checks, unresolved };
}

/* Holdings-level gate for listings (spreadsheets, text, email): every parsed
 * value ties to a stated reference row within tolerance, and totals tie. */
export function reconcileHoldings(
  doc: ParsedDocument,
  reference: Array<{ label: string; valueInr: number }>,
  tolerancePct: number,
): GateReport {
  const checks: GateCheck[] = [];
  const unresolved: GateReport["unresolved"] = [];
  const used = new Set<number>();

  for (const h of doc.holdings) {
    if (h.valueInr === null) continue;
    let best = -1;
    let bestErr = Number.POSITIVE_INFINITY;
    reference.forEach((r, i) => {
      if (used.has(i)) return;
      const err = Math.abs(r.valueInr - (h.valueInr ?? 0)) / Math.max(1, r.valueInr);
      if (err < bestErr) {
        bestErr = err;
        best = i;
      }
    });
    const ok = best >= 0 && bestErr <= tolerancePct / 100;
    if (ok) used.add(best);
    else unresolved.push({ label: h.rawLabel, candidates: best >= 0 ? [reference[best].label] : [] });
    checks.push({
      label: doc.sourceFile + " / " + h.rawLabel + ": value ties to a stated holding",
      ok,
      detail:
        String(h.valueInr) +
        (best >= 0 ? " vs " + reference[best].valueInr + " (" + reference[best].label + ")" : " no reference"),
    });
  }

  const parsedTotal = doc.holdings.reduce((s, h) => s + (h.valueInr ?? 0), 0);
  const refTotal = reference.reduce((s, r) => s + r.valueInr, 0);
  checks.push({
    label: doc.sourceFile + ": parsed total ties to stated total",
    ok: refTotal > 0 && Math.abs(parsedTotal - refTotal) / refTotal <= tolerancePct / 100,
    detail: parsedTotal.toFixed(0) + " vs " + refTotal.toFixed(0),
  });

  return { pass: checks.every((c) => c.ok), checks, unresolved };
}
