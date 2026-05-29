/* A3.so_what, the advisor-action ("so what") layer.
 *
 * Skill: agents/a3_so_what.md
 *
 * Two-layer shape, like A2, risk-reward-stats, and M0.PortfolioRiskAnalytics:
 *
 *   Layer 1 (computeA3): pure, deterministic. Per holding it computes the fixed
 *   five-dimension signal set (only metrics the audit confirmed exist, each
 *   tagged assessable or sentinelled), a type-specific exit-eligibility gate,
 *   and a baseline reconciled decision (maintain/trim/exit). Both the
 *   per-holding action surface and the rebalance proposal read from the SAME
 *   reconciled decision. Layer 1 also computes the rebalance glide-path math and
 *   the deterministic redeployment of freed capital toward under-allocated model
 *   sleeves. Same inputs produce the same numbers; asserted in verify.
 *
 *   Layer 2 (LLM): over the fixed signal set, returns a structured judgment
 *   (refining the baseline decision: it may upgrade a trim to exit ONLY for an
 *   exit-eligible holding) plus the advisor-action prose. The LLM judges; it
 *   cannot compute, invent, or alter any number. (The judgment step lands in the
 *   Step-2b commit; this commit ships the deterministic gates + baseline
 *   narration.)
 *
 * A3 runs on Samriddhi 2 (diagnostic) cases, consuming A2, M0, risk-reward,
 * overlap, and the evidence layer. Ships data only (content.a3_so_what); the
 * renderer is untouched (WA09). A3 invents no concentration thresholds (10/15%
 * from portfolio-risk-analytics.ts) and no model targets (MODEL_BANDS via
 * metrics.assetClass). The glide-path cadence is A3's own pacing parameter.
 */

import type { A2Output, A2Verdict, A2HoldingVerdict } from "./a2-classification";
import { stripLongDashes } from "./a2-classification";
import type { PortfolioMetrics } from "./portfolio-risk-analytics";
import { POSITION_FLAG_PCT, POSITION_ESCALATE_PCT, MODEL_BANDS } from "./portfolio-risk-analytics";
import type { PreObservation, EvidenceBundle } from "./stitcher";
import type { RiskRewardOutput, HoldingStats } from "./risk-reward-stats";
import type { PortfolioOverlapOutput } from "./portfolio-overlap";
import type { E6PerProduct } from "./e6-wrappers";
import type { A3IndianContext, A3TaxBundle, A3TaxProductFamily } from "./m0-indian-context";
import { taxProductFamily, type A3OperationalMetadata } from "./operational-scope";
import { callAgent, type AgentCallResult, type AgentUsage } from "./harness";

/* ----- Output contract ----- */

export type A3SentinelReason =
  | "no_client_specific_context"
  | "upstream_evidence_unavailable";

export type A3Sentinel = {
  kind: "sentinel";
  sentinel_reason: A3SentinelReason;
  note: string;
};

export type A3Dimension =
  | "redundancy"
  | "cost_efficiency"
  | "performance"
  | "thesis_quality"
  | "suitability";

/* A per-holding, per-dimension signal. `status` distinguishes a real reading
 * from a sentinel (source absent, opaque wrapper without E6, insufficient
 * history). `concern` is set only where a non-invented boundary exists
 * (Performance: Sharpe below zero; Thesis: a negative evidence verdict; Cost
 * for opaque: complexity_premium_earned "no"). Dimensions without a boundary
 * carry the value in `detail` for the LLM but do not set `concern`. */
export type A3DimensionSignal = {
  dimension: A3Dimension;
  status: "assessable" | "sentinelled";
  hard_number: boolean;
  concern: boolean;
  detail: string;
};

export type A3DecisionKind = "maintain" | "trim" | "exit";

/* Holding kind drives the type-specific eligibility gate (Step 2).
 *  - transparent: a merit-evaluable instrument with numeric tier_b (MF, listed,
 *    intl). Exit gate: numeric Performance-concern AND Thesis-concern.
 *  - opaque: PMS / AIF wrapper, no tier_b, rich E6. Exit gate: E6 verdict
 *    negative AND complexity_premium_earned "no" (Thesis-concern AND
 *    Cost-concern, via E6).
 *  - allocation: FD, bond, gold, cash. No merit signal; never exit-eligible. */
export type A3HoldingKind = "transparent" | "opaque" | "allocation";

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
  holding_kind: A3HoldingKind;
  /* The tax_matrix product family for M0 tax-context lookup (Finding 2);
   * null for sub-categories with no capital-gains treatment (FD, cash, bond). */
  tax_product_family: A3TaxProductFamily | null;
  over_concentrated: boolean;
  a2_verdict: A2Verdict;
  signals: A3DimensionSignal[];
  exit_eligible: boolean;
  decision: A3DecisionKind;
  dimensions_failing: A3Dimension[];
  /* Structured justification when decision is exit (Layer-2 judgment, Step 2b).
   * Empty at the Layer-1 baseline. */
  exit_rationale: string;
  judgment_reasoning: string;
};

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

export type A3ObservationCategory =
  | "position_over_concentration"
  | "sector_over_concentration"
  | "wrapper_over_accumulation"
  | "cash_drag"
  | "allocation_drift"
  | "liquidity_gap"
  | "stated_revealed_divergence"
  | "complexity_premium_not_earned";

export type A3ObservationActionBody = { kind: "action"; advisor_action: string };

export type A3ObservationAction = {
  observation_category: A3ObservationCategory;
  severity_hint: string;
} & (A3ObservationActionBody | A3Sentinel);

export type A3GlidePathStep = {
  step: number;
  trim_pct_points: number;
  resulting_weight_pct: number;
  trigger_at_weight_pct: number;
};

