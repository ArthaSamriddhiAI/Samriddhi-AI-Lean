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
import { MODEL_BANDS } from "@/lib/agents/portfolio-risk-analytics";
import type { RiskRewardOutput } from "@/lib/agents/risk-reward-stats";
import { runPortfolioOverlapDeterministic, type PortfolioOverlapOutput } from "@/lib/agents/portfolio-overlap";
import { stitch, type EvidenceBundle, type StitchInput } from "@/lib/agents/stitcher";
import { loadSnapshot } from "@/lib/agents/snapshot-loader";
import { HOLDINGS_BY_INVESTOR } from "@/db/fixtures/structured-holdings";
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
    riskReward: null, overlap: null, evidence: null, ...partial,
  };
}
function decision(d: "trim" | "exit" | "maintain", weight: number): A3ReconciledDecision {
  return { holding_ref: "x", instrument_display_name: "x", asset_class: "Equity", sub_category: "listed_equity", weight_pct: weight, holding_kind: "transparent", over_concentrated: weight > 10, a2_verdict: "review", signals: [], exit_eligible: false, decision: d, dimensions_failing: [], exit_rationale: "", judgment_reasoning: "" } as A3ReconciledDecision;
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

  // --- Case 3: redeployment closure ---
  console.log("Case 3: redeployment closure");
  // freed 8.4 (trim 18.4->10), Debt under by 5, Alternatives under by 4 (capacity 9 > 8.4 -> all deployed)
  const m3 = metrics([], { Equity: 70, Debt: 20, Alternatives: 3, Cash: 7 });
  const r3 = computeRedeployment([decision("trim", 18.4)], m3);
  const deployed3 = r3.deployments.reduce((s, x) => s + x.add_pct_points, 0);
  assert(r3.freed_capital_pct === 8.4, "C3: freed 8.4", String(r3.freed_capital_pct));
  assert(round1(deployed3 + r3.leftover_to_cash_pct) === r3.freed_capital_pct, "C3: freed == deployed + leftover", `${deployed3}+${r3.leftover_to_cash_pct} vs ${r3.freed_capital_pct}`);
  assert(r3.leftover_to_cash_pct === 0, "C3: nothing left to cash (capacity exceeds freed)", String(r3.leftover_to_cash_pct));
  assert(r3.deployments.every((d) => d.sleeve !== "Cash"), "C3: cash is never a deployment destination", "");

  // freed exceeds capacity -> leftover to cash
  console.log("Case 4: redeployment leftover-to-cash (freed exceeds capacity)");
  const m4 = metrics([], { Equity: 64, Debt: 24, Alternatives: 6, Cash: 6 }); // gaps: Eq1, Debt1, Alt1 = 3 capacity
  const r4 = computeRedeployment([decision("exit", 20)], m4); // exit frees 20
  const deployed4 = r4.deployments.reduce((s, x) => s + x.add_pct_points, 0);
  assert(r4.freed_capital_pct === 20, "C4: exit frees full weight 20", String(r4.freed_capital_pct));
  assert(round1(deployed4) === 3 && r4.leftover_to_cash_pct === 17, "C4: 3 deployed to capacity, 17 leftover", `${deployed4}/${r4.leftover_to_cash_pct}`);
  assert(round1(deployed4 + r4.leftover_to_cash_pct) === r4.freed_capital_pct, "C4: closure holds", "");

  // no underweight sleeve -> all leftover
  console.log("Case 5: redeployment no-underweight (all to cash)");
  const m5 = metrics([], { Equity: 70, Debt: 30, Alternatives: 10, Cash: 3 });
  const r5 = computeRedeployment([decision("trim", 15)], m5); // freed 5
  assert(r5.freed_capital_pct === 5 && r5.deployments.length === 0 && r5.leftover_to_cash_pct === 5, "C5: no underweight sleeve, all 5 to cash", JSON.stringify(r5));

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
  const sa3 = computeA3({ caseId: sf.id, asOfDate: "2026-04-02", a2Output: sc.a2_classification, metrics: sc.metrics, preObservations: sPreObs, riskReward: sc.risk_reward_stats ?? null, overlap: sOverlap, evidence: sc.evidence ?? null });
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
  const ba3 = computeA3({ caseId: bf.id, asOfDate: "2026-04-02", a2Output: bc.a2_classification, metrics: bc.metrics, preObservations: bPreObs, riskReward: bc.risk_reward_stats ?? null, overlap: bOverlap, evidence: bc.evidence ?? null });
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

  console.log("");
  if (failures.length) {
    console.error(`A3 verify FAILED: ${failures.length} assertion(s):\n  - ${failures.join("\n  - ")}`);
    process.exit(1);
  }
  console.log("A3 verify: all assertions passed.");
})();
