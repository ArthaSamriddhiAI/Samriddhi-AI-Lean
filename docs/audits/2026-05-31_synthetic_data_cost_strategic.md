# Strategic audit: the synthetic-data beta problem, the cost to fix it, and the option that changes the math

**Date:** 2026-05-31
**Branch:** `features/client-weighted-benchmark` (build held at the Phase 2 stop; capability `acb6125`, provenance diagnostic `8858114`, back-fill tooling staged but uncommitted; nothing changed by this audit).
**Mode:** Read-only strategic audit. The only write is this deliverable. All dollar figures are WA12 estimates surfaced before any spend, not a spend. WA2 (data wins over memory), WA21 (quote as evidence), WA27 (repo-relative paths), WA7 (no long dashes), WA28 (the call is the primary's; this informs it).
**First-move call:** new dated `docs/audits/` file. This is the most strategic deliverable in the workstream and the decision will cite it; it belongs in the durable corpus.

---

## Bottom line up front

**Option 2-lite is real, and there is a variant of it that costs essentially zero API credits.** The beta inflation has a clean algebraic lever (`beta = sqrt(R-squared) * vol_fund / vol_index`), and the synthesis code confirms the index volatility is the tunable side. There are two ways to raise it, and they have radically different costs:

- **2-lite-A (re-tune the synthesis):** raise the synthetic index volatility at its source and regenerate the constituent universe, the indices, and the anchored fund NAVs. Strategically cleanest, preserves the stock-index consistency invariant, but **regenerating fund NAVs shifts the per-fund trailing returns the LLM case prose cites, which forces a full case re-fire**. Estimated **~$12.7** of Opus credits for the five Samriddhi 2 cases.
- **2-lite-B (post-hoc index rescale):** deterministically rescale the equity index series volemvelope upward, then recompute only the benchmark-relative stats (`beta`/`R-squared`/`tracking_error`/`information_ratio`) and re-run the deterministic risk-reward layer. **Leaves the fund NAVs, every preserved self-stat, every trailing return, and therefore all LLM case prose untouched.** Estimated **~$0** API (pure deterministic compute). The cost is a documented deviation from the ADR-0009 stock-index identity, not credits.

The single most important cost finding: **the expensive LLM reasoning can be reused.** The case prose references "beta" qualitatively (skill-versus-market language), never the `beta_3y` value, and the cheap path preserves every number the prose does cite. So "changing the data forces a full pipeline re-run" is false for the rescale variant. The decision is therefore not "$10 versus $20"; it is "spend ~$0 and accept an invariant deviation" versus "spend ~$12.7 and keep the invariant clean."

This audit does not choose. It gives you the facts and one option you had not named (2-lite-B).

---

## A. How contained is the vol-envelope fix? Does 2-lite exist?

**Yes, and the volatility is parameterised, but the realised index vol is emergent and currently sits below its own parameter.**

The equity indices are `derive_from_constituents` (ADR-0009, `docs/decisions/0009_snapshot_index_synthesis_and_set.md:43-44`): the market-cap-weighted average of synthesized constituent returns. The constituents are a factor model in `scripts/enrich_snapshots.py`: a market factor at `MARKET_FACTOR_ANN_VOL = 0.16` (`:312`), cap-tier factors at `ann_vol` 0.14 / 0.18 / 0.22 for large / mid / small (`:317-319`), sector residuals, and per-stock idiosyncratic vol (`DEFAULT_IDIO_VOL = 0.045`, `:254`). So the envelope is governed by named constants, not hand-placed data: it is tunable in principle.

The catch is that the realised equity index vol is **emergent and diluted**: I measured `nifty_100_tri` at 0.0845 annualised against a 0.16 market-factor parameter and a real-world Nifty 100 nearer 0.14 to 0.18. The averaging across constituents and the way the cap-tier and sector factors combine damp the realised index vol well below the nominal market factor. So raising one constant does not deterministically land a target index vol; 2-lite-A is a **calibration loop** (adjust, regenerate, measure, repeat) over the whole constituent universe, not a one-line change.

**Does the index fix force a NAV regeneration? This is the cost hinge, and the answer differs by variant.** The fund NAVs are regenerated as a single-factor series anchored to the index (`scripts/regenerate_fund_nav.py:1-9`, ADR-0014), calibrated so they reproduce `vol_3y` exactly and the sharpe-implied return exactly. The script even states the lever in terms: "a low-vol fund versus a high-vol index gets a low beta even when highly correlated (correct)" (`scripts/regenerate_fund_nav.py:100-102`).

- **2-lite-A regenerates the indices at their source, so the anchored NAVs must be regenerated too.** That is what shifts returns and forces the re-fire.
- **2-lite-B does not.** Rescaling the index returns by a factor `k` (multiply the demeaned monthly log-returns by `k`, re-exponentiate to levels) raises `var_index` by `k^2` and leaves the fund NAVs untouched. The algebra is clean: against the rescaled index, `cov` scales by `k`, `var` by `k^2`, so `beta -> beta / k`, while `R-squared = corr^2` is **invariant** (correlation is scale-free). So to bring an equity beta from ~1.5 to ~1.0, rescale the equity indices by `k ≈ 1.5` (0.0845 to ~0.127, toward realistic). Beta normalises; the ADR-0014 co-movement (R-squared) the calibration cared about is preserved exactly; and because the NAVs are never touched, every fund self-stat and trailing return is byte-identical.

So 2-lite exists in both forms. 2-lite-B is the surgical one: a deterministic transform on 9 equity index series plus a deterministic recompute, with no NAV regeneration.

## B. The full blast radius

**2-lite-A (re-tune at source), honest full sweep:**
- Re-synthesize the constituent stock universe (the factor-model change) across the snapshots that matter.
- Re-derive the 9 equity indices (and re-check the 5 debt + gold + sp500 for consistency).
- Regenerate the 857 anchored fund NAVs at t0 (ADR-0014:27), and, if forward states are in play, the t1..t8 regenerations too.
- Recompute every per-fund and per-stock `tier_b_stats` (beta, R-squared, TE, IR; ADR-0015 recompute), which lives in the snapshot.
- Re-run the deterministic risk-reward layer for the five S2 cases.
- **Re-fire the LLM case pipeline** for the five cases, because the regenerated NAVs shift trailing returns the prose cites (see C).
- Strictly necessary for the betas to normalise: the index re-tune plus the NAV regen plus the tier_b recompute plus the risk-reward refresh. Merely consistent-to-refresh: the forward snapshots t1..t8 (the five cases sit at t0), the S1 case-mode fixtures that read t0, and the regime probes.

**2-lite-B (rescale), honest full sweep:**
- Deterministically rescale the 9 equity index series (in t0 at minimum; t1..t8 if forward consistency is wanted) by `k`.
- Recompute the affected per-fund and per-stock `tier_b` benchmark-relative stats against the rescaled indices (deterministic). `vol_3y`, `sharpe_3y`, returns, drawdown are untouched.
- Re-run the deterministic risk-reward back-fill for the five S2 cases (the staged tooling already does this additively, touching only `content.risk_reward_stats`).
- **Not touched:** fund NAVs, stock prices, every self-stat, every trailing return, `content.briefing`, `content.evidence`, `content.a3_so_what`, `content.metrics`, `content.a2_classification`.
- Strictly necessary: the equity-index rescale plus the tier_b benchmark-relative recompute plus the risk-reward refresh, at t0. Everything else is optional.
- The one real cost is not credits: rescaling the index breaks the ADR-0009 invariant that the index equals its constituents' weighted return. That matters for the regime-beat magnitudes at t1..t8 (a constituent shock would no longer scale 1:1 into the rescaled index) and for design purity; it does not affect the five S2 cases at t0 or any LLM prose. It would warrant its own ADR or debt note as a deliberate dev-phase deviation.

## C. The WA12 cost estimate, broken down

**Deterministic work is free of API credits.** Index synthesis, the index rescale, NAV regeneration, tier_b recompute, the risk-reward back-fill, and fixture writes are all Python or TypeScript with no model calls. Whatever the variant, the data mechanics cost compute time, not credits.

**The credits live entirely in the LLM case pipeline,** and the question is whether it must re-fire. Model is `claude-opus-4-7` (`lib/claude.ts:23`); the harness uses no prompt caching (no `cache_control` in `lib/agents/harness.ts`), so re-fires pay full token price. Assuming the standard Opus 4.x public rate of about $15 per million input and $75 per million output, the real per-case usage recorded in each fixture's `tokenUsage` gives:

| case | input tok | output tok | full re-fire cost |
|---|---|---|---|
| Bhatt | 79,417 | 33,306 | ~$3.69 |
| Surana | 59,740 | 31,187 | ~$3.24 |
| Iyengar | 43,309 | 19,806 | ~$2.14 |
| Malhotra | 43,174 | 19,881 | ~$2.14 |
| Menon | 32,362 | 13,305 | ~$1.49 |
| **total** | **258,002** | **117,485** | **~$12.7** |

(This reconciles with the ~$21 already spent: the five S2 cases are ~$12.7 of it, the rest being the S1 case-mode batch, IC1, and dev retries.)

**The crux: the LLM reasoning can be reused, so the re-fire is avoidable.** Two facts establish this:

1. **The prose cites "beta" qualitatively, never the value.** Across the five cases "beta" appears 10 to 16 times in `content.evidence` and 0 to 2 times in `content.briefing`, but every instance is skill-versus-market language, not a coefficient: a structured `skill_vs_beta` field, and phrases like "this is not skill; it is beta with fee drag", "a beta vehicle that happened to catch a regime tailwind", "single-regime beta event, not skill", "deep India macro beta". These judgments rest on returns, regime-stability, and alpha, not on `beta_3y`. `content.a3_so_what` cites beta zero times (consistent with the prior audit: A3 reads only `per_holding`, never the portfolio beta).

2. **The headline beta is deterministic and unread by the prose.** The ~1.5 portfolio and sleeve betas live in `content.risk_reward_stats`, which the S2 renderer does not read (WA9) and which no LLM agent consumes. Regenerating it changes no prose by construction.

So under **2-lite-B**, the only numbers that change are `beta`/`R-squared`/`TE`/`IR`; every number the prose actually cites (vol, sharpe, trailing returns, drawdown) is preserved because the NAVs are untouched. **Nothing the LLM wrote becomes inconsistent. Estimated API cost: ~$0.**

Under **2-lite-A**, the NAV regeneration preserves `vol_3y` and the sharpe-implied 3Y return exactly but does **not** pin the shorter trailing returns (the 1Y point-to-point the evidence quotes, for example "the 1Y return of 43.14%"). Those drift with the regenerated path, so the prose that cites them goes stale and the pipeline must re-fire. **Estimated API cost: ~$12.7** for the five cases (a touch above the $10 threshold, well below the feared full re-spend).

Per-case credit range: 2-lite-B is ~$0 across all five; 2-lite-A is ~$1.5 to ~$3.7 per case, ~$12.7 total.

## D. Option 2 (full real-data re-source), for contrast

The decision record explains why synthetic was chosen and why a real re-source is heavy. ADR-0009 (`:97-101`): the source data "carries fund-level `Benchmark Index` strings but no actual index time series", "86.6% of funds have no benchmark named", and real historical indices were rejected because "If stocks are synthesized but indices use real history, the index will not equal the market-cap-weighted return of its constituents". So Option 2 means sourcing real index series, real fund NAV histories, and real stock prices (Bloomberg-class), then cleaning and gap-filling, which is outside the codebase and not scoped here.

The load-bearing point for the fork: **Option 2 incurs the Section B/C regeneration cost on top of the sourcing effort.** Real data still has to be loaded into the snapshot, the tier_b recomputed, and, because real NAV paths differ entirely from the synthetic ones, the case pipeline fully re-fired (more than $12.7, since real data changes everything the prose cites, not just beta). Option 2 is strategically cleanest and is the only path that makes the betas real rather than rescaled, but it is the most expensive in both effort and credits. ADR-0014 already commits that this is the production path ("production replaces the regeneration with real fund NAV and real index data", `:58`).

## E. Things the framing did not name

- **2-lite-B itself is the headline of this section.** A post-hoc equity-index rescale normalises the betas with zero NAV regeneration, zero LLM re-fire, and zero credits, at the price of an ADR-0009 invariant deviation. The framing assumed any data change forces regeneration cost; for the rescale it does not.
- **The betas do fully normalise under the rescale, cleanly.** Because `R-squared` is scale-invariant and `beta` scales as `1/k`, you can target conventional betas precisely (pick `k` per the desired equity beta) without disturbing the co-movement the diagnostic relies on. There is no "betas might only half-normalise" risk in 2-lite-B; the math is exact.
- **Equity-only, t0-only is the minimal viable scope.** The debt betas are already conventional (the debt indices carry appropriate vol; the debt sleeve reads ~0.58). Only the 9 equity indices need rescaling, and only t0 is read by the five cases. The minimal fix is small.
- **The hidden cost in 2-lite-A is the trailing-return drift, not the deterministic compute.** It is easy to under-scope 2-lite-A as "just regenerate the data, it is deterministic and free", and miss that the regenerated NAV paths invalidate the LLM prose and pull ~$12.7. Naming it prevents a surprise re-spend.
- **A partial, showcased-only fix is possible but inconsistent.** You could rescale and refresh only the demo cases; but since the snapshot is shared, the cheap path already refreshes all five for ~$0, so there is no saving in narrowing further, and narrowing risks an inconsistent snapshot.
- **Risk to flag on 2-lite-B:** the rescaled index is no longer the weighted return of its constituents, so any future workstream that asserts index-equals-constituents (regime probes, look-through that reconstructs an index from holdings) would need to know the equity indices were rescaled. This is a documentation and ADR obligation, not a credit cost, but it is real and should not be silent (WA5 / WA28).

## Honest read of the three options

- **Option 1 (ship with caveats):** the kickoff already rejects it on credibility grounds, and the provenance diagnostic supports that: a 1.5 beta with a footnote inverts the believability proposition in a demo. Agreed it is not a safe fallback.
- **Option 2 (full real re-source):** the only path that makes the betas genuinely real; strategically cleanest; the most expensive in sourcing effort and in credits (a full re-fire beyond $12.7, plus sourcing). Right answer for production, heavy for the lean phase.
- **Option 2-lite:** real and surgical. 2-lite-B (rescale) is the standout: betas into conventional ranges, all expensive reasoning preserved, ~$0 credits, at the cost of a documented ADR-0009 deviation. 2-lite-A (re-tune at source) keeps the invariant clean but costs ~$12.7 and a re-fire. If the goal is believable betas at the lean-phase budget, 2-lite-B meets the $10 threshold with room to spare; if the goal is to keep the synthetic-data architecture internally pure, 2-lite-A or Option 2 is the price of that purity.

This audit changes nothing. It does not propose narration wording, does not reopen the build math, and does not execute any data change. The build stays parked at the Phase 2 stop, the back-fill tooling uncommitted, awaiting the primary's strategic call and an explicit go-ahead.
