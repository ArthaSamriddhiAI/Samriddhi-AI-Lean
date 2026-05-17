/* One-off Sharma + Marcellus fixture generation.
 *
 * Slice 3 commit 9. Produces the canonical Sharma case from a mix of
 * deterministic and live-mode-LLM steps, gated by the orientation's
 * budget approval. Outputs to:
 *
 *   fixtures/stub-responses/c-2026-05-14-sharma-01/<agent>.json
 *     E1, E2, E3, E4, E6 stubs parsed from
 *       db/fixtures/raw/sharma_marcellus_evidence_verdicts.md
 *     E5, E7 stubs parsed from the same file (non-activation reasons)
 *     s1_case_mode and a1_challenge stubs from a one-shot live SDK call
 *
 *   db/fixtures/cases/c-2026-05-14-sharma-01.json
 *     The assembled BriefingCaseContent plus metadata, with stubbed=true
 *     and frozenAt fixed at the script-run timestamp. Loaded by db/seed.ts
 *     on every db:seed thereafter.
 *
 * The script never re-runs live for E1-E7; the verdicts file is the
 * authored source. S1.case_mode and A1.challenge are the only live LLM
 * calls (estimated $0.50-1.00 in Opus 4.7 tokens, gated in the
 * orientation cadence).
 *
 * M0.IndianContext is skipped (commit 3 blocked on Workstream C); all
 * downstream agents see ctx.indianContext = null. BUILD_NOTES at slice
 * close documents the deferred integration.
 *
 * Run via: npx tsx scripts/generate-sharma-fixture.ts
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { HOLDINGS_BY_INVESTOR } from "../db/fixtures/structured-holdings";
import { MANDATES_BY_INVESTOR } from "../db/fixtures/structured-mandates";
import type { Mandate } from "../db/fixtures/structured-mandates";
import { routeProposedAction } from "../lib/agents/router";
import type { Proposal } from "../lib/agents/proposal";
import {
  type ActivatedVerdict,
  type CaseAgentId,
  type CaseEvidenceVerdict,
  type CaseRiskLevel,
  type NonActivatedVerdict,
} from "../lib/agents/case/case-verdict";
import type { CaseAgentContext } from "../lib/agents/case/case-context";
import { runG1 } from "../lib/agents/case/governance/g1-mandate";
import { runG2 } from "../lib/agents/case/governance/g2-sebi";
import { runG3 } from "../lib/agents/case/governance/g3-permission";
import type { GateResult } from "../lib/agents/case/governance/types";
import { runS1Case } from "../lib/agents/case/s1-case";
import { runA1Case } from "../lib/agents/case/a1-case";
import { buildNonActivationVerdict } from "../lib/agents/case/non-activation";
import type {
  BriefingCaseContent,
  GovernanceStatusItem,
} from "../lib/agents/case/briefing-case-content";
import type { StubResponse } from "../lib/agents/stub";

const CASE_FIXTURE_ID = "c-2026-05-14-sharma-01";
const SNAPSHOT_ID = "t0_q2_2026";
const ADVISOR_NAME = "Priya Nair";

const ROOT = process.cwd();
const VERDICTS_PATH = path.join(ROOT, "db/fixtures/raw/sharma_marcellus_evidence_verdicts.md");
const STUB_DIR = path.join(ROOT, "fixtures/stub-responses", CASE_FIXTURE_ID);
const CASE_FIXTURE_PATH = path.join(ROOT, "db/fixtures/cases", `${CASE_FIXTURE_ID}.json`);

const SHARMA_PROPOSAL: Proposal = {
  action_type: "new_investment",
  target_category: "pms",
  target_instrument: "Marcellus Consistent Compounder PMS",
  ticket_size_cr: 3,
  source_of_funds: "fixed_deposits",
  timeline: "this_quarter",
  rationale:
    "Family wishes to redirect FD reserve into a quality-compounder PMS following peer-network introduction to Marcellus's track record. Action aligns with the household's stated aggressive long-term mandate.",
};

const ACTIVATED_AGENTS: CaseAgentId[] = [
  "e1_listed_fundamental_equity",
  "e2_industry_business",
  "e3_macro_policy_news",
  "e4_behavioural_historical",
  "e6_pms_aif_sif",
];

const NON_ACTIVATED_AGENTS: CaseAgentId[] = [
  "e5_unlisted_equity",
  "e7_mutual_fund",
];

/* Map the verdicts file's "## Em, ..." section header to the canonical agent_id. */
const AGENT_SECTION_HEADERS: Record<CaseAgentId, RegExp> = {
  e1_listed_fundamental_equity: /^## E1, /m,
  e2_industry_business: /^## E2, /m,
  e3_macro_policy_news: /^## E3, /m,
  e4_behavioural_historical: /^## E4, /m,
  e5_unlisted_equity: /^## E5, /m,
  e6_pms_aif_sif: /^## E6, /m,
  e7_mutual_fund: /^## E7, /m,
};

