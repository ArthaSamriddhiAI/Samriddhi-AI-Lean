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
 * Usage (explicit case enumeration is REQUIRED; there is no implicit all-cases
 * default, which previously caused an off-list case to be backfilled by mistake,
 * see product debt P42):
 *   npx tsx scripts/backfill-a3.ts --cases=bhatt --dry-run        # free: list targets, no API
 *   npx tsx scripts/backfill-a3.ts --cases=bhatt                  # one case, live API + write
 *   npx tsx scripts/backfill-a3.ts --cases=bhatt,menon,surana     # several, live API + write
 *   npx tsx scripts/backfill-a3.ts --cases=c-2026-05-14-bhatt-01  # by full case id (exact)
 * A token matches a fixture whose filename stem equals it or contains it as a
 * hyphen-delimited segment (so "bhatt" resolves the bhatt case). Non-Samriddhi-2
 * fixtures among the matches are skipped. Invoking with no --cases exits 1.
 * --dry-run resolves and lists targets WITHOUT any API call or fixture write.
 *
 * A3 reads the frozen a2_classification (run backfill-a2 first if absent),
 * the frozen metrics, and the frozen evidence; it does not re-run A2 or the
 * pipeline.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { runA3Diagnostic, computeA3, type A3Input } from "../lib/agents/a3-so-what";
import { stitch, type EvidenceBundle, type StitchInput } from "../lib/agents/stitcher";
import { computeMetrics, type PortfolioMetrics } from "../lib/agents/portfolio-risk-analytics";
import type { A2Output } from "../lib/agents/a2-classification";
import type { RiskRewardOutput } from "../lib/agents/risk-reward-stats";
import { runPortfolioOverlapDeterministic, type PortfolioOverlapOutput } from "../lib/agents/portfolio-overlap";
import { loadSnapshot } from "../lib/agents/snapshot-loader";
import { buildA3IndianContext, type A3TaxProductFamily } from "../lib/agents/m0-indian-context";
import { buildOperationalScope, taxProductFamily } from "../lib/agents/operational-scope";
import { HOLDINGS_BY_INVESTOR } from "../db/fixtures/structured-holdings";
import { MANDATES_BY_INVESTOR } from "../db/fixtures/structured-mandates";

/* Per-investor risk classification, mirroring db/seed.ts INVESTORS so the
 * backfill can recompute metrics with the same inputs the live pipeline uses
 * (Finding 5: metrics now also take the per-investor mandate). The Samriddhi 2
 * personas are locked (WA26); if a persona's riskAppetite/liquidityTier changes
 * in the seed, update it here too. */
const INVESTOR_PROFILE: Record<string, { riskAppetite: string; liquidityTier: string }> = {
  malhotra: { riskAppetite: "Aggressive", liquidityTier: "Essential" },
  iyengar: { riskAppetite: "Conservative", liquidityTier: "Secondary" },
  bhatt: { riskAppetite: "Aggressive · stated", liquidityTier: "Essential" },
  menon: { riskAppetite: "Aggressive", liquidityTier: "Essential (deep, transitional)" },
  surana: { riskAppetite: "Aggressive", liquidityTier: "Essential" },
  sharma: { riskAppetite: "Aggressive · stated", liquidityTier: "Essential" },
};

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

/* Shape of a redeployment block as it may appear in a frozen fixture (cash
 * funding is absent pre-Finding-5); used only for the preview diff. */
type A3RedeploymentLike = {
  freed_capital_pct?: number;
  cash_funding_pct?: number;
  leftover_to_cash_pct?: number;
  deployments?: Array<{ sleeve: string; target_pct: number; add_pct_points: number }>;
};

function fmtTarget(input: A3Input, cls: "Equity" | "Debt" | "Alternatives" | "Cash"): string {
  const b = input.metrics?.assetClass?.[cls];
  return b ? `${b.targetPct}% (band ${b.band[0]}-${b.band[1]})` : "?";
}

/* Assemble the A3 input for a fixture, deterministically and with no API.
 * Recomputes the metrics with the per-investor mandate (Finding 5), the
 * overlap, the pre-observations, and the Finding 2 tax/operational context, so
 * both the live backfill and the free dry-run preview reason against identical,
 * Finding-5-correct inputs. The frozen content.metrics is NOT used as the A3
 * target source any more: it predates Finding 5 (flat bands, cash-as-position),
 * so reusing it would mask the very correction this build makes. */
