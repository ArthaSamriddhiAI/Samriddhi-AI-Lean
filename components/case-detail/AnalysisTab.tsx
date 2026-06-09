/* Samriddhi 2 case-detail analysis surface, composed to the locked v7.2
 * wireframe (supersedes the Concept C briefing accordion for this screen; see
 * the v7.2-supersedes-Concept-C ADR). The page is an always-visible
 * headline-takeaway, then a div.accordion of numbered content sections
 * (01 to 04 open by default, 06/07/08/09/11 collapsible) built as native
 * <details>, then an always-visible disclaimer. Severity is a local device in
 * section 04 only, not the page's organizing axis. Sections 05, 10, 12 are out
 * of scope (omitted/deferred, logged as debt). This is a presentational layer
 * only; it renders persisted, deterministic data (zero model calls).
 */
import type { BriefingContent } from "@/lib/agents/s1-diagnostic";
import type { PortfolioMetrics } from "@/lib/agents/portfolio-risk-analytics";
import { POSITION_ESCALATE_PCT } from "@/lib/agents/portfolio-risk-analytics";
import type { A3Output } from "@/lib/agents/a3-so-what";
import type { PortfolioOverlapOutput } from "@/lib/agents/portfolio-overlap";
import type { A2Output } from "@/lib/agents/a2-classification";
import type { TimeSeriesPerformanceOutput } from "@/lib/agents/time-series-performance";
import type { RiskRewardOutput } from "@/lib/agents/risk-reward-stats";
import type { S2EvidenceMap } from "./AnalystReportsTabS2";
import { SaaDonut } from "./charts/SaaDonut";
import { HoldingsDonut } from "./charts/HoldingsDonut";
import { OverlapHeatmap } from "./charts/OverlapHeatmap";
import { GlidePath } from "./charts/GlidePath";
import { CompositionDonut } from "./charts/CompositionDonut";
import { RrHero } from "./charts/RrHero";

type Holding = { instrument: string; sub_category: string; value_cr: number; weight_pct: number };

type Props = {
  investorName: string;
  snapshotDate: string;
  frozen: string;
  content: BriefingContent;
  holdings: Holding[];
  metrics: PortfolioMetrics | null;
  soWhat: A3Output | null;
  overlap: PortfolioOverlapOutput | null;
  a2: A2Output | null;
  timeSeries: TimeSeriesPerformanceOutput | null;
  riskReward: RiskRewardOutput | null;
  evidence: S2EvidenceMap | null;
};

/* Minimal read shapes for evidence blocks the composed sections consume. The
 * persisted evidence is read as is; these types name only the fields rendered. */
type E3Dimension = { label?: string; assessment?: string; key_points?: string[] } | string | null;
type E3Block = {
  reasoning_summary?: string;
  overall_e3_assessment?: string;
  rate_environment?: E3Dimension;
  growth_inflation?: E3Dimension;
  policy_regulatory?: E3Dimension;
  currency_external?: E3Dimension;
  key_drivers?: string[];
  key_risks?: string[];
  material_news?: Array<{ headline?: string; note?: string } | string>;
};

function Chev() {
  return (
    <span className="acc-chev" aria-hidden="true">
      <svg viewBox="0 0 14 14" width="14" height="14">
        <path d="M5 3 L10 7 L5 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Section({
  num,
  title,
  em,
  aside,
  open,
  children,
}: {
  num: string;
  title: string;
  em?: string;
  aside?: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="acc-section" open={open}>
      <summary>
        <span className="acc-num">{num}</span>
        <span className="acc-title">
          {title}
          {em && <em>{em}</em>}
        </span>
        <span className="acc-aside">{aside}</span>
        <Chev />
      </summary>
      <div className="acc-body">{children}</div>
    </details>
  );
}

const VERDICT_TIERS: Array<{ key: string; label: string }> = [
  { key: "maintain", label: "Maintain" },
  { key: "monitor", label: "Monitor" },
  { key: "discuss", label: "Discuss" },
  { key: "review", label: "Review" },
];

