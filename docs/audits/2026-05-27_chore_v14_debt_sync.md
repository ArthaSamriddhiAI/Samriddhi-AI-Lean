# v14 debt-log sync: chore audit (2026-05-27)

Chore `chore/v14-debt-sync`. Documentation hygiene only — no code, no tests, no agent changes. Bidirectional reconciliation between the v14 planner's recorded debt entries and the canonical on-disk debt logs under `docs/debt/`. The planner is a helper view; the codebase is canonical. This audit is the WA22 versioned deliverable produced **before** any writes to debt-log files; it surfaces three buckets (planner-ahead / codebase-ahead / divergent) and gates Section 2 on resolution of the codebase-ahead and divergent buckets.

This audit reconciles **structure and IDs**. The planner's per-entry body text was supplied to this chore only for the four new/changed entries (T17 sharpening, D11, D12, ET1–ET8); body text for the existing entries was not supplied, so body-level "material divergence" can only be assessed for those four. Where a planner/disk disagreement needs planner body text to resolve, it is surfaced as a question rather than guessed.

---

## 0. Read-only verification gate (WA19) — results

| Check | Result |
|---|---|
| 0.1 `git status` clean on `main`; `git pull origin main` no conflict | PASS — clean working tree, "Already up to date" |
| 0.2 All seven per-series files present under `docs/debt/` | PASS — see file-by-file below |
| 0.3 `docs/debt/enterprise_readiness_debt_log.md` does NOT pre-exist | PASS — absent; this chore creates it |
| 0.4 Private-repo DM-series boundary | NOTED — DM-series lives in `Samriddhi-AI-Data-Snapshots` `docs/debt/DATA_DEBT_LOG.md`; out of scope; not touched. `docs/debt/README.md:17` documents this boundary. |

First 5 lines, each per-series file (0.2 evidence):

- `tech_debt_log.md` — `# Tech debt log` / T-series header / restructured-from-combined note / table header `| ID | Description | Severity | Originating workstream | Target fix workstream |`.
- `product_debt_log.md` — `# Product debt log` / P-series header / restructured-from-combined note / table header (same columns).
- `data_debt_log.md` — `# Data debt log` / D-series header / restructured-from-combined note / table header (same columns).
- `operational_debt_log.md` — `# Operational debt log` / O-series header / routed-to-Slice-7 note / table header (same columns).
- `production_data_debt_log.md` — `# Production data debt log` / DD-series header / forward-looking-enterprise note / table header (same columns).
- `design_debt_log.md` — `# Design debt log` / X-series header / UI/UX-shortcut note / table header (same columns).
- `ui_ux_debt_log.md` — `# UI/UX debt log` / render-layer-debt note / `## UX-series` / table header (same columns).

Gate result: **0.1–0.4 all PASS.** Proceeded to Section 1.

---

## 1.1 Current on-disk state, per series

| Series | File | Entries on disk | Count | Highest ID | Sequence gaps / notes |
|---|---|---|---|---|---|
| T | `tech_debt_log.md` | T1–T19 | 19 (17 open + T2, T8 resolved) | T19 | No gaps. T2 "Medium (resolved 2026-05-17)", T8 "Low (resolved 2026-05-19)" marked-in-place per the resolve-don't-delete convention. |
| P | `product_debt_log.md` | P1–P33 | 33 | P33 | No gaps. **P30 is rendered as a prose block** (lines 109–200), not a table row, between table rows P29 and P31; all other P entries are table rows. No resolved entries. |
| D | `data_debt_log.md` | D1–D10 | 10 | D10 | **No gap at D9 — D9 exists on disk** (AIF Cat II coverage, originating `s1-case-generation`/menon). This contradicts the kickoff §1.1 hint that "D9 was never allocated." |
| O | `operational_debt_log.md` | O1–O5 | 5 | O5 | No gaps. Disk tail is O5. |
| DD | `production_data_debt_log.md` | DD1–DD3 | 3 | DD3 | No gaps. |
| X | `design_debt_log.md` | X1–X6 | 6 | X6 | No gaps. |
| UX | `ui_ux_debt_log.md` | UX1–UX10 | 10 | UX10 | No gaps. Disk tail is UX10. |

