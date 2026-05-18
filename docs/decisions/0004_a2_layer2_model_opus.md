# ADR 0004: A2 Layer 2 runs on Opus 4.7 per skill frontmatter

## Context

The A2 skill frontmatter declares `llm_model: claude-opus-4-7` and `temperature: 0.3`. Two codebase facts complicate this: (1) `lib/agents/harness.ts:132` drops the `temperature` parameter for any `claude-opus-4*` model because the API rejects it, so on Opus 4.7 the declared `0.3` is never sent; (2) `LEAN_RUNTIME_OVERRIDES` in `lib/agents/skill-loader.ts` forces every other S2 LLM agent (E1-E7, S1) to Sonnet for demo economics, leaving skill files byte-identical and tuning at runtime. A choice was required for A2 Layer 2.

## Decision

A2 Layer 2 runs on Opus 4.7 as declared in the skill frontmatter. The skill file stays byte-identical (Slice 2 Q2 convention). The only runtime override added for `a2_classification` is `max_tokens: 4000` (the skill default 2000 is tight for batched one-sentence reasons across up to ~12 holdings, and the harness hard-fails on a max_tokens stop). The model is not overridden.

## Alternatives Considered

- **Sonnet via runtime override (the audited recommendation).** Would honor `temperature: 0.3` (the harness applies temperature on non-opus models), match the rest of the S2 pipeline's economics, and keep the skill file byte-identical. Not chosen: the product owner elected to keep Opus 4.7 per the frontmatter at Checkpoint 1.
- **Edit the skill frontmatter to drop temperature or change the model.** Rejected: violates the Slice 2 Q2 convention that skill files stay byte-identical and tuning happens at runtime in `LEAN_RUNTIME_OVERRIDES`.

## Consequences

`temperature: 0.3` is documentation-only on Opus 4.7; reason-text sampling uses the API default. This is acceptable because the verdict is Layer 1 and fully deterministic (ADR 0001), and the skill explicitly permits reason-text phrasing to vary while the tier does not. Layer 2 cost is at Opus pricing rather than Sonnet (one call per case). Triggers to revisit and flip to Sonnet later: a cost review of the Capability Phase, a demo-economics pass, or a need for temperature-controlled reason text. Flipping is a one-line change to `LEAN_RUNTIME_OVERRIDES` and would also restore the declared `0.3`.
