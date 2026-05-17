/* Samriddhi 1 proposed_action runtime orchestrator.
 *
 * Wires routeProposedAction + (M0.IndianContext, skipped pending commit 3)
 * + the seven evidence agents + G1/G2/G3 + S1.case_mode + A1.challenge
 * into a single pipeline that produces a BriefingCaseContent and persists
 * to the Case row.
 *
 * Slice 3 demo flow:
 *   - The canonical Sharma + Marcellus case is pre-loaded via the seed
 *     from db/fixtures/cases/c-2026-05-14-sharma-01.json and has stub
 *     fixtures on disk; this orchestrator can replay it under STUB_MODE.
 *   - For other investors / proposals, no stub fixtures exist. Running
 *     under STUB_MODE produces a clear fail-fast error pointing the
 *     operator at the missing stub path. Running under STUB_MODE=false
 *     incurs live API spend; new fixtures get recorded incidentally via
 *     STUB_RECORD.
 *
 * The orchestrator passes stubKey to each agent call so the harness can
 * dispatch to stub replay or live as appropriate. Failure modes flow back
 * through the pipeline; the outer try/catch records the case as failed
 * with the developer-facing error message.
 */

import { prisma } from "@/lib/prisma";
import type { StructuredHoldings } from "@/db/fixtures/structured-holdings";
import type { Mandate } from "@/db/fixtures/structured-mandates";
import { loadSnapshot } from "./snapshot-loader";
import { routeProposedAction } from "./router";
import { buildIndianContext } from "./m0-indian-context";
import type { Proposal } from "./proposal";
import type { CaseAgentContext } from "./case/case-context";
import type {
  ActivatedVerdict,
  CaseAgentId,
  CaseEvidenceVerdict,
} from "./case/case-verdict";
import { runE1Case } from "./case/e1-case";
import { runE2Case } from "./case/e2-case";
import { runE3Case } from "./case/e3-case";
import { runE4Case } from "./case/e4-case";
import { runE5Case } from "./case/e5-case";
import { runE6Case } from "./case/e6-case";
import { runE7Case } from "./case/e7-case";
import { runG1 } from "./case/governance/g1-mandate";
import { runG2 } from "./case/governance/g2-sebi";
import { runG3 } from "./case/governance/g3-permission";
import { runS1Case } from "./case/s1-case";
import { runA1Case } from "./case/a1-case";
import { buildNonActivationVerdict } from "./case/non-activation";
import type {
  BriefingCaseContent,
  GovernanceStatusItem,
} from "./case/briefing-case-content";
import { evaluateMateriality } from "./materiality";
import { runIC1Pipeline } from "./ic1-pipeline";

type RunOpts = {
  caseId: string;
  investorId: string;
  snapshotId: string;
  proposal: Proposal;
};

function summariseMandate(m: Mandate, currentEquityPct: number): string {
  const eq = m.bands.find((b) => b.asset_class === "Equity");
  if (!eq) return "mandate authoring incomplete";
  return `equity band ${eq.min_pct}-${eq.max_pct}% currently ${currentEquityPct.toFixed(1)}%; mandate cadence ${m.review_cadence_note.split(";")[0]}`;
}

