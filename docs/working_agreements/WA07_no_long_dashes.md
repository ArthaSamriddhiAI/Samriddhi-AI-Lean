# WA07: No long dashes anywhere

## Agreement

No em dashes, en dashes, or any long dashes anywhere. Hard rule. Use commas, semicolons, colons, or periods. Enforced in code via the `stripLongDashes` sanitiser on LLM (Layer 2) output and verified by long-dash scans on all authored content (skill files, fixtures, schema docs, PR notes, commit messages, ADRs, audit docs, hand-off docs).

## Rationale

Transcribed from CC build prompts; original rationale not in-repo. In-repo evidence: `stripLongDashes` in `lib/agents/a2-classification.ts` declares the dash set via `\u` escapes so the source file itself contains no literal long-dash glyph, and the model is explicitly not trusted to comply (the deterministic pass is the guarantee). The failure mode it prevents: long-dash glyphs leaking into authored or generated content, which the owner treats as a hard stylistic and machine-legibility rule.

## Trigger

Transcribed from CC build prompts; original rationale not in-repo. The in-repo enforcement mechanism was built during the A2 workstream (Layer 2 sanitiser).

## Examples

**Compliance:** This sentence uses commas and a colon: nothing else. ADR-0013 and the risk-reward audit doc were written dash-free by construction.

**Non-compliance:** Writing "the fund, a large-cap vehicle, underperformed" with an em dash around the apposition instead of commas.

## Cross-references

`lib/agents/a2-classification.ts` (`stripLongDashes`); cited in-repo as "D7" data-debt (frozen pre-WA07 prose in S2 fixtures).
