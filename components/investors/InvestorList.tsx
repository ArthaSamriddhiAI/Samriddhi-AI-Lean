import Link from "next/link";
import type { Investor } from "@prisma/client";
import { Avatar } from "@/components/chrome/Avatar";
import { Chev } from "@/components/chrome/Icons";

type Props = {
  investors: Array<Investor & { caseCount: number; lastFindingLabel: string | null }>;
};

export function InvestorList({ investors }: Props) {
  return (
    <div className="investor-table">
      <div className="it-head">
        <span>Investor</span>
        <span>Structure</span>
        <span>Mandate</span>
        <span className="r">Liquid AUM</span>
        <span className="r">Cases</span>
        <span />
      </div>

      {investors.map((inv) => (
        <Link key={inv.id} href={`/investors/${inv.id}`} className="contents no-underline">
          <div className="it-row">
            <div className="it-identity">
              <Avatar name={inv.name} size={32} />
              <div className="min-w-0">
                <div className="name">{inv.name}</div>
                <div className="meta">{inv.metaLine}</div>
              </div>
            </div>
            <div className="text-[12.5px] text-ink-2">{inv.structureLine}</div>
            <div className="it-mandate">
              <span className="m-line">{inv.riskAppetite}</span>
              <span className="m-sub">
                {inv.timeHorizon} · {inv.liquidityTier}
              </span>
            </div>
            <div className="r text-[14px] text-ink-1">₹{inv.liquidAumCr.toFixed(2)} Cr</div>
            <div className="r text-[13px] text-ink-2">
              <span className="mono">{inv.caseCount}</span>
              {inv.lastFindingLabel ? (
                <div className="text-[10.5px] text-ink-4 mt-0.5 font-sans text-right">
                  {inv.lastFindingLabel}
                </div>
              ) : null}
            </div>
            <div className="ct-chev" style={{ paddingRight: 0 }}>
              <Chev size={12} dir="r" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
