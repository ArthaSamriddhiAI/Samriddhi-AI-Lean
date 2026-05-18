/* Samriddhi 1 Case Detail, Outcome tab (default view).
 *
 * Concept C (locked accordion redesign): the synthesis verdict risk,
 * confidence, and governance gates fold into an always-visible Verdict
 * band; the seven user-facing surfaces become a signal-led accordion. The
 * persisted seven-section briefing is unchanged; this is a presentational
 * mapping only. section_3_evidence_summary stays the compressed roll-up
 * that the Analyst Reports tab expands; it is not its own row.
 */

import type {
  BriefingCaseContent,
  AdvisoryChallengeItem,
  GovernanceStatusItem,
  SynthesisVerdictSection,
} from "@/lib/agents/case/briefing-case-content";
import type { CaseDecision } from "@/lib/format/case-decision";
import type { Proposal } from "@/lib/agents/proposal";
import type { MaterialityOutput } from "@/lib/agents/materiality";
import type { IC1Deliberation } from "@/lib/agents/ic1/types";
import { labelFor } from "@/lib/format/case-intent";
import { riskLevelToSeverity, ic1Severity, type Severity } from "@/lib/format/case-accordion";
import { Accordion, type AccordionItem } from "./Accordion";
import { DecisionCapture } from "./DecisionCapture";
import { IC1Body } from "./IC1Section";

type Props = {
  caseId: string;
  briefing: BriefingCaseContent;
  proposal: Proposal;
  decision: CaseDecision | null;
  materiality: MaterialityOutput | null;
  ic1Deliberation: IC1Deliberation | null;
};

/* These optional fields land in Step 5 (schema additions) and are
 * populated by the fixture backfill. Until then they read as undefined
 * and the accordion renders the row with no serif headline, which the
 * locked plan explicitly allows for the visual commit. */
type SynthesisWithHeadline = SynthesisVerdictSection & { headline_takeaway?: string };
type ChallengeWithHeadline = AdvisoryChallengeItem & { headline_takeaway?: string };

function gatePillStateClass(status: GovernanceStatusItem["status"]): string {
  if (status === "pass") return "";
  if (status === "fail") return "fail";
  return "clarify";
}

function gateStatusLabel(status: GovernanceStatusItem["status"]): string {
  if (status === "pass") return "Pass";
  if (status === "fail") return "Blocked";
  return "Clarify";
}

function gateCode(gateId: string): string {
  const m = gateId.toUpperCase().match(/G[1-3]/);
  return m ? m[0] : gateId.toUpperCase();
}

function challengeCategoryLabel(c: AdvisoryChallengeItem["category"]): string {
  if (c === "counter_argument") return "Counter-argument";
  if (c === "stress_test") return "Stress test";
  return "Edge case";
}

