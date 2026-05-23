# Working Agreements

Pre-specified rules for how the AI agents and the product owner collaborate on this build. One file per agreement: header (full text), rationale (why it exists / what failure mode it prevents), trigger (what caused it), examples (compliance and non-compliance), cross-references.

Reading these is mandatory for anyone making changes. Non-engineering humans-in-the-loop should start here: each file is written to be understood without reading code.

This per-file structure is the durable home for working agreements; it supersedes the deferred single `docs/conventions.md` idea and closes debt entry T8. WA1 through WA9 were transcribed from out-of-repo CC build prompts (rationale and trigger are partial and marked as such); WA10 and WA11 originated in the A2 workstream; WA12 originated in the risk-reward workstream.

| WA | Title |
|----|-------|
| [WA01](WA01_no_self_merge.md) | No self-merge |
| [WA02](WA02_audit_before_integration.md) | Audit before integration |
| [WA03](WA03_two_hard_checkpoints.md) | Two hard checkpoints per workstream |
| [WA04](WA04_no_self_merge_workstream_form.md) | No self-merge (workstream-template form of WA01) |
| [WA05](WA05_product_debt_over_scope_creep.md) | Product debt over scope creep |
| [WA06](WA06_flag_and_wait_freely.md) | Flag and wait freely |
| [WA07](WA07_no_long_dashes.md) | No long dashes anywhere |
| [WA08](WA08_surface_debt_before_pr.md) | Surface debt entries before PR |
| [WA09](WA09_capability_ships_data_design_ships_render.md) | Capability ships data, design ships render |
| [WA10](WA10_push_every_commit.md) | Push every commit |
| [WA11](WA11_dual_write_handoff.md) | Dual-write hand-off |
| [WA12](WA12_api_call_gate.md) | Explicit API-call gate |
| [WA13](WA13_samriddhi_1_2_naming.md) | Samriddhi 1 / Samriddhi 2 naming discipline |
| [WA14](WA14_privacy_boundary_for_data_artifacts.md) | Privacy boundary for data artifacts |
| [WA15](WA15_wireframe_before_capability.md) | Wireframe before capability |

When a new working agreement is adopted, add a file here following the same structure and a row above; confirm the next available WA number against this directory rather than a hard-coded number from chat context (numbering discipline, per the debt-log convention).
