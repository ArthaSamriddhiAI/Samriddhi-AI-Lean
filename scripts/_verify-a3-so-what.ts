/* Deterministic verification for A3.so_what (T-5.12). No API.
 *
 * Exercises A3 Layer 1 (computeA3) and the no-LLM orchestration path of
 * runA3Diagnostic against synthetic, minimal inputs (WA15). Asserts the
 * glide-path math, the three-surface construction, sentinel routing, the
 * honest-8 observation set (with sector pulled from A2 drivers), severity
 * dedup, and the all-clear skip path (which makes no Claude call). The
 * recommendatory advisor-action prose is Layer 2 and is exercised under the
 * WA12-gated live verify, not here.
 *
 * Run: npx tsx scripts/_verify-a3-so-what.ts  (exits non-zero on failure).
 */
import { computeA3, runA3Diagnostic, type A3Input } from "@/lib/agents/a3-so-what";
import type { A2Output, A2HoldingVerdict, A2Verdict, A2Driver } from "@/lib/agents/a2-classification";
import type { PortfolioMetrics } from "@/lib/agents/portfolio-risk-analytics";
import type { PreObservation } from "@/lib/agents/stitcher";

const failures: string[] = [];
function assert(cond: boolean, name: string, detail = ""): void {
  if (!cond) failures.push(name);
  console.log(`  [${cond ? "PASS" : "FAIL"}] ${name}${cond ? "" : ` :: ${detail}`}`);
}

/* ----- Builders ----- */

function driver(source_observation: string, severity: A2Driver["severity"], driver_type: A2Driver["driver_type"]): A2Driver {
  return { driver_type, severity, scope: "holding", source_observation, reason: "" };
}

function holding(
  ref: string,
  verdict: A2Verdict,
  drivers: A2Driver[],
): A2HoldingVerdict {
  return {
    holding_ref: ref,
    instrument_display_name: ref,
    asset_class: "Equity",
    sub_category: "listed_equity",
    weight_pct: 10,
    verdict,
    drivers,
  };
}

function a2Output(holding_verdicts: A2HoldingVerdict[]): A2Output {
  return {
    agent_id: "a2_classification",
    case_id: "verify-a3",
    as_of_date: "2026-04-30",
    holding_verdicts,
    summary: {
      maintain_count: 0,
      monitor_count: 0,
      discuss_count: 0,
      review_count: 0,
      unable_to_classify_count: 0,
      one_line_characterization: "x",
    },
    reasoning_summary: "x",
  };
}

function metrics(
  positionFlags: Array<{ instrument: string; weightPct: number; severity: "flag" | "escalate" }>,
): PortfolioMetrics {
  const cls = { actualPct: 0, targetPct: 0, band: [0, 0] as [number, number], deviationPct: 0, inBand: true };
  return {
    totalLiquidAumCr: 10,
    holdingsCount: positionFlags.length,
    assetClass: { Equity: cls, Debt: cls, Alternatives: cls, Cash: cls },
    concentration: {
      hhiHoldingLevel: 0,
      hhiAssetClassLevel: 0,
      top1: { instrument: "", weightPct: 0 },
      top5: [],
      bucketCeilingHhi: 0,
      bucketTier: "Aggressive",
      hhiBreach: false,
      positionFlags,
      wrappers: {
        pmsCount: 0, pmsAggregatePct: 0, pmsList: [],
        aifCount: 0, aifAggregatePct: 0, aifList: [],
        wrapperCountFlag: false, wrapperShareFlag: false,
      },
      sectorExposureMfLookThrough: [],
      mfCoverage: { coveredCount: 0, uncoveredCount: 0, coveredWeightPct: 0, uncoveredWeightPct: 0 },
    },
    liquidity: {
      bucketBreakdown: { T_30: 0, T_90: 0, T_365: 0, Locked: 0 },
      t30PlusT90Pct: 0,
      tier: "secondary",
      tierFloor: { minPct: 0, maxPct: 0 },
      floorBreach: false,
    },
    cashDeployment: { cashSharePct: 0, deploymentGapPct: 0, cashDragFlag: false },
    computedAt: "",
  };
}

function preObs(vocab_candidate: string, severity_hint: PreObservation["severity_hint"]): PreObservation {
  return { vocab_candidate, source: "metric", severity_hint, payload: {} };
}

