# WA26: Persona holdings verified against the snapshot before locking

## Agreement

Every new investor persona's holdings must pass the persona-snapshot-alignment check (`npm run check:persona-snapshot -- --investor=<name>`) at exit 0 before the persona is treated as locked, that is, before it is seeded as a canonical investor and used to generate cases. Exit 0 means every checkable holding (PMS, AIF, mutual fund, or listed equity) strict-matches a category-consistent record in the snapshot universe. When the check exits 1, the curator resolves it before locking: either rename the holding to the matched snapshot record (the report prints the near-miss candidates so "did you mean X?" is answerable at a glance), or accept the mismatch knowingly and record it in the product debt log. Holdings with no snapshot collection (cash, FDs, bonds, gold, international, unlisted) are not checkable and do not block.

The five existing Samriddhi 2 personas (and the Samriddhi 1 Sharma persona) predate this check and carry a known, logged mismatch (product debt P40). They are exempt as historical fixtures and are NOT re-curated retroactively, because re-naming a persona holding forces a full case re-backfill at API cost. The gate applies from the next persona cohort forward.

## Provenance

During the A3 So-What Finding 2 build (T-5.12), wiring per-instrument operational metadata (PMS lock-in and exit-load, AIF SEBI category, tenure, redemption terms, and minimum commitment, mutual-fund exit-load) revealed that several persona holdings name product variants that are absent from the curated snapshot under a strict matcher: Bhatt's "Avendus Absolute Return Fund" (no Avendus Cat III AIF exists; an Avendus PMS variant exists but is a different product), "White Oak India Pioneers PMS", "Alchemy Smart Alpha 250 PMS", and the "Marcellus Consistent Compounder" singular-versus-plural near-miss. It also revealed that the name matcher could bind a holding to a wrong-category record: "Kotak Emerging Equity Fund" (a mid-cap fund) matched "Kotak Global Emerging Market Overseas Equity Omni FOF" (an overseas fund of funds), which a category-consistency guard now rejects.

A snapshot-integrity check confirmed the in-repo snapshot faithfully carries the clean source's full record set (the only divergence is enrichment), so the mismatch is persona-to-universe, not data loss in the repo. The lesson: the moment to reconcile a persona to the snapshot universe is at persona creation, cheaply, not after the cases are backfilled, when re-curation costs a full re-backfill. The utility `scripts/verify-persona-snapshot-alignment.ts` encodes the check; this agreement encodes the gate so the discipline is process, not memory.

## Cross-references

WA21 (verify before adding; this is the persona-creation analogue, read the live snapshot before locking a persona), product debt P40 (persona-universe mismatch, the historical exemption), product debt P41 (Kotak upstream verdict contamination, the separate E6/E7 matcher workstream), and the category-consistency guard in `lib/agents/operational-scope.ts` that the utility and A3 share.
