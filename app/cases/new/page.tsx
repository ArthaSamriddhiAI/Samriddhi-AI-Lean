"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock } from "@/components/chrome/Icons";

/* Step 0: workflow selection. Two workflows available as of Slice 3:
 *   Samriddhi 2 (portfolio diagnostic) routes to /cases/new/diagnostic.
 *   Samriddhi 1 (proposal evaluation) routes to /cases/new/proposal. */

type Workflow = "s2" | "s1";

export default function NewCaseWorkflowPage() {
  const [selected, setSelected] = useState<Workflow>("s2");
  const continueHref = selected === "s1" ? "/cases/new/proposal" : "/cases/new/diagnostic";
  const continueLabel =
    selected === "s1" ? "Continue with Proposal evaluation" : "Continue with Portfolio diagnostic";

  return (
    <div className="new-case-page">
      <div className="nc-eyebrow">Cases / New</div>
      <h1 className="nc-title">What are you working on?</h1>
      <p className="nc-sub">
        Select the workflow. Each type produces different analytical output and follows a different intake flow.
      </p>

      <div className="wf-pick-grid">
        <button
          type="button"
          className={`wf-card ${selected === "s2" ? "is-selected" : ""}`}
          onClick={() => setSelected("s2")}
        >
          <div className="wf-card-radio" />
          <div className="wf-card-id">Samriddhi 2</div>
          <div className="wf-card-name">Portfolio diagnostic</div>
          <div className="wf-card-desc">
            Analyse an investor&apos;s current portfolio against the indicative model portfolio.
            Surfaces diagnostic observations across concentration, liquidity, mandate drift,
            behaviour, fee drag, and deployment efficiency. Produces a briefing PDF and frozen
            case audit trail.
          </div>
        </button>
        <button
          type="button"
          className={`wf-card ${selected === "s1" ? "is-selected" : ""}`}
          onClick={() => setSelected("s1")}
        >
          <div className="wf-card-radio" />
          <div className="wf-card-id">Samriddhi 1</div>
          <div className="wf-card-name">Proposal evaluation</div>
          <div className="wf-card-desc">
            Evaluate a proposed action: new instrument allocation, cash infusion, rebalancing,
            or redemption. Runs the EGA evidence framework across activated agents (E1 through
            E7), synthesis layer S1, governance gates G1 through G3, and advisory challenge A1.
          </div>
        </button>
      </div>

      <div className="nc-foot">
        <div className="nc-foot-note">
          <Lock size={11} />
          Each workflow type produces different analytical output. Cases cannot change type after creation.
        </div>
        <div className="flex gap-2.5">
          <Link href="/cases" className="btn btn-ghost no-underline">
            Cancel
          </Link>
          <Link href={continueHref} className="btn btn-primary btn-lg no-underline">
            {continueLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
