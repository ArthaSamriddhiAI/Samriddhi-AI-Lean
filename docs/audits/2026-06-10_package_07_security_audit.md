# Package 07 security audit: the PII path, adversarially (plus two design proposals and a cost ceiling)

Written 2026-06-10 on `features/package-07` against commit 7a64323; read-only pass. Companion to the mechanism explainer `docs/explainers/package_07_onboarding_internals.md`, which describes how the layers work; this artifact asks where they fail.

**Scope framing, per the primary's context: the human tests onboarding with SYNTHETIC personas only, which carry no real PII, so nothing here blocks merging or testing synthetic-only onboarding. Every finding below is forward-looking: it gates the future day real client data flows through the system.** Severity is assigned on that future basis.

**Debt note (WA24).** The kickoff asks for deferred fixes to be logged as debt next-free-in-series, and separately constrains this pass to commit nothing beyond the two artifacts. Resolution: the entries are drafted VERBATIM in section 3, numbered at today's next-free positions (T25, T26, T27 after T24; the D and DM series are untouched). LANDED 2026-06-11 by the debt-landing pass: the three entries are now in `docs/debt/tech_debt_log.md` at exactly T25, T26, T27 (the numbers held; no renumber was needed), with the F5 fold in T25's acceptance criteria and T25 marked as the real-tier enablement workstream's opening task.

---

## 1. Part 1: adversarial findings on the PII path

### F1 (High): the choke point is opt-in, and the LIVE prompt path does not opt in

The `SanitisedText` brand guards exactly one surface: the inert ingestion fallback. The application's REAL model-facing path, the case-generation pipeline, does not pass through it and sends investor identity to the Anthropic API by construction:

- Every E-series evidence agent takes `investorName: string` and interpolates it directly: `` `investor: ${input.investorName}` `` (`lib/agents/e1-listed-equity.ts:87`, `e2-industry.ts:83`, `e3-macro.ts:82`, `e4-behavioural.ts:81`, `e6-wrappers.ts:73`, `e7-mutual-fund.ts:83`).
- The pipeline supplies it from the database row: `investorName: investor.name` at `lib/agents/pipeline.ts:228-243`, alongside the mandate and, for E4, the ENTIRE `investor.profileMd` character bible, which for a real investor is the most personal document in the system (family dynamics, behavioural history, stated-versus-revealed divergence).
- `minimiseInvestorContext` and `sanitiseForPrompt` have ZERO live consumers. The only importers of `lib/privacy/*` are the inert fallback and the two verify scripts.

Today this is harmless and even correct: the five personas are authored fiction, and their names are the keys the skills reason about. The day investor rows hold real people, running a case sends real names and a real behavioural dossier to an external API with no sanitisation, because the safe path exists but nothing routes through it. This is the gap between "a choke point exists" and "all prompt assembly passes through the choke point."

**Fix direction:** make the harness the enforcement point, not convention. `callAgent` (`lib/agents/harness.ts`) should accept `SanitisedText` for its prompt fields, so every agent compiles only when its prompt builder passed through `sanitiseForPrompt`; the pipeline supplies minimised context (`minimiseInvestorContext`) with the vault scoped per run, and the case render layer detokenises locally for display. Tier-aware relaxation is reasonable (synthetic-tier investors may pass names verbatim; the type-level gate then encodes the tier decision, see proposal 1). **Deferred; drafted as T25.**

### F2 (High): nothing catches a tier misclassification

`dataTier` on commit is a free choice in the workbench UI. Choosing `synthetic_public` for a real person triggers no check of any kind: no content heuristic, no known-fiction registry, no second confirmation. The B1 three-tier ruling makes tier the load-bearing privacy boundary (tier decides what may ever reach the public repo), and the boundary currently rests on a single unguarded click. The primary has already ruled the routing design (real-by-default with an explicit synthetic checkbox); proposal 1 in part 2 is the design for this. **Deferred; drafted as T26 and superseded in detail by proposal 1 when the primary ratifies it.**

### F3 (Medium): the pattern net has enumerable holes

