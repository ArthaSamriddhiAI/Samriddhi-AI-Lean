"use client";

/* The add-investor flow (Package 07, B4), built to the ratified wireframe
 * docs/wireframes/onboarding_workbench_v1.html: intake, the reconciliation
 * workbench (provenance first-class, exact versus heuristic confidence, the
 * four gate tiles, the WA26 resolution queue), and commit-and-lock with the
 * three explicit storage tiers. The server recomputes the gate before any
 * write; these components are presentation over the pure core.
 *
 * Gate 2 boundary, deliberately unbuilt: valueless prose rows render PARKED
 * with no value-entry affordance anywhere, pending the primary's provenance
 * ruling. The Samriddhi 2 case screen is untouched by this surface.
 */

import { useEffect, useState, useTransition } from "react";
import type { ParsedDocument } from "@/lib/ingestion/types";
import type { SubCategory } from "@/db/fixtures/structured-holdings";
import type {
  AdvisorInputs,
  Attestation,
  WorkbenchState,
  WorkbenchRow,
} from "@/lib/onboarding/build-record";
import {
  commitInvestor,
  computeWorkbench,
  parseSpecimen,
  parseUploads,
  type CommitResult,
  type ParsedBundle,
} from "@/app/investors/onboard/actions";

const SUB_CATEGORIES: SubCategory[] = [
  "mf_active_large_cap", "mf_passive_index", "mf_active_flexi_cap",
  "mf_active_mid_cap", "mf_active_small_cap", "mf_hybrid_dynamic_aa",
  "pms_growth_quality", "pms_concentrated_quality", "pms_value",
  "pms_focused_midcap", "listed_large_cap", "intl_us_etf",
  "intl_us_individual", "unlisted_family_business", "unlisted_pre_ipo",
  "bank_fd", "tax_free_bond", "mf_corporate_debt", "mf_short_term_debt",
  "mf_arbitrage", "aif_cat_ii_pe", "aif_cat_ii_real_estate",
  "aif_cat_ii_private_credit", "aif_cat_iii_long_short", "physical_gold",
  "sovereign_gold_bond", "reit", "savings",
];

