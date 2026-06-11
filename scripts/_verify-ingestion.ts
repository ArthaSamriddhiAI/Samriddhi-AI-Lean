/* _verify-ingestion: offline verification of the B3 ingestion adapters and
 * the reconciliation gate against the full synthetic corpus (Package 07).
 *
 * Asserts, with pinned per-file expectations:
 *  - every eCAS statement parses and passes the FULL reconciliation gate
 *    against the snapshot universe and the generated structured truth (unit
 *    sums, printed ladders, closing-value ties, name resolution through the
 *    shared alias map, statement NAV equal to the snapshot series at the
 *    anchor month, per-folio truth ties);
 *  - every listing (xlsx, columnar text, email prose) parses its pinned row
 *    count, every exact row ties to a stated holdings row, and total ties
 *    hold exactly where the document covers the whole book (advisory-scope
 *    sheets that omit excluded stakes legitimately fail the total tie and
 *    are pinned as such);
 *  - the Pillai email yields zero confident rows plus the explicit
 *    route-to-fallback warning (the designed honest path for hard prose);
 *  - the LLM fallback executor throws without the WA12 opt-in (and is never
 *    wired in this build).
 *
 * Deterministic, offline, zero API; no network access of any kind.
 *   npx tsx scripts/_verify-ingestion.ts
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEcasPdf } from "../lib/ingestion/ecas-pdf";
import { parseXlsx, parseText } from "../lib/ingestion/table-adapters";
import {
  reconcileEcas,
  reconcileHoldings,
  type AliasMap,
  type EcasTruth,
} from "../lib/ingestion/reconcile";
import {
  buildIngestionFallbackRequest,
  runIngestionFallback,
} from "../lib/ingestion/llm-fallback";
import { _mintSanitised } from "../lib/privacy/sanitised";
import type { Snapshot } from "../lib/agents/snapshot-loader";

const ROOT = process.cwd();

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (!ok) {
    failures += 1;
    console.error("  FAIL " + label + (detail ? ": " + detail : ""));
  } else {
    console.log("  ok   " + label);
  }
}

const ECAS_FILES: Array<{ batch: string; file: string }> = [
  { batch: "a1_a5", file: "ecas_01_malhotras.pdf" },
  { batch: "a1_a5", file: "ecas_02_lalitha_iyengar.pdf" },
  { batch: "a1_a5", file: "ecas_05_rajiv_surana.pdf" },
  { batch: "a6_a14", file: "ecas_06_sandeep_krishnan.pdf" },
  { batch: "a6_a14", file: "ecas_08_dr_lakshmi_pillai.pdf" },
  { batch: "a6_a14", file: "ecas_11_anjali_bharat_desai.pdf" },
  { batch: "a6_a14", file: "ecas_12_karthik_reddy.pdf" },
  { batch: "a6_a14", file: "ecas_13_rahul_kapoor.pdf" },
];

/* Pinned listing expectations, measured against the committed corpus.
 * totalTie false is a pinned truth where the document legitimately covers
 * less than the full reference (advisory-scope sheets omitting excluded
 * stakes, partial emails), not a defect. */
const LISTINGS: Array<{
  batch: string;
  file: string;
  arch: string;
  minParsed: number;
  minTies: number;
  totalTie: boolean | null;
  maxUnresolved: number;
}> = [
  { batch: "a1_a5", file: "altformat_01_malhotras.xlsx", arch: "investor_archetype_03", minParsed: 8, minTies: 8, totalTie: true, maxUnresolved: 0 },
  { batch: "a1_a5", file: "altformat_02_lalitha_iyengar.txt", arch: "investor_archetype_01", minParsed: 6, minTies: 6, totalTie: true, maxUnresolved: 0 },
  { batch: "a1_a5", file: "altformat_03_shailesh_bhatt.xlsx", arch: "investor_archetype_08", minParsed: 12, minTies: 12, totalTie: true, maxUnresolved: 0 },
  { batch: "a1_a5", file: "altformat_04_arjun_menon.txt", arch: "investor_archetype_05", minParsed: 3, minTies: 3, totalTie: null, maxUnresolved: 1 },
  { batch: "a1_a5", file: "altformat_05_rajiv_surana.xlsx", arch: "investor_archetype_09", minParsed: 11, minTies: 11, totalTie: false, maxUnresolved: 0 },
  { batch: "a6_a14", file: "altformat_06_sandeep_krishnan.xlsx", arch: "investor_archetype_06", minParsed: 11, minTies: 11, totalTie: true, maxUnresolved: 0 },
  { batch: "a6_a14", file: "altformat_07_imtiaz_khan.txt", arch: "investor_archetype_07", minParsed: 13, minTies: 13, totalTie: true, maxUnresolved: 0 },
  { batch: "a6_a14", file: "altformat_09_pranav_mehta.xlsx", arch: "investor_archetype_09", minParsed: 17, minTies: 17, totalTie: true, maxUnresolved: 0 },
  { batch: "a6_a14", file: "altformat_10_vikas_iyer.txt", arch: "investor_archetype_10", minParsed: 11, minTies: 11, totalTie: false, maxUnresolved: 0 },
  { batch: "a6_a14", file: "altformat_11_anjali_bharat_desai.xlsx", arch: "investor_archetype_11", minParsed: 11, minTies: 11, totalTie: true, maxUnresolved: 0 },
  { batch: "a6_a14", file: "altformat_12_karthik_reddy.txt", arch: "investor_archetype_12", minParsed: 11, minTies: 11, totalTie: false, maxUnresolved: 0 },
  { batch: "a6_a14", file: "altformat_13_rahul_kapoor.xlsx", arch: "investor_archetype_13", minParsed: 13, minTies: 13, totalTie: true, maxUnresolved: 0 },
  { batch: "a6_a14", file: "altformat_14_pratap_singh_rathore.txt", arch: "investor_archetype_14", minParsed: 12, minTies: 12, totalTie: false, maxUnresolved: 0 },
];

