/* M0.Stitcher, deterministic transform.
 *
 * Per m0_stitcher.md §Role: in cluster 5/6 (today) Stitcher operates as
 * structured templating. The LLM-mode narrative composition activates
 * in cluster 12+. Slice 2 implements the deterministic path: bundle the
 * portfolio metrics, the activated evidence verdicts, and the router
 * decision into a single StitchedContext object that S1.diagnostic_mode
 * consumes.
 *
 * The no-invention discipline (consolidation v1 §8.6): Stitcher does not
 * invent content. It assembles. The pre-observation candidates surfaced
 * here are pointers based on threshold breaches in the metrics; the
 * synthesis into named foundation §3 vocabulary items happens in S1.
 */

import type { PortfolioMetrics } from "./portfolio-risk-analytics";
import type { ApplicabilityVector } from "./router";
import type { E1Output } from "./e1-listed-equity";
import type { E2Output } from "./e2-industry";
import type { E3Output } from "./e3-macro";
import type { E4Output } from "./e4-behavioural";
import type { E6Output } from "./e6-wrappers";
import type { E7Output } from "./e7-mutual-fund";
import type { AgentUsage } from "./harness";

export type EvidenceBundle = {
  e1: E1Output | null;
  e2: E2Output | null;
  e3: E3Output | null;
  e4: E4Output | null;
  e6: E6Output | null;
  e7: E7Output | null;
};

export type UsageBundle = {
  e1?: AgentUsage;
  e2?: AgentUsage;
  e3?: AgentUsage;
  e4?: AgentUsage;
  e6?: AgentUsage;
  e7?: AgentUsage;
  s1?: AgentUsage;
};

/* A pre-observation is a deterministic signal that an observation candidate
 * exists in the data, with a suggested foundation §3 vocabulary item. S1
 * decides whether to synthesise it into the briefing. */
export type PreObservation = {
  vocab_candidate: string;
  source: "metric" | "evidence_agent";
  severity_hint: "ok" | "info" | "flag" | "escalate";
  /** Structured payload S1 can quote from. */
  payload: Record<string, unknown>;
};

export type StitchedContext = {
  case_meta: {
    case_id: string;
    investor_id: string;
    investor_name: string;
    as_of_date: string;
    case_mode: "diagnostic";
    bucket_tier: string;
  };
  router_decision: ApplicabilityVector;
  metrics: PortfolioMetrics;
  evidence: EvidenceBundle;
  pre_observations: PreObservation[];
  usage_summary: {
    total_input_tokens: number;
    total_output_tokens: number;
    per_agent: UsageBundle;
  };
};

export type StitchInput = {
  caseMeta: {
    case_id: string;
    investor_id: string;
    investor_name: string;
    as_of_date: string;
    case_mode: "diagnostic";
    bucket_tier: string;
  };
  metrics: PortfolioMetrics;
  evidence: EvidenceBundle;
  router_decision: ApplicabilityVector;
  usage: UsageBundle;
};

export function stitch(input: StitchInput): StitchedContext {
  const preObs = derivePreObservations(input.metrics, input.evidence);

  const totalInput = sumUsage(input.usage, "input");
  const totalOutput = sumUsage(input.usage, "output");

  return {
    case_meta: input.caseMeta,
    router_decision: input.router_decision,
    metrics: input.metrics,
    evidence: input.evidence,
    pre_observations: preObs,
    usage_summary: {
      total_input_tokens: totalInput,
      total_output_tokens: totalOutput,
      per_agent: input.usage,
    },
  };
}

/* Deterministic detection of observation candidates from the metrics
 * object plus a few evidence-derived hooks. Names use foundation §3
 * vocabulary verbatim; S1 confirms or rejects each candidate. */
