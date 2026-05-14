# Next slice proposal

## Recommended next slice, Slice 3, Samriddhi 1 happy path with real evidence agents

### Why this slice next

Slice 2 closed with the diagnostic engine functional end-to-end: New Case → real reasoning → seven-section briefing → React PDF download. The Samriddhi 1 surface (proposal evaluation) is currently disabled in the New Case workflow selector. Slice 3 makes that surface real.

The canonical demo case is **Sharma + Marcellus**, per the BUILD_ROADMAP. The Factual Foundation folder ships a worked example at `../08 - Factual Foundation Continued/sharma_marcellus_evidence_verdicts.md` that defines the expected shape: E1-E7 verdicts on the Marcellus PMS proposal for the Sharma family, S1.case_mode synthesis, three governance gates fired, A1 challenge surfaced. Slice 3 produces a real Sharma + Marcellus case indistinguishable in shape from that worked example.

### Recommendation

Take **Slice 3** before Slice 4 (IC1 deliberation), Slice 5 (Explorer dashboard), and Slice 6 (read-only chat). The orchestration runtime from Slice 2 is the foundation; Slice 3 adds the conditional Samriddhi 1 layers on top:

- **S1.case_mode synthesis** (different output structure from S1.diagnostic_mode; the briefing for a proposal is verdict-shaped rather than observation-shaped)
- **G1 / G2 / G3 governance gates** (deterministic rules from the foundation document)
- **A1 adversarial challenge** (one structured pass after synthesis)
- **M0.IndianContext** (the tax/regulatory framing agent skipped in Slice 2 per orientation Q1)
- **Proposed-action intake form** (the currently-disabled S1 New Case form becomes functional)

IC1 (Slice 4) is layered on top of this; the materiality threshold check fires after governance and only escalates to IC1 when warranted. Slice 3 ships the happy path without IC1; Slice 4 wires the deliberation surface.

### Scope of Slice 3

Concrete deliverables:

