/* Samriddhi 1 Case Detail, Outcome tab (default view).
 *
 * Renders the seven-section briefing's user-facing surfaces: proposal
 * summary, synthesis verdict, governance status (G1/G2/G3 pills),
 * advisory challenges (A1's counter-arguments / stress tests / edge
 * cases), and the decision capture surface.
 *
 * The Analyst Reports tab (sibling component) renders the per-agent
 * verdicts for E1-E7; the Outcome tab carries only the compressed
 * roll-up in section_3_evidence_summary.
 */

import type {
  BriefingCaseContent,
  AdvisoryChallengeItem,
  GovernanceStatusItem,
  SynthesisVerdictSection,
} from "@/lib/agents/case/briefing-case-content";
import type { CaseDecision } from "@/lib/format/case-decision";
import type { Proposal } from "@/lib/agents/proposal";
import { labelFor } from "@/lib/format/case-intent";
import { DecisionCapture } from "./DecisionCapture";

type Props = {
  caseId: string;
  briefing: BriefingCaseContent;
  proposal: Proposal;
  decision: CaseDecision | null;
};

function verdictPillClass(v: SynthesisVerdictSection["overall_verdict"]): string {
  if (v === "negative" || v === "requires_clarification") return "verdict-pill verdict-neg";
  if (v === "positive_with_caveat" || v === "neutral_with_caveat") return "verdict-pill verdict-flag";
  if (v === "positive") return "verdict-pill verdict-pos";
  return "verdict-pill verdict-neutral";
}

function gatePillClass(status: GovernanceStatusItem["status"]): string {
  if (status === "pass") return "gate-pill gate-pass";
  if (status === "fail") return "gate-pill gate-fail";
  return "gate-pill gate-clarify";
}

function gatePillLabel(status: GovernanceStatusItem["status"]): string {
  if (status === "pass") return "GATE PASSED";
  if (status === "fail") return "GATE BLOCKED";
  return "REQUIRES CLARIFICATION";
}

function challengeCategoryLabel(c: AdvisoryChallengeItem["category"]): string {
  if (c === "counter_argument") return "Counter-argument";
  if (c === "stress_test") return "Stress test";
  return "Edge case";
}

export function OutcomeTab({ caseId, briefing, proposal, decision }: Props) {
  const sv = briefing.section_2_synthesis_verdict;

  return (
    <div className="outcome-tab">
      <article className="case-doc">
        <header className="case-doc-head">
          <div className="pdf-eyebrow">Proposal evaluation · Samriddhi 1</div>
          <h1 className="pdf-title">{labelFor(proposal.action_type)}</h1>
          <div className="pdf-subtitle">
            <span>{proposal.target_instrument}</span>
            <span className="dot-sep">·</span>
            <span className="mono">Rs {proposal.ticket_size_cr} Cr</span>
            <span className="dot-sep">·</span>
            <span>from {proposal.source_of_funds.replace(/_/g, " ")}</span>
            <span className="dot-sep">·</span>
            <span>{proposal.timeline.replace(/_/g, " ")}</span>
          </div>
        </header>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">01</span>Proposal summary
          </h2>
          <p className="case-paragraph">{briefing.section_1_proposal_summary.paragraph}</p>
        </section>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">02</span>Synthesis verdict
          </h2>
          <div className="verdict-head">
            <span className={verdictPillClass(sv.overall_verdict)}>
              {sv.overall_verdict.replace(/_/g, " ")}
            </span>
            <span className="verdict-meta">
              Risk <strong>{sv.overall_risk_level}</strong>
            </span>
            <span className="verdict-meta">
              Confidence <strong>{sv.confidence.toFixed(2)}</strong>
            </span>
            {sv.escalation_recommended && (
              <span className="verdict-meta verdict-meta-warn">
                Escalation recommended
              </span>
            )}
          </div>
          <p className="case-paragraph">{sv.narrative_paragraph}</p>

          {sv.consensus_areas.length > 0 && (
            <div className="verdict-subblock">
              <h4>Consensus areas</h4>
              <ul className="pdf-bullets">
                {sv.consensus_areas.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {sv.conflict_areas.length > 0 && (
            <div className="verdict-subblock">
              <h4>Conflict areas</h4>
              <ul className="pdf-bullets">
                {sv.conflict_areas.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {sv.amplification_flags.length > 0 && (
            <div className="verdict-subblock">
              <h4>Amplification flags</h4>
              <ul className="pdf-bullets">
                {sv.amplification_flags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {sv.counterfactual_framing && (
            <div className="verdict-subblock">
              <h4>Counterfactual framing</h4>
              <p className="case-paragraph">{sv.counterfactual_framing}</p>
            </div>
          )}
        </section>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">03</span>Governance status
          </h2>
          <div className="gate-list">
            {briefing.section_4_governance_status.map((g) => (
              <div key={g.gate_id} className="gate-row">
                <span className={gatePillClass(g.status)}>
                  {g.gate_id.toUpperCase().replace(/_/g, " ").replace("G1 MANDATE", "G1").replace("G2 SEBI REGULATORY", "G2").replace("G3 ACTION PERMISSION", "G3")} · {gatePillLabel(g.status)}
                </span>
                <span className="gate-rationale">{g.rationale}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">04</span>Advisory challenges
          </h2>
          <p className="section-sub">
            Surfaced by A1 as the questions the synthesis should be ready to answer in conversation with the investor.
          </p>
          <div className="challenge-list">
            {briefing.section_5_advisory_challenges.map((c, i) => (
              <div key={i} className="challenge-card">
                <div className="challenge-cat">{challengeCategoryLabel(c.category)}</div>
                <div className="challenge-title">{c.title}</div>
                <p className="challenge-body">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pdf-section">
          <h2>
            <span className="sec-num">05</span>Suggested talking points
          </h2>
          <div className="talking-points">
            {briefing.section_6_talking_points.map((t) => (
              <div key={t.number} className="talking-point">
                <span className="tp-num">{t.number}</span>
                <div>
                  <div className="tp-title">{t.title}</div>
                  <p className="tp-body">{t.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <DecisionCapture caseId={caseId} initial={decision} />

        <section className="pdf-section coverage-note">
          <h2>
            <span className="sec-num">07</span>Coverage and methodology
          </h2>
          <p className="case-paragraph">{briefing.section_7_coverage_methodology_note.data_sufficiency_notes}</p>
          <div className="text-[11.5px] text-ink-4 font-mono mt-2">
            Case intent: {briefing.section_7_coverage_methodology_note.case_intent} · Dominant lens: {briefing.section_7_coverage_methodology_note.dominant_lens} · Generation mode: {briefing.section_7_coverage_methodology_note.generation_mode}
          </div>
        </section>
      </article>
    </div>
  );
}
