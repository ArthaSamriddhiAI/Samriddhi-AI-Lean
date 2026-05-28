/* A3.so_what, the advisor-action ("so what") layer.
 *
 * Skill: agents/a3_so_what.md
 *
 * Two-layer shape, like A2, risk-reward-stats, and M0.PortfolioRiskAnalytics:
 *
 *   Layer 1 (computeA3): pure, deterministic. Decides which of the three
 *   surfaces carry an action, links each to the A2 verdict or observation
 *   that produced it, and computes the rebalance glide-path math (target
 *   weight, total trim, per-step trims and triggers, step count). Same
 *   inputs produce the same numbers. This is the audit surface and the
 *   load-bearing computation; it is asserted deterministically in verify.
 *
 *   Layer 2 (runA3ReasonText): one Claude call that writes the recommendatory
 *   advisor-action prose wrapping the Layer 1 structure, plus the one-line
 *   characterisation and reasoning summary. Layer 2 cannot change a computed
 *   number: it returns prose strings only, merged into the Layer 1 structure
 *   here in TypeScript.
 *
 * A3 is the single product surface that recommends an action rather than
 * characterising a state. It runs on Samriddhi 2 (diagnostic) cases, after
 * A2 and M0, consuming their already-produced outputs. It ships as data only
 * (content.a3_so_what); the renderer is untouched (WA09).
 *
 * A3 invents no concentration thresholds: the 10% flag and 15% escalate
 * levels are imported from portfolio-risk-analytics.ts (foundation section 3,
 * single source of truth). The glide-path cadence is A3's own execution-pacing
 * parameter, not a foundation threshold.
 */

import type { A2Output, A2Verdict } from "./a2-classification";
import { stripLongDashes } from "./a2-classification";
import type { PortfolioMetrics } from "./portfolio-risk-analytics";
import { POSITION_FLAG_PCT, POSITION_ESCALATE_PCT } from "./portfolio-risk-analytics";
import type { PreObservation } from "./stitcher";
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

/* Per-holding surface: Monitor / Discuss / Review only, never Maintain.
 * unable_to_classify routes to the sentinel branch. */
export type A3HoldingVerdict = Exclude<A2Verdict, "maintain">;

export type A3HoldingActionBody = {
  kind: "action";
  /** The A2 driver observation this action answers (deterministic link). */
  source_observation: string;
  /** Recommendatory prose (Layer 2). */
  advisor_action: string;
};

export type A3HoldingAction = {
  holding_ref: string;
  instrument_display_name: string;
  a2_verdict: A3HoldingVerdict;
} & (A3HoldingActionBody | A3Sentinel);

/* The honest 8: the 7 live stitcher pre-observation categories plus
 * sector_over_concentration pulled from A2's drivers (T-5.12 decision D4).
 * fee_inefficiency and mandate_consistent are deliberately excluded; they
 * are product debt (P34, P35), not contract. */
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

export type A3GlidePathStep = {
  step: number;
  /** Weight points trimmed at this step. */
  trim_pct_points: number;
  /** Position weight after this step. */
  resulting_weight_pct: number;
  /** Advisor-facing watch level: the weight at which to take this step.
   * Descriptive, not a system trigger (workflow-creep boundary). */
  trigger_at_weight_pct: number;
};

export type A3RebalancePosition = {
  instrument: string;
  current_weight_pct: number;
  /** The foundation threshold this position crossed (10 flag, 15 escalate). */
  breach_threshold_pct: number;
  /** The foundation section 3 single-position flag threshold (10%). */
  target_weight_pct: number;
  total_trim_pct_points: number;
  glide_path: A3GlidePathStep[];
};

export type A3RebalanceComputed = {
  positions: A3RebalancePosition[];
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
  rebalance: "proposal" | "no_action_needed" | "sentinel";
  one_line_characterization: string;
};

export type A3Output = {
  agent_id: "a3_so_what";
  case_id: string;
  as_of_date: string;
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
};

export type A3Layer1Result = {
  case_id: string;
  as_of_date: string;
  holding_actions: A3HoldingAction[];
  observation_actions: A3ObservationAction[];
  rebalance_proposal: A3RebalanceProposal;
};

/* ----- Glide-path cadence -----
 *
 * A3 owns the glide-path cadence: trim no more than this many weight points
 * in a single step, so a large concentration is unwound in stages to manage
 * market impact and the capital-gains event. This is an execution-pacing
 * parameter, NOT a foundation concentration threshold. The concentration
 * thresholds (POSITION_FLAG_PCT, POSITION_ESCALATE_PCT) are imported from
 * portfolio-risk-analytics; A3 invents none. */
const GLIDE_MAX_TRIM_PER_STEP_PCT = 5;

/* Target for a trimmed position: the foundation section 3 single-position
 * flag threshold. Bringing an over-concentrated position to this level
 * resolves the breach without inventing a new target number. */
