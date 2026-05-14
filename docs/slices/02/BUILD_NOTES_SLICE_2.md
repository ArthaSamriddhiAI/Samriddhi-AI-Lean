# Slice 2 build notes

What landed in the diagnostic-reasoning slice, what was deviated from the orientation, what was decided autonomously, what was deferred, and the notable detours encountered on the way.

## Stack decisions confirmed

- TypeScript orchestration runtime under `/lib/agents/` with one file per agent (E1-E7, M0.PortfolioRiskAnalytics, M0.Router, M0.Stitcher, S1.diagnostic_mode). Direct Anthropic SDK calls; no LangGraph. The skill files in `/agents/` stay byte-identical on disk; all tuning happens at runtime via `LEAN_RUNTIME_OVERRIDES` in `lib/agents/skill-loader.ts`.
- Deterministic-vs-LLM split: M0.PortfolioRiskAnalytics + M0.Router + M0.Stitcher run in pure TypeScript with no LLM call. Evidence agents and S1 are LLM. Every observation in the briefing carries a `source` tag (`metric` / `interpretation` / `hybrid` / `evidence_agent`).
- Snapshot loader: module-scoped Map with LRU eviction, capacity 3, anchored at `fixtures/snapshots/`. Empirical cold-load 50 ms, warm hit 0 ms.
- Skill loader: hand-written YAML frontmatter parser; the format is flat enough not to warrant `gray-matter`.
- React PDF (`@react-pdf/renderer` 4.1) for the briefing export. Built-in Times-Roman / Helvetica / Courier fonts; design-font upgrade deferred per DEFERRED.md item 4.
- Foundation §6 seven-section briefing structure is the lean MVP's `BriefingContent` shape, distinct from `s1_diagnostic_mode.md`'s authored output schema. Implemented per orientation Q2 as a runtime override: skill body used unchanged as the system prompt; user prompt instructs the seven-section schema.

## Persistent case fixture pattern

The architectural anchor for Slice 2 and everything that follows.

Cases produced by the real reasoning pipeline cost real API spend (roughly Rs 260 for the Shailesh case at tier-1 Sonnet + Opus pricing) and must not be lost to a `db:reset` or "Clear demo data". They are serialised to disk as JSON fixtures and loaded back by the seed.

Three pieces:

1. `scripts/export-case-fixture.ts` reads a `Case` row by ID, parses `contentJson` and `tokenUsageJson` into nested objects (for human-readable fixtures), writes the full row shape to `db/fixtures/cases/<caseId>.json`.
2. `db/fixtures/cases/c-2026-05-14-bhatt-01.json` is the first fixture produced (130 KB, includes briefing, deterministic metrics, all evidence-agent verdicts, router decision, token usage, original `frozenAt`).
3. `db/seed.ts` reads every `*.json` under `db/fixtures/cases/` and upserts each as a Case row. The fixture's `frozenAt` is preserved exactly. Idempotent: re-running the seed produces the same database state.

The post-funding five-case batch (DEFERRED item 1) and Slice 3's Sharma case will follow the same pattern.

## Deviations from the orientation

- **Parallel evidence dispatch became serial.** The orientation specified `Promise.all` across activated evidence agents. Tier-1 Anthropic rate limit on Sonnet (10k input tokens per minute) trips immediately on parallel dispatch (six agents at roughly 6k input each = 36k tokens fired in <1 second). Refactored to serial dispatch in `lib/agents/pipeline.ts`. Each call is 60-90 seconds; full pipeline is roughly 10 minutes per case. Reverted when tier 2 unlocks per DEFERRED item 2. The `EvidenceBundle` / `UsageBundle` shape is unchanged so the revert is a one-line swap.
- **S1 stayed on Opus rather than swapping to Sonnet.** The orientation flagged the Slice 2 economics swap as forcing Sonnet across all evidence agents and S1. S1's input (roughly 15-25k tokens, the full stitched context) exceeds tier-1 Sonnet's 10k/min ceiling on a single call. Opus's higher tier-1 limit accommodates it. Cost increment is small (one Opus call per case among seven Sonnet calls). Reverted when tier 2 unlocks per DEFERRED item 3.
- **Smoke-test case wipe moved earlier.** The orientation listed it as commit 19 (token budget); the schema migration in commit 5 (structured-holdings) required `db push --force-reset` which wiped the smoke-test case as a side effect. Earlier than planned but the end state matches.
- **Per-agent `max_tokens` overrides came back.** The orientation's "demo economics saving is in the llm_model swap, not in starving the output budget" was right; my initial overrides starved output and triggered truncations on E7 (4000 → too low for 3 schemes) and S1 (5000 → too low for the full seven-section briefing). Final overrides: E2 5500, E6 9000, E7 6000, S1 8000. Other agents use skill-authored defaults.

