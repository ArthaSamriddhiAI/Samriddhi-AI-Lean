/* End-to-end Samriddhi 2 diagnostic pipeline.
 *
 * Orchestrates: load investor + snapshot, compute deterministic metrics,
 * route the applicability vector, run activated evidence agents in
 * parallel (Promise.all), stitch metrics + evidence + usage into a
 * StitchedContext, synthesize the seven-section briefing via S1.
 *
 * Persists to Case row:
 *   status: "generating" → "ready" or "failed"
 *   contentJson: { briefing, metrics, evidence, router_decision, usage_summary }
 *   tokenUsageJson: per-agent token usage rollup
 *   headline: derived from briefing section 1
 *   severity: derived from the highest severity in sections 1+3+4
 *   errorMessage: only set when status="failed"
 *
 * Failure mode: any exception flips the case to status="failed" with
 * errorMessage; the retry endpoint can re-run from scratch.
 */

import { prisma } from "@/lib/prisma";
import type { StructuredHoldings } from "@/db/fixtures/structured-holdings";
import { loadSnapshot, loadSnapshotPair } from "./snapshot-loader";
import { computeMetrics } from "./portfolio-risk-analytics";
import { runRiskRewardDeterministic } from "./risk-reward-stats";
import { runTimeSeriesPerformanceDeterministic, type TimeSeriesPerformanceOutput } from "./time-series-performance";
import { route } from "./router";
import { buildListedScope } from "./listed-equity-scope";
import { buildWrapperScope, buildMutualFundScope } from "./wrapper-scope";
import { runE1 } from "./e1-listed-equity";
import { runE2 } from "./e2-industry";
import { runE3 } from "./e3-macro";
import { runE4 } from "./e4-behavioural";
import { runE6 } from "./e6-wrappers";
import { runE7 } from "./e7-mutual-fund";
import { runS1Diagnostic } from "./s1-diagnostic";
import { runA2Diagnostic } from "./a2-classification";
import { stitch, type EvidenceBundle, type UsageBundle } from "./stitcher";
import type { BriefingContent } from "./s1-diagnostic";
import type { AgentCallResult } from "./harness";

export type PipelineSeverity = "escalate" | "flag" | "info" | "ok";

function pickSeverity(briefing: BriefingContent): PipelineSeverity {
  const all: string[] = [];
  for (const o of briefing.section_1_headline_observations) all.push(o.severity);
  for (const b of briefing.section_3_concentration_analysis) all.push(b.severity);
  for (const f of briefing.section_4_risk_flags) all.push(f.severity);
  if (all.includes("escalate")) return "escalate";
  if (all.includes("flag")) return "flag";
  if (all.includes("info")) return "info";
  return "ok";
}

function pickHeadline(briefing: BriefingContent): string {
  return briefing.section_1_headline_observations[0]?.one_line ?? "Diagnostic case generated";
}

function describeScope(holdings: StructuredHoldings): string {
  const counts = { pms: 0, aif: 0, mf: 0, listed: 0, debt: 0, cash: 0, alt_other: 0 };
  for (const h of holdings.holdings) {
    if (h.subCategory.startsWith("pms_")) counts.pms += 1;
    else if (h.subCategory.startsWith("aif_")) counts.aif += 1;
    else if (h.subCategory.startsWith("mf_")) counts.mf += 1;
    else if (h.subCategory.startsWith("listed_") || h.subCategory.startsWith("intl_")) counts.listed += 1;
    else if (h.assetClass === "Debt") counts.debt += 1;
    else if (h.assetClass === "Cash") counts.cash += 1;
    else counts.alt_other += 1;
  }
  return `Liquid AUM Rs ${holdings.totalLiquidAumCr} Cr across ${holdings.holdings.length} holdings: ${counts.pms} PMS, ${counts.aif} AIF, ${counts.mf} MF, ${counts.listed} direct/intl listed, ${counts.debt} debt, ${counts.cash} cash, ${counts.alt_other} other.`;
}

