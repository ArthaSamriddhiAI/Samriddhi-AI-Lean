/* A3.so_what, the advisor-action ("so what") layer.
 *
 * Skill: agents/a3_so_what.md
 *
 * Two-layer shape, like A2, risk-reward-stats, and M0.PortfolioRiskAnalytics:
 *
 *   Layer 1 (computeA3): pure, deterministic. Per holding it computes the fixed
 *   five-dimension signal set (only metrics the audit confirmed exist, each
 *   tagged assessable or sentinelled), a deterministic exit-eligibility gate,
 *   and a baseline reconciled decision (maintain/trim/exit). Both the
 *   per-holding action surface and the rebalance proposal read from the SAME
 *   reconciled decision, so they can never disagree about a holding. Layer 1
 *   also computes the rebalance glide-path math and the deterministic
 *   redeployment of freed capital toward under-allocated model sleeves. Same
 *   inputs produce the same numbers; this is the audit surface, asserted
 *   deterministically in verify.
 *
 *   Layer 2 (LLM): over the fixed signal set, returns a structured judgment
 *   (refining the baseline decision: it may upgrade a trim to exit ONLY for an
 *   exit-eligible holding, or downgrade a marginal flag to maintain) plus the
 *   advisor-action prose. The LLM judges; it cannot compute, invent, or alter
 *   any number. (The judgment step lands in the Step-2 commit; this Step-1
 *   commit ships the deterministic Layer 1 + baseline narration.)
 *
 * A3 is the single product surface that recommends an action rather than
 * characterising a state. It runs on Samriddhi 2 (diagnostic) cases, after A2,
 * M0, risk-reward, overlap, and the evidence layer, consuming their
 * already-produced outputs. Ships as data only (content.a3_so_what); the
 * renderer is untouched (WA09).
 *
 * A3 invents no concentration thresholds (10% flag, 15% escalate imported from
 * portfolio-risk-analytics.ts) and no model targets (MODEL_BANDS via
 * metrics.assetClass). The glide-path cadence is A3's own execution-pacing
 * parameter.
 */

import type { A2Output, A2Verdict, A2HoldingVerdict } from "./a2-classification";
import { stripLongDashes } from "./a2-classification";
import type { PortfolioMetrics } from "./portfolio-risk-analytics";
import { POSITION_FLAG_PCT, POSITION_ESCALATE_PCT, MODEL_BANDS } from "./portfolio-risk-analytics";
import type { PreObservation, EvidenceBundle } from "./stitcher";
import type { RiskRewardOutput, HoldingStats } from "./risk-reward-stats";
import type { PortfolioOverlapOutput } from "./portfolio-overlap";
import { callAgent, type AgentCallResult, type AgentUsage } from "./harness";

/* ----- Output contract (skill Output Schema, as TypeScript types) ----- */

export type A3SentinelReason =
  | "no_client_specific_context"
  | "upstream_evidence_unavailable";

export type A3Sentinel = {
  kind: "sentinel";
  sentinel_reason: A3SentinelReason;
  note: string;
};

/* ----- The five trim-vs-exit dimensions ----- */

export type A3Dimension =
  | "redundancy"
  | "cost_efficiency"
  | "performance"
  | "thesis_quality"
  | "suitability";

/* A per-holding, per-dimension signal. `status` distinguishes a real reading
 * from a sentinel (source absent, opaque wrapper, insufficient history); the
 * LLM never judges over a sentinelled dimension. `concern` is set ONLY where a
 * non-invented boundary exists (Performance: Sharpe below zero; Thesis: a
 * negative evidence verdict). Dimensions without a non-invented threshold
 * (Redundancy, Cost) carry the computed value in `detail` for the LLM to weigh
 * but do not set `concern` deterministically. `hard_number` marks the two
 * hard-number dimensions (Redundancy, Performance). */
export type A3DimensionSignal = {
  dimension: A3Dimension;
  status: "assessable" | "sentinelled";
  hard_number: boolean;
  concern: boolean;
  detail: string;
};

export type A3DecisionKind = "maintain" | "trim" | "exit";

/* The reconciled per-holding decision. Both surfaces read this; neither
 * decides independently (the coherence fix). `decision` is the baseline at
 * Layer 1 (flagged -> trim, clean -> maintain, never exit) and is refined by
 * the Layer-2 judgment (which may set exit only when `exit_eligible`). */
export type A3ReconciledDecision = {
  holding_ref: string;
  instrument_display_name: string;
  asset_class: string;
  sub_category: string;
  weight_pct: number;
  over_concentrated: boolean;
  a2_verdict: A2Verdict;
  signals: A3DimensionSignal[];
  exit_eligible: boolean;
  decision: A3DecisionKind;
  dimensions_failing: A3Dimension[];
  judgment_reasoning: string;
};

