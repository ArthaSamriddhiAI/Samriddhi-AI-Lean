/* Spreadsheet and text adapters (Package 07, B3).
 *
 * Deterministic parsers for the non-statement formats investor data arrives
 * in: the four spreadsheet textures (clean, messy assistant-maintained,
 * CA-classic, minimal), columnar and free-form text dumps, and email prose.
 * Spreadsheet and columnar rows parse with exact confidence; prose extraction
 * is deliberately conservative, emits heuristic confidence, and leaves the
 * rest to warnings (the workbench surfaces heuristic rows for advisor
 * confirmation; nothing is silently accepted).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import type { ParsedDocument, ParsedHolding } from "./types";

/* "1,55,00,000", "1.55 Cr", "93 lakhs", "Rs 40 lakhs" -> INR number. */
export function parseAmountInr(raw: string): number | null {
  const s = raw.replace(/[₹]/g, "Rs").trim();
  const m =
    /(?:Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)\s*(Cr|crore|crores|lakh|lakhs|L)?\b/i.exec(s);
  if (!m) return null;
  const num = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(num) || num <= 0) return null;
  const unit = (m[2] ?? "").toLowerCase();
  if (unit.startsWith("cr")) return num * 1e7;
  if (unit.startsWith("l")) return num * 1e5;
  return num;
}

const NAME_HEADER = /instrument|fund|holding|particulars|description|asset name|scheme/i;
const VALUE_HEADER = /value|amount|rs|inr|corpus/i;
const TOTAL_ROW = /^(grand\s+)?total\b/i;

export function parseXlsx(file: string): ParsedDocument {
  const doc: ParsedDocument = {
    sourceFile: path.basename(file),
    format: "xlsx",
    identityStrings: [],
    holdings: [],
    folios: [],
    warnings: [],
  };
  const wb = XLSX.read(readFileSync(file), { type: "buffer" });
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Array<string | number | null>>(
      wb.Sheets[sheetName],
      { header: 1, defval: null },
    );
    /* Find the header row: a name-ish column plus a value-ish column. */
    let headerIdx = -1;
    let nameCol = -1;
    let valueCol = -1;
    for (let i = 0; i < Math.min(rows.length, 14); i++) {
      const cells = rows[i] ?? [];
      const nc = cells.findIndex((c) => typeof c === "string" && NAME_HEADER.test(c));
      const vcCandidates = cells
        .map((c, j) => ({ c, j }))
        .filter(({ c, j }) => j !== nc && typeof c === "string" && VALUE_HEADER.test(c as string));
      if (nc >= 0 && vcCandidates.length > 0) {
        headerIdx = i;
        nameCol = nc;
        valueCol = vcCandidates[vcCandidates.length - 1].j;
        break;
      }
    }
    /* Header-declared units ("Value (Cr)", "Amount in Lakhs") scale bare
     * numbers; absolute-rupee columns pass through. */
    let unitMultiplier = 1;
    if (headerIdx >= 0) {
      const vh = String((rows[headerIdx] ?? [])[valueCol] ?? "");
      if (/\bcr(ore)?s?\b|\(cr\)/i.test(vh)) unitMultiplier = 1e7;
      else if (/lakh|lacs|\(l\)/i.test(vh)) unitMultiplier = 1e5;
    }
    if (headerIdx < 0) {
      doc.warnings.push("sheet '" + sheetName + "': no recognisable header row");
      continue;
    }
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const cells = rows[i] ?? [];
      const label = cells[nameCol];
      if (typeof label !== "string" || !label.trim()) continue;
      if (TOTAL_ROW.test(label.trim())) continue;
      const valueCell = cells[valueCol];
      let valueInr: number | null = null;
      if (typeof valueCell === "number") valueInr = valueCell * unitMultiplier;
      else if (typeof valueCell === "string") {
        const v = parseAmountInr(valueCell);
        /* A string cell may carry its own unit ("1.2 Cr"); only bare numbers
         * take the header multiplier. */
        valueInr = v === null ? null : /cr|lakh|l\b/i.test(valueCell) ? v : v * unitMultiplier;
      }
      if (valueInr === null) continue;
      const detailCells = cells
        .filter((c, j) => j !== nameCol && j !== valueCol && typeof c === "string" && (c as string).trim())
        .map((c) => String(c));
      doc.holdings.push({
        rawLabel: label.trim(),
        valueInr,
        detail: detailCells.length ? detailCells.join("; ") : null,
        confidence: "exact",
        provenance: {
          file: doc.sourceFile,
          locator: sheetName + "!" + XLSX.utils.encode_cell({ r: i, c: nameCol }),
        },
      });
    }
  }
  if (doc.holdings.length === 0) doc.warnings.push("no holdings rows parsed");
  return doc;
}

const EMAIL_HEADER = /^(From|To|CC|Subject|Date):\s*(.+)$/i;
const MOBILE = /\b(9\d{9})\b/;

