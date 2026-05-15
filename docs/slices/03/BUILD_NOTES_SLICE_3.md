# Slice 3 build notes

What landed in the Samriddhi 1 proposal-evaluation slice, what deviated from the orientation, what was decided autonomously, what was deferred, and the notable detours encountered.

## Stack decisions confirmed

- Skill files in `/agents/` stay byte-identical (Slice 2 pattern preserved). Slice 3's case-mode agents (E1-E7 in proposal context, S1.case_mode, A1.challenge) load via the same `skill-loader.ts` and call site (`callAgent` in `lib/agents/harness.ts`).
- Verdict shape for Samriddhi 1 evidence agents is the simpler proposal-evaluation structure documented in `db/fixtures/raw/sharma_marcellus_evidence_verdicts.md` (activation status, risk level, confidence, drivers, flags, reasoning paragraph, data points cited). Distinct from Slice 2's diagnostic-shape outputs. Runtime override pattern (skill body unchanged; user prompt instructs the schema) carried forward from Slice 2 Q2.
- Governance gates (G1, G2, G3) are deterministic per the orientation Q2 lock. Pure TypeScript, no LLM in the evaluation path. 10pp threshold separates `requires_clarification` (soft breach) from `fail` (hard breach); industry-standard institutional discipline.
- M0.IndianContext stays out of scope for Slice 3 commits; commit 3 is blocked pending the Workstream C YAML knowledge-store curation. The agent prompts and S1 carry a placeholder `IndianContextSummary` that emits a "not yet integrated" sentinel when null. When Workstream C lands, commit 3 wires the integration and re-generates the Sharma stub for IndianContext.
- STUB_MODE is a first-class feature, not a workaround. Permanent. Visual indicators across Case Detail badge, PDF footer, Case List signal, Settings toggle. Implementation per Slice 3 orientation Q7.
- Persistent case-fixture pattern (Slice 2 commit 20 architectural anchor) extends cleanly to Samriddhi 1: the canonical Sharma + Marcellus case lives at `db/fixtures/cases/c-2026-05-14-sharma-01.json` with `stubbed: true`, loaded by `db/seed.ts` on every `db:seed`.

## STUB_MODE infrastructure

The funding-aware delivery shape that defined the slice. Three pieces:

1. **`lib/agents/stub.ts`** — resolver (`Setting.stubMode` row override > env `STUB_MODE` > false), loader (reads from `fixtures/stub-responses/<case-fixture-id>/<agent-id>.json`, fails fast on missing fixture in strict mode), recorder (writes raw SDK responses on successful live calls when `STUB_RECORD=true` and no fixture exists; idempotent).
2. **`lib/agents/harness.ts`** — `callAgent` accepts an optional `stubKey`. With stubKey + STUB_MODE active: stub loaded, parsed, returned without an SDK call. With stubKey + STUB_MODE off: SDK called, raw response recorded after success. Without stubKey: SDK called, no stub interaction. Slice 2's diagnostic pipeline does not pass stubKey and is unaffected.
3. **`fixtures/stub-responses/`** — directory layout `<case-fixture-id>/<agent-id>.json`. `.gitignore` reworked to track this directory while keeping the 97 MB `fixtures/snapshots/` ignored.

The Sharma case generation (commit 9) used a hybrid path: E1-E7 verdicts parsed from the lifted markdown file (no API spend), G1/G2/G3 computed deterministically, S1.case_mode and A1.challenge fired live (Opus 4.7, ~$0.89 total) and recorded as stubs for replay.

## Deviations from the orientation

