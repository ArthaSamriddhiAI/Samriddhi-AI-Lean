# Working Agreements

Pre-specified rules for how the AI agents and the product owner collaborate on this build. One file per agreement: header (full text), rationale (why it exists / what failure mode it prevents), trigger (what caused it), examples (compliance and non-compliance), cross-references.

Reading these is mandatory for anyone making changes. Non-engineering humans-in-the-loop should start here: each file is written to be understood without reading code.

This per-file structure is the durable home for working agreements; it supersedes the deferred single `docs/conventions.md` idea and closes debt entry T8. WA1 through WA9 were transcribed from out-of-repo CC build prompts (rationale and trigger are partial and marked as such); WA10 and WA11 originated in the A2 workstream; WA12 originated in the risk-reward workstream; WA13 and WA14 originated in the s1-case-generation workstream; WA15 through WA18 were codified from planner v11.3 during T-5.06 (time-series-performance). WA19 and WA20 emerged from T-5.06 Phase B incidents and were codified to disk during T-5.07's WA registry audit, after operating in prose across two workstreams; WA21 through WA25 emerged at task-chat level during T-5.07 at points of operational friction (registry verification, audit-phase discipline, conventions inheritance, numbering allocation, and planner-versus-task chat separation) and were codified inline. WA01 carries a T-5.07 clarification on repository-level protection-rule respect. WA04 was consolidated into WA01 during T-5.07 after the audit revealed it as a workstream-template duplicate; its slot is preserved as a stub because in-repo references follow on-disk numbering.

| WA | Title |
|----|-------|
| [WA01](WA01_no_self_merge.md) | No self-merge |
| [WA02](WA02_audit_before_integration.md) | Audit before integration |
| [WA03](WA03_two_hard_checkpoints.md) | Two hard checkpoints per workstream |
| [WA04](WA04_no_self_merge_workstream_form.md) | Consolidated into WA01 (slot stubbed) |
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
| [WA16](WA16_real_reasoning_over_stubs.md) | Real reasoning over stubs |
| [WA17](WA17_questions_in_message_output.md) | Questions live in the message output |
| [WA18](WA18_prompts_ship_as_markdown.md) | Prompts ship as markdown files by default |
| [WA19](WA19_ping_internal_gates.md) | Ping-internal gates are criterion-based |
| [WA20](WA20_no_unsanctioned_memory_writes.md) | No unsanctioned memory writes |
| [WA21](WA21_verify_before_adding.md) | Verify before adding |
| [WA22](WA22_audit_phase_as_deliverable.md) | Audit phase as a versioned deliverable |
| [WA23](WA23_conventions_by_reference.md) | Conventions inherited by reference, not by re-listing |
| [WA24](WA24_numbering_at_landing.md) | Numbering allocated at landing, not at planning |
| [WA25](WA25_planner_vs_task_chat.md) | Planner chat for planning, task chats for execution |
| [WA26](WA26_persona_snapshot_alignment.md) | Persona holdings verified against the snapshot before locking |

When a new working agreement is adopted, add a file here following the same structure and a row above; confirm the next available WA number against this directory rather than a hard-coded number from chat context (numbering discipline, per the debt-log convention).