/* Section 09 cap-tier rule (deterministic, stated verbatim in the section
 * caption). Maps a holding's real sub_category enum to a market-cap sleeve.
 * Flexi-cap funds and the unconstrained-equity PMS strategies go to a Flexi /
 * multi sleeve rather than being split, so the derivation stays auditable.
 * Returns null for any holding that is not cap-tierable equity (debt, cash,
 * gold, international, AIF, unlisted, hybrid); those are shown in the
 * composition and holdings sections, not the cap-tier map. This switch is the
 * single source of truth; the caption restates it. */
type Sleeve = "Large cap" | "Mid cap" | "Small cap" | "Flexi / multi";
function capTier(subCategory: string): Sleeve | null {
  switch (subCategory) {
    case "mf_active_large_cap":
    case "listed_large_cap":
    case "mf_passive_index":
      return "Large cap";
    case "mf_active_mid_cap":
    case "pms_focused_midcap":
      return "Mid cap";
    case "mf_active_small_cap":
      return "Small cap";
    case "mf_active_flexi_cap":
    case "pms_growth_quality":
    case "pms_value":
    case "pms_concentrated_quality":
    case "pms_equity":
      return "Flexi / multi";
    default:
      return null;
  }
}

/* Section 04 concentration minibar: a fixed 0 to 30% display axis so the 15%
 * escalate threshold reads at the half mark and instrument weights compare
 * consistently across cases. The axis is a fixed display scale, not data. */
const CONC_AXIS_MAX = 30;

function pct(n: number | null | undefined, digits = 1): string {
  return typeof n === "number" ? `${(n * 100).toFixed(digits)}%` : "n/a";
}
function num(n: number | null | undefined, digits = 2): string {
  return typeof n === "number" ? n.toFixed(digits) : "n/a";
}
/* Coerce a string-or-structured value to display text. Several persisted
 * fields (a2 drivers, e3 dimensions and key_drivers) are objects, not strings;
 * render their salient text rather than the object. */
function asText(x: unknown): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object") {
    const o = x as Record<string, unknown>;
    const v = o.reason ?? o.assessment ?? o.name ?? o.evidence ?? o.label ?? o.text;
    return typeof v === "string" ? v : "";
  }
  return String(x);
}
function e3Text(d: E3Dimension | undefined): string {
  return asText(d);
}

