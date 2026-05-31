/* Deterministic verification for A3.so_what (T-5.12, combined build). No API.
 *
 * Part A (synthetic units): glide-path/trim math, redeployment closure
 * (freed == deployed + leftover) across the edge cases, exit-eligibility gate,
 * reconciled-decision coherence (both surfaces agree per holding), and sentinel
 * routing for the thin/opaque dimensions.
 *
 * Part B (fixture-driven, free): overlap recomputes present and well-formed for
 * all 5 Samriddhi 2 fixtures (so a silent recompute failure cannot leave
 * Redundancy hollow), and Surana's Axis Large Cap is NOT exit-eligible (one
 * soft thesis signal plus a concentration flag is not a hard-corroborated
 * two-dimension convergence), so it lands on trim.
 *
 * The Layer-2 LLM judgment and prose are exercised under the WA12-gated
 * re-backfill, not here. Run: npx tsx scripts/_verify-a3-so-what.ts
 */
import {
  computeA3,
  computeRedeployment,
  type A3Input,
  type A3ReconciledDecision,
} from "@/lib/agents/a3-so-what";
import type { A2Output, A2HoldingVerdict, A2Verdict, A2Driver } from "@/lib/agents/a2-classification";
import type { PortfolioMetrics } from "@/lib/agents/portfolio-risk-analytics";
import { MODEL_BANDS, computeMetrics, resolveTargetBands } from "@/lib/agents/portfolio-risk-analytics";
import { MANDATES_BY_INVESTOR } from "@/db/fixtures/structured-mandates";
import type { RiskRewardOutput } from "@/lib/agents/risk-reward-stats";
import { runPortfolioOverlapDeterministic, type PortfolioOverlapOutput } from "@/lib/agents/portfolio-overlap";
import { stitch, type EvidenceBundle, type StitchInput } from "@/lib/agents/stitcher";
import { loadSnapshot } from "@/lib/agents/snapshot-loader";
import { buildA3IndianContext, resolveA3TaxStructure, type A3TaxProductFamily } from "@/lib/agents/m0-indian-context";
import { buildOperationalScope, taxProductFamily, findConsistentMatch } from "@/lib/agents/operational-scope";
import { HOLDINGS_BY_INVESTOR, type StructuredHoldings } from "@/db/fixtures/structured-holdings";
import {
  buildInstrumentUniverse, resolveFramework, classifyPmsSleeve, classifyMfSleeve,
  buildAlternativesPlan, computeCadence, buildDeploymentPlan, SELECTION_PARAMS,
  creditBucketOf, durationBucketOf, decomposeHeldEquity, buildEquityPlan, type SelectionCandidate,
} from "@/lib/agents/instrument-selection";
import { promises as fs } from "node:fs";
import path from "node:path";

const failures: string[] = [];
function assert(cond: boolean, name: string, detail = ""): void {
  if (!cond) failures.push(name);
  console.log(`  [${cond ? "PASS" : "FAIL"}] ${name}${cond ? "" : ` :: ${detail}`}`);
}
function round1(n: number): number { return Math.round(n * 10) / 10; }

/* ----- Synthetic builders ----- */

function driver(source_observation: string, severity: A2Driver["severity"], driver_type: A2Driver["driver_type"]): A2Driver {
  return { driver_type, severity, scope: "holding", source_observation, reason: "" };
}
function holding(ref: string, verdict: A2Verdict, drivers: A2Driver[], opts?: { assetClass?: string; subCategory?: string; weightPct?: number }): A2HoldingVerdict {
  return {
    holding_ref: ref, instrument_display_name: ref,
    asset_class: opts?.assetClass ?? "Equity", sub_category: opts?.subCategory ?? "listed_equity",
    weight_pct: opts?.weightPct ?? 10, verdict, drivers,
  };
}
function a2Output(hv: A2HoldingVerdict[]): A2Output {
  return {
    agent_id: "a2_classification", case_id: "verify-a3", as_of_date: "2026-04-30",
    holding_verdicts: hv,
    summary: { maintain_count: 0, monitor_count: 0, discuss_count: 0, review_count: 0, unable_to_classify_count: 0, one_line_characterization: "x" },
    reasoning_summary: "x",
  };
}
function metrics(
  positionFlags: Array<{ instrument: string; weightPct: number; severity: "flag" | "escalate" }>,
  actuals?: Partial<Record<"Equity" | "Debt" | "Alternatives" | "Cash", number>>,
): PortfolioMetrics {
  const cls = (c: "Equity" | "Debt" | "Alternatives" | "Cash") => {
    const target = MODEL_BANDS[c].target;
    const actual = actuals?.[c] ?? target;
    return { actualPct: actual, targetPct: target, band: [MODEL_BANDS[c].min, MODEL_BANDS[c].max] as [number, number], deviationPct: actual - target, inBand: actual >= MODEL_BANDS[c].min && actual <= MODEL_BANDS[c].max };
  };
  return {
    totalLiquidAumCr: 10, holdingsCount: positionFlags.length,
    assetClass: { Equity: cls("Equity"), Debt: cls("Debt"), Alternatives: cls("Alternatives"), Cash: cls("Cash") },
    concentration: {
      hhiHoldingLevel: 0, hhiAssetClassLevel: 0, top1: { instrument: "", weightPct: 0 }, top5: [],
      bucketCeilingHhi: 0, bucketTier: "Aggressive", hhiBreach: false, positionFlags,
      wrappers: { pmsCount: 0, pmsAggregatePct: 0, pmsList: [], aifCount: 0, aifAggregatePct: 0, aifList: [], wrapperCountFlag: false, wrapperShareFlag: false },
      sectorExposureMfLookThrough: [], mfCoverage: { coveredCount: 0, uncoveredCount: 0, coveredWeightPct: 0, uncoveredWeightPct: 0 },
      stockExposureLookThrough: [], sectorExposureLookThrough: [],
      lookThroughCoverage: { stock: { coveredWeightPct: 0, uncoveredWeightPct: 0, footnote: null }, sector: { coveredWeightPct: 0, uncoveredWeightPct: 0, footnote: null } },
    },
    liquidity: { bucketBreakdown: { T_30: 0, T_90: 0, T_365: 0, Locked: 0 }, t30PlusT90Pct: 0, tier: "secondary", tierFloor: { minPct: 0, maxPct: 0 }, floorBreach: false },
    cashDeployment: { cashSharePct: 0, deploymentGapPct: 0, cashDragFlag: false }, computedAt: "",
  };
}
function riskReward(perHolding: Array<{ ref: string; sharpe?: number | null }>): RiskRewardOutput {
  return {
    per_holding: perHolding.map((p) => ({
      holding_ref: p.ref, instrument_display_name: p.ref, asset_class: "Equity", sub_category: "listed_equity",
      weight_pct: 10, currency_basis: "INR", source: p.sharpe === undefined ? "sentinel" : "tier_b_read_through",
      sentinel: p.sharpe === undefined ? "insufficient_history" : null, benchmark_index_id: "nifty_500_tri",
      stats: p.sharpe === undefined ? null : { sharpe_3y: p.sharpe },
    })),
  } as unknown as RiskRewardOutput;
}
function overlap(pairs: Array<{ a: string; b: string; score: number }>): PortfolioOverlapOutput {
  return {
    agent_id: "portfolio_overlap", case_id: "v", as_of_date: "2026-04-30",
    per_pair: pairs.map((p) => ({ holding_a: p.a, holding_b: p.b, asset_class: "Equity", sub_category_a: "x", sub_category_b: "x", weight_pct_a: 10, weight_pct_b: 10, resolution_layer: "stock_level", score: p.score, shared_holdings: null, shared_holding_count: null, limited_by: null })),
    per_sleeve: [], portfolio: { total_holdings: 0, evaluated_pair_count: pairs.length, layer_breakdown: { stock_level: pairs.length, structural_similarity: 0, categorical: 0 }, strongest_pair: null, sentinel: null },
    rollup: { text: "", generation_method: "templated" }, reasoning_summary: "",
  } as unknown as PortfolioOverlapOutput;
}
function evidence(e4Magnitude?: "material" | "moderate" | "minor" | "none"): EvidenceBundle {
  return {
    e1: null, e2: null, e3: null,
    e4: e4Magnitude ? ({ stated_vs_revealed_divergence: { direction: "stated_more_conservative_than_revealed", magnitude: e4Magnitude, implication: "x" } } as unknown as EvidenceBundle["e4"]) : null,
    e6: null, e7: null,
  };
}
function e6Eval(instrument: string, verdict: string, complexity: string, feeBps = 360): unknown {
  return { instrument, wrapper_type: "PMS", sub_category: "pms_value", weight_pct: 12, manager_quality: "adequate", strategy_consistency: "moderate", fee_structure_assessment: "x", fee_normalised_bps: feeBps, liquidity_terms: "x", concentration_or_strategy_profile: "concentrated quality; overlap with peers", performance_vs_benchmark: "negative since-inception alpha", complexity_premium_earned: complexity, capacity_concern: "low", overall_verdict: verdict, key_drivers: [], key_risks: [], recommended_alternatives: [], confidence: 0.6, reasoning_trace: "x" };
}
function evidenceWithE6(evals: unknown[]): EvidenceBundle {
  return { e1: null, e2: null, e3: null, e4: null, e6: { per_product_evaluations: evals } as unknown as EvidenceBundle["e6"], e7: null };
}
function input(partial: Partial<A3Input> & { a2Output: A2Output }): A3Input {
  return {
    caseId: "v", asOfDate: "2026-04-30", metrics: null, preObservations: [],
    riskReward: null, overlap: null, evidence: null, indianContext: null, operational: [], selection: null, ...partial,
  };
}
function decision(d: "trim" | "exit" | "maintain", weight: number): A3ReconciledDecision {
  return { holding_ref: "x", instrument_display_name: "x", asset_class: "Equity", sub_category: "listed_equity", weight_pct: weight, holding_kind: "transparent", tax_product_family: "listed_equity", over_concentrated: weight > 10, a2_verdict: "review", signals: [], exit_eligible: false, decision: d, dimensions_failing: [], exit_rationale: "", judgment_reasoning: "" } as A3ReconciledDecision;
}

