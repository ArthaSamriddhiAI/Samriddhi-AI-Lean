/* Verification script for Snapshot Data Enrichment design-doc probes.
 * Run via: npx tsx scripts/_verify-snapshot-enrichment.ts
 *
 * This is the regression contract from SNAPSHOT_TEST_AXIS_DESIGN.md, executed
 * against the enriched snapshots in fixtures/snapshots/enriched/. Deterministic,
 * no API spend; asserts and exits non-zero on failure (the going-forward
 * _verify-* convention). The narrative beats it pins:
 *
 *   1. Reliance Industries quarterly CMP progression (the calibration anchor):
 *      +7.2% t2->t3, +14.3% t4->t5, -28.0% t5->t6, +16.2% t7->t8, and
 *      monthly_prices[last] == cmp_rs at every snapshot (ADR-1 zero-tolerance).
 *   2. RIL idiosyncratic beat lands in 2027-10 at t6 (~-26% in the month).
 *   3. Bank shock lands in 2027-07 at t5 (HDFC Bank ~-16% in the month).
 *   4. Rate-cut beat: Gilt funds Nov->Dec 2026 ~+4.5% at t3.
 *   5. Smallcap rally: small-cap stocks Feb->Mar 2028 ~+7% at t8.
 *
 * Per ADR-1, a few instruments show compensating intra-quarter moves where the
 * source quarterly engine produced an unusual target (e.g. the SBI bank-shock
 * miss); the aggregate probes tolerate a minority of outliers accordingly. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Failure = { name: string; detail: string };
const failures: Failure[] = [];

function assert(cond: boolean, name: string, detail: string) {
  if (!cond) failures.push({ name, detail });
  const tag = cond ? "PASS" : "FAIL";
  console.log(`  [${tag}] ${name}${cond ? "" : ` -- ${detail}`}`);
}

const SNAPSHOT_IDS = [
  "t0_q2_2026",
  "t1_q3_2026",
  "t2_q4_2026",
  "t3_q1_2027",
  "t4_q2_2027",
  "t5_q3_2027",
  "t6_q4_2027",
  "t7_q1_2028",
  "t8_q2_2028",
] as const;

type Snapshot = {
  mf_funds: Array<{
    fund_name: string;
    sebi_category?: string;
    monthly_nav?: Record<string, number>;
  }>;
  nifty500: {
    companies: Array<{
      name: string;
      cmp_rs: number;
      monthly_prices: Record<string, number>;
      tier_b_stats: { _meta?: { cap_tier?: string; sector?: string } };
    }>;
  };
};

const cache = new Map<number, Snapshot>();
function load(tIdx: number): Snapshot {
  const hit = cache.get(tIdx);
  if (hit) return hit;
  const p = resolve(
    __dirname,
    `../fixtures/snapshots/enriched/snapshot_${SNAPSHOT_IDS[tIdx]}.json`,
  );
  const snap = JSON.parse(readFileSync(p, "utf-8")) as Snapshot;
  cache.set(tIdx, snap);
  return snap;
}

function company(snap: Snapshot, name: string) {
  const c = snap.nifty500.companies.find((x) => x.name === name);
  if (!c) throw new Error(`company not found: ${name}`);
  return c;
}
function lastMonth(series: Record<string, number>): string {
  return Object.keys(series).sort().at(-1)!;
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* ---------------------------------------------------------------- */
/* Probe 1: RIL quarterly CMP progression + calibration anchor.     */
/* ---------------------------------------------------------------- */
console.log("Probe 1: Reliance Industries quarterly CMP + calibration anchor");

function rilCmp(tIdx: number): number {
  return company(load(tIdx), "Reliance Industries").cmp_rs;
}
const rilQoQ: Array<[string, number, number, number]> = [
  // [label, ratio, expected, tol]
  ["RIL t2->t3 (+7.2%)", rilCmp(3) / rilCmp(2), 1.072, 0.005],
  ["RIL t4->t5 (+14.3%)", rilCmp(5) / rilCmp(4), 1.143, 0.005],
  ["RIL t5->t6 (-28.0%)", rilCmp(6) / rilCmp(5), 0.72, 0.005],
  ["RIL t7->t8 (+16.2%)", rilCmp(8) / rilCmp(7), 1.162, 0.005],
];
for (const [label, ratio, exp, tol] of rilQoQ) {
  assert(
    Math.abs(ratio - exp) < tol,
    label,
    `ratio=${ratio.toFixed(5)} expected≈${exp}±${tol}`,
  );
}
for (let t = 2; t <= 8; t++) {
  const c = company(load(t), "Reliance Industries");
  const lm = lastMonth(c.monthly_prices);
  const mp = c.monthly_prices[lm];
  const relErr = Math.abs(mp / c.cmp_rs - 1);
  assert(
    relErr < 1e-6,
    `RIL calibration anchor @${SNAPSHOT_IDS[t]}`,
    `monthly_prices[${lm}]=${mp} vs cmp_rs=${c.cmp_rs} relErr=${relErr.toExponential(2)}`,
  );
}

