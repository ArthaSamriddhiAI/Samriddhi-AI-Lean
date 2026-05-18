/* Read-only A2 data review printout across all S2 fixtures.
 * Run via: npx tsx scripts/_print-a2-classifications.ts
 *
 * No LLM, no DB, no spend: reads the persisted content.a2_classification
 * straight from db/fixtures/cases/*.json and prints it for product-owner
 * review of tier consistency, reason-text register, and accuracy. This is
 * the Step 5 data-review surface (there is no rendered UI in this
 * workstream; the review is on the data).
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const FIXTURE_DIR = path.resolve(process.cwd(), "db", "fixtures", "cases");

type Driver = {
  driver_type: string;
  severity: string;
  scope: string;
  source_observation: string;
  reason: string;
};
type HoldingVerdict = {
  holding_ref: string;
  instrument_display_name: string;
  asset_class: string;
  sub_category: string;
  weight_pct: number;
  verdict: string;
  drivers: Driver[];
};
type A2 = {
  agent_id: string;
  case_id: string;
  as_of_date: string;
  holding_verdicts: HoldingVerdict[];
  summary: {
    maintain_count: number;
    monitor_count: number;
    discuss_count: number;
    review_count: number;
    unable_to_classify_count: number;
    one_line_characterization: string;
  };
  reasoning_summary: string;
};

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function main() {
  const files = (await fs.readdir(FIXTURE_DIR))
    .filter((f) => f.endsWith(".json"))
    .sort();

  const rollup: Array<{ id: string; inv: string; m: number; mo: number; d: number; r: number; u: number }> = [];

  for (const file of files) {
    const fixture = JSON.parse(
      await fs.readFile(path.join(FIXTURE_DIR, file), "utf-8"),
    ) as { investorId: string; workflow: string; content?: { a2_classification?: A2 } };
    const a2 = fixture.content?.a2_classification;
    if (fixture.workflow !== "s2") continue;
    if (!a2) {
      console.log(`\n### ${file} (${fixture.investorId}) :: NO a2_classification\n`);
      continue;
    }

    const s = a2.summary;
    rollup.push({
      id: a2.case_id,
      inv: fixture.investorId,
      m: s.maintain_count,
      mo: s.monitor_count,
      d: s.discuss_count,
      r: s.review_count,
      u: s.unable_to_classify_count,
    });

    console.log(`\n${"=".repeat(78)}`);
    console.log(`CASE ${a2.case_id}  (${fixture.investorId})  as of ${a2.as_of_date}`);
    console.log(`${"=".repeat(78)}`);
    console.log(
      `SUMMARY  ${s.maintain_count} Maintain | ${s.monitor_count} Monitor | ` +
        `${s.discuss_count} Discuss | ${s.review_count} Review` +
        (s.unable_to_classify_count ? ` | ${s.unable_to_classify_count} Unable` : "") +
        `  (${a2.holding_verdicts.length} holdings)`,
    );
    console.log(`ONE-LINE  ${s.one_line_characterization}`);
    console.log(`ROLLUP    ${a2.reasoning_summary}\n`);

    for (const h of a2.holding_verdicts) {
      console.log(
        `  ${pad(h.verdict.toUpperCase(), 9)} ${pad(h.instrument_display_name, 42)} ` +
          `${String(h.weight_pct).padStart(5)}%  [${h.sub_category}]`,
      );
      for (const d of h.drivers) {
        console.log(
          `      - ${d.driver_type} (${d.severity}, ${d.scope}) :: ${d.source_observation}`,
        );
        console.log(`        "${d.reason}"`);
      }
    }
  }

  console.log(`\n${"=".repeat(78)}`);
  console.log("CROSS-CASE ROLLUP");
  console.log(`${"=".repeat(78)}`);
  console.log(`  ${pad("case", 30)} ${pad("inv", 10)}  Mn Mo Di Rv Un  total`);
  for (const r of rollup) {
    const total = r.m + r.mo + r.d + r.r + r.u;
    console.log(
      `  ${pad(r.id, 30)} ${pad(r.inv, 10)}  ` +
        `${String(r.m).padStart(2)} ${String(r.mo).padStart(2)} ${String(r.d).padStart(2)} ` +
        `${String(r.r).padStart(2)} ${String(r.u).padStart(2)}  ${String(total).padStart(5)}`,
    );
  }
  const agg = rollup.reduce(
    (a, r) => ({ m: a.m + r.m, mo: a.mo + r.mo, d: a.d + r.d, r: a.r + r.r, u: a.u + r.u }),
    { m: 0, mo: 0, d: 0, r: 0, u: 0 },
  );
  console.log(
    `  ${pad("TOTAL", 41)}  ${String(agg.m).padStart(2)} ${String(agg.mo).padStart(2)} ` +
      `${String(agg.d).padStart(2)} ${String(agg.r).padStart(2)} ${String(agg.u).padStart(2)}  ` +
      `${String(agg.m + agg.mo + agg.d + agg.r + agg.u).padStart(5)}`,
  );
  console.log("");
}

main().catch((err) => {
  console.error("[print-a2] error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
