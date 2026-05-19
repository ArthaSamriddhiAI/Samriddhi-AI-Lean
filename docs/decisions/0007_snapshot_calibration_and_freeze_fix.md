# ADR-1: Monthly Compounds to Quarterly; Freeze Fix as Side Effect

**Status:** Accepted
**Date:** Phase A audit + Phase C implementation
**Supersedes:** None
**Folds:** Original ADR-1 (calibration) + ADR-10 (freeze fix)

## Context

The existing `generate_snapshots.py` engine evolves snapshots t1..t8 from a baseline t0 by computing one quarterly return per fund (`q_drift + q_shock + surgical_event_deltas`) and applying it to NAV, AUM, CMP. The engine explicitly declares `mf_funds[].monthly_nav` and `rolling_metrics` as `static_fields`, meaning they're never updated during forward evolution.

This produces a real internal inconsistency: at t5 (July 2027), `mf_funds[].NAV` reflects post-bank-shock state but `monthly_nav` ends at 2026-05 (pre-bank-shock). Anyone reading `monthly_nav['2027-07']` at t5 gets `None`. Anyone computing trailing-window statistics from `monthly_nav` at t5 gets pre-t0 results.

Snapshot enrichment needs to add monthly-frequency series to support downstream risk-reward, time-series, and overlap workstreams. This requires extending `monthly_nav` forward (fixing the freeze) and synthesizing monthly_prices for stocks and FX.

The load-bearing question: how is the new monthly series related to the existing quarterly evolution?

## Decision

**Quarterly engine outputs remain canonical. Monthly series is calibrated to compound exactly to those quarterly outputs.**

The existing engine continues to produce quarterly NAV, CMP, AUM values unchanged. The enrichment extends `monthly_nav` and synthesizes `monthly_prices` by:

1. Sampling 3 monthly noise terms from category-appropriate distributions
2. If a narrative-beat surgical event is pinned to a specific month within the quarter, overriding that month's noise to the surgical delta
3. Computing the adjustment that makes the 3 monthly returns compound exactly to the quarterly return implied by the existing engine

Tolerance is zero by construction. There is no possibility of disagreement between the canonical quarterly value and what the monthly series implies.

The freeze fix is explicit, not silent. The product thesis and this ADR document both call out that the existing engine's freeze of `monthly_nav` was a real gap that this enrichment closes.

## Alternatives considered

**Alternative A: Replace the quarterly engine with a monthly synthesis engine.**
Cleaner architectural shape, but requires re-validating the narrative beats (rate cut, bank shock, RIL idio, smallcap rally) against new outputs. High implementation cost; risk of regression on the test axis design. Rejected.

**Alternative B: Run the quarterly engine and monthly synthesis independently; accept tolerance.**
Implementable, but means a diagnostic reading `mf_funds[].NAV` and a diagnostic reading `monthly_nav[last_month]` can disagree. Trust-eroding for downstream consumers. Rejected.

**Alternative C: Leave the freeze as-is; sentinel the missing monthly data.**
Considered briefly. Rejected because the affected demos (Imtiaz, Vikas, Bhatt) make claims about concentrated direct-stock exposure that require monthly-frequency data to support diagnostically.

## Consequences

**Positive:**
- Existing engine is the canonical narrative anchor; no risk of regressing the test axis design.
- Zero tolerance between quarterly and monthly values means downstream consumers can read either with consistency.
- Freeze is fixed; trailing-window computations off `monthly_nav` produce values reflecting the snapshot's actual time.

**Negative:**
- When the existing engine produces an unusual quarterly value (e.g., source data missed applying the bank shock to a specific stock), the monthly series shows implausible intra-quarter compensating moves. SBI in t5 is the canonical example: the existing engine's substring-based bank detection missed SBI, so its t5 quarterly return is +10% instead of the design-doc-intended -18%. Our calibration faithfully reproduces +10% by having May/June pump moves to offset the surgical -18% in July. This is honest to the principle but produces noisy intra-quarter patterns for affected instruments.

These cases are flagged as findings to surface to planning chat alongside cluster-3 cleanup; the enrichment itself does not fix them.
