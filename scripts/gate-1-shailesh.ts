/* Gate 1: generate Shailesh Bhatt's diagnostic case from scratch via
 * the pipeline, then dump the briefing as PROPOSED_CASE_OUTPUT_SAMPLE.md
 * for human review before the other five investors get generated.
 *
 * Direct invocation of runDiagnosticPipeline; no HTTP. The dev server is
 * unrelated; this script connects to the same SQLite dev DB.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { generateCaseId } from "../lib/case-id";
import { runDiagnosticPipeline } from "../lib/agents/pipeline";
import type { BriefingContent } from "../lib/agents/s1-diagnostic";

const INVESTOR_ID = "bhatt";
const SNAPSHOT_ID = "t0_q2_2026";

async function main() {
  console.log(`[gate-1] Investor: ${INVESTOR_ID}; Snapshot: ${SNAPSHOT_ID}`);

  const caseId = await generateCaseId(INVESTOR_ID);
  await prisma.case.create({
    data: {
      id: caseId,
      investorId: INVESTOR_ID,
      snapshotId: SNAPSHOT_ID,
      workflow: "s2",
      severity: "info",
      headline: "Diagnostic in progress",
      status: "generating",
      contentJson: "{}",
    },
  });
  console.log(`[gate-1] Created case: ${caseId}`);

  console.log(`[gate-1] Running pipeline (expect 60-180s)...`);
  const t0 = Date.now();
  await runDiagnosticPipeline({ caseId, investorId: INVESTOR_ID, snapshotId: SNAPSHOT_ID });
  const elapsedMs = Date.now() - t0;
  console.log(`[gate-1] Pipeline finished in ${(elapsedMs / 1000).toFixed(1)}s`);

  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: { investor: true, snapshot: true },
  });
  if (!c) throw new Error("case row missing after pipeline run");
  console.log(`[gate-1] Status: ${c.status} | Severity: ${c.severity}`);
  if (c.status === "failed") {
    console.error(`[gate-1] FAILED: ${c.errorMessage}`);
    process.exit(1);
  }

  const content = JSON.parse(c.contentJson);
  const briefing: BriefingContent = content.briefing;

  const md = renderMarkdown({
    caseId,
    investorName: c.investor.name,
    snapshotLabel: c.snapshot.date.toISOString().slice(0, 10),
    briefing,
    metrics: content.metrics,
    routerDecision: content.router_decision,
    usage: content.usage_summary,
    elapsedMs,
  });

  const outPath = path.resolve(process.cwd(), "PROPOSED_CASE_OUTPUT_SAMPLE.md");
  await fs.writeFile(outPath, md, "utf-8");
  console.log(`[gate-1] Wrote ${outPath} (${md.length} chars)`);

  await prisma.$disconnect();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderMarkdown(args: {
  caseId: string;
  investorName: string;
  snapshotLabel: string;
  briefing: BriefingContent;
  metrics: any;
  routerDecision: any;
  usage: any;
  elapsedMs: number;
}): string {
  const { caseId, investorName, snapshotLabel, briefing, metrics, routerDecision, usage, elapsedMs } = args;
  const b = briefing;

  const lines: string[] = [];
  lines.push(`# Gate 1, Shailesh Bhatt diagnostic case output sample`);
  lines.push(``);
  lines.push(`This is the first end-to-end output of the Slice 2 diagnostic pipeline.`);
  lines.push(`Generated for review before the other five investors are run.`);
  lines.push(``);
  lines.push(`**Case ID:** \`${caseId}\``);
  lines.push(`**Investor:** ${investorName}`);
  lines.push(`**Snapshot:** ${snapshotLabel} (t0 baseline)`);
  lines.push(`**Generation:** ${(elapsedMs / 1000).toFixed(1)}s end to end`);
  lines.push(`**Severity (derived):** \`${pickOverallSeverity(b)}\``);
  lines.push(`**Headline:** ${b.section_1_headline_observations[0]?.one_line ?? "(none)"}`);
  lines.push(``);
  lines.push(`## Token usage (Sonnet 4.6 across all agents)`);
  lines.push(``);
  lines.push(`Total input tokens: \`${usage.total_input_tokens}\`; total output tokens: \`${usage.total_output_tokens}\`.`);
  lines.push(`Per-agent breakdown:`);
  lines.push(``);
  for (const [agent, u] of Object.entries(usage.per_agent ?? {}) as Array<[string, { inputTokens: number; outputTokens: number } | undefined]>) {
    if (!u) continue;
    lines.push(`- \`${agent}\`: ${u.inputTokens} in / ${u.outputTokens} out`);
  }
  lines.push(``);
  lines.push(`Router decision: ${routerDecision.activated.join(", ")} activated. ${routerDecision.reasoning}`);
  lines.push(``);

  lines.push(`---`);
  lines.push(``);
  lines.push(`## Header (chrome metadata)`);
  lines.push(``);
  lines.push(`- Investor: ${b.header.investor_name}`);
  lines.push(`- Case label: ${b.header.case_label}`);
  lines.push(`- Snapshot date: ${b.header.snapshot_date}`);
  lines.push(`- Liquid AUM: ${b.header.liquid_aum_label}`);
  lines.push(`- Holdings: ${b.header.holdings_label}`);
  lines.push(`- Stated/revealed: ${b.header.stated_revealed_label}`);
  lines.push(`- Severity counts: escalate=${b.header.severity_counts.escalate}, flag=${b.header.severity_counts.flag}, total=${b.header.severity_counts.total}`);
  lines.push(``);

  lines.push(`## Workbench lede`);
  lines.push(``);
  lines.push(`> ${b.workbench_lede}`);
  lines.push(``);

  lines.push(`## Section 1, Headline observations (${b.section_1_headline_observations.length})`);
  lines.push(``);
  for (const o of b.section_1_headline_observations) {
    lines.push(`- **\`${o.vocab}\`** [${o.severity}, source: ${o.source}]`);
    lines.push(`  ${o.one_line}`);
  }
  lines.push(``);

  lines.push(`## Section 2, Portfolio overview`);
  lines.push(``);
  lines.push(`| Asset class | Actual | Target | Band | Deviation | In band |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const r of b.section_2_portfolio_overview.rows) {
    lines.push(`| ${r.asset_class} | ${r.actual_pct.toFixed(1)}% | ${r.target_pct}% | ${r.band[0]}-${r.band[1]}% | ${r.deviation_pp > 0 ? "+" : ""}${r.deviation_pp.toFixed(1)} pp | ${r.in_band ? "yes" : "no"} |`);
  }
  lines.push(``);
  lines.push(`*${b.section_2_portfolio_overview.total_aum_line}*`);
  lines.push(`*${b.section_2_portfolio_overview.liquidity_tier_line}*`);
  lines.push(``);

  lines.push(`## Section 3, Concentration analysis (${b.section_3_concentration_analysis.length})`);
  lines.push(``);
  if (b.section_3_concentration_analysis.length === 0) {
    lines.push(`*No concentration breaches surfaced.*`);
  } else {
    for (const c of b.section_3_concentration_analysis) {
      lines.push(`- **${c.kind} concentration** [${c.severity}, source: ${c.source}] · ${c.figure}`);
      lines.push(`  ${c.detail} *${c.evidence}*`);
    }
  }
  lines.push(``);

  lines.push(`## Section 4, Risk flags (${b.section_4_risk_flags.length})`);
  lines.push(``);
  for (const f of b.section_4_risk_flags) {
    lines.push(`- **${f.title}** [${f.category}, ${f.severity}, source: ${f.source}]`);
    lines.push(`  ${f.body}`);
  }
  lines.push(``);

  lines.push(`## Section 5, Comparison vs model portfolio`);
  lines.push(``);
  lines.push(`*${b.section_5_comparison_vs_model.framing_line}*`);
  lines.push(``);
  lines.push(`| Equity sleeve | Model | Actual | Note |`);
  lines.push(`|---|---|---|---|`);
  for (const r of b.section_5_comparison_vs_model.rows) {
    lines.push(`| ${r.sleeve} | ${r.model_pct} | ${r.actual_pct} | ${r.note} |`);
  }
  lines.push(``);

  lines.push(`## Section 6, Suggested talking points`);
  lines.push(``);
  for (const t of b.section_6_talking_points) {
    lines.push(`**${t.number}.** ${t.body}${t.emphasis ? ` *${t.emphasis}*` : ""}`);
    lines.push(``);
  }

  lines.push(`## Section 7, Evidence appendix`);
  lines.push(``);
  lines.push(`| Holding | Sub-category | Value | Weight |`);
  lines.push(`|---|---|---|---|`);
  for (const e of b.section_7_evidence_appendix) {
    lines.push(`| ${e.name} | \`${e.sub_category}\` | ${e.value_cr} | ${e.weight_pct} |`);
  }
  lines.push(``);

  lines.push(`## Coverage note`);
  lines.push(``);
  lines.push(`> ${b.coverage_note}`);
  lines.push(``);

  lines.push(`---`);
  lines.push(``);
  lines.push(`## Deterministic metrics annex (M0.PortfolioRiskAnalytics output)`);
  lines.push(``);
  lines.push(`These are the auditable numbers the LLM agents reasoned against.`);
  lines.push(``);
  lines.push("```json");
  lines.push(JSON.stringify(metrics, null, 2));
  lines.push("```");
  lines.push(``);

  return lines.join("\n");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickOverallSeverity(b: BriefingContent): string {
  const all: string[] = [];
  for (const o of b.section_1_headline_observations) all.push(o.severity);
  for (const c of b.section_3_concentration_analysis) all.push(c.severity);
  for (const f of b.section_4_risk_flags) all.push(f.severity);
  if (all.includes("escalate")) return "escalate";
  if (all.includes("flag")) return "flag";
  if (all.includes("info")) return "info";
  return "ok";
}

main().catch((err) => {
  console.error("[gate-1] error:", err);
  process.exit(1);
});
