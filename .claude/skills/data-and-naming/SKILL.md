---
name: data-and-naming
description: Use when committing data artifacts to the repository, naming the two Samriddhi workflows in prose, or curating or locking an investor persona. It enforces the data-privacy, naming-discipline, and persona-alignment working agreements so proprietary data does not leak, the workflow names stay unambiguous, and a new persona is reconciled to the snapshot before it is locked.
---

This skill implements three working agreements. Read the canonical text in the spec before relying on a paraphrase:

- `docs/working_agreements/WA14_privacy_boundary_for_data_artifacts.md` (origin-based privacy: real-world-sourced data is private, fictional content is public)
- `docs/working_agreements/WA13_samriddhi_1_2_naming.md` (write "Samriddhi 1" and "Samriddhi 2" in full in prose, not the bare short forms)
- `docs/working_agreements/WA26_persona_snapshot_alignment.md` (a new persona passes the snapshot-alignment check at exit 0 before it is locked)

## Operative steps

1. Before committing any data file or inline data, classify it by origin: real-world-sourced data (vendor, exchange, filing, scrape, paid database) is private and goes to the private snapshots repository; data invented for the project (fictional holdings, character-bible content, synthetic fixtures) is public. Default to private when unsure.
2. In prose artifacts (ADRs, audits, hand-offs, PR bodies, debt entries, commit messages), write the workflows as "Samriddhi 1" and "Samriddhi 2" in full. The bare short forms name the synthesis agents and slices, not the workflows; keep them for agent-layer contexts only.
3. When curating a new investor persona, run `npm run check:persona-snapshot -- --investor=<name>` and reach exit 0 before treating the persona as locked. The existing five personas are exempt (grandfathered, P40). Resolve a mismatch by renaming the holding to the matched snapshot record or logging the exception in the product debt log.

If your operative read here ever conflicts with the spec files above, the spec wins.