## Autonomous decisions during the build

- **Structured holdings extension.** Added `Investor.holdingsJson` and seeded from a new `db/fixtures/structured-holdings.ts`. The orientation called this out; the implementation followed the proposal.
- **Pre-observation derivation in Stitcher.** Stitcher emits a `pre_observations` array with foundation §3 vocabulary candidates derived deterministically from the metrics (wrapper count, position flags, allocation drift, cash drag, liquidity gap). S1 confirms or rejects each candidate in synthesis. Avoids re-deriving these from raw metrics in the S1 prompt.
- **Snapshot-name matcher tightening (commit 18).** Gate 1 surfaced two false-positive matches (Motilal Oswal Value Strategy → Ethical Strategy; Aditya Birla Arbitrage Fund → Sun Life Large & Mid Cap). The matcher previously used first-two-distinctive-words; tightened to require all distinctive holding tokens to appear in the snapshot name. Verified post-cleanup: 6 of 6 investors resolve every MF cleanly; only PMS and AIF wrappers remain unmatched per foundation §3 opacity.
- **Structured-holdings name corrections.** Aligned four labels to snapshot reality: "Axis Bluechip Fund" → "Axis Large Cap Fund" (post-SEBI rebrand), "ICICI Pru Balanced Advantage Fund" → "ICICI Prudential Balanced Advantage Fund" (full name match), "Motilal Oswal Value Strategy PMS" → "Motilal Oswal Value Migration PMS" (the closest real strategy in snapshot), "Aditya Birla Arbitrage Fund" → "HDFC Arbitrage Fund" (no Aditya Birla arbitrage fund exists in the snapshot). The existing Shailesh case retains the pre-cleanup labels per the "frozen artefact" semantics.
- **Generating-screen retry kept simple.** Per orientation Q6: retry resets `status` to `generating`, clears `errorMessage`, runs the full pipeline from scratch. No partial-step recovery, no exponential backoff. Documented as Slice 7 polish.
- **Opus 4.x temperature handling.** Opus 4.x (4.5 / 4.6 / 4.7) rejects `temperature` on `messages.create` with `invalid_request_error`. The harness detects this and omits temperature for any `claude-opus-4-*` model. Skill files keep `temperature` for documentation; the harness honours it only where the model supports it.
- **Currency render-time substitution.** The underlying data layer keeps "Rs" verbatim (foundation, seed strings, LLM-generated content). `lib/format/rupees.ts` substitutes "Rs <digit>" → "₹<digit>" at rendering boundaries. Required a tighter regex with a digit lookahead to avoid clobbering unit labels like "Rs Cr" in column headers.

## Notable detours

In rough chronological order, the things that took longer than expected:

1. **Initial pipeline failed at parallel dispatch due to tier-1 rate limit.** Logged as a 429 with the explicit "10,000 input tokens per minute" message. Refactor to serial dispatch took roughly an hour.
2. **E7 hit `max_tokens` mid-JSON on first end-to-end run.** Output truncated at 4000 tokens for 3 schemes. Bumped to 6000.
3. **S1 rejected `temperature` on Opus 4.7.** Harness fixed to omit temperature for the Opus 4.x family.
4. **S1 hit `max_tokens` at 5000.** Seven-section briefing is substantial; bumped to 8000.
5. **PDF page-number `render` prop produced no output.** Worked around with static right-side footer; deferred to DEFERRED item 5.
6. **Gate 1 surfaced data-integrity flags from the LLM agents.** Motilal Oswal and Aditya Birla name mismatches were caught by the agents themselves and reported in the briefing's `coverage_note`. Surprisingly useful capability of the agents reading the snapshot data verbatim. Resolved in commit 18.

## Token usage empirical

Gate 1 Shailesh case, full pipeline:

| Agent | Input tokens | Output tokens |
|---|---|---|
| E3 (Sonnet) | 6,603 | 3,877 |
| E4 (Sonnet) | 3,917 | 2,445 |
| E1 (Sonnet) | 6,017 | 4,049 |
| E2 (Sonnet) | 3,048 | 3,789 |
| E6 (Sonnet) | 5,431 | 7,321 |
| E7 (Sonnet) | 5,144 | 5,969 |
| S1 (Opus) | 49,257 | 5,856 |
| **Total** | **79,417** | **33,306** |

Total roughly 113k tokens combined. Default token budget (250k) gives more than 2x headroom. S1's input dominates because it carries the full stitched context (all evidence verdicts + metrics + pre-observations).

Per-case cost at tier-1 pricing: roughly Rs 260 for this run (six Sonnet calls at roughly Rs 25-35 each, plus one Opus call at roughly Rs 110).

## What is functional, what is not

| Surface | State |
|---|---|
| New Case · Samriddhi 2 diagnostic intake | Functional; triggers pipeline |
| Generating screen | Functional; polls /status; animated stage progress |
| Pipeline (E1, E2, E3, E4, E6, E7, S1, M0 deterministic) | Functional; serial dispatch |
| Case Detail · Analysis tab | Renders real briefing content from Case.contentJson |
| Case Detail · Briefing tab | Renders the seven-section structure for on-screen view |
| Case Detail · Export briefing PDF | Functional; streams via /api/cases/[id]/briefing.pdf |
| Case Detail · Share link | Disabled placeholder, Slice 7 |
| Case Detail · Chat panel | UI shell only, Slice 6 |
| Settings · Token budget per case | Functional |
| Investor profile rendering with ₹ | Functional |
| Case fixture seeding from db/fixtures/cases/ | Functional; one fixture (Shailesh) |
| Failed-case retry | Functional; resets status and re-runs pipeline |
| Five additional case fixtures | DEFERRED, item 1 |
| Parallel agent dispatch | DEFERRED, item 2 |
| S1 on Sonnet | DEFERRED, item 3 |
| Design-system fonts in PDF | DEFERRED, item 4 |
| Dynamic page numbering in PDF | DEFERRED, item 5 |

`npm run dev` starts cleanly. `npm run typecheck` passes. `npm run db:reset` + `npm run db:seed` restores the full demo state including the Shailesh case fixture.

## What I would have asked about with more time

- **Liquidity bucketing of listed equity.** Foundation §3 puts listed equity in T+30. The Slice 1 wireframe fixture used a different bucketing (Shailesh's T+30+T+90 displayed as 16.2% rather than the deterministic 40%). Followed the foundation; flagged to BUILD_NOTES_SLICE_1's "items I would have asked about" pattern.
- **Asset-class HHI thresholding.** Foundation §3 explicitly says asset-class HHI is informational only (not thresholded). The pipeline currently reports it without raising a flag. The Gate 1 case surfaced an asset-class HHI "Wrapper concentration" item in section 3 because the LLM read the structure as suggestive. Worked, but the foundation's "informational only" guidance is technically violated at the LLM layer. Worth a prompt-side discipline reminder in S1 for future cases.
- **PMS / AIF strategy-level naming in snapshot.** The snapshot's PMS records mostly use placeholder generic names ("Fund") with only AMC-prefixed real strategies for some. Look-through to specific PMS strategies is structurally weak. Would benefit from a richer PMS dataset; out of scope for the MVP per foundation §3 opacity convention.
- **Multi-snapshot test runs.** The orientation flagged the 9 snapshots as different test axes (rate cut at t3, bank shock at t5, RIL idio at t6, etc.). Slice 2 generated against t0 baseline only. Multi-snapshot regression is a Slice 5 + 7 topic.

## Items deferred to DEFERRED.md

Eight items live in `docs/DEFERRED.md` with paste-and-go trigger prompts. The two highest-value items to resume on funding clearance: item 1 (five-case batch) and items 2+3 (parallel + Sonnet reversion). Item 4 (font upgrade) is the Slice 7 polish that resolves the rupee-glyph rendering in PDFs.

## Closing note

Slice 2 closes with one canonical case (Shailesh) shipped end-to-end through real reasoning, persisted as a fixture, rendered as both analysis-tab content and a PDF, and reviewable by an advisor. The pipeline is intentionally simple under serial dispatch but mechanically correct; the rate-limit-driven debt items (DEFERRED 2, 3) are reversions, not redesigns. Slice 3 inherits a proven runtime and adds Samriddhi 1 on top.