function VerdictBand({
  sv,
  gates,
}: {
  sv: SynthesisVerdictSection;
  gates: GovernanceStatusItem[];
}) {
  return (
    <div className="ar-verdict">
      <div className="ar-vsplit">
        <div className="ar-vlabel">Synthesis verdict</div>
        <div className={`ar-vrisk ${sv.overall_risk_level}`}>
          {sv.overall_risk_level} risk
        </div>
        <div className="ar-vmeta">
          <span>Confidence</span>
          <span className="v">{sv.confidence.toFixed(2)}</span>
          <span className="sep">·</span>
          <span>{sv.overall_verdict.replace(/_/g, " ")}</span>
          {sv.escalation_recommended && (
            <>
              <span className="sep">·</span>
              <span>escalation recommended</span>
            </>
          )}
        </div>
      </div>
      <div>
        <div className="ar-vlabel">Governance gates</div>
        <div className="ar-gov-row">
          {gates.map((g) => (
            <span
              key={g.gate_id}
              className={`ar-gov-pill ${gatePillStateClass(g.status)}`}
              title={g.rationale}
            >
              <span className="dot" />
              <span className="code">{gateCode(g.gate_id)}</span>
              <span className="status">{gateStatusLabel(g.status)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OutcomeTab({
  caseId,
  briefing,
  proposal,
  decision,
  materiality,
  ic1Deliberation,
}: Props) {
  const sv = briefing.section_2_synthesis_verdict as SynthesisWithHeadline;

  const synthesisSeverity: Severity = sv.escalation_recommended
    ? "esc"
    : riskLevelToSeverity(sv.overall_risk_level);

  const rows: AccordionItem[] = [];

  rows.push({
    id: "proposal",
    title: "Proposal summary",
    severity: "muted",
    body: <p className="case-paragraph">{briefing.section_1_proposal_summary.paragraph}</p>,
  });

  rows.push({
    id: "synthesis",
    title: "Synthesis",
    severity: synthesisSeverity,
    headline: sv.headline_takeaway,
    body: (
      <>
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
        {(() => {
          const ic1CfPopulated =
            ic1Deliberation &&
            ic1Deliberation.fires &&
            ic1Deliberation.counterfactual_engine.status === "populated"
              ? ic1Deliberation.counterfactual_engine
              : null;
          if (ic1CfPopulated) {
            return (
              <div className="verdict-subblock ic1-counterfactual">
                <h4>IC1 counterfactual</h4>
                {ic1CfPopulated.framing.map((p, i) => (
                  <p key={i} className="case-paragraph">
                    {p}
                  </p>
                ))}
                <ul className="ic1-alternative-paths">
                  {ic1CfPopulated.alternative_paths.map((a, i) => (
                    <li key={i}>
                      <span className="ic1-bullet-title">{a.label}.</span> {a.description}
                    </li>
                  ))}
                </ul>
              </div>
            );
          }
          return (
            sv.counterfactual_framing && (
              <div className="verdict-subblock">
                <h4>Counterfactual framing</h4>
                <p className="case-paragraph">{sv.counterfactual_framing}</p>
              </div>
            )
          );
        })()}
      </>
    ),
  });

  rows.push({
    id: "challenges",
    title: "Advisory challenges",
    severity: "flg",
    body: (
      <>
        <p className="section-sub">
          Surfaced by A1 as the questions the synthesis should be ready to answer in
          conversation with the investor.
        </p>
        <div className="challenge-list">
          {briefing.section_5_advisory_challenges.map((raw, i) => {
            const c = raw as ChallengeWithHeadline;
            return (
              <div key={i} className="challenge-card">
                <div className="challenge-cat">{challengeCategoryLabel(c.category)}</div>
                {c.headline_takeaway && (
                  <div className="challenge-headline">{c.headline_takeaway}</div>
                )}
                <div className="challenge-title">{c.title}</div>
                <p className="challenge-body">{c.body}</p>
              </div>
            );
          })}
        </div>
      </>
    ),
  });

  if (materiality && ic1Deliberation) {
    rows.push({
      id: "ic1",
      title: "IC1 deliberation",
      severity: ic1Severity(materiality, ic1Deliberation),
      body: <IC1Body materiality={materiality} deliberation={ic1Deliberation} />,
    });
  }

  rows.push({
    id: "talking",
    title: "Suggested talking points",
    severity: "muted",
    body: (
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
    ),
  });

  rows.push({
    id: "decision",
    title: "Decision",
    severity: "muted",
    body: <DecisionCapture caseId={caseId} initial={decision} />,
  });

  rows.push({
    id: "coverage",
    title: "Coverage and methodology",
    severity: "muted",
    body: (
      <>
        <p className="case-paragraph">
          {briefing.section_7_coverage_methodology_note.data_sufficiency_notes}
        </p>
        <div className="text-[11.5px] text-ink-4 font-mono mt-2">
          Case intent: {briefing.section_7_coverage_methodology_note.case_intent} · Dominant
          lens: {briefing.section_7_coverage_methodology_note.dominant_lens} · Generation
          mode: {briefing.section_7_coverage_methodology_note.generation_mode}
        </div>
      </>
    ),
  });

  const numbered = rows.map((r, i) => ({
    ...r,
    num: String(i + 1).padStart(2, "0"),
  }));

  return (
    <div className="ar-shell">
      <div className="ar-inner">
        <div className="ar-case-head">
          <div className="eye">Samriddhi 1 · Proposal evaluation</div>
          <h2>{labelFor(proposal.action_type)}</h2>
          <div className="ar-case-meta">
            <span>{proposal.target_instrument}</span>
            <span className="sep">·</span>
            <span>Rs {proposal.ticket_size_cr} Cr</span>
            <span className="sep">·</span>
            <span>from {proposal.source_of_funds.replace(/_/g, " ")}</span>
            <span className="sep">·</span>
            <span>{proposal.timeline.replace(/_/g, " ")}</span>
          </div>
          <VerdictBand sv={briefing.section_2_synthesis_verdict} gates={briefing.section_4_governance_status} />
        </div>
        <Accordion items={numbered} eyebrow="Detail" count={`${numbered.length} sections`} />
      </div>
    </div>
  );
}