const TARGET_WEIGHT_PCT = POSITION_FLAG_PCT;

const SEVERITY_RANK: Record<string, number> = {
  escalate: 4,
  flag: 3,
  watch: 2,
  info: 1,
  ok: 0,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/* ----- Layer 1: glide-path math ----- */

/* Build the step sequence from current weight down to target. The last step
 * lands exactly on target; trim of each step equals (trigger weight minus
 * resulting weight), so the path is internally consistent and assertable. */
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

function buildRebalanceProposal(metrics: PortfolioMetrics | null): A3RebalanceProposal {
  if (!metrics) {
    return {
      kind: "sentinel",
      sentinel_reason: "upstream_evidence_unavailable",
      note: "Rebalance proposal not surfaced: M0.PortfolioRiskAnalytics metrics absent.",
    };
  }

  const positions: A3RebalancePosition[] = [];
  for (const pf of metrics.concentration.positionFlags) {
    // Only positions materially above the 10% flag line carry a trim. A
    // position at or below target has no meaningful glide-path.
    if (pf.weightPct <= TARGET_WEIGHT_PCT) continue;
    const breachThreshold =
      pf.severity === "escalate" ? POSITION_ESCALATE_PCT : POSITION_FLAG_PCT;
    positions.push({
      instrument: pf.instrument,
      current_weight_pct: round1(pf.weightPct),
      breach_threshold_pct: breachThreshold,
      target_weight_pct: TARGET_WEIGHT_PCT,
      total_trim_pct_points: round1(pf.weightPct - TARGET_WEIGHT_PCT),
      glide_path: buildGlidePath(pf.weightPct, TARGET_WEIGHT_PCT),
    });
  }

  if (positions.length === 0) {
    return {
      kind: "no_action_needed",
      note: "No single position sits above the 10% concentration flag threshold; no rebalance proposed.",
    };
  }

  // narrated.advisor_action is filled by Layer 2; a proposal always triggers
  // the Layer 2 call, so the placeholder is never persisted.
  return {
    kind: "proposal",
    computed: { positions },
    narrated: { advisor_action: "", generation_method: "llm" },
  };
}

/* ----- Layer 1: per-holding and per-observation surfaces ----- */

function buildHoldingActions(a2Output: A2Output): A3HoldingAction[] {
  const out: A3HoldingAction[] = [];
  for (const h of a2Output.holding_verdicts) {
    if (h.verdict === "maintain") continue;
    const base = {
      holding_ref: h.holding_ref,
      instrument_display_name: h.instrument_display_name,
      a2_verdict: h.verdict as A3HoldingVerdict,
    };
    if (h.verdict === "unable_to_classify") {
      out.push({
        ...base,
        kind: "sentinel",
        sentinel_reason: "upstream_evidence_unavailable",
        note: `Recommendation not surfaced: the Samriddhi 2 diagnostic could not classify ${h.instrument_display_name}.`,
      });
      continue;
    }
    // Most-severe driver is first (A2 sorts). Its source_observation is the
    // deterministic link for the advisor action.
    const top = h.drivers[0];
    out.push({
      ...base,
      kind: "action",
      source_observation: top ? top.source_observation : "unspecified",
      advisor_action: "",
    });
  }
  return out;
}

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
  // Highest severity per category, deduped. Pre-observations may repeat a
  // category (one per flagged position, one per out-of-band class).
  const bestSeverity = new Map<A3ObservationCategory, string>();

  const consider = (category: string, severity: string) => {
    if (!isA3ObservationCategory(category)) return;
    const prev = bestSeverity.get(category);
    if (prev === undefined || (SEVERITY_RANK[severity] ?? 0) > (SEVERITY_RANK[prev] ?? 0)) {
      bestSeverity.set(category, severity);
    }
  };

  for (const o of preObservations) consider(o.vocab_candidate, o.severity_hint);

  // sector_over_concentration is not a live stitcher pre-observation (D4);
  // pull it from A2's drivers, where A2 derives it from the same M0
  // sector look-through.
  for (const h of a2Output.holding_verdicts) {
    for (const d of h.drivers) {
      if (d.source_observation === "sector_over_concentration") {
        consider("sector_over_concentration", d.severity);
      }
    }
  }

  const out: A3ObservationAction[] = [];
  for (const category of OBSERVATION_ORDER) {
    const severity = bestSeverity.get(category);
    if (severity === undefined) continue;
    out.push({
      observation_category: category,
      severity_hint: severity,
      kind: "action",
      advisor_action: "",
    });
  }
  return out;
}

export function computeA3(input: A3Input): A3Layer1Result {
  return {
    case_id: input.caseId,
    as_of_date: input.asOfDate,
    holding_actions: buildHoldingActions(input.a2Output),
    observation_actions: buildObservationActions(input.a2Output, input.preObservations),
    rebalance_proposal: buildRebalanceProposal(input.metrics),
  };
}

