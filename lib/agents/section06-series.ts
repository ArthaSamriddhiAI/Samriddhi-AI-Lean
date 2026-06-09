/* Section 06 portfolio gross/net monthly series (Package 07).
 *
 * Computes, per investor, the two series the v7.2 wireframe's section 06
 * centerpiece draws: gross market value over time and cumulative net invested
 * cost over time, from the canonical transaction-bearing records
 * (db/fixtures/investor-transactions.ts) and the real t0 snapshot series.
 *
 * Honesty rules (WA16, the Package 07 coverage ruling):
 * - A holding contributes only where real data backs its value path:
 *   - ecas_transactions: MF folios; units ladder times real monthly_nav.
 *   - price_series_terminal_anchored: listed Nifty 500 stocks; effective
 *     units backsolved at the anchor month times real monthly_prices.
 *   - index_proxy_terminal_anchored: the GIFT-route S&P 500 ETF via the real
 *     sp_500_tri_inr index, terminal-anchored at the anchor month.
 *   - contractual_accrual_terminal_anchored: FDs and bonds with contractual
 *     rate attributes; the rate shapes the path, the terminal ties exactly.
 * - PMS, AIF, physical gold (the gold_inr index is synthetic, not real),
 *   savings balances, and mixed unidentifiable US equities are excluded with
 *   reasons. No proxy without a real series behind it.
 * - The series is emitted only when covered weight clears the 70% floor.
 * - Terminal basis: every covered path ties to the canonical holding value at
 *   the anchor month (the last completed month-end grid point on or before
 *   the statement date), the same convention as the regenerated eCAS corpus.
 *
 * Deterministic, offline, zero API. Consumed by the backfill script
 * (scripts/backfill-section06-series.ts) and the verify script; the case
 * screen does not read it yet (render is the case-screen thread's mount,
 * WA09).
 */

import type {
  CanonicalHolding,
  CanonicalInvestorRecord,
} from "../../db/fixtures/canonical-holdings";
import type { Snapshot } from "./snapshot-loader";

export const SECTION06_COVERAGE_FLOOR_PCT = 70;

export type HoldingBasis =
  | "ecas_transactions"
  | "price_series_terminal_anchored"
  | "index_proxy_terminal_anchored"
  | "contractual_accrual_terminal_anchored";

export type CoveredHolding = {
  instrument: string;
  weightPct: number;
  basis: HoldingBasis;
  /* The real series identity backing the path. */
  series: string;
  firstValueMonth: string;
  costEventMonth: string;
};

export type ExcludedHolding = {
  instrument: string;
  weightPct: number;
  reason: string;
};

export type Section06Series = {
  method: "real_anchored_v1";
  anchor_month: string;
  window_start: string;
  window_start_reason: string;
  coverage: {
    covered_weight_pct: number;
    floor_pct: number;
    clears_floor: boolean;
    covered: CoveredHolding[];
    excluded: ExcludedHolding[];
  };
  /* Months ascending, window_start..anchor_month inclusive. Net is the
   * cumulative invested cost of covered holdings (cost events before the
   * window are included from the first month as the already-invested base).
   * Gross can dip below net in drawdowns; that is the real story. */
  monthly: Array<{
    month: string;
    gross_value_inr: number;
    net_invested_inr: number;
  }>;
};

type MonthValue = Record<string, number>;