function extractAgentSection(verdictsMd: string, agentId: CaseAgentId): string {
  const headerRe = AGENT_SECTION_HEADERS[agentId];
  const headerMatch = verdictsMd.match(headerRe);
  if (!headerMatch) throw new Error(`Section not found for ${agentId}`);
  const startIdx = headerMatch.index ?? 0;
  /* The next "## " at the start of a line, or the end of the document. */
  const restAfter = verdictsMd.slice(startIdx + 2);
  const nextHeaderRel = restAfter.search(/\n## /);
  const endIdx = nextHeaderRel === -1 ? verdictsMd.length : startIdx + 2 + nextHeaderRel;
  return verdictsMd.slice(startIdx, endIdx);
}

const RISK_LEVELS_FROM_VERDICT: Record<string, CaseRiskLevel> = {
  low: "low",
  moderate: "moderate",
  elevated: "elevated",
  high: "high",
};

function parseActivatedFromSection(agentId: CaseAgentId, section: string): ActivatedVerdict {
  const riskMatch = section.match(/\*\*Risk level:\*\*\s*([^.\n]+)\./i);
  const rawRisk = riskMatch ? riskMatch[1].trim().toLowerCase() : "";
  const riskLevel = RISK_LEVELS_FROM_VERDICT[rawRisk];
  if (!riskLevel) throw new Error(`${agentId}: unrecognised risk level "${rawRisk}"`);

  const confMatch = section.match(/\*\*Confidence:\*\*\s*([0-9.]+)\./i);
  const confidence = confMatch ? parseFloat(confMatch[1]) : NaN;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(`${agentId}: invalid confidence "${confMatch?.[1]}"`);
  }

  /* Drivers block is a bulleted list under "**Drivers:**". Read until the
   * next bolded heading. */
  const driversMatch = section.match(/\*\*Drivers:\*\*\s*\n([\s\S]*?)\n\n\*\*/);
  if (!driversMatch) throw new Error(`${agentId}: drivers block not found`);
  const drivers = driversMatch[1]
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter((line) => line.length > 0);

  /* Flags are comma-separated after "**Flags:**". May span multiple lines;
   * stop at the next bolded heading. */
  const flagsMatch = section.match(/\*\*Flags:\*\*\s*([^\n]+(?:\n[^\n*]+)?)/);
  if (!flagsMatch) throw new Error(`${agentId}: flags block not found`);
  const flags = flagsMatch[1]
    .replace(/\.$/, "")
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  const reasoningMatch = section.match(/\*\*Reasoning paragraph:\*\*\s*([\s\S]*?)\n\n\*\*/);
  if (!reasoningMatch) throw new Error(`${agentId}: reasoning paragraph not found`);
  const reasoningParagraph = reasoningMatch[1].trim();

  /* Data points are semicolon-separated after "**Data points cited:**". */
  const dataMatch = section.match(/\*\*Data points cited:\*\*\s*([\s\S]*?)(?:\n\n|$)/);
  if (!dataMatch) throw new Error(`${agentId}: data points block not found`);
  const dataPoints = dataMatch[1]
    .replace(/\.$/, "")
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d.length > 0);

  return {
    agent_id: agentId,
    activation_status: "activated",
    risk_level: riskLevel,
    confidence,
    drivers,
    flags,
    reasoning_paragraph: reasoningParagraph,
    data_points_cited: dataPoints,
  };
}