/* ----- Layer 2: LLM advisor-action prose ----- */

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
      source_observation: h.source_observation,
    }));

  const observationsNeedingProse = layer1.observation_actions
    .filter((o): o is A3ObservationAction & A3ObservationActionBody => o.kind === "action")
    .map((o) => ({
      observation_category: o.observation_category,
      severity_hint: o.severity_hint,
    }));

  const rebalance =
    layer1.rebalance_proposal.kind === "proposal"
      ? layer1.rebalance_proposal.computed.positions
      : null;

  const lines: string[] = [
    `# A3 Advisor-Action Request`,
    ``,
    `Case ${layer1.case_id}, as of ${layer1.as_of_date}.`,
    ``,
    `The diagnosis is already done. Every verdict, observation, and trim`,
    `number below is fixed. Your job is the recommendation that follows:`,
    `advisor-facing, recommendatory prose. You must NOT change any number;`,
    `cite the numbers exactly as given. Third person on the client. Use only`,
    `commas, semicolons, colons, or periods; never an em dash, en dash, or`,
    `any other long dash. Write "Samriddhi 1" and "Samriddhi 2" in full.`,
    `Propose the action as text and stop: no scheduling, approval, or status.`,
    ``,
    `## Per-holding actions`,
    ``,
    `For each holding below, write a one-to-two sentence advisor action: what`,
    `to propose for this holding, grounded in its driver. Recommendatory, not`,
    `descriptive.`,
    ``,
    "```json",
    JSON.stringify(holdingsNeedingProse, null, 2),
    "```",
    ``,
    `## Per-observation actions`,
    ``,
    `For each portfolio-level observation below, write a one-to-two sentence`,
    `advisor action at the portfolio level.`,
    ``,
    "```json",
    JSON.stringify(observationsNeedingProse, null, 2),
    "```",
  ];

  if (rebalance) {
    lines.push(
      ``,
      `## Rebalance proposal`,
      ``,
      `Write the advisor-facing prose that proposes this concentration trim.`,
      `Walk the advisor through the glide-path, citing the computed current`,
      `weight, target, and per-step trims and trigger weights exactly. Frame`,
      `the staging as managing market impact and the capital-gains event.`,
      `Return it as "rebalance_advisor_action" (a single string covering all`,
      `positions below).`,
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
    `  "holding_actions": [ { "holding_ref": "<verbatim from input>", "advisor_action": "<recommendatory, cites the numbers>" } ],`,
    `  "observation_actions": [ { "observation_category": "<verbatim from input>", "advisor_action": "<recommendatory, portfolio level>" } ],`,
    rebalance
      ? `  "rebalance_advisor_action": "<proposes the glide-path, cites every computed number>",`
      : `  "rebalance_advisor_action": null,`,
    `  "one_line_characterization": "<one line on the advisor-action picture; e.g. '3 actions surfaced, one concentration trim proposed'>",`,
    `  "reasoning_summary": "<2-4 sentences on what drives the recommendations for this portfolio; advisor register>"`,
    `}`,
    "```",
    ``,
    `Provide exactly one entry for every holding_ref and every`,
    `observation_category present in the input, and no others. Respond with a`,
    `single fenced JSON block. No prose outside the fence.`,
  );

  return lines.join("\n");
}

function validateReasonPayload(parsed: unknown): A3ReasonPayload {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("A3 Layer 2 output is not an object");
  }
  const o = parsed as Record<string, unknown>;

  if (!Array.isArray(o.holding_actions)) {
    throw new Error("A3 Layer 2 output.holding_actions must be an array");
  }
  for (const r of o.holding_actions as unknown[]) {
    const row = r as Record<string, unknown>;
    if (typeof row.holding_ref !== "string" || row.holding_ref.trim() === "") {
      throw new Error("A3 Layer 2 holding_action row missing holding_ref");
    }
    if (typeof row.advisor_action !== "string" || row.advisor_action.trim() === "") {
      throw new Error("A3 Layer 2 holding_action row missing advisor_action");
    }
  }

  if (!Array.isArray(o.observation_actions)) {
    throw new Error("A3 Layer 2 output.observation_actions must be an array");
  }
  for (const r of o.observation_actions as unknown[]) {
    const row = r as Record<string, unknown>;
    if (typeof row.observation_category !== "string" || row.observation_category.trim() === "") {
      throw new Error("A3 Layer 2 observation_action row missing observation_category");
    }
    if (typeof row.advisor_action !== "string" || row.advisor_action.trim() === "") {
      throw new Error("A3 Layer 2 observation_action row missing advisor_action");
    }
  }

  if (
    typeof o.one_line_characterization !== "string" ||
    o.one_line_characterization.trim() === ""
  ) {
    throw new Error("A3 Layer 2 output missing one_line_characterization");
  }
  if (typeof o.reasoning_summary !== "string" || o.reasoning_summary.trim() === "") {
    throw new Error("A3 Layer 2 output missing reasoning_summary");
  }

  return o as unknown as A3ReasonPayload;
}