`combined_debt_log_archive.md` (the pre-restructure combined log) and `README.md` (the series index) also live under `docs/debt/`; neither is a per-series ledger and neither is in scope except for the README index check (§2.5, deferred to Section 2).

## 1.2 T17 verbatim (existing text on disk)

T17 exists **only as a table row** (`tech_debt_log.md:23`); it has no below-table prose block today. Full row, verbatim:

> | T17 | Skill-vs-implementation schema divergence. Across IC1 (Chair, Minutes Recorder), S1 (diagnostic mode), and A1, the skill `.md` files describe richer authored output schemas than the TypeScript renderers actually emit today (A1's approval-recommendation enum, Minutes Recorder's cryptographic audit trail, Chair's outcome/confidence fields, S1-diagnostic's health-verdict schema). Either the renderers should be expanded to ship the authored shape or the skills should be trimmed to match what runs. | Medium | v11.3 architecture mapping | TBD |

## 1.3 Bidirectional reconciliation matrix

Planner column transcribed from the kickoff §1.3 matrix. Disk column from §1.1 above.

| Series | Planner v14 records | On disk | Count match | On-disk-not-in-planner | In-planner-not-on-disk |
|---|---|---|---|---|---|
| P | P1–P22, P28, P31, P32, P33 (stated 27; **lists 26 IDs**) | P1–P33 (33) | **No** | P23, P24, P25, P26, P27, P29, P30 (7) | none |
| D | D1–D8, D10, D11, D12 (11) | D1–D10 (10) | **No** | D9 (1) | D11, D12 (2 — Bucket A new) |
| T | T1, T3–T7, T9–T13, T16–T20 (16 open) | T1, T3–T7, T9–T19 (17 open) | **No** | T14, T15 (2) | T20 (1) |
| O | O1–O12 (12) | O1–O5 (5) | **No** | none | O6, O7, O8, O9, O10, O11, O12 (7) |
| DD | DD1–DD3 (3) | DD1–DD3 (3) | **Yes** | none | none |
| X | X1–X6 (6) | X1–X6 (6) | **Yes** | none | none |
| UX | UX1–UX11 (11) | UX1–UX10 (10) | **No** | none | UX11 (1) |

### On-disk-not-in-planner — first-line summaries (Bucket B candidates)

- **P23** — Live S2 pipeline does not generate LLM rollups (templated only; deliberate cost-control). Severity Low.
- **P24** — Foundation documents as LLM-consumable reference material (commit platform-doctrine docs to `docs/reference/`). Severity Low.
- **P25** — G2 returns `requires_clarification` for every mutual-fund target (SEBI MF scheme rules not curated); carries a mandatory re-fire protocol. **Severity High.**
- **P26** — G1 `target_category` enum incomplete beyond `mutual_fund_debt` (REITs, InvITs, gold MFs, NCDs, gilts, etc.). Severity Medium.
- **P27** — Samriddhi 1 case coverage exists only for investors 01–05; 06–13 and ESOP scenarios unbuilt. Severity Medium.
- **P29** — Refresh cadence / assembly methodology for real-world-sourced data tracked as DM1/DM2 in the private repo; public repo cross-references only. Severity Low.
- **P30** — Real-investor-data transition preconditions (regulatory, data-handling, consent, liability, operational). **Severity Critical-when-triggered.** Rendered as a prose block.
- **D9** — Snapshot `aif` block has asymmetric AIF-category coverage; Cat II private credit largely absent (surfaced by the menon case). Severity Medium. Referenced live at `docs/audits/2026-05-21_s1_case_batch.md:13`.
- **T14** — E2 may supplement training-data industry knowledge on uncovered thematic cases despite the no-supplementation guardrail. Severity Low. Referenced live at `docs/audits/2026-05-21_s1_case_batch.md:26`.
- **T15** — Deterministic verify scripts should encode per-target-category expectations, not blanket assertions. Severity Low.

