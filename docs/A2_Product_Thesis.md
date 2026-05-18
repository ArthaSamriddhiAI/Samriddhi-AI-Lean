# A2 Classification Agent: Product Thesis

## Summary

A2 is the agent that translates Samriddhi's portfolio-level diagnostic into a per-holding meeting agenda. For every position the investor owns, A2 produces one of four verdicts (Maintain, Monitor, Discuss, Review) and a short reason. The advisor walks into the meeting knowing which holdings to skip, which to note for next quarter, which to bring up, and which to bring up with a direction in mind.

This document defines what A2 is, why it exists, what it is explicitly not, and the four verdicts as a function of advisor meeting behaviour rather than severity gradient. Implementation, schema, render placement, and rubric details are out of scope for this document and are addressed in the build proposal that follows.

## The Problem A2 Solves

The advisor opens an S2 diagnostic on a Tuesday evening. Tomorrow at 10am, she has a meeting with the investor. The diagnostic in front of her is good. It carries a headline takeaway, asset allocation against the model portfolio, concentration analysis, drift indicators, named observations from the diagnostic vocabulary, and recommendations for advisor follow-up. She reads it. It is true. She nods.

Then she closes her laptop. On the way home she is thinking about Wednesday morning. The investor owns fourteen things. He is going to ask about his portfolio. What does she actually say about each one?

The S2 diagnostic today operates at the portfolio level. The meeting operates at the holding level. The translation between the two is mental work the advisor does in her head, the night before, every time.

A2 closes this gap. It is the bridge between a 1-2 page analytical briefing and a per-holding answer to the question the advisor is going to face in the room.

## Product Thesis

A2 turns a portfolio-level diagnostic into a per-holding meeting agenda. For each holding in the investor's portfolio, A2 produces a forced-choice verdict across four bands, anchored to the same evidence and the same diagnostic vocabulary the rest of S2 already uses. The verdict is about the *conversation* the advisor should have, not about the *trade* the advisor should recommend.

The four bands are tiers of meeting behaviour, not tiers of severity. They answer the question: what does the advisor do with the meeting time?

| Verdict | Meeting behaviour |
|---|---|
| Maintain | Skip in the meeting unless the client raises it. The holding is doing its job. The conversation has higher-value places to go. |
| Monitor | Skip in the meeting. Flag in the advisor's notes for next quarter. Something is mildly off; not worth client conversation time today; worth not forgetting. |
| Discuss | Bring up in the meeting. There is a real conversation to have, even if the advisor is not yet sure what the outcome should be. |
| Review | Bring up in the meeting with a direction in mind. The advisor walks in expecting to talk about this and likely change something, though the client makes the final call. |

The Maintain-to-Monitor distinction and the Discuss-to-Review distinction are deliberate. Both pairs could be collapsed under a pure severity reading. They are kept separate because they reflect distinct advisor behaviours: noting an item for later versus bringing it up today; opening a conversation versus opening a conversation with a proposed direction.

## Why This Matters

A2 unlocks three things, in roughly decreasing order of confidence.

### 1. The clearest "AI helped me prep" moment in the product

Every other surface the advisor sees in the S2 diagnostic today is something a competent analyst could produce with a spreadsheet and an afternoon. Asset allocation tables, concentration thresholds, observation bullets: all valuable, all replicable by hand. Per-holding verdicts across fourteen holdings in seconds, anchored to the investor's specific context and the firm's framework, is not that. It is a piece of work the advisor cannot do by hand inside the time budget of preparing for a meeting. This is where the system earns its keep.

### 2. It changes how the artifact is used

Today the S2 diagnostic is read once before the meeting. A2 makes it referenceable during the meeting. The client points at a holding; the advisor glances at the verdict column. The artifact stops being a briefing document and becomes a working document. The change in use mode is the change in product value: the advisor's relationship to Samriddhi shifts from "I read its output and then I run my meeting" to "Samriddhi is open on the table while I run my meeting."

### 3. It produces a sales-exhibit unit of value

"Show me, a wealth advisor, what your tool actually does for me" is hard to answer with a seven-section narrative briefing. It is easy to answer with: here are fourteen holdings, here is what we say about each one, here are the three we would put on the table tomorrow. That is a screenshot. It is also a sentence that an advisor can repeat to another advisor at a conference. A2 is the smallest unit of demonstrable value the product can carry, and that is true for the same reason that makes it valuable to the user.

## What A2 Is Not