(async () => {
  // --- Case 1: glide-path math, escalate position 18.4% over two steps ---
  console.log("Case 1: glide-path math (Reliance 18.4% escalate)");
  const c1 = computeA3({
    caseId: "c1",
    asOfDate: "2026-04-30",
    a2Output: a2Output([
      holding("Reliance Industries", "review", [driver("position_over_concentration", "escalate", "position_concentration")]),
    ]),
    metrics: metrics([{ instrument: "Reliance Industries", weightPct: 18.4, severity: "escalate" }]),
    preObservations: [
      preObs("position_over_concentration", "flag"),
      preObs("position_over_concentration", "escalate"),
    ],
  });
  const reb1 = c1.rebalance_proposal;
  assert(reb1.kind === "proposal", "C1: rebalance is a proposal", `got ${reb1.kind}`);
  if (reb1.kind === "proposal") {
    const p = reb1.computed.positions[0];
    assert(p.current_weight_pct === 18.4, "C1: current 18.4", `got ${p.current_weight_pct}`);
    assert(p.breach_threshold_pct === 15, "C1: breach threshold 15 (escalate)", `got ${p.breach_threshold_pct}`);
    assert(p.target_weight_pct === 10, "C1: target 10", `got ${p.target_weight_pct}`);
    assert(p.total_trim_pct_points === 8.4, "C1: total trim 8.4", `got ${p.total_trim_pct_points}`);
    assert(p.glide_path.length === 2, "C1: two steps (ceil 8.4/5)", `got ${p.glide_path.length}`);
    assert(p.glide_path[0].step === 1 && p.glide_path[0].trim_pct_points === 4.2 && p.glide_path[0].resulting_weight_pct === 14.2 && p.glide_path[0].trigger_at_weight_pct === 18.4, "C1: step 1 = trim 4.2 -> 14.2, trigger 18.4", JSON.stringify(p.glide_path[0]));
    assert(p.glide_path[1].step === 2 && p.glide_path[1].trim_pct_points === 4.2 && p.glide_path[1].resulting_weight_pct === 10 && p.glide_path[1].trigger_at_weight_pct === 14.2, "C1: step 2 = trim 4.2 -> 10, trigger 14.2", JSON.stringify(p.glide_path[1]));
    assert(p.glide_path[p.glide_path.length - 1].resulting_weight_pct === 10, "C1: last step lands exactly on target", `got ${p.glide_path[p.glide_path.length - 1].resulting_weight_pct}`);
  }
  // honest-8 dedup: two position_over_concentration pre-obs collapse to one, max severity escalate
  const posObs = c1.observation_actions.filter((o) => o.observation_category === "position_over_concentration");
  assert(posObs.length === 1, "C1: position_over_concentration deduped to one observation", `got ${posObs.length}`);
  assert(posObs[0]?.severity_hint === "escalate", "C1: dedup keeps max severity (escalate)", `got ${posObs[0]?.severity_hint}`);
  // holding action
  assert(c1.holding_actions.length === 1 && c1.holding_actions[0].kind === "action", "C1: one holding action", JSON.stringify(c1.holding_actions.map((h) => h.kind)));
  const ha1 = c1.holding_actions[0];
  assert(ha1.a2_verdict === "review", "C1: holding action carries Review verdict", `got ${ha1.a2_verdict}`);
  assert(ha1.kind === "action" && ha1.source_observation === "position_over_concentration", "C1: source_observation linked", JSON.stringify(ha1));

  // --- Case 2: flag position 12.0% over a single step ---
  console.log("Case 2: single-step trim (12.0% flag)");
  const c2 = computeA3({
    caseId: "c2",
    asOfDate: "2026-04-30",
    a2Output: a2Output([holding("HDFC Bank", "discuss", [driver("position_over_concentration", "flag", "position_concentration")])]),
    metrics: metrics([{ instrument: "HDFC Bank", weightPct: 12.0, severity: "flag" }]),
    preObservations: [preObs("position_over_concentration", "flag")],
  });
  const reb2 = c2.rebalance_proposal;
  assert(reb2.kind === "proposal", "C2: proposal", `got ${reb2.kind}`);
  if (reb2.kind === "proposal") {
    const p = reb2.computed.positions[0];
    assert(p.breach_threshold_pct === 10, "C2: breach threshold 10 (flag)", `got ${p.breach_threshold_pct}`);
    assert(p.total_trim_pct_points === 2, "C2: total trim 2.0", `got ${p.total_trim_pct_points}`);
    assert(p.glide_path.length === 1, "C2: one step (ceil 2/5)", `got ${p.glide_path.length}`);
    assert(p.glide_path[0].resulting_weight_pct === 10 && p.glide_path[0].trim_pct_points === 2 && p.glide_path[0].trigger_at_weight_pct === 12, "C2: step 1 = trim 2 -> 10, trigger 12", JSON.stringify(p.glide_path[0]));
  }

  // --- Case 3: no breach -> no_action_needed (position at exactly target, and empty) ---
  console.log("Case 3: no concentration breach");
  const c3 = computeA3({
    caseId: "c3",
    asOfDate: "2026-04-30",
    a2Output: a2Output([holding("At Target Co", "monitor", [driver("allocation_drift", "watch", "allocation_drift")])]),
    metrics: metrics([{ instrument: "At Target Co", weightPct: 10.0, severity: "flag" }]),
    preObservations: [],
  });
  assert(c3.rebalance_proposal.kind === "no_action_needed", "C3: at-target position yields no_action_needed", `got ${c3.rebalance_proposal.kind}`);
  const c3b = computeA3({ caseId: "c3b", asOfDate: "2026-04-30", a2Output: a2Output([]), metrics: metrics([]), preObservations: [] });
  assert(c3b.rebalance_proposal.kind === "no_action_needed", "C3b: empty positionFlags yields no_action_needed", `got ${c3b.rebalance_proposal.kind}`);

  // --- Case 4: metrics absent -> rebalance sentinel ---
  console.log("Case 4: metrics absent");
  const c4 = computeA3({ caseId: "c4", asOfDate: "2026-04-30", a2Output: a2Output([]), metrics: null, preObservations: [] });
  assert(c4.rebalance_proposal.kind === "sentinel", "C4: null metrics yields sentinel", `got ${c4.rebalance_proposal.kind}`);
  if (c4.rebalance_proposal.kind === "sentinel") {
    assert(c4.rebalance_proposal.sentinel_reason === "upstream_evidence_unavailable", "C4: sentinel reason upstream_evidence_unavailable", c4.rebalance_proposal.sentinel_reason);
  }

  // --- Case 5: holding filtering, sentinel routing, sector pulled from A2 drivers ---
  console.log("Case 5: holding surface filtering + sector observation from A2");
  const c5 = computeA3({
    caseId: "c5",
    asOfDate: "2026-04-30",
    a2Output: a2Output([
      holding("Maintain Co", "maintain", []),
      holding("Monitor Co", "monitor", [driver("allocation_drift", "watch", "allocation_drift")]),
      holding("Unknown Co", "unable_to_classify", [driver("evidence_unavailable: missing", "flag", "evidence_unavailable")]),
      holding("Bank A", "discuss", [driver("sector_over_concentration", "flag", "sector_concentration")]),
    ]),
    metrics: metrics([]),
    preObservations: [preObs("cash_drag", "flag"), preObs("allocation_drift", "info")],
  });
  assert(c5.holding_actions.length === 3, "C5: Maintain excluded, 3 holding actions", `got ${c5.holding_actions.length}`);
  const sentinels = c5.holding_actions.filter((h) => h.kind === "sentinel");
  assert(sentinels.length === 1 && sentinels[0].holding_ref === "Unknown Co", "C5: unable_to_classify routes to sentinel", JSON.stringify(sentinels.map((s) => s.holding_ref)));
  // sector_over_concentration pulled from A2 driver; cash_drag + allocation_drift from pre-obs; honest-8 order
  const cats = c5.observation_actions.map((o) => o.observation_category);
  assert(cats.includes("sector_over_concentration"), "C5: sector_over_concentration pulled from A2 drivers", cats.join(","));
  assert(cats.includes("cash_drag") && cats.includes("allocation_drift"), "C5: cash_drag and allocation_drift from pre-observations", cats.join(","));
  assert(cats.indexOf("sector_over_concentration") < cats.indexOf("cash_drag"), "C5: observation order follows the honest-8 declaration", cats.join(","));

  // --- Case 6: all-clear skip path makes no Claude call ---
  console.log("Case 6: all-clear skip path (no LLM call)");
  const input6: A3Input = { caseId: "c6", asOfDate: "2026-04-30", a2Output: a2Output([holding("Healthy Co", "maintain", [])]), metrics: metrics([]), preObservations: [] };
  const r6 = await runA3Diagnostic(input6);
  assert(r6.usage.inputTokens === 0 && r6.usage.outputTokens === 0, "C6: no token spend on the all-clear path", JSON.stringify(r6.usage));
  assert(r6.output.holding_actions.length === 0, "C6: no holding actions", `got ${r6.output.holding_actions.length}`);
  assert(r6.output.summary.rebalance === "no_action_needed", "C6: summary rebalance no_action_needed", r6.output.summary.rebalance);
  assert(r6.output.reasoning_summary.length > 0 && !/healthy portfolio/i.test(r6.output.summary.one_line_characterization), "C6: deterministic summary does not claim portfolio health", r6.output.summary.one_line_characterization);

  console.log("");
  if (failures.length) {
    console.error(`A3 verify FAILED: ${failures.length} assertion(s):\n  - ${failures.join("\n  - ")}`);
    process.exit(1);
  }
  console.log("A3 verify: all assertions passed.");
})();