export async function runA3ReasonText(
  layer1: A3Layer1Result,
): Promise<AgentCallResult<A3ReasonPayload>> {
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
  /** Live API response id and returned model from the Layer 2 call. Undefined
   * on the all-clear path (no LLM call). */
  responseId?: string;
  responseModel?: string;
};

function countSurfaced<T extends { kind: "action" | "sentinel" }>(
  items: T[],
): { surfaced: number; sentinelled: number } {
  let surfaced = 0;
  let sentinelled = 0;
  for (const i of items) {
    if (i.kind === "action") surfaced += 1;
    else sentinelled += 1;
  }
  return { surfaced, sentinelled };
}

function needsLayer2(layer1: A3Layer1Result): boolean {
  return (
    layer1.holding_actions.some((h) => h.kind === "action") ||
    layer1.observation_actions.some((o) => o.kind === "action") ||
    layer1.rebalance_proposal.kind === "proposal"
  );
}

export async function runA3Diagnostic(input: A3Input): Promise<A3DiagnosticResult> {
  const layer1 = computeA3(input);

  const holdingCounts = countSurfaced(layer1.holding_actions);
  const observationCounts = countSurfaced(layer1.observation_actions);
  const rebalanceKind = layer1.rebalance_proposal.kind;

  // Nothing to recommend: no Layer 2 call. Do not characterise the portfolio
  // as healthy (that is the Samriddhi 2 diagnostic surface's job); just state
  // that A3 surfaced no actions.
  if (!needsLayer2(layer1)) {
    const output: A3Output = {
      agent_id: "a3_so_what",
      case_id: layer1.case_id,
      as_of_date: layer1.as_of_date,
      holding_actions: layer1.holding_actions,
      observation_actions: layer1.observation_actions,
      rebalance_proposal: layer1.rebalance_proposal,
      summary: {
        holding_actions_surfaced: holdingCounts.surfaced,
        holding_actions_sentinelled: holdingCounts.sentinelled,
        observation_actions_surfaced: observationCounts.surfaced,
        observation_actions_sentinelled: observationCounts.sentinelled,
        rebalance: rebalanceKind,
        one_line_characterization:
          "No advisor actions surfaced from the Samriddhi 2 diagnostic for this case.",
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
  for (const r of payload.observation_actions) {
    observationProse.set(r.observation_category, r.advisor_action);
  }

  const holding_actions: A3HoldingAction[] = layer1.holding_actions.map((h) => {
    if (h.kind !== "action") return h;
    const prose = holdingProse.get(h.holding_ref);
    if (!prose) {
      throw new Error(
        `A3 Layer 2 did not return an advisor_action for holding ${h.holding_ref}. ` +
          `Layer 1 structure is intact; rerun Layer 2.`,
      );
    }
    return { ...h, advisor_action: stripLongDashes(prose) };
  });

  const observation_actions: A3ObservationAction[] = layer1.observation_actions.map((o) => {
    if (o.kind !== "action") return o;
    const prose = observationProse.get(o.observation_category);
    if (!prose) {
      throw new Error(
        `A3 Layer 2 did not return an advisor_action for observation ${o.observation_category}. ` +
          `Layer 1 structure is intact; rerun Layer 2.`,
      );
    }
    return { ...o, advisor_action: stripLongDashes(prose) };
  });

  let rebalance_proposal: A3RebalanceProposal = layer1.rebalance_proposal;
  if (layer1.rebalance_proposal.kind === "proposal") {
    const prose = payload.rebalance_advisor_action;
    if (!prose || prose.trim() === "") {
      throw new Error(
        "A3 Layer 2 did not return rebalance_advisor_action for a proposal. " +
          "Layer 1 glide-path is intact; rerun Layer 2.",
      );
    }
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
    holding_actions,
    observation_actions,
    rebalance_proposal,
    summary: {
      holding_actions_surfaced: holdingCounts.surfaced,
      holding_actions_sentinelled: holdingCounts.sentinelled,
      observation_actions_surfaced: observationCounts.surfaced,
      observation_actions_sentinelled: observationCounts.sentinelled,
      rebalance: rebalanceKind,
      one_line_characterization: stripLongDashes(payload.one_line_characterization),
    },
    reasoning_summary: stripLongDashes(payload.reasoning_summary),
  };

  return {
    output,
    usage: reasonResult.usage,
    responseId: reasonResult.id,
    responseModel: reasonResult.model,
  };
}
