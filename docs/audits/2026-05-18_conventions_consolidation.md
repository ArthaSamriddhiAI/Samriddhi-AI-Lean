# Audit: Conventions consolidation (PR #3 review)

- Date: 2026-05-18
- Trigger: PR #3 review discipline; relates to existing debt T8
- Mode: read-only inventory + scope estimate + engineer recommendation. No consolidation performed. The land-now-vs-defer call is the reviewer's.

## Inventory of working agreements

WA1-WA9 are defined verbatim only in the out-of-repo CC build prompt (`.../09 - A2 Classification Agent/03 - CC_Prompt_A2_Build.md`, "Working agreements"); WA9 originated in the out-of-repo scope-refinement message and was transcribed into the CC prompt (the two are consistent because one was copied from the other). WA10-WA11 exist only in-repo (the CC prompt predates them). The central finding: the canonical text for any WA lives in exactly one place, and that place is inconsistent across the set (out-of-repo for 1-9, in-repo for 10-11).

| WA | Agreement (tight paraphrase) | First declared | Currently lives | Drift / gap |
|---|---|---|---|---|
| WA1 | No self-merge; open PR, reviewer squash-merges | CC prompt | CC prompt only | Mechanism ("gh pr create") was stale in older notes; gh is in fact available here. Never reconciled in a durable in-repo doc. |
| WA2 | Two canonical references; implement not redesign; surface divergence | CC prompt | CC prompt; reinforced in audit doc + ADR context | Consistent; reads as per-workstream. |
| WA3 | Audit before integration | CC prompt | CC prompt; honored in audit doc | Consistent; generalized later as "ships narrow, captures wide". |
| WA4 | Two hard checkpoints; no proceeding without approval | CC prompt | CC prompt; referenced throughout | Consistent; run-specific. |
| WA5 | Product debt over scope creep | CC prompt | CC prompt; the debt log is its durable surface | Mechanism durably in-repo; agreement text out-of-repo only. |
| WA6 | Flag and wait freely | CC prompt | CC prompt only | Single source; never restated. |
| WA7 | No long dashes anywhere (hard rule) | CC prompt | CC prompt; cited by number in-repo (D7) | Cited in-repo, defined out-of-repo: a repo-only reader cannot resolve "WA7". |
| WA8 | Surface debt entries before PR | CC prompt | CC prompt; satisfied via the log | Consistent; process step. |
| WA9 | Capability ships data, design ships render | scope-refinement msg, then CC prompt | CC prompt; cited by number in-repo (audit doc, D7) | Cited in-repo, defined out-of-repo. Asymmetry rationale only out-of-repo / in the "ships narrow" note. |
| WA10 | Push every commit; PR-open is the only gate | in-repo audit doc Hand-off | audit doc + `workstreams/a2_classification_handoff.md` (dual-write); cited by T8 | Two in-repo copies, mild drift: audit-doc copy has a "branch lives on the remote" clause the workstreams copy lacks. |
| WA11 | Dual-write hand-off (audit file + workstreams doc) | in-repo audit doc Hand-off | audit doc + workstreams doc (dual-written); cited by T8 | Consistent; the only WA whose enforcement is structural. |

Sharpest gap: WA7 and WA9 are cited in-repo by number but their defining text is out-of-repo only; WA1/WA6 have zero in-repo footprint. WA10's two in-repo copies already show the exact drift WA11 exists to surface.

## Inventory of conventions operating as agreements

| Convention | Where defined | Durable / surfaced? |
|---|---|---|
| P/D/T/X debt-series structure + routing + numbering discipline | `PRODUCT_DEBT_LOG.md` header + Maintenance; restated in handoff doc and inside T8 detail | Durably surfaced but stated in three places with slightly different emphasis; substance not drifted. Best-governed convention in the repo. |
| ADR format/template (Context / Decision / Alternatives Considered / Consequences; `NNNN_<snake_topic>.md`) | Implicit only: no template/0000/README in `docs/decisions/`; inducible from the 6 files (6/6 conform exactly) | Not written down anywhere. Strong de-facto standard, must be reverse-engineered by the next workstream. |
| Audit-file naming `docs/audits/YYYY-MM-DD_<topic>.md` | Implicit; n=4 now (a2_classification, file_management_hygiene, test_discipline, conventions_consolidation, all 2026-05-18) | Pattern clear but unstated; T8 is the open question about this directory's scoping. |
| Dual-write hand-off + `<workstream>_<purpose>.md` naming | Is WA11; realized as the audit-doc/workstreams-doc pair | Surfaced by construction; the naming sub-rule lives only inside WA11 prose, inherited from the accordion files. |
| "Capability ships data, design ships render" asymmetry | Is WA9; rationale out-of-repo + the "ships narrow" note | Referenced in-repo, defined out-of-repo. |
| "Ships narrow, captures wide" audit discipline | audit doc + handoff doc (dual-written) | Surfaced; functionally an agreement, never numbered; the two copies already enumerate different debt-ID lists (mild drift). |