1. **Samriddhi 1 New Case form** enabled. Inputs: investor (existing six), proposed product (free-text plus structured fields where applicable, e.g., ticket size, lock-in horizon), proposed action label (rebalance / new_investment / exit_position / etc. per the foundation's case_intent enum).

2. **M0.Router for proposed_action mode.** Activates the appropriate evidence vector. The Slice 2 router already handles diagnostic mode; extending to proposed_action follows the same skill specification.

3. **M0.IndianContext.** Activates on every proposed_action where tax structure is decision-relevant. Outputs structured framings (LTCG eligibility, indexation, NRE-resident conversion, HUF eligibility) that feed S1 and the governance gates.

4. **S1.case_mode synthesis.** A different output structure from S1.diagnostic_mode. Foundation §6 doesn't fully specify Samriddhi 1 briefing shape; will need to align with the verdict-style output that `sharma_marcellus_evidence_verdicts.md` exemplifies. Likely sections: proposal summary, evidence verdicts per agent, governance gate results, A1 challenges, S1 consolidated verdict, advisor talking points.

5. **G1 / G2 / G3 governance gates.** Deterministic per the foundation document. Fire after evidence agents complete. Each gate produces a pass / fail / requires_clarification verdict with structured rationale.

6. **A1 adversarial challenge.** One LLM call after S1.case_mode; produces structured challenges (questions or counterpoints that a critical reviewer would raise). Surfaces in the case detail.

7. **Sharma + Marcellus canonical case generation.** Generate via pipeline, export as `db/fixtures/cases/c-YYYY-MM-DD-sharma-NN.json`, seed loads it alongside the Shailesh fixture. The case becomes the demonstration centrepiece of Samriddhi 1.

8. **Case Detail rendering for Samriddhi 1.** New Analysis / Briefing tab structure for proposal evaluations. Distinct enough from the diagnostic tabs that a viewer immediately sees this is a different artifact type, but consistent enough in chrome that it feels like the same product.

### Single-case scope, no batch generation

Slice 3 generates **one** canonical case (Sharma + Marcellus) following the same fixture-export pattern as Slice 2's commit 19. Not a batch.

Reasoning:
- API budget remains constrained after Slice 2.
- Sharma + Marcellus is the canonical demo case; one well-tested run is more valuable than a batch of imperfect ones.
- Multi-investor proposal cases can land post-funding via a Slice 3-style DEFERRED item, following the established pattern.

### Out of scope for Slice 3

Deferred to later slices:

- **IC1 deliberation layer** (Slice 4). The five sub-roles (Chair, Devil's Advocate, Risk Assessor, Counterfactual Engine, Minutes Recorder) activate only on material cases. Slice 3's happy-path Sharma + Marcellus should not be material in the IC1 sense; the materiality check returns false and IC1 stays dormant.
- **Multi-snapshot regression** (Slice 5 / Slice 7).
- **Explorer dashboard** (Slice 5).
- **Read-only chat** (Slice 6).
- **Polish, accessibility** (Slice 7).
- **Resolution of Slice 2 DEFERRED items** unless they naturally land alongside (e.g., parallel dispatch reversion if tier upgrade happens during Slice 3 work).

### Open questions for Slice 3 orientation

These come up at the slice boundary and are best resolved before starting:

1. **S1.case_mode output shape.** Foundation §6 doesn't fully specify Samriddhi 1 briefing structure. The `sharma_marcellus_evidence_verdicts.md` worked example is verdict-style. Align on whether the briefing PDF follows the same seven-section structure as diagnostic (with sections renamed and repurposed), or adopts a different verdict-style layout. Trade-off: visual consistency across product surfaces versus structural fidelity to what proposal evaluation actually looks like.

2. **Governance gate determinism.** G1-G3 are deterministic per the skill files. The rules sit in the foundation document. Confirm the rule set is complete enough to implement without LLM fallback for Slice 3, or identify the ambiguity zones where LLM judgment is required.

3. **A1 placement.** A1 fires after S1 synthesis. Does A1's challenge feed back into S1 for a second-pass synthesis, or does it stand alone alongside S1's output (the briefing shows both)? Latter is simpler; former is more rigorous.

4. **M0.IndianContext timing.** The skill lifts cleanly. Does it activate before evidence agents (providing tax framing as context) or in parallel (so evidence agents reason without bias and IndianContext supplements)? Latter is closer to the foundation's evidence-independence principle.

5. **Sharma's existing holdings vs the proposed action.** Sharma currently holds 1 PMS + 1 AIF + 3 MFs + 2 FDs + savings (per Slice 1 seed). The Marcellus proposal is to add Marcellus Consistent Compounder PMS. This would take her PMS count from 1 to 2 (still under the 4+ wrapper threshold) and her wrapper-tier share from 18% to roughly 26%. The diagnostic shape is "additive concentration without breach" rather than the dramatic "wrapper over-accumulation" of Shailesh. Confirm this is the intended Slice 3 demo shape, or adjust Sharma's pre-proposal holdings to make the case more dramatic.

6. **DEFERRED resolution priority.** If tier upgrade clears during Slice 3, the parallel + Sonnet items (DEFERRED 2, 3) become easy wins. Confirm whether to fold them into Slice 3 or hold for a dedicated cleanup pass.

### Working principles to inherit from Slice 2

Slice 2's working principles transfer wholesale:

- Foundation §3 vocabulary discipline (no invented observation names; this extends to proposed_action vocabulary like `rebalance_proposal`, `new_investment`, `exit_position`).
- Source tagging on every observation (`metric` / `interpretation` / `hybrid` / `evidence_agent`).
- Deterministic-vs-LLM honesty boundary (governance gates are deterministic; A1 challenges are LLM).
- Persistent fixture pattern for every generated case.
- Skill files stay byte-identical on disk; runtime overrides handle tuning.
