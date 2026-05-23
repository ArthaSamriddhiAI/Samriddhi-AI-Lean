/* Deterministic verification for time-series-performance (T-5.06). No API.
 *
 * 5 archetypes (Malhotra, Iyengar, Bhatt, Menon, Surana) x 9 snapshots = 45 cases.
 * Calls runTimeSeriesPerformanceDeterministic directly (not through the pipeline,
 * no S1). For each case: validates the output against the JSON schema and runs
 * deterministic sanity checks. Writes docs/verification/T-5.06-verification.md.
 *
 * Requires the snapshot suite at fixtures/snapshots/enriched/ (symlinked to the
 * private data repo locally; gitignored, ADR-0027). Exits non-zero on any failure.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import schema from "@/schemas/time_series_performance_output.schema.json";
import { loadSnapshot, type Snapshot } from "@/lib/agents/snapshot-loader";
import { runTimeSeriesPerformanceDeterministic, type TimeSeriesPerformanceOutput, STANDARD_WINDOWS } from "@/lib/agents/time-series-performance";
import {
  MALHOTRA_HOLDINGS, IYENGAR_HOLDINGS, BHATT_HOLDINGS, MENON_HOLDINGS, SURANA_HOLDINGS,
} from "@/db/fixtures/structured-holdings";
import type { StructuredHoldings } from "@/db/fixtures/structured-holdings";

const SNAPSHOT_IDS = [
  "t0_q2_2026", "t1_q3_2026", "t2_q4_2026", "t3_q1_2027", "t4_q2_2027",
  "t5_q3_2027", "t6_q4_2027", "t7_q1_2028", "t8_q2_2028",
];
const ARCHETYPES: Array<{ name: string; holdings: StructuredHoldings }> = [
  { name: "Malhotra", holdings: MALHOTRA_HOLDINGS },
  { name: "Iyengar", holdings: IYENGAR_HOLDINGS },
  { name: "Bhatt", holdings: BHATT_HOLDINGS },
  { name: "Menon", holdings: MENON_HOLDINGS },
  { name: "Surana", holdings: SURANA_HOLDINGS },
];

/* ---- minimal draft-07 validator ---- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any;
function resolveRef(root: S, ref: string): S {
  let cur = root;
  for (const p of ref.replace(/^#\//, "").split("/")) cur = cur[p];
  return cur;
}
function validate(node: S, sch: S, root: S, p: string, errs: string[]): void {
  if (sch.$ref) return validate(node, resolveRef(root, sch.$ref), root, p, errs);
  if (sch.const !== undefined) { if (node !== sch.const) errs.push(`${p}: const mismatch`); return; }
  if (sch.enum) { if (!sch.enum.some((e: S) => e === node)) errs.push(`${p}: ${JSON.stringify(node)} not in enum`); return; }
  if (sch.type) {
    const types: string[] = Array.isArray(sch.type) ? sch.type : [sch.type];
    const t = node === null ? "null" : Array.isArray(node) ? "array" : typeof node;
    if (!types.some((ty) => ty === t || (ty === "integer" && t === "number"))) { errs.push(`${p}: expected ${types.join("|")}, got ${t}`); return; }
  }
  if (node === null) return;
  if (Array.isArray(node) && sch.items) node.forEach((it: S, i: number) => validate(it, sch.items, root, `${p}[${i}]`, errs));
  if (typeof node === "object" && !Array.isArray(node)) {
    if (sch.required) for (const r of sch.required) if (!(r in node)) errs.push(`${p}: missing '${r}'`);
    if (sch.properties) for (const k of Object.keys(node)) {
      if (sch.properties[k]) validate(node[k], sch.properties[k], root, `${p}.${k}`, errs);
      else if (sch.additionalProperties === false) errs.push(`${p}: extra '${k}'`);
    }
  }
}

/* ---- deterministic sanity checks ---- */
function sanity(out: TimeSeriesPerformanceOutput, snapshotIndex: number, holdings: StructuredHoldings): string[] {
  const f: string[] = [];
  const allWR = [
    ...out.per_holding.flatMap((h) => h.trailing_returns ?? []),
    ...out.per_sleeve.flatMap((s) => s.trailing_returns ?? []),
    ...(out.portfolio.trailing_returns ?? []),
  ];
  for (const wr of allWR) {
    if (wr.absolute_return !== null) {
      if (wr.absolute_return <= -1) f.push(`impossible return <=-100% (${wr.window} ${wr.absolute_return})`);
      if (wr.absolute_return > 50) f.push(`implausible return >5000% (${wr.window} ${wr.absolute_return})`);
    }
  }
  if (out.portfolio.trailing_returns) {
    const tot = out.portfolio.evaluable_weight_pct + out.portfolio.sentinelled_weight_pct;
    if (Math.abs(tot - 100) > 1.5) f.push(`portfolio weights sum ${tot.toFixed(2)} != ~100`);
  }
  for (const w of STANDARD_WINDOWS) {
    const pv = out.portfolio.trailing_returns?.find((r) => r.window === w)?.absolute_return;
    if (pv == null) continue;
    const sv = out.per_sleeve.map((s) => s.trailing_returns?.find((r) => r.window === w)?.absolute_return).filter((v): v is number => v != null);
    if (sv.length) {
      const lo = Math.min(...sv) - 1e-6;
      const hi = Math.max(...sv) + 1e-6;
      if (pv < lo || pv > hi) f.push(`portfolio ${w} ${pv} outside sleeve range [${Math.min(...sv)}, ${Math.max(...sv)}]`);
    }
  }
  if (snapshotIndex === 0) {
    if (out.cross_snapshot_evolution.available !== false) f.push("t0 evolution should be unavailable");
    if (out.cross_snapshot_evolution.sentinel !== "no_prior_snapshot_available") f.push("t0 should emit no_prior_snapshot_available");
  } else if (out.cross_snapshot_evolution.available !== true) {
    f.push("t1+ evolution should be available");
  }
  const hasPms = holdings.holdings.some((h) => h.subCategory.startsWith("pms_"));
  if (hasPms && !out.per_holding.some((h) => h.sentinel === "pms_disclosure_limited")) f.push("PMS present but no pms_disclosure_limited sentinel");
  const hasAif = holdings.holdings.some((h) => h.subCategory.startsWith("aif_"));
  if (hasAif && !out.per_holding.some((h) => h.sentinel === "opaque_wrapper")) f.push("AIF present but no opaque_wrapper sentinel");
  return f;
}

