"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DECISION_LABELS, type CaseDecision, type DecisionAction } from "@/lib/format/case-decision";

type Props = {
  caseId: string;
  initial: CaseDecision | null;
};

const ACTIONS: DecisionAction[] = ["approve", "approve_with_conditions", "reject", "defer"];

export function DecisionCapture({ caseId, initial }: Props) {
  const router = useRouter();
  const [action, setAction] = useState<DecisionAction | null>(initial?.action ?? null);
  const [rationale, setRationale] = useState<string>(initial?.rationale ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(initial?.capturedAt ?? null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!action) {
      setError("Pick a decision action.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/decision`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rationale }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const { decision } = (await res.json()) as { decision: CaseDecision };
      setSavedAt(decision.capturedAt);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save decision");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="decision-capture">
      <h2>
        <span className="sec-num">07</span>Decision
      </h2>
      <p className="section-sub">
        Capture the decision on this case. No downstream actioning in the MVP; the decision
        persists on the case record alongside the briefing.
      </p>
      <div className="decision-actions">
        {ACTIONS.map((a) => (
          <label key={a} className={`decision-radio ${action === a ? "is-selected" : ""}`}>
            <input
              type="radio"
              name="decision-action"
              value={a}
              checked={action === a}
              onChange={() => setAction(a)}
              disabled={submitting}
            />
            <span>{DECISION_LABELS[a]}</span>
          </label>
        ))}
      </div>
      <div className="textarea-wrap mt-3">
        <textarea
          rows={3}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Rationale (advisor-facing audit trail). Free text."
          disabled={submitting}
        />
      </div>
      {error && (
        <div className="text-small text-neg mt-2" role="alert">
          {error}
        </div>
      )}
      <div className="decision-footer mt-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={save}
          disabled={submitting || !action}
        >
          {submitting ? "Saving…" : savedAt ? "Update decision" : "Save decision"}
        </button>
        {savedAt && (
          <span className="text-[11.5px] text-ink-4 font-mono ml-3">
            Last saved {new Date(savedAt).toLocaleString("en-IN", { hour12: false })}
          </span>
        )}
      </div>
    </section>
  );
}
