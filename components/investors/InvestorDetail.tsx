import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Investor } from "@prisma/client";

type Props = { investor: Investor };

/* Static investor detail view. Header chrome derives from structured DB
 * fields; the body renders profileMd through react-markdown with remark-gfm
 * so the archetype's portfolio table and bold-prefix paragraphs format
 * correctly. The onboarding transcript (when present, Malhotra and Menon
 * only) renders below in a hairline-bordered frame, also via markdown
 * since the source is blockquoted dialogue. */

export function InvestorDetail({ investor }: Props) {
  return (
    <>
      <header className="id-header">
        <div className="eyebrow">Investor · {investor.structureLine}</div>
        <h1 className="id-name">{investor.name}</h1>
        <p className="id-summary">
          {investor.location} · {investor.riskAppetite} · {investor.timeHorizon} ·{" "}
          {investor.liquidityTier} tier · Liquid AUM Rs {investor.liquidAumCr.toFixed(2)} Cr
        </p>
      </header>

      <div className="id-attr-grid">
        <div className="id-attr">
          <div className="attr-eye">Structure</div>
          <div className="attr-val">{investor.structureLine}</div>
        </div>
        <div className="id-attr">
          <div className="attr-eye">Risk appetite</div>
          <div className="attr-val">{investor.riskAppetite}</div>
          <div className="attr-meta">{investor.timeHorizon}</div>
        </div>
        <div className="id-attr">
          <div className="attr-eye">Model cell</div>
          <div className="attr-val">{investor.modelCell.replace(/_/g, " ")}</div>
          <div className="attr-meta">Liquidity tier {investor.liquidityTier.toLowerCase()}</div>
        </div>
        <div className="id-attr">
          <div className="attr-eye">Liquid AUM</div>
          <div className="attr-val">Rs {investor.liquidAumCr.toFixed(2)} Cr</div>
          <div className="attr-meta">Advisory scope</div>
        </div>
        <div className="id-attr">
          <div className="attr-eye">Location</div>
          <div className="attr-val">{investor.location}</div>
        </div>
        <div className="id-attr">
          <div className="attr-eye">Identifier</div>
          <div className="attr-val">{investor.displayInitials}</div>
          <div className="attr-meta">{investor.id}</div>
        </div>
      </div>

      <section className="mb-9">
        <h3 className="font-serif text-[17px] font-medium m-0 mb-3 text-ink-1">Profile</h3>
        <div className="prose-doc">
          <Markdown remarkPlugins={[remarkGfm]}>{investor.profileMd}</Markdown>
        </div>
      </section>

      {investor.onboardingTranscript ? (
        <section className="mb-9">
          <h3 className="font-serif text-[17px] font-medium m-0 mb-3 text-ink-1">Onboarding transcript</h3>
          <div className="transcript-frame">
            <div className="prose-doc">
              <Markdown remarkPlugins={[remarkGfm]}>{investor.onboardingTranscript}</Markdown>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