async function assembleA3Input(fixture: CaseFixture, asOfDate: string): Promise<A3Input> {
  const a2Output = fixture.content.a2_classification;
  if (!a2Output) {
    throw new Error(
      `${fixture.id}: content.a2_classification absent; run backfill-a2 first (A3 reads A2's frozen output).`,
    );
  }
  const holdings = HOLDINGS_BY_INVESTOR[fixture.investorId];
  if (!holdings) {
    throw new Error(`No structured holdings for investor "${fixture.investorId}" (${fixture.id}).`);
  }
  const profile = INVESTOR_PROFILE[fixture.investorId];
  if (!profile) {
    throw new Error(`No INVESTOR_PROFILE (riskAppetite/liquidityTier) for "${fixture.investorId}" (${fixture.id}).`);
  }
  const snapshot = await loadSnapshot(fixture.snapshotId);
  const mandate = MANDATES_BY_INVESTOR[fixture.investorId] ?? null;

  // Finding 5: recompute metrics with the per-investor mandate (target source)
  // and the cash-exclusion from positionFlags. Deterministic, no API.
  const metrics = computeMetrics(holdings, snapshot, profile, mandate);

  const ev = fixture.content.evidence ?? {};
  const evidence: EvidenceBundle = {
    e1: ev.e1 ?? null,
    e2: ev.e2 ?? null,
    e3: ev.e3 ?? null,
    e4: ev.e4 ?? null,
    e6: ev.e6 ?? null,
    e7: ev.e7 ?? null,
  };

  // Pre-observations from the RECOMPUTED metrics (so the cash-exclusion and the
  // per-investor bands flow through to the observation surface too).
  const preObservations = stitch({
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
  }).pre_observations;

  // Recompute portfolio_overlap deterministically (shape parity with live).
  const overlap: PortfolioOverlapOutput = runPortfolioOverlapDeterministic({
    caseId: fixture.id,
    asOfDate,
    holdings,
    snapshot,
    investor: {},
  });

  const riskReward = fixture.content.risk_reward_stats ?? null;

  // Finding 2: M0 tax + SEBI context and per-holding operational metadata.
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

  return { caseId: fixture.id, asOfDate, a2Output, metrics, preObservations, riskReward, overlap, evidence, indianContext, operational };
}

