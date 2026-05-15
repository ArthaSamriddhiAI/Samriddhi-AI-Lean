"use client";

/* IC1 deliberation surface on the Samriddhi 1 Case Detail Outcome tab.
 *
 * Three rendering paths per Slice 4 orientation §3:
 *
 *   1. materiality.fires === false
 *        One paragraph in ink-secondary register naming the
 *        deterministic reason. No expansion control. Institutional
 *        audit trail: "I checked, IC1 was not needed for this case,
 *        here is why."
 *
 *   2. materiality.fires === true AND all five sub-agent roles in
 *      sentinel state
 *        Small-caps "IC1 DELIBERATION PENDING" eyebrow plus one
 *        paragraph of body prose per the Slice 4 scoping confirmation.
 *        Same visual register as the CaseStubBadge from Slice 3:
 *        institutional honesty about a deferred state, not a debug
 *        warning.
 *
 *   3. materiality.fires === true AND any role populated
 *        Minutes Recorder summary (if populated) renders by default
 *        as 2-3 paragraphs. Expansion control reveals the four per-role
 *        contributions in order: Chair, Devil's Advocate, Risk Assessor,
 *        Counterfactual Engine. Each role respects its own status
 *        discriminator: populated roles render full content; sentinel
 *        roles render a small inline pending pill.
 *
 * The third branch is the post-deferred-resolution state; the second
 * branch is the Slice 4 ship state.
 */

import { useState } from "react";
import type { MaterialityOutput } from "@/lib/agents/materiality";
import type {
  ChairPayload,
  CounterfactualEnginePayload,
  DevilsAdvocatePayload,
  IC1Deliberation,
  RiskAssessorPayload,
  StructuredAlternative,
  StructuredBullet,
} from "@/lib/agents/ic1/types";

type Props = {
  materiality: MaterialityOutput;
  deliberation: IC1Deliberation;
};

const SENTINEL_BODY =
  "IC1 deliberation infrastructure is wired and ready. Live deliberation content for this case is scheduled to populate when the firm enables live committee mode. The architecture renders on this surface; the deliberation roles, materiality threshold logic, and synthesis surface are all in place.";

export function IC1Section({ materiality, deliberation }: Props) {
  const [expanded, setExpanded] = useState(false);

  /* Branch 1: materiality threshold not reached. */
  if (!materiality.fires || !deliberation.fires) {
    return (
      <section className="pdf-section">
        <h2>
          <span className="sec-num">05</span>IC1 deliberation
        </h2>
        <p className="ic1-not-reached">{materiality.reason}</p>
      </section>
    );
  }

  const allSentinel =
    deliberation.chair.status === "infrastructure_ready" &&
    deliberation.devils_advocate.status === "infrastructure_ready" &&
    deliberation.risk_assessor.status === "infrastructure_ready" &&
    deliberation.counterfactual_engine.status === "infrastructure_ready" &&
    deliberation.minutes_recorder.status === "infrastructure_ready";

  /* Branch 2: full sentinel state. */
  if (allSentinel) {
    return (
      <section className="pdf-section">
        <h2>
          <span className="sec-num">05</span>IC1 deliberation
        </h2>
        <div className="ic1-pending-eyebrow">IC1 DELIBERATION PENDING</div>
        <p className="case-paragraph">{SENTINEL_BODY}</p>
      </section>
    );
  }

  /* Branch 3: any role populated. */
  const minutes = deliberation.minutes_recorder;
  return (
    <section className="pdf-section">
      <h2>
        <span className="sec-num">05</span>IC1 deliberation
      </h2>
      <p className="section-sub">
        Committee-level analysis surfaced because materiality fired on this case.
      </p>
      {minutes.status === "populated" ? (
        minutes.summary.map((p, i) => (
          <p key={i} className="case-paragraph">
            {p}
          </p>
        ))
      ) : (
        <p className="case-paragraph ic1-not-reached">
          Executive summary pending; per-role contributions below.
        </p>
      )}
      <button
        type="button"
        className="ic1-expand-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? "Hide per-role contributions" : "Show per-role contributions"}
      </button>
      {expanded && (
        <div className="ic1-roles">
          <ChairBlock payload={deliberation.chair} />
          <DevilsAdvocateBlock payload={deliberation.devils_advocate} />
          <RiskAssessorBlock payload={deliberation.risk_assessor} />
          <CounterfactualEngineBlock payload={deliberation.counterfactual_engine} />
        </div>
      )}
    </section>
  );
}

function PendingPill({ roleLabel }: { roleLabel: string }) {
  return <span className="ic1-role-pending">{roleLabel} pending</span>;
}

function Paragraphs({ items }: { items: string[] }) {
  return (
    <>
      {items.map((p, i) => (
        <p key={i} className="case-paragraph">
          {p}
        </p>
      ))}
    </>
  );
}

function BulletList({ items }: { items: StructuredBullet[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="ic1-role-bullets">
      {items.map((b, i) => (
        <li key={i}>
          <span className="ic1-bullet-title">{b.title}.</span> {b.body}
        </li>
      ))}
    </ul>
  );
}

function AlternativeList({ items }: { items: StructuredAlternative[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="ic1-role-bullets">
      {items.map((a, i) => (
        <li key={i}>
          <span className="ic1-bullet-title">{a.label}.</span> {a.description}
        </li>
      ))}
    </ul>
  );
}

function ChairBlock({ payload }: { payload: ChairPayload }) {
  return (
    <div className="ic1-role-block">
      <h3 className="ic1-role-heading">Chair</h3>
      {payload.status === "populated" ? (
        <>
          <Paragraphs items={payload.framing} />
          <p className="ic1-deliberation-question">{payload.deliberation_question}</p>
        </>
      ) : (
        <PendingPill roleLabel="Chair contribution" />
      )}
    </div>
  );
}

function DevilsAdvocateBlock({ payload }: { payload: DevilsAdvocatePayload }) {
  return (
    <div className="ic1-role-block">
      <h3 className="ic1-role-heading">Devil&apos;s Advocate</h3>
      <p className="section-sub">Challenges the committee should resolve before approval.</p>
      {payload.status === "populated" ? (
        <>
          <Paragraphs items={payload.position} />
          <BulletList items={payload.specific_challenges} />
        </>
      ) : (
        <PendingPill roleLabel="Devil's Advocate contribution" />
      )}
    </div>
  );
}

function RiskAssessorBlock({ payload }: { payload: RiskAssessorPayload }) {
  return (
    <div className="ic1-role-block">
      <h3 className="ic1-role-heading">Risk Assessor</h3>
      {payload.status === "populated" ? (
        <>
          <Paragraphs items={payload.evaluation} />
          <BulletList items={payload.specific_risks} />
        </>
      ) : (
        <PendingPill roleLabel="Risk Assessor contribution" />
      )}
    </div>
  );
}

function CounterfactualEngineBlock({ payload }: { payload: CounterfactualEnginePayload }) {
  return (
    <div className="ic1-role-block">
      <h3 className="ic1-role-heading">Counterfactual Engine</h3>
      {payload.status === "populated" ? (
        <>
          <Paragraphs items={payload.framing} />
          <AlternativeList items={payload.alternative_paths} />
        </>
      ) : (
        <PendingPill roleLabel="Counterfactual Engine contribution" />
      )}
    </div>
  );
}