/* ----- Per-holding action surface (derived from the reconciled decision) ----- */

export type A3HoldingVerdict = Exclude<A2Verdict, "maintain">;

export type A3HoldingActionBody = {
  kind: "action";
  decision: A3DecisionKind;
  source_observation: string;
  advisor_action: string;
};

export type A3HoldingAction = {
  holding_ref: string;
  instrument_display_name: string;
  a2_verdict: A3HoldingVerdict;
} & (A3HoldingActionBody | A3Sentinel);

/* The honest 8: 7 live stitcher pre-observations plus sector_over_concentration
 * from A2's drivers (T-5.12 decision D4). */
export type A3ObservationCategory =
  | "position_over_concentration"
  | "sector_over_concentration"
  | "wrapper_over_accumulation"
  | "cash_drag"
  | "allocation_drift"
  | "liquidity_gap"
  | "stated_revealed_divergence"
  | "complexity_premium_not_earned";

export type A3ObservationActionBody = {
  kind: "action";
  advisor_action: string;
};

export type A3ObservationAction = {
  observation_category: A3ObservationCategory;
  severity_hint: string;
} & (A3ObservationActionBody | A3Sentinel);

/* ----- Rebalance proposal (derived from the reconciled decision) ----- */

export type A3GlidePathStep = {
  step: number;
  trim_pct_points: number;
  resulting_weight_pct: number;
  trigger_at_weight_pct: number;
};

export type A3RebalancePosition = {
  instrument: string;
  /** "trim" trims to the 10% ceiling; "exit" liquidates to 0 (judged exit). */
  decision: "trim" | "exit";
  current_weight_pct: number;
  breach_threshold_pct: number;
  target_weight_pct: number;
  total_trim_pct_points: number;
  glide_path: A3GlidePathStep[];
};

export type A3RedeploymentTarget = {
  sleeve: string;
  current_pct: number;
  target_pct: number;
  add_pct_points: number;
  resulting_pct: number;
};

/* Deterministic redeployment of freed capital toward under-allocated model
 * sleeves. Numbers visibly close: freed_capital_pct == sum(add_pct_points) +
 * leftover_to_cash_pct. Honest edge cases (no underweight sleeve, freed exceeds
 * capacity) report leftover_to_cash_pct rather than fabricating destinations. */
export type A3Redeployment = {
  freed_capital_pct: number;
  deployments: A3RedeploymentTarget[];
  leftover_to_cash_pct: number;
  note: string;
};

export type A3RebalanceComputed = {
  positions: A3RebalancePosition[];
  redeployment: A3Redeployment;
};

export type A3RebalanceNarrated = {
  advisor_action: string;
  generation_method: "templated" | "llm";
};

export type A3RebalanceProposal =
  | { kind: "proposal"; computed: A3RebalanceComputed; narrated: A3RebalanceNarrated }
  | { kind: "no_action_needed"; note: string }
  | A3Sentinel;

export type A3Summary = {
  holding_actions_surfaced: number;
  holding_actions_sentinelled: number;
  observation_actions_surfaced: number;
  observation_actions_sentinelled: number;
  trim_count: number;
  exit_count: number;
  rebalance: "proposal" | "no_action_needed" | "sentinel";
  one_line_characterization: string;
};

export type A3Output = {
  agent_id: "a3_so_what";
  case_id: string;
  as_of_date: string;
  decisions: A3ReconciledDecision[];
  holding_actions: A3HoldingAction[];
  observation_actions: A3ObservationAction[];
  rebalance_proposal: A3RebalanceProposal;
  summary: A3Summary;
  reasoning_summary: string;
};

export type A3Input = {
  caseId: string;
  asOfDate: string;
  a2Output: A2Output;
  metrics: PortfolioMetrics | null;
  preObservations: PreObservation[];
  riskReward: RiskRewardOutput | null;
  overlap: PortfolioOverlapOutput | null;
  evidence: EvidenceBundle | null;
};

export type A3Layer1Result = {
  case_id: string;
  as_of_date: string;
  decisions: A3ReconciledDecision[];
  holding_actions: A3HoldingAction[];
  observation_actions: A3ObservationAction[];
  rebalance_proposal: A3RebalanceProposal;
};

/* ----- Constants ----- */

const GLIDE_MAX_TRIM_PER_STEP_PCT = 5;
const TARGET_WEIGHT_PCT = POSITION_FLAG_PCT;

