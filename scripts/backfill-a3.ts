/* A3 backfill for the existing Samriddhi 2 fixtures.
 *
 * Additive: computes A3 from each fixture's already-frozen a2_classification,
 * metrics, and evidence, then injects content.a3_so_what. It does NOT
 * regenerate the case (the S1 briefing and the other content blocks stay
 * byte-identical). Mirrors backfill-a2.ts.
 *
 * Layer 1 (deterministic) builds the three surfaces and the rebalance
 * glide-path math from the frozen inputs. pre_observations are recomputed
 * deterministically from the frozen metrics and evidence via stitch() (no
 * API). Layer 2 (advisor-action prose) is one live Claude call per case
 * (Opus 4.7 per the skill frontmatter). An all-clear case makes no call.
 *
 * Usage:
 *   npx tsx scripts/backfill-a3.ts --case <id> --dry-run   # print only
 *   npx tsx scripts/backfill-a3.ts --dry-run                # all S2, print only
 *   npx tsx scripts/backfill-a3.ts                          # all S2, write fixtures
 *   npx tsx scripts/backfill-a3.ts --case <id>              # one case, write fixture
 *
 * A3 reads the frozen a2_classification (run backfill-a2 first if absent),
 * the frozen metrics, and the frozen evidence; it does not re-run A2 or the
 * pipeline.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { runA3Diagnostic } from "../lib/agents/a3-so-what";
import { stitch, type EvidenceBundle, type StitchInput } from "../lib/agents/stitcher";
import type { PortfolioMetrics } from "../lib/agents/portfolio-risk-analytics";
import type { A2Output } from "../lib/agents/a2-classification";
import type { RiskRewardOutput } from "../lib/agents/risk-reward-stats";
import { runPortfolioOverlapDeterministic, type PortfolioOverlapOutput } from "../lib/agents/portfolio-overlap";
import { loadSnapshot } from "../lib/agents/snapshot-loader";
import { buildA3IndianContext, type A3TaxProductFamily } from "../lib/agents/m0-indian-context";
import { buildOperationalScope, taxProductFamily } from "../lib/agents/operational-scope";
import { HOLDINGS_BY_INVESTOR } from "../db/fixtures/structured-holdings";

/* Persona structure lines, mirroring db/seed.ts INVESTORS[].structureLine. The
 * Samriddhi 2 personas are locked (WA26, product debt P40); A3's tax-structure
 * resolver reads only the residency and HUF axes from these, so the descriptive
 * business-entity text is informational. Kept here so the backfill stays
 * fixture-driven without a DB round-trip; if a persona's structureLine changes
 * in the seed, update it here too. */
const STRUCTURE_LINE_BY_INVESTOR: Record<string, string> = {
  malhotra: "Dual-professional · dermatology + cardiothoracic",
  iyengar: "Distribution · inherited corpus",
  bhatt: "Family business · partnership firm",
  menon: "Founder exit · NRE → resident",
  surana: "Tech founder · Series D",
  sharma: "Family business · individual filer",
};

const FIXTURE_DIR = path.resolve(process.cwd(), "db", "fixtures", "cases");

/* Opus 4.7 pricing for the measured-cost readout. */
const USD_PER_M_INPUT = 15;
const USD_PER_M_OUTPUT = 75;
const INR_PER_USD = 84;