export type A3RebalancePosition = {
  instrument: string;
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
  /** Deployment ceiling: the sleeve's upper tolerance band (MODEL_BANDS max).
   * Freed capital fills up to here, not merely to the model target. */
  upper_band_pct: number;
  add_pct_points: number;
  resulting_pct: number;
};

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
  /* Regulatory and operational provenance (Finding 2): the deterministic
   * context A3's narration was constrained to cite. Persisted for audit so a
   * reviewer can confirm every operational / tax claim traces to real data. */
  indian_context: A3IndianContext | null;
  operational: A3OperationalMetadata[];
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
  /* M0.IndianContext tax-matrix + SEBI minimums, product-structure-scoped
   * (Finding 2); null when M0 is unavailable. */
  indianContext: A3IndianContext | null;
  /* Per-holding snapshot operational metadata (PMS lock-in / exit-load, AIF
   * tenure / redemption / min-commitment, MF exit-load), category-guarded
   * (Finding 2 / Option 2A). Empty when no holding has a consistent match. */
  operational: A3OperationalMetadata[];
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

const SEVERITY_RANK: Record<string, number> = { escalate: 4, flag: 3, watch: 2, info: 1, ok: 0 };

function round1(n: number): number { return Math.round(n * 10) / 10; }
function normalise(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]/g, ""); }

/* ----- Robust wrapper-name matcher (mirrors case/scope-builders.ts) -----
 *
 * PMS/AIF names carry corporate noise and strategy suffixes that defeat exact
 * matching, so a holding may not exact-match its E6 record (e.g., "Motilal
 * Oswal Value Migration PMS" vs the E6 record "...Value Strategy PMS"). Token
 * overlap links them; exact match does not. No stable instrument id / ISIN
 * exists on the E6 record (audit docs/audits/2026-05-28_qualitative_data_snapshot.md),
 * so name overlap is the only available join, and it carries a logged caveat:
 * the link is name-based, and the matched E6 record may itself flag a
 * snapshot-name mismatch (the judgment treats such links conservatively). */
const WRAPPER_STOP = new Set([
  "fund", "pvt", "ltd", "limited", "llp", "investment", "managers", "asset",
  "management", "amc", "portfolio", "plan", "growth", "regular", "direct",
  "private", "client", "advisors", "the", "and", "of", "pms", "aif",
]);
function wrapperTokens(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((t) => t && !WRAPPER_STOP.has(t)));
}
function tokenOverlap(query: string, candidate: string): number {
  const q = wrapperTokens(query);
  if (!q.size) return 0;
  const c = wrapperTokens(candidate);
  let n = 0;
  for (const t of q) if (c.has(t)) n++;
  return n / q.size;
}
function findE6Eval(evidence: EvidenceBundle | null, ref: string): E6PerProduct | null {
  const evals = evidence?.e6?.per_product_evaluations;
  if (!evals || evals.length === 0) return null;
  let best: E6PerProduct | null = null;
  let bestScore = 0;
  for (const e of evals) {
    const s = tokenOverlap(ref, e.instrument);
    if (s > bestScore) { bestScore = s; best = e; }
  }
  return bestScore >= 0.6 ? best : null;
}

function holdingKind(subCategory: string): A3HoldingKind {
  if (subCategory.startsWith("pms_") || subCategory.startsWith("aif_")) return "opaque";
  if (subCategory.startsWith("mf_") || subCategory.startsWith("listed_") || subCategory.startsWith("intl_")) return "transparent";
  return "allocation";
}

/* ----- Layer 1: per-holding signal set ----- */

function findHoldingStats(riskReward: RiskRewardOutput | null, ref: string): HoldingStats | null {
  if (!riskReward) return null;
  const key = normalise(ref);
  return riskReward.per_holding.find((s) => normalise(s.holding_ref) === key) ?? null;
}

/* Performance. Transparent: Sharpe/Sortino below zero is the concern marker
 * (the natural risk-free boundary; no invented threshold). Opaque/allocation:
 * no tier_b, so numeric performance is sentinelled (for opaque the qualitative
 * read lives in Cost via complexity_premium_earned). */
function performanceSignal(stats: HoldingStats | null, kind: A3HoldingKind): A3DimensionSignal {
  if (kind !== "transparent" || !stats || stats.source === "sentinel" || !stats.stats) {
    const detail =
      kind === "opaque"
        ? "performance numeric not assessable (opaque wrapper, no tier_b); qualitative read via complexity_premium_earned"
        : kind === "allocation"
          ? "performance not assessable: allocation instrument (no tier_b)"
          : stats?.sentinel
            ? `performance not assessable: ${stats.sentinel}`
            : "performance not assessable: no tier_b stats (insufficient history)";
    return { dimension: "performance", status: "sentinelled", hard_number: true, concern: false, detail };
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
    dimension: "performance", status: "assessable", hard_number: true, concern,
    detail: parts.length ? parts.join(", ") : "tier_b present, no risk-adjusted return fields",
  };
}

/* Redundancy. Numeric overlap where present (sentinelled for opaque, which
 * resolves at categorical). For opaque, the E6 strategy profile carries a
 * qualitative overlap read. No non-invented threshold, so concern is never set
 * deterministically; the value informs the LLM. */
function redundancySignal(overlap: PortfolioOverlapOutput | null, ref: string, kind: A3HoldingKind, e6: E6PerProduct | null): A3DimensionSignal {
  if (kind === "opaque" && e6) {
    const prof = (e6.concentration_or_strategy_profile ?? "").slice(0, 160);
    return { dimension: "redundancy", status: "assessable", hard_number: true, concern: false, detail: `qualitative (E6 strategy profile): ${prof}` };
  }
  if (!overlap) {
    return { dimension: "redundancy", status: "sentinelled", hard_number: true, concern: false, detail: "redundancy not assessable: portfolio_overlap absent" };
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
    return { dimension: "redundancy", status: "sentinelled", hard_number: true, concern: false, detail: "redundancy not assessable: no within-sleeve overlap pair" };
  }
  return { dimension: "redundancy", status: "assessable", hard_number: true, concern: false, detail: `max overlap ${round1(best.score * 100) / 100} with ${best.other} (${best.layer})` };
}

