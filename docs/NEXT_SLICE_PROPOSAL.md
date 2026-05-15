# Next slice proposal

## Recommended next slice, Slice 4, IC1 deliberation layer

### Why this slice next

Slice 3 closed with the Samriddhi 1 proposal-evaluation pipeline functional end-to-end: New Case → router → evidence agents → governance gates → S1 synthesis → A1 adversarial challenge → seven-section briefing → Outcome and Analyst Reports tabs. The canonical Sharma + Marcellus case loads via the seed and renders cleanly.

What Slice 3 deliberately did **not** include: the IC1 (Investment Committee) deliberation layer. Per the Slice 3 orientation boundary protection: "IC1 stays dormant. The materiality firing logic is Slice 4 work. For Slice 3, treat materiality as always false."

Slice 4 turns the materiality threshold check live and wires the five IC1 sub-roles. When materiality fires (governance failures, severity escalation, specific construct combinations), the case detail surfaces an inline deliberation between the IC1 sub-agents alongside the existing Outcome view.

### Recommendation

Take **Slice 4** before Slice 5 (Explorer dashboard), Slice 6 (read-only chat), and Slice 7 (polish). The orchestration runtime now has every supporting layer in place; IC1 is the last unfinished piece of the EGA framework's decision-grade workflow.

### Scope of Slice 4

1. **Materiality threshold logic.** A deterministic rule evaluator that reads the case's gate results, severity, and synthesis verdict, and decides whether IC1 fires. Triggers: G1 fail, S1 escalation_recommended, specific construct combinations (band breach + behavioural concern + low confidence, etc.). For the Sharma case, materiality would fire under the current `requires_clarification` + elevated risk + escalation_recommended=false combination — likely yes given three simultaneous gaps; the threshold tuning is part of Slice 4.

2. **IC1 sub-agent harness for the five roles.** Chair, Devil's Advocate, Risk Assessor, Counterfactual Engine, Minutes Recorder. Skills are already lifted in `/agents/`. Each fires conditionally per the deliberation rules; outputs assemble into a structured `IC1Deliberation` payload.

3. **Inline deliberation surface on the Case Detail Outcome tab.** A new collapsible section between Advisory challenges and Decision capture. Default collapsed (calm-by-default principle); expanded shows Chair's framing, Devil's Advocate position, Risk Assessor's posture, Counterfactual Engine alternatives, Minutes Recorder's summary. The Analyst Reports tab gains an IC1 deliberation memo with per-role contributions.

4. **Materiality not-fired case.** When materiality fires false, IC1 stays dormant; the section renders a short "Materiality threshold not reached" line for transparency. Important: the visual treatment must signal "deliberation did not fire" rather than "no deliberation available."

5. **Sharma case re-generation under IC1 active.** Once the materiality logic is wired and the IC1 stubs exist, regenerate the Sharma case so the demo carries the full deliberation surface. Following the Slice 3 pattern: parse from authored content where available, live-generate where not, record stubs, export the case fixture, commit.

### Single-case scope, again

Slice 4 generates the IC1 deliberation for **one** canonical case (Sharma + Marcellus). Other investors / proposals don't get IC1 deliberation surfaces in this slice (they would generate live or fail under STUB_MODE per the existing pattern). Batch generation of IC1 deliberations across investors is a DEFERRED item after Slice 4 closes.

### Open questions to resolve at Slice 4 orientation

1. **Materiality threshold tuning.** What specific combinations fire IC1 vs leave it dormant? Slice 4 orientation should specify a deterministic rule set; revisit after the Sharma re-generation surfaces the IC1 output and the user evaluates whether the firing condition feels right.

2. **IC1 deliberation output shape.** The skill files describe five sub-agent roles but the orientation Q1 equivalent — "what does the IC1 deliberation render as on the Outcome tab" — needs locking. Recommendation: a structured `IC1Deliberation` with per-role contributions (each carrying a heading + paragraph + optional structured bullets), plus a Minutes Recorder consolidated summary.

3. **Sequential vs parallel IC1 firing.** The five roles could fire in parallel (saving wall-clock time) or sequential with each role consuming prior output (richer narrative). Recommendation: sequential, mirroring how an actual investment committee deliberation unfolds. Cost increment over parallel is small; quality increment is meaningful.

4. **Counterfactual surfacing relative to S1's existing counterfactual.** S1.case_mode already produces a `counterfactual_framing` string (per Slice 3). IC1's Counterfactual Engine would produce a richer structured counterfactual. The Outcome tab needs to handle the relationship — likely the IC1 counterfactual supersedes when present; otherwise S1's brief framing.

5. **API budget for live-mode IC1 stub generation.** Five LLM calls per case (one per sub-agent). At Opus 4.7 pricing, roughly $2-4 per case. Budget gate similar to Slice 3 commit 9.

### Funding state at close

API budget remaining: roughly $1.84 - $0.89 (Slice 3 commit 9 spend) ≈ $0.95 in console. Slice 4's budget gate for IC1 stub generation will need a top-up unless Workstream C lands and brings Anthropic credit with it. If budget remains constrained at Slice 4 orientation time, the partial-fallback path (orientation Q7 pattern) is available: ship IC1 with parsed or hand-authored stubs and defer live-mode generation.

### Boundary protections (Slice 4 should not include)

- Real-mode Sharma case regeneration without IC1. That's a DEFERRED item.
- Multi-investor IC1 deliberation cases. Single-case Sharma is the scope.
- Real-mode M0.IndianContext integration. That's commit 3, blocked on Workstream C; resolves whenever the YAML stores curate.
- Case-mode briefing PDF. DEFERRED from Slice 3; pick up in Slice 7 polish or a focused micro-slice.
- Multi-role permission gates in G3. Slice 4 keeps G3 as the placeholder.

## Alternatives considered

- **Slice 5 (Explorer dashboard) ahead of Slice 4.** Would unlock the model-portfolio visualisation and firm-level customisation. Argument against: IC1 is the last EGA framework piece and the demo's institutional credibility depends on the deliberation surface; Explorer is a secondary surface that can wait.
- **Slice 7 (polish) ahead of Slice 4.** Would fix the case-mode briefing PDF, design fonts, page-numbering. Argument against: polish before the last functional layer (IC1) lands creates rework if IC1 changes the briefing shape.
- **Skip IC1 entirely.** The current pipeline (Slice 3) is already decision-grade with G1/G2/G3 + A1. IC1 adds depth but not strictly missing functionality. Argument against: IC1 is what makes the demo feel like an institutional committee process, not just a single-analyst workflow. Skipping reads as a gap.

Default is **Slice 4 (IC1)**. The platform's institutional credibility positioning depends on the full deliberation surface.