function crore(v: number | null): string {
  if (v === null) return "needs value";
  return (v / 1e7).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/^(dr|mrs|mr|smt)\.?\s+/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function OnboardingFlow({ initialBundle, initialSpecimen, advisorName }: {
  initialBundle: ParsedBundle | null;
  initialSpecimen: string | null;
  advisorName: string;
}) {
  const [bundle, setBundle] = useState<ParsedBundle | null>(initialBundle);
  const [investorName, setInvestorName] = useState(initialSpecimen === "krishnan" ? "Sandeep Krishnan" : "");
  const [notes, setNotes] = useState("");
  const [tier, setTier] = useState<AdvisorInputs["tier"]>("synthetic_public");
  const [resolutions, setResolutions] = useState<AdvisorInputs["resolutions"]>({});
  const [confirmations, setConfirmations] = useState<string[]>([]);
  const [subCategories, setSubCategories] = useState<Record<string, SubCategory>>({});
  const [attestations, setAttestations] = useState<Record<string, Attestation>>({});
  /* Per-row draft inputs for the attested path (value text plus the
   * required basis note); committed into attestations on Attest. */
  const [attestDrafts, setAttestDrafts] = useState<Record<string, { value: string; note: string }>>({});
  const [state, setState] = useState<WorkbenchState | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /* A server-parsed specimen arrives as the initial bundle; compute its
   * workbench state once on mount so step 2 is live without a click. */
  useEffect(() => {
    if (initialBundle && !state) recompute(initialBundle.docs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputs = (): AdvisorInputs => ({
    investorId: slugify(investorName || "new-investor"),
    investorName: investorName || "New investor",
    notes,
    tier,
    resolutions,
    confirmations,
    subCategories,
    attestations,
  });

  const recompute = (docs: ParsedDocument[], next?: Partial<AdvisorInputs>) => {
    startTransition(async () => {
      try {
        setState(await computeWorkbench(docs, { ...inputs(), ...next }));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const onUpload = (formData: FormData) => {
    startTransition(async () => {
      try {
        const b = await parseUploads(formData);
        setBundle(b);
        setState(await computeWorkbench(b.docs, inputs()));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const onSpecimen = (name: string) => {
    startTransition(async () => {
      try {
        const b = await parseSpecimen(name);
        setBundle(b);
        if (name === "krishnan") setInvestorName("Sandeep Krishnan");
        if (name === "iyengar_email") setInvestorName("Lalitha Iyengar (specimen)");
        setState(await computeWorkbench(b.docs, inputs()));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const pickResolution = (row: WorkbenchRow, fundName: string) => {
    const next = { ...resolutions, [row.rawLabel]: { fundName } };
    setResolutions(next);
    if (bundle) recompute(bundle.docs, { resolutions: next });
  };
  const acceptMismatch = (row: WorkbenchRow) => {
    const next = { ...resolutions, [row.rawLabel]: { acceptMismatch: "accepted by advisor at onboarding; logged for the debt pass" } };
    setResolutions(next);
    if (bundle) recompute(bundle.docs, { resolutions: next });
  };
  const confirmRow = (row: WorkbenchRow) => {
    const next = confirmations.includes(row.key) ? confirmations : [...confirmations, row.key];
    setConfirmations(next);
    if (bundle) recompute(bundle.docs, { confirmations: next });
  };
  const setSub = (row: WorkbenchRow, sub: SubCategory) => {
    const next = { ...subCategories, [row.key]: sub };
    setSubCategories(next);
    if (bundle) recompute(bundle.docs, { subCategories: next });
  };
  const attestRow = (row: WorkbenchRow) => {
    const draft = attestDrafts[row.key];
    const valueInr = draft ? Math.round(Number(draft.value.replace(/,/g, "")) * 1e5) : NaN;
    if (!draft || !Number.isFinite(valueInr) || valueInr <= 0 || !draft.note.trim()) return;
    const next: Record<string, Attestation> = {
      ...attestations,
      [row.key]: {
        valueInr,
        basisNote: draft.note.trim(),
        attestedBy: advisorName,
        attestedAt: new Date().toISOString(),
      },
    };
    setAttestations(next);
    if (bundle) recompute(bundle.docs, { attestations: next });
  };
  const onCommit = () => {
    if (!bundle) return;
    startTransition(async () => {
      setCommitResult(await commitInvestor(bundle.docs, inputs()));
    });
  };

  const step = commitResult?.ok ? 3 : state ? 2 : 1;
  const unresolvedRows = state?.rows.filter((r) => r.resolution.state === "unresolved") ?? [];

  return (
    <div className="ob-page">
      <div className="ob-eyebrow">Samriddhi, Investors, add investor (Package 07 B4; built to the ratified wireframe)</div>
      <h1 className="ob-h1">Add investor: parse, reconcile, commit</h1>

      <div className="ob-steps">
        <span className={"ob-step" + (step > 1 ? " done" : " active")}><b>1</b> Intake</span>
        <span className="ob-arrow">&#8594;</span>
        <span className={"ob-step" + (step === 2 ? " active" : step > 2 ? " done" : "")}><b>2</b> Reconciliation workbench</span>
        <span className="ob-arrow">&#8594;</span>
        <span className={"ob-step" + (step === 3 ? " done" : "")}><b>3</b> Commit and lock</span>
      </div>

      {error ? <div className="ob-error">{error}</div> : null}

      {/* Step 1: intake */}
      <section className="ob-section">
        <div className="ob-sechead"><span className="ob-num">01</span><span className="ob-title">Intake</span>
          <span className="ob-aside">any format; nothing auto-commits</span></div>
        <form action={onUpload} className="ob-intake">
          <div className="ob-dropzone">
            <div className="ob-drop-big">Drop investor documents here</div>
            <div className="ob-formats">eCAS PDF &middot; XLSX &middot; CSV / TSV &middot; plain text &middot; forwarded email</div>
            <input className="ob-file" type="file" name="documents" multiple
              accept=".pdf,.xlsx,.csv,.tsv,.txt,.md,.eml" />
            <div className="ob-specimens">
              <span className="ob-spec-label">or load a demo specimen:</span>
              <button type="button" className="ob-chip" onClick={() => onSpecimen("krishnan")}>Sandeep Krishnan (statement + sheet + notes)</button>
              <button type="button" className="ob-chip" onClick={() => onSpecimen("iyengar_email")}>Iyengar email (prose only)</button>
            </div>
            {bundle ? (
              <div className="ob-filechips">
                {bundle.fileSummaries.map((f) => (
                  <span key={f.name} className="ob-chip ok">{f.name} &nbsp;{f.summary}</span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="ob-intake-fields">
            <label className="ob-label">Investor name
              <input className="ob-input" value={investorName} onChange={(e) => setInvestorName(e.target.value)} placeholder="as it should appear in the workspace" />
            </label>
            <label className="ob-label">Pre-meeting context (optional; lands in the transcript field)
              <textarea className="ob-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <button className="ob-btn ghost" type="submit" disabled={pending}>Parse documents</button>
          </div>
        </form>
      </section>

      {/* Step 2: workbench */}
      {state ? (
        <section className="ob-section">
          <div className="ob-sechead"><span className="ob-num">02</span><span className="ob-title">Reconciliation workbench</span>
            <span className="ob-aside">{state.tiles.filter((t) => t.ok).length} of 4 gate checks green</span></div>

          <div className="ob-gatebar">
            {state.tiles.map((t) => (
              <div key={t.id} className={"ob-gate " + (t.ok ? "pass" : "fail")}>
                <div className="ob-gate-l">{t.label}</div>
                <div className="ob-gate-v">{t.value}</div>
                {t.note ? <div className="ob-gate-note">{t.note}</div> : null}
              </div>
            ))}
          </div>

          <table className="ob-table">
            <thead>
              <tr><th>Instrument (parsed)</th><th>Source</th><th>Sub-category</th><th className="num">Value (Rs Cr)</th><th>Confidence</th></tr>
            </thead>
            <tbody>
              {state.rows.map((r) => (
                <tr
                  key={r.key}
                  className={
                    r.resolution.state === "unresolved"
                      ? "ob-row-unres"
                      : r.provenanceKind === "advisor_attested"
                        ? "ob-row-attested"
                        : undefined
                  }
                >
                  <td>
                    <span className="ob-inst">{r.instrument}</span>
                    {r.provenance.map((p) => <span key={p} className="ob-prov">{p}</span>)}
                    {r.crossSource ? <span className="ob-prov">{r.crossSource}</span> : null}
                    {r.attestation ? (
                      <span className="ob-prov">excluded from the totals tie (attested, not sourced)</span>
                    ) : null}
                  </td>
                  <td className="ob-mono">{r.source}</td>
                  <td>
                    <select className="ob-select" value={r.subCategory ?? ""} onChange={(e) => setSub(r, e.target.value as SubCategory)}>
                      <option value="" disabled>pick&hellip;</option>
                      {SUB_CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="num ob-mono">
                    {r.needsAttestation ? (
                      <span className="ob-attest">
                        <input
                          className="ob-attest-value"
                          placeholder="value (Rs lakh)"
                          inputMode="decimal"
                          value={attestDrafts[r.key]?.value ?? ""}
                          onChange={(e) =>
                            setAttestDrafts({ ...attestDrafts, [r.key]: { value: e.target.value, note: attestDrafts[r.key]?.note ?? "" } })
                          }
                        />
                        <input
                          className="ob-attest-note"
                          placeholder="basis note (required)"
                          value={attestDrafts[r.key]?.note ?? ""}
                          onChange={(e) =>
                            setAttestDrafts({ ...attestDrafts, [r.key]: { value: attestDrafts[r.key]?.value ?? "", note: e.target.value } })
                          }
                        />
                        <button
                          className="ob-pill heur asbtn"
                          disabled={
                            !attestDrafts[r.key] ||
                            !(Number(attestDrafts[r.key]?.value.replace(/,/g, "")) > 0) ||
                            !attestDrafts[r.key]?.note.trim()
                          }
                          onClick={() => attestRow(r)}
                        >
                          attest
                        </button>
                      </span>
                    ) : (
                      crore(r.valueInr)
                    )}
                  </td>
                  <td>
                    {r.resolution.state === "unresolved" ? (
                      <span className="ob-pill unres">name unresolved</span>
                    ) : r.attestation ? (
                      <span className="ob-pill attested">attested, not sourced</span>
                    ) : r.needsAttestation ? (
                      <span className="ob-pill unres">attestation needed</span>
                    ) : r.confidence === "exact" ? (
                      <span className="ob-pill exact">exact{r.source === "both" ? ", 2 sources" : ""}</span>
                    ) : r.confirmed ? (
                      <span className="ob-pill exact">heuristic, confirmed</span>
                    ) : (
                      <button className="ob-pill heur asbtn" onClick={() => confirmRow(r)}>heuristic, confirm?</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {unresolvedRows.map((r) => (
            <div key={r.key} className="ob-resolve">
              <div className="ob-q">&#8220;{r.rawLabel}&#8221; is not in the snapshot universe. Did you mean:</div>
              <div className="ob-cands">
                {(r.resolution.state === "unresolved" ? r.resolution.candidates : []).map((c) => (
                  <button key={c} className="ob-cand" onClick={() => pickResolution(r, c)}>{c}</button>
                ))}
                <button className="ob-cand alt" onClick={() => acceptMismatch(r)}>keep as unmatched (logged to debt)</button>
              </div>
            </div>
          ))}

        </section>
      ) : null}

      {/* Step 3: commit */}
      {state ? (
        <section className="ob-section">
          <div className="ob-sechead"><span className="ob-num">03</span><span className="ob-title">Commit and lock</span>
            <span className="ob-aside">storage tier is explicit</span></div>
          <div className="ob-tiers">
            <button className={"ob-tier" + (tier === "synthetic_public" ? " active" : "")} onClick={() => setTier("synthetic_public")}>
              <div className="ob-tier-k">Tier 1</div>
              <div className="ob-tier-n">Synthetic / fictional</div>
              <div className="ob-tier-d">Stored as public fixtures in the codebase repository (WA14).</div>
            </button>
            <button className={"ob-tier" + (tier === "real_local_only" ? " active" : "")} onClick={() => setTier("real_local_only")}>
              <div className="ob-tier-k">Tier 2</div>
              <div className="ob-tier-n">Real client data</div>
              <div className="ob-tier-d">Local-only store on this machine; never enters any repository (P30, ADR-0049).</div>
            </button>
            <div className="ob-tier disabled">
              <div className="ob-tier-k">Tier 3, end-state</div>
              <div className="ob-tier-n">Secure data service</div>
              <div className="ob-tier-d">Logged as data debt D16; not built in the lean MVP.</div>
            </div>
          </div>
          <div className="ob-commitrow">
            <button className="ob-btn" disabled={!state.clears || pending || Boolean(commitResult?.ok)} onClick={onCommit}>
              Commit holdings and lock persona
            </button>
            {!state.clears ? (
              <span className="ob-blocked">blocked: {state.blockers.join("; ")}</span>
            ) : null}
            {commitResult && !commitResult.ok ? <span className="ob-blocked">{commitResult.error}</span> : null}
            {commitResult?.ok ? (
              <span className="ob-committed">
                Locked: {commitResult.investorId}, {commitResult.holdings} holdings, Rs {commitResult.totalCr.toFixed(2)} Cr.
                {commitResult.attestedCount > 0
                  ? " The totals tie covers sourced holdings only: " + commitResult.attestedCount +
                    " attested row" + (commitResult.attestedCount === 1 ? " sits" : "s sit") +
                    " outside the tie, totalling Rs " + commitResult.attestedTotalCr.toFixed(2) +
                    " Cr, attested not sourced."
                  : ""}
                {" "}Mandate capture follows as the next step. <a href={"/investors/" + commitResult.investorId}>Open the investor</a>
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="ob-foot">
        Built to docs/wireframes/onboarding_workbench_v1.html (ratified). The gate vocabulary and mandate-capture placement
        are as drawn; heuristic value entry awaits the Gate 2 ruling and does not exist in this build. The server re-runs the
        reconciliation gate before any write; nothing is stored from a red gate.
      </div>
    </div>
  );
}