/* Thesis/quality. Opaque: the matched E6 overall_verdict (negative is the
 * concern marker). Transparent: A2's thesis driver (A2 mapped the E1/E7 verdict
 * to an escalate-severity driver for a negative verdict). Allocation: no thesis. */
function thesisSignal(h: A2HoldingVerdict, kind: A3HoldingKind, e6: E6PerProduct | null): A3DimensionSignal {
  if (kind === "opaque") {
    if (!e6) {
      return { dimension: "thesis_quality", status: "sentinelled", hard_number: false, concern: false, detail: "thesis not assessable: no E6 record matched for this opaque holding" };
    }
    const negative = e6.overall_verdict === "negative";
    return { dimension: "thesis_quality", status: "assessable", hard_number: false, concern: negative, detail: `E6 overall_verdict ${e6.overall_verdict}` };
  }
  const thesisDrivers = h.drivers.filter((d) => d.driver_type === "thesis");
  if (thesisDrivers.length === 0) {
    return { dimension: "thesis_quality", status: "sentinelled", hard_number: false, concern: false, detail: "thesis not flagged by the evidence layer for this holding" };
  }
  const negative = thesisDrivers.some((d) => d.severity === "escalate");
  const obs = thesisDrivers[0]?.source_observation ?? "thesis";
  return { dimension: "thesis_quality", status: "assessable", hard_number: false, concern: negative, detail: negative ? `negative evidence verdict (${obs})` : `evidence verdict caution (${obs})` };
}

/* Cost-efficiency. Opaque: E6 fee_normalised_bps plus complexity_premium_earned
 * (the concern marker is "no", the fee premium not earned, an assessable
 * judgment E6 makes). Transparent/allocation: raw fee exists (E7 ter_pct) but
 * no fee-vs-peer benchmark, so the concern is not computable; sentinelled. P37
 * (benchmarking) would enrich the transparent side. */
function costSignal(kind: A3HoldingKind, e6: E6PerProduct | null): A3DimensionSignal {
  if (kind === "opaque" && e6) {
    const cpe = e6.complexity_premium_earned;
    const concern = cpe === "no";
    return { dimension: "cost_efficiency", status: "assessable", hard_number: false, concern, detail: `fee ${e6.fee_normalised_bps ?? "n/a"} bps, complexity_premium_earned ${cpe}` };
  }
  return { dimension: "cost_efficiency", status: "sentinelled", hard_number: false, concern: false, detail: "cost-efficiency not deterministically assessable: raw fees exist but no fee-vs-peer benchmark is computed" };
}

/* Suitability/mandate (thin). E4 divergence is portfolio-level, not per-holding. */
function suitabilitySignal(evidence: EvidenceBundle | null): A3DimensionSignal {
  const div = evidence?.e4?.stated_vs_revealed_divergence;
  const detail = div && div.magnitude !== "none"
    ? `portfolio-level stated-revealed divergence: ${div.magnitude} (${div.direction})`
    : "suitability not assessable per-holding (mandate fit is portfolio-level)";
  return { dimension: "suitability", status: "sentinelled", hard_number: false, concern: false, detail };
}

function computeSignals(
  h: A2HoldingVerdict,
  kind: A3HoldingKind,
  stats: HoldingStats | null,
  overlap: PortfolioOverlapOutput | null,
  evidence: EvidenceBundle | null,
  e6: E6PerProduct | null,
): A3DimensionSignal[] {
  return [
    redundancySignal(overlap, h.holding_ref, kind, e6),
    costSignal(kind, e6),
    performanceSignal(stats, kind),
    thesisSignal(h, kind, e6),
    suitabilitySignal(evidence),
    // Signal details may copy upstream evidence prose (e.g., the opaque
    // redundancy detail copies E6's strategy profile, which can carry a long
    // dash). Strip per WA07; the canonical sanitiser is idempotent on the
    // constructed numeric details.
  ].map((s) => ({ ...s, detail: stripLongDashes(s.detail) }));
}

/* Type-specific exit-eligibility gate (deterministic; sets who may be CONSIDERED
 * for exit). Exit is a high bar. Transparent: hard-number Performance-concern
 * AND Thesis-concern. Opaque: Thesis-concern (E6 negative) AND Cost-concern
 * (complexity premium not earned), the conservative qualitative convergence the
 * audit established. Allocation: never. Redundancy informs the LLM but never
 * gates (no non-invented threshold); logged as a boundary (P38). */
function computeExitEligible(kind: A3HoldingKind, signals: A3DimensionSignal[]): boolean {
  const get = (dim: A3Dimension) => signals.find((s) => s.dimension === dim);
  const fails = (dim: A3Dimension) => {
    const s = get(dim);
    return s?.status === "assessable" && s.concern;
  };
  if (kind === "opaque") return Boolean(fails("thesis_quality") && fails("cost_efficiency"));
  if (kind === "transparent") return Boolean(fails("performance") && fails("thesis_quality"));
  return false;
}

