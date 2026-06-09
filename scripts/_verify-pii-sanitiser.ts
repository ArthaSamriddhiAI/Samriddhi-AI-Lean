/* _verify-pii-sanitiser: offline verification of the B2 sanitisation layer
 * against the synthetic corpus (Package 07).
 *
 * The corpus identities (names, emails, mobiles, PANs, folios) are synthetic
 * fiction, which makes them a complete offline test bed: the assertions
 * prove that nothing identity-shaped survives sanitisation, without any real
 * PII existing anywhere. Checks:
 *  - every corpus email, text dump, and meeting note sanitises with zero
 *    pattern residue, and no known identity string survives;
 *  - every eCAS statement's extracted text sanitises clean (PANs, folio
 *    numbers, emails, mobiles, investor names all tokenised);
 *  - amounts and fund names SURVIVE (the reasoning substrate is kept);
 *  - determinism (same input, same output), entity stability (the same
 *    person maps to one token across documents), round-trip detokenisation,
 *    and idempotence;
 *  - minimiseInvestorContext drops identity keys and keeps structure;
 *  - no module in lib/privacy imports the Anthropic SDK (no model call in
 *    the sanitisation path).
 *
 * Deterministic, offline, zero API (WA12 not engaged).
 *   npx tsx scripts/_verify-pii-sanitiser.ts
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PiiVault, sanitiseForPrompt, minimiseInvestorContext, type KnownIdentity } from "../lib/privacy/sanitiser";
import { parseEcasPdf } from "../lib/ingestion/ecas-pdf";

const ROOT = process.cwd();
const CORPUS = path.join(ROOT, "fixtures", "ingestion-corpus");

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (!ok) {
    failures += 1;
    console.error("  FAIL " + label + (detail ? ": " + detail : ""));
  } else {
    console.log("  ok   " + label);
  }
}

/* Known identities per batch, sourced from the corpus truth files. */
function identitiesFor(batch: string): KnownIdentity[] {
  const dir = path.join(CORPUS, batch);
  const ids: KnownIdentity[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.startsWith("transactions_")) continue;
    const doc = JSON.parse(readFileSync(path.join(dir, f), "utf-8")) as { investor_name: string };
    const name = doc.investor_name;
    const words = name
      .replace(/^(Dr|Mrs|Mr|Smt)\.?\s+/i, "")
      .split(/\s+/)
      .filter((w) => w.length >= 4);
    ids.push({ kind: "person", values: [name, ...words] });
  }
  /* Names that appear in listings but have no eCAS truth file. */
  const extra: Record<string, string[]> = {
    a1_a5: ["Shailesh Bhatt", "Arjun Menon", "Aanchal", "Ramesh", "Lakshmi", "Nandini"],
    a6_a14: ["Imtiaz Khan", "Pranav Mehta", "Vikas Iyer", "Pratap Singh Rathore", "Divya"],
  };
  for (const n of extra[batch] ?? []) {
    ids.push({ kind: "person", values: [n, ...n.split(/\s+/).filter((w) => w.length >= 4)] });
  }
  return ids;
}

const PII_PATTERNS = [
  /\b[A-Z]{5}\d{4}[A-Z]\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  /\b[6-9]\d{9}\b/,
];

