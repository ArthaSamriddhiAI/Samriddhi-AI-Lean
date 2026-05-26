# WA21: Verify before adding

## Agreement

When writing or modifying anything that touches a registry (debt log, ADR index, fixture set, sentinel taxonomy, PR list, working agreements file, or any versioned canonical store), the writer reads the full current state of the registry first and quotes the relevant section as evidence before writing. "Next free number" claims are answered against the live registry, never from prior chat-state, kickoff text, or paraphrase. This applies to task chats writing artifacts, to Claude Code executing prompts, and to the planner chat composing kickoffs.

## Provenance

During the T-5.07 workstream, multiple downstream errors propagated from upstream paraphrases of registry state that turned out to be inaccurate. (a) A prompt drafted a new product-debt entry P33 for the E5 deferral, which turned out to duplicate the existing T16. (b) A prompt drafted a new tech-debt entry T20 for naming drift, which turned out to overlap with the existing P28. (c) A prompt's paraphrase of P28 truncated the entry at one of its resolution arms, causing a proposed addendum to use a colliding label. (d) The codification gap on WA19 and WA20 (operating in prose without on-disk files) was itself caught by this discipline in the same workstream. In each case the failure was that the upstream prompt worked from a summary or assumption rather than from the live registry. The discipline closes the loop: quote-as-evidence forces the read.

## Cross-references

WA19 (gates are criterion-based; verify-before-adding is the discovery posture that feeds WA19's gate evaluation), WA22 (audit phase as deliverable; WA21 is the per-action version of WA22's workstream-level posture).
