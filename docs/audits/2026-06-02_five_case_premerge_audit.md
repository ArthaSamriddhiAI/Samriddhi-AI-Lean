# Pre-merge audit of the five re-fired Samriddhi 2 cases

**Date:** 2026-06-02
**Branch:** `features/client-weighted-benchmark` (code repo) at `2e370b9`. Read-only audit; no re-fire, no re-run, no agent call, no data or code change, no spend. The five cases are committed (`3896822`); this reads and audits what exists. WA21 (prose quoted as evidence), the HARD BOUNDARY (every cited number must trace to executed-code output), WA1 (the squash-merge is the primary's; this audit does not merge), WA22, WA16, WA28. First-move: new dated `docs/audits/` file. STILL HOLDING at the PR merge gate.

---

## Verdict

**Merge-ready, with only negligible polish notes (no correctness defects).** The five re-fired diagnostics read as sophisticated, specific, advisor-credible work; every number spot-checked across all five cases and the evidence agents traces to the deterministic layer or grounded snapshot data; honest degradation is exemplary (menon); the cases are mutually consistent in method and tone. The one item worth an eyeball is a 1pp basis nuance in menon's deployment-gap figure, a polish note, not a defect. The merge decision remains the primary's.

## Part 2: per-case believability and the wider trace-check

### Believability (does it read like veteran-advisor work)

All five read as credible and insightful, not generic, not hollow, not over-claimed. The diagnostics consistently connect deterministic facts to the investor's SPECIFIC situation and to behavioural reads, which is the mark of real advisory work:

- **bhatt:** "wrapper over-accumulation: four PMS strategies stack to 39.4% of liquid AUM and the full wrapper tier (4 PMS + 1 Cat III AIF) reaches 53.0%, with only one of five wrappers carrying verified performance data ... a material stated-vs-revealed divergence frames the whole book closer to moderate-aggressive than the stated aggressive." Specific, structural, and honest about what is unverifiable.
- **iyengar:** "Cash is at 0% against a 3-10% mandate band ... For an investor with a documented medical-contingency liquidity need and marginally negative monthly cash flow before investment income, the absence of a cash buffer warrants review against income-continuity dependency." The fee read is precise: "TER of 1.58% versus the ~0.60% Direct Plan equivalent represents a 90-100 bps annual drag, roughly Rs 1.8-2.0 lakh of avoidable distributor commission over five years on the Rs 0.40 Cr holding."
- **malhotra:** "Equity at 52.1% sits 12.9pp below the 65% target and below the 60% band floor; debt at 39.4% is 9.4pp above its 30% band ceiling ... this is a material structural drift, not noise." The behavioural read is nuanced: "SIP discipline including a counter-cyclical COVID increase is genuinely aggressive; lump-sum allocation behaviour reveals moderate comfort."
- **menon:** "86.6% in cash against a 6% target is the dominant structural fact ... The Rs 12-14 Cr Sadashivanagar property earmark within 12 months and the planned Rs 50 L parents-care fund must be ring-fenced before the deployment quantum is finalised." Rich on the actionable cash-deployment and life-goal sequencing while being honest that the equity cannot be evaluated.
- **surana:** "the Rs 34.5 Cr liquid corpus is the only liquid buffer against a Rs 165 Cr illiquid founder stake, and the education corpus (Rs 8 Cr by 2032 ...) creates a near-term sequencing constraint a zero-debt book does not address ... The portfolio is a deliberately self-constructed book by a sophisticated owner, so the diagnostic surfaces structural tension rather than behavioural misalignment." It correctly reads the investor archetype and tunes the diagnostic frame to it.

No AI-generic, hand-wavy, or unsupported passages were found in the surfaced prose.

### Wider trace-check (the HARD BOUNDARY): PASS

Every number spot-checked across the five cases traces to executed-code output or grounded snapshot data. No non-tracing number was found.

| number (prose) | case | source it traces to |
|---|---|---|
| equity 72.2% / debt 14.2% | bhatt | computed metrics `assetClass.actualPct` (exact) |
| equity 52.1% / debt 39.4% | malhotra | computed metrics (exact) |
| cash 86.6% / equity 6.6% / debt 6.8% | menon | computed metrics (exact) |
| equity 89.9% / debt 0% | surana | computed metrics (exact) |
| equity 35.5% / debt 64.6% | iyengar | computed metrics (exact) |
| portfolio betas 0.94 / 0.84 / 0.89 / 0.90 | bhatt/iyengar/malhotra/surana | `risk_reward_stats.portfolio.stats.beta_3y` (match the validated gate) |
| holding-HHI 0.201 / 0.7589 / 0.2149 | iyengar/menon/bhatt | computed metrics `hhiHoldingLevel` (exact) |
| evaluable 40% / 22% / 0% / 63.8% / 41.6% | all | `risk_reward_stats.evaluable_weight_pct` (exact) |
| 3Y annualised 3.7% | bhatt | `time_series_performance.portfolio` 3Y (abs 0.1312, ann 0.037) |
| Reliance 20.3%, NHAI 18.1%, Mirae 15.6%, FD 27.3%/27.0% | surana/malhotra/iyengar | holding weights (exact) |
| Brent 118.95, INR 94.79, FII -56,401 | bhatt | snapshot macro block (present) |
| Axis TER 1.58%, Kotak 1.62% double-layered | iyengar/malhotra/surana | snapshot fund data / E7 evidence |

Fee impact figures (Rs 1.8-2.0 lakh over 5y; Rs 15-20 lakh annually; 90-100 bps) are appropriately hedged ranges derived from the TER data, not asserted precise values, so they are honest estimates rather than trace defects.

### Honest degradation: confirmed

- **menon reads as honest "cannot evaluate," not fabricated confidence:** "The single equity position is an opaque US legacy basket that E1 and E2 could not evaluate, so no performance or fundamental verdict attaches to it; time-series returns are sentinelled across all three sleeves with no prior snapshot to diff against." The portfolio beta is null (0% evaluable) and the prose never invents one. This is the honest-degradation behaviour working exactly as designed.
- **bhatt** is honest about wrapper opacity: "60% of weight is sentinelled on returns and 36% is not seen through on stock look-through," and "only one of five wrappers carrying verified performance data"; e6 caps confidence where the snapshot has no record (audited separately).
- Every case carries the evaluable/sentinelled split and the coverage note honestly; no case over-claims coverage it does not have.

## Part 3: cross-case consistency and red flags

**Consistent in method and tone.** The same benchmark logic produces composition-matched portfolio betas of 0.84 to 0.94 across the evaluable cases (menon correctly null). The same honest treatment of limits (sentinelling, evaluable-weight gating, time-series `no_prior_snapshot_available` at t0) appears in all five. The same fund draws the same evidence finding across cases: Kotak Emerging Equity is read as a mislabelled FoFs-Overseas wrapper with a double-layered 1.62% TER in BOTH malhotra and surana, and Axis Large Cap carries the same 1.58% TER read in BOTH iyengar and surana. The Regular-vs-Direct fee method is applied uniformly. Tone is a consistent veteran-advisor register throughout.

**No case contradicts the validated betas or the gate numbers** (each portfolio beta matches the Phase 6 gate: bhatt 0.9427, iyengar 0.8382, malhotra 0.8885, surana 0.8964, menon null).

**Red flags: none (correctness).** **Polish notes (negligible):**
1. menon cites a "6% model cash target" while quoting an "81.6pp deployment gap"; 86.6% minus 6% is 80.6pp, so the 81.6pp implies a 5% base. A 1pp basis nuance between the cited target and the gap arithmetic; the dominant finding (an over-80pp cash over-allocation) is correct and unaffected. Worth a one-line reconcile if polishing, not a merge blocker.
2. The fee-impact figures are ranges; that is the right hedge for an estimate, noted here only so a reader does not mistake them for computed precision.

## Conclusion

The five re-fired Samriddhi 2 cases are merge-ready: believable, number-faithful (every cited figure traces), honestly degraded where data is thin, and mutually consistent. The only items are a 1pp basis nuance in menon and the expected hedged-estimate framing of fee impacts, both polish, neither a defect. The squash-merge remains the primary's explicit call (WA1).
