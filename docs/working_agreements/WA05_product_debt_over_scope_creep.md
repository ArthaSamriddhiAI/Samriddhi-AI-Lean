# WA05: Product debt over scope creep

## Agreement

Product debt over scope creep. Discoveries that are out of scope but worth logging get an entry in the debt log; do not expand workstream scope to cover them.

## Rationale

Transcribed from CC build prompts; original rationale not in-repo. In-repo evidence: the debt log is the durable surface for this agreement. The failure mode it prevents: a narrow capability workstream silently ballooning to fix every adjacent problem it touches, which destroys reviewability and schedule predictability.

## Trigger

Transcribed from CC build prompts; original rationale not in-repo.

## Examples

**Compliance:** Risk-reward discovered the canonical-16 index set is incomplete relative to the fund universe; logged as `PRODUCT_DEBT_LOG.md` DD3 and routed to the snapshot-data-extension workstream rather than expanding risk-reward to ingest more indices.

**Non-compliance:** Risk-reward deciding to ingest 40 more benchmark indices itself because it noticed the gap.

## Cross-references

`docs/debt/PRODUCT_DEBT_LOG.md`, `docs/debt/ui_ux_debt_log.md`; WA08 (surface debt entries before PR).