function summarisePortfolio(holdings: StructuredHoldings): string {
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

export async function runProposedActionPipeline(opts: RunOpts): Promise<void> {
  const { caseId, investorId, snapshotId, proposal } = opts;
  const stubKey = { caseFixtureId: caseId };

  try {
    const investor = await prisma.investor.findUnique({ where: { id: investorId } });
    if (!investor) throw new Error(`Investor not found: ${investorId}`);
    const snapshotRow = await prisma.snapshot.findUnique({ where: { id: snapshotId } });
    if (!snapshotRow) throw new Error(`Snapshot not found: ${snapshotId}`);
    if (!investor.mandateJson) {
      throw new Error(
        `Investor ${investorId} has no structured mandate. Reseed via npm run db:seed to populate mandateJson.`,
      );
    }

    const holdings = JSON.parse(investor.holdingsJson) as StructuredHoldings;
    const mandate = JSON.parse(investor.mandateJson) as Mandate;
    const snapshot = await loadSnapshot(snapshotId);
    const asOfDate = snapshotRow.date.toISOString().slice(0, 10);

    const totalAum = holdings.totalLiquidAumCr;
    const currentEquityCr = holdings.holdings
      .filter((h) => h.assetClass === "Equity")
      .reduce((s, h) => s + h.valueCr, 0);
    const currentEquityPct = (currentEquityCr / totalAum) * 100;

    const ctx: CaseAgentContext = {
      caseId,
      asOfDate,
      investorName: investor.name,
      investorMandate: summariseMandate(mandate, currentEquityPct),
      portfolioScope: summarisePortfolio(holdings),
      proposal,
      indianContext: null,
    };

    const routerDecision = routeProposedAction(holdings, proposal);

    /* M0.IndianContext activation. Deterministic (no LLM): retrieves and
     * structures the six curated YAML stores against the case context.
     * Activation order per the integration contract: after M0.Router
     * routes the case, before any evidence agent fires, before the
     * governance gates evaluate. The bundle becomes part of the case
     * context object passed downstream (S1.case_mode and the IC1 sub-
     * agents consume it; E1-E7 do not). G2 separately grounds its SEBI
     * minimum-ticket reference data in the same store. */
    ctx.indianContext = await buildIndianContext({
      caseId,
      asOfDate,
      investorStructureLine: investor.structureLine,
      proposalCategory: proposal.target_category,
      proposalInstrument: proposal.target_instrument,
      ticketSizeCr: proposal.ticket_size_cr,
    });

    /* Run activated evidence agents. Each agent gets a generic scope
     * block; for the canonical Sharma stub replay, the scope is unused
     * (the stub fixture's recorded text is loaded verbatim). For non-
     * Sharma live runs, the scope feeds the prompt; richer scope-builders
     * (look-through equity tables, sector context derivation) are a
     * future Slice item. */
    const evidence: CaseEvidenceVerdict[] = [];

    if (routerDecision.e1) {
      const r = await runE1Case(
        ctx,
        { lookthroughDescription: `Look-through universe of ${proposal.target_instrument} (${proposal.target_category}).` },
        { stubKey },
      );
      evidence.push(r.output as ActivatedVerdict);
    } else {
      evidence.push(buildNonActivationVerdict("e1_listed_fundamental_equity", proposal));
    }

    if (routerDecision.e2) {
      const r = await runE2Case(
        ctx,
        { sectorContext: `Sector and business-model context for ${proposal.target_instrument} (${proposal.target_category}).` },
        { stubKey },
      );
      evidence.push(r.output as ActivatedVerdict);
    } else {
      evidence.push(buildNonActivationVerdict("e2_industry_business", proposal));
    }

    /* E3 is mandatory unconditional per skill. */
    {
      const r = await runE3Case(
        ctx,
        { macroDataJson: JSON.stringify(snapshot.macro ?? {}, null, 2) },
        { stubKey },
      );
      evidence.push(r.output as ActivatedVerdict);
    }

    /* E4 is always activated on proposed_action per skill. */
    {
      const r = await runE4Case(
        ctx,
        { profileMd: investor.profileMd, priorInteractionsCount: 0 },
        { stubKey },
      );
      evidence.push(r.output as ActivatedVerdict);
    }

    if (routerDecision.e5) {
      const r = await runE5Case(
        ctx,
        { unlistedContext: `Unlisted equity context introduced by the proposed action targeting ${proposal.target_instrument}.` },
        { stubKey },
      );
      evidence.push(r.output as ActivatedVerdict);
    } else {
      evidence.push(buildNonActivationVerdict("e5_unlisted_equity", proposal));
    }

    if (routerDecision.e6) {
      const existingWrappers = holdings.holdings.filter(
        (h) => h.subCategory.startsWith("pms_") || h.subCategory.startsWith("aif_"),
      );
      const r = await runE6Case(
        ctx,
        {
          targetWrapperContext: `Target wrapper: ${proposal.target_instrument} (${proposal.target_category}), ticket Rs ${proposal.ticket_size_cr} Cr.`,
          existingWrapperInventory: existingWrappers
            .map((w) => `${w.instrument} (${w.subCategory}, ${w.weightPct}% of AUM)`)
            .join("; ") || "none",
          postActionArithmetic: `Post-action equity ${(currentEquityPct + (proposal.ticket_size_cr / totalAum) * 100).toFixed(1)}% vs band ${mandate.bands.find((b) => b.asset_class === "Equity")?.min_pct}-${mandate.bands.find((b) => b.asset_class === "Equity")?.max_pct}%.`,
        },
        { stubKey },
      );
      evidence.push(r.output as ActivatedVerdict);
    } else {
      evidence.push(buildNonActivationVerdict("e6_pms_aif_sif", proposal));
    }

    if (routerDecision.e7) {
      const existingMf = holdings.holdings.filter((h) => h.subCategory.startsWith("mf_"));
      const r = await runE7Case(
        ctx,
        {
          schemeContext: `Target scheme: ${proposal.target_instrument} (${proposal.target_category}).`,
          existingMfAllocation: existingMf
            .map((s) => `${s.instrument} (${s.weightPct}% of AUM)`)
            .join("; ") || "none",
        },
        { stubKey },
      );
      evidence.push(r.output as ActivatedVerdict);
    } else {
      evidence.push(buildNonActivationVerdict("e7_mutual_fund", proposal));
    }

    /* Governance gates, deterministic. */
    const g1 = runG1({
      investorId: investor.id,
      investorName: investor.name,
      liquidAumCr: totalAum,
      holdings,
      mandate,
      proposal,
    });
    const g2 = await runG2({ proposal });
    const settings = await prisma.setting.findUnique({ where: { id: 1 } });
    const advisorName = settings?.advisorName ?? "Priya Nair";
    const g3 = runG3({ proposal, advisorName });
    const gateResults = [g1, g2, g3];

    /* S1.case_mode synthesis. */
    const s1Result = await runS1Case(
      {
        ctx,
        evidence_verdicts: evidence,
        gate_results: gateResults,
        generation_mode: "stub",
      },
      { stubKey },
    );

    /* A1 adversarial challenge. */
    const a1Result = await runA1Case(
      {
        ctx,
        s1_synthesis: s1Result.output,
        evidence_verdicts: evidence,
        gate_results: gateResults,
      },
      { stubKey },
    );

    /* Assemble briefing. */
    const section_4_governance_status: GovernanceStatusItem[] = gateResults.map((g) => ({
      gate_id: g.gate_id,
      status: g.status,
      rationale: g.rationale,
    }));
    const briefing: BriefingCaseContent = {
      ...s1Result.output,
      section_4_governance_status,
      section_5_advisory_challenges: a1Result.output.challenges,
    };

    /* Materiality evaluation (Slice 4 commit 1). Deterministic; no LLM.
     * The output gates IC1 invocation and persists for the Outcome tab's
     * audit-trail rendering when materiality.fires=false. */
    const materiality = evaluateMateriality({
      synthesis: briefing.section_2_synthesis_verdict,
      gates: gateResults,
      evidence,
      ticketSizeCr: proposal.ticket_size_cr,
    });

    /* IC1 deliberation pipeline (Slice 4 commits 2 and 3). Short-circuits
     * to { fires: false, materiality_reason } when materiality.fires=false;
     * otherwise runs the four-step sequential orchestrator. STUB_MODE
     * with missing IC1 stubs returns per-role infrastructure_ready
     * sentinels per the Option A funding-aware posture. */
    const ic1Result = await runIC1Pipeline(
      {
        ctx,
        synthesis: briefing.section_2_synthesis_verdict,
        briefing,
        evidence,
        gates: gateResults,
        materiality,
      },
      { stubKey },
    );

    /* Derive headline and severity from synthesis verdict. */
    const sv = briefing.section_2_synthesis_verdict;
    const headline = `${sv.overall_verdict.replace(/_/g, " ")}: ${sv.narrative_paragraph.split(".")[0]}.`;
    const severity =
      sv.overall_verdict === "negative" || sv.overall_verdict === "requires_clarification"
        ? "escalate"
        : sv.overall_verdict === "positive_with_caveat" || sv.overall_verdict === "neutral_with_caveat"
          ? "flag"
          : "info";

    const fullContent = {
      briefing,
      proposal,
      gate_results: gateResults,
      evidence_verdicts: evidence,
      router_decision: routerDecision,
      indian_context: ctx.indianContext,
      materiality,
      ic1_deliberation: ic1Result.deliberation,
      usage_summary: {
        s1_input_tokens: s1Result.usage.inputTokens,
        s1_output_tokens: s1Result.usage.outputTokens,
        a1_input_tokens: a1Result.usage.inputTokens,
        a1_output_tokens: a1Result.usage.outputTokens,
        ...ic1Result.usage,
        generated_at: new Date().toISOString(),
      },
    };

    await prisma.case.update({
      where: { id: caseId },
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
    console.error(`[pipeline-case] case ${caseId} failed:`, msg);
    try {
      await prisma.case.update({
        where: { id: caseId },
        data: { status: "failed", errorMessage: msg },
      });
    } catch (updateErr) {
      console.error(`[pipeline-case] also failed to mark case as failed:`, updateErr);
    }
  }
}

/* Helper: track which agent ids were activated for the coverage note.
 * Re-exported so the orchestrator and the rendering layer agree. */
export const ACTIVATED_AGENT_IDS_BY_DECISION = (d: ReturnType<typeof routeProposedAction>): CaseAgentId[] => {
  const out: CaseAgentId[] = [];
  if (d.e1) out.push("e1_listed_fundamental_equity");
  if (d.e2) out.push("e2_industry_business");
  if (d.e3) out.push("e3_macro_policy_news");
  if (d.e4) out.push("e4_behavioural_historical");
  if (d.e5) out.push("e5_unlisted_equity");
  if (d.e6) out.push("e6_pms_aif_sif");
  if (d.e7) out.push("e7_mutual_fund");
  return out;
};
