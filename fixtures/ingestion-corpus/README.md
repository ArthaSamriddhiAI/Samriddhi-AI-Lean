# Synthetic ingestion corpus (A1 to A14)

The complete synthetic test corpus for investor onboarding ingestion: every file format an investor's data plausibly arrives in, for all fourteen fictional archetypes. This is fictional content invented for the project (WA14: origin-based classification, public), and per the Package 07 three-tier storage ruling the synthetic tier lives in this public repository; real client data never enters any repository.

## Contents

Per batch directory (`a1_a5/` for the five demo investors, `a6_a14/` for the extended cohort):

- `ecas_*.pdf`: synthetic CAMS/KFintech-style Consolidated Account Statements for the MF-meaningful archetypes (8 across both batches; the others are skipped by design, see the batch README in the foundation lineage).
- `transactions_*.json`: the structured ground truth for each statement, emitted by the generator in the same run that rendered the PDF: per folio, the resolved snapshot fund identity, every transaction (date, type, amount, units, NAV), the closing units, and the anchor-month NAV basis. Parsers are tested by reconciling their PDF output against these.
- `altformat_*`: the alternate-format listings (four spreadsheet textures, columnar and free-form text dumps, email prose) carried over from the foundation lineage.
- `meeting_notes_*.md`: advisor pre-meeting notes per archetype.
- `holdings_a1_a5.json` / `holdings_extended.json`: the canonical per-holding rows (quantity, cost basis, purchase date, vehicle attributes such as FD `interest_rate` and `maturity`).
- `ecas_run_manifest.json`: regeneration provenance: the snapshot sha256 the run anchored to, the statement date and anchor month, the alias map used, and sha256 hashes of every generated artifact.

## NAV basis (the Package 07 re-anchor)

The eCAS transaction histories are priced on the enriched real t0 snapshot's `monthly_nav` series (data repo v2.0.0 basis, `real_data_build: realv1`): every transaction row carries the real NAV of its month, and each folio's closing units are backsolved so that closing units times the anchor-month NAV equals the canonical holding value exactly. The anchor month is the last completed month-end grid point on or before the statement date (statement date 2026-04-02, anchor 2026-03). This replaces the original CAGR-synthesized basis whose mismatch was recorded as D14/P50.

## Regeneration

From the data repo (`ArthaSamriddhiAI/Samriddhi-AI-Data-Snapshots`), with its venv (`generators/requirements.txt`):

```
python3 generators/generate_ecas.py --batch a1a5 \
  --holdings-a1a5 <path to holdings_a1_a5.json> --out-dir <this repo>/fixtures/ingestion-corpus/a1_a5
python3 generators/generate_ecas.py --batch extended \
  --holdings-extended <path to holdings_extended.json> --out-dir <this repo>/fixtures/ingestion-corpus/a6_a14
```

The generator refuses to run against a snapshot without the `real_data_build` stamp and aborts if any folio fails the closing-value reconciliation. Regeneration is deterministic (stable CRC32 seeding).

## Privacy note

All identities here (names, addresses, PANs, folio numbers, emails, mobiles) are synthetic fiction. They double as the offline test corpus for the PII sanitisation layer: tests assert these synthetic identifiers never survive into prompt context, without any real PII existing anywhere in the repository.
