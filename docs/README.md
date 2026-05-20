# Lean Samriddhi MVP, build-process documentation

This folder holds the build-process documentation: roadmap, lift-inventory, the live next-slice proposal, the deferred-work backlog, and the per-slice artifacts (orientation, gate samples, build notes).

Code, configuration, and runtime artifacts live at the repository root; this folder is where the build process accumulates its history.

## Layout

- `decisions/`, Architecture Decision Records (ADRs), filename-numbered
- `audits/`, per-workstream institutional-memory audit docs
- `workstreams/`, cross-workstream hand-off and PR docs
- `working_agreements/`, the WA per-file records (one file per agreement; supersedes the deferred single conventions doc)
- `debt/`, the debt logs (`PRODUCT_DEBT_LOG.md`, `UI_UX_DEBT_LOG.md`)
- `reference/`, build-context docs referenced during work (product theses, schema diff, lift inventory, deferred backlog, next-slice proposal, M0 build notes)
- `slices/`, per-slice orientation, gate samples, and build notes
- root, orientation-level only (`README.md`, `QUICK_START.md`, `BUILD_ROADMAP.md`)

## Live state (always current)

- [BUILD_ROADMAP.md](BUILD_ROADMAP.md), the slice-by-slice plan
- [LIFT_INVENTORY.md](reference/LIFT_INVENTORY.md), provenance of files lifted from external sources
- [NEXT_SLICE_PROPOSAL.md](reference/NEXT_SLICE_PROPOSAL.md), recommendation and scope for the next slice
- [DEFERRED.md](reference/DEFERRED.md), structured backlog of items deferred from previous slices (with paste-and-go trigger prompts to resume)

## Per-slice artifacts

Each slice produces a small archive of orientation documents, review-gate samples, and the eventual build notes. Filenames preserve git history across the reorganisation; some were renamed at the boundary for consistency (e.g., the original `ORIENTATION.md` and `BUILD_NOTES.md` from Slice 1 are now `SLICE_1_ORIENTATION.md` and `BUILD_NOTES_SLICE_1.md`).

- [slices/01/](slices/01/), Slice 1: scaffolding
  - `SLICE_1_ORIENTATION.md`, the pre-work plan
  - `BUILD_NOTES_SLICE_1.md`, wrap-up notes
  - `PROPOSED_INVESTOR_PROFILES.md`, the seeded investor archetypes before they hit the seed script
- [slices/02/](slices/02/), Slice 2: Samriddhi 2 diagnostic reasoning and briefing PDF
  - `SLICE_2_ORIENTATION.md`, the pre-work plan
  - `PROPOSED_CASE_OUTPUT_SAMPLE.md`, Gate 1 review artifact (Shailesh diagnostic content)
  - `PROPOSED_CASE_BRIEFING_PDF.pdf`, Gate 2 review artifact (the briefing PDF)
  - `BUILD_NOTES_SLICE_2.md`, wrap-up notes
