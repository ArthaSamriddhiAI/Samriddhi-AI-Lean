/* Model portfolio surface (Package 10, RE1 as ratified).
 *
 * Read-only over data on main: the nine-cell matrix (structure plus the
 * cells that have real content), the foundation section 2 indicative
 * register, each investor's mandate as resolved (ADR-0032), and the
 * persisted instrument-selection output from the frozen Samriddhi 2 cases
 * (ADR-0034). No live funnel recompute and no house-view framework display:
 * that framework is held with in-flight colleague work (logged as product
 * debt); the per-cell band framework remains P43. Zero writes, zero model
 * calls (WA12).
 */

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MODEL_BANDS, resolveTargetBands } from "@/lib/agents/portfolio-risk-analytics";
import type { Mandate } from "@/db/fixtures/structured-mandates";
import type { AssetClass } from "@/db/fixtures/structured-holdings";
import {
  RISK_ROWS,
  HORIZON_COLS,
  RISK_LABELS,
  HORIZON_LABELS,
  cellId,
  ANCHOR_CELL,
  PENDING_SENTINEL,
} from "@/lib/explorer/cells";
import { ExplorerTabs } from "@/components/explorer/ExplorerTabs";
import s from "@/components/explorer/explorer.module.css";

export const dynamic = "force-dynamic";

const ASSET_CLASSES: AssetClass[] = ["Equity", "Debt", "Alternatives", "Cash"];

/* Persisted funnel output shapes (structural reads of the frozen case
 * content; authored by lib/agents/instrument-selection.ts, ADR-0034). */
type Candidate = { fund_name?: string; ter_pct?: number | null; sharpe_3y?: number | null; aum_cr?: number | null };
type Shortlist = {
  label?: string;
  surfaced?: Candidate[];
  eligible_count?: number;
  cohort_count?: number;
  degraded?: boolean;
  degradation_reason?: string | null;
};
type EquitySubBucket = {
  bucket?: string;
  target_pct?: number;
  current_pct?: number;
  deploy_cr?: number;
  shortlist?: Shortlist;
  cadence?: { note?: string };
};
type SleevePlan = {
  sleeve?: string;
  deploy_cr?: number;
  equity?: { sub_buckets?: EquitySubBucket[]; diversified_option?: Shortlist } | null;
  debt?: { target_duration?: string | null; credit_buckets?: { bucket?: string; shortlist?: Shortlist }[] } | null;
  alternatives?: { gold_pct?: number; gold_shortlist?: Shortlist; non_gold_aif_pct?: number } | null;
  top_ups?: { holding_ref?: string; matched_fund?: string; recommendation?: string }[];
};

function fm(v: number | null | undefined, digits = 1): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "n/a";
}