`sanitiseForPrompt`'s residue patterns (`lib/privacy/sanitiser.ts:88-95`) are deliberately conservative, and the following realistic formats slip ALL of them when not supplied as known identities:

| Slips | Why |
|---|---|
| `aaapm1234b` (lowercase PAN) | PAN regex is uppercase-only, no `i` flag |
| `+91 98100 12345`, `98100-12345` | mobile regex demands a bare unseparated 10-digit run |
| Bank account numbers (9 to 18 digits) | no account-number pattern exists at all |
| `1234-5678-9012` (hyphenated Aadhaar) | the 12-digit pattern allows spaces, not hyphens |
| `Folio # 12345` / `folio no. 12345` variants | folio pattern requires the literal "Folio No:" texture |
| Free-prose identity ("my sister in Toronto", "Flat 4B, Brindavan Apartments, Mylapore", a DOB) | not pattern-detectable by design; stripped only when supplied as a known identity. The in-code comment records this honestly. |

The known-identity layer also depends entirely on the caller enumerating every surface form; a nickname or transliteration the caller did not supply passes through. **Fix direction:** normalise before scanning (case-fold and strip separators for the digit patterns), add an account-number pattern with a confirm-style guard, widen the folio texture, and treat `report.residual` as a HARD failure on any real-tier prompt rather than a report field. Names that are not supplied can only be caught by a local NER-ish pass or by human review of the exact outbound text; for the rare LLM-fallback case, proposal 2's consent screen showing the sanitised payload IS that review. **Deferred; drafted as T27.**

### F4 (Medium): raw identity concentrates in local stores that sit one wiring away from prompts

