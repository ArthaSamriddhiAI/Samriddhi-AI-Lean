---
name: capability-scope
description: Use during a capability workstream when deciding what is in scope, whether to log debt instead of expanding, whether the work touches UI or render, or how to backfill fixtures. It enforces the scope and capability-shape working agreements so a narrow capability ship does not balloon, render piecemeal, or stub its data.
---

This skill implements five working agreements. Read the canonical text in the spec before relying on a paraphrase:

- `docs/working_agreements/WA05_product_debt_over_scope_creep.md` (log out-of-scope discoveries as debt, do not expand scope)
- `docs/working_agreements/WA08_surface_debt_before_pr.md` (list every debt entry before opening the PR)
- `docs/working_agreements/WA09_capability_ships_data_design_ships_render.md` (capability ships data, the design pass ships render)
- `docs/working_agreements/WA15_wireframe_before_capability.md` (the wireframe lands before the capability that implements it)
- `docs/working_agreements/WA16_real_reasoning_over_stubs.md` (backfill fixtures with real reasoning, not stubs)

## Operative steps

1. When you discover something out of scope, log it in the right series under `docs/debt/` rather than expanding the workstream to fix it.
2. Capability work ships data only (fixtures, schemas, pipeline output). Do not add render surfaces; the existing renderer must tolerate new fields without surfacing them. Log render decisions for the design workstream.
3. If the surface is being designed, the wireframe or design artifact lands first; the capability inherits its register from there.
4. When backfilling existing fixtures with new capability data, inject real model output via partial pipeline activation, not hand-authored stubs. That incurs API spend, so it is gated by WA12; surface the cost first.
5. Before opening the PR, list every debt entry logged, or that should have been logged, during the workstream.

If your operative read here ever conflicts with the spec files above, the spec wins.