### In-planner-not-on-disk — disposition

- **D11, D12** — expected Bucket A new entries; bodies supplied in kickoff §2.2/§2.3. D10 is the current D-series tail and D11 does not exist on disk, so D11 (then D12) are the next free IDs — clear to apply in Section 2.
- **T20** — no on-disk entry; **no body text supplied**; not in the kickoff's Section 2 apply list. The planner range "T16–T20" implies a T20 the disk lacks (disk tail T19). Cannot apply (no text); surfaced for resolution.
- **O6–O12** — no on-disk entries (disk tail O5); **no body text supplied**; not in Section 2. Seven planner-claimed entries with no canonical counterpart. Surfaced for resolution.
- **UX11** — no on-disk entry (disk tail UX10); **no body text supplied**; not in Section 2. Surfaced for resolution.

## 1.x Conventions observed (for §2.1 T17 addendum and §2.4 ET file)

**T17 addendum convention.** Two addendum styles exist in `tech_debt_log.md`:
1. Inline, bold date-prefixed, inside the table cell — T3 ("**Partially stale post-A2 Slice 4.6a (2026-05-18):**"), T5 ("**Updated post-A2 Slice 4.6a (2026-05-18):**"), T8 ("**RESOLVED 2026-05-19 (risk-reward workstream): …**").
2. Below-table prose block with a bold header — T16 ("**T16 update, 2026-05, from T-5.07/T-5.08 workstream:**"), plus detail blocks for T7/T8/T9/T18 ("**T18 detail (…)**").
The v14 sharpening is a full paragraph, so style (2) — a below-table prose block headed e.g. "**T17 v14 sharpening (2026-05-27):**" — is the cleaner fit and preserves the bare table row. **Intended to adopt** (style 2), pending Bucket B/C resolution.

**ET-file conventions** (observed in `data_debt_log.md` and `operational_debt_log.md`):
- H1 title `# <Name> debt log`, then a lead paragraph: "`<letter>`-series. `<scope>`. Restructured out of the combined `PRODUCT_DEBT_LOG.md`; see `README.md` for the convention."
- A Markdown table `| ID | Description | Severity | Originating workstream | Target fix workstream |` with a separator row.
- Severity tags Critical / High / Medium / Low (README §"Entry convention"). The kickoff overrides this for ET with the single tag **"Deferred."**
- Long entries carry a below-table `**<ID> detail (…)**` prose block.
- **Intended to adopt:** H1 + lead paragraph + table, but with the ET header declaring series name (ET = Enterprise Readiness), anticipatory purpose, the "Deferred" severity convention, the activation trigger (first paying client; seam audit first), and the anticipatory-vs-active cross-series boundary note. Exact rendering of ET1–ET8 (table rows vs prose) finalized in Section 2.

---

## 1.4 Findings — buckets

### Bucket A — planner ahead of codebase, ready for Section 2 (text supplied)
Matches the kickoff's expected Bucket A exactly:
- **T17 v14 sharpening** — append addendum to the existing T17 row (style 2 above). Existing T17 confirmed as a bare table row, ready for a clean tail addendum.
- **D11** — new entry; D11 confirmed as next free ID (D10 is tail).
- **D12** — new entry; next free after D11.
- **`enterprise_readiness_debt_log.md`** — new ET-series file, ET1–ET8, severity "Deferred"; confirmed absent on disk.

*No contradiction to the Section 2 assumptions was found for Bucket A items. They remain blocked only by the §1.4 gate below.*

### Bucket B — codebase ahead of planner (planner update needed; NO codebase change)
The planner's recorded ID set omits entries that exist canonically on disk:
- **P-series:** P23, P24, P25 (High), P26, P27, P29, P30 (Critical-when-triggered) — 7 entries the planner does not list.
- **D-series:** D9 — exists on disk; the planner (and kickoff §1.1) assumed it was never allocated.
- **T-series:** T14, T15 — exist on disk; absent from the planner list.