- **M0.IndianContext integration deferred to a parallel workstream.** Orientation Q4 said IndianContext "runs first, before any evidence agent" with structured factual framings. Scoping response B revised: the curated YAML knowledge stores don't exist in the codebase, and LLM-as-knowledge-store would violate auditability. Workstream C runs in a separate chat to curate the six YAML stores; commit 3 is blocked until that completes. Slice 3 commits 4-7 proceed with `ctx.indianContext = null`; the soft dependency is documented in the agent prompts. When Workstream C lands, commit 3 wires the integration and adds the IndianContext stub fixture.
- **Sharma's overall verdict came in as `requires_clarification`, not the orientation's expected `positive_with_caveat`.** S1 read G1's `requires_clarification` (three band gaps) as strong enough signal to escalate the case verdict. User reviewed at the Sharma quality gate and approved as-is: "the system produced exactly what it should — an honest verdict that surfaces real architectural questions." This is the institutional credibility move the platform is built around. Recorded as the canonical demo verdict.
- **Investor.mandateJson and Case.stubbed and Case.decisionJson are all nullable.** Orientation Q1 implied a required mandate column. Schema-add against the populated Slice 2 SQLite database required either a `--force-reset` (lossy — wipes the API key) or nullability. User chose nullability (G1 treats null as `requires_clarification` at runtime, so correctness is preserved). Same pattern applied to `Case.stubbed` (null = legacy/Slice 2 cases, treated as not-stubbed) and `Case.decisionJson` (null = no decision yet).
- **Case-mode briefing PDF deferred.** Orientation §1 Q1 said "Use the same React PDF component scaffolding established in Slice 2." Slice 3 ships the Outcome tab on the web as the primary surface; the Export briefing button is hidden on s1 cases. Adding the PDF is a focused follow-up (DEFERRED item).
- **Foundation §recommendations updated.** The orientation flagged that foundation.md said "The MVP is diagnostic-only" — directly contradicting Slice 3. Commit 2a amended foundation.md in place: §1 Scope acknowledges both workflows, a new §1.1 carries the case_intent enum, §6.4 rescopes to the diagnostic briefing, §7 softens "Recommendation generation" to "Proactive recommendation generation." The "Multi-agent orchestration visible to the user" §7 line was preserved (Samriddhi 1's Analyst Reports tab reads as analyst memos stacked, not AI debate; the principle stands).

## Autonomous decisions during build

- **Mandate authoring.** `db/fixtures/structured-mandates.ts` ships one mandate per seeded investor. Sharma's bands widened to 50-70 equity / 20-35 debt / 5-15 alt / 2-8 cash per the verdicts file context line. Bhatt's bands match the Slice 2 fixture's read (60-70 equity). Iyengar's tightened for conservative-medium-term (25-45 equity, 45-65 debt, instrument exclusions). Menon's alternatives widened for venture / pre-IPO. Others on foundation defaults.
- **10pp band threshold in G1.** Soft breach (band edge to +10pp) → `requires_clarification`. Hard breach (>10pp) → `fail`. Within band → `pass`. Aligned with institutional wealth-management discipline; configurable per firm in a future slice.
- **Non-activation reason templates with verdicts-file fallback preference.** `lib/agents/case/non-activation.ts` carries deterministic templates per agent grounded in principles §3.1; the Sharma case's E5/E7 stubs ship richer text parsed from the verdicts file, and the runtime prefers the stub when present. The template is the fallback for new cases without a stub fixture.
- **Generic scope blocks for evidence agents in live mode.** `lib/agents/pipeline-case.ts` builds short scope strings from the investor + proposal context (e.g., "Look-through universe of Marcellus Consistent Compounder PMS"). Adequate for stub replay (scope is ignored when a stub fixture exists) and acceptable for an MVP live run; richer scope-builders (snapshot-derived look-through tables, sector-weight derivations) are a Slice 7 polish item.
- **Generation mode marked as "hybrid" on the Sharma case.** S1's `section_7_coverage_methodology_note.generation_mode` field carries the honest provenance: E1-E7 from authored verdicts, S1 and A1 from live calls, IndianContext deferred. Distinct from pure "stub" (replay-only) and pure "live" (every layer live).
- **`scripts/generate-sharma-fixture.ts` calls S1 and A1 without `stubKey`.** The script needs S1 and A1 to go live regardless of STUB_MODE. Without stubKey, the harness skips the stub-mode fast path and dispatches to the SDK. After a successful response, the script writes the stub fixture manually. Cleaner than toggling STUB_MODE per-call.
- **Decision capture as a single PUT endpoint, no versioning.** Saving a decision overwrites prior; rationale text is the audit trail. MVP scope per orientation §8 ("no downstream effect in the MVP beyond the case record"); future actioning surfaces can layer on top.

## Notable detours

1. **API key not in DB when commit 9 first ran.** `lib/claude.ts` reads `Setting.apiKey` only. The local DB row had `apiKey = null`. Surfaced to user; user pasted via /settings. Resolved in one round-trip.
2. **Prisma blocked `db push --force-reset` for the mandate schema.** Built-in safety: AI agents cannot run destructive migrations without explicit user consent. Pivoted to nullable mandateJson; better outcome anyway (preserved Settings.apiKey and any token-budget customisation).
3. **TypeScript exhaustiveness on G2's target_category switch.** `case "pms"` and `case "aif"` are handled by the `SEBI_TICKET_RULES` lookup above the switch; TS still requires the cases or a default. Added unreachable `case "pms": case "aif":` with a fallback return; satisfies the type checker without altering behaviour.
4. **`runE*Case` ergonomic.** Initial design considered making each runE*Case handle both activated and non-activated paths. Settled on activated-only in the agent files plus a deterministic `buildNonActivationVerdict()` helper consumed by the orchestrator. Cleaner separation; avoids an LLM call for E5/E7 in cases where the non-activation reason is structural.
5. **S1's verdict at the Sharma quality gate.** S1 read `requires_clarification` rather than the orientation's expected `positive_with_caveat`. Initial concern that this was over-cautious; user inspection confirmed the read is correct (three simultaneous mandate gaps warrant clarification before approval). Shipped as the canonical demo verdict.

## Token usage empirical

Commit 9 live-mode pass on the Sharma + Marcellus case:

| Agent | Model | Input tokens | Output tokens |
|---|---|---|---|
| S1.case_mode | Opus 4.7 | 12,110 | 4,201 |
| A1.challenge | Opus 4.7 | 15,028 | 2,068 |
| **Total** | | **27,138** | **6,269** |

Per-agent input dominated by the case context + JSON-stringified evidence verdicts + gate results bundle. Total ~33k tokens for two LLM calls; well under the 250k per-case token budget. Estimated cost ~$0.89 at Opus pricing.

E1-E7 evidence verdicts were parsed from the lifted markdown file at zero API spend; G1/G2/G3 ran deterministically with zero tokens.

## What is functional, what is not

| Surface | State |
|---|---|
| New Case · Samriddhi 1 proposal intake | Functional |
| Pipeline (runProposedActionPipeline) | Functional under STUB_MODE for Sharma; falls back to live for non-Sharma if STUB_MODE=false |
| Case Detail · Outcome tab | Functional |
| Case Detail · Analyst Reports tab | Functional |
| Decision capture | Functional |
| Case List signal (stubbed cases) | Functional |
| Settings · Stub mode toggle | Functional with native confirm() modal |
| Case-mode briefing PDF | **Deferred** (Outcome tab is the primary surface; PDF export button hidden on s1 cases) |
| M0.IndianContext integration | **Blocked on Workstream C** (commit 3) |
| Live-mode generation for non-Sharma investors | Will run if STUB_MODE=false; verdicts informed by the LLM's world knowledge plus generic scope context (acceptable for MVP; richer scope-builders deferred) |
| Real-mode Sharma regeneration | DEFERRED item (would replace the hybrid stubs with end-to-end live reasoning) |

## Cross-references

- [DEFERRED.md](../../DEFERRED.md) — items deferred from Slice 3
- [NEXT_SLICE_PROPOSAL.md](../../NEXT_SLICE_PROPOSAL.md) — Slice 4 (IC1) framing
- [BUILD_ROADMAP.md](../../BUILD_ROADMAP.md) — overall slice progress
- [LIFT_INVENTORY.md](../../LIFT_INVENTORY.md) — Slice 3 lift of the verdicts file
