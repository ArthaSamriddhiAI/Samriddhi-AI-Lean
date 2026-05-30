# ADR 0032: Mandate allocation targets, band midpoint by default with an optional explicit target

## Status

Accepted, 2026-05. Shipped as part of T-5.12 Finding 5 on `features/a3-so-what`, PR #11. The target resolver is `resolveTargetBands` (`lib/agents/portfolio-risk-analytics.ts`), verified deterministically (`scripts/_verify-a3-so-what.ts`). The optional `target_pct` field is on `AssetClassBand` (`db/fixtures/structured-mandates.ts`); Menon is the only investor that sets it in this build.

## Context

Finding 5 made the per-investor mandate the source of the asset-class targets that A3 reasons against, so the Samriddhi 2 diagnostic stops assessing every investor against the flat aggressive model bands. The mandate schema (`Mandate.bands`, an `AssetClassBand[]`) carries a tolerance band per asset class (`min_pct`, `max_pct`) but historically no target. Finding 5 therefore had to derive a target from the band.

The band-structure analysis (recorded in the PR #11 discussion) established the shape of the existing mandates:

- The bands are bespoke, hand-authored per investor, not produced by a risk-appetite by time-horizon framework. Three investors with identical classification tags (Bhatt, Sharma, Menon, all aggressive long-term) carry three different band sets, which proves the bands are not a function of the tags.
- For the standard aggressive bands, the midpoint reproduces the foundation model targets exactly on Equity (60 to 70, midpoint 65) and Debt (20 to 30, midpoint 25). These bands are symmetric around the intended target, so the midpoint is a sound target.
- The Alternatives and Cash bands tend to be widened on one side (a permissive ceiling), so their midpoint overstates the intended target. The clearest case is Menon, whose Alternatives band (5 to 20) and Cash band (2 to 10) were widened to accommodate pre-IPO positions and a deployment runway, not to target the middle. Reading his midpoints as targets (Alternatives 12.5, Cash 6) would over-deploy into Alternatives and over-retain cash relative to intent.

A band expresses tolerance and permission ("the allocation may sit anywhere in here without triggering a rebalance"). A target expresses intent ("this is where we want it to sit"). When the band is symmetric around intent the midpoint recovers the target; when the band is one-sidedly widened it does not. The two concepts had been conflated because the schema could only express the band.

## Decision

The mandate allocation target resolves as follows, per asset class:

1. If the band sets an explicit `target_pct`, that is the target (and the deploy-to-target destination).
2. Otherwise the target is the band midpoint, `(min_pct + max_pct) / 2`.
3. If the investor has no mandate, or the asset class is absent from it, the flat foundation `MODEL_BANDS` target is the fallback.

`target_pct` is added as an optional field on `AssetClassBand`, backward-compatible: a mandate that sets no targets behaves exactly as it did under the midpoint-only Finding 5. In this build only Menon sets explicit targets (Equity 65, Debt 15, Alternatives 15, Cash 5; these sum to 100 and sit within his bands, consciously placed rather than midpoint-derived). The other four investors keep the midpoint, which is already correct for their symmetric Equity and Debt bands.

## Consequences

- Menon's deploy-to-target now reflects consciously authored intent (Alternatives toward 15 rather than the midpoint 12.5, cash retained at 5 rather than 6), rather than the artifact of his permissive ceilings.
- The midpoint remains the convenient default for the symmetric-band cases, so no other mandate needs editing and no other investor's diagnostic changes from setting this field.
- The change is local to the target resolver (one branch) and the mandate data; the deploy-to-target machinery is unchanged.

## Forward note

This ADR is a stepping-stone, not the final allocation framework. There is currently no risk-appetite by time-horizon to bands framework; the per-investor mandates are bespoke and the classification tags are attached post-hoc (see product debt on the model-portfolio framework gap). When that framework is formalized, and per-investor customization is built out for the forthcoming larger investor cohort, explicit targets become the general mechanism a mandate uses to state intent directly, and midpoint-fallback becomes the interim convenience for the demo personas whose symmetric bands happen to make it correct. The optional `target_pct` field is the seam that lets that evolution happen without another schema change.

## References

- `lib/agents/portfolio-risk-analytics.ts` (`resolveTargetBands`, the one-branch resolver).
- `db/fixtures/structured-mandates.ts` (`AssetClassBand.target_pct`; Menon's explicit targets).
- ADR-0031 (A3 So-What placement); the band-structure analysis in the PR #11 discussion.