function monthAdd(mk: string, delta: number): string {
  const y = Number(mk.slice(0, 4));
  const m = Number(mk.slice(5, 7)) - 1 + delta;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${String(yy).padStart(4, "0")}-${String(mm + 1).padStart(2, "0")}`;
}

function monthsBetween(a: string, b: string): number {
  return (
    (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 +
    (Number(b.slice(5, 7)) - Number(a.slice(5, 7)))
  );
}

function monthRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let mk = start; mk <= end; mk = monthAdd(mk, 1)) out.push(mk);
  return out;
}

function seriesAt(series: MonthValue, mk: string): number | null {
  return Object.prototype.hasOwnProperty.call(series, mk) ? series[mk] : null;
}

type HoldingPath = {
  covered: CoveredHolding;
  /* value at month (absent before the holding's first value month) */
  valueAt: (mk: string) => number | null;
  /* cost events: month -> invested amount */
  costEvents: Array<{ month: string; amountInr: number }>;
};

function fail(msg: string): never {
  throw new Error("section06-series: " + msg);
}

function mfPath(h: CanonicalHolding, snapshot: Snapshot, anchor: string): HoldingPath {
  const row = snapshot.mf_funds.find((f) => f.fund_name === h.resolvedInstrument);
  if (!row || !row.monthly_nav) fail(h.instrument + ": resolved fund not in snapshot");
  const nav = row.monthly_nav as MonthValue;
  const txns = (h.transactions ?? []).filter((t) => t.units !== null);
  if (txns.length === 0) fail(h.instrument + ": no unit-bearing transactions");
  const unitsByMonth = new Map<string, number>();
  for (const t of txns) {
    const mk = t.date.slice(0, 7);
    unitsByMonth.set(mk, (unitsByMonth.get(mk) ?? 0) + (t.units ?? 0));
  }
  const eventMonths = [...unitsByMonth.keys()].sort();
  const first = eventMonths[0];
  const ladder = new Map<string, number>();
  let running = 0;
  for (const mk of monthRange(first, anchor)) {
    running += unitsByMonth.get(mk) ?? 0;
    ladder.set(mk, running);
  }
  const terminal = (ladder.get(anchor) ?? 0) * (seriesAt(nav, anchor) ?? NaN);
  if (Math.abs(terminal - h.valueCr * 1e7) > 1.0) {
    fail(h.instrument + ": eCAS ladder does not tie to canonical value at the anchor");
  }
  return {
    covered: {
      instrument: h.instrument,
      weightPct: 0,
      basis: "ecas_transactions",
      series: h.resolvedInstrument ?? "",
      firstValueMonth: first,
      costEventMonth: first,
    },
    valueAt: (mk) => {
      if (mk < first) return null;
      const units = ladder.get(mk);
      const v = seriesAt(nav, mk);
      if (units === undefined || v === null) return null;
      return units * v;
    },
    costEvents: txns
      .filter((t) => t.amountInr !== null)
      .map((t) => ({ month: t.date.slice(0, 7), amountInr: t.amountInr ?? 0 })),
  };
}

const STOCK_NAME_BY_INSTRUMENT: Record<string, string> = {
  "Reliance Industries": "Reliance Industries",
  "HDFC Bank": "HDFC Bank",
  "ITC Limited": "ITC",
};

function stockPath(h: CanonicalHolding, snapshot: Snapshot, anchor: string): HoldingPath {
  const name = STOCK_NAME_BY_INSTRUMENT[h.instrument];
  if (!name) fail(h.instrument + ": no stock mapping");
  const row = (snapshot.nifty500.companies ?? []).find((c) => c.name === name);
  if (!row || !row.monthly_prices) fail(h.instrument + ": no monthly_prices for " + name);
  const px = row.monthly_prices as MonthValue;
  const anchorPx = seriesAt(px, anchor);
  if (anchorPx === null) fail(h.instrument + ": no anchor price");
  const effUnits = (h.valueCr * 1e7) / anchorPx;
  const seriesStart = Object.keys(px).sort()[0];
  const purchaseMonth = (h.purchaseDate ?? "").slice(0, 7);
  const first = purchaseMonth > seriesStart ? purchaseMonth : seriesStart;
  return {
    covered: {
      instrument: h.instrument,
      weightPct: 0,
      basis: "price_series_terminal_anchored",
      series: name + " monthly_prices",
      firstValueMonth: first,
      costEventMonth: purchaseMonth,
    },
    valueAt: (mk) => {
      if (mk < first) return null;
      const v = seriesAt(px, mk);
      return v === null ? null : effUnits * v;
    },
    costEvents: [
      { month: purchaseMonth, amountInr: h.costBasisTotalInr ?? 0 },
    ],
  };
}

function etfPath(h: CanonicalHolding, snapshot: Snapshot, anchor: string): HoldingPath {
  const idx = snapshot.indices?.["sp_500_tri_inr"]?.monthly_values as MonthValue | undefined;
  if (!idx) fail(h.instrument + ": sp_500_tri_inr index missing");
  const anchorIdx = seriesAt(idx, anchor);
  if (anchorIdx === null) fail(h.instrument + ": no anchor index value");
  const purchaseMonth = (h.purchaseDate ?? "").slice(0, 7);
  const seriesStart = Object.keys(idx).sort()[0];
  const first = purchaseMonth > seriesStart ? purchaseMonth : seriesStart;
  return {
    covered: {
      instrument: h.instrument,
      weightPct: 0,
      basis: "index_proxy_terminal_anchored",
      series: "sp_500_tri_inr (real, INR)",
      firstValueMonth: first,
      costEventMonth: purchaseMonth,
    },
    valueAt: (mk) => {
      if (mk < first) return null;
      const v = seriesAt(idx, mk);
      return v === null ? null : (h.valueCr * 1e7) * (v / anchorIdx);
    },
    costEvents: [
      { month: purchaseMonth, amountInr: h.costBasisTotalInr ?? 0 },
    ],
  };
}

function accrualPath(h: CanonicalHolding, anchor: string): HoldingPath {
  const attrs = h.vehicleAttributes ?? {};
  const rate = Number(
    (attrs["interest_rate"] as number | undefined) ??
      (attrs["yield"] as number | undefined),
  );
  if (!rate || Number.isNaN(rate)) fail(h.instrument + ": no contractual rate attribute");
  const purchaseMonth = (h.purchaseDate ?? "").slice(0, 7);
  if (!purchaseMonth) fail(h.instrument + ": no purchase date");
  const annual = rate / 100;
  return {
    covered: {
      instrument: h.instrument,
      weightPct: 0,
      basis: "contractual_accrual_terminal_anchored",
      series: "contractual rate " + rate + "% (holding attributes)",
      firstValueMonth: purchaseMonth,
      costEventMonth: purchaseMonth,
    },
    valueAt: (mk) => {
      if (mk < purchaseMonth) return null;
      const monthsBack = monthsBetween(mk, anchor);
      return (h.valueCr * 1e7) / Math.pow(1 + annual, monthsBack / 12);
    },
    costEvents: [
      { month: purchaseMonth, amountInr: h.costBasisTotalInr ?? 0 },
    ],
  };
}

const EXCLUSION_REASONS: Partial<Record<string, string>> = {
  pms_growth_quality: "PMS wrapper is opaque; no instrument-level series",
  pms_concentrated_quality: "PMS wrapper is opaque; no instrument-level series",
  pms_value: "PMS wrapper is opaque; no instrument-level series",
  pms_focused_midcap: "PMS wrapper is opaque; no instrument-level series",
  aif_cat_iii_long_short: "AIF wrapper is opaque; no instrument-level series",
  aif_cat_ii_private_credit: "AIF wrapper is opaque; no instrument-level series",
  physical_gold: "gold_inr index is synthetic, not real; no real series",
  savings: "savings balance has no dated history",
  intl_us_individual: "mixed unidentifiable US equities; no honest series mapping",
};

function pathFor(
  h: CanonicalHolding,
  snapshot: Snapshot,
  anchor: string,
): HoldingPath | { excludedReason: string } {
  if (h.transactions && h.resolvedInstrument) return mfPath(h, snapshot, anchor);
  if (h.subCategory === "listed_large_cap") return stockPath(h, snapshot, anchor);
  if (h.subCategory === "intl_us_etf") return etfPath(h, snapshot, anchor);
  if (h.subCategory === "bank_fd" || h.subCategory === "tax_free_bond") {
    return accrualPath(h, anchor);
  }
  const reason = EXCLUSION_REASONS[h.subCategory];
  if (reason) return { excludedReason: reason };
  /* MF holdings without eCAS truth (Bhatt's tail funds): single-lot rows with
   * no transaction history; honest treatment is exclusion until they carry
   * statements. */
  if (h.subCategory.startsWith("mf_")) {
    return { excludedReason: "no eCAS transaction history for this folio" };
  }
  return { excludedReason: "no real series for sub-category " + h.subCategory };
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export function computeSection06Series(
  rec: CanonicalInvestorRecord,
  snapshot: Snapshot,
  anchorMonth: string,
): Section06Series {
  const paths: HoldingPath[] = [];
  const excluded: ExcludedHolding[] = [];

  for (const h of rec.holdings) {
    const weightPct = round1((h.valueCr / rec.totalLiquidAumCr) * 100);
    const p = pathFor(h, snapshot, anchorMonth);
    if ("excludedReason" in p) {
      excluded.push({ instrument: h.instrument, weightPct, reason: p.excludedReason });
    } else {
      p.covered.weightPct = weightPct;
      paths.push(p);
    }
  }

  const coveredWeight = round1(paths.reduce((s, p) => s + p.covered.weightPct, 0));
  const clears = coveredWeight >= SECTION06_COVERAGE_FLOOR_PCT;

  /* Window start: the earliest covered value month, pushed forward past any
   * covered holding whose purchase predates its real series (a value path
   * cannot start before its series). */
  let windowStart = anchorMonth;
  for (const p of paths) {
    if (p.covered.firstValueMonth < windowStart) windowStart = p.covered.firstValueMonth;
  }
  let clampedBy: string | null = null;
  for (const p of paths) {
    if (p.covered.costEventMonth < p.covered.firstValueMonth && p.covered.firstValueMonth > windowStart) {
      windowStart = p.covered.firstValueMonth;
      clampedBy = p.covered.instrument;
    }
  }

  const months = monthRange(windowStart, anchorMonth);
  const monthly = months.map((mk) => {
    let gross = 0;
    for (const p of paths) {
      const v = p.valueAt(mk);
      if (v !== null) gross += v;
    }
    let net = 0;
    for (const p of paths) {
      for (const e of p.costEvents) {
        if (e.month <= mk) net += e.amountInr;
      }
    }
    return {
      month: mk,
      gross_value_inr: Math.round(gross),
      net_invested_inr: Math.round(net),
    };
  });

  return {
    method: "real_anchored_v1",
    anchor_month: anchorMonth,
    window_start: windowStart,
    window_start_reason: clampedBy
      ? "clamped to the real price-series start of " + clampedBy +
        " (purchased before the series begins)"
      : "earliest covered value month",
    coverage: {
      covered_weight_pct: coveredWeight,
      floor_pct: SECTION06_COVERAGE_FLOOR_PCT,
      clears_floor: clears,
      covered: paths.map((p) => p.covered),
      excluded,
    },
    monthly,
  };
}
