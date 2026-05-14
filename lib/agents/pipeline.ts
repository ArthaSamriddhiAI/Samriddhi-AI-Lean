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
import { loadSnapshot } from "./snapshot-loader";
import { computeMetrics } from "./portfolio-risk-analytics";
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

    const holdings = JSON.parse(investor.holdingsJson) as StructuredHoldings;
    const snapshot = await loadSnapshot(opts.snapshotId);
    const asOfDate = snapshotRow.date.toISOString().slice(0, 10);

    const metrics = computeMetrics(holdings, snapshot, {
      riskAppetite: investor.riskAppetite,
      liquidityTier: investor.liquidityTier,
    });
    const routerDecision = route(holdings);

    const stocksInScope = buildListedScope(holdings, snapshot);
    const wrappersInScope = buildWrapperScope(holdings, snapshot);
    const mfScope = buildMutualFundScope(holdings, snapshot);

    const mandate = `risk_appetite: ${investor.riskAppetite}; time_horizon: ${investor.timeHorizon}; model_cell: ${investor.modelCell}; liquid AUM Rs ${investor.liquidAumCr} Cr; liquidity_tier: ${investor.liquidityTier}`;
    const scopeNarrative = describeScope(holdings);

    /* Evidence agents in parallel. Pack each as a labeled tuple so we can
     * fan back into the EvidenceBundle / UsageBundle without losing names. */
    const tasks: Array<Promise<{ key: keyof EvidenceBundle; result: AgentCallResult<unknown> }>> = [];
    if (routerDecision.e1) {
      tasks.push(
        runE1({ asOfDate, investorName: investor.name, investorMandate: mandate, stocksInScope }).then((r) => ({ key: "e1" as const, result: r as AgentCallResult<unknown> })),
      );
    }
    if (routerDecision.e2) {
      tasks.push(
        runE2({ asOfDate, investorName: investor.name, investorMandate: mandate, stocksInScope }).then((r) => ({ key: "e2" as const, result: r as AgentCallResult<unknown> })),
      );
    }
    if (routerDecision.e3) {
      tasks.push(
        runE3({ asOfDate, investorName: investor.name, investorMandate: mandate, investorScope: scopeNarrative, macroData: snapshot.macro }).then((r) => ({ key: "e3" as const, result: r as AgentCallResult<unknown> })),
      );
    }
    if (routerDecision.e4) {
      tasks.push(
        runE4({
          asOfDate,
          investorName: investor.name,
          investorMandate: mandate,
          characterBibleMd: investor.profileMd,
          priorCasesCount: 0,
          advisorRelationshipLengthYears: 0,
        }).then((r) => ({ key: "e4" as const, result: r as AgentCallResult<unknown> })),
      );
    }
    if (routerDecision.e6) {
      tasks.push(
        runE6({ asOfDate, investorName: investor.name, investorMandate: mandate, wrappers: wrappersInScope }).then((r) => ({ key: "e6" as const, result: r as AgentCallResult<unknown> })),
      );
    }
    if (routerDecision.e7) {
      tasks.push(
        runE7({ asOfDate, investorName: investor.name, investorMandate: mandate, schemes: mfScope }).then((r) => ({ key: "e7" as const, result: r as AgentCallResult<unknown> })),
      );
    }

    const evidenceResults = await Promise.all(tasks);

    const evidence: EvidenceBundle = { e1: null, e2: null, e3: null, e4: null, e6: null, e7: null };
    const usage: UsageBundle = {};
    for (const { key, result } of evidenceResults) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      evidence[key] = result.output as any;
      usage[key] = result.usage;
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
    });

    const holdingsForAppendix = holdings.holdings.map((h) => ({
      instrument: h.instrument,
      sub_category: h.subCategory,
      value_cr: h.valueCr,
      weight_pct: h.weightPct,
    }));

    const s1Result = await runS1Diagnostic({ stitched, holdingsForAppendix });
    usage.s1 = s1Result.usage;

    const briefing = s1Result.output;
    const headline = pickHeadline(briefing);
    const severity = pickSeverity(briefing);
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
      usage_summary: {
        per_agent: usage,
        total_input_tokens: stitched.usage_summary.total_input_tokens + (usage.s1?.inputTokens ?? 0),
        total_output_tokens: stitched.usage_summary.total_output_tokens + (usage.s1?.outputTokens ?? 0),
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
