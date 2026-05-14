"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock } from "@/components/chrome/Icons";
import {
  FORM_CASE_INTENTS,
  labelFor,
  type CaseIntent,
} from "@/lib/format/case-intent";
import type {
  SourceOfFunds,
  TargetCategory,
  Timeline,
} from "@/lib/agents/proposal";

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

const TARGET_CATEGORIES: { value: TargetCategory; label: string }[] = [
  { value: "pms", label: "PMS" },
  { value: "aif", label: "AIF" },
  { value: "mutual_fund", label: "Mutual fund" },
  { value: "listed_equity_direct", label: "Listed equity (direct)" },
  { value: "unlisted_equity", label: "Unlisted equity" },
  { value: "fixed_deposit", label: "Fixed deposit" },
  { value: "bond_listed", label: "Listed bond" },
  { value: "cash", label: "Cash" },
  { value: "gold", label: "Gold" },
  { value: "other", label: "Other" },
];

const SOURCE_OF_FUNDS_OPTIONS: { value: SourceOfFunds; label: string }[] = [
  { value: "fixed_deposits", label: "Fixed deposits" },
  { value: "mutual_funds", label: "Mutual funds" },
  { value: "cash_balance", label: "Cash balance" },
  { value: "existing_pms", label: "Existing PMS position" },
  { value: "existing_aif", label: "Existing AIF position" },
  { value: "fresh_inflow", label: "Fresh inflow (external)" },
];

const TIMELINE_OPTIONS: { value: Timeline; label: string }[] = [
  { value: "immediate", label: "Immediate" },
  { value: "this_quarter", label: "This quarter" },
  { value: "this_year", label: "This year" },
  { value: "opportunistic", label: "Opportunistic" },
];

function formatSnapshotDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function ProposalForm({ investors, snapshots }: Props) {
  const router = useRouter();
  const [investorId, setInvestorId] = useState(investors[0]?.id ?? "");
  const [snapshotId, setSnapshotId] = useState(snapshots[0]?.id ?? "");
  const [actionType, setActionType] = useState<CaseIntent>("new_investment");
  const [targetCategory, setTargetCategory] = useState<TargetCategory>("pms");
  const [targetInstrument, setTargetInstrument] = useState("");
  const [ticketCr, setTicketCr] = useState<number>(1);
  const [sourceOfFunds, setSourceOfFunds] = useState<SourceOfFunds>("fixed_deposits");
  const [timeline, setTimeline] = useState<Timeline>("this_quarter");
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow: "s1",
          investorId,
          snapshotId,
          proposal: {
            action_type: actionType,
            target_category: targetCategory,
            target_instrument: targetInstrument.trim(),
            ticket_size_cr: ticketCr,
            source_of_funds: sourceOfFunds,
            timeline,
            rationale: rationale.trim() || null,
          },
        }),
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
        </div>

        <div className="field">
          <label htmlFor="action-type">Action type</label>
          <select
            id="action-type"
            className="select-native"
            value={actionType}
            onChange={(e) => setActionType(e.target.value as CaseIntent)}
            disabled={submitting}
          >
            {FORM_CASE_INTENTS.map((intent) => (
              <option key={intent} value={intent}>
                {labelFor(intent)}
              </option>
            ))}
          </select>
          <span className="field-hint">
            Determines the dominant analytical lens (portfolio_shift vs proposal_evaluation).
          </span>
        </div>

        <div className="field">
          <label htmlFor="target-category">Target category</label>
          <select
            id="target-category"
            className="select-native"
            value={targetCategory}
            onChange={(e) => setTargetCategory(e.target.value as TargetCategory)}
            disabled={submitting}
          >
            {TARGET_CATEGORIES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="target-instrument">Target instrument</label>
          <input
            id="target-instrument"
            type="text"
            className="text-input"
            value={targetInstrument}
            onChange={(e) => setTargetInstrument(e.target.value)}
            placeholder="e.g. Marcellus Consistent Compounder PMS"
            disabled={submitting}
          />
          <span className="field-hint">
            Free-text instrument name. Used as case context in agent prompts.
          </span>
        </div>

        <div className="field">
          <label htmlFor="ticket">Ticket size (Rs Cr)</label>
          <input
            id="ticket"
            type="number"
            className="text-input mono"
            value={ticketCr}
            min={0.01}
            step={0.1}
            onChange={(e) => setTicketCr(Number(e.target.value))}
            disabled={submitting}
          />
          <span className="field-hint">
            Validated against SEBI minima (PMS Rs 50 lakh, AIF Rs 1 Cr) by G2.
          </span>
        </div>

        <div className="field">
          <label htmlFor="source-of-funds">Source of funds</label>
          <select
            id="source-of-funds"
            className="select-native"
            value={sourceOfFunds}
            onChange={(e) => setSourceOfFunds(e.target.value as SourceOfFunds)}
            disabled={submitting}
          >
            {SOURCE_OF_FUNDS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="timeline">Timeline</label>
          <select
            id="timeline"
            className="select-native"
            value={timeline}
            onChange={(e) => setTimeline(e.target.value as Timeline)}
            disabled={submitting}
          >
            {TIMELINE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="rationale">
            Rationale <span className="optional">optional</span>
          </label>
          <div className="textarea-wrap">
            <textarea
              id="rationale"
              rows={3}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Free text. Captured on the case, not pipeline-consequential."
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
          Case is generated once and frozen for audit.
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
            disabled={
              submitting ||
              !investorId ||
              !snapshotId ||
              !targetInstrument.trim() ||
              ticketCr <= 0
            }
          >
            {submitting ? "Generating…" : "Evaluate proposal"}
          </button>
        </div>
      </div>
    </>
  );
}
