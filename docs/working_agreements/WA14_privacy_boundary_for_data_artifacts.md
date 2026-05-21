# WA14: Privacy boundary for data artifacts

## Agreement

Data artifacts in this repository are classified by origin, not by content shape, when deciding whether they can be committed to the public repository:

- **Real-world-sourced data is private.** Data drawn from vendor feeds, exchange data, regulatory filings, scraped sources, paid databases, or any other external real-world source must not be committed to the public repository. It lives in the private samriddhi-ai-data-snapshots repository (or a successor private repository if the data-mirror architecture evolves).

- **Fictional and creative content is public.** Data invented for the project (fictional investor portfolios, fictional character bibles, fictional reasoning content, synthetic test fixtures) may be committed to the public repository.

## Rationale

This agreement was authored after the snapshot-data-extraction workstream (Phase B) surfaced that the public repository had been carrying proprietary real-world data (Nifty 500 per-stock fundamentals, MF/PMS/AIF metadata, macro indicators) that should never have been world-readable. The boundary the workstream landed on, after iteration, is *origin-based*: where did the data come from? Real-world-sourced data carries both licensing concerns (vendor redistribution terms) and proprietary-edge concerns (the curation effort that differentiates the product); fictional content carries neither. Encoding this distinction as a working agreement gives future contributors a concrete handle for the classification decision before they commit.

## Trigger

Apply this agreement whenever you are about to commit any of the following to the public repository:
- A new data file (.json, .csv, .tsv, .parquet, .xlsx, etc.)
- A code file containing inline data (e.g., a TypeScript file with hard-coded financial figures)
- An update to an existing file that introduces new data values
- A new snapshot block, evidence verdict, or any structured content with numeric figures

Before committing, ask:

1. **Where did this data come from?** A vendor, an exchange, a scrape, a regulatory filing, a paid database, a public benchmark? Treat as real-world-sourced; goes in the private repository.
2. **Was the data invented for the project?** Hand-authored, character-bible-consistent, synthetic, made-up-for-demo? Treat as fictional; goes in the public repository.
3. **Mixed or unclear?** Real fund names used in fictional portfolios are fine (the *use* is fictional even though the *name* is real). Real figures cited in case fixtures' reasoning prose are fine (citation-in-context per Position A from the s1-case-generation workstream). Heavy curation of public data is borderline; default to private when uncertain.

## Examples

| Artifact | Classification | Reasoning |
|---|---|---|
| Enriched snapshot with Reliance ROCE 9.69% from vendor | Real-world-sourced; private | External source, vendor data |
| Fictional investor Lalitha Iyengar's holdings | Fictional; public | Hand-authored for character bible |
| Case fixture citing "Reliance ROCE 9.69% (snapshot)" in evidence prose | Public | Citation-in-context, not bulk data |
| MF list with names but no figures | Public | Names are public information |
| Curated subset of Nifty 500 with hand-classified quality scores | Borderline; default private | Curation effort is proprietary even if base is public |
| Synthetic snapshot generated to mimic real data shape | Public, marked "synthetic" | Origin is generative, not real-world |

## Escalation

When you cannot confidently classify an artifact:

1. **Default to private.** Move the file to the private repository and fetch via the established setup pattern (see ADR-0027).
2. **Surface the classification question** in the workstream's audit doc, handoff, or to the planning chat for resolution. Document the rationale chosen.
3. **Open a debt entry** if the classification borderline reveals an architectural gap (e.g., a category of data the boundary doesn't cleanly handle).

Never commit ambiguous data to the public repository while the classification question is open.

## Enforcement

This working agreement is currently enforced through reviewer discipline. Future P-debt entry may add automated enforcement: a pre-commit hook or CI check that flags new files in data-suggestive paths (`db/fixtures/`, `fixtures/`, etc.) and requires explicit acknowledgment of the classification before commit lands.

## Cross-references

- ADR-0027 (snapshot data access via private-repo releases-as-assets), the consumer side of the privacy boundary.
- Private repo's ADR-0001 (data publication via versioned GitHub releases), the producer side.
- WA13 (Samriddhi 1 / Samriddhi 2 naming discipline), established naming hygiene in the same workstream lineage.
- P30 (real-client mode preconditions), the real-data-era successor to WA14's fictional-data-era boundary.
- The snapshot-data-extraction workstream's audit and handoff docs.

## Related debt

- DM1 (refresh cadence frozen) in the private repo's debt log: when refresh cadence is implemented, this WA applies to the refresh process too.
- DM2 (assembly methodology) in the private repo's debt log: the methodology documentation should reinforce this boundary.
- Future P-debt entry for automated WA14 enforcement tooling (parallel to P28 for WA13 enforcement).