const SEVERITY_RANK: Record<string, number> = {
  escalate: 4, flag: 3, watch: 2, info: 1, ok: 0,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* ----- Layer 1: per-holding signal set ----- */

function findHoldingStats(riskReward: RiskRewardOutput | null, ref: string): HoldingStats | null {
  if (!riskReward) return null;
  const key = normalise(ref);
  return riskReward.per_holding.find((s) => normalise(s.holding_ref) === key) ?? null;
}

/* Performance (hard). Concern marker is Sharpe (or Sortino) below zero, the
 * natural boundary (return below the risk-free rate); no invented threshold. */
function performanceSignal(stats: HoldingStats | null): A3DimensionSignal {
  if (!stats || stats.source === "sentinel" || !stats.stats) {
    return {
      dimension: "performance",
      status: "sentinelled",
      hard_number: true,
      concern: false,
      detail: stats?.sentinel
        ? `performance not assessable: ${stats.sentinel}`
        : "performance not assessable: no tier_b stats (opaque wrapper or insufficient history)",
    };
  }
  const s = stats.stats;
  const sharpe = s.sharpe_3y ?? s.sharpe_5y ?? null;
  const sortino = s.sortino_3y ?? s.sortino_5y ?? null;
  const concern = (sharpe !== null && sharpe < 0) || (sortino !== null && sortino < 0);
  const parts: string[] = [];
  if (sharpe !== null) parts.push(`sharpe ${sharpe}`);
  if (sortino !== null) parts.push(`sortino ${sortino}`);
  if (s.calmar_3y != null) parts.push(`calmar ${s.calmar_3y}`);
  if (s.max_drawdown_3y != null) parts.push(`max_drawdown ${s.max_drawdown_3y}`);
  return {
    dimension: "performance",
    status: "assessable",
    hard_number: true,
    concern,
    detail: parts.length ? parts.join(", ") : "tier_b present, no risk-adjusted return fields",
  };
}

/* Redundancy (hard). The holding's strongest pairwise overlap. No non-invented
 * threshold for "too redundant", so the value is presented for the LLM; concern
 * is not set deterministically. */
function redundancySignal(overlap: PortfolioOverlapOutput | null, ref: string): A3DimensionSignal {
  if (!overlap) {
    return {
      dimension: "redundancy", status: "sentinelled", hard_number: true, concern: false,
      detail: "redundancy not assessable: portfolio_overlap absent for this case",
    };
  }
  const key = normalise(ref);
  let best: { other: string; score: number; layer: string } | null = null;
  for (const p of overlap.per_pair) {
    const inPair = normalise(p.holding_a) === key || normalise(p.holding_b) === key;
    if (!inPair) continue;
    const other = normalise(p.holding_a) === key ? p.holding_b : p.holding_a;
    if (!best || p.score > best.score) best = { other, score: p.score, layer: p.resolution_layer };
  }
  if (!best) {
    return {
      dimension: "redundancy", status: "sentinelled", hard_number: true, concern: false,
      detail: "redundancy not assessable: no within-sleeve overlap pair for this holding",
    };
  }
  return {
    dimension: "redundancy", status: "assessable", hard_number: true, concern: false,
    detail: `max overlap ${round1(best.score * 100) / 100} with ${best.other} (${best.layer})`,
  };
}

/* Thesis/quality (soft). Derived from A2's thesis driver, which A2 produced by
 * matching the holding to its E1/E6/E7 verdict. Concern marker is a negative
 * verdict (A2 maps a negative evidence verdict to an escalate-severity thesis
 * driver). */
function thesisSignal(h: A2HoldingVerdict): A3DimensionSignal {
  const thesisDrivers = h.drivers.filter((d) => d.driver_type === "thesis");
  const complexity = h.drivers.find((d) => d.driver_type === "complexity_premium");
  if (thesisDrivers.length === 0 && !complexity) {
    return {
      dimension: "thesis_quality", status: "sentinelled", hard_number: false, concern: false,
      detail: "thesis not flagged by the evidence layer for this holding",
    };
  }
  const negative = thesisDrivers.some((d) => d.severity === "escalate");
  const obs = thesisDrivers[0]?.source_observation ?? complexity?.source_observation ?? "thesis";
  return {
    dimension: "thesis_quality", status: "assessable", hard_number: false, concern: negative,
    detail: negative ? `negative evidence verdict (${obs})` : `evidence verdict caution (${obs})`,
  };
}

/* Cost-efficiency (thin). Raw expense ratio / fee exist (E7 ter_pct, E6
 * fee_normalised_bps) but there is no deterministic fee-vs-peer benchmark, so
 * "overpriced for its category" is not computable; sentinel rather than fake.
 * P37 (benchmarking) would enrich this. */
function costSignal(): A3DimensionSignal {
  return {
    dimension: "cost_efficiency", status: "sentinelled", hard_number: false, concern: false,
    detail: "cost-efficiency not deterministically assessable: raw fees exist (E7 ter_pct, E6 fee_normalised_bps) but no fee-vs-peer benchmark is computed",
  };
}

/* Suitability/mandate (thin). E4 stated-revealed divergence is portfolio-level,
 * not per-holding; surfaced as context, never a per-holding concern. */
function suitabilitySignal(evidence: EvidenceBundle | null): A3DimensionSignal {
  const div = evidence?.e4?.stated_vs_revealed_divergence;
  const detail = div && div.magnitude !== "none"
    ? `portfolio-level stated-revealed divergence: ${div.magnitude} (${div.direction})`
    : "suitability not assessable per-holding (mandate fit is portfolio-level)";
  return {
    dimension: "suitability", status: "sentinelled", hard_number: false, concern: false, detail,
  };
}

function computeSignals(
  h: A2HoldingVerdict,
  stats: HoldingStats | null,
  overlap: PortfolioOverlapOutput | null,
  evidence: EvidenceBundle | null,
): A3DimensionSignal[] {
  return [
    redundancySignal(overlap, h.holding_ref),
    costSignal(),
    performanceSignal(stats),
    thesisSignal(h),
    suitabilitySignal(evidence),
  ];
}

/* Deterministic exit-eligibility gate. Exit is a high bar: it requires the
 * hard-number Performance dimension to show a concern (Sharpe/Sortino below
 * zero) AND the Thesis dimension to show a negative verdict. Both must be
 * assessable. Redundancy and Cost have no non-invented threshold, so they
 * inform the LLM's reasoning but do not deterministically gate exit; this keeps
 * the gate conservative (exit needs hard underperformance plus a broken
 * thesis). Opaque wrappers (no tier_b) have Performance sentinelled, so they
 * are never exit-eligible and bias to trim/maintain, as intended. */
function computeExitEligible(signals: A3DimensionSignal[]): boolean {
  const perf = signals.find((s) => s.dimension === "performance");
  const thesis = signals.find((s) => s.dimension === "thesis_quality");
  const perfFails = perf?.status === "assessable" && perf.concern;
  const thesisFails = thesis?.status === "assessable" && thesis.concern;
  return Boolean(perfFails && thesisFails);
}

function buildReconciledDecisions(input: A3Input): A3ReconciledDecision[] {
  const { a2Output, metrics, riskReward, overlap, evidence } = input;
  const flagByInstrument = new Map<string, number>();
  if (metrics) {
    for (const pf of metrics.concentration.positionFlags) {
      flagByInstrument.set(normalise(pf.instrument), pf.weightPct);
    }
  }

  const decisions: A3ReconciledDecision[] = [];
  for (const h of a2Output.holding_verdicts) {
    const stats = findHoldingStats(riskReward, h.holding_ref);
    const signals = computeSignals(h, stats, overlap, evidence);
    const exitEligible = computeExitEligible(signals);
    const overConcentrated = (flagByInstrument.get(normalise(h.holding_ref)) ?? 0) > TARGET_WEIGHT_PCT;

    // Baseline decision (deterministic). Over-concentrated holdings trim to the
    // 10% ceiling. Other A2-flagged holdings carry their conversation via the
    // holding-action surface but get no size action at baseline. Exit is never
    // a baseline decision: only the Layer-2 judgment may set it, and only when
    // exit_eligible. Clean holdings maintain.
    let decision: A3DecisionKind;
    if (overConcentrated) decision = "trim";
    else decision = "maintain";

    const dimensions_failing = signals
      .filter((s) => s.status === "assessable" && s.concern)
      .map((s) => s.dimension);

    decisions.push({
      holding_ref: h.holding_ref,
      instrument_display_name: h.instrument_display_name,
      asset_class: h.asset_class,
      sub_category: h.sub_category,
      weight_pct: h.weight_pct,
      over_concentrated: overConcentrated,
      a2_verdict: h.verdict,
      signals,
      exit_eligible: exitEligible,
      decision,
      dimensions_failing,
      judgment_reasoning: "",
    });
  }
  return decisions;
}

/* ----- Layer 1: glide-path math ----- */

function buildGlidePath(currentWeight: number, target: number): A3GlidePathStep[] {
  const totalTrim = currentWeight - target;
  if (totalTrim <= 0) return [];
  const steps = Math.max(1, Math.ceil(totalTrim / GLIDE_MAX_TRIM_PER_STEP_PCT));
  const path: A3GlidePathStep[] = [];
  let prevWeight = round1(currentWeight);
  for (let k = 1; k <= steps; k++) {
    const resulting =
      k === steps ? round1(target) : round1(currentWeight - (totalTrim * k) / steps);
    path.push({
      step: k,
      trim_pct_points: round1(prevWeight - resulting),
      resulting_weight_pct: resulting,
      trigger_at_weight_pct: prevWeight,
    });
    prevWeight = resulting;
  }
  return path;
}

/* ----- Layer 1: deterministic redeployment vs MODEL_BANDS ----- */

const ASSET_CLASSES = ["Equity", "Debt", "Alternatives", "Cash"] as const;

export function computeRedeployment(
  decisions: A3ReconciledDecision[],
  metrics: PortfolioMetrics,
): A3Redeployment {
  // Freed capital = trims (current - 10) + exits (full current weight).
  let freed = 0;
  for (const d of decisions) {
    if (d.decision === "trim") freed += Math.max(0, d.weight_pct - TARGET_WEIGHT_PCT);
    else if (d.decision === "exit") freed += d.weight_pct;
  }
  freed = round1(freed);

  // Under-allocated sleeves (actual below model target), excluding Cash (cash
  // is where leftover lands, not a deployment destination).
  const under = ASSET_CLASSES
    .filter((c) => c !== "Cash")
    .map((c) => {
      const a = metrics.assetClass[c];
      const gap = Math.max(0, a.targetPct - a.actualPct);
      return { sleeve: c, current: a.actualPct, target: a.targetPct, gap };
    })
    .filter((x) => x.gap > 0);

  const totalGap = under.reduce((s, x) => s + x.gap, 0);
  const deployments: A3RedeploymentTarget[] = [];
  let deployed = 0;

  if (freed > 0 && totalGap > 0) {
    // Distribute proportional to each sleeve's gap, capped at the gap (do not
    // overshoot target). If freed exceeds total capacity, fill all gaps.
    const deployable = Math.min(freed, totalGap);
    for (const u of under) {
      const add = round1((u.gap / totalGap) * deployable);
      if (add <= 0) continue;
      deployments.push({
        sleeve: u.sleeve,
        current_pct: round1(u.current),
        target_pct: round1(u.target),
        add_pct_points: add,
        resulting_pct: round1(u.current + add),
      });
      deployed += add;
    }
  }
  deployed = round1(deployed);
  const leftover = round1(freed - deployed);

  let note: string;
  if (freed <= 0) {
    note = "No trims or exits, so no capital is freed for redeployment.";
  } else if (totalGap <= 0) {
    note = `No sleeve is below its model target, so the freed ${freed} points have no model-consistent destination and are reported as leftover to cash.`;
  } else if (leftover > 0) {
    note = `Freed ${freed} points exceeds the ${round1(totalGap)} points of under-allocation capacity; sleeves are filled to target and the remaining ${leftover} points are reported as leftover to cash.`;
  } else {
    note = `Freed ${freed} points deployed toward under-allocated sleeves, moving the allocation toward the model.`;
  }

  return { freed_capital_pct: freed, deployments, leftover_to_cash_pct: leftover, note };
}

/* ----- Layer 1: surfaces derived from the reconciled decision ----- */

function buildHoldingActions(decisions: A3ReconciledDecision[]): A3HoldingAction[] {
  const out: A3HoldingAction[] = [];
  for (const d of decisions) {
    if (d.decision === "maintain" && d.a2_verdict === "maintain") continue; // nothing to surface
    const base = {
      holding_ref: d.holding_ref,
      instrument_display_name: d.instrument_display_name,
      a2_verdict: d.a2_verdict as A3HoldingVerdict,
    };
    if (d.a2_verdict === "unable_to_classify") {
      out.push({
        ...base,
        kind: "sentinel",
        sentinel_reason: "upstream_evidence_unavailable",
        note: `Recommendation not surfaced: the Samriddhi 2 diagnostic could not classify ${d.instrument_display_name}.`,
      });
      continue;
    }
    // Find the A2 dominant driver observation for the deterministic link.
    out.push({
      ...base,
      kind: "action",
      decision: d.decision,
      source_observation:
        d.dimensions_failing.length > 0 ? d.dimensions_failing.join("+") : (d.over_concentrated ? "position_over_concentration" : "a2_flag"),
      advisor_action: "",
    });
  }
  return out;
}

function buildRebalanceProposal(
  decisions: A3ReconciledDecision[],
  metrics: PortfolioMetrics | null,
): A3RebalanceProposal {
  if (!metrics) {
    return {
      kind: "sentinel",
      sentinel_reason: "upstream_evidence_unavailable",
      note: "Rebalance proposal not surfaced: M0.PortfolioRiskAnalytics metrics absent.",
    };
  }

  const positions: A3RebalancePosition[] = [];
  for (const d of decisions) {
    if (d.decision === "trim") {
      const breachThreshold = d.weight_pct >= POSITION_ESCALATE_PCT ? POSITION_ESCALATE_PCT : POSITION_FLAG_PCT;
      positions.push({
        instrument: d.instrument_display_name,
        decision: "trim",
        current_weight_pct: round1(d.weight_pct),
        breach_threshold_pct: breachThreshold,
        target_weight_pct: TARGET_WEIGHT_PCT,
        total_trim_pct_points: round1(d.weight_pct - TARGET_WEIGHT_PCT),
        glide_path: buildGlidePath(d.weight_pct, TARGET_WEIGHT_PCT),
      });
    } else if (d.decision === "exit") {
      const breachThreshold = d.weight_pct >= POSITION_ESCALATE_PCT ? POSITION_ESCALATE_PCT : POSITION_FLAG_PCT;
      positions.push({
        instrument: d.instrument_display_name,
        decision: "exit",
        current_weight_pct: round1(d.weight_pct),
        breach_threshold_pct: breachThreshold,
        target_weight_pct: 0,
        total_trim_pct_points: round1(d.weight_pct),
        glide_path: buildGlidePath(d.weight_pct, 0),
      });
    }
  }

  const redeployment = computeRedeployment(decisions, metrics);

  if (positions.length === 0) {
    return {
      kind: "no_action_needed",
      note: "No holding is decided for trim or exit; no rebalance proposed.",
    };
  }

  return {
    kind: "proposal",
    computed: { positions, redeployment },
    narrated: { advisor_action: "", generation_method: "llm" },
  };
}

/* ----- Layer 1: per-observation surface ----- */

const OBSERVATION_ORDER: A3ObservationCategory[] = [
  "position_over_concentration",
  "sector_over_concentration",
  "wrapper_over_accumulation",
  "cash_drag",
  "allocation_drift",
  "liquidity_gap",
  "stated_revealed_divergence",
  "complexity_premium_not_earned",
];

function isA3ObservationCategory(s: string): s is A3ObservationCategory {
  return (OBSERVATION_ORDER as string[]).includes(s);
}

function buildObservationActions(
  a2Output: A2Output,
  preObservations: PreObservation[],
): A3ObservationAction[] {
  const bestSeverity = new Map<A3ObservationCategory, string>();
  const consider = (category: string, severity: string) => {
    if (!isA3ObservationCategory(category)) return;
    const prev = bestSeverity.get(category);
    if (prev === undefined || (SEVERITY_RANK[severity] ?? 0) > (SEVERITY_RANK[prev] ?? 0)) {
      bestSeverity.set(category, severity);
    }
  };
  for (const o of preObservations) consider(o.vocab_candidate, o.severity_hint);
  for (const h of a2Output.holding_verdicts) {
    for (const d of h.drivers) {
      if (d.source_observation === "sector_over_concentration") consider("sector_over_concentration", d.severity);
    }
  }
  const out: A3ObservationAction[] = [];
  for (const category of OBSERVATION_ORDER) {
    const severity = bestSeverity.get(category);
    if (severity === undefined) continue;
    out.push({ observation_category: category, severity_hint: severity, kind: "action", advisor_action: "" });
  }
  return out;
}

export function computeA3(input: A3Input): A3Layer1Result {
  const decisions = buildReconciledDecisions(input);
  return {
    case_id: input.caseId,
    as_of_date: input.asOfDate,
    decisions,
    holding_actions: buildHoldingActions(decisions),
    observation_actions: buildObservationActions(input.a2Output, input.preObservations),
    rebalance_proposal: buildRebalanceProposal(decisions, input.metrics),
  };
}

/* ----- Layer 2: LLM advisor-action prose (baseline narration; judgment lands in Step 2) ----- */

type A3ReasonPayload = {
  holding_actions: Array<{ holding_ref: string; advisor_action: string }>;
  observation_actions: Array<{ observation_category: string; advisor_action: string }>;
  rebalance_advisor_action?: string;
  one_line_characterization: string;
  reasoning_summary: string;
};

function buildReasonPrompt(layer1: A3Layer1Result): string {
  const holdingsNeedingProse = layer1.holding_actions
    .filter((h): h is A3HoldingAction & A3HoldingActionBody => h.kind === "action")
    .map((h) => ({
      holding_ref: h.holding_ref,
      instrument: h.instrument_display_name,
      a2_verdict: h.a2_verdict,
      decision: h.decision,
      source_observation: h.source_observation,
    }));

  const observationsNeedingProse = layer1.observation_actions
    .filter((o): o is A3ObservationAction & A3ObservationActionBody => o.kind === "action")
    .map((o) => ({ observation_category: o.observation_category, severity_hint: o.severity_hint }));

  const rebalance =
    layer1.rebalance_proposal.kind === "proposal" ? layer1.rebalance_proposal.computed : null;

  const lines: string[] = [
    `# A3 Advisor-Action Request`,
    ``,
    `Case ${layer1.case_id}, as of ${layer1.as_of_date}.`,
    ``,
    `Every decision, number, trim, and redeployment below is fixed and computed.`,
    `Your job is recommendatory advisor-facing prose. You must NOT change,`,
    `invent, or add any number, destination, amount, or coordination not present`,
    `in the computed inputs. Narrate ONLY what is given. Third person on the`,
    `client. Use only commas, semicolons, colons, or periods; never an em dash,`,
    `en dash, or any other long dash. Write "Samriddhi 1" and "Samriddhi 2" in`,
    `full. Propose actions as text and stop: no scheduling, approval, or status.`,
    ``,
    `## Per-holding actions (decision is fixed: trim, exit, or maintain)`,
    ``,
    "```json",
    JSON.stringify(holdingsNeedingProse, null, 2),
    "```",
    ``,
    `## Per-observation actions`,
    ``,
    "```json",
    JSON.stringify(observationsNeedingProse, null, 2),
    "```",
  ];

  if (rebalance) {
    lines.push(
      ``,
      `## Rebalance proposal (trims/exits and the computed redeployment of freed capital)`,
      ``,
      `Narrate the glide-path for each position citing every computed number`,
      `exactly, and the redeployment exactly as computed (the sleeves, the`,
      `add_pct_points, and the leftover_to_cash_pct). Do NOT invent any`,
      `destination or amount beyond the computed deployments. If`,
      `leftover_to_cash_pct is above zero, state plainly that the freed capital`,
      `beyond the under-allocated capacity sits in cash; do not narrate it as`,
      `reinvested.`,
      ``,
      "```json",
      JSON.stringify(rebalance, null, 2),
      "```",
    );
  }

  lines.push(
    ``,
    `## Output`,
    ``,
    `Return a single fenced JSON block with this exact shape:`,
    ``,
    "```json",
    `{`,
    `  "holding_actions": [ { "holding_ref": "<verbatim>", "advisor_action": "<recommendatory, matches the fixed decision, cites the numbers>" } ],`,
    `  "observation_actions": [ { "observation_category": "<verbatim>", "advisor_action": "<recommendatory, portfolio level>" } ],`,
    rebalance
      ? `  "rebalance_advisor_action": "<narrates the trims/exits and the computed redeployment, no invented numbers>",`
      : `  "rebalance_advisor_action": null,`,
    `  "one_line_characterization": "<one line on the advisor-action picture>",`,
    `  "reasoning_summary": "<2-4 sentences; advisor register>"`,
    `}`,
    "```",
    ``,
    `Provide exactly one entry for every holding_ref and observation_category in`,
    `the input, and no others. Single fenced JSON block, no prose outside it.`,
  );

  return lines.join("\n");
}

function validateReasonPayload(parsed: unknown): A3ReasonPayload {
  if (typeof parsed !== "object" || parsed === null) throw new Error("A3 Layer 2 output is not an object");
  const o = parsed as Record<string, unknown>;
  if (!Array.isArray(o.holding_actions)) throw new Error("A3 Layer 2 output.holding_actions must be an array");
  for (const r of o.holding_actions as unknown[]) {
    const row = r as Record<string, unknown>;
    if (typeof row.holding_ref !== "string" || row.holding_ref.trim() === "") throw new Error("A3 Layer 2 holding_action row missing holding_ref");
    if (typeof row.advisor_action !== "string" || row.advisor_action.trim() === "") throw new Error("A3 Layer 2 holding_action row missing advisor_action");
  }
  if (!Array.isArray(o.observation_actions)) throw new Error("A3 Layer 2 output.observation_actions must be an array");
  for (const r of o.observation_actions as unknown[]) {
    const row = r as Record<string, unknown>;
    if (typeof row.observation_category !== "string" || row.observation_category.trim() === "") throw new Error("A3 Layer 2 observation_action row missing observation_category");
    if (typeof row.advisor_action !== "string" || row.advisor_action.trim() === "") throw new Error("A3 Layer 2 observation_action row missing advisor_action");
  }
  if (typeof o.one_line_characterization !== "string" || o.one_line_characterization.trim() === "") throw new Error("A3 Layer 2 output missing one_line_characterization");
  if (typeof o.reasoning_summary !== "string" || o.reasoning_summary.trim() === "") throw new Error("A3 Layer 2 output missing reasoning_summary");
  return o as unknown as A3ReasonPayload;
}

export async function runA3ReasonText(layer1: A3Layer1Result): Promise<AgentCallResult<A3ReasonPayload>> {
  return callAgent<A3ReasonPayload>({
    skillId: "a3_so_what",
    userPrompt: buildReasonPrompt(layer1),
    validate: validateReasonPayload,
  });
}

/* ----- Orchestration ----- */

export type A3DiagnosticResult = {
  output: A3Output;
  usage: AgentUsage;
  responseId?: string;
  responseModel?: string;
};

function countSurfaced<T extends { kind: "action" | "sentinel" }>(items: T[]): { surfaced: number; sentinelled: number } {
  let surfaced = 0, sentinelled = 0;
  for (const i of items) (i.kind === "action" ? surfaced++ : sentinelled++);
  return { surfaced, sentinelled };
}

function needsLayer2(layer1: A3Layer1Result): boolean {
  return (
    layer1.holding_actions.some((h) => h.kind === "action") ||
    layer1.observation_actions.some((o) => o.kind === "action") ||
    layer1.rebalance_proposal.kind === "proposal"
  );
}

function decisionCounts(decisions: A3ReconciledDecision[]): { trim: number; exit: number } {
  let trim = 0, exit = 0;
  for (const d of decisions) {
    if (d.decision === "trim") trim++;
    else if (d.decision === "exit") exit++;
  }
  return { trim, exit };
}

export async function runA3Diagnostic(input: A3Input): Promise<A3DiagnosticResult> {
  const layer1 = computeA3(input);
  const holdingCounts = countSurfaced(layer1.holding_actions);
  const observationCounts = countSurfaced(layer1.observation_actions);
  const dc = decisionCounts(layer1.decisions);
  const rebalanceKind = layer1.rebalance_proposal.kind;

  if (!needsLayer2(layer1)) {
    const output: A3Output = {
      agent_id: "a3_so_what",
      case_id: layer1.case_id,
      as_of_date: layer1.as_of_date,
      decisions: layer1.decisions,
      holding_actions: layer1.holding_actions,
      observation_actions: layer1.observation_actions,
      rebalance_proposal: layer1.rebalance_proposal,
      summary: {
        holding_actions_surfaced: holdingCounts.surfaced,
        holding_actions_sentinelled: holdingCounts.sentinelled,
        observation_actions_surfaced: observationCounts.surfaced,
        observation_actions_sentinelled: observationCounts.sentinelled,
        trim_count: dc.trim,
        exit_count: dc.exit,
        rebalance: rebalanceKind,
        one_line_characterization: "No advisor actions surfaced from the Samriddhi 2 diagnostic for this case.",
      },
      reasoning_summary:
        "A3 surfaced no advisor actions: the Samriddhi 2 diagnostic flagged no holdings for Monitor, Discuss, or Review, no portfolio-level observations, and no single-position concentration breach. Portfolio-level health remains the Samriddhi 2 diagnostic surface's characterisation, not A3's.",
    };
    return { output, usage: { inputTokens: 0, outputTokens: 0 } };
  }

  const reasonResult = await runA3ReasonText(layer1);
  const payload = reasonResult.output;

  const holdingProse = new Map<string, string>();
  for (const r of payload.holding_actions) holdingProse.set(r.holding_ref, r.advisor_action);
  const observationProse = new Map<string, string>();
  for (const r of payload.observation_actions) observationProse.set(r.observation_category, r.advisor_action);

  const holding_actions: A3HoldingAction[] = layer1.holding_actions.map((h) => {
    if (h.kind !== "action") return h;
    const prose = holdingProse.get(h.holding_ref);
    if (!prose) throw new Error(`A3 Layer 2 did not return an advisor_action for holding ${h.holding_ref}. Layer 1 structure is intact; rerun Layer 2.`);
    return { ...h, advisor_action: stripLongDashes(prose) };
  });

  const observation_actions: A3ObservationAction[] = layer1.observation_actions.map((o) => {
    if (o.kind !== "action") return o;
    const prose = observationProse.get(o.observation_category);
    if (!prose) throw new Error(`A3 Layer 2 did not return an advisor_action for observation ${o.observation_category}. Layer 1 structure is intact; rerun Layer 2.`);
    return { ...o, advisor_action: stripLongDashes(prose) };
  });

  let rebalance_proposal: A3RebalanceProposal = layer1.rebalance_proposal;
  if (layer1.rebalance_proposal.kind === "proposal") {
    const prose = payload.rebalance_advisor_action;
    if (!prose || prose.trim() === "") throw new Error("A3 Layer 2 did not return rebalance_advisor_action for a proposal. Layer 1 glide-path is intact; rerun Layer 2.");
    rebalance_proposal = {
      kind: "proposal",
      computed: layer1.rebalance_proposal.computed,
      narrated: { advisor_action: stripLongDashes(prose), generation_method: "llm" },
    };
  }

  const output: A3Output = {
    agent_id: "a3_so_what",
    case_id: layer1.case_id,
    as_of_date: layer1.as_of_date,
    decisions: layer1.decisions,
    holding_actions,
    observation_actions,
    rebalance_proposal,
    summary: {
      holding_actions_surfaced: holdingCounts.surfaced,
      holding_actions_sentinelled: holdingCounts.sentinelled,
      observation_actions_surfaced: observationCounts.surfaced,
      observation_actions_sentinelled: observationCounts.sentinelled,
      trim_count: dc.trim,
      exit_count: dc.exit,
      rebalance: rebalanceKind,
      one_line_characterization: stripLongDashes(payload.one_line_characterization),
    },
    reasoning_summary: stripLongDashes(payload.reasoning_summary),
  };

  return { output, usage: reasonResult.usage, responseId: reasonResult.id, responseModel: reasonResult.model };
}
