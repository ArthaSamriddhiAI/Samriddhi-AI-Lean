# Next slice proposal

## Recommended next slice: Slice 2, Samriddhi 2 reasoning and briefing PDF generation

### Why this slice next

Two paths are reasonable as the next focused slice (per the BUILD_ROADMAP):

1. **Slice 2.** Make the Samriddhi 2 diagnostic real: load the 21 lifted skill files into a small orchestrator under `/lib/agents/`, feed the snapshot JSON plus the investor profile into E1-E7 plus M0.Stitcher plus S1.diagnostic_mode, and replace the Shailesh Bhatt fixture with whatever the reasoning produces. The briefing PDF generation via React PDF lands in the same slice so the primary user-facing artifact is end-to-end functional.

2. **Slice 3.** Skip ahead to Samriddhi 1, the proposal evaluation workflow. Sharma plus Marcellus is the canonical example; the `sharma_marcellus_evidence_verdicts.md` file in the Factual Foundation folder is essentially a worked output. This is the demo's centrepiece (the EGA evidence framework is what makes Samriddhi feel real to advisors).

### Recommendation

Take **slice 2** before slice 3.

The orchestration runtime is load-bearing for both slices, and slice 2 builds the simpler version of it: linear evidence agents, deterministic activation, one synthesis layer, no governance gates, no IC1 deliberation, no A1 challenge. Slice 3's Samriddhi 1 path adds the conditional activation logic, the three governance gates, the IC1 sub-roles, and the A1 challenge layer on top of the same orchestration foundation. Walking slice 2 first means slice 3 inherits a proven runtime; walking slice 3 first means we are reaching for the demo's complex case while the runtime is still being shaken out.

The briefing PDF is also the higher-stakes user-facing artifact of the lean MVP. Slice 2 ends with a real PDF, generated from a real reasoning run, downloadable from the Case Detail screen. That is what an advisor takes into a meeting; it is the product's wedge.

If the demo target is closer than expected and slice 3 needs to be the dramatic moment, the BUILD_ROADMAP explicitly notes this ordering is reconsiderable. Both paths converge.

## Scope of slice 2

Concrete deliverables:

1. **Fixture distribution.** A `scripts/copy-fixtures.ts` (or shell script) that copies the 9 snapshot JSONs from the Factual Foundation folder into `fixtures/snapshots/`. The path is gitignored; the script makes setup reproducible without checking in 99 MB.

2. **Skill loader.** Read each `.md` file in `/agents/`, parse the YAML frontmatter (model, max_tokens, temperature, output_schema_ref), strip the frontmatter, and expose the prompt body as the system prompt for that agent.

3. **Orchestration shim.** One async function per evidence agent under `/lib/agents/`. The function takes a case context object (investor, snapshot, holdings) and returns the parsed output. M0.Router decides which evidence agents activate; M0.PortfolioRiskAnalytics computes the deterministic metrics first; E1-E7 run as appropriate; M0.Stitcher rolls up; S1.diagnostic_mode synthesises the briefing.

4. **Replace the new-case fixture.** When a Samriddhi 2 case is generated, run the actual reasoning pipeline. The case row stores the synthesised content; the Case Detail screen renders it (replacing the static Shailesh Bhatt fixture).

5. **Briefing PDF.** React PDF component that renders the seven-section briefing (foundation §6 spec) using the case content. The "Export briefing" button in the Case Detail toolbar generates and downloads the PDF.

6. **Loading state.** The wireframe has a designed "Generating briefing" screen with progress steps. Wire it up between New Case form submission and Case Detail redirect.

7. **Anthropic API budget guardrail.** Soft cap on tokens per case so a stray run does not burn ten dollars. Configurable in Settings, sensible default.

Out of scope for slice 2 (deferred to slice 3 or later):

- Samriddhi 1 (proposal evaluation) workflow.
- IC1 deliberation, A1 challenge, governance gates.
- Read-only chat panel (slice 6).
- Explorer dashboard (slice 5).
- Polish, accessibility, micro-interactions (slice 7).

## Open questions for slice 2

These come up at the slice boundary and are best resolved before starting:

1. **Streaming vs batch.** Should the reasoning pipeline stream observations to the UI as they surface (more responsive, more complex), or return the complete result and render at once (simpler, slightly less alive)? The 30-second target in the wireframe ("The briefing renders in about thirty seconds") suggests batch is acceptable; streaming is a slice 7 polish item.

2. **Skill file edits.** Should the lifted skill files in `/agents/` be edited for the lean MVP (max_tokens tuning, voice adjustments), or kept verbatim with edits done at runtime via parameter overrides? Latter is cleaner; former is simpler.

3. **Snapshot loader caching.** Snapshots are 11 MB JSONs. Loading them per-case is expensive. Should slice 2 build an in-memory cache, or rely on the OS file cache plus Node's import cache for now and revisit when a case takes too long to generate?

4. **Real Sharma family case.** Should slice 2 also generate a real Sharma family Samriddhi 1 case (the Marcellus proposal evaluation) for demo purposes, even though Samriddhi 1 is technically slice 3? The `sharma_marcellus_evidence_verdicts.md` file has the expected output; slice 2 could backfill a snapshot of it as a seeded case. Or wait for slice 3 to do it properly.

Resolve these in the slice 2 orientation document.
