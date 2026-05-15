/* Samriddhi 1 Case Detail, Analyst Reports tab (secondary view).
 *
 * Stacks the seven evidence agent verdicts in the structure documented
 * in db/fixtures/raw/sharma_marcellus_evidence_verdicts.md: heading,
 * risk level, confidence, drivers, flags, reasoning paragraph, data
 * points cited. Non-activated agents render a short reason line only.
 *
 * Per Slice 3 orientation: "The Analyst Reports tab is NOT an AI debate
 * showcase; it reads as institutional analyst memos stacked." Visual
 * treatment matches the foundation §6 voice — calm, declarative.
 */

import type { CaseEvidenceVerdict, CaseRiskLevel } from "@/lib/agents/case/case-verdict";
import type { MaterialityOutput } from "@/lib/agents/materiality";
import type { IC1Deliberation } from "@/lib/agents/ic1/types";
import { IC1Memo } from "./IC1Memo";

const AGENT_LABELS: Record<string, string> = {
  e1_listed_fundamental_equity: "E1, Listed and Fundamental Equity Analysis Agent",
  e2_industry_business: "E2, Industry and Business Model Agent",
  e3_macro_policy_news: "E3, Macro, Policy, and News Agent",
  e4_behavioural_historical: "E4, Behavioural and Historical Agent",
  e5_unlisted_equity: "E5, Unlisted Equity Specialist Agent",
  e6_pms_aif_sif: "E6, PMS and AIF Fund Analysis Agent",
  e7_mutual_fund: "E7, Mutual Fund Analysis Agent",
};

function riskPillClass(level: CaseRiskLevel): string {
  if (level === "low") return "risk-pill risk-low";
  if (level === "moderate") return "risk-pill risk-mod";
  if (level === "elevated") return "risk-pill risk-elev";
  return "risk-pill risk-high";
}

type Props = {
  verdicts: CaseEvidenceVerdict[];
  materiality: MaterialityOutput | null;
  ic1Deliberation: IC1Deliberation | null;
};

export function AnalystReportsTab({ verdicts, materiality, ic1Deliberation }: Props) {
  return (
    <div className="analyst-reports">
      <div className="analyst-reports-intro">
        <p>
          Per-agent verdicts from the evidence layer. Activated agents (E1, E2, E3, E4, E6
          for the canonical Sharma case) carry full analyst memos; non-activated agents
          carry the structural reason for non-activation.
        </p>
      </div>
      <div className="agent-memos">
        {verdicts.map((v) => (
          <article key={v.agent_id} className="agent-memo">
            <h2 className="agent-memo-heading">{AGENT_LABELS[v.agent_id] ?? v.agent_id}</h2>
            {v.activation_status === "activated" ? (
              <>
                <div className="agent-memo-meta">
                  <span className={riskPillClass(v.risk_level)}>{v.risk_level} risk</span>
                  <span className="mono">Confidence {v.confidence.toFixed(2)}</span>
                </div>
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
            ) : (
              <div className="agent-memo-block agent-memo-nonactivated">
                <div className="non-activated-label">Not activated for this case</div>
                <p>{v.reason_for_non_activation}</p>
              </div>
            )}
          </article>
        ))}
        {materiality && ic1Deliberation && (
          <IC1Memo materiality={materiality} deliberation={ic1Deliberation} />
        )}
      </div>
    </div>
  );
}