## Proposed consolidation: file structure

Single file `docs/conventions.md` (broader than the numbered WAs alone, so a "conventions" umbrella beats "working_agreements"). Heading structure only (no content authored here):

```
# Conventions and Working Agreements
## 1. Purpose and scope (relationship to out-of-repo CC prompts; inheritance on workstream creation)
## 2. Working agreements WA1-WA11 (text + one-line rationale + applies-to scope, each)
## 3. Debt log conventions (3.1 P/D/T/X series + routing; 3.2 numbering discipline; 3.3 catalogues-not-resolves)
## 4. Decision records (4.1 when an ADR vs debt vs reconciliation; 4.2 template; 4.3 filename/numbering)
## 5. Audit-file convention (5.1 naming; 5.2 what an audit file contains vs must not -> this is the T8 resolution surface)
## 6. Hand-off convention (6.1 dual-write; 6.2 workstream doc naming; 6.3 ships narrow/captures wide)
## 7. Capability Phase asymmetry (the WA9 rationale, expanded)
## 8. Change log (this file is single-source / dual-write-exempt; record amendments + originating workstream)
```

Interaction with T8: creating this file is the act that would resolve T8 (Section 5.2 is precisely the audit-vs-conventions boundary T8 asks about). It also forces a load-bearing decision: if conventions live single-source here, the audit-doc Hand-off section and `a2_classification_handoff.md` become redundant copies of Section 6, so the consolidation must decide whether the dual-write hand-off docs survive as pointers or collapse, with consequences for the four remaining capability workstreams.

## Scope estimate and recommendation

**Edit inventory if it lands:** 1 file created (`docs/conventions.md`); 5-7 light edits (`PRODUCT_DEBT_LOG.md` resolve/trim T8 + series-taxonomy pointer; audit-doc Hand-off section trim-to-pointer; handoff doc collapse-to-pointer; an ADR template doc; optional README pointers); WA9 text is transcription from out-of-repo, not redesign; ~8 "working agreement N" in-repo citations should gain links (none break). 35 inbound `ADR 000N` references do not need updating (ADRs are not moving; only their template is being documented). No code/JSON references to `docs/audits` or a conventions file exist (the one code reference, `a2-classification.ts` to ADR 0005 by path, is to an unmoved file). **Risk: low** (additive; nothing renamed/moved). The real risk is a three-way drift (audit doc vs workstreams doc vs new file) if the existing copies are kept rather than collapsed; mild drift is already present. **Effort: low-to-moderate**, dominated by the T8 design decision (do the dual-write docs survive), not edit volume; roughly a focused half-day of doc work.

**Engineer recommendation: DEFER to Slice 7; keep T8 open; do NOT land the full consolidation in this PR.**

Reasoning: (1) T8 explicitly self-dates this decision in the repo ("decide later with three to four capability workstreams of content to design against"); landing now contradicts a debt entry this same workstream reasoned through, and the audit doc would simultaneously contain T8 and T8's resolution. (2) n=1 is the wrong sample: the ADR template, audit-naming, and the audit-vs-conventions boundary are being induced from a single audit series; the structure would bake in a one-example shape, the exact mistake T8 was written to avoid. (3) PR scope-creep: the A2 PR is a data-layer capability PR (WA9); a docs-architecture refactor touching the debt log, audit doc, handoff doc, and a new top-level file is a different review surface for zero capability benefit, and WA5 (product debt over scope creep) is itself one of the agreements in question, so deferring is the agreements-consistent move. (4) The dual-write-collapse decision is load-bearing for the four remaining capability workstreams and should be made deliberately, not inside an unrelated PR.

**Counter-argument and why it loses:** the four remaining capability workstreams each re-pay a "where is WA7/WA9 defined" tax until consolidation lands. But that cost is largely mitigated by WA11 (the next workstream inherits WA10/WA11/ships-narrow/numbering from the handoff doc), and the only acute in-repo-unresolvable gap (WA7/WA9 text) can be closed cheaply without the full refactor.

**Minimal interim mitigation (optional, reviewer's call):** add WA9's text and a one-line WA7 statement to the existing `docs/workstreams/a2_classification_handoff.md` "Conventions inherited" list. This closes the only acute in-repo-unresolvable gap, is WA11-consistent, is ~1 small edit, and leaves the structural T8 question correctly deferred. No new debt entry needed: T8 already is this decision input, correctly routed and dated. If deferred, the action is to leave T8 as the source of truth (optionally annotate it to point at this audit doc as the consolidation spec).
