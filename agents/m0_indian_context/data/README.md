# M0.IndianContext Reference Data

**Path:** `agents/m0_indian_context/data/`
**Workstream:** C, M0.IndianContext YAML Knowledge Store Curation
**Status:** Closed (Step 9 of 9), ready for Slice 3 commit 3 integration
**Version:** see §9 for per-store version pins
**Last curation pass:** May 2026

---

## 1. What this folder contains

Six YAML knowledge stores plus this README. The YAMLs are the deterministic reference data that M0.IndianContext consults during case execution to provide factual framings (Indian tax, structure-eligibility, SEBI rules, demat mechanics, foreign-routing constraints, and time-aware regulatory state) to evidence agents and governance gates.

| File | Version | Entries | Coverage |
|---|---|---|---|
| `tax_matrix.yaml` | v1.1 | 36 | Indian capital gains, surcharge, AIF pass-through, MF classification, NRI DTAA, indexation, PMS look-through, TDS |
| `sebi_boundaries.yaml` | v1.2 | 25 | PMS minimums and norms, AIF Cat I/II/III rules, AIOF/LVF framework, accreditation, SIF, recent revisions |
| `structure_matrix.yaml` | v1.0 | 11 | Individual, HUF, trust types, corporate types, NRI, US Person, senior citizen; PLUS canonical structure-type vocabulary lock |
| `demat_mechanics.yaml` | v1.0 | 15 | Demat eligibility by asset class, IPO lock-ins, pledgeability, typical liquidity windows |
| `gift_city_routing.yaml` | v1.0 | 8 | LRS framework, NRE/NRO/PIS routing, GIFT City IFSCA, US-listed equity routing, FATCA constraints |
| `regulatory_changelog.yaml` | v1.0 | 12 | Time-aware index of regulatory events 2019-2026 affecting case reasoning |
| **Total** | | **107** | Across six populated stores |

## 2. Indicative not validated: the canonical trust posture

This reference data is **indicative for demonstration purposes; not validated by credentialed domain experts as a whole**. Each entry's `citation_source_type` discloses its trust posture per the five-tier taxonomy in §4 below.

Production deployment requires the firm's compliance team to validate, supplement, or replace entries before reliance. The citation infrastructure (taxonomy, trust tiers, audit trail, controlled vocabularies, inverse-reference pattern) ships intact and remains useful regardless of which entries the firm validates or replaces.

The same canonical disclosure phrase appears verbatim in every store's `metadata.disclosure` field for byte-level consistency.

### 2.1 Cumulative citation distribution across 107 entries

| `citation_source_type` | Count | Share |
|---|---|---|
| regulatory_circular | 62 | 57.9% |
| statute_section | 30 | 28.0% |
| practitioner_practice | 8 | 7.5% |
| web_verified | 7 | 6.5% |
| foundation_internal | 0 | 0.0% |

Confidence split: **99 authoritative (92.5%)**, **8 indicative (7.5%)**. The 8 indicative entries are all explicit `practitioner_practice` framings on non-statutory liquidity windows or established practice (PMS pass-through, hybrid/arbitrage MF classification, Cat III business income characterization). No entry uses `foundation_internal`.

## 3. Entry ID conventions

Each store uses a short prefix matching its rule type, with a three-digit sequence. IDs are unique across all six stores (zero collisions) and immutable once published.

| Store | Section | Prefix | Range |
|---|---|---|---|
| tax_matrix.yaml | capital_gains | cg_ | cg_001 to cg_007 |
| | surcharge | sur_ | sur_001 to sur_006 |
| | aif_passthrough | aif_ | aif_001 to aif_005 |
| | mf_classification | mf_ | mf_001 to mf_004 |
| | nri_treaty | nri_ | nri_001 to nri_005 |
| | indexation | idx_ | idx_001 to idx_003 |
| | pms_lookthrough | pmlt_ | pmlt_001 to pmlt_002 |
| | tds | tds_ | tds_001 to tds_004 |
| sebi_boundaries.yaml | flat list | sebi_ | sebi_001 to sebi_025 |
| structure_matrix.yaml | flat list | str_ | str_001 to str_011 |
| demat_mechanics.yaml | flat list | dem_ | dem_001 to dem_015 |
| gift_city_routing.yaml | flat list | gcr_ | gcr_001 to gcr_008 |
| regulatory_changelog.yaml | flat list | chg_ | chg_001 to chg_012 |

The `pmlt_` prefix for PMS look-through avoids collision with the `pms_` substring used elsewhere in the build (e.g., PMS sub-category vocabulary in `structured-holdings.ts`).

## 4. The five-tier citation taxonomy