export function AnalysisTab({
  investorName,
  snapshotDate,
  frozen,
  content,
  holdings,
  metrics,
  soWhat,
  overlap,
  a2,
  timeSeries,
  riskReward,
  evidence,
}: Props) {
  const h = content.header;
  const lede = content.workbench_lede.split(". ").slice(0, 2).join(". ").replace(/\.?$/, ".");
  const e3 = (evidence?.e3 as unknown as E3Block) ?? null;

  /* so-what lookups */
  const soWhatByHolding = new Map<string, string>();
  for (const a of soWhat?.holding_actions ?? []) {
    if ("advisor_action" in a) soWhatByHolding.set(a.holding_ref, a.advisor_action);
  }

  const verdicts = a2?.holding_verdicts ?? [];
  const mmdr = a2?.summary;
  const mmdrTotal = mmdr ? mmdr.maintain_count + mmdr.monitor_count + mmdr.discuss_count + mmdr.review_count : 0;

  const tr = timeSeries?.portfolio?.trailing_returns ?? [];
  const rrStats = riskReward?.portfolio?.stats as Record<string, number> | undefined;

  /* section 09 sleeve grouping: only cap-tierable equity (capTier != null), so
   * debt, cash, gold, international, AIF, and unlisted do not leak into the map. */
  const sleeveOrder: Sleeve[] = ["Large cap", "Mid cap", "Small cap", "Flexi / multi"];
  const bySleeve = new Map<Sleeve, Holding[]>();
  for (const x of holdings) {
    if (x.weight_pct <= 0) continue;
    const t = capTier(x.sub_category);
    if (t === null) continue;
    if (!bySleeve.has(t)) bySleeve.set(t, []);
    bySleeve.get(t)!.push(x);
  }
  const renderedSleeves = sleeveOrder.filter((s) => (bySleeve.get(s)?.length ?? 0) > 0);
  const sleeveCr = (s: Sleeve) => (bySleeve.get(s) ?? []).reduce((sum, x) => sum + x.value_cr, 0);
  const sleeveWtSum = (s: Sleeve) => (bySleeve.get(s) ?? []).reduce((sum, x) => sum + x.weight_pct, 0);

  /* The position-concentration evidence minibars carry the portfolio-wide
   * position flags, so they attach to the first (headline) concentration
   * observation only, not every concentration card, to avoid repeating the
   * same flag set. */
  const firstConcIdx = content.section_1_headline_observations.findIndex((o) => o.vocab === "position_over_concentration");

  return (
    <div className="ar-shell">
      <div className="ar-inner v72">
        {/* Always-visible case header */}
        <header className="case-header">
          <div className="ch-eye">Samriddhi 2 · Portfolio diagnostic</div>
          <h2>{investorName}</h2>
          <div className="ch-meta">
            <span>Data Snapshot {snapshotDate}</span>
            <span className="sep">·</span>
            <span>{h.liquid_aum_label}</span>
            <span className="sep">·</span>
            <span>{h.holdings_label}</span>
            <span className="sep">·</span>
            <span>{h.stated_revealed_label}</span>
          </div>
        </header>

        {/* Headline takeaway, always visible */}
        <section className="headline-takeaway" aria-label="Headline takeaway">
          <div className="htk-eyebrow">Headline takeaway</div>
          <p className="htk-text">{lede}</p>
          <div className="frozen-note">Case Frozen {frozen}. Samriddhi 2 diagnostic.</div>
        </section>

        <div className="accordion">
          {/* 01 Market Outlook */}
          <Section num="01" title="Market Outlook" em="Q2 FY26 frame" aside={h.snapshot_date} open>
            {e3 ? (
              <div className="market-outlook-frame">
                <div className="mo-narrative">
                  <span className="mo-eye">Cross-asset frame</span>
                  <p>{e3.reasoning_summary ?? e3.overall_e3_assessment ?? ""}</p>
                  {(e3.key_risks?.length ?? 0) > 0 && (
                    <p className="mo-risks"><strong>Key risks:</strong> {(e3.key_risks ?? []).join("; ")}</p>
                  )}
                </div>
                <aside className="mo-signature">
                  {(e3.key_drivers ?? []).slice(0, 6).map((d, i) => (
                    <div className="mos-row" key={i}>{asText(d)}</div>
                  ))}
                </aside>
                <div className="macro-grid">
                  {[
                    { t: "Economic cycle", d: e3.growth_inflation },
                    { t: "RBI policy", d: e3.rate_environment },
                    { t: "Government fiscal", d: e3.policy_regulatory },
                    { t: "Global macro", d: e3.currency_external },
                  ].map((c, i) => (
                    <div className="macro-card" key={i}>
                      <div className="mc-title">{c.t}</div>
                      <div className="mc-body">{e3Text(c.d)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="case-paragraph muted">Market outlook evidence not present for this case.</p>
            )}
          </Section>

          {/* 02 Portfolio composition */}
          <Section num="02" title="Portfolio composition" aside={h.liquid_aum_label} open>
            <div className="comp-grid">
              <div className="comp-donut-stack">
                {metrics && <CompositionDonut assetClass={metrics.assetClass} corpusCr={metrics.totalLiquidAumCr} />}
                {holdings.length > 0 && (
                  <HoldingsDonut
                    holdings={holdings}
                    flagged={new Set(metrics?.concentration.positionFlags.map((f) => f.instrument) ?? [])}
                  />
                )}
              </div>
              <div>
                <table className="pdf-table">
                  <thead>
                    <tr>
                      <th>Asset class</th>
                      <th className="r">Actual</th>
                      <th className="r">Model target</th>
                      <th className="r">Band</th>
                      <th className="r">Deviation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.section_2_portfolio_overview.rows.map((row) => (
                      <tr key={row.asset_class}>
                        <td>{row.asset_class}</td>
                        <td className="r">{row.actual_pct.toFixed(1)}%</td>
                        <td className="r">{row.target_pct}%</td>
                        <td className="r muted">{row.band[0]}-{row.band[1]}%</td>
                        <td className={`r${row.in_band ? " muted" : ""}`} style={!row.in_band ? { color: "var(--color-warn)" } : undefined}>
                          {row.deviation_pp > 0 ? "+" : ""}{row.deviation_pp.toFixed(1)} pp
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 text-[11.5px] text-ink-4 font-mono">{content.section_2_portfolio_overview.liquidity_tier_line}</div>
              </div>
            </div>
          </Section>

          {/* 03 Per-holding verdicts */}
          <Section num="03" title="Per-holding verdicts" aside={mmdr?.one_line_characterization?.split(";")[0]} open>
            <div className="verdicts-layout">
              <div className="verdicts-left-col">
                {mmdr && (
                  <div className="mmdr-strip" aria-label="Verdict distribution">
                    {VERDICT_TIERS.map((t) => {
                      const c = (mmdr as unknown as Record<string, number>)[`${t.key}_count`] ?? 0;
                      const w = mmdrTotal > 0 ? (c / mmdrTotal) * 100 : 0;
                      return (
                        <div key={t.key} className={`mmdr-seg mmdr-${t.key}`} style={{ flexBasis: `${w}%` }} title={`${t.label}: ${c}`}>
                          <span className="mmdr-c">{c}</span>
                          <span className="mmdr-l">{t.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {metrics && (
                  <div className="cap-surface">
                    <SaaDonut assetClass={metrics.assetClass} />
                  </div>
                )}
                {metrics?.concentration?.top1 && (
                  <div className="conc-callout">
                    <span className="cc-eye">Single-stock concentration</span>
                    <div className="cc-body">
                      <strong>{metrics.concentration.top1.instrument}</strong> at {metrics.concentration.top1.weightPct.toFixed(1)}% is the largest single position.
                    </div>
                  </div>
                )}
                {rrStats && (
                  <div className="rr-chips">
                    <div className="rr-chip"><span className="rc-l">Sharpe 3Y</span><span className="rc-v">{num(rrStats.sharpe_3y)}</span></div>
                    <div className="rr-chip"><span className="rc-l">Beta 3Y</span><span className="rc-v">{num(rrStats.beta_3y)}</span></div>
                    <div className="rr-chip"><span className="rc-l">Vol 3Y</span><span className="rc-v">{pct(rrStats.vol_3y_annualized)}</span></div>
                    <div className="rr-chip"><span className="rc-l">Max DD 3Y</span><span className="rc-v">{pct(rrStats.max_drawdown_3y)}</span></div>
                  </div>
                )}
              </div>
              <div className="verdicts-right-col">
                {VERDICT_TIERS.map((tier) => {
                  const rows = verdicts.filter((v) => (v.verdict as string) === tier.key);
                  if (rows.length === 0) return null;
                  return (
                    <div className="tier-group" key={tier.key}>
                      <div className="tier-head">{tier.label} <span className="tier-count">{rows.length}</span></div>
                      {rows.map((v, i) => {
                        const sw = soWhatByHolding.get(v.holding_ref);
                        const showSoWhat = (tier.key === "monitor" || tier.key === "discuss") && sw;
                        return (
                          <div className="holding-row-wrap" key={i}>
                            <div className="holding-row">
                              <span className="hr-name">{v.instrument_display_name}</span>
                              <span className="hr-wt">{v.weight_pct.toFixed(1)}%</span>
                            </div>
                            {v.drivers?.[0] && <div className="hr-driver">{asText(v.drivers[0])}</div>}
                            {showSoWhat && (
                              <div className="sowhat">
                                <span className="sowhat-eyebrow">So what, advisor action</span>
                                <p className="sowhat-body">{sw}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* 04 Portfolio observations (the one place severity pills live) */}
          <Section num="04" title="Portfolio observations" aside={`${content.section_1_headline_observations.length} observations`} open>
            <div className="observations">
              {content.section_1_headline_observations.map((o, i) => {
                const oa = soWhat?.observation_actions?.[i];
                const sw = oa && "advisor_action" in oa ? oa.advisor_action : null;
                const concFlags = i === firstConcIdx && metrics ? metrics.concentration.positionFlags : [];
                return (
                  <article className={`obs-card with-sowhat sev-${o.severity}`} key={i}>
                    <div className="obs-main">
                      <div className="obs-head">
                        <span className="sev-pill" data-sev={o.severity}>{o.severity}</span>
                        <span className="obs-cat">{o.vocab.replace(/_/g, " ")}</span>
                        <span className="obs-meta">source: {o.source}</span>
                      </div>
                      <div className="obs-sentence">{("short_form" in o ? (o as { short_form?: string }).short_form : undefined) ?? o.one_line}</div>
                      {concFlags.length > 0 && (
                        <div className="obs-evidence">
                          <span className="obs-ev-eyebrow">Evidence, single-instrument weight</span>
                          {concFlags.map((f) => (
                            <div className="minibar" key={f.instrument}>
                              <div className="mb-lbl">{f.instrument}</div>
                              <div className="mb-track">
                                <div
                                  className={`mb-fill ${f.severity === "escalate" ? "fill-esc" : "fill-flg"}`}
                                  style={{ width: `${Math.min(100, (f.weightPct / CONC_AXIS_MAX) * 100)}%` }}
                                />
                                <div className="mb-thresh" style={{ left: `${(POSITION_ESCALATE_PCT / CONC_AXIS_MAX) * 100}%` }} title={`${POSITION_ESCALATE_PCT}% escalate threshold`} />
                              </div>
                              <div className="mb-val">{f.weightPct.toFixed(1)}%</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {sw && (
                      <div className="sowhat">
                        <span className="sowhat-eyebrow">So what, advisor action</span>
                        <p className="sowhat-body">{sw}</p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </Section>

          {/* 06 Portfolio performance (window-return bars; continuous line deferred, see debt) */}
          <Section num="06" title="Portfolio performance" aside={timeSeries?.portfolio?.method ?? undefined}>
            {tr.length > 0 ? (
              <div className="perf-layout">
                <div>
                  <div className="perf-bars">
                    {tr.map((w) => {
                      const v = typeof w.absolute_return === "number" ? w.absolute_return : 0;
                      const height = Math.min(60, Math.abs(v) * 600);
                      return (
                        <div className="pb-col" key={w.window}>
                          <div className="pb-track">
                            <div className={`pb-bar ${v >= 0 ? "pos" : "neg"}`} style={{ height: `${height}px` }} />
                          </div>
                          <div className="pb-val">{typeof w.absolute_return === "number" ? `${(w.absolute_return * 100).toFixed(1)}%` : "n/a"}</div>
                          <div className="pb-win">{w.window}</div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="editorial-caption">Trailing window returns. The continuous gross-versus-net-invested-cost curve is deferred pending a cost-basis series (logged as debt).</p>
                </div>
                <aside className="perf-sidebar">
                  <div className="perf-block">{timeSeries?.rollup?.text}</div>
                </aside>
              </div>
            ) : (
              <p className="case-paragraph muted">No performance series available for this case.</p>
            )}
          </Section>

          {/* 07 Risk-reward statistics */}
          <Section num="07" title="Risk-reward statistics" aside={riskReward?.portfolio?.benchmark_index_id ?? undefined}>
            {rrStats ? (
              <>
                <div className="bench-chip">Benchmark: {riskReward?.portfolio?.benchmark_index_id ?? "blended"}{riskReward?.portfolio?.benchmark_blend ? " (client-weighted)" : ""}</div>
                <RrHero stats={rrStats} />
                {riskReward?.portfolio?.coverage_footnote && (
                  <p className="editorial-caption">{typeof riskReward.portfolio.coverage_footnote === "string" ? riskReward.portfolio.coverage_footnote : ""}</p>
                )}
              </>
            ) : (
              <p className="case-paragraph muted">No risk-reward statistics available for this case.</p>
            )}
          </Section>

          {/* 08 Holdings overlap heatmap */}
          <Section num="08" title="Holdings overlap" em="Layer 1 stock-level" aside={overlap ? `${overlap.per_pair.length} pairs` : undefined}>
            {overlap && overlap.per_pair.length > 0 ? (
              <OverlapHeatmap overlap={overlap} />
            ) : (
              <p className="case-paragraph muted">No within-sleeve holding pairs to compare for this portfolio.</p>
            )}
          </Section>

          {/* 09 Overlap and consolidation */}
          <Section num="09" title="Overlap and consolidation" aside={overlap?.portfolio?.strongest_pair ? `top ${Math.round(overlap.portfolio.strongest_pair.score * 100)}%` : undefined}>
            {renderedSleeves.length > 0 ? (
            <>
            <div className="sleeve-map" style={{ gridTemplateColumns: `repeat(${renderedSleeves.length}, minmax(0, 1fr))` }}>
              {renderedSleeves.map((s) => {
                const funds = bySleeve.get(s) ?? [];
                const wtSum = sleeveWtSum(s) || 1;
                return (
                  <div className="sleeve" key={s}>
                    <div className="sleeve-head">
                      <span className="sleeve-name">{s}</span>
                      <span className="sleeve-total">₹{sleeveCr(s).toFixed(2)} Cr</span>
                    </div>
                    <div className="sleeve-body">
                      {funds.map((x) => {
                        const within = (x.weight_pct / wtSum) * 100;
                        return (
                          <div className="fund-rect" key={x.instrument} style={{ flex: within }} title={`${x.instrument}: ₹${x.value_cr.toFixed(2)} Cr, ${within.toFixed(1)}% of sleeve`}>
                            <div className="fr-name">{x.instrument}</div>
                            <div className="fr-meta">₹{x.value_cr.toFixed(2)} Cr / {within.toFixed(1)}% of sleeve</div>
                          </div>
                        );
                      })}
                      {funds.length === 1 && <div className="sleeve-empty">Single resident; no consolidation question here.</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="sleeve-map-cap">
              {renderedSleeves.map((s) => `${(bySleeve.get(s) ?? []).length} in ${s.toLowerCase()}`).join(", ")}. Cap-tier columns derive deterministically from each holding's sub-category: large cap from active large-cap, index, and direct large-cap equity; mid cap from active mid-cap and focused-midcap PMS; small cap from active small-cap; flexi / multi from flexi-cap funds and the unconstrained quality and value PMS strategies. Bar height is the fund's share of its sleeve. Non-cap-tierable holdings (international, AIF, unlisted, hybrid, and all non-equity) are shown in the composition and holdings sections, not here.
            </p>
            </>
            ) : (
              <p className="case-paragraph muted">No cap-tierable equity sleeves for this portfolio; the holdings are shown in the composition and holdings sections.</p>
            )}
          </Section>

          {/* 11 Rebalance framework */}
          <Section num="11" title="Rebalance framework" aside={soWhat?.rebalance_proposal?.kind === "proposal" ? `${soWhat.rebalance_proposal.computed.positions.length} positions` : undefined}>
            {soWhat?.rebalance_proposal?.kind === "proposal" && soWhat.rebalance_proposal.computed.positions.length > 0 ? (
              <div className="rebalance-block">
                {soWhat.rebalance_proposal.computed.positions.map((p, i) => (
                  <GlidePath key={i} position={p} corpusCr={metrics?.totalLiquidAumCr ?? 0} />
                ))}
                {soWhat.rebalance_proposal.narrated?.advisor_action && (
                  <p className="case-paragraph rebalance-narrative">{soWhat.rebalance_proposal.narrated.advisor_action}</p>
                )}
              </div>
            ) : (
              <p className="case-paragraph muted">No rebalance proposed for this portfolio; deployment-only or all-clear.</p>
            )}
          </Section>
        </div>

        {/* Always-visible disclaimer and methodology */}
        <section className="disclaimer" aria-label="Disclaimer">
          <span className="dis-eye">Disclaimer and methodology</span>
          <p>{content.coverage_note}</p>
          <p>The so-what advisor-action prose in sections 03 and 04 is LLM-generated and persisted; every numeric output is deterministic and recomputable from the frozen snapshot. Samriddhi provides decision-support analysis only.</p>
          <p>Samriddhi 1 and Samriddhi 2 are the canonical naming forms; the short forms are reserved for pipeline contexts and are not used in advisor-facing artifacts.</p>
        </section>
      </div>
    </div>
  );
}
