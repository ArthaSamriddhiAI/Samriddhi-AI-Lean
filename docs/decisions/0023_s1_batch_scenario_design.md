# ADR 0023: Samriddhi 1 case batch scenario design

## Context

The Samriddhi 1 case batch authors the first five generated Samriddhi 1 (proposal-evaluation) cases, one per investor archetype 01-05 (Malhotra, Iyengar, Bhatt, Menon, Surana). The Sharma + Marcellus fixture is structural scaffolding, not a generated case. This ADR records the scenario-design choices: investor-to-scenario mapping, ticket / horizon / vehicle / outcome distribution, instrument selections, the IC1 firing pattern, and the edge cases deliberately excluded. The Phase 1 dry-runs surfaced two pipeline truths that shaped these choices: Samriddhi 1 evidence activation is action-centric (ADR-0024), and every mutual-fund target trips G2 clarification (P25).

## Decision

### One case per investor, capital-deployment scenarios

Per Plan v8:334 ("1-2 cases per investor covering capital deployment over short / medium / long timelines"), the batch ships one case each for investors 01-05, all `case_intent: new_investment` (the only proposal intent exposed in the MVP form; `product_evaluation` is router-accepted but not form-exposed per foundation.md:29). Each is a fresh-capital deployment, not a rebalance or exit.

### Coverage distribution

| Investor | Ticket | Horizon | Vehicle | Initiation | E1/E2 fire | IC1 | Expected outcome |
|---|---|---|---|---|---|---|---|
| Iyengar (02) | Rs 50 L | 3Y short | Debt MF (`mutual_fund_debt`) | Advisor | No (debt target, FD source) | fires (mandate-band) | requires_clarification |
| Surana (05) | Rs 5 Cr | 7Y medium-long | Debt sleeve (`mutual_fund_debt`) | Investor | No (debt target, cash source) | fires (ticket) | requires_clarification / support |
| Malhotra (01) | Rs 1 Cr | 7Y medium-long | PMS (first) | Investor | Yes (PMS target, MF source) | fires | requires_clarification |
| Menon (04) | Rs 5 Cr | 8Y+ long | Cat II AIF | Advisor | No (AIF target, cash source) | fires | requires_clarification |
| Bhatt (03) | Rs 2 Cr | 5-7Y medium | PMS (5th) | Investor | Yes (PMS target, direct-equity context) | fires hard | requires_clarification (decline-flavored) |

Run order is failure-isolation order: the simplest case (Iyengar) first, the engineered decline (Bhatt) last. Outcome columns are directional targets, not specifications; the live pipeline's honest output is documented actual-versus-expected in the workstream audit doc. All confidence ranges in the scenario matrix are likewise directional.

### Routing is action-centric (differentiated evidence packs by proposal type)

Samriddhi 1 evidence activation is action-centric: `routeProposedAction` (router.ts:195) fires E1/E2 only when the proposed action involves listed-equity look-through (PMS / equity-MF / direct-equity target, or an equity source), and it does not consult existing holdings. So E1/E2 fire on Malhotra and Bhatt (PMS targets) and correctly do not fire on the debt and AIF cases. This produces naturally differentiated evidence packs by proposal type and is a positive coverage feature, not a gap. See ADR-0024 for the full routing discussion.

### IC1 fires on all five cases; IC1-skip is currently unreachable

IC1 deliberation fires conditionally on materiality (ticket size, product wrappers, concentration breaches, gate clarifications, amplification flags). When materiality does not fire, the pipeline correctly skips IC1, demonstrating its judgment about when full investment-committee deliberation is warranted. In the pipeline state at the time of this batch, IC1-skip is not reachable for any plausible Samriddhi 1 proposal because: (a) every MF target trips G2 clarification due to SEBI MF scheme-level rules not yet curated (P25 references this); (b) PMS / AIF / SIF wrappers trip materiality by design; (c) `bond_listed` / `fixed_deposit` tagged proposals are awkward shapes for a capital-deployment narrative. All five cases in this batch fire IC1 as the honest pipeline output. IC1-skip is documented as an architectural property and will become demonstrable once the G2 MF curation lands. The IC1 deliberation flavor varies across the five (ticket-only on Surana, full wrapper-materiality on Malhotra and Bhatt, AIF-materiality on Menon, mandate-band-driven on Iyengar), providing meaningful IC1 coverage variance even without an IC1-skip example.

### Iyengar: small-ticket mandate-gap clarification

The proposal was retuned from an equity-oriented hybrid (HDFC Balanced Advantage, roughly 40-65% net equity, a poor fit for a Conservative mandate that the first dry-run correctly flagged) to a conservative corporate bond fund (ICICI Prudential Corporate Bond Fund), tagged `mutual_fund_debt` so G1 models it as Debt (ADR-0025). Even so, the case lands `requires_clarification` with IC1 firing: G2 clarifies (every MF target, P25), and G1 flags a pre-existing 0% cash versus a 3% floor and a 14.7% single-position versus Iyengar's 12% conservative ceiling. The case identity is therefore "small-ticket but mandate-gap clarification": the pipeline correctly surfaces that a Rs 50 L single-fund deployment for a conservative widow with 0% cash and a tight position ceiling warrants advisor clarification on liquidity and position sizing before proceeding. This is a genuinely interesting Samriddhi 1 output, countering the assumption that a small ticket means an uninteresting evaluation.