(async () => {
  // --- Case 1: glide-path/trim math via the decision path ---
  console.log("Case 1: trim glide-path (Reliance 18.4 escalate)");
  const c1 = computeA3(input({
    a2Output: a2Output([holding("Reliance Industries", "review", [driver("position_over_concentration", "escalate", "position_concentration")], { weightPct: 18.4 })]),
    metrics: metrics([{ instrument: "Reliance Industries", weightPct: 18.4, severity: "escalate" }]),
    riskReward: riskReward([{ ref: "Reliance Industries", sharpe: 0.8 }]),
    overlap: overlap([]),
  }));
  const reb1 = c1.rebalance_proposal;
  assert(reb1.kind === "proposal", "C1: proposal", reb1.kind);
  if (reb1.kind === "proposal") {
    const p = reb1.computed.positions[0];
    assert(p.decision === "trim" && p.total_trim_pct_points === 8.4 && p.glide_path.length === 2, "C1: trim 8.4 over 2 steps", JSON.stringify(p.glide_path));
    assert(p.glide_path[1].resulting_weight_pct === 10, "C1: lands on 10", String(p.glide_path[1].resulting_weight_pct));
  }
  const d1 = c1.decisions.find((d) => d.holding_ref === "Reliance Industries");
  assert(d1?.decision === "trim", "C1: reconciled decision trim", d1?.decision);

  // --- Case 2: coherence (both surfaces reflect the same decision) ---
  console.log("Case 2: coherence");
  const ha1 = c1.holding_actions.find((h) => h.holding_ref === "Reliance Industries");
  assert(ha1?.kind === "action" && ha1.decision === "trim", "C2: holding action carries decision trim", JSON.stringify(ha1));
  assert(reb1.kind === "proposal" && reb1.computed.positions.some((p) => p.instrument === "Reliance Industries" && p.decision === "trim"), "C2: rebalance reflects the same trim decision", "");

  // --- Case 3 (Finding 5): deploy-to-target closure, trims only, no cash funding ---
  console.log("Case 3: redeployment closure (deploy to target)");
  // Cash AT target (3) so cash_funding 0. freed 8.4. gaps-to-target: Debt 25-20=5, Alt 7-3=4 (Equity over). total 9 > 8.4 -> all deployed proportionally, no leftover.
  const m3 = metrics([], { Equity: 70, Debt: 20, Alternatives: 3, Cash: 3 });
  const r3 = computeRedeployment([decision("trim", 18.4)], m3);
  const deployed3 = round1(r3.deployments.reduce((s, x) => s + x.add_pct_points, 0));
  assert(r3.freed_capital_pct === 8.4 && r3.cash_funding_pct === 0, "C3: freed 8.4, no cash funding (cash at target)", `${r3.freed_capital_pct}/${r3.cash_funding_pct}`);
  assert(round1(deployed3 + r3.leftover_to_cash_pct) === round1(r3.freed_capital_pct + r3.cash_funding_pct), "C3: books close (freed + cash = deployed + leftover)", `${deployed3}+${r3.leftover_to_cash_pct} vs ${r3.freed_capital_pct}+${r3.cash_funding_pct}`);
  assert(r3.leftover_to_cash_pct === 0, "C3: nothing left to cash (under-target capacity exceeds funding)", String(r3.leftover_to_cash_pct));
  assert(r3.deployments.every((d) => d.sleeve !== "Cash"), "C3: cash is never a deployment destination", "");

  // --- Case 4 (Finding 5): honest leftover, funding exceeds total gap-to-target ---
  console.log("Case 4: honest leftover (funding exceeds gap-to-target, NOT band-fill)");
  // Cash at target. exit frees 20. gaps-to-target: Eq 65-64=1, Debt 25-24=1, Alt 7-6=1 = 3. (Band-fill would have absorbed 16.)
  const m4 = metrics([], { Equity: 64, Debt: 24, Alternatives: 6, Cash: 3 });
  const r4 = computeRedeployment([decision("exit", 20)], m4);
  const deployed4 = round1(r4.deployments.reduce((s, x) => s + x.add_pct_points, 0));
  assert(r4.freed_capital_pct === 20, "C4: exit frees full weight 20", String(r4.freed_capital_pct));
  assert(deployed4 === 3 && r4.leftover_to_cash_pct === 17, "C4: only 3 deployed to TARGET (not 16 to band), 17 honest leftover", `${deployed4}/${r4.leftover_to_cash_pct}`);
  assert(round1(deployed4 + r4.leftover_to_cash_pct) === round1(r4.freed_capital_pct + r4.cash_funding_pct), "C4: books close", "");

  // --- Case 5 (Finding 5): all sleeves at/above target -> all leftover ---
  console.log("Case 5: no under-target sleeve, all to cash");
  const m5 = metrics([], { Equity: 65, Debt: 25, Alternatives: 7, Cash: 3 });
  const r5 = computeRedeployment([decision("trim", 15)], m5); // freed 5
  assert(r5.freed_capital_pct === 5 && r5.deployments.length === 0 && r5.leftover_to_cash_pct === 5, "C5: no sleeve below its target, all 5 to cash", JSON.stringify(r5));

  // --- Case 5b (Finding 5): a sleeve ABOVE target but below band is NOT a destination ---
  console.log("Case 5b: above-target/below-band sleeve receives nothing (deploy-to-target, not band-fill)");
  // Debt at 27: above target 25, below band 30. Band-fill would have given it 3 (to reach 30); deploy-to-target gives 0.
  const m5b = metrics([], { Equity: 70, Debt: 27, Alternatives: 10, Cash: 3 });
  const r5b = computeRedeployment([decision("trim", 13)], m5b); // freed 3, no under-target sleeve
  assert(!r5b.deployments.some((d) => d.sleeve === "Debt"), "C5b: Debt (above target, below band) is NOT a destination", JSON.stringify(r5b.deployments));
  assert(r5b.leftover_to_cash_pct === 3, "C5b: the freed 3 is honest leftover, not filled into the band cushion", String(r5b.leftover_to_cash_pct));

  // --- Case 5c (Finding 5): Bhatt real metrics deploy-to-target = pre-Finding-4 (Debt to 25, leftover 7.1) ---
  console.log("Case 5c: Bhatt redeployment fills Debt to its 25 target (reverts Finding 4 band-fill)");
  const mB = metrics([], { Equity: 72.2, Debt: 14.2, Alternatives: 13.6, Cash: 0 });
  const rB = computeRedeployment([decision("trim", 11.3), decision("trim", 12.2), decision("trim", 11.3), decision("trim", 13.6), decision("exit", 9.5)], mB);
  const deployedB = round1(rB.deployments.reduce((s, x) => s + x.add_pct_points, 0));
  const debtB = rB.deployments.find((d) => d.sleeve === "Debt");
  assert(rB.freed_capital_pct === 17.9 && rB.cash_funding_pct === 0, "C5c: freed 17.9 (four trims + Motilal exit), no cash (cash 0)", `${rB.freed_capital_pct}/${rB.cash_funding_pct}`);
  assert(!!debtB && debtB.add_pct_points === 10.8 && debtB.resulting_pct === 25, "C5c: Debt fills to its 25 TARGET (10.8 deployed), not the 30 band", JSON.stringify(debtB));
  assert(deployedB === 10.8 && rB.leftover_to_cash_pct === 7.1, "C5c: leftover is the honest 7.1 (Finding 4 band-fill reverted)", `${deployedB}/${rB.leftover_to_cash_pct}`);

  // --- Case 5d (Finding 5): cash as a funding source, deploy across ALL under-target sleeves ---
  console.log("Case 5d: cash-as-funding deploys across all under-target sleeves (incl Alternatives)");
  // No trims; cash 30 (target 3) -> cash_funding 27. Under-target: Eq 65-60=5, Debt 25-20=5, Alt 7-2=5 = 15. funding 27 > 15 -> all filled to target, 12 honest leftover stays in cash.
  const m5d = metrics([], { Equity: 60, Debt: 20, Alternatives: 2, Cash: 30 });
  const r5d = computeRedeployment([], m5d);
  const sleeves5d = new Set(r5d.deployments.map((d) => d.sleeve));
  assert(r5d.freed_capital_pct === 0 && r5d.cash_funding_pct === 27, "C5d: funding is cash dry powder (27), no trims", `${r5d.freed_capital_pct}/${r5d.cash_funding_pct}`);
  assert(sleeves5d.has("Equity") && sleeves5d.has("Debt") && sleeves5d.has("Alternatives"), "C5d: deploys across all three under-target sleeves (Equity, Debt, Alternatives)", JSON.stringify([...sleeves5d]));
  assert(round1(r5d.deployments.reduce((s, x) => s + x.add_pct_points, 0)) === 15 && r5d.leftover_to_cash_pct === 12, "C5d: sleeves filled to target (15), 12 honest leftover in cash", JSON.stringify(r5d));
  assert(round1(15 + 12) === round1(r5d.freed_capital_pct + r5d.cash_funding_pct), "C5d: books close under cash-as-funding", "");

  // --- Case 6: exit-eligibility gate ---
  console.log("Case 6: exit-eligibility gate");
  // Performance concern (sharpe<0) AND thesis negative -> eligible
  const c6a = computeA3(input({
    a2Output: a2Output([holding("BadFund", "review", [driver("e7_overall_verdict_negative", "escalate", "thesis")], { weightPct: 12 })]),
    metrics: metrics([{ instrument: "BadFund", weightPct: 12, severity: "flag" }]),
    riskReward: riskReward([{ ref: "BadFund", sharpe: -0.3 }]),
    overlap: overlap([]),
  }));
  assert(c6a.decisions.find((d) => d.holding_ref === "BadFund")?.exit_eligible === true, "C6a: perf-negative + thesis-negative => exit_eligible", "");
  // thesis negative but sharpe >= 0 -> NOT eligible
  const c6b = computeA3(input({
    a2Output: a2Output([holding("SoundFund", "review", [driver("e7_overall_verdict_negative", "escalate", "thesis")], { weightPct: 12 })]),
    metrics: metrics([{ instrument: "SoundFund", weightPct: 12, severity: "flag" }]),
    riskReward: riskReward([{ ref: "SoundFund", sharpe: 0.5 }]),
    overlap: overlap([]),
  }));
  assert(c6b.decisions.find((d) => d.holding_ref === "SoundFund")?.exit_eligible === false, "C6b: thesis-negative alone (sharpe>=0) => NOT exit_eligible", "");
  // opaque with NO matched E6 -> thesis/cost sentinelled -> not eligible
  const c6c = computeA3(input({
    a2Output: a2Output([holding("Unmatched PMS", "discuss", [driver("wrapper_over_accumulation", "flag", "wrapper_over_accumulation")], { weightPct: 12, subCategory: "pms_equity" })]),
    metrics: metrics([{ instrument: "Unmatched PMS", weightPct: 12, severity: "flag" }]),
    overlap: overlap([]),
    evidence: evidence(), // no E6
  }));
  const d6c = c6c.decisions.find((d) => d.holding_ref === "Unmatched PMS");
  assert(d6c?.exit_eligible === false, "C6c: opaque with no matched E6 => NOT exit_eligible", "");
  assert(d6c?.signals.find((s) => s.dimension === "performance")?.status === "sentinelled", "C6c: performance sentinelled for opaque", "");

  // opaque with matched E6 (negative + complexity no), via a NAME-MISMATCH join
  // (Migration vs Strategy) -> exit-eligible. Tests the opaque gate AND the
  // token-overlap join the exact matcher would miss.
  const c6d = computeA3(input({
    a2Output: a2Output([holding("Motilal Oswal Value Migration PMS", "discuss", [driver("wrapper_over_accumulation", "flag", "wrapper_over_accumulation")], { weightPct: 12, subCategory: "pms_value" })]),
    metrics: metrics([{ instrument: "Motilal Oswal Value Migration PMS", weightPct: 12, severity: "flag" }]),
    overlap: overlap([]),
    evidence: evidenceWithE6([e6Eval("Motilal Oswal Value Strategy PMS", "negative", "no")]),
  }));
  const d6d = c6d.decisions.find((d) => /motilal/i.test(d.holding_ref));
  assert(d6d?.exit_eligible === true, "C6d: opaque E6 negative + complexity-no (name-mismatch join) => exit_eligible", JSON.stringify(d6d?.signals.map((s) => `${s.dimension}:${s.status}/${s.concern}`)));
  assert(/E6 overall_verdict negative/.test(d6d?.signals.find((s) => s.dimension === "thesis_quality")?.detail ?? ""), "C6d: token-overlap linked the holding to its E6 record (not sentinelled)", d6d?.signals.find((s) => s.dimension === "thesis_quality")?.detail ?? "");

  // opaque with matched E6 positive -> NOT eligible
  const c6e = computeA3(input({
    a2Output: a2Output([holding("Good PMS", "discuss", [], { weightPct: 12, subCategory: "pms_growth_quality" })]),
    metrics: metrics([{ instrument: "Good PMS", weightPct: 12, severity: "flag" }]),
    overlap: overlap([]),
    evidence: evidenceWithE6([e6Eval("Good PMS", "positive", "yes")]),
  }));
  assert(c6e.decisions.find((d) => d.holding_ref === "Good PMS")?.exit_eligible === false, "C6e: opaque E6 positive => NOT exit_eligible", "");

  // allocation instrument (FD) -> never exit-eligible (even when over-concentrated)
  const c6f = computeA3(input({
    a2Output: a2Output([holding("HDFC Bank FD", "review", [driver("position_over_concentration", "escalate", "position_concentration")], { weightPct: 27, assetClass: "Debt", subCategory: "bank_fd" })]),
    metrics: metrics([{ instrument: "HDFC Bank FD", weightPct: 27, severity: "escalate" }]),
    overlap: overlap([]),
  }));
  const d6f = c6f.decisions.find((d) => d.holding_ref === "HDFC Bank FD");
  assert(d6f?.holding_kind === "allocation", "C6f: FD classified as allocation", d6f?.holding_kind);
  assert(d6f?.exit_eligible === false, "C6f: allocation instrument never exit-eligible", "");
  assert(d6f?.decision === "trim", "C6f: over-concentrated FD still trims", d6f?.decision);

  // --- Case 7: sentinel routing for thin dimensions ---
  console.log("Case 7: thin-dimension sentinel routing");
  const sig = c6b.decisions.find((d) => d.holding_ref === "SoundFund")?.signals ?? [];
  assert(sig.find((s) => s.dimension === "cost_efficiency")?.status === "sentinelled", "C7: cost_efficiency sentinelled (no fee-vs-peer benchmark)", "");
  assert(sig.find((s) => s.dimension === "suitability")?.status === "sentinelled", "C7: suitability sentinelled (portfolio-level only)", "");
  assert(sig.find((s) => s.dimension === "redundancy")?.status === "sentinelled", "C7: redundancy sentinelled when no overlap pair", "");

  // --- Part B: fixture-driven ---
  const FIX = path.resolve(process.cwd(), "db", "fixtures", "cases");
  const SNAPSHOT_DATE: Record<string, string> = { t0_q2_2026: "2026-04-02" };
  const fixtures = ["c-2026-05-14-bhatt-01", "c-2026-05-15-menon-01", "c-2026-05-15-surana-01", "c-2026-05-15-iyengar-01", "c-2026-05-15-malhotra-01"];

  console.log("Case 8: overlap recompute present and well-formed for all 5 fixtures");
  for (const f of fixtures) {
    const fx = JSON.parse(await fs.readFile(path.join(FIX, `${f}.json`), "utf-8"));
    const holdings = HOLDINGS_BY_INVESTOR[fx.investorId];
    const snap = await loadSnapshot(fx.snapshotId);
    const ov = runPortfolioOverlapDeterministic({ caseId: fx.id, asOfDate: SNAPSHOT_DATE[fx.snapshotId], holdings, snapshot: snap, investor: {} });
    const wellFormed = ov.agent_id === "portfolio_overlap" && Array.isArray(ov.per_pair) && Array.isArray(ov.per_sleeve) && !!ov.portfolio && Array.isArray(ov.per_sleeve);
    assert(wellFormed, `C8: ${fx.investorId} overlap present and well-formed`, JSON.stringify(Object.keys(ov)));
  }

  console.log("Case 9: Surana Axis Large Cap is NOT exit-eligible (lands on trim)");
  const sf = JSON.parse(await fs.readFile(path.join(FIX, "c-2026-05-15-surana-01.json"), "utf-8"));
  const sc = sf.content;
  const sHoldings = HOLDINGS_BY_INVESTOR[sf.investorId];
  const sSnap = await loadSnapshot(sf.snapshotId);
  const sOverlap = runPortfolioOverlapDeterministic({ caseId: sf.id, asOfDate: "2026-04-02", holdings: sHoldings, snapshot: sSnap, investor: {} });
  const sPreObs = sc.metrics ? stitch({ caseMeta: { case_id: sf.id, investor_id: sf.investorId, investor_name: sf.investorId, as_of_date: "2026-04-02", case_mode: "diagnostic", bucket_tier: sc.metrics.concentration.bucketTier }, metrics: sc.metrics, evidence: sc.evidence, router_decision: (sc.router_decision ?? {}) as StitchInput["router_decision"], usage: {} }).pre_observations : [];
  const sa3 = computeA3({ caseId: sf.id, asOfDate: "2026-04-02", a2Output: sc.a2_classification, metrics: sc.metrics, preObservations: sPreObs, riskReward: sc.risk_reward_stats ?? null, overlap: sOverlap, evidence: sc.evidence ?? null, indianContext: null, operational: [], selection: null });
  const axis = sa3.decisions.find((d) => /axis/i.test(d.instrument_display_name));
  assert(!!axis, "C9: Axis decision present in Surana", "");
  if (axis) {
    const perf = axis.signals.find((s) => s.dimension === "performance");
    const thesis = axis.signals.find((s) => s.dimension === "thesis_quality");
    console.log(`     Axis: decision=${axis.decision} exit_eligible=${axis.exit_eligible} perf=${perf?.status}/${perf?.concern} thesis=${thesis?.status}/${thesis?.concern} | ${perf?.detail}`);
    assert(axis.exit_eligible === false, "C9: Axis NOT exit-eligible (one soft thesis signal, not a hard-corroborated convergence)", `perf concern=${perf?.concern}`);
    assert(axis.decision === "trim", "C9: Axis lands on trim", axis.decision);
  }

  console.log("Case 10: Motilal Oswal (bhatt) links to its E6 record via token overlap and is exit-eligible");
  const bf = JSON.parse(await fs.readFile(path.join(FIX, "c-2026-05-14-bhatt-01.json"), "utf-8"));
  const bc = bf.content;
  const bHoldings = HOLDINGS_BY_INVESTOR[bf.investorId];
  const bSnap = await loadSnapshot(bf.snapshotId);
  const bOverlap = runPortfolioOverlapDeterministic({ caseId: bf.id, asOfDate: "2026-04-02", holdings: bHoldings, snapshot: bSnap, investor: {} });
  const bPreObs = bc.metrics ? stitch({ caseMeta: { case_id: bf.id, investor_id: bf.investorId, investor_name: bf.investorId, as_of_date: "2026-04-02", case_mode: "diagnostic", bucket_tier: bc.metrics.concentration.bucketTier }, metrics: bc.metrics, evidence: bc.evidence, router_decision: (bc.router_decision ?? {}) as StitchInput["router_decision"], usage: {} }).pre_observations : [];
  const ba3 = computeA3({ caseId: bf.id, asOfDate: "2026-04-02", a2Output: bc.a2_classification, metrics: bc.metrics, preObservations: bPreObs, riskReward: bc.risk_reward_stats ?? null, overlap: bOverlap, evidence: bc.evidence ?? null, indianContext: null, operational: [], selection: null });
  const motilal = ba3.decisions.find((d) => /motilal/i.test(d.instrument_display_name));
  assert(!!motilal, "C10: Motilal decision present in bhatt", "");
  if (motilal) {
    const th = motilal.signals.find((s) => s.dimension === "thesis_quality");
    const cost = motilal.signals.find((s) => s.dimension === "cost_efficiency");
    console.log(`     Motilal: kind=${motilal.holding_kind} exit_eligible=${motilal.exit_eligible} thesis=${th?.status}/${th?.concern} (${th?.detail}) cost=${cost?.status}/${cost?.concern}`);
    assert(motilal.holding_kind === "opaque", "C10: Motilal classified opaque", motilal.holding_kind);
    assert(th?.status === "assessable", "C10: token-overlap linked Motilal to its E6 record (thesis assessable, not sentinelled)", th?.detail ?? "");
    assert(motilal.exit_eligible === true, "C10: Motilal exit-eligible (E6 negative verdict + complexity premium not earned)", `thesis concern=${th?.concern} cost concern=${cost?.concern}`);
  }

  // --- Case 11: operational metadata flows where matched; silent where not (Reading B) ---
  console.log("Case 11: operational metadata flows where matched, silent where not (Reading B + Kotak guard)");
  const bOps = buildOperationalScope(bHoldings, bSnap);
  const motilalOp = bOps.find((o) => /motilal/i.test(o.holding_ref));
  assert(!!motilalOp && motilalOp.kind === "pms", "C11: Motilal PMS operational present", JSON.stringify(motilalOp));
  assert(motilalOp?.effective_lock_in_years === 1, "C11: Motilal lock-in 1y flows through", String(motilalOp?.effective_lock_in_years));
  assert(!!motilalOp?.exit_load, "C11: Motilal exit-load (year-1 2%) flows through", JSON.stringify(motilalOp?.exit_load));
  for (const r of ["Avendus", "Marcellus", "White Oak", "Alchemy"]) {
    assert(!bOps.some((o) => o.holding_ref.toLowerCase().includes(r.toLowerCase())), `C11: ${r} stays silent (no consistent snapshot match, Reading B)`, "");
  }
  const sOps = buildOperationalScope(sHoldings, sSnap);
  assert(!sOps.some((o) => /kotak/i.test(o.holding_ref)), "C11: Kotak Emerging Equity silent (category guard rejects the overseas FoF)", JSON.stringify(sOps.map((o) => o.holding_ref)));
  assert(findConsistentMatch(sSnap, "mf_active_mid_cap", "Kotak Emerging Equity Fund") === null, "C11: findConsistentMatch returns null for Kotak (no category-consistent match)", "");

  // --- Case 12: M0 tax_matrix + SEBI context reaches A3; tax-structure resolver delivers correct tax ---
  console.log("Case 12: M0 tax + SEBI context, product-structure-scoped");
  const bhattTaxStruct = resolveA3TaxStructure("Family business · partnership firm");
  assert(bhattTaxStruct.structure_type === "individual", "C12: partnership-firm persona resolves to individual personal-portfolio tax structure (Finding 2 fix)", bhattTaxStruct.structure_type);
  const iyengarTaxStruct = resolveA3TaxStructure("Distribution · inherited corpus");
  assert(iyengarTaxStruct.structure_type === "individual", "C12: 'inherited corpus' does not mis-resolve to a company tax structure", iyengarTaxStruct.structure_type);
  const bFamilies = Array.from(new Set(bHoldings.holdings.map((h) => taxProductFamily(h.subCategory)).filter((f): f is A3TaxProductFamily => f !== null)));
  const bCtx = await buildA3IndianContext({ caseId: "v-bhatt", asOfDate: "2026-04-02", investorStructureLine: "Family business · partnership firm", productFamilies: bFamilies });
  const findBundle = (fam: string) => bCtx.tax_by_product.find((b) => b.product_family === fam);
  assert((findBundle("listed_equity")?.entries.some((e) => e.section === "capital_gains")) === true, "C12: listed-equity capital_gains tax flows for bhatt (not starved by structure mis-resolution)", JSON.stringify(findBundle("listed_equity")?.entries.map((e) => e.entry_id)));
  assert((findBundle("equity_mf")?.entries.some((e) => e.section === "mf_classification")) === true, "C12: equity-MF classification tax flows", "");
  assert((findBundle("pms")?.entries.some((e) => e.section === "pms_lookthrough")) === true, "C12: PMS look-through tax present", "");
  assert((findBundle("aif_cat_iii")?.entries.some((e) => e.section === "aif_passthrough")) === true, "C12: AIF Cat III pass-through tax present", "");
  assert(bCtx.sebi_minimums.some((m) => m.product === "pms") && bCtx.sebi_minimums.some((m) => m.product === "aif"), "C12: SEBI minimum-ticket rules present (pms + aif)", JSON.stringify(bCtx.sebi_minimums.map((m) => m.product)));
  assert(bCtx.tax_by_product.length === bFamilies.length, "C12: one tax bundle per product family present", `${bCtx.tax_by_product.length} vs ${bFamilies.length}`);

  // --- Case 13: AIF operational path proven against a real Cat III snapshot record + Reading-B NA-skip ---
  console.log("Case 13: AIF operational path (real Cat III record) + Reading-B NA-skip");
  const askHoldings: StructuredHoldings = {
    totalLiquidAumCr: 10,
    holdings: [{ instrument: "ASK Absolute Return Fund", assetClass: "Alternatives", subCategory: "aif_cat_iii_long_short", valueCr: 1, weightPct: 10 }],
  };
  const askOp = buildOperationalScope(askHoldings, bSnap)[0];
  assert(!!askOp && askOp.kind === "aif", "C13: ASK Absolute Return Fund (real Cat III) operational flows through", JSON.stringify(askOp));
  assert((askOp?.sebi_category ?? "").toUpperCase().includes("III"), "C13: AIF SEBI category (CAT III) flows", askOp?.sebi_category);
  assert(askOp?.min_commitment_cr === 1, "C13: AIF minimum commitment flows", String(askOp?.min_commitment_cr));
  assert(typeof askOp?.exit_redemption_terms === "string" && (askOp?.exit_redemption_terms?.length ?? 0) > 0, "C13: AIF redemption terms flow", askOp?.exit_redemption_terms);
  assert(typeof askOp?.structure === "string", "C13: AIF structure flows", askOp?.structure);
  assert(askOp?.fund_tenure === undefined && askOp?.tenure_extendable === undefined, "C13: Reading-B: snapshot 'NA' tenure fields are omitted, not surfaced", `tenure=${askOp?.fund_tenure} extendable=${askOp?.tenure_extendable}`);

  // --- Case 14 (Finding 5): per-investor mandate is the target source ---
  console.log("Case 14: per-investor mandate target (Iyengar conservative != flat aggressive)");
  const t0Snap = await loadSnapshot("t0_q2_2026");
  const iyMetricsMandate = computeMetrics(HOLDINGS_BY_INVESTOR.iyengar, t0Snap, { riskAppetite: "Conservative", liquidityTier: "Secondary" }, MANDATES_BY_INVESTOR.iyengar);
  const iyMetricsFlat = computeMetrics(HOLDINGS_BY_INVESTOR.iyengar, t0Snap, { riskAppetite: "Conservative", liquidityTier: "Secondary" }, null);
  assert(iyMetricsMandate.assetClass.Equity.targetPct === 35, "C14: Iyengar equity target is her conservative-mandate midpoint (25-45 -> 35)", String(iyMetricsMandate.assetClass.Equity.targetPct));
  assert(iyMetricsMandate.assetClass.Equity.targetPct !== iyMetricsFlat.assetClass.Equity.targetPct && iyMetricsFlat.assetClass.Equity.targetPct === 65, "C14: differs from the flat 65 aggressive target (fallback proves the wiring)", `${iyMetricsMandate.assetClass.Equity.targetPct} vs flat ${iyMetricsFlat.assetClass.Equity.targetPct}`);
  assert(iyMetricsMandate.assetClass.Debt.targetPct === 55 && iyMetricsMandate.assetClass.Debt.band[0] === 45 && iyMetricsMandate.assetClass.Debt.band[1] === 65, "C14: Iyengar debt target 55 with band 45-65 (her mandate, not flat 20-30)", JSON.stringify(iyMetricsMandate.assetClass.Debt));

  // --- Case 15 (Finding 5): cash excluded from concentration, gap modeling preserved ---
  console.log("Case 15: cash-as-funding (86% savings not flagged as over-concentration)");
  const menonMetrics = computeMetrics(HOLDINGS_BY_INVESTOR.menon, t0Snap, { riskAppetite: "Aggressive", liquidityTier: "Essential" }, MANDATES_BY_INVESTOR.menon);
  const cashFlagged = menonMetrics.concentration.positionFlags.some((f) => /savings/i.test(f.instrument));
  assert(!cashFlagged, "C15: Menon's 86.6% savings is NOT in positionFlags (cash excluded from concentration)", JSON.stringify(menonMetrics.concentration.positionFlags));
  assert(menonMetrics.cashDeployment.cashDragFlag === true && menonMetrics.cashDeployment.deploymentGapPct > 0, "C15: cashDeployment gap modeling preserved (cashDragFlag true, deploymentGapPct > 0)", JSON.stringify(menonMetrics.cashDeployment));

  // --- Case 16 (Finding 5): Menon end-to-end, cash funds deploy across all under-target sleeves ---
  console.log("Case 16: Menon cash-as-funding deploys across Equity/Debt/Alternatives, no cash trim");
  const menonA3 = computeA3({ caseId: "v-menon", asOfDate: "2026-04-02", a2Output: JSON.parse(await fs.readFile(path.join(FIX, "c-2026-05-15-menon-01.json"), "utf-8")).content.a2_classification, metrics: menonMetrics, preObservations: [], riskReward: null, overlap: null, evidence: null, indianContext: null, operational: [], selection: null });
  const menonCashTrim = menonA3.decisions.some((d) => d.asset_class === "Cash" && d.decision !== "maintain");
  assert(!menonCashTrim, "C16: no Cash holding is trimmed/exited (cash is funding, not a position)", JSON.stringify(menonA3.decisions.filter((d) => d.asset_class === "Cash").map((d) => d.decision)));
  if (menonA3.rebalance_proposal.kind === "proposal") {
    const mr = menonA3.rebalance_proposal.computed.redeployment;
    const ms = new Set(mr.deployments.map((d) => d.sleeve));
    assert(mr.cash_funding_pct > 0 && mr.freed_capital_pct === 0, "C16: funding is cash dry powder (cash_funding > 0, freed 0)", `${mr.freed_capital_pct}/${mr.cash_funding_pct}`);
    assert(ms.has("Equity") && ms.has("Debt") && ms.has("Alternatives"), "C16: deploys across all three under-target sleeves", JSON.stringify([...ms]));
    assert(!ms.has("Cash"), "C16: cash is never a deployment destination", "");
    const mDep = round1(mr.deployments.reduce((s, x) => s + x.add_pct_points, 0));
    assert(round1(mDep + mr.leftover_to_cash_pct) === round1(mr.freed_capital_pct + mr.cash_funding_pct), "C16: books close under cash-as-funding", `${mDep}+${mr.leftover_to_cash_pct} vs ${mr.freed_capital_pct}+${mr.cash_funding_pct}`);
  } else {
    assert(false, "C16: Menon produces a rebalance proposal", menonA3.rebalance_proposal.kind);
  }

  // --- Case 17 (Finding 5 completion, ADR-0032): explicit target_pct overrides midpoint ---
  console.log("Case 17: explicit mandate target_pct (Menon) overrides midpoint; others still midpoint");
  const menonBands = resolveTargetBands(MANDATES_BY_INVESTOR.menon);
  assert(
    menonBands.Equity.target === 65 && menonBands.Debt.target === 15 && menonBands.Alternatives.target === 15 && menonBands.Cash.target === 5,
    "C17: Menon resolves to explicit targets 65/15/15/5 (not the midpoints 62.5/22.5/12.5/6)",
    JSON.stringify({ Equity: menonBands.Equity.target, Debt: menonBands.Debt.target, Alt: menonBands.Alternatives.target, Cash: menonBands.Cash.target }),
  );
  assert(menonBands.Alternatives.min === 5 && menonBands.Alternatives.max === 20, "C17: Menon's bands are unchanged (Alt still 5-20, only the target is explicit)", JSON.stringify(menonBands.Alternatives));
  const surBands = resolveTargetBands(MANDATES_BY_INVESTOR.surana);
  assert(surBands.Equity.target === 65 && surBands.Alternatives.target === 7.5 && surBands.Cash.target === 3.5, "C17: Surana (no explicit target) still resolves via midpoint (Alt 5-10 -> 7.5, Cash 2-5 -> 3.5)", JSON.stringify(surBands));
  const iyBands = resolveTargetBands(MANDATES_BY_INVESTOR.iyengar);
  assert(iyBands.Equity.target === 35 && iyBands.Debt.target === 55, "C17: Iyengar (no explicit target) still resolves via midpoint (Equity 35, Debt 55)", JSON.stringify({ Equity: iyBands.Equity.target, Debt: iyBands.Debt.target }));

  // --- Finding 1: instrument-selection funnel ---
  console.log("Case 18: data-driven classification (no wrapper-type hard-code)");
  assert(classifyPmsSleeve("equity") === "Equity", "C18: PMS strategy_type 'equity' classifies Equity (from data)", classifyPmsSleeve("equity"));
  assert(classifyPmsSleeve("debt") === "Debt", "C18: a synthetic DEBT PMS classifies Debt, NOT hard-coded to equity", classifyPmsSleeve("debt"));
  assert(classifyPmsSleeve("long short") === "Alternatives", "C18: a long-short PMS classifies Alternatives", classifyPmsSleeve("long short"));
  assert(classifyMfSleeve("Gilt Fund") === "Debt" && classifyMfSleeve("Small Cap Fund") === "Equity" && classifyMfSleeve("ETFs- Commodity") === "Alternatives", "C18: MF sebi_category classifies to the right sleeve from data", "");

  console.log("Case 19: framework resolves by risk tier + horizon, never-zero core at both levels");
  const consFw = resolveFramework("Conservative", "3-5y operational");
  const aggrFw = resolveFramework("Aggressive", "Over 5y");
  assert(consFw.equity.international_pct === 10 && consFw.equity.domestic_large_pct === 75 && consFw.equity.domestic_mid_pct === 20 && consFw.equity.domestic_small_pct === 5, "C19: Conservative equity 10 intl / 75-20-5 domestic", JSON.stringify(consFw.equity));
  assert(aggrFw.equity.international_pct === 20 && aggrFw.equity.domestic_large_pct === 35 && aggrFw.equity.domestic_mid_pct === 40 && aggrFw.equity.domestic_small_pct === 25, "C19: Aggressive equity 20 intl / 35-40-25 domestic (large core never zero)", JSON.stringify(aggrFw.equity));
  assert(consFw.equity.international_pct > 0 && aggrFw.equity.domestic_large_pct > 0 && consFw.equity.domestic_small_pct > 0, "C19: never-zero core, intl and domestic-large both non-zero every tier", "");
  assert(aggrFw.debt_credit.sovereign_pct === 25 && aggrFw.debt_credit.high_grade_pct === 55 && aggrFw.debt_credit.credit_risk_pct === 20 && (aggrFw.debt_credit.sovereign_pct + aggrFw.debt_credit.high_grade_pct) >= 80, "C19: aggressive debt 25/55/20, still 80% sovereign+high-grade (ballast)", JSON.stringify(aggrFw.debt_credit));
  assert(consFw.debt_duration === "medium" && aggrFw.debt_duration === "long", "C19: duration by horizon (Iyengar medium-horizon -> medium; long -> long)", `${consFw.debt_duration}/${aggrFw.debt_duration}`);

  const universe = buildInstrumentUniverse(t0Snap);
  console.log("Case 20: equity two-level plan resolves with never-zero buckets + funnel shortlists");
  // Aggressive investor (Menon-like), equity target 65, deploy 58.4 pts.
  const eqp = buildEquityPlan(58.4, 65, aggrFw, HOLDINGS_BY_INVESTOR.menon, universe, HOLDINGS_BY_INVESTOR.menon.totalLiquidAumCr);
  const bkt = (b: string) => eqp.sub_buckets.find((x) => x.bucket === b)!;
  assert(eqp.sub_buckets.length === 4 && bkt("international").target_pct > 0 && bkt("domestic_large").target_pct > 0, "C20: four equity sub-buckets, international and domestic-large targets non-zero", JSON.stringify(eqp.sub_buckets.map((b) => `${b.bucket}:${b.target_pct}`)));
  assert(bkt("international").shortlist.surfaced.length > 0 && bkt("domestic_mid").shortlist.surfaced.length > 0, "C20: international + domestic-mid sub-buckets get funnel shortlists", "");
  assert(bkt("domestic_mid").shortlist.surfaced.every((c: SelectionCandidate) => c.ter_pct !== null && c.sharpe_3y !== null), "C20: surfaced candidates carry cited metrics", "");
  assert(eqp.diversified_option.surfaced.length > 0, "C20: flexi/multi offered as a distinct diversified-equity option (not excluded)", "");

  console.log("Case 21: flexi look-through decomposes + retains identity; international residual counted");
  const ppfas = HOLDINGS_BY_INVESTOR.surana.holdings.find((h) => /parag parikh/i.test(h.instrument))!;
  const decomp = decomposeHeldEquity(ppfas, universe);
  assert(decomp.composition_source === "snapshot" && decomp.international_pct > 0, "C21: Parag Parikh decomposed from real composition with a non-zero international residual", JSON.stringify(decomp));
  assert(/flexi/i.test(decomp.type_label), "C21: retains its flexi-cap type-identity in the label", decomp.type_label);
  // Residual counting: Surana's international current (PPFAS residual + Vanguard ETF) must be > 0, so he is not double-allocated.
  const suFw = aggrFw;
  const suEq = buildEquityPlan(20, 65, suFw, HOLDINGS_BY_INVESTOR.surana, universe, HOLDINGS_BY_INVESTOR.surana.totalLiquidAumCr);
  assert(suEq.sub_buckets.find((b) => b.bucket === "international")!.current_pct > 0, "C21: Surana's existing international (PPFAS residual + Vanguard) counts toward the international target (no double-allocate)", String(suEq.sub_buckets.find((b) => b.bucket === "international")!.current_pct));

  console.log("Case 22: deterministic decline for a composition-missing flexi (C-LLM-now DEFERRED, ADR-0038)");
  // Synthetic flexi holding whose name matches no snapshot record -> composition missing -> decline.
  const synthFlexi = { instrument: "Nonexistent Flexi Cap Fund XYZ", assetClass: "Equity" as const, subCategory: "mf_active_flexi_cap" as const, valueCr: 1, weightPct: 10 };
  const declined = decomposeHeldEquity(synthFlexi, universe);
  assert(declined.composition_source === "declined" && /advisor-select/i.test(declined.type_label), "C22: a composition-missing flexi declines to advisor-select, no fabricated split (ADR-0038 deferred)", JSON.stringify(declined));

  console.log("Case 23: 2D debt placement, credit + duration via category-primary + metric-secondary");
  const gilt = { fund_name: "X Gilt", source: "mf" as const, sub_category: "Gilt Fund", ter_pct: 0.5, aum_cr: 1000, age_years: 5, sharpe_3y: 1, sortino_3y: 1, calmar_3y: 1, return_3y: 7, duration_y: 8, aaa_pct: null, sov_pct: 95 };
  const corp = { fund_name: "X Corp", source: "mf" as const, sub_category: "Corporate Bond Fund", ter_pct: 0.5, aum_cr: 1000, age_years: 5, sharpe_3y: 1, sortino_3y: 1, calmar_3y: 1, return_3y: 7, duration_y: 2.5, aaa_pct: 85, sov_pct: 17 };
  const shortDurHi = { fund_name: "X ShortHi", source: "mf" as const, sub_category: "Short Duration Fund", ter_pct: 0.5, aum_cr: 1000, age_years: 5, sharpe_3y: 1, sortino_3y: 1, calmar_3y: 1, return_3y: 7, duration_y: 2.2, aaa_pct: 85, sov_pct: 0 };
  const shortDurLo = { fund_name: "X ShortLo", source: "mf" as const, sub_category: "Short Duration Fund", ter_pct: 0.5, aum_cr: 1000, age_years: 5, sharpe_3y: 1, sortino_3y: 1, calmar_3y: 1, return_3y: 7, duration_y: 2.2, aaa_pct: 55, sov_pct: 0 };
  assert(creditBucketOf(gilt) === "sovereign" && durationBucketOf(gilt) === "long", "C23: gilt -> sovereign by category (no metric test), long duration by the 8y metric", `${creditBucketOf(gilt)}/${durationBucketOf(gilt)}`);
  assert(creditBucketOf(corp) === "high_grade" && durationBucketOf(corp) === "short", "C23: Corporate Bond -> high-grade by category, short by the 2.5y metric", `${creditBucketOf(corp)}/${durationBucketOf(corp)}`);
  assert(creditBucketOf(shortDurHi) === "high_grade" && creditBucketOf(shortDurLo) === "credit_risk", "C23: a duration-category fund's credit from SOV%+AAA% (sov 0, aaa 85 -> high-grade; sov 0, aaa 55 -> credit-risk; the 70 cutoff)", `${creditBucketOf(shortDurHi)}/${creditBucketOf(shortDurLo)}`);

  console.log("Case 24: alternatives split (under-5 gold-only; 5+ gold + non-gold advisor-select)");
  const altLow = buildAlternativesPlan(3, universe);
  const altHigh = buildAlternativesPlan(15, universe);
  assert(altLow.gold_pct === 3 && altLow.non_gold_aif_pct === 0 && altLow.non_gold_advisor_select === null, "C24: under 5% alt -> gold only", JSON.stringify(altLow));
  assert(altHigh.gold_pct === 5 && altHigh.non_gold_aif_pct === 10 && altHigh.non_gold_advisor_select !== null, "C24: 5%+ alt -> 5 gold + non-gold AIF advisor-select", JSON.stringify({ gold: altHigh.gold_pct, nonGold: altHigh.non_gold_aif_pct }));
  assert(altHigh.gold_shortlist.surfaced.length > 0, "C24: gold deployable via commodity ETFs", String(altHigh.gold_shortlist.surfaced.length));

  console.log("Case 25: Menon end-to-end (cash funds two-level equity + 2D debt instruments)");
  const menonFw = resolveFramework("Aggressive", "Over 5y", MANDATES_BY_INVESTOR.menon.sub_sleeve_tilt);
  const menonRedep = JSON.parse(await fs.readFile(path.join(FIX, "c-2026-05-15-menon-01.json"), "utf-8")).content.a3_so_what.rebalance_proposal.computed.redeployment;
  const menonPlan = buildDeploymentPlan({ deployments: menonRedep.deployments, holdings: HOLDINGS_BY_INVESTOR.menon, universe, framework: menonFw, liquidAumCr: HOLDINGS_BY_INVESTOR.menon.totalLiquidAumCr });
  const mEq = menonPlan.find((p) => p.sleeve === "Equity");
  const mDebt = menonPlan.find((p) => p.sleeve === "Debt");
  const mAlt = menonPlan.find((p) => p.sleeve === "Alternatives");
  assert(!!mEq?.equity && mEq.equity.sub_buckets.some((b) => b.bucket === "international" && b.deploy_pct > 0) && mEq.equity.sub_buckets.some((b) => b.bucket === "domestic_large" && b.deploy_pct > 0), "C25: Menon equity deploys to international AND a domestic large-cap core (two-level)", JSON.stringify(mEq?.equity?.sub_buckets.map((b) => `${b.bucket}:${b.deploy_pct}`)));
  assert(!!mDebt?.debt && mDebt.debt.credit_buckets.length === 3 && mDebt.debt.target_duration === "long" && mDebt.debt.credit_buckets.every((b) => b.deploy_pct >= 0), "C25: Menon debt placed across 3 credit buckets at long duration (his horizon)", JSON.stringify({ dur: mDebt?.debt?.target_duration, buckets: mDebt?.debt?.credit_buckets.map((b) => `${b.bucket}:${b.deploy_pct}`) }));
  assert(!!mAlt?.alternatives && mAlt.alternatives.gold_pct === 5 && (mAlt.alternatives.non_gold_aif_pct ?? 0) > 0 && mAlt.alternatives.non_gold_advisor_select !== null, "C25: Menon 15% alt -> 5 gold + non-gold AIF advisor-select (not forced gold)", "");

  console.log("Case 26: L1 SOV-aware credit read (sovereign-heavy duration funds out of credit_risk)");
  // Synthetic shapes for the rule itself.
  const sovNoAaa = { fund_name: "X LongSov", source: "mf" as const, sub_category: "Long Duration Fund", ter_pct: 0.5, aum_cr: 1000, age_years: 5, sharpe_3y: 1, sortino_3y: 1, calmar_3y: 1, return_3y: 7, duration_y: 11, aaa_pct: null, sov_pct: 96 };
  const sovHeavyLowAaa = { fund_name: "X Income", source: "mf" as const, sub_category: "Medium to Long Duration Fund", ter_pct: 0.9, aum_cr: 1000, age_years: 5, sharpe_3y: 1, sortino_3y: 1, calmar_3y: 1, return_3y: 7, duration_y: 6.5, aaa_pct: 34, sov_pct: 61 };
  const genuineCredit = { fund_name: "X Credity", source: "mf" as const, sub_category: "Medium Duration Fund", ter_pct: 1.2, aum_cr: 1000, age_years: 5, sharpe_3y: 1, sortino_3y: 1, calmar_3y: 1, return_3y: 7, duration_y: 4, aaa_pct: 20, sov_pct: 10 };
  assert(creditBucketOf(sovNoAaa) === "sovereign", "C26: a no-AAA% sovereign-heavy long fund (SOV 96) -> sovereign, not credit_risk", creditBucketOf(sovNoAaa));
  assert(creditBucketOf(sovHeavyLowAaa) === "high_grade", "C26: a low-AAA% sovereign-heavy fund (SOV 61 + AAA 34 = 95) -> high_grade, not credit_risk", creditBucketOf(sovHeavyLowAaa));
  assert(creditBucketOf(genuineCredit) === "credit_risk", "C26: a genuinely sub-AAA fund (SOV 10 + AAA 20 = 30) -> credit_risk", creditBucketOf(genuineCredit));
  // Real data: the three long-duration G-sec funds out of credit_risk; ABSL/HDFC Income high_grade not credit_risk.
  const findDebt = (re: RegExp) => universe.debt_funds.filter((c) => re.test(c.fund_name)).map((c) => `${c.fund_name.slice(0, 28)}=${creditBucketOf(c)}`);
  const longSovs = universe.debt_funds.filter((c) => /nivesh lakshya|sbi long duration|hdfc long duration/i.test(c.fund_name));
  assert(longSovs.length >= 3 && longSovs.every((c) => creditBucketOf(c) !== "credit_risk"), "C26: the 3 long-duration G-sec funds are no longer credit_risk (now sovereign/high-grade)", JSON.stringify(findDebt(/nivesh lakshya|sbi long duration|hdfc long duration/i)));
  const incomeFunds = universe.debt_funds.filter((c) => /aditya birla sun life income fund|hdfc income fund/i.test(c.fund_name));
  assert(incomeFunds.length >= 1 && incomeFunds.every((c) => creditBucketOf(c) === "high_grade"), "C26: ABSL/HDFC Income (~95% sovereign+AAA) classify high_grade, out of the credit_risk shortlist", JSON.stringify(findDebt(/aditya birla sun life income fund|hdfc income fund/i)));

  console.log("Case 27: L2 hybrid debt-residual counted as debt, not international");
  const iyHybrid = HOLDINGS_BY_INVESTOR.iyengar.holdings.find((h) => /balanced advantage/i.test(h.instrument))!;
  const hybridDecomp = decomposeHeldEquity(iyHybrid, universe);
  assert(hybridDecomp.international_pct === 0 && (hybridDecomp.domestic_large_pct + hybridDecomp.domestic_mid_pct + hybridDecomp.domestic_small_pct) > 0, "C27: a hybrid's residual is debt (international = 0), domestic cap retained", JSON.stringify(hybridDecomp));
  assert(/hybrid/i.test(hybridDecomp.type_label), "C27: the hybrid is labelled as such (debt residual excluded), not flexi", hybridDecomp.type_label);

  console.log("Case 28: L3 passive index classified by what it tracks, never declined");
  const iyIndex = HOLDINGS_BY_INVESTOR.iyengar.holdings.find((h) => /index fund nifty 50/i.test(h.instrument))!;
  const indexDecomp = decomposeHeldEquity(iyIndex, universe);
  assert(indexDecomp.composition_source !== "declined" && indexDecomp.domestic_large_pct > 0, "C28: a Nifty 50 passive index classifies large-cap, not declined", JSON.stringify(indexDecomp));
  const synthMidIdx = { instrument: "XYZ Nifty Midcap 150 Index Fund", assetClass: "Equity" as const, subCategory: "mf_passive_index" as const, valueCr: 1, weightPct: 10 };
  const midIdxDecomp = decomposeHeldEquity(synthMidIdx, universe);
  assert(midIdxDecomp.domestic_mid_pct > 0 && midIdxDecomp.composition_source !== "declined", "C28: a midcap index tracker classifies mid-cap", JSON.stringify(midIdxDecomp));

  console.log("Case 29: C1 diversified-equity candidates extend beyond flexi/multi");
  assert(!!mEq?.equity && mEq.equity.diversified_option.eligible_count > 72 && /large-and-mid|ELSS|value/i.test(mEq.equity.diversified_option.label), "C29: diversified candidates include Large & Mid / ELSS / Value / Contra / Dividend Yield (pool > flexi-only 72)", JSON.stringify({ count: mEq?.equity?.diversified_option.eligible_count, label: mEq?.equity?.diversified_option.label }));

  console.log("");
  if (failures.length) {
    console.error(`A3 verify FAILED: ${failures.length} assertion(s):\n  - ${failures.join("\n  - ")}`);
    process.exit(1);
  }
  console.log("A3 verify: all assertions passed.");
})();