Four boundaries that A2 will be pushed against and must hold.

### A2 is not a recommendation engine

Maintain does not mean "buy more." Discuss does not mean "sell." Review does not mean "exit." The verdict is about whether to have the conversation, not about which way the trade should go. The Lean Samriddhi MVP is explicitly diagnostic-only; A2 sits inside that scope. The closest A2 comes to recommending is the Review tier, where the advisor is expected to walk in with a direction; even there, the direction is the advisor's, not A2's. A2 surfaces the priority; the advisor proposes the action; the client decides.

This boundary is load-bearing. If A2 drifts into recommendation language, it changes the regulatory and product posture of the entire product. It must not.

### A2 is not a replacement for the rest of the diagnostic

The headline takeaway, the concentration analysis, the observation bullets, the drift indicators, the comparison versus model: each continues to do its job. A2 does not displace them. A2 sits underneath them, anchored to the same evidence, surfacing the per-holding view that the portfolio-level surface does not naturally produce. The advisor reads the portfolio-level surface for the analytical context and reads the per-holding verdicts for the meeting agenda. Both are needed; neither replaces the other.

### A2 is not portable across clients

The same fund, the same stock, the same PMS strategy can appear in two different portfolios and receive two different verdicts. A Marcellus PMS holding in a corpus where it sits at 8% with a clean thesis is not the same A2 verdict as the same Marcellus PMS at 22% in a corpus where it crowds out the model portfolio's quality sleeve. The verdict is about fit, not about merit. Fit is contextual; merit travels.

This is why A2 is case-scoped, not fund-scoped. It is also why A2 cannot be a static rating that the firm publishes about a holding. It is a per-case judgment that the system produces fresh, each time, against the specific investor's context.

### A2 is not adversarial

A1 is the institutional contrarian. A1 reads the synthesis and challenges it. A2 does not challenge anything. A2 takes the evidence as given and classifies the holdings. The two agents have different jobs and live in different parts of the architecture: A1 is advisory and post-synthesis; A2 is descriptive and per-holding. The naming similarity is incidental; the roles do not overlap.

## How A2 Anchors to the Existing Surface

A2 does not invent its own evidence. It composes from what is already there.

The S2 diagnostic today produces, per case: a portfolio-level risk verdict from M0.PortfolioRiskAnalytics; per-sector and per-holding quality reads from E1 and E2; behavioural pattern from E4; macro overlay from E3; fund and wrapper-level reads from E6 and E7 where applicable; the named observation set from the diagnostic vocabulary; the drift framework against the model portfolio. A2 consumes these and asks, for each holding: in the context of this investor and this portfolio, given everything we already know, which of the four bands does this holding sit in?

The answer is a function of:
- Position weight against the position concentration threshold (10% flag, 15% escalate)
- Sector weight against the sector threshold (25% flag, 35% escalate), with look-through where coverage exists
- Wrapper count and aggregate against the wrapper threshold (4+ PMS strategies, or any wrapper above 25%)
- The holding's contribution to allocation drift against the model portfolio sub-allocations
- Liquidity bucket placement against the investor's liquidity tier floor
- Fee burden and complexity-premium-earned reads from the diagnostic vocabulary
- Stated-revealed divergence from E4 where it touches the holding
- Thesis intactness from the relevant evidence agent for the holding's wrapper type

The verdict is composed from these inputs. The reason cites the inputs that drove the verdict, in the language the rest of the diagnostic already uses.

## The Four Verdicts in Detail

### Maintain

The holding is aligned with the model portfolio framework. The thesis for owning it remains intact. No concerns surfaced by the evidence agents, no thresholds breached, no diagnostic-vocabulary observations attach to this holding. Default state for healthy holdings.

The meeting behaviour: the advisor does not raise this holding. If the client raises it, the advisor confirms it is doing its job and moves on. Maintain is the workhorse verdict; in a healthy portfolio, most holdings sit here. This is intentional. A meeting where every holding is "to discuss" is a meeting where nothing is.

### Monitor

A small drift from model, a modest deterioration in the case for holding, or a soft signal from one of the evidence agents that has not yet crossed a threshold. The holding stays in the portfolio without intervention. The advisor notes it for the next quarterly review.

The meeting behaviour: the advisor does not raise this holding. The advisor's own follow-up notes carry the observation forward. Monitor is the "do not forget about this" verdict. It is also the verdict that, accumulated across quarters, becomes a Discuss in a future case if the drift does not resolve.

### Discuss

