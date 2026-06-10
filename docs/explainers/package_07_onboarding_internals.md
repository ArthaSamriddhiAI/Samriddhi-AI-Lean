# How the onboarding internals actually work (Package 07, explanatory pass)

Written 2026-06-10 on `features/package-07`, against the code as built through commit 7a64323. This artifact explains mechanism so the onboarding stack stops being a black box. It deliberately makes NO safety claim about the PII layer; the adversarial assessment is a separate artifact, `docs/audits/2026-06-10_package_07_security_audit.md`.

**The B2 sanitiser source the reader should open directly: `lib/privacy/sanitiser.ts` (the whole layer is 188 lines), with its companion brand type in `lib/privacy/sanitised.ts` (23 lines).** Everything section 2 describes is those two files.

---

## 1. The B3 ingestion path: deterministic code, not a model

**Uploads are parsed by deterministic TypeScript, not by an LLM.** When a document enters the workbench (`/investors/onboard`), the server action (`app/investors/onboard/actions.ts`) looks at the file extension and dispatches to a hand-written parser. No network call of any kind happens during parsing; the entire path is local code that runs identically every time on the same bytes. Zero API spend, by construction, not by configuration.

### 1.1 The per-format adapters

| Format | Adapter | Mechanism |
|---|---|---|
| eCAS registrar PDF | `lib/ingestion/ecas-pdf.ts` | pdfjs extracts the text layer (positioned text fragments, not OCR; these PDFs are born-digital). Fragments are bucketed into lines by their y coordinate, lines are classified by regex: folio headers, transaction rows (date, description, amount, units, NAV, balance), fee rows, closing-balance fragments (units, NAV, market value, matched independently because they share a baseline with page footers), and wrapped fund-name lines are re-joined. The output is statement folios with full transaction ladders. |
| Spreadsheet (.xlsx) | `lib/ingestion/table-adapters.ts`, `parseXlsx` | SheetJS reads the workbook; the adapter scans for a header row by recognising name-like and value-like header cells, reads a unit multiplier declared in the header itself ("Value (Rs Cr)" versus "Value (Rs lakh)" versus bare numbers under a declared unit), and emits one holding per data row with its cell reference as provenance. |
| Columnar or two-line text (.txt) | `table-adapters.ts`, `parseText` | Conservative line patterns: columnar rows split on runs of whitespace; the banking-paste texture (a label line followed by "Current Value: Rs N") is paired explicitly; amounts parse through one shared `parseAmountInr` that understands Cr and lakh suffixes. |
| Email or meeting-notes prose (.md, email text) | `table-adapters.ts`, `parseText` | The most conservative tier. Holding-like lines must carry both a recognisable instrument keyword and a parseable amount; narrative sentences and totals are filtered. One deliberate addition (the Gate 2 ruling): a line that names a held asset together with an explicit no-valuation cue ("no valuation on file, never appraised") yields a VALUELESS row routed to the advisor-attested path in the workbench. Anything the prose adapter cannot ground lands in `warnings`, never in guessed numbers. |

### 1.2 The canonical envelope

Every adapter, regardless of format, emits the same shape: `ParsedDocument` (`lib/ingestion/types.ts`). Each holding and each statement folio carries per-field provenance (file plus page, line, or cell reference) and an explicit confidence: `exact` for structured cells and reconciled statement tables, `heuristic` for prose extractions. Heuristic rows are advisor-confirm in the workbench, never auto-accepted. Downstream code (the gate, the workbench, the canonical record builder) only ever sees this envelope, which is why a new format means a new adapter and nothing else changes.

### 1.3 The reconciliation gate

Nothing parsed is stored until it reconciles (`lib/ingestion/reconcile.ts`). The gate checks, per statement: unit ladders sum to printed closing balances; closing units times closing NAV ties to the stated market value; every fund label resolves against the snapshot universe through the same alias map the data generator uses; the statement's NAV basis equals the snapshot monthly series at the anchor month; and listing totals tie to stated totals. In the workbench this surfaces as the four gate tiles (totals tie, statement ladders, NAV basis, name resolution); the commit button refuses while any tile is red, and the server action re-runs the gate before writing, so a green client cannot be forged by the browser. Attested values (advisor recollections) are excluded from the totals-tie arithmetic and that exclusion is printed on the tile and in the commit summary; the security artifact and ADR-0051 cover why.

### 1.4 The LLM fallback: built, inert, and what it would cost

There is a designed escape hatch for documents the deterministic adapters cannot parse confidently: `lib/ingestion/llm-fallback.ts`. As built it CANNOT spend money:

- `buildIngestionFallbackRequest` only assembles the request object. Its parameter type is `SanitisedText`, a branded type that ordinary strings do not satisfy, so the compiler rejects any call site that has not passed the text through the sanitiser first.
- `runIngestionFallback` throws unconditionally. First it throws unless the environment carries an explicit opt-in (`SAMRIDDHI_ENABLE_LLM_INGESTION_FALLBACK === "approved-wa12"`); even with the opt-in, it throws at the wiring point, which is deliberately unimplemented. The file imports no Anthropic SDK at all, so there is no code path from this module to the network.
- Switching it on for real would therefore require writing new code under an explicit WA12 budget approval (tracked as debt T24), and each use would cost real dollars per document; the paper estimate in the security artifact puts a per-onboarding ceiling on that. The deterministic path currently parses the entire synthetic corpus without it, so the fallback may never be needed at all.

---

## 2. The B2 PII sanitiser: how it works as code

