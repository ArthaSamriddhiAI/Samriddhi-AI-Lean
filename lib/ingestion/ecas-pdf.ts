/* eCAS PDF adapter (Package 07, B3).
 *
 * Parses CAMS/KFintech-style Consolidated Account Statements (the synthetic
 * corpus's format, which mimics the real registrars' layout) into the
 * canonical envelope: per folio, the fund label, folio number, ISIN, the full
 * transaction table, and the closing balance line with its NAV and market
 * value. Deterministic text-layer extraction via pdfjs-dist (pure JS, no
 * network); lines are reconstructed from positioned glyph runs by page and
 * y-coordinate.
 *
 * The parser is strict where the gate needs it (numbers, dates, closing line)
 * and tolerant on prose. Anything unparseable lands in warnings rather than
 * being guessed.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  ParsedDocument,
  ParsedFolio,
  ParsedTransaction,
} from "./types";

type TextItem = { str: string; x: number; y: number };

async function extractLines(file: string): Promise<Array<{ page: number; line: number; text: string }>> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(readFileSync(file));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const out: Array<{ page: number; line: number; text: string }> = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const it of content.items as Array<{ str: string; transform: number[] }>) {
      if (!it.str || !it.str.trim()) continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5] });
    }
    /* Group into lines by y (PDF y grows upward; bucket within 1.5pt). */
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: TextItem[][] = [];
    for (const it of items) {
      const cur = lines[lines.length - 1];
      if (cur && Math.abs(cur[0].y - it.y) < 1.5) cur.push(it);
      else lines.push([it]);
    }
    lines.forEach((ln, i) => {
      ln.sort((a, b) => a.x - b.x);
      out.push({ page: p, line: i + 1, text: ln.map((t) => t.str).join(" ").replace(/\s+/g, " ").trim() });
    });
  }
  await doc.destroy();
  return out;
}

function parseInr(s: string): number | null {
  const m = s.replace(/,/g, "");
  const v = Number(m);
  return Number.isFinite(v) ? v : null;
}

function parseDate(s: string): string | null {
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(s);
  if (!m) return null;
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const mm = months[m[2]];
  return mm ? `${m[3]}-${mm}-${m[1]}` : null;
}

const TXN_ROW =
  /^(\d{2}-[A-Za-z]{3}-\d{4}) (.+?) ([\d,]+\.\d{2}) ([\d]+\.\d{3}) ([\d]+\.\d{2,4}) ([\d]+\.\d{3})$/;
const FEE_ROW = /^(\d{2}-[A-Za-z]{3}-\d{4}) (.+?) ([\d,]+\.\d{2})$/;
const NOTE_ROW = /^(\d{2}-[A-Za-z]{3}-\d{4}) (\*\*\*.*)$/;
/* The closing row's three fragments share one y with whatever else lands on
 * that baseline (page footers on overflowing tables), so they are extracted
 * independently from the line rather than anchored to it. */
const CLOSING_UNITS = /Closing Unit Balance: ([\d,]+\.\d{3})/;
const CLOSING_NAV = /NAV on (\d{2}-[A-Za-z]{3}-\d{4}): INR ([\d,]+\.\d{2,4})/;
const CLOSING_MV = /Market Value on \d{2}-[A-Za-z]{3}-\d{4}: INR ([\d,]+\.\d{2})/;