function parseNonActivatedFromSection(agentId: CaseAgentId, section: string): NonActivatedVerdict {
  const reasonMatch = section.match(/\*\*Reason for non-activation:\*\*\s*([\s\S]*?)(?:\n\n---|\n## |$)/);
  if (!reasonMatch) throw new Error(`${agentId}: reason for non-activation not found`);
  return {
    agent_id: agentId,
    activation_status: "not_activated",
    reason_for_non_activation: reasonMatch[1].trim(),
  };
}

function verdictToStubText(verdict: CaseEvidenceVerdict): string {
  /* The stub replay path runs the same JSON-extract logic as live mode,
   * so the stub text must be a fenced JSON block. */
  const payload =
    verdict.activation_status === "activated"
      ? {
          activation_status: verdict.activation_status,
          risk_level: verdict.risk_level,
          confidence: verdict.confidence,
          drivers: verdict.drivers,
          flags: verdict.flags,
          reasoning_paragraph: verdict.reasoning_paragraph,
          data_points_cited: verdict.data_points_cited,
        }
      : {
          activation_status: verdict.activation_status,
          reason_for_non_activation: verdict.reason_for_non_activation,
        };
  return "```json\n" + JSON.stringify(payload, null, 2) + "\n```";
}

async function writeStubFile(agentId: string, model: string, text: string, usage: { input_tokens: number; output_tokens: number }): Promise<void> {
  const stub: StubResponse = {
    recorded_at: new Date().toISOString(),
    model,
    skill_id: agentId,
    case_fixture_id: CASE_FIXTURE_ID,
    text,
    stop_reason: "end_turn",
    usage,
  };
  const filePath = path.join(STUB_DIR, `${agentId}.json`);
  await fs.writeFile(filePath, JSON.stringify(stub, null, 2), "utf-8");
  console.log(`  wrote stub: ${path.relative(ROOT, filePath)}`);
}

function buildContextSummary(mandate: Mandate, currentEquityPct: number): string {
  const eqBand = mandate.bands.find((b) => b.asset_class === "Equity");
  if (!eqBand) return "mandate bands not authored";
  return `risk_appetite: Aggressive; time_horizon: Over 5y; equity band ${eqBand.min_pct}-${eqBand.max_pct}% currently ${currentEquityPct.toFixed(1)}%; mandate review annual`;
}

function buildPortfolioScope(): string {
  return "Liquid AUM Rs 18 Cr across 8 holdings: 1 PMS, 1 AIF, 3 MF, 2 FD, 1 cash";
}

async function main() {
  console.log("Generating Sharma + Marcellus stub fixture set");
  console.log("================================================");
  console.log(`Case fixture id: ${CASE_FIXTURE_ID}`);
  console.log(`Stub dir: ${path.relative(ROOT, STUB_DIR)}`);
  console.log("");

  await fs.mkdir(STUB_DIR, { recursive: true });
  await fs.mkdir(path.dirname(CASE_FIXTURE_PATH), { recursive: true });

  /* Step 1: parse the verdicts file. */
  console.log("Step 1: parse db/fixtures/raw/sharma_marcellus_evidence_verdicts.md");
  const verdictsMd = await fs.readFile(VERDICTS_PATH, "utf-8");

  const activatedVerdicts: ActivatedVerdict[] = [];
  for (const agentId of ACTIVATED_AGENTS) {
    const section = extractAgentSection(verdictsMd, agentId);
    const v = parseActivatedFromSection(agentId, section);
    activatedVerdicts.push(v);
    console.log(`  parsed ${agentId}: ${v.risk_level} risk, confidence ${v.confidence}, ${v.drivers.length} drivers, ${v.flags.length} flags`);
  }

  const nonActivatedVerdicts: NonActivatedVerdict[] = [];
  for (const agentId of NON_ACTIVATED_AGENTS) {
    const section = extractAgentSection(verdictsMd, agentId);
    const v = parseNonActivatedFromSection(agentId, section);
    nonActivatedVerdicts.push(v);
    console.log(`  parsed ${agentId}: non-activated, reason ${v.reason_for_non_activation.length} chars`);
  }

  /* Step 2: write evidence-agent stub fixtures. The stub-loader will read
   * these on subsequent runtime case generations under STUB_MODE. */
  console.log("\nStep 2: write E1-E7 stub fixtures");
  const evidenceVerdicts: CaseEvidenceVerdict[] = [...activatedVerdicts, ...nonActivatedVerdicts];
  /* Pseudo usage figures consistent with the verdicts file's depth.
   * Live re-runs would replace these with actual SDK usage; for the
   * authored verdicts, we estimate. */
  const PARSED_USAGE = { input_tokens: 4200, output_tokens: 1200 };
  for (const v of evidenceVerdicts) {
    await writeStubFile(v.agent_id, "claude-sonnet-4-6 (parsed from verdicts.md)", verdictToStubText(v), PARSED_USAGE);
  }

  /* Step 3: load investor + mandate + holdings. */
  console.log("\nStep 3: load Sharma investor record");
  const investorRecord = await prisma.investor.findUnique({ where: { id: "sharma" } });
  if (!investorRecord) {
    throw new Error("Sharma investor row not found. Run npm run db:seed first.");
  }
  const holdings = HOLDINGS_BY_INVESTOR.sharma;
  const mandate = MANDATES_BY_INVESTOR.sharma;
  const totalAum = holdings.totalLiquidAumCr;
  const currentEquityCr = holdings.holdings
    .filter((h) => h.assetClass === "Equity")
    .reduce((s, h) => s + h.valueCr, 0);
  const currentEquityPct = (currentEquityCr / totalAum) * 100;

  const ctx: CaseAgentContext = {
    caseId: CASE_FIXTURE_ID,
    asOfDate: "2026-04-02",
    investorName: investorRecord.name,
    investorMandate: buildContextSummary(mandate, currentEquityPct),
    portfolioScope: buildPortfolioScope(),
    proposal: SHARMA_PROPOSAL,
    indianContext: null,
  };

  /* Step 4: run G1, G2, G3 deterministically. */
  console.log("\nStep 4: run G1, G2, G3 deterministic gates");
  const g1 = runG1({
    investorId: investorRecord.id,
    investorName: investorRecord.name,
    liquidAumCr: totalAum,
    holdings,
    mandate,
    proposal: SHARMA_PROPOSAL,
  });
  const g2 = await runG2({ proposal: SHARMA_PROPOSAL });
  const g3 = runG3({ proposal: SHARMA_PROPOSAL, advisorName: ADVISOR_NAME });
  const gateResults: GateResult[] = [g1, g2, g3];
  console.log(`  G1: ${g1.status} (${g1.rationale})`);
  console.log(`  G2: ${g2.status} (${g2.rationale})`);
  console.log(`  G3: ${g3.status} (${g3.rationale})`);

  /* Step 5: live LLM call for S1.case_mode. Pass NO stubKey so the harness
   * goes to the SDK regardless of STUB_MODE; record manually after. */
  console.log("\nStep 5: live LLM call for S1.case_mode (Opus 4.7)");
  const s1Result = await runS1Case({
    ctx,
    evidence_verdicts: evidenceVerdicts,
    gate_results: gateResults,
    /* Hybrid: E1-E7 verdicts authored in the verdicts file; S1 and A1
     * live-generated; M0.IndianContext skipped pending Workstream C. The
     * coverage note will reflect this honest provenance. */
    generation_mode: "hybrid",
  });
  console.log(`  S1 done: ${s1Result.usage.inputTokens} input + ${s1Result.usage.outputTokens} output tokens; verdict=${s1Result.output.section_2_synthesis_verdict.overall_verdict}, risk=${s1Result.output.section_2_synthesis_verdict.overall_risk_level}`);
  await writeStubFile(
    "s1_case_mode",
    "claude-opus-4-7",
    s1Result.rawText,
    { input_tokens: s1Result.usage.inputTokens, output_tokens: s1Result.usage.outputTokens },
  );

  /* Step 6: live LLM call for A1. */
  console.log("\nStep 6: live LLM call for A1.challenge (Opus 4.7)");
  const a1Result = await runA1Case({
    ctx,
    s1_synthesis: s1Result.output,
    evidence_verdicts: evidenceVerdicts,
    gate_results: gateResults,
  });
  console.log(`  A1 done: ${a1Result.usage.inputTokens} input + ${a1Result.usage.outputTokens} output tokens; ${a1Result.output.challenges.length} challenges`);
  await writeStubFile(
    "a1_challenge",
    "claude-opus-4-7",
    a1Result.rawText,
    { input_tokens: a1Result.usage.inputTokens, output_tokens: a1Result.usage.outputTokens },
  );

  /* Step 7: assemble the BriefingCaseContent. Section 4 (governance) is
   * built from the gate results deterministically; section 5 from A1. */
  console.log("\nStep 7: assemble BriefingCaseContent");
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

  /* Step 8: assemble the case fixture and write to disk. The fixture shape
   * matches the CaseFixture type in db/seed.ts so npm run db:seed picks
   * it up. */
  console.log("\nStep 8: write case fixture");
  const totalInput = s1Result.usage.inputTokens + a1Result.usage.inputTokens + PARSED_USAGE.input_tokens * 5;
  const totalOutput = s1Result.usage.outputTokens + a1Result.usage.outputTokens + PARSED_USAGE.output_tokens * 5;
  const tokenUsage = {
    per_agent: {
      e1: PARSED_USAGE,
      e2: PARSED_USAGE,
      e3: PARSED_USAGE,
      e4: PARSED_USAGE,
      e6: PARSED_USAGE,
      s1: { inputTokens: s1Result.usage.inputTokens, outputTokens: s1Result.usage.outputTokens },
      a1: { inputTokens: a1Result.usage.inputTokens, outputTokens: a1Result.usage.outputTokens },
    },
    total_input_tokens: totalInput,
    total_output_tokens: totalOutput,
    generated_at: new Date().toISOString(),
  };

  const headlineFromVerdict = `${briefing.section_2_synthesis_verdict.overall_verdict.replace(/_/g, " ")}: ${briefing.section_2_synthesis_verdict.narrative_paragraph.split(".")[0]}.`;

  const severityFromVerdict: string = (() => {
    const ov = briefing.section_2_synthesis_verdict.overall_verdict;
    if (ov === "negative" || ov === "requires_clarification") return "escalate";
    if (ov === "positive_with_caveat" || ov === "neutral_with_caveat") return "flag";
    return "info";
  })();

  const caseFixture = {
    id: CASE_FIXTURE_ID,
    investorId: "sharma",
    snapshotId: SNAPSHOT_ID,
    workflow: "s1",
    severity: severityFromVerdict,
    headline: headlineFromVerdict,
    status: "ready",
    frozenAt: new Date().toISOString(),
    content: {
      briefing,
      gate_results: gateResults,
      evidence_verdicts: evidenceVerdicts,
      proposal: SHARMA_PROPOSAL,
      usage_summary: tokenUsage,
    },
    tokenUsage,
    errorMessage: null,
    contextNote: "Canonical Sharma + Marcellus proposal-evaluation case. Slice 3 commit 9. STUB_MODE replay of parsed E1-E7 verdicts plus live-generated S1.case_mode and A1.challenge. M0.IndianContext skipped pending Workstream C YAML curation.",
    stubbed: true,
  };

  await fs.writeFile(CASE_FIXTURE_PATH, JSON.stringify(caseFixture, null, 2), "utf-8");
  console.log(`  wrote case fixture: ${path.relative(ROOT, CASE_FIXTURE_PATH)}`);

  console.log("\nDone.");
  console.log(`  E1-E7 stubs: ${ACTIVATED_AGENTS.length + NON_ACTIVATED_AGENTS.length} files`);
  console.log(`  S1.case_mode stub: 1 file`);
  console.log(`  A1.challenge stub: 1 file`);
  console.log(`  Case fixture: 1 file at ${path.relative(ROOT, CASE_FIXTURE_PATH)}`);
  console.log(`  Live LLM tokens: ${s1Result.usage.inputTokens + a1Result.usage.inputTokens} in / ${s1Result.usage.outputTokens + a1Result.usage.outputTokens} out`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("FAILED:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