function buildReconciledDecisions(input: A3Input): A3ReconciledDecision[] {
  const { a2Output, metrics, riskReward, overlap, evidence } = input;
  const flagByInstrument = new Map<string, number>();
  if (metrics) {
    for (const pf of metrics.concentration.positionFlags) flagByInstrument.set(normalise(pf.instrument), pf.weightPct);
  }

  const decisions: A3ReconciledDecision[] = [];
  for (const h of a2Output.holding_verdicts) {
    const kind = holdingKind(h.sub_category);
    const e6 = kind === "opaque" ? findE6Eval(evidence, h.holding_ref) : null;
    const stats = findHoldingStats(riskReward, h.holding_ref);
    const signals = computeSignals(h, kind, stats, overlap, evidence, e6);
    const exitEligible = computeExitEligible(kind, signals);
    const overConcentrated = (flagByInstrument.get(normalise(h.holding_ref)) ?? 0) > TARGET_WEIGHT_PCT;

    // Baseline decision (deterministic): over-concentrated -> trim to 10%;
    // other holdings -> maintain. Exit is never a baseline decision; only the
    // Layer-2 judgment may set it, and only when exit_eligible.
    const decision: A3DecisionKind = overConcentrated ? "trim" : "maintain";

    const dimensions_failing = signals
      .filter((s) => s.status === "assessable" && s.concern)
      .map((s) => s.dimension);

    decisions.push({
      holding_ref: h.holding_ref,
      instrument_display_name: h.instrument_display_name,
      asset_class: h.asset_class,
      sub_category: h.sub_category,
      weight_pct: h.weight_pct,
      holding_kind: kind,
      tax_product_family: taxProductFamily(h.sub_category),
      over_concentrated: overConcentrated,
      a2_verdict: h.verdict,
      signals,
      exit_eligible: exitEligible,
      decision,
      dimensions_failing,
      exit_rationale: "",
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
    const resulting = k === steps ? round1(target) : round1(currentWeight - (totalTrim * k) / steps);
    path.push({ step: k, trim_pct_points: round1(prevWeight - resulting), resulting_weight_pct: resulting, trigger_at_weight_pct: prevWeight });
    prevWeight = resulting;
  }
  return path;
}

/* ----- Layer 1: deterministic redeployment vs MODEL_BANDS ----- */

const ASSET_CLASSES = ["Equity", "Debt", "Alternatives", "Cash"] as const;

export function computeRedeployment(decisions: A3ReconciledDecision[], metrics: PortfolioMetrics): A3Redeployment {
  let freed = 0;
  for (const d of decisions) {
    if (d.decision === "trim") freed += Math.max(0, d.weight_pct - TARGET_WEIGHT_PCT);
    else if (d.decision === "exit") freed += d.weight_pct;
  }
  freed = round1(freed);

  const under = ASSET_CLASSES
    .filter((c) => c !== "Cash")
    .map((c) => {
      const a = metrics.assetClass[c];
      // Deployment capacity is headroom to the UPPER band (band[1]), not the
      // target: a sleeve at its target still has legitimate room before it is
      // over-allocated. This is the Finding 4 fix; the upper band is already on
      // the metrics A3 receives.
      const upperBand = a.band[1];
      return { sleeve: c, current: a.actualPct, target: a.targetPct, upperBand, gap: Math.max(0, upperBand - a.actualPct) };
    })
    .filter((x) => x.gap > 0);

  const totalGap = under.reduce((s, x) => s + x.gap, 0);
  const deployments: A3RedeploymentTarget[] = [];
  let deployed = 0;

  if (freed > 0 && totalGap > 0) {
    const deployable = Math.min(freed, totalGap);
    for (const u of under) {
      const add = round1((u.gap / totalGap) * deployable);
      if (add <= 0) continue;
      deployments.push({ sleeve: u.sleeve, current_pct: round1(u.current), target_pct: round1(u.target), upper_band_pct: round1(u.upperBand), add_pct_points: add, resulting_pct: round1(u.current + add) });
      deployed += add;
    }
  }
  deployed = round1(deployed);
  const leftover = round1(freed - deployed);

  let note: string;
  if (freed <= 0) note = "No trims or exits, so no capital is freed for redeployment.";
  else if (totalGap <= 0) note = `No sleeve sits below its upper band, so the freed ${freed} points have no model-consistent destination and are reported as leftover to cash.`;
  else if (leftover > 0) note = `Freed ${freed} points exceeds the ${round1(totalGap)} points of headroom to the sleeves' upper bands; sleeves are filled to their upper band and the remaining ${leftover} points are reported as leftover to cash.`;
  else note = `Freed ${freed} points deployed toward under-allocated sleeves up to their upper bands, moving the allocation toward the model.`;

  return { freed_capital_pct: freed, deployments, leftover_to_cash_pct: leftover, note };
}

/* ----- Layer 1: surfaces derived from the reconciled decision ----- */

function buildHoldingActions(decisions: A3ReconciledDecision[]): A3HoldingAction[] {
  const out: A3HoldingAction[] = [];
  for (const d of decisions) {
    if (d.decision === "maintain" && d.a2_verdict === "maintain") continue;
    const base = { holding_ref: d.holding_ref, instrument_display_name: d.instrument_display_name, a2_verdict: d.a2_verdict as A3HoldingVerdict };
    if (d.a2_verdict === "unable_to_classify") {
      out.push({ ...base, kind: "sentinel", sentinel_reason: "upstream_evidence_unavailable", note: `Recommendation not surfaced: the Samriddhi 2 diagnostic could not classify ${d.instrument_display_name}.` });
      continue;
    }
    out.push({
      ...base,
      kind: "action",
      decision: d.decision,
      source_observation: d.dimensions_failing.length > 0 ? d.dimensions_failing.join("+") : (d.over_concentrated ? "position_over_concentration" : "a2_flag"),
      advisor_action: "",
    });
  }
  return out;
}

function buildRebalanceProposal(decisions: A3ReconciledDecision[], metrics: PortfolioMetrics | null): A3RebalanceProposal {
  if (!metrics) {
    return { kind: "sentinel", sentinel_reason: "upstream_evidence_unavailable", note: "Rebalance proposal not surfaced: M0.PortfolioRiskAnalytics metrics absent." };
  }
  const positions: A3RebalancePosition[] = [];
  for (const d of decisions) {
    if (d.decision !== "trim" && d.decision !== "exit") continue;
    const target = d.decision === "exit" ? 0 : TARGET_WEIGHT_PCT;
    const breachThreshold = d.weight_pct >= POSITION_ESCALATE_PCT ? POSITION_ESCALATE_PCT : POSITION_FLAG_PCT;
    positions.push({
      instrument: d.instrument_display_name,
      decision: d.decision,
      current_weight_pct: round1(d.weight_pct),
      breach_threshold_pct: breachThreshold,
      target_weight_pct: target,
      total_trim_pct_points: round1(d.weight_pct - target),
      glide_path: buildGlidePath(d.weight_pct, target),
    });
  }
  const redeployment = computeRedeployment(decisions, metrics);
  if (positions.length === 0) {
    return { kind: "no_action_needed", note: "No holding is decided for trim or exit; no rebalance proposed." };
  }
  return { kind: "proposal", computed: { positions, redeployment }, narrated: { advisor_action: "", generation_method: "llm" } };
}

const OBSERVATION_ORDER: A3ObservationCategory[] = [
  "position_over_concentration", "sector_over_concentration", "wrapper_over_accumulation",
  "cash_drag", "allocation_drift", "liquidity_gap", "stated_revealed_divergence", "complexity_premium_not_earned",
];
function isA3ObservationCategory(s: string): s is A3ObservationCategory {
  return (OBSERVATION_ORDER as string[]).includes(s);
}
function buildObservationActions(a2Output: A2Output, preObservations: PreObservation[]): A3ObservationAction[] {
  const bestSeverity = new Map<A3ObservationCategory, string>();
  const consider = (category: string, severity: string) => {
    if (!isA3ObservationCategory(category)) return;
    const prev = bestSeverity.get(category);
    if (prev === undefined || (SEVERITY_RANK[severity] ?? 0) > (SEVERITY_RANK[prev] ?? 0)) bestSeverity.set(category, severity);
  };
  for (const o of preObservations) consider(o.vocab_candidate, o.severity_hint);
  for (const h of a2Output.holding_verdicts) {
    for (const d of h.drivers) if (d.source_observation === "sector_over_concentration") consider("sector_over_concentration", d.severity);
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

/* ----- Layer 2: regulatory + operational context for the prompts (Finding 2) -----
 *
 * Both the judgment call and the narration call receive, per holding, its
 * tax_matrix treatment (product-structure-scoped, from M0), any snapshot
 * operational metadata (PMS lock-in / exit-load, AIF tenure / redemption /
 * min-commitment, MF exit-load), and the SEBI minimum ticket where it bears on
 * a partial trim. Reading B is load-bearing: a field absent here MUST stay
 * silent in the prose; the narration is hard-constrained to cite only what is
 * passed, never to invent a lock-in, tax rate, ticket threshold, or window. */

type A3RegContext = {
  indianContext: A3IndianContext | null;
  operationalByRef: Map<string, A3OperationalMetadata>;
  taxByFamily: Map<A3TaxProductFamily, A3TaxBundle>;
};

function buildRegContext(input: A3Input): A3RegContext {
  const operationalByRef = new Map<string, A3OperationalMetadata>();
  for (const op of input.operational) operationalByRef.set(normalise(op.holding_ref), op);
  const taxByFamily = new Map<A3TaxProductFamily, A3TaxBundle>();
  for (const b of input.indianContext?.tax_by_product ?? []) taxByFamily.set(b.product_family, b);
  return { indianContext: input.indianContext, operationalByRef, taxByFamily };
}

type A3HoldingRegContext = {
  tax_treatment: { family: string; entries: { topic: string; rule: Record<string, unknown> | null; citation: string }[] } | null;
  operational: A3OperationalMetadata | null;
  sebi_min_ticket_cr: number | null;
};

/* Compact cite-only context for one holding. Returns null sub-fields where the
 * data is genuinely absent so the prompt carries no placeholder to speculate on. */
function holdingRegContext(d: A3ReconciledDecision, reg: A3RegContext): A3HoldingRegContext {
  const operational = reg.operationalByRef.get(normalise(d.holding_ref)) ?? null;
  const bundle = d.tax_product_family ? reg.taxByFamily.get(d.tax_product_family) ?? null : null;
  const tax_treatment = bundle
    ? { family: bundle.label, entries: bundle.entries.map((e) => ({ topic: e.topic, rule: e.rule, citation: e.citation })) }
    : null;
  let sebi_min_ticket_cr: number | null = null;
  if (reg.indianContext) {
    const fam = d.tax_product_family;
    const want = fam === "pms" ? "pms" : fam === "aif_cat_ii" || fam === "aif_cat_iii" ? "aif" : null;
    if (want) sebi_min_ticket_cr = reg.indianContext.sebi_minimums.find((m) => m.product === want)?.min_ticket_cr ?? null;
  }
  return { tax_treatment, operational, sebi_min_ticket_cr };
}

function decisionsByRef(decisions: A3ReconciledDecision[]): Map<string, A3ReconciledDecision> {
  const m = new Map<string, A3ReconciledDecision>();
  for (const d of decisions) m.set(normalise(d.holding_ref), d);
  return m;
}

/* ----- Layer 2: LLM advisor-action prose (baseline narration; judgment lands in Step 2b) ----- */

type A3ReasonPayload = {
  holding_actions: Array<{ holding_ref: string; advisor_action: string }>;
  observation_actions: Array<{ observation_category: string; advisor_action: string }>;
  rebalance_advisor_action?: string;
  one_line_characterization: string;
  reasoning_summary: string;
};

function buildReasonPrompt(layer1: A3Layer1Result, reg: A3RegContext): string {
  const byRef = decisionsByRef(layer1.decisions);
  const holdingsNeedingProse = layer1.holding_actions
    .filter((h): h is A3HoldingAction & A3HoldingActionBody => h.kind === "action")
    .map((h) => {
      const d = byRef.get(normalise(h.holding_ref));
      return {
        holding_ref: h.holding_ref,
        instrument: h.instrument_display_name,
        a2_verdict: h.a2_verdict,
        decision: h.decision,
        source_observation: h.source_observation,
        regulatory_operational_context: d ? holdingRegContext(d, reg) : null,
      };
    });
  const observationsNeedingProse = layer1.observation_actions
    .filter((o): o is A3ObservationAction & A3ObservationActionBody => o.kind === "action")
    .map((o) => ({ observation_category: o.observation_category, severity_hint: o.severity_hint }));
  const rebalance = layer1.rebalance_proposal.kind === "proposal" ? layer1.rebalance_proposal.computed : null;
  const regSummary = reg.indianContext
    ? { investor_structure: reg.indianContext.investor_structure, sebi_minimums: reg.indianContext.sebi_minimums }
    : null;

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
    `## Operational, tax, and regulatory context (Reading B, cite-only)`,
    ``,
    `Each holding below carries a regulatory_operational_context: its tax`,
    `treatment (tax_treatment, the tax_matrix entries and their rule fields for`,
    `the holding's product family), any snapshot operational metadata`,
    `(operational: PMS lock-in / exit-load, AIF SEBI category / tenure /`,
    `redemption / min-commitment, mutual-fund exit-load), and the SEBI minimum`,
    `ticket (sebi_min_ticket_cr). Ground a meaningful trim or exit in this where`,
    `it is present: the capital-gains implication and the LTCG / STCG rate and`,
    `threshold from tax_treatment, the holding period and any indexation, an`,
    `exit-load or lock-in that affects the STAGING of an action already decided,`,
    `and whether a partial trim risks dropping below the SEBI minimum ticket.`,
    `Operational frictions stage a decided action; they never cancel, downgrade,`,
    `or defer the decision itself (a position decided for exit is exited, staged`,
    `around the load). Treat effective_lock_in_years as the product's lock-in`,
    `PERIOD, a structural attribute, NOT remaining lock-in time: do not assert the`,
    `position "sits within" a lock-in, that a lock-in will "roll off", or any`,
    `remaining duration; state it factually (for example, "carries a one-year`,
    `lock-in and a 2% year-one exit-load"). Reading B is strict and load-bearing:`,
    `cite ONLY fields actually present in the context; where a field is absent,`,
    `say nothing about it. Never write that a detail is "unknown" or "not`,
    `available" (that invites speculation); simply omit it. Never invent a`,
    `lock-in, exit-load, tax rate, threshold, redemption window, or ticket figure.`,
    `Cite figures as given (for example LTCG 12.5% above the Rs 1.25 L threshold,`,
    `STCG 20%); do not compute a tax amount.`,
    ``,
    "```json",
    JSON.stringify({ portfolio_regulatory_context: regSummary }, null, 2),
    "```",
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
      `reinvested. Tell it as one coherent story: which trims and exits free the`,
      `capital, and which under-allocated sleeves receive it.`,
      ``,
      `Where a trimmed or exited position carries operational or tax context in`,
      `its per-holding regulatory_operational_context above, ground the staging`,
      `rationale in it: an exit-load or lock-in that argues for staging the sale,`,
      `the capital-gains event the sale triggers (with the cited LTCG / STCG rate`,
      `and threshold), and whether a partial trim risks the SEBI minimum-ticket`,
      `residual. Reading B holds: cite only what is present for that position.`,
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

export async function runA3ReasonText(layer1: A3Layer1Result, reg: A3RegContext): Promise<AgentCallResult<A3ReasonPayload>> {
  return callAgent<A3ReasonPayload>({ skillId: "a3_so_what", userPrompt: buildReasonPrompt(layer1, reg), validate: validateReasonPayload });
}

/* ----- Layer 2 call 1: the trim / exit / maintain judgment ----- */

type A3JudgmentRow = {
  holding_ref: string;
  decision: A3DecisionKind;
  dimensions_failing: A3Dimension[];
  exit_rationale: string;
};
type A3JudgmentPayload = { judgments: A3JudgmentRow[] };

function buildJudgmentPrompt(eligible: A3ReconciledDecision[], reg: A3RegContext): string {
  const rows = eligible.map((d) => ({
    holding_ref: d.holding_ref,
    instrument: d.instrument_display_name,
    holding_kind: d.holding_kind,
    weight_pct: d.weight_pct,
    over_concentrated: d.over_concentrated,
    valid_decisions: d.over_concentrated ? ["trim", "exit"] : ["maintain", "exit"],
    signals: d.signals.map((s) => ({ dimension: s.dimension, status: s.status, concern: s.concern, detail: s.detail })),
    regulatory_operational_context: holdingRegContext(d, reg),
  }));
  return [
    `# A3 Trim / Exit / Maintain Judgment`,
    ``,
    `Decide each holding's action by reasoning ONLY over the computed signals`,
    `below. Do not invent or assume any figure not present; cite the actual`,
    `numbers and verdicts from the signals.`,
    ``,
    `## The rule`,
    ``,
    `Trim is the default. EXIT is a high bar: recommend exit only on a strong,`,
    `cited, multi-dimension convergence where trim is articulably insufficient.`,
    `When in doubt, trim. A lone signal is never an exit. Each holding below has`,
    `already passed a deterministic exit-eligibility gate, so exit is permitted;`,
    `your job is to confirm whether exit is genuinely warranted or whether trim`,
    `(or maintain, where there is no concentration to trim) is the right call.`,
    ``,
    `Respect valid_decisions per holding: an over-concentrated holding is trim or`,
    `exit; a holding that is not over-concentrated is maintain or exit (there is`,
    `no concentration to trim).`,
    ``,
    `For opaque wrappers the numeric performance is unavailable; the convergence`,
    `rests on the E6 verdict and complexity-premium signals, which carry a`,
    `confidence discount. Judge conservatively: prefer maintain or trim unless`,
    `the qualitative convergence is unambiguous.`,
    ``,
    `## Operational and regulatory context (regulatory_operational_context)`,
    ``,
    `The trim / exit / maintain decision is made on the MERIT signals above`,
    `(thesis, cost, performance). Operational and regulatory context does NOT`,
    `change that decision and is NEVER a reason to maintain or hold a position the`,
    `merit signals warrant exiting; it informs only HOW an exit is staged, which`,
    `the narration handles later. In particular:`,
    `- effective_lock_in_years is the product's lock-in PERIOD (a structural`,
    `  attribute of the wrapper), NOT remaining lock-in time. It does not tell you`,
    `  the position is still locked, so it cannot make an exit unavailable and is`,
    `  not grounds to defer an exit to "after the lock-in".`,
    `- An exit-load (exit_load) is a cost to stage around, not a reason to keep a`,
    `  broken-thesis position: it argues for staging the exit, never for cancelling`,
    `  or downgrading it to trim or maintain.`,
    `- tax_treatment and the SEBI minimum ticket (sebi_min_ticket_cr) are staging`,
    `  and sizing context, not overrides of the merit decision.`,
    `Reading B holds: if a field is absent it is unknown; never assume a lock-in,`,
    `load, redemption window, or any remaining duration.`,
    ``,
    "```json",
    JSON.stringify(rows, null, 2),
    "```",
    ``,
    `## Output`,
    ``,
    `Return a single fenced JSON block:`,
    "```json",
    `{ "judgments": [ { "holding_ref": "<verbatim>", "decision": "<one of valid_decisions>", "dimensions_failing": ["<dimensions that drove it>"], "exit_rationale": "<REQUIRED and non-empty ONLY when decision is exit: which dimensions converged, the cited figures, and why trim is insufficient; empty string otherwise>" } ] }`,
    "```",
    ``,
    `One entry per holding_ref above, no others. No prose outside the fence.`,
  ].join("\n");
}

function validateJudgmentPayload(parsed: unknown): A3JudgmentPayload {
  if (typeof parsed !== "object" || parsed === null) throw new Error("A3 judgment output is not an object");
  const o = parsed as Record<string, unknown>;
  if (!Array.isArray(o.judgments)) throw new Error("A3 judgment output.judgments must be an array");
  for (const r of o.judgments as unknown[]) {
    const row = r as Record<string, unknown>;
    if (typeof row.holding_ref !== "string" || row.holding_ref.trim() === "") throw new Error("A3 judgment row missing holding_ref");
    if (row.decision !== "trim" && row.decision !== "exit" && row.decision !== "maintain") throw new Error(`A3 judgment row ${String(row.holding_ref)}: decision must be trim, exit, or maintain`);
    if (row.decision === "exit" && (typeof row.exit_rationale !== "string" || row.exit_rationale.trim() === "")) throw new Error(`A3 judgment row ${String(row.holding_ref)}: exit requires a non-empty exit_rationale (guardrail 2)`);
  }
  return o as unknown as A3JudgmentPayload;
}

async function runA3Judgment(eligible: A3ReconciledDecision[], reg: A3RegContext): Promise<AgentCallResult<A3JudgmentPayload>> {
  return callAgent<A3JudgmentPayload>({ skillId: "a3_so_what", userPrompt: buildJudgmentPrompt(eligible, reg), validate: validateJudgmentPayload });
}

/* Apply judged decisions to the reconciled decisions. Only exit-eligible
 * holdings are judged; the rest keep their deterministic baseline. The judged
 * decision is clamped to the holding's valid space (defensive): an
 * over-concentrated holding is never simply maintained (at least trim); a
 * holding with no concentration cannot be trimmed (maintain or exit). */
function applyJudgment(decisions: A3ReconciledDecision[], judgments: A3JudgmentRow[]): A3ReconciledDecision[] {
  const byRef = new Map(judgments.map((j) => [j.holding_ref, j]));
  return decisions.map((d) => {
    if (!d.exit_eligible) return d;
    const j = byRef.get(d.holding_ref);
    if (!j) return d;
    let decision = j.decision;
    if (d.over_concentrated) {
      if (decision === "maintain") decision = "trim";
    } else if (decision === "trim") {
      decision = "maintain";
    }
    return {
      ...d,
      decision,
      dimensions_failing: Array.isArray(j.dimensions_failing) && j.dimensions_failing.length ? j.dimensions_failing : d.dimensions_failing,
      exit_rationale: decision === "exit" ? j.exit_rationale : "",
      judgment_reasoning: j.exit_rationale || d.judgment_reasoning,
    };
  });
}

/* ----- Orchestration ----- */

export type A3DiagnosticResult = {
  output: A3Output;
  usage: AgentUsage;
  /** Narration-call (Layer-2 call 2) response id + model. */
  responseId?: string;
  responseModel?: string;
  /** Judgment-call (Layer-2 call 1) response id, when a judgment ran. */
  judgmentResponseId?: string;
};

function countSurfaced<T extends { kind: "action" | "sentinel" }>(items: T[]): { surfaced: number; sentinelled: number } {
  let surfaced = 0, sentinelled = 0;
  for (const i of items) (i.kind === "action" ? surfaced++ : sentinelled++);
  return { surfaced, sentinelled };
}
function needsLayer2(layer1: A3Layer1Result): boolean {
  return layer1.holding_actions.some((h) => h.kind === "action") || layer1.observation_actions.some((o) => o.kind === "action") || layer1.rebalance_proposal.kind === "proposal";
}
function decisionCounts(decisions: A3ReconciledDecision[]): { trim: number; exit: number } {
  let trim = 0, exit = 0;
  for (const d of decisions) { if (d.decision === "trim") trim++; else if (d.decision === "exit") exit++; }
  return { trim, exit };
}

export async function runA3Diagnostic(input: A3Input): Promise<A3DiagnosticResult> {
  const layer1 = computeA3(input);
  const reg = buildRegContext(input);

  if (!needsLayer2(layer1)) {
    const c0 = countSurfaced(layer1.holding_actions);
    const o0 = countSurfaced(layer1.observation_actions);
    const dc0 = decisionCounts(layer1.decisions);
    const output: A3Output = {
      agent_id: "a3_so_what",
      case_id: layer1.case_id,
      as_of_date: layer1.as_of_date,
      decisions: layer1.decisions,
      holding_actions: layer1.holding_actions,
      observation_actions: layer1.observation_actions,
      rebalance_proposal: layer1.rebalance_proposal,
      summary: {
        holding_actions_surfaced: c0.surfaced,
        holding_actions_sentinelled: c0.sentinelled,
        observation_actions_surfaced: o0.surfaced,
        observation_actions_sentinelled: o0.sentinelled,
        trim_count: dc0.trim,
        exit_count: dc0.exit,
        rebalance: layer1.rebalance_proposal.kind,
        one_line_characterization: "No advisor actions surfaced from the Samriddhi 2 diagnostic for this case.",
      },
      reasoning_summary:
        "A3 surfaced no advisor actions: the Samriddhi 2 diagnostic flagged no holdings for Monitor, Discuss, or Review, no portfolio-level observations, and no single-position concentration breach. Portfolio-level health remains the Samriddhi 2 diagnostic surface's characterisation, not A3's.",
      indian_context: input.indianContext,
      operational: input.operational,
    };
    return { output, usage: { inputTokens: 0, outputTokens: 0 } };
  }

  // Layer-2 call 1: the trim/exit/maintain judgment, over exit-eligible holdings
  // only (the rest keep their deterministic baseline).
  const eligible = layer1.decisions.filter((d) => d.exit_eligible);
  let judgedDecisions = layer1.decisions;
  let judgeUsage: AgentUsage = { inputTokens: 0, outputTokens: 0 };
  let judgmentResponseId: string | undefined;
  if (eligible.length > 0) {
    const jr = await runA3Judgment(eligible, reg);
    judgedDecisions = applyJudgment(layer1.decisions, jr.output.judgments);
    judgeUsage = jr.usage;
    judgmentResponseId = jr.id;
  }

  // Deterministic re-compute of surfaces and redeployment from the judged
  // decisions (exit frees full weight; trim frees weight above the 10% ceiling).
  const finalLayer1: A3Layer1Result = {
    case_id: layer1.case_id,
    as_of_date: layer1.as_of_date,
    decisions: judgedDecisions,
    holding_actions: buildHoldingActions(judgedDecisions),
    observation_actions: layer1.observation_actions,
    rebalance_proposal: buildRebalanceProposal(judgedDecisions, input.metrics),
  };
  const holdingCounts = countSurfaced(finalLayer1.holding_actions);
  const observationCounts = countSurfaced(finalLayer1.observation_actions);
  const dc = decisionCounts(finalLayer1.decisions);

  // Layer-2 call 2: constrained narration of the computed surfaces. The
  // narration receives the computed numbers as FIXED input and may only phrase
  // them; it cannot recompute or invent (the structural anti-fabrication
  // guarantee: the numbers are already proven to close in deterministic verify).
  const reasonResult = await runA3ReasonText(finalLayer1, reg);
  const payload = reasonResult.output;
  const holdingProse = new Map<string, string>();
  for (const r of payload.holding_actions) holdingProse.set(r.holding_ref, r.advisor_action);
  const observationProse = new Map<string, string>();
  for (const r of payload.observation_actions) observationProse.set(r.observation_category, r.advisor_action);

  const holding_actions: A3HoldingAction[] = finalLayer1.holding_actions.map((h) => {
    if (h.kind !== "action") return h;
    const prose = holdingProse.get(h.holding_ref);
    if (!prose) throw new Error(`A3 narration did not return an advisor_action for holding ${h.holding_ref}. Computed structure is intact; rerun narration.`);
    return { ...h, advisor_action: stripLongDashes(prose) };
  });
  const observation_actions: A3ObservationAction[] = finalLayer1.observation_actions.map((o) => {
    if (o.kind !== "action") return o;
    const prose = observationProse.get(o.observation_category);
    if (!prose) throw new Error(`A3 narration did not return an advisor_action for observation ${o.observation_category}. Computed structure is intact; rerun narration.`);
    return { ...o, advisor_action: stripLongDashes(prose) };
  });

  let rebalance_proposal: A3RebalanceProposal = finalLayer1.rebalance_proposal;
  if (finalLayer1.rebalance_proposal.kind === "proposal") {
    const prose = payload.rebalance_advisor_action;
    if (!prose || prose.trim() === "") throw new Error("A3 narration did not return rebalance_advisor_action for a proposal. Computed glide-path and redeployment are intact; rerun narration.");
    rebalance_proposal = { kind: "proposal", computed: finalLayer1.rebalance_proposal.computed, narrated: { advisor_action: stripLongDashes(prose), generation_method: "llm" } };
  }

  const output: A3Output = {
    agent_id: "a3_so_what",
    case_id: finalLayer1.case_id,
    as_of_date: finalLayer1.as_of_date,
    decisions: judgedDecisions,
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
      rebalance: finalLayer1.rebalance_proposal.kind,
      one_line_characterization: stripLongDashes(payload.one_line_characterization),
    },
    reasoning_summary: stripLongDashes(payload.reasoning_summary),
    indian_context: input.indianContext,
    operational: input.operational,
  };
  return {
    output,
    usage: { inputTokens: judgeUsage.inputTokens + reasonResult.usage.inputTokens, outputTokens: judgeUsage.outputTokens + reasonResult.usage.outputTokens },
    responseId: reasonResult.id,
    responseModel: reasonResult.model,
    judgmentResponseId,
  };
}
