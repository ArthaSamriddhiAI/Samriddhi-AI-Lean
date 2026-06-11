/* Data universe surface (Package 10, RE2 as ratified: market-snapshot-only).
 *
 * Section 01: snapshot inspector. t0 is the default truth surface; whenever a
 * forward snapshot is selected the structural disclosure renders in the
 * shipped ADR-0019/0020 synthetic-forward vocabulary, with honest staleness
 * if a snapshot has not reached v2 coherence. Section 02: universe browser
 * over the selected snapshot's instrument families, with hand-authored SVG
 * series charts (ADR-0045). The page reads ONLY the snapshot loader plus the
 * Snapshot metadata rows; no per-investor store, no case analytics (the
 * ratified cuts). Zero writes, zero model calls (WA12).
 */

import Link from "next/link";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { loadSnapshot } from "@/lib/agents/snapshot-loader";
import {
  FAMILIES,
  FAMILY_LABELS,
  TABLE_LIMIT,
  type Family,
  snapshotProvenance,
  mfRows,
  mfSeries,
  listedRows,
  stockSeries,
  pmsRows,
  aifRows,
  unlistedRows,
  indexRows,
  indexSeries,
  fxRows,
  fxSeries,
  yieldRows,
  yieldSeries,
  macroDimensions,
} from "@/lib/explorer/universe";
import { ExplorerTabs } from "@/components/explorer/ExplorerTabs";
import { SeriesChart } from "@/components/explorer/SeriesChart";
import s from "@/components/explorer/explorer.module.css";

export const dynamic = "force-dynamic";

type Search = { snapshot?: string; family?: string; q?: string; series?: string };

function href(params: { snapshot: string; family: Family; q?: string; series?: string }): string {
  const u = new URLSearchParams();
  u.set("snapshot", params.snapshot);
  u.set("family", params.family);
  if (params.q) u.set("q", params.q);
  if (params.series) u.set("series", params.series);
  return `/explorer/universe?${u.toString()}`;
}