Each entry carries a `citation_source_type` field with one of five values, plus a structured `citation` field naming the authority and a `confidence` enum.

| `citation_source_type` | When used | Confidence | Acceptable for rate-specific entries? |
|---|---|---|---|
| `statute_section` | Income Tax Act 1961, Companies Act 2013, Income Tax Act 2025, Finance Act, etc. with specific section | authoritative | Yes |
| `regulatory_circular` | SEBI/RBI/IFSCA/MCA/CBDT circulars and master circulars with notification date | authoritative | Yes |
| `web_verified` | Authoritative public source on a government domain (sebi.gov.in, incometax.gov.in, incometaxindia.gov.in, rbi.org.in) with explicit verification date | authoritative | Yes |
| `practitioner_practice` | Established practice where statute is silent; named source required | indicative | Only where statute is silent |
| `foundation_internal` | Project foundation documents (AI-curated, unvalidated) | indicative | **No** (locked rule) |

### 4.1 Convention on web_verified citations

Every `web_verified` citation must include both:
- The source URL or domain on a government TLD
- An explicit verification date in `verified YYYY-MM-DD` format

Example: `"incometax.gov.in/iec/foportal/help/individual/return-applicable-1 verified 2026-05-14"`

This is the discipline locked at audit cycle 2 (§6.1) and reinforced at Step 8 (sur_006 patch).

### 4.2 Why `foundation_internal` is restricted

The project foundation documents (`pms_aif_advisory_reference_v2.md`, `constraint_cascade_analysis.md`, etc.) are AI-curated and have not been validated by credentialed domain experts. Citing the foundation as primary authority for a rate-specific rule would create a circular audit trail. Across the 107 entries, `foundation_internal` is used zero times; the ideal state holds vacuously and on intent. Where foundation document material informs an entry, the reference appears in the `notes` field as cross-reference, not in the primary citation.

### 4.3 The legacy term aliases block

`structure_matrix.yaml.metadata.canonical_vocabulary.legacy_term_aliases` provides the cross-reference between pre-Step-4 investor_type terms (used in `tax_matrix.yaml` and `sebi_boundaries.yaml`) and the canonical post-Step-4 structure_type vocabulary:

| Legacy term | Canonical mapping |
|---|---|
| `resident_individual` (tax_matrix.tds_001) | individual + residency=resident |
| `nri` (tax_matrix.nri_001 to nri_005) | individual + residency=non_resident |
| `trust` (sebi_001, pmlt_001 broad investor lists) | includes all trust sub-types |
| `corporate` (sebi_001 broad investor list) | includes private_limited_company, public_limited_company, llp, partnership_firm |
| `family_trust` (sebi_017) | aligned with canonical family_trust |
| `domestic_company_normal_tax` (tax_matrix.sur_006) | aligned with private_limited_company / public_limited_company under normal tax regime |

M0.IndianContext implementation that filters across both pre-lock stores (tax_matrix, sebi_boundaries) and post-lock stores (structure_matrix, demat_mechanics, gift_city_routing, regulatory_changelog) must consult this aliases block to resolve lookups correctly.

## 5. The common envelope

Every entry across all six stores carries the same 8-field envelope:

```yaml
- entry_id: <prefix>_<NNN>
  topic: "short human-readable description"
  applicability:
    <structured filter fields per store>
  rule: <or change_summary for regulatory_changelog>
    <structured rule body, NOT prose>
  citation_source_type: <one of five tiers>
  citation: "specific authority with section/date/URL+verification_date"
  effective_date: "YYYY-MM-DD"
  confidence: <authoritative | indicative>
  notes: "cross-references, caveats, worked examples"
```

The `notes` field is optional in principle but present on 100 percent of entries across the 107-entry inventory; capturing surrounding context proved load-bearing in practice.

## 6. Versioning convention

Each store carries `metadata.version` (semver-style major.minor) and a `metadata.changelog` block listing version history with date and rationale per bump.

- **v1.0**: initial population
- **v1.1**: in-cycle audit fix that does not change rule substance (e.g., citation reclassification, verification date addition)
- **v1.2**: cross-store consistency refinement that updates an entry's framing without changing the rule itself (e.g., AIOF unification)
- **v2.0**: schema-level revision (none in this workstream)

If implementation work surfaces a need to amend a YAML entry, the path is: bump the store's version, add a metadata.changelog entry within the file, document the rationale in BUILD_NOTES. Do not silently edit entries.

## 7. Curation methodology and discipline scorecard

### 7.1 Three modes of curation per step

Each of Steps 2 to 7 (the six population steps) followed the same arc:

1. **Web verification** of every rate-specific value against authoritative source; verification date captured in citation when `web_verified`
2. **Population** of entries at the schema locked in Step 1 (refined per the C2 citation taxonomy response and the Step 4 vocabulary lock)
3. **Validation** against the cumulative locked baseline; in-cycle fixes for anything failing discipline

### 7.2 Two mid-curation audit cycles

The workstream ran two formal mid-curation audit cycles between population steps:

- **Audit cycle 1 (post-Step 3, 61 entries):** Caught sebi_019 citation misclassification (web_verified vs regulatory_circular) AND surfaced the HUF PMS eligibility error that would have entered structure_matrix incorrectly. Both errors caught before propagation.
- **Audit cycle 2 (post-Step 6, 95 entries):** Cross-confirmed against parallel programmatic validation across 14 separate counts. Zero new findings. Three pre-flagged items acknowledged and not surfaced as new findings. Discipline holding under cumulative load.

Plus two end-of-step audits at Steps 7 (12-entry changelog deliverable; caught time-ordering issue, fixed in-cycle) and 8 (107-entry cross-store consistency; three patches applied in-cycle for sur_006 verification date, sebi_010 AIOF reframe, sebi_011 LVF sub-category).

### 7.3 The twenty-discipline scorecard

The workstream's locked discipline checks, all holding under the final 107-entry cumulative load:

| # | Discipline | Source |
|---|---|---|
| 1 | Five-tier citation taxonomy | C2 |
| 2 | foundation_internal restriction (no rate-specific) | C2 |
| 3 | Common envelope (8 fields) | Step 1 |
| 4 | Indicative-not-validated disclosure | Step 1 / C2 |
| 5 | Confidence alignment with citation_source_type | Step 1 |
| 6 | Entry ID prefix discipline + uniqueness | Step 1 / C3 |
| 7 | Canonical structure_type vocabulary | Step 4 |
| 8 | Residency 3-value axis | Step 4 |
| 9 | Legacy investor_type alias | Step 4 |
| 10 | rule_dimension enum (4 values) | Step 5 |
| 11 | Liquidity-window framing discipline | C2 / Step 5 |
| 12 | LRS factual correction (USD 250,000) | C2 / Step 6 |
| 13 | Time-ordering in changelog | C10 / Step 7 |
| 14 | Inverse-reference via rule_pointer.affected_entries | Step 1 / C10 |
| 15 | Cross-store references in notes resolve | Audit Cycle 2 |
| 16 | Multi-event source entries reflect most-recent regime | Step 8 |
| 17 | AIOF / LVF unification | Step 8 |
| 18 | Web_verified verification-date convention | Audit Cycle 2 / Step 8 |
| 19 | Dash compliance (no em/en/bar dashes) | User preference |
| 20 | Banned phrases (no "best judgment for demo" in citations) | C2 |

### 7.4 Step 8 cross-store consistency check outcomes

Three patches applied in-cycle at Step 8:

| Patch | Severity | Description |
|---|---|---|
| tax_matrix v1.0 to v1.1 | Discipline | sur_006 web_verified citation augmented with verification date (2026-05-14) per §4.1 convention |
| sebi_boundaries v1.1 to v1.2 | Semantic | sebi_010 reframed as AIOF (Accredited Investors only Fund) umbrella category with explicit Regulation 13(5) LVF subsumption from the 2025 Third Amendment |
| sebi_boundaries v1.1 to v1.2 | Semantic | sebi_011 reframed as LVF sub-category of AIOF with `parent_category: aiof_scheme` field |

Plus one documentation-only finding: Step 7 curation notes §3 had per-store reference counts of "18 tax_matrix, 18 sebi_boundaries" while independent validation returned 19 and 17. The total of 47 distinct entries (51 reference instances) reconciles either way. Documented in BUILD_NOTES.

### 7.5 Items flagged as uncertain (production deployment priorities)

Items the curator flagged for compliance review attention:

- **PMS look-through tax treatment** (`pmlt_001`): not codified in a single statute section, flows from SEBI Portfolio Manager Regulations 2020 legal structure; classified `practitioner_practice` with `indicative` confidence
- **Hybrid/arbitrage fund classification** (`mf_004`): qualifies as equity-oriented under form-based test but economic exposure is debt-like; established AMFI practice; `practitioner_practice`
- **Cat III business income characterization** (`aif_005`): fact-specific; depends on transaction frequency and CBDT clarifications; `practitioner_practice`
- **PMS turnover drag estimate** (foundation document reference in `pmlt_001` notes): illustrative; should be validated against firm-specific PMS portfolios in production
- **PMS exit timeline** (`dem_012`): practitioner observation, not statutory; varies by strategy
- **Three other liquidity-window framings** (`dem_005`, `dem_007`, `dem_008`, `dem_010`): all `practitioner_practice` per Step 1 brief correction discipline
- **Unstable surcharge band structure**: surcharge bands verified against incometax.gov.in May 2026; production must re-verify against current Finance Act in effect at deployment date
- **AIOF / LVF framework**: 2025 Third Amendment recent; SEBI may issue clarifications