async function main(): Promise<void> {
  console.log("free-text corpus documents sanitise clean:");
  for (const batch of ["a1_a5", "a6_a14"]) {
    const dir = path.join(CORPUS, batch);
    const ids = identitiesFor(batch);
    for (const f of readdirSync(dir).sort()) {
      if (!/\.(txt|md)$/.test(f)) continue;
      const raw = readFileSync(path.join(dir, f), "utf-8");
      const vault = new PiiVault();
      const { sanitised, report } = sanitiseForPrompt(raw, vault, ids);
      const s = String(sanitised);
      const residualPattern = PII_PATTERNS.some((re) => re.test(s));
      const survivingName = ids.flatMap((i) => i.values).find(
        (v) => v.length >= 4 && new RegExp("\\b" + v + "\\b", "i").test(s),
      );
      check(
        batch + "/" + f + " sanitises clean",
        report.residual.length === 0 && !residualPattern && !survivingName,
        (report.residual.join(",") || "") + (survivingName ? " name survives: " + survivingName : ""),
      );
    }
  }

  console.log("eCAS extracted text sanitises clean, substance survives:");
  for (const batch of ["a1_a5", "a6_a14"]) {
    const dir = path.join(CORPUS, batch);
    const ids = identitiesFor(batch);
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith(".pdf")) continue;
      const parsed = await parseEcasPdf(path.join(dir, f));
      const docText = [
        ...parsed.identityStrings,
        ...parsed.folios.map(
          (fo) =>
            `Folio No: ${fo.folioNo} ${fo.fundLabel} closing ${fo.closingUnits} at NAV ${fo.closingNav} value INR ${fo.marketValueInr}`,
        ),
      ].join("\n");
      const vault = new PiiVault();
      const { sanitised, report } = sanitiseForPrompt(docText, vault, ids);
      const s = String(sanitised);
      check(
        batch + "/" + f + " identity strings tokenised, zero residue",
        report.residual.length === 0 && !PII_PATTERNS.some((re) => re.test(s)) && !/Folio No:?\s*\d/.test(s),
        report.residual.join(","),
      );
      const fundsSurvive = parsed.folios.every((fo) =>
        s.includes(fo.fundLabel.split(" (")[0].slice(0, 12)),
      );
      check(batch + "/" + f + " fund names and values survive", fundsSurvive && /INR \d/.test(s));
    }
  }

  console.log("determinism, entity stability, round-trip, idempotence:");
  const iyengarEmail = readFileSync(path.join(CORPUS, "a1_a5", "altformat_02_lalitha_iyengar.txt"), "utf-8");
  const ids = identitiesFor("a1_a5");
  const v1 = new PiiVault();
  const r1 = sanitiseForPrompt(iyengarEmail, v1, ids);
  const v2 = new PiiVault();
  const r2 = sanitiseForPrompt(iyengarEmail, v2, ids);
  check("same input produces identical sanitised output", String(r1.sanitised) === String(r2.sanitised));

  const noteText = readFileSync(path.join(CORPUS, "a1_a5", "meeting_notes_02_lalitha_iyengar.md"), "utf-8");
  const r3 = sanitiseForPrompt(noteText, v1, ids);
  const tokenInEmail = /\[PII-PERSON-\d+\]/.exec(String(r1.sanitised))?.[0];
  check(
    "the same person resolves to one token across documents (shared vault)",
    tokenInEmail !== undefined && String(r3.sanitised).includes(tokenInEmail),
    String(tokenInEmail),
  );

  const detok = v1.detokenise(String(r1.sanitised));
  check("detokenisation restores the original identities locally", detok.includes("Lalitha Iyengar") || detok.includes("lalitha.iyengar@gmail.com"));

  const again = sanitiseForPrompt(String(r1.sanitised), v1, ids);
  check("idempotence: sanitising sanitised text changes nothing", String(again.sanitised) === String(r1.sanitised));

  console.log("minimisation and the no-model-call property:");
  const minimised = minimiseInvestorContext("investor-ref-7", {
    name: "Rajiv Surana",
    email: "rajiv.surana@gmail.com",
    holdings: [{ instrument: "Mirae Asset Large Cap Fund", valueCr: 3.0 }],
    mandate: { equityBandPct: [55, 75] },
  });
  check(
    "minimised context drops identity and keeps structure",
    !("name" in minimised) && !("email" in minimised) &&
      Array.isArray((minimised as Record<string, unknown>)["holdings"]) &&
      minimised.investorRef === "investor-ref-7",
  );
  const privacySources = ["lib/privacy/sanitiser.ts", "lib/privacy/sanitised.ts"]
    .map((p) => readFileSync(path.join(ROOT, p), "utf-8"))
    .join("\n");
  check("no Anthropic SDK reference in the sanitisation path", !/@anthropic-ai|anthropic/i.test(privacySources.replace(/Anthropic SDK/g, "")));

  if (failures > 0) {
    console.error("\n_verify-pii-sanitiser: " + failures + " failure(s)");
    process.exit(1);
  }
  console.log("\n_verify-pii-sanitiser: PASS");
}

main();
