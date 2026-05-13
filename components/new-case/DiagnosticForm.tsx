"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock } from "@/components/chrome/Icons";

type InvestorOption = {
  id: string;
  name: string;
  metaLine: string;
  riskAppetite: string;
  liquidAumCr: number;
};

type SnapshotOption = {
  id: string;
  date: Date;
  type: string;
  holdingsCount: number;
};

type Props = {
  investors: InvestorOption[];
  snapshots: SnapshotOption[];
};

function formatSnapshotDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function DiagnosticForm({ investors, snapshots }: Props) {
  const router = useRouter();
  const [investorId, setInvestorId] = useState(investors[0]?.id ?? "");
  const [snapshotId, setSnapshotId] = useState(snapshots[0]?.id ?? "");
  const [contextNote, setContextNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investorId, snapshotId, contextNote: contextNote || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/cases/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create case");
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="form-stack">
        <div className="field">
          <label htmlFor="investor">Investor</label>
          <select
            id="investor"
            className="select-native"
            value={investorId}
            onChange={(e) => setInvestorId(e.target.value)}
            disabled={submitting}
          >
            {investors.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.name} · {inv.metaLine} · Rs {inv.liquidAumCr.toFixed(2)} Cr · {inv.riskAppetite}
              </option>
            ))}
          </select>
          <span className="field-hint">
            Pre-seeded profiles: Malhotra, Iyengar, Bhatt, Menon, Surana, Sharma.
          </span>
        </div>

        <div className="field">
          <label htmlFor="snapshot">Portfolio snapshot</label>
          <select
            id="snapshot"
            className="select-native"
            value={snapshotId}
            onChange={(e) => setSnapshotId(e.target.value)}
            disabled={submitting}
          >
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {formatSnapshotDate(s.date)} · {s.type} · {s.holdingsCount.toLocaleString()} fund records
              </option>
            ))}
          </select>
          <span className="field-hint">
            Snapshot is the basis of the briefing. The case freezes it on generation.
          </span>
        </div>

        <div className="field">
          <label htmlFor="context">
            Meeting context <span className="optional">optional</span>
          </label>
          <div className="textarea-wrap">
            <textarea
              id="context"
              rows={3}
              value={contextNote}
              onChange={(e) => setContextNote(e.target.value)}
              placeholder="Free text. Quoted back to you in the briefing talking points where relevant."
              disabled={submitting}
            />
          </div>
        </div>

        {error && (
          <div className="text-small text-neg" role="alert">
            {error}
          </div>
        )}
      </div>

      <div className="nc-foot">
        <div className="nc-foot-note">
          <Lock size={11} />
          Briefing is generated once and frozen for audit.
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => router.push("/cases")}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={submit}
            disabled={submitting || !investorId || !snapshotId}
          >
            {submitting ? "Generating…" : "Generate briefing"}
          </button>
        </div>
      </div>
    </>
  );
}