**Read it directly: `lib/privacy/sanitiser.ts` and `lib/privacy/sanitised.ts`.** Mechanism summary:

### 2.1 Two layers, in order: minimise, then tokenise

**Minimisation comes first and does most of the work.** `minimiseInvestorContext(pseudonymousId, structuredContext)` takes the structured investor object an agent would receive and DROPS identity-bearing keys entirely: `name`, `investorName`, `email`, `mobile`, `pan`, `address` and variants, `onboardingTranscript`, `identityStrings`. What remains (holdings, mandate, metrics, portfolio structure) passes through under an opaque `investorRef` pseudonym. The idea: identity should never enter prompt context at all, so for structured data there is nothing to tokenise.

**Tokenisation handles free text.** `sanitiseForPrompt(text, vault, knownIdentities)` processes any free-form string that legitimately must reach a model (a meeting note, a document body):

1. Known identities first. The caller supplies the identities it knows (the investor's name and its word variants, emails, mobiles, PANs, folio numbers, addresses). Longest surface form wins, so a full name is replaced before its individual words. Every replacement becomes a stable opaque token like `[PII-PERSON-1]`.
2. Pattern residue second. Five regexes sweep what is left: PAN format (`[A-Z]{5}\d{4}[A-Z]`), email addresses, bare 10-digit Indian mobiles (`[6-9]\d{9}`), Aadhaar-like 12-digit runs with optional spacing, and "Folio No: NNNNN" phrases.
3. Residual scan last. The same patterns run once more over the output; any survivor is reported in `report.residual`, which the caller can assert empty.

### 2.2 The vault and detokenisation

`PiiVault` maps each token to its original surface forms, in memory, on this machine. The same identity always gets the same token (stable across calls in one vault), so a model could reason about "[PII-PERSON-1]'s second folio" coherently. `detokenise` reverses the mapping for LOCAL render surfaces only; nothing that leaves the machine ever sees vault contents. When real client data exists, vault persistence belongs to the local-only private tier (ADR-0049, debt D16); no repository ever carries it.

### 2.3 The choke point and what "sanitised" guarantees at compile time

`SanitisedText` (`lib/privacy/sanitised.ts`) is a branded string type; the brand is minted by `_mintSanitised`, and the one legitimate minting call site is `sanitiseForPrompt`'s return. Model-facing surfaces (today: the inert ingestion fallback's request builder) take `SanitisedText`, not `string`. A developer who tries to hand raw text to such a surface gets a compile error, which is the "single choke point": there is exactly one function that turns raw text into something the LLM-facing types accept. The security artifact examines where this guarantee does and does not reach; this explainer only states the mechanism.

### 2.4 What "zero residue on the corpus" actually tested

`scripts/_verify-pii-sanitiser.ts` runs offline against the synthetic corpus and asserts, deterministically: known-identity stripping across every surface form (full names, name words, emails, mobiles, PANs, folios, address lines) on the corpus meeting notes and emails; pattern-detection of seeded residue (a PAN, a mobile, an Aadhaar-like number, an email) planted in text WITHOUT being supplied as known identities; token stability (same identity, same token); detokenisation round-trips; minimisation key-dropping including `onboardingTranscript` and `identityStrings`; and the residual scan returning empty on every corpus document after sanitisation. That is the precise meaning of the phrase "sanitises to zero residue on the corpus": on the eight statements plus listings plus notes plus emails of the SYNTHETIC corpus, after sanitisation, the five patterns find nothing. It is a regression net over fictional data, not a proof about all real-world text; the limits (lowercase PANs, formatted mobile numbers, bank account numbers, free-prose relatives and addresses) are catalogued as findings in the security artifact.

### 2.5 What the dormant LLM path would send, and what guarantees sanitise-before-send

If the fallback were ever wired and approved, the request body would be: a fixed extraction instruction, plus the document text AS SANITISED (tokens in place of identities), plus a strict JSON schema note; the model would see portfolio structure and amounts but tokens where identity was. The ordering guarantee is the type system: `buildIngestionFallbackRequest(sanitisedDocument: SanitisedText)` cannot be called with a raw string, and `SanitisedText` is only minted by `sanitiseForPrompt`. Sanitisation therefore happens before send as a compile-time property of the code as written, with the caveats (type erasure at runtime, brand forgeability by deliberate cast) examined adversarially in the security artifact.

---

## 3. Where each piece lives

| Concern | Path |
|---|---|
| Per-format adapters | `lib/ingestion/ecas-pdf.ts`, `lib/ingestion/table-adapters.ts` |
| Canonical envelope types | `lib/ingestion/types.ts` |
| Reconciliation gate | `lib/ingestion/reconcile.ts` |
| Inert LLM fallback | `lib/ingestion/llm-fallback.ts` |
| **B2 sanitiser (read this)** | **`lib/privacy/sanitiser.ts`** |
| SanitisedText brand | `lib/privacy/sanitised.ts` |
| Workbench pure core (merge, gate tiles, attested path, record build) | `lib/onboarding/build-record.ts` |
| Workbench UI and server actions | `components/onboarding/OnboardingFlow.tsx`, `app/investors/onboard/actions.ts` |
| Offline verification | `scripts/_verify-ingestion.ts`, `scripts/_verify-pii-sanitiser.ts`, `scripts/_verify-onboarding.ts` |

All of it runs offline; the only Anthropic SDK import in the application is `lib/claude.ts`, which serves the existing case-generation pipeline, not onboarding.
