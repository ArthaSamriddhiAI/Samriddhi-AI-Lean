/* _verify-onboarding: offline verification of the B4 workbench core
 * (Package 07). Drives the pure assembly (parse -> merge -> gate -> record)
 * against committed corpus specimens, with no UI and no DB:
 *  - Krishnan (statement + listing + notes): folios attach to listing rows,
 *    all four gate tiles green, the canonical record builds, statement
 *    holdings carry full transaction histories, derived weights sum to ~100;
 *  - Iyengar email-only: heuristic rows block until confirmed (the gate is
 *    red with named blockers), then clear once confirmed, and the derived
 *    weights reproduce the known persona weights;
 *  - a valueless prose row is PARKED and excluded (the Gate 2 boundary:
 *    no value-entry behaviour exists in this build);
 *  - buildCanonicalRecord refuses a non-green gate.
 *
 * Deterministic, offline, zero API.
 *   npx tsx scripts/_verify-onboarding.ts
 */

import path from "node:path";
import { parseEcasPdf } from "../lib/ingestion/ecas-pdf";
import { parseText, parseXlsx } from "../lib/ingestion/table-adapters";
import type { ParsedDocument } from "../lib/ingestion/types";
import {
  buildCanonicalRecord,
  buildWorkbench,
  type AdvisorInputs,
} from "../lib/onboarding/build-record";
import { loadOnboardingContext } from "../lib/onboarding/load-context";

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

function inputs(partial?: Partial<AdvisorInputs>): AdvisorInputs {
  return {
    investorId: "verify-onboard",
    investorName: "Verification Specimen",
    notes: "",
    tier: "synthetic_public",
    resolutions: {},
    confirmations: [],
    subCategories: {},
    attestations: {},
    ...partial,
  };
}

