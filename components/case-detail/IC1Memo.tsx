/* IC1 Committee Deliberation memo for the Samriddhi 1 Analyst Reports tab.
 *
 * Per Slice 4 orientation §4, this memo follows the seven E1-E7 memos
 * in the same institutional voice and visual register: heading,
 * lead-paragraph summary, per-role subsections. Calm, calibrated,
 * declarative; not louder than the E memos, not visually distinct.
 *
 * Rendering paths:
 *   1. materiality.fires === false: this component returns null. No
 *      shell for a non-existent deliberation per the orientation.
 *      AnalystReportsTab guards on this branch.
 *   2. materiality.fires === true AND all five roles in sentinel state:
 *      heading + one-line "IC1 deliberation pending" prose with the
 *      DEFERRED item reference. Consistent with the Outcome tab signal.
 *   3. materiality.fires === true AND any role populated: Minutes
 *      Recorder summary as the lead paragraph; per-role subsections
 *      (Chair, Devil's Advocate, Risk Assessor, Counterfactual Engine)
 *      with role name as small-caps subheading. Each role respects its
 *      own status discriminator; sentinel roles surface a short pending
 *      pill in their subsection.
 */

import type { MaterialityOutput } from "@/lib/agents/materiality";
import type {
  ChairPayload,
  CounterfactualEnginePayload,
  DevilsAdvocatePayload,
  IC1Deliberation,
  MinutesRecorderPayload,
  RiskAssessorPayload,
  StructuredAlternative,
  StructuredBullet,
} from "@/lib/agents/ic1/types";

type Props = {
  materiality: MaterialityOutput;
  deliberation: IC1Deliberation;
};

const PENDING_BODY =
  "IC1 deliberation pending; infrastructure ready; awaiting live generation per DEFERRED item 12.";

export function IC1Memo({ materiality, deliberation }: Props) {
  if (!materiality.fires || !deliberation.fires) return null;

  const allSentinel =
    deliberation.chair.status === "infrastructure_ready" &&
    deliberation.devils_advocate.status === "infrastructure_ready" &&
    deliberation.risk_assessor.status === "infrastructure_ready" &&
    deliberation.counterfactual_engine.status === "infrastructure_ready" &&
    deliberation.minutes_recorder.status === "infrastructure_ready";

  return (
    <article className="agent-memo">
      <h2 className="agent-memo-heading">IC1, Committee Deliberation</h2>
      {allSentinel ? (
        <div className="agent-memo-block">
          <p>{PENDING_BODY}</p>
        </div>
      ) : (
        <>
          <MinutesRecorderBlock payload={deliberation.minutes_recorder} />
          <ChairBlock payload={deliberation.chair} />
          <DevilsAdvocateBlock payload={deliberation.devils_advocate} />
          <RiskAssessorBlock payload={deliberation.risk_assessor} />
          <CounterfactualEngineBlock payload={deliberation.counterfactual_engine} />
        </>
      )}
    </article>
  );
}

function RolePending() {
  return <p className="ic1-memo-pending">Contribution pending; awaiting live generation.</p>;
}

function Paragraphs({ items }: { items: string[] }) {
  return (
    <>
      {items.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </>
  );
}

function BulletList({ items }: { items: StructuredBullet[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="pdf-bullets">
      {items.map((b, i) => (
        <li key={i}>
          <strong>{b.title}.</strong> {b.body}
        </li>
      ))}
    </ul>
  );
}

function AlternativeList({ items }: { items: StructuredAlternative[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="pdf-bullets">
      {items.map((a, i) => (
        <li key={i}>
          <strong>{a.label}.</strong> {a.description}
        </li>
      ))}
    </ul>
  );
}

function MinutesRecorderBlock({ payload }: { payload: MinutesRecorderPayload }) {
  return (
    <div className="agent-memo-block">
      <h4>Minutes Recorder summary</h4>
      {payload.status === "populated" ? <Paragraphs items={payload.summary} /> : <RolePending />}
    </div>
  );
}

function ChairBlock({ payload }: { payload: ChairPayload }) {
  return (
    <div className="agent-memo-block">
      <h4>Chair</h4>
      {payload.status === "populated" ? (
        <>
          <Paragraphs items={payload.framing} />
          <p className="ic1-memo-deliberation-question">{payload.deliberation_question}</p>
        </>
      ) : (
        <RolePending />
      )}
    </div>
  );
}

function DevilsAdvocateBlock({ payload }: { payload: DevilsAdvocatePayload }) {
  return (
    <div className="agent-memo-block">
      <h4>Devil&apos;s Advocate</h4>
      {payload.status === "populated" ? (
        <>
          <Paragraphs items={payload.position} />
          <BulletList items={payload.specific_challenges} />
        </>
      ) : (
        <RolePending />
      )}
    </div>
  );
}

function RiskAssessorBlock({ payload }: { payload: RiskAssessorPayload }) {
  return (
    <div className="agent-memo-block">
      <h4>Risk Assessor</h4>
      {payload.status === "populated" ? (
        <>
          <Paragraphs items={payload.evaluation} />
          <BulletList items={payload.specific_risks} />
        </>
      ) : (
        <RolePending />
      )}
    </div>
  );
}

function CounterfactualEngineBlock({ payload }: { payload: CounterfactualEnginePayload }) {
  return (
    <div className="agent-memo-block">
      <h4>Counterfactual Engine</h4>
      {payload.status === "populated" ? (
        <>
          <Paragraphs items={payload.framing} />
          <AlternativeList items={payload.alternative_paths} />
        </>
      ) : (
        <RolePending />
      )}
    </div>
  );
}