function ShortlistCard({ title, gapLine, sl }: { title: string; gapLine: string | null; sl: Shortlist | undefined }) {
  return (
    <div className={s.card}>
      <div style={{ fontFamily: "var(--font-source-serif-4), serif", fontSize: 13.5, fontWeight: 500 }}>{title}</div>
      {gapLine ? <div className={s.srcNote} style={{ marginTop: 2 }}>{gapLine}</div> : null}
      {sl?.degraded ? (
        <div className={s.cellNote} style={{ marginTop: 6 }}>
          Degraded honestly: {sl.degradation_reason ?? "empty candidate pool"}. No padded list.
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>
          {(sl?.surfaced ?? []).map((c, i) => (
            <div key={i} className={s.fundRow}>
              <span>{c.fund_name}</span>
              <span className={s.fundMeta}>
                TER {fm(c.ter_pct, 2)} · Sharpe {fm(c.sharpe_3y, 2)}
              </span>
            </div>
          ))}
          {typeof sl?.eligible_count === "number" ? (
            <div className={s.srcNote}>
              eligible {sl.eligible_count} → cohort {sl.cohort_count} → surfaced {(sl.surfaced ?? []).length} of internal 5
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default async function ModelPortfolioPage() {
  const investors = await prisma.investor.findMany({ orderBy: { name: "asc" } });
  const s2cases = await prisma.case.findMany({
    where: { workflow: "s2" },
    include: { investor: true },
    orderBy: { frozenAt: "asc" },
  });

  const byCell = new Map<string, typeof investors>();
  for (const inv of investors) {
    const list = byCell.get(inv.modelCell) ?? [];
    list.push(inv);
    byCell.set(inv.modelCell, list);
  }
  const pending = byCell.get(PENDING_SENTINEL) ?? [];

  const mandates = investors
    .filter((i) => i.mandateJson)
    .map((i) => {
      const mandate = JSON.parse(i.mandateJson as string) as Mandate;
      return { investor: i, mandate, resolved: resolveTargetBands(mandate) };
    });

  const plans = s2cases
    .map((c) => {
      try {
        const content = JSON.parse(c.contentJson) as Record<string, unknown>;
        const a3 = content.a3_so_what as { deployment_plan?: SleevePlan[] | null } | undefined;
        return { caseRow: c, plan: a3?.deployment_plan ?? null };
      } catch {
        return { caseRow: c, plan: null };
      }
    })
    .filter((p) => Array.isArray(p.plan) && p.plan.length > 0);

  return (
    <div className={s.page}>
      <div className="eyebrow">Workspace · Explorer · read-only</div>
      <h1>Model portfolio</h1>
      <p className="mt-2 max-w-prose text-ink-3" style={{ fontSize: 14 }}>
        The reference register the diagnostics compare against, the nine-cell matrix in its honest current state,
        each investor&apos;s mandate as resolved, and the persisted best-pick output from the frozen cases. Nothing
        on this page is editable and nothing recomputes.
      </p>
      <ExplorerTabs active="model" />

      {/* 01 nine-cell matrix */}
      <section className={s.section}>
        <div className={s.secHead}>
          <div className={s.secNum}>01</div>
          <div className={s.secTitle}>
            Nine-cell matrix<em>risk profile by time horizon</em>
          </div>
          <div className={s.secAside}>cell ids per Investor.modelCell · framework P43, pending</div>
        </div>
        <div className={s.grid3}>
          <div />
          {HORIZON_COLS.map((h) => (
            <div key={h} className={s.gridAxis}>
              {HORIZON_LABELS[h]}
            </div>
          ))}
          {RISK_ROWS.map((r) => (
            <CellRow key={r} risk={r} byCell={byCell} />
          ))}
        </div>
        <div className={s.srcNote}>
          Resolution precedence (ADR-0032): an investor&apos;s own mandate governs wherever one exists; the anchor
          cell&apos;s MODEL_BANDS are the no-mandate fallback; per-cell firm defaults would slot between the two when
          the risk-by-horizon framework (P43) lands. The house-view sub-sleeve extension that would seed cell
          defaults is held with in-flight colleague work and is deliberately not shown.
          {pending.length > 0 ? (
            <>
              {" "}
              Cell pending (onboarded, mandate conversation open): {pending.map((i) => i.name).join(", ")}.
            </>
          ) : null}
        </div>
      </section>

      {/* 02 indicative register */}
      <section className={s.section}>
        <div className={s.secHead}>
          <div className={s.secNum}>02</div>
          <div className={s.secTitle}>
            Indicative reference cell<em>foundation section 2, the anchor register</em>
          </div>
          <div className={s.secAside}>aggressive_long_term · 65 / 25 / 7 / 3</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24, alignItems: "start" }}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Sub-category</th>
                <th className={s.r}>% of AUM</th>
                <th>Vehicle mix</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3} style={{ fontFamily: "var(--font-source-serif-4), serif", fontWeight: 500 }}>
                  Equity · target 65 · band 60-70
                </td>
              </tr>
              <Row label="MF active large cap" sub="mf_active_large_cap" pct="40" mix="Active managed large cap MFs" />
              <Row label="MF passive index" sub="mf_passive_index" pct="10" mix="Nifty 50, Nifty Next 50" />
              <Row label="PMS growth quality" sub="pms_growth_quality" pct="10" mix="SEBI-registered PMS, Rs 50 L+ ticket" />
              <Row label="Listed large cap direct" sub="listed_large_cap" pct="5" mix="Advisor-curated conviction positions" />
              <tr>
                <td colSpan={3} style={{ fontFamily: "var(--font-source-serif-4), serif", fontWeight: 500 }}>
                  Debt · target 25 · band 20-30
                </td>
              </tr>
              <Row label="Tax-free bonds" sub="tax_free_bond" pct="8" mix="NHAI, PFC, REC" />
              <Row label="Corporate debt MF" sub="mf_corporate_debt" pct="8" mix="Corporate debt mutual funds" />
              <Row label="Short-term debt MF" sub="mf_short_term_debt" pct="5" mix="Short-duration funds" />
              <Row label="Bank FD" sub="bank_fd" pct="4" mix="Scheduled-maturity deposits" />
              <tr>
                <td colSpan={3} style={{ fontFamily: "var(--font-source-serif-4), serif", fontWeight: 500 }}>
                  Alternatives · target 7 · band 5-10 &nbsp;·&nbsp; Cash · target 3 · band 2-5
                </td>
              </tr>
              <Row label="AIF Cat II PE / private credit" sub="aif_cat_ii_pe, aif_cat_ii_private_credit" pct="4" mix="SEBI-registered Cat II AIF" />
              <Row label="Gold, SGB or physical" sub="sovereign_gold_bond, physical_gold" pct="3" mix="SGB preferred" />
              <Row label="Liquid MF or savings" sub="savings" pct="3" mix="Tactical and near-term needs" />
            </tbody>
          </table>
          <div className={s.card}>
            <div className={s.cellId}>register note</div>
            <div className={s.cellNote}>
              This is the foundation section 2 vocabulary: the single indicative cell the MVP ships, used as the
              comparison reference and the no-mandate fallback. It is not a recommendation, and since ADR-0032 the
              operative comparison for every seeded investor is their own mandate (section 03). The firm-replacement
              and editing surfaces are deliberately out of scope.
            </div>
          </div>
        </div>
      </section>

      {/* 03 mandates as resolved */}
      <section className={s.section}>
        <div className={s.secHead}>
          <div className={s.secNum}>03</div>
          <div className={s.secTitle}>
            Investor mandates, as resolved<em>the operative comparators</em>
          </div>
          <div className={s.secAside}>mandateJson · resolveTargetBands · ADR-0032</div>
        </div>
        <div className={s.mandateGrid}>
          {mandates.map(({ investor, mandate, resolved }) => (
            <div key={investor.id} className={s.card}>
              <div style={{ fontFamily: "var(--font-source-serif-4), serif", fontSize: 14.5, fontWeight: 500 }}>
                {investor.name}
              </div>
              <div className={s.srcNote} style={{ margin: "2px 0 8px" }}>
                <span className={investor.modelCell === ANCHOR_CELL ? s.chipReal : s.chipAmber}>{investor.modelCell}</span>{" "}
                · {mandate.source}
              </div>
              {ASSET_CLASSES.map((cls) => {
                const b = resolved[cls];
                return (
                  <div key={cls} className={s.bandRow}>
                    <span>{cls}</span>
                    <span className={s.bandTrack}>
                      <span className={s.bandFill} style={{ left: `${b.min}%`, width: `${Math.max(0, b.max - b.min)}%` }} />
                      <span className={s.bandTarget} style={{ left: `${b.target}%` }} />
                    </span>
                    <span className={s.bandVal}>
                      {b.min}-{b.max} · t {b.target}
                    </span>
                  </div>
                );
              })}
              <div className={s.srcNote}>
                {mandate.position_concentration_ceilings
                  .map((c) => `${c.scope.replace(/_/g, " ")} ceiling ${c.max_pct_of_liquid_aum}%`)
                  .join(" · ")}
                {mandate.wrapper_count_ceilings.length > 0
                  ? " · " + mandate.wrapper_count_ceilings.map((w) => `${w.wrapper_type} max ${w.max_count}`).join(" · ")
                  : ""}
                {mandate.instrument_exclusions.length > 0 ? ` · excludes ${mandate.instrument_exclusions.join(", ")}` : ""}
                {investor.modelCell === "conservative_medium_term"
                  ? " · model comparison renders as informational for this cell"
                  : ""}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 04 persisted best-pick shortlists */}
      <section className={s.section}>
        <div className={s.secHead}>
          <div className={s.secNum}>04</div>
          <div className={s.secTitle}>
            Best-pick shortlists, persisted<em>frozen funnel output, no live recompute</em>
          </div>
          <div className={s.secAside}>ADR-0034 · content.a3_so_what.deployment_plan</div>
        </div>
        {plans.map(({ caseRow, plan }) => (
          <div key={caseRow.id} style={{ marginBottom: 26 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: "var(--font-source-serif-4), serif", fontSize: 15.5, fontWeight: 500 }}>
                {caseRow.investor.name}
              </span>
              <span className={s.chipMuted}>
                <Link href={`/cases/${caseRow.id}`}>{caseRow.id}</Link> · frozen {caseRow.frozenAt.toISOString().slice(0, 10)}
              </span>
            </div>
            <div className={s.slGrid}>
              {(plan as SleevePlan[]).map((sleeve, i) => (
                <SleeveCards key={i} sleeve={sleeve} />
              ))}
            </div>
          </div>
        ))}
        <div className={s.srcNote}>
          Read-only render of the deterministic instrument-selection output persisted in each frozen Samriddhi 2 case
          (quality-gated funnel, surfaced 3 of internal 5, honest degradation; mechanics ADR-0034, parameters house
          view v1 pending calibration, P45). There is no live recompute control: the house-view framework the funnel
          consumes is held with in-flight colleague work. Case links are plain navigation; the case screen is
          untouched (WA29).
        </div>
      </section>

      <div className={s.footer}>
        Sources: Investor and Case rows (Prisma), MODEL_BANDS and resolveTargetBands
        (lib/agents/portfolio-risk-analytics.ts), foundation section 2 register, persisted a3_so_what.deployment_plan
        (lib/agents/instrument-selection.ts shapes). Read-only; zero model calls; zero writes.
      </div>
    </div>
  );
}

function Row({ label, sub, pct, mix }: { label: string; sub: string; pct: string; mix: string }) {
  return (
    <tr>
      <td>
        {label}
        <span className={s.srcNote} style={{ display: "block", marginTop: 1 }}>
          {sub}
        </span>
      </td>
      <td className={s.r}>{pct}</td>
      <td className={s.small}>{mix}</td>
    </tr>
  );
}

function CellRow({
  risk,
  byCell,
}: {
  risk: (typeof RISK_ROWS)[number];
  byCell: Map<string, { id: string; name: string }[]>;
}) {
  return (
    <>
      <div className={s.gridAxis}>{RISK_LABELS[risk]}</div>
      {HORIZON_COLS.map((h) => {
        const id = cellId(risk, h);
        const members = byCell.get(id) ?? [];
        const isAnchor = id === ANCHOR_CELL;
        const hasInstance = members.length > 0;
        return (
          <div key={id} className={isAnchor ? s.cellAnchor : hasInstance ? s.cell : s.cellEmpty}>
            <div className={s.cellId}>
              {id}
              {isAnchor ? " · anchor" : ""}
            </div>
            {isAnchor ? (
              <>
                {(["Equity", "Debt", "Alternatives", "Cash"] as AssetClass[]).map((cls) => (
                  <div key={cls} className={s.kv}>
                    <span>{cls}</span>
                    <b>
                      t {MODEL_BANDS[cls].target} · {MODEL_BANDS[cls].min}-{MODEL_BANDS[cls].max}
                    </b>
                  </div>
                ))}
                <div className={s.srcNote}>foundation section 2 reference</div>
              </>
            ) : hasInstance ? (
              <div className={s.cellNote}>
                No firm default authored; the investor-specified mandate governs (section 03).
              </div>
            ) : (
              <div className={s.cellNote}>Unauthored. Firm default pending the P43 framework; house-view extension held.</div>
            )}
            {members.length > 0 ? (
              <div style={{ marginTop: 7, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {members.map((m) => (
                  <span key={m.id} className={isAnchor ? s.chipReal : s.chipAmber}>
                    {m.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function SleeveCards({ sleeve }: { sleeve: SleevePlan }) {
  const cards: React.ReactNode[] = [];
  if (sleeve.equity?.sub_buckets) {
    for (const b of sleeve.equity.sub_buckets) {
      cards.push(
        <ShortlistCard
          key={`eq-${b.bucket}`}
          title={`Equity · ${String(b.bucket ?? "").replace(/_/g, " ")}`}
          gapLine={`target ${fm(b.target_pct)}% · current ${fm(b.current_pct)}% · deploy ${fm(b.deploy_cr, 2)} Cr${b.cadence?.note ? ` · ${b.cadence.note}` : ""}`}
          sl={b.shortlist}
        />,
      );
    }
    if (sleeve.equity.diversified_option) {
      cards.push(
        <ShortlistCard
          key="eq-div"
          title="Equity · diversified option"
          gapLine="offered as its own option, not decomposed into the cap pools (ADR-0035 ruling B)"
          sl={sleeve.equity.diversified_option}
        />,
      );
    }
  }
  if (sleeve.debt?.credit_buckets) {
    for (const cb of sleeve.debt.credit_buckets) {
      cards.push(
        <ShortlistCard
          key={`debt-${cb.bucket}`}
          title={`Debt · ${String(cb.bucket ?? "").replace(/_/g, " ")}`}
          gapLine={sleeve.debt.target_duration ? `preferred duration: ${sleeve.debt.target_duration}` : null}
          sl={cb.shortlist}
        />,
      );
    }
  }
  if (sleeve.alternatives) {
    cards.push(
      <ShortlistCard
        key="alt-gold"
        title="Alternatives · gold"
        gapLine={`gold ${fm(sleeve.alternatives.gold_pct)}% · non-gold AIF ${fm(sleeve.alternatives.non_gold_aif_pct)}% (advisor-select)`}
        sl={sleeve.alternatives.gold_shortlist}
      />,
    );
  }
  if ((sleeve.top_ups ?? []).length > 0) {
    cards.push(
      <div key="topups" className={s.card}>
        <div style={{ fontFamily: "var(--font-source-serif-4), serif", fontSize: 13.5, fontWeight: 500 }}>
          {sleeve.sleeve} · held-fund top-ups
        </div>
        <div style={{ marginTop: 6 }}>
          {(sleeve.top_ups ?? []).map((t, i) => (
            <div key={i} className={s.fundRow}>
              <span>{t.matched_fund ?? t.holding_ref}</span>
              <span className={s.fundMeta}>{(t.recommendation ?? "").replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      </div>,
    );
  }
  return <>{cards}</>;
}