function derivePreObservations(
  m: PortfolioMetrics,
  e: EvidenceBundle,
): PreObservation[] {
  const out: PreObservation[] = [];

  // Wrapper over-accumulation
  if (m.concentration.wrappers.wrapperCountFlag || m.concentration.wrappers.wrapperShareFlag) {
    out.push({
      vocab_candidate: "wrapper_over_accumulation",
      source: "metric",
      severity_hint: m.concentration.wrappers.wrapperCountFlag && m.concentration.wrappers.wrapperShareFlag ? "escalate" : "flag",
      payload: {
        pms_count: m.concentration.wrappers.pmsCount,
        pms_aggregate_pct: m.concentration.wrappers.pmsAggregatePct,
        pms_list: m.concentration.wrappers.pmsList,
        aif_count: m.concentration.wrappers.aifCount,
        aif_aggregate_pct: m.concentration.wrappers.aifAggregatePct,
        threshold: "4+ PMS strategies, or any wrapper > 25% of liquid AUM",
      },
    });
  }

  // Position over-concentration
  for (const flag of m.concentration.positionFlags) {
    out.push({
      vocab_candidate: "position_over_concentration",
      source: "metric",
      severity_hint: flag.severity,
      payload: {
        instrument: flag.instrument,
        weight_pct: flag.weightPct,
        threshold: "flag 10%, escalate 15%",
      },
    });
  }

  // Allocation drift
  for (const cls of ["Equity", "Debt", "Alternatives", "Cash"] as const) {
    const a = m.assetClass[cls];
    if (!a.inBand) {
      out.push({
        vocab_candidate: "allocation_drift",
        source: "metric",
        severity_hint: Math.abs(a.deviationPct) > 10 ? "flag" : "info",
        payload: {
          asset_class: cls,
          actual_pct: a.actualPct,
          target_pct: a.targetPct,
          band: a.band,
          deviation_pct: a.deviationPct,
        },
      });
    }
  }

  // Cash drag
  if (m.cashDeployment.cashDragFlag) {
    out.push({
      vocab_candidate: "cash_drag",
      source: "metric",
      severity_hint: m.cashDeployment.deploymentGapPct > 50 ? "escalate" : m.cashDeployment.deploymentGapPct > 10 ? "flag" : "info",
      payload: {
        cash_share_pct: m.cashDeployment.cashSharePct,
        deployment_gap_pct: m.cashDeployment.deploymentGapPct,
        model_cash_target_pct: 3,
        model_cash_ceiling_pct: 5,
      },
    });
  }

  // Liquidity gap
  if (m.liquidity.floorBreach) {
    out.push({
      vocab_candidate: "liquidity_gap",
      source: "metric",
      severity_hint: "flag",
      payload: {
        t30_plus_t90_pct: m.liquidity.t30PlusT90Pct,
        tier: m.liquidity.tier,
        tier_floor: m.liquidity.tierFloor,
      },
    });
  }

  // Stated-revealed divergence from E4
  if (e.e4 && e.e4.stated_vs_revealed_divergence.magnitude !== "none" && e.e4.stated_vs_revealed_divergence.magnitude !== "minor") {
    out.push({
      vocab_candidate: "stated_revealed_divergence",
      source: "evidence_agent",
      severity_hint: e.e4.stated_vs_revealed_divergence.magnitude === "material" ? "flag" : "info",
      payload: {
        direction: e.e4.stated_vs_revealed_divergence.direction,
        magnitude: e.e4.stated_vs_revealed_divergence.magnitude,
        implication: e.e4.stated_vs_revealed_divergence.implication,
      },
    });
  }

  // Complexity premium not earned (E6 surfaces per-product)
  if (e.e6) {
    for (const p of e.e6.per_product_evaluations) {
      if (p.complexity_premium_earned === "no") {
        out.push({
          vocab_candidate: "complexity_premium_not_earned",
          source: "evidence_agent",
          severity_hint: "escalate",
          payload: {
            instrument: p.instrument,
            wrapper_type: p.wrapper_type,
            performance_vs_benchmark: p.performance_vs_benchmark,
            fee_structure: p.fee_structure_assessment,
          },
        });
      }
    }
  }

  return out;
}

function sumUsage(u: UsageBundle, kind: "input" | "output"): number {
  let total = 0;
  for (const k of Object.keys(u) as (keyof UsageBundle)[]) {
    const usage = u[k];
    if (!usage) continue;
    total += kind === "input" ? usage.inputTokens : usage.outputTokens;
  }
  return total;
}