/* Resolve the immediately-prior snapshot id for cross-snapshot evolution
 * (ADR-0028; MVP scope is t_n vs t_{n-1} only, T19 tracks configurable
 * reference points). The dev snapshot suite is quarterly (t0=q2_2026,
 * t1=q3_2026, ...), so the prior id decrements both the t-index and the
 * calendar quarter by one. Returns null at t0 (no prior) or when the id does
 * not match the canonical `t<N>_q<Q>_<YYYY>` shape; the caller treats null as
 * no_prior_snapshot_available. */
function priorSnapshotId(currentId: string): string | null {
  const m = /^t(\d+)_q([1-4])_(\d{4})$/.exec(currentId);
  if (!m) return null;
  const n = Number(m[1]);
  if (n <= 0) return null;
  let q = Number(m[2]);
  let y = Number(m[3]);
  q -= 1;
  if (q === 0) {
    q = 4;
    y -= 1;
  }
  return `t${n - 1}_q${q}_${y}`;
}

export async function runDiagnosticPipeline(opts: {
  caseId: string;
  investorId: string;
  snapshotId: string;
}): Promise<void> {
  const startedAt = Date.now();
  try {
    const investor = await prisma.investor.findUnique({ where: { id: opts.investorId } });
    if (!investor) throw new Error(`Investor not found: ${opts.investorId}`);
    const snapshotRow = await prisma.snapshot.findUnique({ where: { id: opts.snapshotId } });
    if (!snapshotRow) throw new Error(`Snapshot not found: ${opts.snapshotId}`);

    /* Per-case token-budget circuit breaker. Sized as a guardrail (not a
     * target). Routine cases land at 90-120k tokens combined; the default
     * 250k gives generous headroom while catching runaway loops. */
    const settings = await prisma.setting.findUnique({ where: { id: 1 } });
    const tokenBudget = settings?.tokenBudgetPerCase ?? 250000;

    const holdings = JSON.parse(investor.holdingsJson) as StructuredHoldings;
    const snapshot = await loadSnapshot(opts.snapshotId);
    const asOfDate = snapshotRow.date.toISOString().slice(0, 10);

    const metrics = computeMetrics(holdings, snapshot, {
      riskAppetite: investor.riskAppetite,
      liquidityTier: investor.liquidityTier,
    });
    const routerDecision = route(holdings);

    /* Risk-Reward statistics: deterministic sibling to the M0 metrics module,
     * data only (content.risk_reward_stats; the S2 renderer never reads it,
     * WA9). Pure local computation on the templated rollup path (the LLM
     * fallback is WA12-gated and not exercised here). Feeds Dimension 4 of
     * the interpretive verdict skill when it ships in cluster 7. */
    const riskReward = routerDecision.riskRewardStats
      ? runRiskRewardDeterministic({
          caseId: opts.caseId,
          asOfDate,
          holdings,
          snapshot,
          investor: {
            riskAppetite: investor.riskAppetite,
            liquidityTier: investor.liquidityTier,
          },
        })
      : null;

    /* Time-series-performance: deterministic sibling, two-snapshot-aware
     * (ADR-0028). Fires after risk-reward. Loads the immediately-prior snapshot
     * (t_{n-1}) via loadSnapshotPair and threads the pair to the agent; at t0
     * there is no prior, so the agent runs with a null reference and emits
     * no_prior_snapshot_available while standard windows still compute.
     * SKELETON: the agent's Layer-1 helpers are TODO T-5.06-impl, so the call is
     * try/caught to degrade to a null block (the case does not fail on the
     * unimplemented skeleton) until the implementation lands. Ships data only
     * (content.time_series_performance); the renderer never reads it (WA9). */
    let timeSeries: TimeSeriesPerformanceOutput | null = null;
    if (routerDecision.timeSeriesPerformance) {
      try {
        const refId = priorSnapshotId(opts.snapshotId);
        const tsScope = {
          caseId: opts.caseId,
          asOfDate,
          investor: {
            riskAppetite: investor.riskAppetite,
            liquidityTier: investor.liquidityTier,
          },
        };
        if (refId) {
          const pair = await loadSnapshotPair(opts.snapshotId, refId);
          timeSeries = await runTimeSeriesPerformanceDeterministic(pair.current, pair.reference, holdings, tsScope);
        } else {
          timeSeries = await runTimeSeriesPerformanceDeterministic(snapshot, null, holdings, tsScope);
        }
      } catch (err) {
        console.warn(
          `[pipeline] time-series-performance skipped (skeleton TODO or load error): ${err instanceof Error ? err.message : String(err)}`,
        );
        timeSeries = null;
      }
    }

    const stocksInScope = buildListedScope(holdings, snapshot);
    const wrappersInScope = buildWrapperScope(holdings, snapshot);
    const mfScope = buildMutualFundScope(holdings, snapshot);

    const mandate = `risk_appetite: ${investor.riskAppetite}; time_horizon: ${investor.timeHorizon}; model_cell: ${investor.modelCell}; liquid AUM Rs ${investor.liquidAumCr} Cr; liquidity_tier: ${investor.liquidityTier}`;
    const scopeNarrative = describeScope(holdings);

    /* Evidence agents in parallel via Promise.all. Tier-2 rate limit (in place
     * as of the deferred workstream cleanup, 2026-05-15) comfortably
     * accommodates simultaneous dispatch. EvidenceBundle / UsageBundle shapes
     * are unchanged from the serial-dispatch period. */
    const evidence: EvidenceBundle = { e1: null, e2: null, e3: null, e4: null, e6: null, e7: null };
    const usage: UsageBundle = {};

    type AgentTask = { key: keyof EvidenceBundle; run: () => Promise<AgentCallResult<unknown>> };
    const tasks: AgentTask[] = [];

    if (routerDecision.e3) {
      tasks.push({ key: "e3", run: () => runE3({ asOfDate, investorName: investor.name, investorMandate: mandate, investorScope: scopeNarrative, macroData: snapshot.macro }) as Promise<AgentCallResult<unknown>> });
    }
    if (routerDecision.e4) {
      tasks.push({ key: "e4", run: () => runE4({ asOfDate, investorName: investor.name, investorMandate: mandate, characterBibleMd: investor.profileMd, priorCasesCount: 0, advisorRelationshipLengthYears: 0 }) as Promise<AgentCallResult<unknown>> });
    }
    if (routerDecision.e1) {
      tasks.push({ key: "e1", run: () => runE1({ asOfDate, investorName: investor.name, investorMandate: mandate, stocksInScope }) as Promise<AgentCallResult<unknown>> });
    }
    if (routerDecision.e2) {
      tasks.push({ key: "e2", run: () => runE2({ asOfDate, investorName: investor.name, investorMandate: mandate, stocksInScope }) as Promise<AgentCallResult<unknown>> });
    }
    if (routerDecision.e6) {
      tasks.push({ key: "e6", run: () => runE6({ asOfDate, investorName: investor.name, investorMandate: mandate, wrappers: wrappersInScope }) as Promise<AgentCallResult<unknown>> });
    }
    if (routerDecision.e7) {
      tasks.push({ key: "e7", run: () => runE7({ asOfDate, investorName: investor.name, investorMandate: mandate, schemes: mfScope }) as Promise<AgentCallResult<unknown>> });
    }

    const agentResults = await Promise.all(
      tasks.map(async (task) => {
        console.log(`[pipeline] running ${task.key}...`);
        const result = await task.run();
        console.log(`[pipeline] ${task.key} done: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out (attempt ${result.attemptCount})`);
        return { key: task.key, result };
      }),
    );

    let runningTokens = 0;
    for (const { key, result } of agentResults) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      evidence[key] = result.output as any;
      usage[key] = result.usage;
      runningTokens += result.usage.inputTokens + result.usage.outputTokens;
    }
    if (runningTokens > tokenBudget) {
      throw new Error(
        `Token budget exceeded: used ${runningTokens} of ${tokenBudget} tokens (combined input + output). ` +
          `Raise tokenBudgetPerCase in Settings or scope the case smaller. ` +
          `This is a circuit breaker, not a budget target; routine cases run at 90-120k tokens.`,
      );
    }

    const stitched = stitch({
      caseMeta: {
        case_id: opts.caseId,
        investor_id: investor.id,
        investor_name: investor.name,
        as_of_date: asOfDate,
        case_mode: "diagnostic",
        bucket_tier: investor.modelCell,
      },
      metrics,
      evidence,
      router_decision: routerDecision,
      usage,
      time_series_performance: timeSeries, // Option II (ADR-0029): thread time-series into S1's StitchedContext
    });

    const holdingsForAppendix = holdings.holdings.map((h) => ({
      instrument: h.instrument,
      sub_category: h.subCategory,
      value_cr: h.valueCr,
      weight_pct: h.weightPct,
    }));

    const s1Result = await runS1Diagnostic({ stitched, holdingsForAppendix });
    usage.s1 = s1Result.usage;
    runningTokens += s1Result.usage.inputTokens + s1Result.usage.outputTokens;
    if (runningTokens > tokenBudget) {
      throw new Error(
        `Token budget exceeded after S1 synthesis: used ${runningTokens} of ${tokenBudget} tokens. ` +
          `Raise tokenBudgetPerCase in Settings or scope the case smaller.`,
      );
    }

    const briefing = s1Result.output;
    const headline = pickHeadline(briefing);
    const severity = pickSeverity(briefing);

    /* A2.classification: per-holding meeting-behaviour verdicts. S2
     * diagnostic path only, after S1, consuming the metrics and evidence
     * already in scope. Layer 1 is deterministic; Layer 2 writes the
     * reason text (one Claude call per case). Ships as data only
     * (content.a2_classification); the S2 renderer reads only briefing and
     * never touches this key. */
    const a2Result = await runA2Diagnostic({
      caseId: opts.caseId,
      asOfDate,
      holdings,
      metrics,
      evidence,
    });
    usage.a2 = a2Result.usage;
    runningTokens += a2Result.usage.inputTokens + a2Result.usage.outputTokens;
    if (runningTokens > tokenBudget) {
      throw new Error(
        `Token budget exceeded after A2 classification: used ${runningTokens} of ${tokenBudget} tokens. ` +
          `Raise tokenBudgetPerCase in Settings or scope the case smaller.`,
      );
    }

    const elapsedMs = Date.now() - startedAt;

    /* Persist contentJson with the briefing plus diagnostic provenance:
     * the deterministic metrics, the router decision, the per-agent
     * outputs, and the token-usage rollup. The UI renders briefing; the
     * Evidence Appendix and Coverage Note draw on the same payload; the
     * audit view (future) inspects the rest. */
    const fullContent = {
      briefing,
      metrics,
      router_decision: routerDecision,
      evidence,
      a2_classification: a2Result.output,
      risk_reward_stats: riskReward,
      time_series_performance: timeSeries,
      usage_summary: {
        per_agent: usage,
        total_input_tokens:
          stitched.usage_summary.total_input_tokens +
          (usage.s1?.inputTokens ?? 0) +
          (usage.a2?.inputTokens ?? 0),
        total_output_tokens:
          stitched.usage_summary.total_output_tokens +
          (usage.s1?.outputTokens ?? 0) +
          (usage.a2?.outputTokens ?? 0),
        elapsed_ms: elapsedMs,
        generated_at: new Date().toISOString(),
      },
    };

    await prisma.case.update({
      where: { id: opts.caseId },
      data: {
        status: "ready",
        contentJson: JSON.stringify(fullContent),
        tokenUsageJson: JSON.stringify(fullContent.usage_summary),
        headline,
        severity,
        errorMessage: null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] case ${opts.caseId} failed:`, msg);
    try {
      await prisma.case.update({
        where: { id: opts.caseId },
        data: { status: "failed", errorMessage: msg },
      });
    } catch (updateErr) {
      console.error(`[pipeline] also failed to mark case as failed:`, updateErr);
    }
  }
}
