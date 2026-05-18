/* A2 backfill for the existing Samriddhi 2 fixtures.
 *
 * Additive: this computes A2 from each fixture's already-frozen holdings,
 * metrics, and evidence, then injects content.a2_classification. It does
 * NOT regenerate the case (the expensive S1 briefing stays byte-identical).
 * This mirrors how the accordion PR backfilled section_headlines into the
 * committed fixtures rather than re-running the pipeline.
 *
 * Layer 1 (deterministic) is computed from the frozen inputs; Layer 2
 * (reason text) is one live Claude call per case. Live spend: A2 Layer 2
 * is a single call per case (Opus 4.7 per the skill frontmatter).
 *
 * Usage:
 *   npx tsx scripts/backfill-a2.ts --case <id> --dry-run   # print only
 *   npx tsx scripts/backfill-a2.ts --dry-run                # all 6 S2, print only
 *   npx tsx scripts/backfill-a2.ts                          # all 6 S2, write fixtures
 *   npx tsx scripts/backfill-a2.ts --case <id>              # one case, write fixture
 *
 * Holdings are read from db/fixtures/structured-holdings.ts (the canonical
 * full holdings list, same source the pipeline seeds into the investor),
 * not from the fixture's section_7 appendix, which is an S1-curated subset.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { runA2Diagnostic } from "../lib/agents/a2-classification";
import type { EvidenceBundle } from "../lib/agents/stitcher";
import type { PortfolioMetrics } from "../lib/agents/portfolio-risk-analytics";
import { HOLDINGS_BY_INVESTOR } from "../db/fixtures/structured-holdings";

const FIXTURE_DIR = path.resolve(process.cwd(), "db", "fixtures", "cases");

/* Snapshot id to as-of date (foundation seed SNAPSHOTS). All six S2
 * fixtures run on t0_q2_2026; the rest are listed for robustness. An
 * unknown snapshot errors loudly rather than guessing a date. */
const SNAPSHOT_DATE: Record<string, string> = {
  t0_q2_2026: "2026-04-02",
  t1_q3_2026: "2026-07-01",
  t2_q4_2026: "2026-10-01",
  t3_q1_2027: "2027-01-01",
  t4_q2_2027: "2027-04-01",
  t5_q3_2027: "2027-07-01",
  t6_q4_2027: "2027-10-01",
  t7_q1_2028: "2028-01-01",
  t8_q2_2028: "2028-04-01",
};

type CaseFixture = {
  id: string;
  investorId: string;
  snapshotId: string;
  workflow: string;
  content: {
    metrics?: PortfolioMetrics;
    evidence?: Partial<EvidenceBundle>;
    a2_classification?: unknown;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function processFixture(
  file: string,
  opts: { write: boolean },
): Promise<void> {
  const filePath = path.join(FIXTURE_DIR, file);
  const fixture = JSON.parse(await fs.readFile(filePath, "utf-8")) as CaseFixture;

  if (fixture.workflow !== "s2") {
    console.log(`  skip ${fixture.id}: workflow=${fixture.workflow} (A2 is S2-only)`);
    return;
  }

  const holdings = HOLDINGS_BY_INVESTOR[fixture.investorId];
  if (!holdings) {
    throw new Error(
      `No structured holdings for investor "${fixture.investorId}" (${fixture.id}).`,
    );
  }
  const metrics = fixture.content.metrics ?? null;
  if (!metrics) {
    console.log(`  ${fixture.id}: content.metrics absent; A2 will mark holdings unable_to_classify`);
  }
  const asOfDate = SNAPSHOT_DATE[fixture.snapshotId];
  if (!asOfDate) {
    throw new Error(
      `Unknown snapshot "${fixture.snapshotId}" for ${fixture.id}; add it to SNAPSHOT_DATE.`,
    );
  }

  const ev = fixture.content.evidence ?? {};
  const evidence: EvidenceBundle = {
    e1: ev.e1 ?? null,
    e2: ev.e2 ?? null,
    e3: ev.e3 ?? null,
    e4: ev.e4 ?? null,
    e6: ev.e6 ?? null,
    e7: ev.e7 ?? null,
  };

  const { output, usage } = await runA2Diagnostic({
    caseId: fixture.id,
    asOfDate,
    holdings,
    metrics,
    evidence,
  });

  // Candidate printout.
  console.log(`\n=== ${fixture.id}  (${fixture.investorId})  as of ${asOfDate} ===`);
  console.log(
    `summary: ${output.summary.maintain_count} Maintain, ` +
      `${output.summary.monitor_count} Monitor, ` +
      `${output.summary.discuss_count} Discuss, ` +
      `${output.summary.review_count} Review` +
      (output.summary.unable_to_classify_count
        ? `, ${output.summary.unable_to_classify_count} Unable`
        : ""),
  );
  console.log(`one_line: ${output.summary.one_line_characterization}`);
  console.log(`tokens: ${usage.inputTokens} in / ${usage.outputTokens} out\n`);
  for (const h of output.holding_verdicts) {
    console.log(
      `  ${pad(h.verdict.toUpperCase(), 9)} ${pad(h.instrument_display_name, 44)} ` +
        `${h.weight_pct}%  [${h.sub_category}]`,
    );
    for (const d of h.drivers) {
      console.log(
        `      - ${d.driver_type} (${d.severity}, ${d.scope}) :: ${d.source_observation}`,
      );
      console.log(`        "${d.reason}"`);
    }
  }
  console.log(`\n  reasoning_summary: ${output.reasoning_summary}`);

  if (opts.write) {
    fixture.content.a2_classification = output;
    await fs.writeFile(
      filePath,
      JSON.stringify(fixture, null, 2) + "\n",
      "utf-8",
    );
    console.log(`\n  written: db/fixtures/cases/${file} (content.a2_classification)`);
  } else {
    console.log(`\n  dry-run: not written`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const caseIdx = args.indexOf("--case");
  const onlyCase = caseIdx >= 0 ? args[caseIdx + 1] : null;

  const entries = (await fs.readdir(FIXTURE_DIR)).filter((f) => f.endsWith(".json"));
  let targets = entries;
  if (onlyCase) {
    targets = entries.filter((f) => f === `${onlyCase}.json` || f === onlyCase);
    if (targets.length === 0) {
      throw new Error(`No fixture matching --case ${onlyCase} in ${FIXTURE_DIR}`);
    }
  }

  console.log(
    `A2 backfill: ${targets.length} fixture(s), mode=${dryRun ? "dry-run" : "WRITE"}`,
  );
  for (const file of targets.sort()) {
    await processFixture(file, { write: !dryRun });
  }
  console.log(`\nDone. ${targets.length} fixture(s) processed.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-a2] error:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