### Instrument selections (Marcellus deliberately avoided)

The Sharma scaffolding case uses Marcellus Consistent Compounder PMS; it is over-used in the project, so each pick here is distinct and documented:

- **Iyengar:** ICICI Prudential Corporate Bond Fund, tagged `mutual_fund_debt`.
- **Surana:** a Rs 5 Cr debt sleeve, tagged with the **single** category `mutual_fund_debt` (the Proposal schema carries one `target_category`), led by HDFC Short Term Debt Fund with a AAA corporate bond MF and an NHAI/REC/PFC tax-free bond ladder documented narratively in the proposal text. G1 evaluates the single tag (Debt); the sleeve composition is context for the evidence and synthesis layers. The proposal deliberately does not touch the concentrated Reliance position (avoids crystallising LTCG), so it addresses the zero-debt design without addressing the concentration.
- **Malhotra:** Stallion Asset Core Fund (PMS), a quality-concentrated growth PMS distinct from Marcellus and from any holding in the seeded portfolios; the household's first PMS.
- **Menon:** Vivriti Alpha Debt Fund (Cat II private credit AIF), a plausibly-named Cat II vehicle consistent with the `aif_cat_ii_private_credit` taxonomy.
- **Bhatt:** ASK Indian Capital Goods & Infrastructure Portfolio (PMS), a sector-thematic capital-goods PMS distinct from Marcellus and from Malhotra's pick; the fifth wrapper in Bhatt's stack.

### Engineered-decline (Bhatt) framing

Bhatt's case is the deliberate weak-proposal demonstration: a fifth PMS with no exit from the existing four, lifting wrapper-aggregate exposure from roughly 39% to roughly 45% of advisory liquid AUM, driven by a business-community peer signal against his daughter Aanchal's analytical skepticism. The case is plausible because of who Bhatt is per the bible (relationship-driven accumulation, wrapper-tier saturation, stated-aggressive / revealed-moderate), not because it is engineered against him. If the live pipeline does not naturally land decline-flavored (for example E6 reads the new PMS as comparable rather than redundant, or IC1 lands at "support with strong dissent"), the honest outcome is documented and accepted; the proposal is not retro-fitted to force a decline.

### Edge cases excluded (logged as product debt)

- **Investors 06-13** Samriddhi 1 coverage: deferred (P27, this batch as originator).
- **NRI / RNOR / HUF** Samriddhi 1 scenarios: out of scope, already P1; not re-logged. The Menon case is set in FY 2026-27 post-RNOR (snapshot `t4_q2_2027`, the seeded snapshot mapping to Q2 2027) with conversion completed Q1 2027, so no RNOR mechanics are load-bearing; P1 is referenced in the case JSON comments.
- **ESOP-specific** Samriddhi 1 scenarios: deferred (P27 notes this alongside investor coverage).

## Alternatives Considered

- **Two cases per investor.** Rejected for this batch: one well-formed case per investor covers the ticket / horizon / vehicle / outcome / IC1-flavor axes adequately; a second each would add cost and review burden without new coverage. Plan v8 allows 1-2; one was sufficient.
- **Keep the `mutual_fund` tag for the debt proposals.** Rejected: `mutual_fund` maps to Equity in G1, which mis-modeled the debt fund as adding equity (Iyengar's first retune dry-run showed a phantom equity-ceiling breach). The fix is `mutual_fund_debt` (ADR-0025).
- **Hold Iyengar as the IC1-skip demonstration.** Abandoned: IC1-skip is unreachable for any plausible Samriddhi 1 proposal in the current pipeline state (G2 MF clarify + materiality-on-wrappers), so no investor can demonstrate it; Iyengar is reframed as the mandate-gap clarification case instead.
- **Force Bhatt to decline.** Rejected: retro-fitting the proposal to guarantee the outcome would undermine the demonstration that the pipeline reaches the verdict on the evidence.

## Consequences

The batch ships five cases spanning the intended coverage. All five fire IC1 (the honest pipeline output), with the deliberation flavor varying across them for meaningful coverage variance. The E1/E2 scope-builder enrichment is exercised on the two PMS-target cases (Malhotra, Bhatt); the debt and AIF cases lean on E3 / E4 / E6 / E7 as the action-centric router activates them. The matrix outcomes are directional targets; the audit doc records actual-versus-expected per case. Instrument picks, the Iyengar retune and reframe, and the Surana single-tag decision are documented here so a future reader understands the choices. Excluded edges are logged as product debt rather than partially built.
