/* render-section06-proof: standalone SVG proof plots for the section 06
 * gross/net series (Package 07).
 *
 * Reads the persisted content.time_series_performance.gross_net_series block
 * from the clearing case fixtures and renders one hand-rolled SVG per case
 * under docs/verification/section06_line/, plus a README coverage table for
 * all five Samriddhi 2 cases (including the deferred ones, with reasons).
 *
 * These plots are the review evidence that the line is drawable from the
 * persisted data. They are NOT the case-screen render: mounting the line into
 * section 06 of the composed page belongs to the case-screen single-writer
 * thread (WA09: capability ships data, design ships render).
 *
 * Hand-rolled static SVG per the ADR-0045 convention, in the v7.2 warm
 * register. Deterministic, offline, zero API.
 *
 *   npx tsx scripts/render-section06-proof.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Section06Series } from "../lib/agents/section06-series";

const ROOT = process.cwd();
const CASES = [
  "c-2026-05-15-surana-01",
  "c-2026-05-15-iyengar-01",
  "c-2026-05-15-malhotra-01",
  "c-2026-05-14-bhatt-01",
  "c-2026-05-15-menon-01",
];
const OUT_DIR = path.join(ROOT, "docs", "verification", "section06_line");

type CaseDoc = {
  id: string;
  investorId: string;
  content: {
    time_series_performance?: { gross_net_series?: Section06Series };
  };
};

function crore(x: number): string {
  return (x / 1e7).toFixed(2);
}

function renderSvg(caseId: string, investor: string, s: Section06Series): string {
  const W = 960;
  const H = 420;
  const M = { top: 64, right: 36, bottom: 56, left: 84 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const n = s.monthly.length;
  const maxY = Math.max(
    ...s.monthly.map((m) => Math.max(m.gross_value_inr, m.net_invested_inr)),
  ) * 1.06;
  const x = (i: number) => M.left + (i / Math.max(1, n - 1)) * plotW;
  const y = (v: number) => M.top + plotH - (v / maxY) * plotH;

  const grossPts = s.monthly.map((m, i) => `${x(i).toFixed(1)},${y(m.gross_value_inr).toFixed(1)}`).join(" ");
  const netPts = s.monthly.map((m, i) => `${x(i).toFixed(1)},${y(m.net_invested_inr).toFixed(1)}`).join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = maxY * f;
    return `<line x1="${M.left}" y1="${y(v).toFixed(1)}" x2="${W - M.right}" y2="${y(v).toFixed(1)}" stroke="#E8E4DC" stroke-width="1"/>` +
      `<text x="${M.left - 10}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" font-family="ui-monospace, Menlo, monospace" font-size="10.5" fill="#8A8A8A">${crore(v)}</text>`;
  }).join("\n  ");

  const janTicks = s.monthly
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.month.endsWith("-01") || m.month === s.window_start)
    .map(({ m, i }) =>
      `<text x="${x(i).toFixed(1)}" y="${H - M.bottom + 18}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="10" fill="#8A8A8A">${m.month.slice(0, 4)}</text>`,
    )
    .join("\n  ");

  const last = s.monthly[n - 1];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="-apple-system, sans-serif">
  <rect width="${W}" height="${H}" fill="#FAF8F4"/>
  <text x="${M.left}" y="26" font-size="16" font-weight="500" fill="#1A1A1A" font-family="Georgia, serif">Section 06 proof: ${investor}, gross value versus net invested cost</text>
  <text x="${M.left}" y="44" font-size="11" fill="#4A4A4A" font-family="ui-monospace, Menlo, monospace">${caseId}; covered ${s.coverage.covered_weight_pct}% (floor ${s.coverage.floor_pct}%); window ${s.window_start}..${s.anchor_month}; method ${s.method}</text>
  ${yTicks}
  ${janTicks}
  <polyline points="${netPts}" fill="none" stroke="#8A8A8A" stroke-width="1.6" stroke-dasharray="5 4"/>
  <polyline points="${grossPts}" fill="none" stroke="#3F5B47" stroke-width="2.2"/>
  <circle cx="${x(n - 1).toFixed(1)}" cy="${y(last.gross_value_inr).toFixed(1)}" r="3.5" fill="#3F5B47"/>
  <text x="${M.left}" y="${H - 14}" font-size="10.5" fill="#4A4A4A" font-family="ui-monospace, Menlo, monospace">gross (solid) Rs ${crore(last.gross_value_inr)} Cr at ${s.anchor_month}; net invested (dashed) Rs ${crore(last.net_invested_inr)} Cr; values in Rs Cr on the real-anchored basis</text>
</svg>
`;
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const rows: string[] = [];
  for (const caseId of CASES) {
    const doc = JSON.parse(
      readFileSync(path.join(ROOT, "db", "fixtures", "cases", caseId + ".json"), "utf-8"),
    ) as CaseDoc;
    const s = doc.content.time_series_performance?.gross_net_series;
    if (s) {
      const file = path.join(OUT_DIR, doc.investorId + ".svg");
      writeFileSync(file, renderSvg(caseId, doc.investorId, s));
      console.log("wrote " + path.relative(ROOT, file));
      rows.push(
        `| ${doc.investorId} | ${s.coverage.covered_weight_pct}% | clears | ${s.window_start}..${s.anchor_month} (${s.monthly.length} months) | [${doc.investorId}.svg](${doc.investorId}.svg) |`,
      );
    } else {
      rows.push(`| ${doc.investorId} | below the floor | bars only (deferred) | n/a | none (honest deferral) |`);
    }
  }

  const readme = `# Section 06 proof plots (Package 07)

Gross market value (solid) versus cumulative net invested cost (dashed) per
investor, rendered directly from the persisted
\`content.time_series_performance.gross_net_series\` blocks. These SVGs are
review evidence that the deferred section 06 line is now drawable from
reconciled, real-anchored data (P50/D14); the case-screen mount remains with
the case-screen single-writer thread (WA09).

| Case | Covered weight | Floor verdict (70%) | Window | Plot |
|---|---|---|---|---|
${rows.join("\n")}

Coverage counts only holdings whose value path is backed by real data: eCAS
transaction ladders on real \`monthly_nav\`, listed-stock \`monthly_prices\`,
the real \`sp_500_tri_inr\` index for the GIFT-route ETF, and contractual-rate
accrual for FDs and bonds (rates and maturities from the holdings rows). PMS,
AIF, physical gold (the gold index is synthetic), savings balances, and mixed
US equities are excluded with reasons recorded in each block. Bhatt (35.5%)
and Menon (6.8%) do not clear the floor on real data and stay bars-only, said
plainly per the honesty ruling.

Regenerate: \`npx tsx scripts/render-section06-proof.ts\` (after the
section 06 series backfill).
`;
  writeFileSync(path.join(OUT_DIR, "README.md"), readme);
  console.log("wrote " + path.relative(ROOT, path.join(OUT_DIR, "README.md")));
}

main();
