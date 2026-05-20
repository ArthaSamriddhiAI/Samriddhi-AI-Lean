/* Risk-Reward backfill for the existing Samriddhi 2 fixtures.
 *
 * Additive: computes risk-reward from each fixture's investor holdings and
 * the case's snapshot, then injects content.risk_reward_stats. It does NOT
 * regenerate the case; the frozen briefing / evidence / metrics stay
 * byte-identical. Mirrors scripts/backfill-a2.ts (the proven additive write:
 * JSON.stringify(fixture, null, 2) + newline) so the diff is N-added / 1-removed
 * per fixture and no frozen prose is touched (D7 discipline; WA7).
 *
 * Layer 1 (deterministic, no API) plus, for triggered cases, one Layer 2 LLM
 * rollup call. WA12: dry-run uses the deterministic templated path and fires
 * no API; write fires the LLM fallback for triggered cases (estimate approved:
 * 6 of 6 S2 fixtures trigger). Source flat scalars and rolling_metrics are
 * never read (the three-way do-not-mix rule).
 *
 * Usage:
 *   npx tsx scripts/backfill-risk-reward.ts --dry-run   # all S2, no API, no write
 *   npx tsx scripts/backfill-risk-reward.ts             # all S2, LLM + write
 *   npx tsx scripts/backfill-risk-reward.ts --case <id> # one case, LLM + write
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { loadSnapshot } from "../lib/agents/snapshot-loader";
import {
  runRiskRewardStats,
  runRiskRewardDeterministic,
  buildPmsAifFrameworkNotice,
  type RiskRewardOutput,
  type PmsAifFrameworkNotice,
} from "../lib/agents/risk-reward-stats";
import { HOLDINGS_BY_INVESTOR } from "../db/fixtures/structured-holdings";

const FIXTURE_DIR = path.resolve(process.cwd(), "db", "fixtures", "cases");

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
  content: { risk_reward_stats?: unknown; [k: string]: unknown };
  [k: string]: unknown;
};

async function processFixture(file: string, opts: { write: boolean }): Promise<void> {
  const filePath = path.join(FIXTURE_DIR, file);
  const fixture = JSON.parse(await fs.readFile(filePath, "utf-8")) as CaseFixture;

  if (fixture.workflow !== "s2") {
    console.log(`  skip ${fixture.id}: workflow=${fixture.workflow} (risk-reward is S2-only)`);
    return;
  }
  const holdings = HOLDINGS_BY_INVESTOR[fixture.investorId];
  if (!holdings) throw new Error(`No structured holdings for "${fixture.investorId}" (${fixture.id}).`);
  const asOfDate = SNAPSHOT_DATE[fixture.snapshotId];
  if (!asOfDate) throw new Error(`Unknown snapshot "${fixture.snapshotId}" for ${fixture.id}.`);

  const snapshot = await loadSnapshot(fixture.snapshotId);
  const input = { caseId: fixture.id, asOfDate, holdings, snapshot,
    investor: { riskAppetite: "Aggressive", liquidityTier: "secondary" } };

  // dry-run: deterministic (no API). write: LLM fallback fires for triggered cases.
  const output: RiskRewardOutput = opts.write
    ? (await runRiskRewardStats(input)).output
    : runRiskRewardDeterministic(input);

  const sent: Record<string, number> = {};
  for (const h of output.per_holding) if (h.sentinel) sent[h.sentinel] = (sent[h.sentinel] ?? 0) + 1;
  const p = output.portfolio.stats;
  console.log(`\n=== ${fixture.id}  (${fixture.investorId})  as of ${asOfDate} ===`);
  console.log(`  portfolio: sharpe_3y=${p?.sharpe_3y} vol_3y=${p?.vol_3y_annualized} beta_3y=${p?.beta_3y} ir_3y=${p?.information_ratio_3y} eval=${output.portfolio.evaluable_weight_pct}%`);
  console.log(`  sentinels: ${JSON.stringify(sent)}`);
  console.log(`  rollup [${output.rollup.generation_method}/${output.rollup.llm_fallback_trigger ?? "none"}]: ${output.rollup.text}`);

  const already = "risk_reward_stats" in fixture.content;
  const existingKeys = Object.keys(fixture.content);
  console.log(`  content keys before: [${existingKeys.join(", ")}]${already ? " (risk_reward_stats already present, will overwrite)" : " (+risk_reward_stats)"}`);

  if (opts.write) {
    fixture.content.risk_reward_stats = output;
    await fs.writeFile(filePath, JSON.stringify(fixture, null, 2) + "\n", "utf-8");
    console.log(`  written: db/fixtures/cases/${file} (content.risk_reward_stats)`);
  } else {
    console.log(`  dry-run: not written (no API fired; templated preview)`);
  }
}

/* Surgical additive: add ONLY content.risk_reward_stats.pms_aif_framework_notice
 * to fixtures that already have risk_reward_stats. No recompute, no API, no
 * rollup change; the existing risk_reward_stats object is preserved and the
 * single new key is appended. */
async function addFrameworkNotice(file: string): Promise<void> {
  const filePath = path.join(FIXTURE_DIR, file);
  const fixture = JSON.parse(await fs.readFile(filePath, "utf-8")) as CaseFixture;
  if (fixture.workflow !== "s2") {
    console.log(`  skip ${fixture.id}: workflow=${fixture.workflow}`);
    return;
  }
  const rr = fixture.content.risk_reward_stats as
    | { pms_aif_framework_notice?: PmsAifFrameworkNotice }
    | undefined;
  if (!rr) {
    console.log(`  skip ${fixture.id}: no content.risk_reward_stats (run full backfill first)`);
    return;
  }
  const holdings = HOLDINGS_BY_INVESTOR[fixture.investorId];
  if (!holdings) throw new Error(`No holdings for "${fixture.investorId}" (${fixture.id}).`);
  const notice = buildPmsAifFrameworkNotice(holdings.holdings);
  rr.pms_aif_framework_notice = notice;
  await fs.writeFile(filePath, JSON.stringify(fixture, null, 2) + "\n", "utf-8");
  console.log(`  ${fixture.id}: pms_aif_framework_notice.applies=${notice.applies} (existing rollup untouched)`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const frameworkNotice = args.includes("--framework-notice");
  const ci = args.indexOf("--case");
  const onlyCase = ci >= 0 ? args[ci + 1] : null;

  const entries = (await fs.readdir(FIXTURE_DIR)).filter((f) => f.endsWith(".json"));
  let targets = entries;
  if (onlyCase) {
    targets = entries.filter((f) => f === `${onlyCase}.json` || f === onlyCase);
    if (targets.length === 0) throw new Error(`No fixture matching --case ${onlyCase}`);
  }
  if (frameworkNotice) {
    console.log(`Risk-Reward framework-notice add: ${targets.length} fixture(s), no API, additive field only`);
    for (const file of targets.sort()) await addFrameworkNotice(file);
    console.log(`\nDone. ${targets.length} fixture(s) processed.`);
    return;
  }
  console.log(`Risk-Reward backfill: ${targets.length} fixture(s), mode=${dryRun ? "dry-run (no API)" : "WRITE (LLM for triggered)"}`);
  for (const file of targets.sort()) await processFixture(file, { write: !dryRun });
  console.log(`\nDone. ${targets.length} fixture(s) processed.`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("[backfill-risk-reward] error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