/* Snapshot id to as-of date (foundation seed SNAPSHOTS). All six S2 fixtures
 * run on t0_q2_2026; an unknown snapshot errors loudly rather than guessing. */
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
    a2_classification?: A2Output;
    risk_reward_stats?: RiskRewardOutput;
    router_decision?: unknown;
    a3_so_what?: unknown;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function processFixture(file: string, opts: { write: boolean }): Promise<void> {
  const filePath = path.join(FIXTURE_DIR, file);
  const fixture = JSON.parse(await fs.readFile(filePath, "utf-8")) as CaseFixture;

  if (fixture.workflow !== "s2") {
    console.log(`  skip ${fixture.id}: workflow=${fixture.workflow} (A3 is Samriddhi 2 only)`);
    return;
  }

  const a2Output = fixture.content.a2_classification;
  if (!a2Output) {
    throw new Error(
      `${fixture.id}: content.a2_classification absent; run backfill-a2 first (A3 reads A2's frozen output).`,
    );
  }
  const metrics = fixture.content.metrics ?? null;
  const asOfDate = SNAPSHOT_DATE[fixture.snapshotId];
  if (!asOfDate) {
    throw new Error(`Unknown snapshot "${fixture.snapshotId}" for ${fixture.id}; add it to SNAPSHOT_DATE.`);
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

  // Recompute the 7 live pre-observations deterministically from the frozen
  // metrics and evidence (no API). stitch() assembles them via the same
  // derivePreObservations the live pipeline uses; we read only pre_observations.
  let preObservations = metrics
    ? stitch({
        caseMeta: {
          case_id: fixture.id,
          investor_id: fixture.investorId,
          investor_name: fixture.investorId,
          as_of_date: asOfDate,
          case_mode: "diagnostic",
          bucket_tier: metrics.concentration.bucketTier,
        },
        metrics,
        evidence,
        router_decision: (fixture.content.router_decision ?? {}) as StitchInput["router_decision"],
        usage: {},
      }).pre_observations
    : [];

  // Recompute portfolio_overlap deterministically (no API), using the same
  // function and output type the live pipeline persists, so the Redundancy
  // signal A3 judges over is structurally identical to live (shape parity,
  // T-5.12 requirement). The 5 fixtures predate T-5.07, so overlap was never
  // frozen; recompute it from the frozen holdings + snapshot.
  const holdings = HOLDINGS_BY_INVESTOR[fixture.investorId];
  if (!holdings) {
    throw new Error(`No structured holdings for investor "${fixture.investorId}" (${fixture.id}).`);
  }
  const snapshot = await loadSnapshot(fixture.snapshotId);
  const overlap: PortfolioOverlapOutput = runPortfolioOverlapDeterministic({
    caseId: fixture.id,
    asOfDate,
    holdings,
    snapshot,
    investor: {},
  });

  const riskReward = fixture.content.risk_reward_stats ?? null;

  // Finding 2: M0 tax + SEBI context (product-structure-scoped) and per-holding
  // snapshot operational metadata (category-guarded), mirroring the live
  // pipeline. Deterministic, no API.
  const a3TaxFamilies = Array.from(
    new Set(
      holdings.holdings
        .map((h) => taxProductFamily(h.subCategory))
        .filter((f): f is A3TaxProductFamily => f !== null),
    ),
  );
  const indianContext = await buildA3IndianContext({
    caseId: fixture.id,
    asOfDate,
    investorStructureLine: STRUCTURE_LINE_BY_INVESTOR[fixture.investorId] ?? "",
    productFamilies: a3TaxFamilies,
  });
  const operational = buildOperationalScope(holdings, snapshot);

  const { output, usage, responseId, responseModel, judgmentResponseId } = await runA3Diagnostic({
    caseId: fixture.id,
    asOfDate,
    a2Output,
    metrics,
    preObservations,
    riskReward,
    overlap,
    evidence,
    indianContext,
    operational,
  });

  // --- Readout ---
  const usd = (usage.inputTokens / 1e6) * USD_PER_M_INPUT + (usage.outputTokens / 1e6) * USD_PER_M_OUTPUT;
  console.log(`\n=== ${fixture.id}  (${fixture.investorId})  as of ${asOfDate} ===`);
  console.log(`api: judgment_id=${judgmentResponseId ?? "(no judgment call)"}  narration_id=${responseId ?? "(none)"}  model=${responseModel ?? "n/a"}`);
  console.log(`cost (both calls): ${usage.inputTokens} in / ${usage.outputTokens} out  ->  USD ${usd.toFixed(4)} (INR ${(usd * INR_PER_USD).toFixed(2)}) at Opus 4.7 $15/$75 per M`);
  const s = output.summary;
  console.log(
    `summary: holding actions ${s.holding_actions_surfaced} surfaced / ${s.holding_actions_sentinelled} sentinel; ` +
      `observation actions ${s.observation_actions_surfaced} surfaced / ${s.observation_actions_sentinelled} sentinel; ` +
      `decisions ${s.trim_count} trim / ${s.exit_count} exit; rebalance ${s.rebalance}`,
  );
  console.log(`one_line: ${s.one_line_characterization}`);

  const exits = output.decisions.filter((d) => d.decision === "exit");
  if (exits.length > 0) {
    console.log(`\nEXIT DECISIONS (${exits.length}):`);
    for (const d of exits) console.log(`  ${d.instrument_display_name} [${d.holding_kind}] :: ${d.exit_rationale}`);
  }

  console.log(`\nHOLDING ACTIONS (${output.holding_actions.length}):`);
  for (const h of output.holding_actions) {
    if (h.kind === "action") {
      console.log(`  [ACTION]   ${pad(h.a2_verdict.toUpperCase(), 9)} ${pad(h.instrument_display_name, 40)} :: ${h.source_observation}`);
      console.log(`             "${h.advisor_action}"`);
    } else {
      console.log(`  [SENTINEL] ${pad(h.a2_verdict.toUpperCase(), 9)} ${pad(h.instrument_display_name, 40)} :: ${h.sentinel_reason}`);
      console.log(`             "${h.note}"`);
    }
  }

  console.log(`\nOBSERVATION ACTIONS (${output.observation_actions.length}):`);
  for (const o of output.observation_actions) {
    if (o.kind === "action") {
      console.log(`  [ACTION]   ${pad(o.observation_category, 32)} (${o.severity_hint})`);
      console.log(`             "${o.advisor_action}"`);
    } else {
      console.log(`  [SENTINEL] ${pad(o.observation_category, 32)} :: ${o.sentinel_reason}`);
      console.log(`             "${o.note}"`);
    }
  }

  const reb = output.rebalance_proposal;
  console.log(`\nREBALANCE PROPOSAL (${reb.kind}):`);
  if (reb.kind === "proposal") {
    for (const p of reb.computed.positions) {
      console.log(`  [${p.decision.toUpperCase()}] ${p.instrument}: current ${p.current_weight_pct}% -> target ${p.target_weight_pct}% (breach ${p.breach_threshold_pct}%, total ${p.total_trim_pct_points} pts)`);
      for (const g of p.glide_path) {
        console.log(`     step ${g.step}: trim ${g.trim_pct_points} pts -> ${g.resulting_weight_pct}% (take at weight ${g.trigger_at_weight_pct}%)`);
      }
    }
    const rd = reb.computed.redeployment;
    console.log(`  REDEPLOYMENT: freed ${rd.freed_capital_pct} pts; ${rd.deployments.map((x) => `${x.sleeve} +${x.add_pct_points}`).join(", ") || "no deployable sleeve"}; leftover_to_cash ${rd.leftover_to_cash_pct} pts`);
    console.log(`     ${rd.note}`);
    console.log(`  narrated (${reb.narrated.generation_method}): "${reb.narrated.advisor_action}"`);
  } else if (reb.kind === "no_action_needed") {
    console.log(`  ${reb.note}`);
  } else {
    console.log(`  sentinel (${reb.sentinel_reason}): ${reb.note}`);
  }

  console.log(`\nINDIAN CONTEXT (tax + SEBI):`);
  if (output.indian_context) {
    const ic = output.indian_context;
    console.log(`  investor structure: ${ic.investor_structure.structure_type}/${ic.investor_structure.residency}`);
    for (const b of ic.tax_by_product) console.log(`  tax[${b.product_family}]: ${b.entries.map((e) => e.entry_id).join(", ") || "(none)"}`);
    console.log(`  sebi_minimums: ${ic.sebi_minimums.map((m) => `${m.product} ${m.min_ticket_cr}cr`).join(", ") || "(none)"}`);
  } else {
    console.log(`  (none)`);
  }
  console.log(`OPERATIONAL (snapshot-matched, ${output.operational.length}):`);
  for (const op of output.operational) {
    const { holding_ref, kind, matched_record_name: _m, ...fields } = op;
    console.log(`  ${holding_ref} [${kind}]: ${JSON.stringify(fields)}`);
  }

  console.log(`\nreasoning_summary: ${output.reasoning_summary}`);

  if (opts.write) {
    fixture.content.a3_so_what = output;
    await fs.writeFile(filePath, JSON.stringify(fixture, null, 2) + "\n", "utf-8");
    console.log(`\n  written: db/fixtures/cases/${file} (content.a3_so_what)`);
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

  console.log(`A3 backfill: ${targets.length} fixture(s), mode=${dryRun ? "dry-run" : "WRITE"}`);
  for (const file of targets.sort()) {
    await processFixture(file, { write: !dryRun });
  }
  console.log(`\nDone. ${targets.length} fixture(s) processed.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-a3] error:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
