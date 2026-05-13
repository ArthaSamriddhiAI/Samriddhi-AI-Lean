import Link from "next/link";
import { Lock } from "@/components/chrome/Icons";

/* Step 0: workflow selection. Samriddhi 2 is selected by default and
 * routes to /cases/new/diagnostic. Samriddhi 1 is disabled with a
 * "Coming in slice 3" badge until the proposal evaluation slice lands. */

export default function NewCaseWorkflowPage() {
  return (
    <div className="new-case-page">
      <div className="nc-eyebrow">Cases / New</div>
      <h1 className="nc-title">What are you working on?</h1>
      <p className="nc-sub">
        Select the workflow. Each type produces different analytical output and follows a different intake flow.
      </p>

      <div className="wf-pick-grid">
        <div className="wf-card is-selected">
          <div className="wf-card-radio" />
          <div className="wf-card-id">Samriddhi 2</div>
          <div className="wf-card-name">Portfolio diagnostic</div>
          <div className="wf-card-desc">
            Analyse an investor&apos;s current portfolio against the indicative model portfolio.
            Surfaces diagnostic observations across concentration, liquidity, mandate drift,
            behaviour, fee drag, and deployment efficiency. Produces a briefing PDF and frozen
            case audit trail.
          </div>
        </div>
        <div className="wf-card is-disabled" aria-disabled="true">
          <div className="wf-card-badge">Coming in slice 3</div>
          <div className="wf-card-radio" />
          <div className="wf-card-id">Samriddhi 1</div>
          <div className="wf-card-name">Proposal evaluation</div>
          <div className="wf-card-desc">
            Evaluate a proposed action: new instrument allocation, cash infusion, rebalancing,
            or redemption. Runs the EGA evidence framework across activated agents (E1 through
            E7), synthesis layer S1, governance gates G1 through G3, and advisory challenge A1.
          </div>
        </div>
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
          <Link href="/cases/new/diagnostic" className="btn btn-primary btn-lg no-underline">
            Continue with Portfolio diagnostic
          </Link>
        </div>
      </div>
    </div>
  );
}