export async function parseEcasPdf(file: string): Promise<ParsedDocument> {
  const lines = await extractLines(file);
  const doc: ParsedDocument = {
    sourceFile: path.basename(file),
    format: "ecas_pdf",
    identityStrings: [],
    holdings: [],
    folios: [],
    warnings: [],
  };

  let current: ParsedFolio | null = null;
  let pendingFundLine: { text: string; page: number; line: number } | null = null;

  const finalize = () => {
    if (current) doc.folios.push(current);
    current = null;
  };

  for (const ln of lines) {
    const loc = `page ${ln.page} line ${ln.line}`;
    const t = ln.text;

    const idm = /^Email Id: (.+)$/.exec(t) ?? /^PAN: (\S+)/.exec(t);
    if (idm) doc.identityStrings.push(idm[1]);
    const mob = /^Mobile: (\S+)$/.exec(t);
    if (mob) doc.identityStrings.push(mob[1]);

    const folio = /^Folio No: (\d+) /.exec(t) ?? /^Folio No: (\d+)$/.exec(t);
    if (folio) {
      finalize();
      const pan = /PAN: (\S+)/.exec(t);
      if (pan) doc.identityStrings.push(pan[1]);
      current = {
        fundLabel: "",
        folioNo: folio[1],
        isin: null,
        transactions: [],
        closingUnits: null,
        closingNav: null,
        closingNavDate: null,
        marketValueInr: null,
        provenance: { file: doc.sourceFile, locator: loc },
      };
      pendingFundLine = null;
      continue;
    }
    if (!current) continue;

    /* Fund line: "<name> (Non-Demat) - ISIN: ...(Advisor: ...)", possibly
     * wrapped onto a second line by the renderer. */
    if (t.includes("(Non-Demat)")) {
      if (/ISIN: \S+/.test(t)) {
        const m = /^(.+?) \(Non-Demat\) - ISIN: (\S+?)\(Advisor/.exec(t);
        if (m) {
          current.fundLabel = m[1].trim();
          current.isin = m[2];
        }
      } else {
        pendingFundLine = { text: t, page: ln.page, line: ln.line };
      }
      continue;
    }
    if (pendingFundLine) {
      const joined = pendingFundLine.text + t;
      const m = /^(.+?) \(Non-Demat\) - ISIN: (\S+?)\(Advisor/.exec(joined);
      if (m) {
        current.fundLabel = m[1].trim();
        current.isin = m[2];
      } else {
        doc.warnings.push("unparsed wrapped fund line at " + loc);
      }
      pendingFundLine = null;
      continue;
    }

    const cu = CLOSING_UNITS.exec(t);
    if (cu) {
      current.closingUnits = parseInr(cu[1]);
      const cn = CLOSING_NAV.exec(t);
      if (cn) {
        current.closingNavDate = parseDate(cn[1]);
        current.closingNav = parseInr(cn[2]);
      }
      const mv = CLOSING_MV.exec(t);
      if (mv) current.marketValueInr = parseInr(mv[1]);
      finalize();
      continue;
    }

    const txn = TXN_ROW.exec(t);
    if (txn) {
      const row: ParsedTransaction = {
        date: parseDate(txn[1]) ?? txn[1],
        type: txn[2],
        amountInr: parseInr(txn[3]),
        units: parseInr(txn[4]),
        nav: parseInr(txn[5]),
        unitBalance: parseInr(txn[6]),
        provenance: { file: doc.sourceFile, locator: loc },
      };
      current.transactions.push(row);
      continue;
    }
    const fee = FEE_ROW.exec(t);
    if (fee && fee[2].includes("Stamp Duty")) {
      current.transactions.push({
        date: parseDate(fee[1]) ?? fee[1],
        type: fee[2],
        amountInr: parseInr(fee[3]),
        units: null,
        nav: null,
        unitBalance: null,
        provenance: { file: doc.sourceFile, locator: loc },
      });
      continue;
    }
    const note = NOTE_ROW.exec(t);
    if (note) {
      current.transactions.push({
        date: parseDate(note[1]) ?? note[1],
        type: note[2],
        amountInr: null,
        units: null,
        nav: null,
        unitBalance: null,
        provenance: { file: doc.sourceFile, locator: loc },
      });
    }
  }
  finalize();

  if (doc.folios.length === 0) {
    doc.warnings.push("no folios parsed; not an eCAS layout this adapter recognises");
  }
  for (const f of doc.folios) {
    if (!f.fundLabel) doc.warnings.push("folio " + f.folioNo + " has no fund label");
    if (f.closingUnits === null) doc.warnings.push("folio " + f.folioNo + " has no closing line");
  }
  return doc;
}