async function processFixture(file: string, opts: { write: boolean }): Promise<void> {
  const filePath = path.join(FIXTURE_DIR, file);
  const fixture = JSON.parse(await fs.readFile(filePath, "utf-8")) as CaseFixture;

  if (fixture.workflow !== "s2") {
    console.log(`  skip ${fixture.id}: workflow=${fixture.workflow} (A3 is Samriddhi 2 only)`);
    return;
  }
  const asOfDate = SNAPSHOT_DATE[fixture.snapshotId];
  if (!asOfDate) {
    throw new Error(`Unknown snapshot "${fixture.snapshotId}" for ${fixture.id}; add it to SNAPSHOT_DATE.`);
  }

  const input = await assembleA3Input(fixture, asOfDate);
  const { output, usage, responseId, responseModel, judgmentResponseId } = await runA3Diagnostic(input);

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
    console.log(`  REDEPLOYMENT: freed ${rd.freed_capital_pct} + cash_funding ${rd.cash_funding_pct} pts; ${rd.deployments.map((x) => `${x.sleeve} +${x.add_pct_points} -> ${x.resulting_pct} (target ${x.target_pct})`).join(", ") || "no deployable sleeve"}; leftover_to_cash ${rd.leftover_to_cash_pct} pts`);
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

/* Parse the REQUIRED --cases list. Accepts --cases=a,b,c or --cases a,b,c.
 * No fall-through to an all-cases glob: an empty list is a usage error so a
 * re-backfill can only ever touch the cases the operator enumerated (P42). */
function parseCases(args: string[]): string[] {
  for (const a of args) {
    const m = /^--cases=(.*)$/.exec(a);
    if (m) return m[1].split(",").map((s) => s.trim()).filter(Boolean);
  }
  const i = args.indexOf("--cases");
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")) {
    return args[i + 1].split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function stemOf(file: string): string {
  return file.replace(/\.json$/, "");
}

/* A token matches a fixture when it equals the filename stem (exact case id) or
 * appears as a hyphen/underscore-delimited segment of it (the investor slug). */
function matchesToken(file: string, token: string): boolean {
  const s = stemOf(file);
  return s === token || s.split(/[-_]/).includes(token);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const cases = parseCases(args);

  if (cases.length === 0) {
    console.error("backfill-a3: refusing to run, no explicit cases given.");
    console.error("This script requires an explicit case list; there is no implicit all-cases default (product debt P42).");
    console.error("Usage: npx tsx scripts/backfill-a3.ts --cases=<id-or-investor>[,<...>] [--dry-run]");
    console.error("Example: --cases=bhatt    or    --cases=c-2026-05-14-bhatt-01,menon");
    process.exit(1);
  }

  const entries = (await fs.readdir(FIXTURE_DIR)).filter((f) => f.endsWith(".json"));
  const unmatched = cases.filter((t) => !entries.some((f) => matchesToken(f, t)));
  if (unmatched.length > 0) {
    console.error(`backfill-a3: no fixture matched these tokens: ${unmatched.join(", ")}`);
    console.error(`Available fixtures: ${entries.map(stemOf).join(", ")}`);
    process.exit(1);
  }
  const targets = entries.filter((f) => cases.some((t) => matchesToken(f, t))).sort();

  console.log(`A3 backfill: cases=[${cases.join(", ")}] -> ${targets.length} matched fixture(s), mode=${dryRun ? "DRY-RUN (no API, no write)" : "WRITE (live API)"}`);
  for (const f of targets) console.log(`  target: ${f}`);

  if (dryRun) {
    console.log(`\nFinding 5 deterministic preview (computed Layer 1 only, NO API, NO write):`);
    const changed: string[] = [];
    for (const f of targets) {
      const fx = JSON.parse(await fs.readFile(path.join(FIXTURE_DIR, f), "utf-8")) as CaseFixture;
      if (fx.workflow !== "s2") {
        console.log(`\n  ${f}: skip (workflow=${fx.workflow}, not Samriddhi 2)`);
        continue;
      }
      const asOfDate = SNAPSHOT_DATE[fx.snapshotId] ?? "?";
      const input = await assembleA3Input(fx, asOfDate);
      const layer1 = computeA3(input);

      // Old (frozen) vs new (Finding 5) computed redeployment + targets.
      const oldA3 = (fx.content.a3_so_what ?? null) as {
        rebalance_proposal?: { kind?: string; computed?: { redeployment?: A3RedeploymentLike; positions?: Array<{ instrument: string; decision: string }> } };
        decisions?: Array<{ holding_ref: string; decision: string; over_concentrated: boolean; asset_class: string }>;
      } | null;
      const newReb = layer1.rebalance_proposal.kind === "proposal" ? layer1.rebalance_proposal.computed.redeployment : null;
      const oldReb = oldA3?.rebalance_proposal?.computed?.redeployment ?? null;

      const ac = input.metrics?.assetClass;
      const newCashTrimmed = layer1.decisions.some((d) => d.asset_class === "Cash" && (d.decision === "trim" || d.decision === "exit"));
      const oldCashTrimmed = (oldA3?.decisions ?? []).some((d) => d.asset_class === "Cash" && (d.decision === "trim" || d.decision === "exit"));

      console.log(`\n  === ${fx.investorId} (${f}) ===`);
      console.log(`    sleeve actuals: Equity ${ac?.Equity.actualPct ?? "?"}%, Debt ${ac?.Debt.actualPct ?? "?"}%, Alt ${ac?.Alternatives.actualPct ?? "?"}%, Cash ${ac?.Cash.actualPct ?? "?"}%`);
      console.log(`    target source: per-investor mandate -> Equity target ${fmtTarget(input, "Equity")}, Debt ${fmtTarget(input, "Debt")}, Alt ${fmtTarget(input, "Alternatives")}, Cash ${fmtTarget(input, "Cash")}`);
      console.log(`    cash flagged as over-concentration (a position trim)?  old=${oldCashTrimmed}  new=${newCashTrimmed}`);
      if (oldReb) {
        console.log(`    OLD redeployment: freed=${oldReb.freed_capital_pct} deploy=[${(oldReb.deployments ?? []).map((d) => `${d.sleeve}->${d.target_pct}(+${d.add_pct_points})`).join(", ")}] leftover=${oldReb.leftover_to_cash_pct}`);
      } else {
        console.log(`    OLD redeployment: (none in frozen fixture)`);
      }
      if (newReb) {
        console.log(`    NEW redeployment: freed=${newReb.freed_capital_pct} cash_funding=${newReb.cash_funding_pct} deploy=[${newReb.deployments.map((d) => `${d.sleeve}->${d.target_pct}(+${d.add_pct_points})`).join(", ")}] leftover=${newReb.leftover_to_cash_pct}`);
        console.log(`    note: ${newReb.note}`);
      } else {
        console.log(`    NEW redeployment: ${layer1.rebalance_proposal.kind}`);
      }

      const material =
        oldCashTrimmed !== newCashTrimmed ||
        !oldReb !== !newReb ||
        (oldReb && newReb && (
          Math.abs((oldReb.leftover_to_cash_pct ?? 0) - newReb.leftover_to_cash_pct) > 0.5 ||
          Math.abs((oldReb.freed_capital_pct ?? 0) - newReb.freed_capital_pct) > 0.5 ||
          (newReb.cash_funding_pct ?? 0) > 0.5 ||
          (oldReb.deployments ?? []).map((d) => `${d.sleeve}:${d.target_pct}`).join("|") !== newReb.deployments.map((d) => `${d.sleeve}:${d.target_pct}`).join("|")
        ));
      console.log(`    --> ${material ? "MATERIALLY CHANGED (needs paid narration re-backfill)" : "barely changed (skip)"}`);
      if (material) changed.push(fx.investorId);
    }
    console.log(`\nPreview complete: no API spent, no fixture written.`);
    console.log(`Materially-changed fixtures (paid re-backfill candidates): ${changed.length ? changed.join(", ") : "(none)"}`);
    if (changed.length) {
      const tokens = changed.join(",");
      console.log(`Scoped paid command would be: npx tsx scripts/backfill-a3.ts --cases=${tokens}`);
    }
    return;
  }

  for (const file of targets) {
    await processFixture(file, { write: true });
  }
  console.log(`\nDone. ${targets.length} fixture(s) processed.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-a3] error:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