These need the **planner** to catch up. No on-disk change is implied. Planner sync happens outside this workstream (kickoff "Out of scope": roadmap edits).

### Bucket C — divergence requiring resolution (planner claims entries with no canonical counterpart and no supplied text)
- **T-series T20:** planner range "T16–T20" implies a T20; disk tail is T19. Either the planner range is a transcription/count artifact (should be T16–T19) or a T20 is pending. No text supplied; not in Section 2.
- **O-series O6–O12:** planner claims O1–O12 (12); disk has O1–O5 (5). Seven entries with no canonical counterpart and no supplied text.
- **UX-series UX11:** planner claims UX1–UX11; disk tail is UX10. One entry, no supplied text.
- **P-series count:** planner states "count: 27" but enumerates 26 IDs — an internal planner inconsistency, independent of the 7 Bucket-B omissions above.

**Gate:** Bucket B and Bucket C are both non-empty. Per kickoff §1.4 this audit **STOPS here** and waits for direction on each Bucket B and Bucket C item before any Section 2 writes. Bucket A is verified and ready to apply once the gate is released.

---

## Out-of-scope boundary (recorded per kickoff §0.4)

- DM-series (Data Mirror) lives in the private `Samriddhi-AI-Data-Snapshots` repo at `docs/debt/DATA_DEBT_LOG.md` (entries DM1, DM2). Not touched by this chore. `docs/debt/README.md:17` documents the boundary.
- No code, test, roadmap, ADR, or WA changes (kickoff "Out of scope").
- No reformatting of existing debt-log files beyond the targeted Section 2 additions.

---

## Bucket B verbatim text (for planner v14 refresh)

Canonical on-disk text for the eight codebase-ahead entries, supplied so the planner can sync without re-opening the debt-log files. Text is verbatim from disk as of this audit (2026-05-27).

### D9 — Severity: Medium

> Snapshot `aif` block carries asymmetric coverage across AIF categories: Cat I (venture, angel, stressed-asset) is reasonably represented in the "E6 Agent Input Ready" list, but Cat II (especially private credit) is largely absent. Surfaced during the Samriddhi 1 case batch (case: menon, a Cat II private credit AIF). Without coverage E6 cannot ground on Cat II private-credit proposals; the honest-miss plus guardrail (ADR-0026) correctly state "not in coverage" rather than hallucinating manager/fee/capacity figures. Unblocking fix: either (a) expand the `aif` block's "E6 Agent Input Ready" list to include Cat II private-credit funds with the same field shape (`management_fee_pct`, `performance_fee_pct`, `hurdle_rate_pct`, `minimum_investment_cr`, `fund_manager_names`, `redemption_terms`), or (b) accept the limitation and scope future Samriddhi 1 cases away from Cat II private-credit targets. Cross-references ADR-0024, ADR-0026, the menon case fixture, and the foundation AIF look-through scope-out language.
>
> Originating workstream: s1-case-generation (case: menon). Target fix workstream: Snapshot coverage expansion for Cat II AIF (data-sourcing decision; may need BD/partnership given Cat II disclosure opacity).

### P25 — Severity: High

> G2 (SEBI gate) returns `requires_clarification` for every mutual-fund target (`mutual_fund`, `mutual_fund_debt`, and future MF categories) because SEBI MF scheme-level rules are not in the curated rule store; only PMS/AIF minimum-ticket rules are, and the deferral is documented inline in `g2-sebi.ts` ("future slice"). Consequence in the Samriddhi 1 pipeline: every MF proposal trips G2 clarify, which contributes to materiality firing and thus IC1 deliberation regardless of proposal stakes, and specifically blocks demonstration of IC1-skip for MF-target cases. A mandatory re-fire protocol for affected fixtures applies when the fix lands (see P25 detail block in `product_debt_log.md`).
>
> Originating workstream: s1-case-generation (cases iyengar, surana carry MF debt targets). Target fix workstream: Dedicated G2 MF scheme-rule curation workstream (Capability Phase scope, own product thesis).