export default async function DataUniversePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const snapshotRows = await prisma.snapshot.findMany({ orderBy: { date: "asc" } });
  const validIds = new Set(snapshotRows.map((r) => r.id));
  const selectedId = sp.snapshot && validIds.has(sp.snapshot) ? sp.snapshot : "t0_q2_2026";
  const family: Family = (FAMILIES as readonly string[]).includes(sp.family ?? "") ? (sp.family as Family) : "mf_funds";
  const q = (sp.q ?? "").slice(0, 80);
  const series = sp.series ?? "";

  const snap = await loadSnapshot(selectedId);
  const prov = snapshotProvenance(snap);
  const isForward = selectedId !== "t0_q2_2026";

  /* The live consumer pin (data-version.txt, the ADR-0027 release flow). */
  let pin = "unpinned";
  try {
    pin = readFileSync(path.resolve(process.cwd(), "data-version.txt"), "utf-8").trim() || "unpinned";
  } catch {
    /* missing pin file renders as unpinned */
  }

  /* series payload resolution */
  let chart: { title: string; subtitle?: string; series: Record<string, number> } | null = null;
  if (series) {
    const [kind, ...rest] = series.split(":");
    const key = rest.join(":");
    const sv =
      kind === "idx"
        ? indexSeries(snap, key)
        : kind === "fund"
          ? mfSeries(snap, key)
          : kind === "stock"
            ? stockSeries(snap, key)
            : kind === "fx"
              ? fxSeries(snap, key)
              : kind === "yield"
                ? yieldSeries(snap, key)
                : null;
    if (sv) {
      chart = {
        title: key,
        subtitle:
          kind === "fund"
            ? "monthly NAV"
            : kind === "stock"
              ? "monthly price"
              : kind === "yield"
                ? "annualised yield, percent"
                : "monthly level",
        series: sv,
      };
    }
  }

  return (
    <div className={s.page}>
      <div className="eyebrow">Workspace · Explorer · read-only</div>
      <h1>Data universe</h1>
      <p className="mt-2 max-w-prose text-ink-3" style={{ fontSize: 14 }}>
        A read-only explorer over the market-data snapshots the agents reason with: which universe is loaded, on what
        basis, and what each instrument family carries. This surface reads the snapshot loader only.
      </p>
      <ExplorerTabs active="universe" />

      {/* 01 snapshot inspector */}
      <section className={s.section}>
        <div className={s.secHead}>
          <div className={s.secNum}>01</div>
          <div className={s.secTitle}>
            Snapshot inspector<em>which universe, on what basis</em>
          </div>
          <div className={s.secAside}>pin {pin} · loader LRU 3 · fixtures/snapshots/enriched</div>
        </div>
        <div className={s.snapRow}>
          {snapshotRows.map((row) => (
            <Link
              key={row.id}
              href={href({ snapshot: row.id, family, q })}
              className={row.id === selectedId ? s.snapCardSel : s.snapCard}
            >
              <div className={s.snapId}>{row.id}</div>
              <div className={s.snapMeta}>
                {row.date.toISOString().slice(0, 10)} · {row.testAxis.slice(0, 44)}
              </div>
              <span className={row.id === "t0_q2_2026" ? s.chipReal : s.chipAmber}>
                {row.id === "t0_q2_2026" ? "real t0 · realv1" : "synthetic-forward"}
              </span>
            </Link>
          ))}
        </div>

        {isForward ? (
          <div className={s.banner}>
            <b>Synthetic-forward disclosure</b>
            This snapshot is part of the synthetic forward-projection regime-test set: it exercises diagnostic
            behaviour across authored regimes ({prov.evolutionType ?? "forward"}); it is not history and not real
            market data (ADR-0019/0020 vocabulary; DM3).{" "}
            {prov.kind === "forward_v2" ? (
              <>
                Basis: re-derived from the real t0 baseline ({String(prov.forwardDerivation?.version ?? "v2-forward")},
                seed {String(prov.forwardDerivation?.seed_snapshot ?? "realv1 t0")}); this is the set the pinned release
                ({pin}) carries, coherent with its baseline. Benchmark-relative statistics on forward snapshots are
                regime-test texture, not relative-performance signal.
              </>
            ) : (
              <>
                Staleness: this snapshot predates the re-derived forward set the pin ({pin}) carries; it is the v1
                forward set anchored to the superseded synthetic t0. Refresh the local data (scripts/setup-data.ts) to
                fetch the coherent set.
              </>
            )}
          </div>
        ) : prov.kind === "real_t0" ? (
          <div className={s.srcNote} style={{ marginTop: 10 }}>
            Real-data baseline: {String(prov.realDataBuild?.method ?? "Option B real-data t0")} · NAVs{" "}
            {String(prov.realDataBuild?.nav_source ?? "real")} · indices{" "}
            {String(prov.realDataBuild?.index_source ?? "Bloomberg real and FIMMDA-derived")}.
          </div>
        ) : null}

        <div className={s.srcNote}>
          evolution: {prov.evolutionType ?? "baseline"}
          {prov.generationNotes ? ` · ${prov.generationNotes}` : ""} · enrichment {prov.enrichmentVersion ?? "n/a"}
          {prov.yieldsNote ? ` · debt yields: ${prov.yieldsNote}` : ""}
        </div>
      </section>

      {/* 02 universe browser */}
      <section className={s.section}>
        <div className={s.secHead}>
          <div className={s.secNum}>02</div>
          <div className={s.secTitle}>
            Universe browser<em>the instrument families on {selectedId}</em>
          </div>
          <div className={s.secAside}>charts per ADR-0045 · values as stored, no recompute</div>
        </div>
        <div className={s.famRow}>
          {FAMILIES.map((f) => (
            <Link key={f} href={href({ snapshot: selectedId, family: f })} className={f === family ? s.famSel : s.fam}>
              {FAMILY_LABELS[f]}
            </Link>
          ))}
        </div>

        {family !== "macro" && family !== "fx" && family !== "yields" ? (
          <form className={s.filterForm} action="/explorer/universe" method="get">
            <input type="hidden" name="snapshot" value={selectedId} />
            <input type="hidden" name="family" value={family} />
            <input className={s.filterInput} type="text" name="q" defaultValue={q} placeholder="Filter by name or category" />
            <button className={s.btn} type="submit">
              Filter
            </button>
            {q ? (
              <Link className={s.srcNote} href={href({ snapshot: selectedId, family })}>
                clear
              </Link>
            ) : null}
          </form>
        ) : null}

        {chart ? (
          <div className={s.card} style={{ marginBottom: 14 }}>
            <SeriesChart series={chart.series} title={chart.title} subtitle={chart.subtitle} />
          </div>
        ) : null}

        <FamilyTable snapId={selectedId} family={family} q={q} snap={snap} />
      </section>

      <div className={s.footer}>
        Sources: Snapshot metadata rows (Prisma) and the enriched snapshot JSONs via lib/agents/snapshot-loader.ts.
        This surface reads no per-investor store and no case analytics (the ratified Package 10 cuts). Read-only; zero
        model calls; zero writes.
      </div>
    </div>
  );
}

