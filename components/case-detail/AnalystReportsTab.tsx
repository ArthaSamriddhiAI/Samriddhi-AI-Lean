/* Samriddhi 1 Case Detail, Analyst Reports tab (secondary view).
 *
 * Concept C (locked accordion redesign): each evidence agent is one
 * accordion row. The closed-state headline reuses the existing
 * section_3_evidence_summary.one_line_takeaway (locked decision B: it was
 * authored as exactly this compression and rendered nowhere until now),
 * joined to the verdict on agent_id. Risk maps to severity per locked
 * decision C. IC1 is one trailing row (decision A).
 */

import type { CaseEvidenceVerdict } from "@/lib/agents/case/case-verdict";
import type { EvidenceSummaryItem } from "@/lib/agents/case/briefing-case-content";
import type { MaterialityOutput } from "@/lib/agents/materiality";
import type { IC1Deliberation } from "@/lib/agents/ic1/types";
import { riskLevelToSeverity, ic1Severity, type Severity } from "@/lib/format/case-accordion";
import { Accordion, type AccordionItem } from "./Accordion";
import { IC1MemoBody } from "./IC1Memo";

const AGENT_LABELS: Record<string, string> = {
  e1_listed_fundamental_equity: "E1, Listed and Fundamental Equity Analysis Agent",
  e2_industry_business: "E2, Industry and Business Model Agent",
  e3_macro_policy_news: "E3, Macro, Policy, and News Agent",
  e4_behavioural_historical: "E4, Behavioural and Historical Agent",
  e5_unlisted_equity: "E5, Unlisted Equity Specialist Agent",
  e6_pms_aif_sif: "E6, PMS and AIF Fund Analysis Agent",
  e7_mutual_fund: "E7, Mutual Fund Analysis Agent",
};

function agentCode(agentId: string): string {
  const m = agentId.match(/^e[1-7]/i);
  return m ? m[0].toUpperCase() : agentId.toUpperCase();
}

type Props = {
  verdicts: CaseEvidenceVerdict[];
  summaries: EvidenceSummaryItem[];
  materiality: MaterialityOutput | null;
  ic1Deliberation: IC1Deliberation | null;
};

export function AnalystReportsTab({
  verdicts,
  summaries,
  materiality,
  ic1Deliberation,
}: Props) {
  const takeawayByAgent = new Map(
    summaries.map((s) => [s.agent_id, s.one_line_takeaway]),
  );

  const rows: AccordionItem[] = verdicts.map((v) => {
    const code = agentCode(v.agent_id);
    const title = AGENT_LABELS[v.agent_id] ?? v.agent_id;
    const headline = takeawayByAgent.get(v.agent_id);

    if (v.activation_status === "activated") {
      const severity: Severity = riskLevelToSeverity(v.risk_level);
      return {
        id: v.agent_id,
        num: code,
        title,
        headline,
        severity,
        status: v.risk_level,
        figure: `conf. ${v.confidence.toFixed(2)}`,
        body: (
          <>
            <div className="agent-memo-block">
              <h4>Drivers</h4>
              <ul className="pdf-bullets">
                {v.drivers.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
            {v.flags.length > 0 && (
              <div className="agent-memo-block">
                <h4>Flags</h4>
                <div className="flag-row">
                  {v.flags.map((f, i) => (
                    <span key={i} className="flag-pill">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="agent-memo-block">
              <h4>Reasoning</h4>
              <p>{v.reasoning_paragraph}</p>
            </div>
            <div className="agent-memo-block">
              <h4>Data points cited</h4>
              <ul className="pdf-bullets mono">
                {v.data_points_cited.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          </>
        ),
      };
    }

    return {
      id: v.agent_id,
      num: code,
      title,
      headline,
      severity: "muted" as Severity,
      status: "Not activated",
      body: (
        <div className="agent-memo-block agent-memo-nonactivated">
          <div className="non-activated-label">Not activated for this case</div>
          <p>{v.reason_for_non_activation}</p>
        </div>
      ),
    };
  });

  if (materiality && ic1Deliberation) {
    rows.push({
      id: "ic1",
      num: "IC1",
      title: "IC1, Committee Deliberation",
      severity: ic1Severity(materiality, ic1Deliberation),
      body: <IC1MemoBody materiality={materiality} deliberation={ic1Deliberation} />,
    });
  }

  return (
    <div className="ar-shell">
      <div className="ar-inner">
        <div className="ar-case-head">
          <div className="eye">Reasoning trail · per-agent analyst memos</div>
          <h2>Analyst reports</h2>
          <div className="ar-case-meta">
            <span>
              Activated agents carry full memos; non-activated agents carry the structural
              reason for non-activation.
            </span>
          </div>
        </div>
        <Accordion items={rows} eyebrow="Memos" count={`${verdicts.length} agents`} />
      </div>
    </div>
  );
}