/* ---------------------------------------------------------------- */
/* Probe 2: RIL idiosyncratic beat lands in 2027-10 at t6.          */
/* ---------------------------------------------------------------- */
console.log("Probe 2: RIL idio beat in 2027-10 at t6 (~-26% month)");
{
  const mp = company(load(6), "Reliance Industries").monthly_prices;
  const ratio = mp["2027-10"] / mp["2027-09"];
  assert(
    Math.abs(ratio - 0.74) < 0.02,
    "RIL 2027-10/2027-09 ≈ 0.74",
    `ratio=${ratio.toFixed(4)} (Sep=${mp["2027-09"].toFixed(2)} Oct=${mp["2027-10"].toFixed(2)})`,
  );
}

/* ---------------------------------------------------------------- */
/* Probe 3: Bank shock lands in 2027-07 at t5 (HDFC Bank ~-16%).    */
/* ---------------------------------------------------------------- */
console.log("Probe 3: HDFC Bank bank-shock in 2027-07 at t5 (~-16% month)");
{
  const mp = company(load(5), "HDFC Bank").monthly_prices;
  const ratio = mp["2027-07"] / mp["2027-06"];
  assert(
    Math.abs(ratio - 0.84) < 0.02,
    "HDFC Bank 2027-07/2027-06 ≈ 0.84",
    `ratio=${ratio.toFixed(4)} (Jun=${mp["2027-06"].toFixed(2)} Jul=${mp["2027-07"].toFixed(2)})`,
  );
}

/* ---------------------------------------------------------------- */
/* Probe 4: Rate-cut beat -- Gilt funds Nov->Dec 2026 ~+4.5% at t3. */
/* ---------------------------------------------------------------- */
console.log("Probe 4: Gilt funds Nov->Dec 2026 ≈ +4.5% at t3");
{
  const s3 = load(3);
  const gilt = s3.mf_funds.filter(
    (f) =>
      f.sebi_category?.includes("Gilt Fund") &&
      f.monthly_nav?.["2026-11"] != null &&
      f.monthly_nav?.["2026-12"] != null,
  );
  const rets = gilt.map((f) => {
    const mn = f.monthly_nav!;
    return mn["2026-12"] / mn["2026-11"] - 1;
  });
  const med = median(rets);
  const within = rets.filter((r) => Math.abs(r - 0.045) < 0.005).length;
  const frac = within / rets.length;
  console.log(
    `  (n=${rets.length} median=${med.toFixed(5)} min=${Math.min(...rets).toFixed(5)} max=${Math.max(...rets).toFixed(5)} within±0.005=${(frac * 100).toFixed(1)}%)`,
  );
  assert(gilt.length >= 20, "Gilt fund count", `only ${gilt.length} qualifying gilt funds`);
  assert(
    Math.abs(med - 0.045) < 0.003,
    "Gilt median Nov->Dec ≈ 0.045",
    `median=${med.toFixed(5)}`,
  );
  assert(frac >= 0.9, "Gilt ≥90% within ±0.005 of 0.045", `frac=${(frac * 100).toFixed(1)}%`);
}

/* ---------------------------------------------------------------- */
/* Probe 5: Smallcap rally -- small-cap stocks Feb->Mar 2028 ~+7%.  */
/* ---------------------------------------------------------------- */
console.log("Probe 5: Small-cap stocks Feb->Mar 2028 ≈ +7% at t8");
{
  const s8 = load(8);
  const sc = s8.nifty500.companies.filter(
    (c) =>
      c.tier_b_stats?._meta?.cap_tier === "small" &&
      c.monthly_prices?.["2028-02"] != null &&
      c.monthly_prices?.["2028-03"] != null,
  );
  const rets = sc.map((c) => c.monthly_prices["2028-03"] / c.monthly_prices["2028-02"] - 1);
  const med = median(rets);
  const within = rets.filter((r) => Math.abs(r - 0.07) < 0.02).length;
  const frac = within / rets.length;
  console.log(
    `  (n=${rets.length} median=${med.toFixed(4)} mean=${(rets.reduce((a, b) => a + b, 0) / rets.length).toFixed(4)} within±0.02 of 0.07=${(frac * 100).toFixed(1)}%)`,
  );
  assert(sc.length >= 50, "Small-cap count", `only ${sc.length} small-cap stocks`);
  assert(
    Math.abs(med - 0.07) < 0.02,
    "Small-cap median Feb->Mar ≈ 0.07",
    `median=${med.toFixed(4)}`,
  );
  assert(
    frac >= 0.75,
    "Small-cap ≥75% within ±0.02 of 0.07 (ADR-1 allows outliers)",
    `frac=${(frac * 100).toFixed(1)}%`,
  );
}

/* ---------------------------------------------------------------- */
/* Final report. */
/* ---------------------------------------------------------------- */
console.log("");
if (failures.length === 0) {
  console.log("OK: all snapshot-enrichment design-doc probes passed.");
  process.exit(0);
} else {
  console.error(`FAILED: ${failures.length} probe assertion(s) failed.`);
  for (const f of failures) console.error(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}