### P26 — Severity: Medium

> G1 (mandate gate) `target_category` enum was extended in s1-case-generation to add `mutual_fund_debt` (ADR-0025). Other product types remain absent: hybrid MF variants, international ETFs, REITs, InvITs, gold MFs, sovereign gold bonds, NCDs, gilts, commodity ETFs. As new proposal shapes surface in future Samriddhi 1 batches, the enum and the category-to-asset-class mapping must extend correspondingly, else new target types fail enum validation or are mis-modeled (the failure mode that affected debt MFs before this fix). Re-fire only cases whose `target_category` was previously mis-modeled.
>
> Originating workstream: s1-case-generation. Target fix workstream: Incremental (extend as new shapes are authored) or a dedicated G1 target_category audit workstream.

### P27 — Severity: Medium

> Samriddhi 1 case coverage exists only for investors 01-05 (and Sharma A6 as the structural scaffolding case). Investors 06-13 have no Samriddhi 1 coverage, and ESOP-specific Samriddhi 1 scenarios are unbuilt. A future Samriddhi 1 batch (this workstream's shape, scoped to 06-13) should author them, applying this batch's learnings (action-centric routing, the G2 MF gap if still extant, the G1 `target_category` state at authoring time).
>
> Originating workstream: s1-case-generation. Target fix workstream: Future Samriddhi 1 case batch (investors 06-13); ESOP scenarios alongside.

### P29 — Severity: Low (cross-reference only; substantive debt lives elsewhere)

> Refresh cadence and assembly methodology for the real-world-sourced data (the 9 enriched snapshots plus `scripts/sector_map.json`) are documented as debt in the private `Samriddhi-AI-Data-Snapshots` repository (its `docs/debt/DATA_DEBT_LOG.md`, entries DM1 and DM2). The public repo references this for awareness; the substantive unblock-work happens in the private repo. Future workstreams in this public repo that depend on more recent market data or refresh-tooling integration will block on those private-repo debts. Per the contracted privacy boundary (ADR-0027), only real-world-sourced data is private; the fictional investor holdings/mandates and the Sharma verdicts are public, in-repo, and carry no such debt. Unblocking-fix: see private-repo DM1 (refresh cadence frozen) and DM2 (assembly methodology not documented). Cross-references: this repo's ADR-0027; private repo `DATA_DEBT_LOG.md` (DM1, DM2). Numbering note: numbered P29 rather than the next-free P25 because P25-P28 were reserved by concurrent workstreams not yet merged at time of authoring.
>
> Originating workstream: snapshot-data-extraction (Phase B). Target fix workstream: Whichever workstream is triggered by a need for fresh market data; it pulls private-repo DM1/DM2 unblocking into scope.

### P30 — Severity: Critical-when-triggered (not blocking current fictional-only scope)

P30 is rendered as a prose block in `product_debt_log.md` (not a table row). Severity cell literal: `Critical-when-triggered. Not blocking current work because the current scope is fictional-only.`

> The Samriddhi AI pipeline currently operates on fictional investors. Any future transition to running cases on REAL investor data introduces a categorically different set of concerns not addressed by the fictional-data workstreams. Before any real-client case is generated, the following must be evaluated and resolved: REGULATORY (SEBI investment-adviser registration, DPDP Act applicability and consent requirements, fiduciary-duty implications, audit trail and record-keeping per SEBI advisor regulations); DATA HANDLING (PII cannot live in GitHub repos; real client data requires encrypted-at-rest storage with role-based access; real holdings data is licensed-and-PII); CONSENT AND AUTHORIZATION (explicit informed consent for AI-assisted analysis, consent mechanism design, right-to-withdrawal and data-deletion); PIPELINE BEHAVIOR (whether agent outputs require additional review before being shown to the advisor, whether materiality thresholds / IC1 depth / gate strictness should differ between demo and real-client modes, whether case fixtures for real clients are storable or must be ephemeral / encrypted); LIABILITY AND INSURANCE (professional indemnity implications, liability allocation, disclaimer framing); OPERATIONAL (multi-user access control, audit logging, incident response, backup and disaster recovery).
>
> Unblocking-fix process: (a) Decision to pursue real-client mode (product decision; not technical). (b) Legal and regulatory consultation. (c) Dedicated workstream(s) per concern category. (d) Validation and audit before any real client is onboarded. No real-client case is generated until (a)–(d) are complete and documented.
>
> Originating workstream: snapshot-data-extraction (authored alongside WA14). Target fix workstream: Real-client mode design workstream (scope comparable to the entire lean MVP build to date). Cross-references: WA14, ADR-0027.

### T14 — Severity: Low

> E2 (industry / business-model agent) may supplement from training-data industry knowledge on uncovered cases even when the scope-builder's no-supplementation guardrail (ADR-0024, DP2) instructs otherwise. The guardrail reliably stops invented fund sector-weights (Iyengar and Malhotra E2 correctly state "sector data not available"), but for a strongly thematic PMS target (Bhatt's Ambit Build India, infrastructure) E2 brings model-knowledge industry context (e.g., Union Budget FY26 infra capex Rs 11.11 lakh crore, L&T order book) because its skill is directive about industry analysis. Accepted for this batch per the pre-agreed disposition: these are plausible, labeled, non-contradicting (moderate, not the E7-style snapshot contradiction) and do not drive the verdict. Future work: tighten the E2 skill file's industry-inference behavior, or expand snapshot sector/industry coverage so E2 grounds rather than supplements.
>
> Originating workstream: s1-case-generation (case: bhatt). Target fix workstream: E2 skill revision or snapshot sector/industry coverage expansion.