function CountNote({ shown, total, label }: { shown: number; total: number; label: string }) {
  return (
    <div className={s.srcNote}>
      {total > shown ? `showing the first ${shown} of ${total} ${label}; refine with the filter` : `${total} ${label}`}
    </div>
  );
}

async function FamilyTable({ snapId, family, q, snap }: { snapId: string; family: Family; q: string; snap: Awaited<ReturnType<typeof loadSnapshot>> }) {
  if (family === "mf_funds") {
    const { rows, total } = mfRows(snap, q);
    return (
      <>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Fund</th>
              <th>SEBI category</th>
              <th className={s.r}>AUM Cr</th>
              <th className={s.r}>TER %</th>
              <th className={s.r}>3Y %</th>
              <th className={s.r}>Sharpe 3y</th>
              <th className={s.r}>Beta 3y</th>
              <th>Cap split</th>
              <th>Series</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>
                  {r.name}
                  {r.resolution && r.resolution !== "resolved" ? (
                    <span className={s.srcNote} style={{ display: "block" }}>
                      {r.resolution.replace(/_/g, " ")}
                    </span>
                  ) : null}
                </td>
                <td className={s.small}>{r.category}</td>
                <td className={s.r}>{r.aumCr != null ? Math.round(r.aumCr).toLocaleString("en-IN") : "n/a"}</td>
                <td className={s.r}>{r.terPct ?? "n/a"}</td>
                <td className={s.r}>{r.ret3yPct ?? "n/a"}</td>
                <td className={s.r}>{r.sharpe3y ?? "n/a"}</td>
                <td className={s.r}>{r.beta3y ?? "n/a"}</td>
                <td>
                  {r.capLarge != null || r.capMid != null || r.capSmall != null ? (
                    <span className={s.capBar} title={`large ${r.capLarge ?? 0} · mid ${r.capMid ?? 0} · small ${r.capSmall ?? 0}`}>
                      <span className={s.capSegL} style={{ width: `${r.capLarge ?? 0}%` }} />
                      <span className={s.capSegM} style={{ width: `${r.capMid ?? 0}%` }} />
                      <span className={s.capSegS} style={{ width: `${r.capSmall ?? 0}%` }} />
                    </span>
                  ) : (
                    <span className={s.muted}>n/a</span>
                  )}
                </td>
                <td className={s.small}>
                  <Link href={href({ snapshot: snapId, family, q, series: `fund:${r.name}` })}>chart</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <CountNote shown={rows.length} total={total} label="funds" />
      </>
    );
  }
  if (family === "listed") {
    const { rows, total } = listedRows(snap, q);
    return (
      <>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Company</th>
              <th>Sector</th>
              <th className={s.r}>CMP Rs</th>
              <th className={s.r}>Mcap Cr</th>
              <th className={s.r}>P/E</th>
              <th className={s.r}>ROE %</th>
              <th className={s.r}>D/E</th>
              <th className={s.r}>6M %</th>
              <th className={s.r}>Beta 3y</th>
              <th>Series</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td className={s.small}>{r.sector ?? ""}</td>
                <td className={s.r}>{r.cmpRs != null ? r.cmpRs.toLocaleString("en-IN") : "n/a"}</td>
                <td className={s.r}>{r.mcapCr != null ? Math.round(r.mcapCr).toLocaleString("en-IN") : "n/a"}</td>
                <td className={s.r}>{r.pe ?? "n/a"}</td>
                <td className={s.r}>{r.roePct ?? "n/a"}</td>
                <td className={s.r}>{r.debtEquity ?? "n/a"}</td>
                <td className={s.r}>{r.ret6mPct ?? "n/a"}</td>
                <td className={s.r}>{r.beta3y ?? "n/a"}</td>
                <td className={s.small}>
                  <Link href={href({ snapshot: snapId, family, q, series: `stock:${r.name}` })}>chart</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <CountNote shown={rows.length} total={total} label="companies" />
      </>
    );
  }
  if (family === "pms") {
    const { rows, total } = pmsRows(snap, q);
    return (
      <>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Category</th>
              <th>Type</th>
              <th className={s.r}>AUM Cr</th>
              <th className={s.r}>Age y</th>
              <th>Benchmark</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.name}-${i}`}>
                <td>{r.name}</td>
                <td className={s.small}>{r.category ?? ""}</td>
                <td className={s.small}>{r.strategyType ?? ""}</td>
                <td className={s.r}>{r.aumCr != null ? Math.round(r.aumCr).toLocaleString("en-IN") : "n/a"}</td>
                <td className={s.r}>{r.ageYears ?? "n/a"}</td>
                <td className={s.small}>{r.benchmark ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <CountNote shown={rows.length} total={total} label="PMS strategies (opaque-by-design in diagnostics)" />
      </>
    );
  }
  if (family === "aif") {
    const { rows, total } = aifRows(snap, q);
    return (
      <>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Fund</th>
              <th>SEBI cat</th>
              <th>Manager</th>
              <th>Structure</th>
              <th className={s.r}>Min commit Cr</th>
              <th className={s.r}>Mgmt %</th>
              <th className={s.r}>Perf %</th>
              <th className={s.r}>Hurdle %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.name}-${i}`}>
                <td>{r.name}</td>
                <td className={s.small}>{r.sebiCategory ?? ""}</td>
                <td className={s.small}>{r.amc ?? ""}</td>
                <td className={s.small}>{r.structure ?? ""}</td>
                <td className={s.r}>{r.minCommitmentCr ?? "n/a"}</td>
                <td className={s.r}>{r.mgmtFeePct ?? "n/a"}</td>
                <td className={s.r}>{r.perfFeePct ?? "n/a"}</td>
                <td className={s.r}>{r.hurdlePct ?? "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <CountNote shown={rows.length} total={total} label="AIF profiles (opaque-by-design in diagnostics)" />
      </>
    );
  }
  if (family === "unlisted") {
    const { rows, total } = unlistedRows(snap, q);
    return (
      <>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Company</th>
              <th>City</th>
              <th>Status</th>
              <th className={s.r}>Age y</th>
              <th>Business model</th>
              <th>Industry</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.name}-${i}`}>
                <td>{r.name}</td>
                <td className={s.small}>{r.city ?? ""}</td>
                <td className={s.small}>{r.status ?? ""}</td>
                <td className={s.r}>{r.ageYears ?? "n/a"}</td>
                <td className={s.small}>{r.businessModelTag ?? ""}</td>
                <td className={s.small}>{r.sector ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <CountNote shown={rows.length} total={total} label="unlisted companies (not consumed by the diagnostic)" />
      </>
    );
  }
  if (family === "indices") {
    const { rows, total } = indexRows(snap, q);
    return (
      <>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Index</th>
              <th>Category</th>
              <th className={s.r}>Points</th>
              <th className={s.r}>End</th>
              <th className={s.r}>Last</th>
              <th>Provenance</th>
              <th>Series</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className={s.mono}>{r.id}</span>
                </td>
                <td className={s.small}>{r.category ?? ""}</td>
                <td className={s.r}>{r.points}</td>
                <td className={s.r}>{r.endMonth ?? "n/a"}</td>
                <td className={s.r}>{r.endValue ?? "n/a"}</td>
                <td className={s.small}>{r.provenance}</td>
                <td className={s.small}>
                  <Link href={href({ snapshot: snapId, family, q, series: `idx:${r.id}` })}>chart</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <CountNote shown={rows.length} total={total} label="index series (mixed basis; provenance per series)" />
      </>
    );
  }
  if (family === "fx") {
    const rows = fxRows(snap);
    return (
      <table className={s.table}>
        <thead>
          <tr>
            <th>Pair</th>
            <th className={s.r}>Points</th>
            <th className={s.r}>End</th>
            <th className={s.r}>Last</th>
            <th>Provenance</th>
            <th>Series</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={s.mono}>{r.name}</td>
              <td className={s.r}>{r.points}</td>
              <td className={s.r}>{r.endMonth ?? "n/a"}</td>
              <td className={s.r}>{r.endValue ?? "n/a"}</td>
              <td className={s.small}>{r.provenance}</td>
              <td className={s.small}>
                {r.points > 0 ? <Link href={href({ snapshot: snapId, family, series: `fx:${r.id}` })}>chart</Link> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (family === "yields") {
    const rows = yieldRows(snap);
    if (rows.length === 0) {
      return (
        <div className={s.cellNote}>
          No debt-yield primitives on this snapshot: the yield curves are a t0 carried primitive and are not evolved by
          any committed machinery (forward-derivation ruling). Select t0 to inspect the 26 yield series.
        </div>
      );
    }
    return (
      <>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Series</th>
              <th>Basis</th>
              <th className={s.r}>Points</th>
              <th className={s.r}>End</th>
              <th className={s.r}>Last %</th>
              <th>Source</th>
              <th>Series</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={s.mono}>{r.id}</td>
                <td className={s.small}>{r.category}</td>
                <td className={s.r}>{r.points}</td>
                <td className={s.r}>{r.endMonth ?? "n/a"}</td>
                <td className={s.r}>{r.endValue ?? "n/a"}</td>
                <td className={s.small}>{r.provenance}</td>
                <td className={s.small}>
                  <Link href={href({ snapshot: snapId, family, series: `yield:${r.id}` })}>chart</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <CountNote shown={rows.length} total={rows.length} label="yield primitives (carried; the derived TR cells live under Indices)" />
      </>
    );
  }
  /* macro */
  const dims = macroDimensions(snap);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {dims.map((d) => (
        <div key={d.dimension}>
          <div style={{ fontFamily: "var(--font-source-serif-4), serif", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
            {d.dimension}
          </div>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Indicator</th>
                <th>Value</th>
                <th>Direction</th>
                <th>As of</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {d.indicators.map((i, k) => (
                <tr key={`${i.indicator}-${k}`}>
                  <td>{i.indicator}</td>
                  <td className={s.small}>{i.value}</td>
                  <td className={s.small}>{i.direction ?? ""}</td>
                  <td className={s.small}>{i.asOf ?? ""}</td>
                  <td className={s.small}>{i.source ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <div className={s.srcNote}>{`limit note: family tables cap at ${TABLE_LIMIT} rows with the filter as the refinement path`}</div>
    </div>
  );
}