export function parseText(file: string): ParsedDocument {
  const raw = readFileSync(file, "utf-8");
  const lines = raw.split(/\r?\n/);
  const isEmail = lines.slice(0, 6).some((l) => EMAIL_HEADER.test(l));
  const doc: ParsedDocument = {
    sourceFile: path.basename(file),
    format: isEmail ? "email_text" : "text_tabular",
    identityStrings: [],
    holdings: [],
    folios: [],
    warnings: [],
  };

  for (const l of lines) {
    const eh = EMAIL_HEADER.exec(l);
    if (eh && /from|to|cc/i.test(eh[1])) {
      for (const addr of eh[2].split(/[,;]/)) {
        const a = addr.trim();
        if (a.includes("@")) doc.identityStrings.push(a);
      }
    }
    const mob = MOBILE.exec(l);
    if (mob) doc.identityStrings.push(mob[1]);
  }

  if (!isEmail) {
    /* Columnar dumps: split on tabs or runs of 2+ spaces; the label is the
     * first column, the value the rightmost amount-parseable column. */
    let lastLabelLine: { text: string; idx: number } | null = null;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.trim() || /^[-=_]{3,}/.test(l.trim())) continue;
      const trimmed = l.trim();

      /* Two-line texture (banking-app paste): a bare label line followed by
       * an attribute line carrying "Current Value: Rs N". */
      const cv = /Current Value:\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d+)?)\s*(Cr|crore|crores|lakh|lakhs|L)?\b/i.exec(trimmed);
      if (cv && lastLabelLine) {
        const valueInr = parseAmountInr("Rs " + cv[1] + " " + (cv[2] ?? ""));
        if (valueInr !== null && valueInr >= 1e4) {
          doc.holdings.push({
            rawLabel: lastLabelLine.text,
            valueInr,
            detail: trimmed,
            confidence: "exact",
            provenance: { file: doc.sourceFile, locator: "line " + (i + 1) },
          });
          lastLabelLine = null;
          continue;
        }
      }

      const cols = l.split(/\t+| {2,}/).map((c) => c.trim()).filter(Boolean);
      if (cols.length < 2) {
        /* Remember a plausible label line for the two-line texture: prose
         * with letters, no amount of its own, not a section banner. */
        if (
          /[A-Za-z]{3}/.test(trimmed) &&
          !/^-+|^=+|^[A-Z ]+-+/.test(trimmed) &&
          !/(?:Rs\.?|INR|₹)\s*[\d,]/i.test(trimmed) &&
          !/^(Generated|Updated|Investments Summary|Source)/i.test(trimmed)
        ) {
          lastLabelLine = { text: trimmed.replace(/^[-•*\s]+/, ""), idx: i };
        }
        continue;
      }
      if (TOTAL_ROW.test(cols[0])) continue;
      let valueInr: number | null = null;
      for (let j = cols.length - 1; j >= 1; j--) {
        const v = parseAmountInr(cols[j]);
        /* Demand a plausible magnitude so percentages and dates don't read
         * as values. */
        if (v !== null && v >= 1e4) {
          valueInr = v;
          break;
        }
      }
      if (valueInr === null) continue;
      if (!/[A-Za-z]{3}/.test(cols[0])) continue;
      doc.holdings.push({
        rawLabel: cols[0],
        valueInr,
        detail: cols.slice(1).join(" | "),
        confidence: "exact",
        provenance: { file: doc.sourceFile, locator: "line " + (i + 1) },
      });
    }
  } else {
    /* Email prose: conservative single-line pattern, heuristic confidence.
     * "Label..., approximately Rs 93 lakhs..." style lines only. */
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      const m =
        /^(.{4,70}?)(?:,| -| at| of)?\s*(?:approx(?:imately)?\.?|around|roughly)?\s*(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d+)?)\s*(Cr|crore|crores|lakh|lakhs|L)\b/i.exec(l);
      if (!m) continue;
      const valueInr = parseAmountInr("Rs " + m[2] + " " + (m[3] ?? ""));
      if (valueInr === null) continue;
      const label = m[1].replace(/^[\s\-•*]+/, "").trim();
      if (!/[A-Za-z]{3}/.test(label)) continue;
      /* Conservative prose rules: never a total line, and the label must
       * read like an instrument, not narrative. */
      if (/\b(total|overall|in all|roughly Rs|by my reckoning)\b/i.test(label)) continue;
      if (
        !/(fund|fd|fixed deposit|deposit|savings|account|equit|stock|share|etf|pms|aif|bond|gold|scheme|debenture|folio)/i.test(
          label + " " + l,
        )
      ) {
        continue;
      }
      doc.holdings.push({
        rawLabel: label,
        valueInr,
        detail: l,
        confidence: "heuristic",
        provenance: { file: doc.sourceFile, locator: "line " + (i + 1) },
      });
    }
    if (doc.holdings.length === 0) {
      doc.warnings.push(
        "email prose yielded no confident holdings; route to the gated LLM-assist fallback after sanitisation",
      );
    }
  }
  return doc;
}