### T15 — Severity: Low (no functional impact; documentation and forward-guidance)

> Deterministic verify scripts that assert pipeline behavior should encode per-target-category (or per-relevant-dimension) expectations rather than blanket assertions. Surfaced during Phase D when `_verify-governance-regrounding`'s blanket "G2 cites sebi_001" assertion failed on MF target cases (legitimately, per P25 behavior). The script was updated in the same commit; this debt entry exists to remind future verify-script authors that the per-target-category pattern is the right shape, not blanket assertions that assume one product class. Unblocking-fix: new verify scripts adopt per-target-category patterns where pipeline behavior depends on target shape; existing verify scripts updated incrementally as their assumptions are surfaced. Cross-references: P25 (G2 MF scheme rule curation).
>
> Originating workstream: snapshot-data-extraction Phase D (case-batch rebase surfaced the script's outdated assumption). Target fix workstream: Future verify-script authoring as needed; no dedicated workstream required.

---

### Additional findings from gate exchange (2026-05-27)

**P3a / P3b split:** P3 is a single table row on disk with a below-table prose addendum ("**P3 update, 2026-05, from T-5.07/T-5.08 workstream:**") that narrates the P3a/P3b split. No separate P3a or P3b table rows exist. The split is planner-only as distinct entries; this is a further item for the `chore/codification-gap-close` catchment.

**Bucket C ruling (codification-gap entries O6–O12, T20, UX11):** Out of scope for this chore. These entries were authored in planner versions v12/v13 but never landed on disk. They feed the follow-up `chore/codification-gap-close` workstream and are noted here but not actioned.

**Kickoff matrix drift:** The kickoff §1.3 matrix row for P ("P1–P22, P28, P31, P32, P33 (count: 27)") was itself stale — the live planner has P1–P24 plus P28, P31–P33 (29 rows). P23/P24 are not false Bucket B; they are genuine disk entries the kickoff matrix omitted. The corrected Bucket B set is D9, P25–P27, P29, P30, T14, T15 (8 entries).