function pct(x: number | null | undefined): string {
  return x == null ? "n/a" : `${(x * 100).toFixed(1)}%`;
}
function win(out: TimeSeriesPerformanceOutput, w: string): number | null {
  return out.portfolio.trailing_returns?.find((r) => r.window === w)?.absolute_return ?? null;
}

(async () => {
  const rows: string[] = [];
  const sections: string[] = [];
  let pass = 0;
  let fail = 0;
  let sampleJson = "";

  for (let i = 0; i < SNAPSHOT_IDS.length; i++) {
    const current = await loadSnapshot(SNAPSHOT_IDS[i]);
    const reference: Snapshot | null = i > 0 ? await loadSnapshot(SNAPSHOT_IDS[i - 1]) : null;
    const asOfDate = (current.snapshot_metadata?.snapshot_date as string | undefined) ?? `${SNAPSHOT_IDS[i].slice(1, 2)}`;
    for (const a of ARCHETYPES) {
      const out = await runTimeSeriesPerformanceDeterministic(current, reference, a.holdings, {
        caseId: `${a.name}-${SNAPSHOT_IDS[i]}`, asOfDate, investor: {},
      });
      const errs: string[] = [];
      validate(out, schema, schema, "$", errs);
      const sfails = sanity(out, i, a.holdings);
      const allFails = [...errs.map((e) => `schema: ${e}`), ...sfails.map((e) => `sanity: ${e}`)];
      const ok = allFails.length === 0;
      if (ok) pass++; else fail++;
      const sentinelCounts: Record<string, number> = {};
      for (const h of out.per_holding) if (h.sentinel) sentinelCounts[h.sentinel] = (sentinelCounts[h.sentinel] ?? 0) + 1;
      rows.push(`| ${a.name} | ${SNAPSHOT_IDS[i]} | ${ok ? "PASS" : "**FAIL**"} | ${pct(win(out, "1Y"))} | ${pct(win(out, "3Y"))} | ${out.cross_snapshot_evolution.available} | ${out.per_holding.filter((h) => h.sentinel).length} |`);
      sections.push(
        `### ${a.name} @ ${SNAPSHOT_IDS[i]} ${ok ? "(PASS)" : "(**FAIL**)"}\n\n` +
        `- Portfolio: 1M ${pct(win(out, "1M"))}, 3M ${pct(win(out, "3M"))}, 6M ${pct(win(out, "6M"))}, 1Y ${pct(win(out, "1Y"))}, 3Y ${pct(win(out, "3Y"))}, SI ${pct(win(out, "SI"))}; evaluable ${out.portfolio.evaluable_weight_pct}% / sentinelled ${out.portfolio.sentinelled_weight_pct}%.\n` +
        `- Sleeves: ${out.per_sleeve.map((s) => `${s.sleeve} (${s.method}${s.sentinel ? ", " + s.sentinel : ""})`).join("; ")}.\n` +
        `- Evolution: available=${out.cross_snapshot_evolution.available}${out.cross_snapshot_evolution.sentinel ? ", " + out.cross_snapshot_evolution.sentinel : ""}; per-sleeve ${out.cross_snapshot_evolution.per_sleeve.map((s) => `${s.sleeve} ${pct(s.return_between_snapshots)}`).join(", ") || "none"}.\n` +
        `- Sentinels: ${Object.entries(sentinelCounts).map(([k, v]) => `${k}×${v}`).join(", ") || "none"}.\n` +
        `- Rollup: "${out.rollup.text}"\n` +
        (ok ? "" : `- **FAILURES:**\n${allFails.map((x) => `  - ${x}`).join("\n")}\n`),
      );
      if (a.name === "Bhatt" && SNAPSHOT_IDS[i] === "t5_q3_2027") sampleJson = JSON.stringify(out, null, 2);
    }
  }

  const doc = [
    `# T-5.06 Time-Series Performance Verification`,
    ``,
    `Deterministic verification of \`runTimeSeriesPerformanceDeterministic\`, run directly (no pipeline, no S1, zero API).`,
    `**5 archetypes × 9 snapshots = 45 cases.** Each output is validated against \`schemas/time_series_performance_output.schema.json\` and run through deterministic sanity checks (return bounds, weight sums, portfolio-within-sleeve-range, evolution availability by snapshot, sentinel expectations).`,
    `Regenerate with \`npx tsx scripts/_verify-time-series-performance.ts\` (requires the snapshot suite at \`fixtures/snapshots/enriched/\`).`,
    ``,
    `## Summary: ${pass}/${pass + fail} PASS`,
    ``,
    `| Archetype | Snapshot | Result | Portfolio 1Y | Portfolio 3Y | Evolution | #Sentinels |`,
    `|---|---|---|---|---|---|---|`,
    ...rows,
    ``,
    `## Per-case detail`,
    ``,
    ...sections,
    `## Full output sample (Bhatt @ t5_q3_2027)`,
    ``,
    `Per-case full JSON is summarised above for reviewability; one representative full output is included here for shape reference. Re-run the script for any other case's full output.`,
    ``,
    "```json",
    sampleJson,
    "```",
    ``,
  ].join("\n");

  await fs.mkdir(path.resolve(process.cwd(), "docs", "verification"), { recursive: true });
  await fs.writeFile(path.resolve(process.cwd(), "docs", "verification", "T-5.06-verification.md"), doc, "utf-8");
  console.log(`T-5.06 verification: ${pass}/${pass + fail} PASS, ${fail} FAIL`);
  if (fail > 0) {
    console.log("FAILURES PRESENT — self-halt:");
    process.exitCode = 1;
  }
})();