`onboardingTranscript` (full meeting prose), `identityStrings` (the workbench's captured PII strings, stored in `canonicalJson.provenance` to seed the future vault), attestation `attestedBy`, and `Setting.apiKey` all live in the same local SQLite file. None of this is wrong today (it is the local tier working as designed, and the minimiser's key-drop list already covers `onboardingTranscript` and `identityStrings` for the day it is used), but two consequences deserve eyes: (a) any future feature that passes investor rows into prompts wholesale inherits the transcript unless it goes through `minimiseInvestorContext`, which F1 shows is not yet enforced anywhere; (b) the dev database is one accidental `git add` away from a public commit; `db/dev.db` and `prisma/dev.db` are gitignored, which is the right control, and it should stay tested by the tier-routing build (proposal 1's export step never reads the DB wholesale). Severity Medium as a future-wiring hazard; no separate debt entry, folded into T25 and T26.

### F5 (Low): the inert fallback is genuinely unreachable as spend, but the brand is forgeable

Verified adversarially rather than asserted:

- `lib/ingestion/llm-fallback.ts` imports no SDK (its only import is the brand type); there is no code path from that module to the network. `runIngestionFallback` throws on the env gate and then throws again at the unimplemented wiring point. The app's sole SDK import is `lib/claude.ts`, reached only by the case pipeline. The WA12 bash hook's import-graph checker (`scripts/hooks/check-sdk-reach.mjs`) provides the same proof mechanically for script invocations, fail-closed.
- Type-only imports are erased at build time and cannot execute; the checker explicitly skips them, correctly.
- However, the `SanitisedText` brand is a compile-time convention, not a runtime guarantee: `_mintSanitised` is exported (and is already imported by `scripts/_verify-ingestion.ts` to build a test request), and any `as SanitisedText` cast forges it. At runtime the brand does not exist at all. So the guarantee is "a well-meaning developer cannot ACCIDENTALLY skip sanitisation," not "code cannot lie." **Fix direction, cheap:** a lint-grade check (the WA enforcement hook family is the natural home) that `_mintSanitised` and `as SanitisedText` appear nowhere outside `lib/privacy/` plus the named verify script; plus a runtime assert in the future live executor that re-runs the residual scan on the outbound payload (defence in depth at the moment of spend). Folded into T25's acceptance criteria.

### F6 (Low): operational leak surfaces around the prompt path

No `console.log` of prompts exists in `lib/claude.ts` or `lib/agents/harness.ts` today (checked). Raw agent responses and prompts do land in `AgentTrace`-style DB fields for the case screen, which is local-tier storage and fine, but any future "debug mode" that prints assembled prompts, or any error reporter that attaches request bodies, becomes a PII channel the moment F1 is fixed only partially. One sentence of discipline, recorded here so it is citable: outbound payload logging must go through the same sanitised values that were sent, never the pre-sanitisation text. No debt entry; a review-time rule.

### What this audit did NOT find

For completeness of the adversarial pass: no current code path sends investor data anywhere except the Anthropic API via the case pipeline (no analytics, no telemetry, no third-party calls); the onboarding stack itself makes zero network calls; the public repo's committed fixtures carry only synthetic personas; and the data repo's release assets carry market data, not investor data.

---

## 2. Part 2: the two design proposals (propose-only; nothing here is built)

### Proposal 1: synthetic-versus-real routing, real by default

Built to the primary's ruling: REAL is the default; SYNTHETIC requires an explicit per-investor opt-in every time; a forgotten checkbox must always over-protect.

**The UI control.** In the workbench commit step, replace the current three-tier choice with a single unticked-by-default checkbox:

> [ ] **This is a synthetic test persona, not a real person.**
> Ticking this marks every document, value, and note for this investor as fictional test data and makes it eligible for committing to the PUBLIC Samriddhi codebase repository on GitHub, where anyone with repository access can read it. Leave this box unticked for any real person: real client data stays on this machine only and never enters any repository.

The commit button re-states the consequence in its own label, so the decision is read twice: "Commit as REAL (local-only)" unticked, versus "Commit as SYNTHETIC (public, fictional)" ticked. No third state, no memory of the previous investor's choice, no bulk default.

**What the backend does per tier.**

- Unticked (REAL, the default): `dataTier = "real_local_only"`. The row, canonicalJson, holdings, transcript, and the future persisted vault live in local SQLite only. Nothing under `fixtures/` or `db/fixtures/` is written; no generator, exporter, or seed path may read these rows (enforced by the export step below operating from an explicit allow-list of synthetic ids, never from "everything in the DB").
- Ticked (SYNTHETIC): `dataTier = "synthetic_public"`, eligible for the SEPARATE export step that writes corpus or fixture files. Export is its own explicit action, never a side effect of commit, and it shows a file-level diff of exactly what would land in the repo before writing anything.

**The guardrails that catch a misclassification** (the design's point; ordered by strength):

1. **Default direction.** The failure mode of forgetting is always REAL: over-protection, zero cost. Reaching the public tier requires two affirmative acts (tick plus a differently-labelled commit button), and the export to repo files is a third.
2. **The known-fiction registry.** The synthetic corpus is generated, so every fictional identity string (names, PANs, emails, mobiles, folio numbers, the `identityStrings` of the eight personas plus future generated cohorts) is enumerable into a committed registry file regenerated alongside the corpus. On a SYNTHETIC-marked commit, every identity string captured from the documents must appear in the registry. Any unknown identity = hard block: the commit refuses with "this identity is not in the known synthetic registry; if this is a new fictional persona, regenerate the registry from the generator first; if it is a real person, untick the box." No override control exists in the UI; the only paths forward are the generator (for genuinely new fiction) or the real tier. Fail-toward-protection, mechanically.
3. **Likely-real content heuristics, advisory plus blocking tiers.** On synthetic-marked commits, run cheap local plausibility checks over the parsed documents and notes: a PAN whose fourth character is P with a fifth character matching the investor surname initial (the real-PAN texture), mobile numbers in currently-allocated Indian ranges, email domains with real MX-style TLD textures versus the corpus's reserved fictional domains, GPS-precise addresses, dates of birth. Any hit downgrades the commit to a block with the same two paths out. These run only on the synthetic branch; the real branch needs no convincing.
4. **Audit trail.** The tier decision, who made it, when, and the registry-check result are recorded in `canonicalJson.provenance`. A later "promote to public" is a new decision with the same gates, never an edit of the field.
5. **Repo-side backstop.** A pre-commit hook (the WA enforcement family) scans staged fixture files for identity strings NOT in the known-fiction registry and blocks the commit; this catches the human-error path that bypasses the app entirely (hand-editing a fixture).

**Failure analysis.** Forgotten tick on synthetic data: lands real-tier, invisible to the repo, mildly annoying, re-commit with the tick. Mis-tick on real data: guardrail 2 blocks at commit unless every identity string coincidentally matches known fiction (for the enumerable kinds this requires collision with generated values; for a real person's name colliding with a persona name, guardrail 3 and the export diff are the remaining nets, and the export step's human-reviewed diff is the last). The residual risk concentrates exactly where F3 lives: identity the system cannot recognise as identity. That risk is bounded by the registry being an allow-list (anything unrecognised blocks) rather than a deny-list.

### Proposal 2: the runtime LLM consent-and-estimate gate (WA12 as product)

**Trigger.** The deterministic adapters already mark their own failure honestly: a document that yields zero confident rows plus the route-to-fallback warning (the texture `_verify-ingestion` proves on the hard-prose email). That warning, on a real upload, becomes the gate's trigger. Nothing else changes: documents the adapters CAN parse never see the gate.

**The stop.** The workbench renders the document's row in a blocked "needs model assistance" state, with a consent card in place of parsed rows:

> Deterministic parsing could not read this document (N pages, M lines recognised, nothing confidently extracted). Reading it with Claude would send the SANITISED text shown below to the Anthropic API and cost approximately Rs X (USD Y) for this document with the configured model. Nothing is sent unless you proceed.

The card shows: the exact sanitised payload (expandable), which is both transparency and the human-review net F3 calls for; the model that would be used; the token-derived estimate; and two buttons, "Proceed (spend approx Rs X)" and "Decline." There is no remember-my-choice; consent is per document, every time, which is the WA12 grain.

**Where the estimate comes from.** Locally and deterministically: input tokens approximated from the sanitised text length (chars/3.5, the conservative factor for this corpus's numeric density), output tokens bounded by the fallback's extraction schema (a holdings listing, not a transaction ladder: ~25 tokens per plausible holding, capped), priced from a committed price table (`{model, inPerMTok, outPerMTok, asOf}`) that states its as-of date on the card. The table is versioned data, not a network lookup, so the gate itself spends nothing. A hard ceiling guard refuses to even offer consent above a configured per-document cap (suggested Rs 100) without a second styled confirmation.

**On proceed.** The runtime sets a per-document, per-session consent token (who, when, document hash, estimate shown) recorded into the eventual commit provenance; the executor (the today-unimplemented wiring point of `runIngestionFallback`) accepts only requests carrying a live consent token, replacing the env-var gate as the production control while keeping it for tests. The result enters the SAME reconciliation gate as any deterministic parse; model-extracted rows arrive as `heuristic` confidence, so they still demand advisor confirmation row by row before commit.

**On decline.** The document is marked "unparsed, declined model assistance" with its warning preserved in provenance; its rows simply do not exist. The advisor's paths forward are the existing manual ones: re-export the document in a parseable format, enter holdings through a listing file, or attest individual values through the Gate 2 advisor-attested path (who, when, basis note, amber forever, outside the totals tie). Declining therefore degrades gracefully to the workbench's existing honesty machinery rather than dead-ending the onboarding.

---

## 3. Drafted debt entries (to land next-free-in-series at the next write pass)

> | T25 | The sanitisation choke point is opt-in: the live case pipeline sends `investor.name`, the mandate, and the full `profileMd` to the API unsanitised (`lib/agents/pipeline.ts:228-243`, every E-agent's `investor:` prompt line), and `minimiseInvestorContext` / `sanitiseForPrompt` have zero live consumers. Required before any real-tier investor can have a case generated: the harness accepts `SanitisedText` prompt fields (tier-aware: synthetic tier may pass verbatim), pipeline supplies minimised context with a per-run vault, render detokenises locally; acceptance includes the brand-forgery lint (no `_mintSanitised` or `as SanitisedText` outside `lib/privacy/` plus the named verify) and a runtime residual-scan assert in the live executor. Gates future real-data use; harmless for synthetic personas. | High (future real-data) | Package 07 security audit (F1, F5) | The real-tier enablement workstream |
>
> | T26 | Tier routing has no misclassification guardrail: `dataTier` is a free UI choice and `synthetic_public` on a real person is accepted silently. Build proposal 1 of `docs/audits/2026-06-10_package_07_security_audit.md` once the primary ratifies it: real-by-default checkbox with plain-language consequence text, known-fiction identity registry as a commit-time allow-list (unknown identity = hard block, no override), likely-real content heuristics on the synthetic branch, separate diff-reviewed export step, tier decision in provenance, pre-commit fixture scan. | High (future real-data) | Package 07 security audit (F2, proposal 1) | The real-tier enablement workstream |
>
> | T27 | Sanitiser pattern-net gaps, enumerated: lowercase PANs, separator-formatted mobiles (`+91 98100 12345`), bank account numbers (no pattern exists), hyphenated Aadhaar, folio-texture variants, and the by-design free-prose limit (unsupplied names, addresses, DOBs). Fix: normalise (case-fold, strip separators) before the digit patterns, add an account-number pattern, widen the folio texture, treat `report.residual` non-empty as a hard failure on real-tier prompts, and route the rare fallback payload through proposal 2's show-the-payload consent card as the human net for the undetectable class. | Medium (future real-data) | Package 07 security audit (F3) | The real-tier enablement workstream |

---

## 4. The cost estimate: a paper ceiling for the LLM fallback

**Assumptions, stated.** Prices per million tokens, from the bundled Claude reference current as of 2026-05-26: Claude Sonnet 4.6 at USD 3 input / USD 15 output; Claude Opus 4.8 at USD 5 input / USD 25 output. Token approximation: characters / 3.5 (conservative for this corpus's numeric density). Document sizes MEASURED on the committed synthetic corpus (pdfjs text-layer character counts for the eight eCAS PDFs; extracted-text counts for listings and prose): eCAS 19,420 / 38,822 / 58,873 chars (min / median / max), xlsx listings 794 to 1,764 chars, text listings 1,264 to 3,250 chars, notes and emails 644 to 2,385 chars. Output sized to the BUILT fallback schema (`{rawLabel, valueInr, sourceLine}` per holding, a listing not a ladder): roughly 0.4K to 1.2K output tokens per document; prompt overhead about 1K tokens is inside the rounding. This is arithmetic, not a live call; no request was made.

**Per document:**

| Document | Input tokens | Sonnet 4.6 | Opus 4.8 |
|---|---|---|---|
| eCAS PDF, smallest | ~5.6K | ~$0.02 | ~$0.04 |
| eCAS PDF, median | ~11.1K | ~$0.05 | ~$0.08 |
| eCAS PDF, largest | ~16.8K | ~$0.07 | ~$0.11 |
| Spreadsheet or text listing | ~0.3 to 0.9K | under $0.01 | ~$0.01 |
| Email or meeting notes | ~0.2 to 0.9K | under $0.01 | ~$0.01 |

**Per onboarding** (one statement plus one listing plus one prose document, ALL routed to the fallback, which is already pessimistic):

- **Claude Sonnet 4.6: roughly $0.03 to $0.09, call it under 10 US cents (under Rs 10).**
- **Claude Opus 4.8: roughly $0.05 to $0.15, call it under 15 US cents (under Rs 15).**

**A deliberately harsher ceiling:** if a future schema demanded full-fidelity re-emission of the transaction ladder (~15K output tokens on the largest statement), the worst single document reaches ~$0.28 on Sonnet 4.6 and ~$0.46 on Opus 4.8, so even the unbuilt maximal variant stays under half a US dollar per onboarding document.

**Plainly: the deterministic path currently parses the entire corpus without the fallback, so the expected fallback cost of onboarding as built is $0.00; the numbers above are a contingency ceiling for documents the adapters cannot read, not an expected cost.**
