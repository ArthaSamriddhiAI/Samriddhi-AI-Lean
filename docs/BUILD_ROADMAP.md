# Build roadmap

The Lean Samriddhi MVP is a slice-by-slice build. Each slice gets its own Claude Code conversation with fresh context, focused on a coherent unit of work. Review gates sit between slices where artifacts are load-bearing for the demo (investor profiles in slice 1, the briefing PDF in slice 2 if the format needs sign-off). The slices land on a single `main` branch; nothing branches off until a slice needs a longer-running track.

## Slices

### Slice 1: Scaffolding (current, complete)

Project chrome, six screens, fixtures seeded, mock content rendering, Anthropic SDK plumbed but uncalled. Cases, Investors, and Settings are functional surfaces; Explorer is a coming-soon stub. Case Detail renders the Shailesh Bhatt fixture verbatim regardless of selected investor (the approved orientation Q5 option a). 14 commits from `chore: lift` through `feat: settings screen`.

Model: **Opus**.

### Slice 2: Samriddhi 2 reasoning and briefing PDF

The diagnostic engine becomes real. Loads the 21 skill files into a thin TypeScript orchestrator under `/lib/agents/`. M0.Router activates E1 through E7 as appropriate, M0.PortfolioRiskAnalytics computes the deterministic metrics, M0.Stitcher rolls up, and S1.diagnostic_mode synthesises the briefing. The fixture Shailesh content is replaced by real reasoning output. React PDF renders the seven-section briefing for download.

Fixture distribution script copies snapshot JSONs from the Factual Foundation folder into `fixtures/snapshots/`. Loading-state screen between New Case submit and Case Detail redirect.

Model: **Opus**.

### Slice 3: Samriddhi 1 happy path with real evidence agents

Proposal workflow goes live. The S1 New Case form (currently disabled) enables. M0 orchestrates E1-E7 in parallel with conditional activation; S1.case_mode synthesises; the three governance gates G1, G2, G3 fire deterministically against rules in the foundation document; A1 produces structured challenges. Sharma plus Marcellus becomes a real reasoning artefact, indistinguishable in shape from `sharma_marcellus_evidence_verdicts.md`.

Model: **Opus**.

### Slice 4: IC1 deliberation layer

When materiality thresholds fire (governance, severity, or specific construct combinations), IC1 activates. Five sub-roles deliberate inline: Chair, Devil's Advocate, Risk Assessor, Counterfactual Engine, Minutes Recorder. The deliberation surface renders inline in the Samriddhi 1 Case Detail screen with a collapsed-by-default reveal pattern.

Model: **Opus**.

### Slice 5: Model Portfolio and Data Explorer Dashboard

Screen 6 (Explorer) goes live. Model portfolio visualisation (the 65/25/7/3 split with sleeve breakdowns), firm-level customisation persistence (a firm can swap the indicative model for its own), investor-level mandate tweaks if the foundation document supports them. Snapshot inspection: which holdings drive which observations, look-through coverage maps.

Model: **Sonnet**.

### Slice 6: Read-only Q&A chat

Chat panel in Case Detail becomes functional. Constrained to answering from the frozen case content (no new analysis, no live data). Citations link to specific sections of the case. The pre-baked Q+A fixture from slice 1 retires.

Model: **Sonnet**.

### Slice 7: Polish

Error states, empty states, loading states, micro-interactions, accessibility audit (focus rings, ARIA, keyboard nav), copy polish. The `npm audit` issues from slice 1 clear during this pass. Settings PDF letterhead upload functional. Filter pills on Case List functional.

Model: **Sonnet**, occasionally Haiku for mechanical bits (renames, label tweaks).

### Slice 8 (optional): Landing page lift and adapt

Lift `/static/landing.html` from the full-fat repo, adapt to the lean design system. The full-fat landing uses Navy plus Gold plus Lato; the lean app uses Ledger Blue plus Source Serif plus Geist. Two reasonable paths exist (keep landing in its own register, or re-skin to match the app interior); resolve at slice start. The Design folder also ships an alternative marketing site that could substitute.

Model: **Sonnet**.

### Slice 9 (out of scope for the MVP): Deployment

AWS free tier or similar. Deferred until the product is demo-ready and stakeholders ask for a hosted link.

## Ordering note

Slice 2 versus slice 3 ordering is reconsiderable at the time we reach it. Slice 2 ships the wedge first (the briefing PDF is what an advisor takes into a meeting; it is the product's primary artefact). Slice 3 ships the demo's centrepiece first (the EGA framework with full evidence agents, governance gates, and adversarial review is what makes Samriddhi feel alive). Both reach the same destination. Default is slice 2 first because the orchestration runtime is simpler there and slice 3 inherits a proven runtime; if the demo's timing requires the centrepiece sooner, swap.

## Review gates between slices

Any slice may introduce review gates for artefacts that are load-bearing for the demo. Slice 1 used two: `LIFT_INVENTORY.md` (provenance of lifted files) and `PROPOSED_INVESTOR_PROFILES.md` (the six profiles before they touched the seed script).

Likely candidates in future slices:
- Slice 2: a review of the actual reasoning output for one or two archetypes before the rest are run, to catch issues in the agent skill compositions.
- Slice 2 or 3: the briefing PDF format, since the look of the document is the user-facing artefact.
- Slice 3: governance gate semantics (which rules fire when), because incorrect gating undermines the demo's credibility.

Use judgement per slice. Do not add gates for their own sake. Reach for them when the artefact has a high cost of being wrong and a low cost of being reviewed.
