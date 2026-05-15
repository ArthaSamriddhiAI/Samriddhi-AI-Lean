# Next slice proposal

## Recommended next slice, Slice 5, Model Portfolio and Data Explorer Dashboard

### Why this slice next

Slice 4 closed with the IC1 deliberation layer code-complete and the Sharma case rendering its sentinel state on both the Outcome and Analyst Reports tabs. The materiality threshold rule fires correctly; the five-role orchestrator runs four sequential steps and degrades gracefully to per-role sentinels under STUB_MODE without throwing on missing stubs. Live IC1 stub generation is deferred (DEFERRED item 12) pending API budget clearance; the architecture is real, demonstrable, and resumable as a single-shot operation.

What remains in the EGA framework: nothing. Slice 1 shipped the chrome; Slices 2-3 shipped the diagnostic and proposal workflows; Slice 4 shipped IC1. The next functional layer is the Explorer surface, which the Slice 1 chrome scaffolded as a coming-soon stub.

Slice 5 turns Screen 6 (Explorer) live. The Model Portfolio visualisation and Data Explorer Dashboard are the primary surfaces; firm-level customisation persistence and snapshot inspection round out the slice.

### Recommendation

Take **Slice 5** before Slice 6 (read-only chat) and Slice 7 (polish). With IC1's architecture in place, the demo's institutional credibility surface is complete; the Explorer is what closes the demo loop by showing the user the data the agents are reasoning over.

### Scope of Slice 5

1. **Model Portfolio visualisation.** The 65/25/7/3 split (Equity/Debt/Alt/Cash with sleeve breakdowns per foundation §4). Renders the indicative model as a stacked bar or pie with sleeve drill-down. Firms swap the indicative model for their own; persistence lives in `Setting` row or a new `FirmModelPortfolio` table.

2. **Data Explorer Dashboard.** Snapshot inspection surfaces: which holdings drive which observations, which snapshots are loaded, look-through coverage maps (named stocks vs aggregated weight; per-fund coverage percentage). Renders the existing fixture data; no new pipeline. Hooks to the case-detail Outcome tab so an advisor can trace an observation back to the underlying data.

3. **Investor-level mandate tweaks** (if foundation supports). The Slice 3 mandates are authored statically in `db/fixtures/structured-mandates.ts`. A firm should be able to amend the mandate per investor and have G1 re-evaluate cleanly. This is a UI on `/investors/[id]` plus a `mandateJson` write-back through the existing nullable column.

4. **Look-through coverage signal on Case Detail.** A small badge or footnote on the Outcome tab indicating coverage depth (named stocks for X% of look-through weight; aggregated weight for the remainder). Surfaces the honest provenance the agents already cite in their data-points-cited bullets.

### Single-screen scope

Slice 5's primary new surface is `/explorer`. Investor mandate tweaks land on `/investors/[id]`. The coverage signal is a small Case Detail accent. No new pipelines, no new agents; the slice is rendering + persistence + read-back.

### Open questions to resolve at Slice 5 orientation

1. **Model Portfolio firm-customisation persistence.** New table (`FirmModelPortfolio` with foreign key to `Setting`) or a JSON blob field on `Setting`? Recommendation: a JSON blob field for the MVP; a proper table only when multi-firm tenancy lands (not in scope).

2. **Investor mandate edit semantics.** Live edit with immediate G1 re-evaluation across existing cases (risk: existing case decisions become contradictory), or copy-on-write with a mandate revision history (more honest, more work)? Recommendation: copy-on-write with a one-row revision history; case G1 evaluations reference the mandate revision they were computed against.

3. **Look-through coverage data source.** The existing snapshot fixtures have per-fund stock weights; coverage is computable but the aggregation pattern (which stocks count as "named" vs "aggregated") needs locking. Recommendation: a stock counts as "named" if its weight in the look-through is at least 1.0%; aggregate the long tail.

4. **Snapshot management UI.** The Explorer could surface "which snapshot is loaded; when was it generated" or could keep that implicit. Recommendation: surface explicitly, with a sample-only "Refresh snapshot" button (disabled in the MVP; future slice wires it).

### Funding state at close

API budget remaining at Slice 4 close: approximately $1.54 in console (unchanged from Slice 4 open; no LLM calls fired during the slice). Slice 5 is also a no-LLM slice: rendering + persistence + read-back. Budget remains available for the deferred operations (DEFERRED items 7, 10, 12, 13) and for Slice 6 chat (which is read-only Q&A and will consume modest budget per query).

### Boundary protections (Slice 5 should not include)

- Live IC1 stub generation for the Sharma case. DEFERRED item 12; one-shot operation gated on budget clearance.
- Multi-investor IC1 deliberation cases. DEFERRED item 13.
- Real-mode Sharma case regeneration end-to-end. DEFERRED item 7.
- M0.IndianContext integration. Blocked on Workstream C YAML curation per DEFERRED item 6.
- Case-mode briefing PDF. DEFERRED item 8; pick up in Slice 7 or its own micro-slice.
- Snapshot refresh wiring. The Explorer surfaces snapshot status; the refresh button stays disabled in the MVP.
- Multi-firm tenancy in model-portfolio customisation. JSON blob on `Setting` for the MVP; a proper table when tenancy ships.

## Alternatives considered

- **Slice 6 (read-only chat) ahead of Slice 5.** Would activate the ChatPanel surface on Case Detail. Argument against: chat depends on having something to chat about; the Explorer surfaces the underlying data that the chat would reference. Ordering Explorer first keeps the demo coherent.
- **Live IC1 stub generation for Sharma instead of Slice 5.** Would resolve DEFERRED item 12 and complete the canonical demo's IC1 surface. Argument against: it is a single-shot operation gated on budget clearance, not a slice. When budget clears, the deferred operation runs in isolation; meanwhile the architecture is demonstrable on the sentinel state.
- **Slice 7 (polish) before Slice 5.** Would tighten the existing surfaces before adding new ones. Argument against: polish before the last functional layer (Explorer) lands creates rework if the Explorer's interactions touch the same surfaces.

Default is **Slice 5 (Model Portfolio and Data Explorer Dashboard)**. The Explorer is what closes the demo loop; with IC1 in place, no other functional layer remains in scope.