async function main(): Promise<void> {
  const ctx = await loadOnboardingContext();
  check("context loads with real t0 and anchor 2026-03", ctx.anchorMonth === "2026-03", ctx.anchorMonth);

  console.log("Krishnan specimen (statement + listing + notes):");
  const kDocs: ParsedDocument[] = [
    await parseEcasPdf(path.join(ROOT, "fixtures/ingestion-corpus/a6_a14/ecas_06_sandeep_krishnan.pdf")),
    parseXlsx(path.join(ROOT, "fixtures/ingestion-corpus/a6_a14/altformat_06_sandeep_krishnan.xlsx")),
    parseText(path.join(ROOT, "fixtures/ingestion-corpus/a6_a14/meeting_notes_06_sandeep_krishnan.md")),
  ];
  const k = buildWorkbench(kDocs, ctx.universe, ctx.aliases, ctx.anchorMonth, inputs());
  console.log(
    "    tiles: " + k.tiles.map((t) => t.id + "=" + (t.ok ? "ok" : "FAIL") + " (" + t.value + ")").join("; "),
  );
  if (k.blockers.length) console.log("    blockers: " + k.blockers.join(" | "));
  check("all four tiles green", k.tiles.every((t) => t.ok));
  const both = k.rows.filter((r) => r.source === "both").length;
  check("statement folios attached to listing rows (7 both-source rows)", both === 7, String(both));
  check("gate clears with no advisor input needed (all rows exact + inferred)", k.clears, k.blockers.join(" | "));
  if (k.clears) {
    const statements = kDocs.filter((d) => d.format === "ecas_pdf");
    const { record, derived } = buildCanonicalRecord(k, inputs(), ctx.universe, statements);
    check("canonical record carries " + k.rows.length + " holdings", record.holdings.length === k.rows.length);
    const withTxns = record.holdings.filter((h) => h.transactions && h.transactions.length > 0).length;
    check("7 holdings carry full transaction histories", withTxns === 7, String(withTxns));
    const wsum = derived.holdings.reduce((s, h) => s + h.weightPct, 0);
    check("derived weights sum to ~100", Math.abs(wsum - 100) <= 1.0, String(wsum));
    check("total ties to the listing total 14.50 Cr", Math.abs(record.totalLiquidAumCr - 14.5) < 0.05, String(record.totalLiquidAumCr));
  }

  console.log("Iyengar email-only specimen (heuristic confirmation flow):");
  const iDocs = [parseText(path.join(ROOT, "fixtures/ingestion-corpus/a1_a5/altformat_02_lalitha_iyengar.txt"))];
  const i1 = buildWorkbench(iDocs, ctx.universe, ctx.aliases, ctx.anchorMonth, inputs());
  check("six heuristic rows parsed", i1.rows.length === 6, String(i1.rows.length));
  check("gate is red while heuristic rows are unconfirmed", !i1.clears);
  check(
    "blockers name the unconfirmed rows",
    i1.blockers.filter((b) => b.includes("unconfirmed heuristic")).length === 6,
    i1.blockers.join(" | "),
  );
  const allKeys = i1.rows.map((r) => r.key);
  const subFix = Object.fromEntries(
    i1.rows.filter((r) => r.subCategory === null).map((r) => [r.key, "bank_fd" as const]),
  );
  const i2 = buildWorkbench(iDocs, ctx.universe, ctx.aliases, ctx.anchorMonth,
    inputs({ confirmations: allKeys, subCategories: subFix }));
  console.log(
    "    tiles: " + i2.tiles.map((t) => t.id + "=" + (t.ok ? "ok" : "FAIL") + " (" + t.value + ")").join("; "),
  );
  if (!i2.clears) console.log("    blockers: " + i2.blockers.join(" | "));
  check("gate clears once all heuristic rows are confirmed", i2.clears, i2.blockers.join(" | "));
  if (i2.clears) {
    const { derived } = buildCanonicalRecord(i2, inputs({ confirmations: allKeys, subCategories: subFix }), ctx.universe, []);
    const weights = derived.holdings.map((h) => h.weightPct).sort((a, b) => b - a);
    check(
      "derived weights reproduce the persona shape (27.3 / 27.0 / 14.1 / 11.7 / 10.3 / 9.7)",
      JSON.stringify(weights) === JSON.stringify([27.3, 27.0, 14.1, 11.7, 10.3, 9.7]),
      JSON.stringify(weights),
    );
  }

  console.log("Advisor-attested value path (the Gate 2 ruling), Malhotra specimen:");
  const mDocs: ParsedDocument[] = [
    await parseEcasPdf(path.join(ROOT, "fixtures/ingestion-corpus/a1_a5/ecas_01_malhotras.pdf")),
    parseXlsx(path.join(ROOT, "fixtures/ingestion-corpus/a1_a5/altformat_01_malhotras.xlsx")),
    parseText(path.join(ROOT, "fixtures/ingestion-corpus/a1_a5/meeting_notes_01_malhotras.md")),
    parseText(path.join(ROOT, "fixtures/ingestion-corpus/a1_a5/meeting_notes_01_malhotras_addendum.md")),
  ];
  const m1 = buildWorkbench(mDocs, ctx.universe, ctx.aliases, ctx.anchorMonth, inputs());
  const goldRow = m1.rows.find((r) => r.needsAttestation);
  check("the addendum's unvalued gold mention yields an attestation-needed row",
    goldRow !== undefined && /gold jewellery/i.test(goldRow.rawLabel), goldRow?.rawLabel);
  check("exactly one attestation-needed row (no extractor over-fire on the main notes)",
    m1.rows.filter((r) => r.needsAttestation).length === 1);
  check("unattested row blocks the gate",
    !m1.clears && m1.blockers.some((b) => b.startsWith("attestation needed")),
    m1.blockers.join(" | "));

  const goldKey = goldRow ? goldRow.key : "missing";
  const badAttest = inputs({
    attestations: { [goldKey]: { valueInr: 1000000, basisNote: "   ", attestedBy: "Priya Nair", attestedAt: "2026-06-10T12:00:00.000Z" } },
  });
  const m2 = buildWorkbench(mDocs, ctx.universe, ctx.aliases, ctx.anchorMonth, badAttest);
  check("no basis note, no confirmation: an empty note does not attest", !m2.clears &&
    m2.blockers.some((b) => b.startsWith("attestation needed")));

  const goodInputs = inputs({
    attestations: { [goldKey]: { valueInr: 1000000, basisNote: "Vikram's verbal estimate at the April review; appraisal pending", attestedBy: "Priya Nair", attestedAt: "2026-06-10T12:00:00.000Z" } },
  });
  const m3 = buildWorkbench(mDocs, ctx.universe, ctx.aliases, ctx.anchorMonth, goodInputs);
  console.log(
    "    tiles: " + m3.tiles.map((t) => t.id + "=" + (t.ok ? "ok" : "FAIL") + " (" + t.value + ")" + (t.note ? " [" + t.note + "]" : "")).join("; "),
  );
  if (!m3.clears) console.log("    blockers: " + m3.blockers.join(" | "));
  check("a valid attestation clears the block", m3.clears, m3.blockers.join(" | "));
  const attRow = m3.rows.find((r) => r.key === goldKey);
  check("the attested row stays advisor_attested (never exact)",
    attRow?.provenanceKind === "advisor_attested" && attRow.confirmed && attRow.attestation !== null);
  const totalsTile = m3.tiles.find((t) => t.id === "totals");
  check("totals tile arithmetic excludes the attested value (sourced 11.85 = 11.85)",
    totalsTile?.value === "11.85 Cr = 11.85 Cr", totalsTile?.value);
  check("the exclusion is VISIBLE on the totals tile with N and Rs",
    totalsTile?.note === "sourced holdings only; 1 attested row totalling Rs 0.10 Cr excluded from the tie",
    String(totalsTile?.note));
  check("attested summary carries count and total", m3.attested.count === 1 && m3.attested.totalInr === 1000000);

  const { record: mRec, derived: mDer } = buildCanonicalRecord(m3, goodInputs, ctx.universe, [mDocs[0]]);
  check("the canonical record includes the attested holding at the attested value (book total 11.95 Cr)",
    Math.abs(mRec.totalLiquidAumCr - 11.95) < 0.005, String(mRec.totalLiquidAumCr));
  const attHolding = mRec.holdings.find((h) => h.attestation);
  check("the canonical holding carries the attestation (who, when, basis note)",
    attHolding !== undefined &&
      attHolding.attestation?.attestedBy === "Priya Nair" &&
      (attHolding.attestation?.basisNote ?? "").includes("appraisal pending"));
  check("the derived demo shape includes the attested holding",
    mDer.holdings.some((h) => /gold jewellery/i.test(h.instrument) && h.valueCr === 0.1));

  console.log("refusal behaviour:");
  let threw = false;
  try {
    buildCanonicalRecord(i1, inputs(), ctx.universe, []);
  } catch (e) {
    threw = e instanceof Error && e.message.includes("gate is not green");
  }
  check("buildCanonicalRecord refuses a non-green gate", threw);

  if (failures > 0) {
    console.error("\n_verify-onboarding: " + failures + " failure(s)");
    process.exit(1);
  }
  console.log("\n_verify-onboarding: PASS");
}

main();