A meaningful concern that warrants advisor-client conversation. Could be a concentration that has crossed the flag threshold; could be a wrapper that is not earning its complexity premium; could be a fee concern; could be a stated-revealed divergence that touches this holding; could be a behavioural signal from E4 that the holding is doing something the investor is not aware of. The advisor is not yet committed to a specific change; the conversation needs to happen first.

The meeting behaviour: the advisor brings up this holding. The conversation is exploratory; it may end in "let's leave it for now" or "let's review next quarter" or "let's plan a change for next fiscal." The advisor opens the conversation; the direction emerges from it.

### Review

Thesis broken, concentration past the escalate threshold, structural misalignment with the model portfolio at a level that the advisor cannot defend on the investor's behalf, regulatory concern that affects this holding, or a behavioural pattern that makes the current position untenable. Action is needed; the advisor walks in with a direction.

The meeting behaviour: the advisor brings up this holding and is prepared to propose. The proposal may be "trim to threshold over two tax years," "exit and redeploy to the model portfolio's quality sleeve," "review the wrapper choice given fee read." The client makes the final call; the advisor's role is to put the structured option on the table. Review is the rare verdict; a portfolio with many Review verdicts is a portfolio that needed advisor attention some time ago.

## Anti-Patterns to Avoid

These are the failure modes A2 must not drift into.

**Every holding becomes Discuss.** A meeting where the advisor brings up every holding is a meeting where the advisor brings up nothing. A2 must hold the discipline of Maintain as the default for healthy holdings.

**The verdict drifts into the trade.** "Discuss because you should consider trimming" is recommendation language. "Discuss because position weight is 18% against a 15% escalate threshold" is conversation-priority language. A2 surfaces the priority; the advisor proposes the trade.

**The reason becomes a wall of text.** A2's reason is the size of one sentence the advisor can glance at during the meeting. Anything longer belongs in the case detail view, not in the verdict.

**The verdict varies on retry.** A2's verdict for a given holding in a given case must be replayable. Same evidence, same verdict. The reason text may vary in phrasing; the tier does not.

**A2 contradicts the rest of the diagnostic.** A2 anchors to the same evidence the rest of S2 uses. If the diagnostic vocabulary flags wrapper over-accumulation across four PMS strategies, A2's verdicts on those four holdings should reflect that. A2 is not a second opinion; it is a per-holding view of the same evidence.

## What Success Looks Like

When A2 ships, three things should be true.

First, an advisor opening an S2 diagnostic on a Tuesday evening should be able to glance at the per-holding verdict column and know, without further reading, which conversations to plan for Wednesday morning. The time-to-meeting-agenda goes from "read the briefing, reconstruct the per-holding view in your head" to "scan the column."

Second, the verdicts and reasons should be auditable. If a CIO reviews the case in three months and asks "why did the system call Marcellus a Discuss in this case but a Maintain in another," the reasons should answer that question without anyone having to re-derive the logic.

Third, the same case run twice should produce the same verdicts. This is the discipline that makes the product trustable. Reasons can vary in phrasing; verdicts cannot.

If all three are true, A2 has done its job. The advisor walks into the meeting prepared at a holding level the system has done for her. The system produces a defensible record of why it said what it said. The product carries a unit of demonstrable value that scales, by repetition across cases, into the trust that the rest of the Samriddhi vision will eventually rest on.

## Out of Scope for This Document

This thesis defines the *what* and the *why* of A2. The following are deliberately not addressed here and are addressed in the build proposal that follows:

- The rubric: the specific logic mapping flags and evidence to each of the four verdicts.
- The agent's implementation pattern: which parts are deterministic, which use the Claude API, where the boundary sits, and why.
- The schema additions and the harness wiring.
- The render placement on the S2 Analysis tab.
- The sentinel handling for wrappers with limited look-through coverage.
- Whether A2 also runs on Sharma's S1 case.
- Whether the A2 section produces its own headline takeaway.
- The backfill plan for the existing six S2 fixtures.

Each of these is a real question. None of them belong in the product thesis. They belong in the design proposal that operationalises the thesis, after the thesis is approved.

## Closing Note

A2 is a small agent. One verdict per holding; one short reason. The smallness is the point. It is the smallest unit of judgment the system can carry that an advisor can act on directly, and it is the smallest unit of value the product can demonstrate to someone who has never used it. Most of the work has been done by the rest of the diagnostic; A2 is the translation step that turns analysis into agenda. That is its job, and that is the entire job.