Plus deferred items per individual store curation notes (charitable trust Section 11 tax framework, senior citizen-specific slabs, RNOR routing patterns, OCI-specific rules, IFSCA PMS framework distinct from AIF, InvIT and REIT demat detail, G-Sec/T-bill demat via RBI Retail Direct).

## 8. The inverse-reference pattern for regulatory_changelog

`regulatory_changelog.yaml` is time-ordered ascending by `effective_date` and uses the inverse-reference pattern: each changelog entry's `rule_pointer.affected_entries` field lists which entries in OTHER stores the regulatory event affects. Source stores do NOT carry forward `chg_NNN` references in their bodies.

This keeps the temporal index centralized. For time-bounded reasoning (transactions near a regulatory boundary date), M0.IndianContext queries the changelog for events with `effective_date` straddling the transaction date, follows the `rule_pointer.affected_entries` list to the affected source entries, and applies the regime that was operative at the transaction date.

Across the 12 changelog entries, the cumulative inverse reference inventory is:

- 51 reference instances across the 12 entries
- 47 distinct source entries referenced
- 4 entries (`cg_006`, `dem_002`, `pmlt_002`, `sebi_010`) are touched by multiple changelog events (temporal layering), and in every case the source entry's `effective_date` correctly reflects the most-recent applicable changelog event

## 9. Per-store version pins (final state after Step 8)

| Store | Version | Last bump | Reason |
|---|---|---|---|
| tax_matrix.yaml | v1.1 | 2026-05-17 | Step 8 sur_006 verification-date patch |
| sebi_boundaries.yaml | v1.2 | 2026-05-17 | Step 8 AIOF unification refinement (sebi_010, sebi_011) |
| structure_matrix.yaml | v1.0 | 2026-05-15 | Initial population (carries canonical vocabulary lock) |
| demat_mechanics.yaml | v1.0 | 2026-05-15 | Initial population |
| gift_city_routing.yaml | v1.0 | 2026-05-15 | Initial population |
| regulatory_changelog.yaml | v1.0 | 2026-05-15 | Initial population |

These are the versions Slice 3 commit 3 (M0.IndianContext integration) consumes.

## 10. Production deployment swap-in path

For real firm deployment, replace or supplement the indicative entries with firm-validated reference data. The recommended path:

1. **Keep the citation infrastructure intact.** The five-tier taxonomy, the common envelope, the canonical vocabulary, the inverse-reference pattern, and the discipline scorecard transfer to production unchanged.
2. **Audit entries by trust tier.** Start with `practitioner_practice` and indicative entries (8 total); validate or replace each. Then audit `web_verified` entries (7 total) against current source state. Then validate `regulatory_circular` and `statute_section` entries against current Finance Acts and current SEBI/RBI/IFSCA/MCA circulars.
3. **Use the changelog for date-bounded validation.** Each changelog entry's `effective_date` is the point at which the regulatory event took effect; production validation should confirm the entry's rule body reflects the current state as of validation date.
4. **Bump versions per §6 convention** on any amendment; document rationale in `metadata.changelog` within each file.
5. **Preserve discipline checks.** Run the structural and vocabulary audits from §7.3 against any production-amended state before deployment.

The 20-discipline scorecard is itself the production validation checklist.

## 11. Quick reference for implementers

For M0.IndianContext implementation work (Slice 3 commit 3 and beyond):

- **Filter by `applicability` block.** Every entry is keyed by structured applicability filters; M0.IndianContext should not parse rule bodies to determine applicability.
- **Read structured `rule` fields.** The `rule` block is structured fields, not prose. Narrative explanation belongs in `notes`.
- **Honor `confidence: indicative`.** Surface indicative-confidence entries to S1 with a flag rather than presenting them as authoritative.
- **Consult `legacy_term_aliases`** in `structure_matrix.metadata.canonical_vocabulary` when filtering across pre-lock and post-lock stores.
- **Use the changelog for time-bounded lookups.** Query `regulatory_changelog` for events with `effective_date` near the transaction date; follow `rule_pointer.affected_entries` to applicable source entries.
- **Respect version pins.** If implementation surfaces a need to amend a YAML entry, follow the §6 versioning convention; do not silently edit.

---

**Workstream closed.** Slice 3 commit 3 (M0.IndianContext integration code) unblocked. The data layer at `agents/m0_indian_context/data/` is the canonical reference; the discipline framework in §7 is the canonical methodology for production deployment.
