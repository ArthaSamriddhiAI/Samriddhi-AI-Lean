# Workstream C: M0.IndianContext Reference Data, Closed

**Closure date:** May 17, 2026
**Deliverable location:** `agents/m0_indian_context/data/`
**Status:** All 9 steps closed; Slice 3 commit 3 unblocked.

## What landed

Six YAML knowledge stores plus README, totaling **107 entries** across the populated stores:

| Store | Version | Entries |
|---|---|---|
| `tax_matrix.yaml` | v1.1 | 36 |
| `sebi_boundaries.yaml` | v1.2 | 25 |
| `structure_matrix.yaml` | v1.0 | 11 |
| `demat_mechanics.yaml` | v1.0 | 15 |
| `gift_city_routing.yaml` | v1.0 | 8 |
| `regulatory_changelog.yaml` | v1.0 | 12 |

Cumulative citation distribution: **62 regulatory_circular (57.9%), 30 statute_section (28.0%), 8 practitioner_practice (7.5%), 7 web_verified (6.5%), 0 foundation_internal**. Confidence: 99 authoritative (92.5%), 8 indicative (7.5%).

## How M0.IndianContext consumes the data

M0.IndianContext is a rule-based agent (not an LLM agent) that produces factual framings by querying these stores against case context. Per the implementer quick reference in README §11: filter by `applicability` block, read structured `rule` fields, surface `confidence: indicative` entries with a flag, use `regulatory_changelog` for time-bounded lookups via `rule_pointer.affected_entries`, consult `structure_matrix.metadata.canonical_vocabulary.legacy_term_aliases` for cross-store filtering across pre-lock (Steps 2-3) and post-lock (Steps 4-7) stores.

## Curation approach summary

Each population step followed the same arc: web verification of every rate-specific value against authoritative source, population at the schema locked in Step 1 with the C2 citation taxonomy refinement, validation against the cumulative locked baseline. Two mid-curation audit cycles ran between population steps; two end-of-step audits ran at Steps 7 and 8. The dual-audit pattern (reasoning-based plus independent programmatic validation) cross-confirmed every numerical claim across four consecutive audit cycles.

## Items flagged as uncertain

Eight entries carry `confidence: indicative` reflecting practitioner-practice or non-codified framings. The seven framings worth flagging for production validation: PMS look-through tax treatment (pmlt_001, not codified in single statute section), hybrid/arbitrage MF classification (mf_004, AMFI practice), Cat III business income characterization (aif_005, fact-specific), and five demat_mechanics liquidity windows (dem_005 unlisted equity, dem_007 equity MF, dem_008 debt MF, dem_010 AIF, dem_012 PMS exit), all framed as practitioner observation per the Step 1 brief correction discipline (never frame "T+X" as statutory unless it actually is).

Deferred items per individual store curation notes: charitable trust Section 11 tax framework, senior citizen-specific slabs, RNOR routing patterns, OCI-specific rules, IFSCA PMS framework distinct from AIF, InvIT and REIT demat detail, G-Sec/T-bill demat via RBI Retail Direct.

## What this workstream did not do

This workstream produced reference data and the citation discipline framework, not the M0.IndianContext implementation code. It also did not validate the data against credentialed domain expert review; production deployment requires that validation per README §10. It did not extend the foundation document (which remains as advisory context with its own AI-curated provenance, not authority).

## Closed-out workstream sequence

| Step | Deliverable | Findings |
|---|---|---|
| 1 | Schema design | Three flags resolved (pms_ to pmlt_ rename; foundation_internal restriction; LRS factual correction; T+X liquidity-window framing) |
| 2 | tax_matrix v1.0 (36 entries) | Five new facts surfaced including Budget 2024 capital gains, Section 50AA, New Regime surcharge cap |
| 3 | sebi_boundaries v1.0 (25 entries) | Five new facts surfaced including AIOF, LVF threshold cut, SIF, InvIT, CIV |
| Audit 1 | Post-Step 3 audit | Caught sebi_019 citation reclassification AND HUF PMS eligibility error before propagation; v1.1 sebi_boundaries |
| 4 | structure_matrix v1.0 (11 entries plus canonical vocabulary lock) | HUF PMS correction applied; canonical structure-type vocabulary established |
| 5 | demat_mechanics v1.0 (15 entries) | MCA Rule 9B private company demat, SGB issuance suspension; liquidity-window framing discipline held in practice |
| 6 | gift_city_routing v1.0 (8 entries) | Budget 2026 TCS rationalisation; IFSCA AIF minimum reduction; three resident routing paths for US equity |
| Audit 2 | Post-Step 6 audit, 95 entries | Cross-confirmed clean across 14 separate counts; three pre-flagged items acknowledged not surfaced |
| 7 | regulatory_changelog v1.0 (12 entries) | Time-ordering issue caught and fixed in-cycle via two-pass renumbering; 51 inverse-references resolve |
| 8 | Cross-store consistency, 107 entries | Three patches applied in-cycle: tax_matrix v1.1 (sur_006 verification date), sebi_boundaries v1.2 (sebi_010 AIOF reframe, sebi_011 LVF sub-category) |
| 9 | Final package | This BUILD_NOTES, the README, six YAMLs at canonical path |

## Two reference-count calibration notes

**(1) Step 7 curation notes per-store count drift.** §3 of the Step 7 notes claimed "tax_matrix 18 entries, sebi_boundaries 18 entries" referenced by changelog `rule_pointer.affected_entries`. Independent validation returned 19 and 17 respectively. The total of 47 distinct entries reconciles either way; the per-store split was off by one in each direction. Documented for the record; no YAML change needed.

**(2) The 51 + 98 = 149 vs 111 figure.** The Step 8 report cites "51 rule_pointer.affected_entries references plus 98 distinct text-field references resolve" (total 149); a parallel validation totaled 111 reference instances when counting duplicates within entries. Both correct: 51+98=149 counts distinct entry-IDs referenced as targets; 111 counts reference instances including duplicates within source entries. Different slicings of the same graph.

## Two Slice 3 recommendations

**(a) Respect the v1.x version pins.** If implementation surfaces a need to amend a YAML entry, follow README §6 versioning convention: bump the store's version, add a `metadata.changelog` entry within the file, document the rationale here in BUILD_NOTES. Do not silently edit entries. The version pins are: tax_matrix v1.1, sebi_boundaries v1.2, structure_matrix/demat_mechanics/gift_city_routing/regulatory_changelog all v1.0.

**(b) The legacy_term_aliases block in `structure_matrix.metadata.canonical_vocabulary` is load-bearing for cross-store lookups.** Implementation that filters across both Steps 2-3 stores (legacy `investor_type` axis with 16 distinct pre-lock values) and Steps 4-7 stores (canonical `structure_type` axis with 14 values) must consult the alias table. Implementation tests should include cases that exercise the alias-based filtering path, especially for: `resident_individual` lookups (resolve to `individual + residency=resident`), `nri` lookups (resolve to `individual + residency=non_resident`), broad `trust` lookups (resolve to all trust sub-types), and broad `corporate` lookups (resolve to private_limited_company / public_limited_company / llp / partnership_firm).

---

**Workstream C closed.** Slice 3 commit 3 unblocked.