async function main(): Promise<void> {
  const snap = JSON.parse(
    readFileSync(path.join(ROOT, "fixtures/snapshots/enriched/snapshot_t0_q2_2026.json"), "utf-8"),
  ) as Snapshot;
  check(
    "snapshot carries real_data_build stamp",
    Boolean((snap.snapshot_metadata as Record<string, unknown>)["real_data_build"]),
  );
  const universe = snap.mf_funds.map((f) => ({
    fundName: f.fund_name,
    monthlyNav: (f.monthly_nav ?? {}) as Record<string, number>,
  }));

  console.log("eCAS adapter and reconciliation gate:");
  for (const { batch, file } of ECAS_FILES) {
    const dir = path.join(ROOT, "fixtures", "ingestion-corpus", batch);
    const aliases = JSON.parse(
      readFileSync(path.join(dir, "ecas_run_manifest.json"), "utf-8"),
    ).aliases as AliasMap;
    const truth = JSON.parse(
      readFileSync(
        path.join(dir, file.replace("ecas_", "transactions_").replace(".pdf", ".json")),
        "utf-8",
      ),
    ) as EcasTruth;
    const parsed = await parseEcasPdf(path.join(dir, file));
    check(file + " parses without warnings", parsed.warnings.length === 0, parsed.warnings.join("; "));
    const report = reconcileEcas(parsed, universe, aliases, truth);
    const bad = report.checks.filter((c) => !c.ok);
    check(
      file + " full gate PASS (" + report.checks.length + " checks)",
      report.pass,
      bad.slice(0, 2).map((c) => c.label + " " + c.detail).join(" || "),
    );
    check(
      file + " statement identity strings captured for the PII layer",
      parsed.identityStrings.length >= 3,
      String(parsed.identityStrings.length),
    );
  }

  console.log("listing adapters and holdings gate:");
  for (const exp of LISTINGS) {
    const dir = path.join(ROOT, "fixtures", "ingestion-corpus", exp.batch);
    const holdingsFile = exp.batch === "a1_a5" ? "holdings_a1_a5.json" : "holdings_extended.json";
    const rows = JSON.parse(readFileSync(path.join(dir, holdingsFile), "utf-8")).rows as Array<{
      investor_id: string;
      instrument_display_name: string;
      current_market_value_inr: number;
    }>;
    const ref = rows
      .filter((r) => r.investor_id === exp.arch)
      .map((r) => ({ label: r.instrument_display_name, valueInr: r.current_market_value_inr }));
    const p = path.join(dir, exp.file);
    const parsed = exp.file.endsWith(".xlsx") ? parseXlsx(p) : parseText(p);
    const report = reconcileHoldings(parsed, ref, parsed.format === "email_text" ? 8 : 2);
    const ties = report.checks.filter((c) => c.ok && c.label.includes("ties to a stated holding")).length;
    const totalOk = report.checks.find((c) => c.label.includes("parsed total"))?.ok ?? false;
    check(exp.file + " parses >= " + exp.minParsed + " rows", parsed.holdings.length >= exp.minParsed, String(parsed.holdings.length));
    check(exp.file + " >= " + exp.minTies + " rows tie to stated holdings", ties >= exp.minTies, String(ties));
    if (exp.totalTie !== null) {
      check(exp.file + " total tie is " + exp.totalTie + " (pinned)", totalOk === exp.totalTie, String(totalOk));
    }
    check(exp.file + " unresolved <= " + exp.maxUnresolved, report.unresolved.length <= exp.maxUnresolved,
      report.unresolved.map((u) => u.label).join("; "));
  }

  console.log("hard-prose honest routing and the gated fallback:");
  const pillai = parseText(path.join(ROOT, "fixtures/ingestion-corpus/a6_a14/altformat_08_dr_lakshmi_pillai.txt"));
  check("pillai email yields zero confident rows", pillai.holdings.length === 0, String(pillai.holdings.length));
  check(
    "pillai email carries the route-to-fallback warning",
    pillai.warnings.some((w) => w.includes("fallback")),
    pillai.warnings.join("; "),
  );
  const req = buildIngestionFallbackRequest(_mintSanitised("REDACTED DOCUMENT TEXT"));
  check("fallback request builds from sanitised text only", req.prompt.includes("REDACTED DOCUMENT TEXT"));
  let threw = false;
  try {
    runIngestionFallback(req);
  } catch (e) {
    threw = e instanceof Error && e.message.includes("WA12");
  }
  check("fallback executor refuses to run (WA12 gate)", threw);

  if (failures > 0) {
    console.error("\n_verify-ingestion: " + failures + " failure(s)");
    process.exit(1);
  }
  console.log("\n_verify-ingestion: PASS");
}

main();
