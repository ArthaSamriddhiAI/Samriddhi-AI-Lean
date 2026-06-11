# ADR-0053: Nine-cell vocabulary and render precedence for the model-portfolio surface

- Status: Accepted (2026-06-11, Package 10 build; WA30 disposition: net-new, classified at the build's propose stage)
- Context: Package 10 audit (`docs/audits/2026-06-11_package_10_model_portfolio_explorer_audit.md`, A4 and Part B BM1) and the ratified build kickoff ("build the nine-cell matrix render; classify any ADR it forces").

## Decision

1. **The cell vocabulary is the 3x3 enum the `Investor.modelCell` column already speaks**, formalised in `lib/explorer/cells.ts`: rows `aggressive | moderate | conservative`, columns `long_term | medium_term | short_term`, ids `<risk>_<horizon>` (the FR Entry 13.0 naming, which the live values `aggressive_long_term` and `conservative_medium_term` already follow). `"pending_mandate"` is recognised as the onboarding sentinel, displayed as "cell pending", never treated as a cell.

2. **The matrix renders state, it does not author it.** Per-cell firm-default content (bands, sub-sleeve splits, preferred lists) is deliberately NOT defined by this decision: no ratified per-cell band source exists on main (P43); the team's original Excel is a per-cell preferred FUND list, which is the deferred curation layer (audit BM3), not a band grid; and the house-view extension that would seed cell defaults is held with in-flight colleague work (P54). The surface therefore renders: the foundation section 2 reference content on the anchor cell (`aggressive_long_term`, `MODEL_BANDS`), investor membership chips per cell from `Investor.modelCell`, and an explicit "unauthored, pending P43" state on cells with no firm content. Authoring per-cell defaults is a future decision that belongs to the model-portfolio framework workstream and will supersede or amend this ADR's point 2 when it lands.

3. **Render precedence follows ADR-0032, stated once and displayed verbatim**: an investor's own mandate (explicit `target_pct` or band midpoint) governs wherever a mandate exists; the anchor cell's `MODEL_BANDS` are the no-mandate fallback; per-cell firm defaults, when they exist, will slot between the two (mandate over cell default over single-cell fallback). The conservative cells keep the foundation section 6 informational reframe (direct comparison is informational, not drift, for non-aggressive investors).

## Rationale

The kickoff ratified a nine-cell matrix render that "resolves P43", and the grounding shows P43's band framework cannot be rendered without authoring values that exist in no ratified source; authoring them in a render build would be a silent product decision (WA28). Formalising the vocabulary and precedence is the part that is real today and that any future framework data must key on; rendering the seven unauthored cells honestly is the audit's established honest-state pattern. P43 therefore narrows (the cell structure, membership, and resolution seam now exist in code and on screen) but stays open for the band framework itself.

## Consequences

- `lib/explorer/cells.ts` is the single home of the enum; future framework data (per-cell bands or splits) must key on these ids.
- The onboarding `"pending_mandate"` sentinel becomes visible product surface ("cell pending"); assigning a real cell at mandate capture is part of the future framework work.
- No schema change, no write path, no new comparison semantics: the operative comparison stays mandate-first per ADR-0032.

## Cross-references

ADR-0032 (explicit-target-or-midpoint mandate resolution; the precedence this ADR displays), ADR-0033/0036/0037 (the held house-view splits, P54), ADR-0034 (the funnel whose persisted output the surface renders), P43 (the open framework debt this narrows), P45 (parameter calibration), P54 (the hold), audit Part B BM1 to BM3 (the deferred build-missing scope). External reference: FR Entry 13.0 (Cluster 4, locked April 2026), the naming source.
