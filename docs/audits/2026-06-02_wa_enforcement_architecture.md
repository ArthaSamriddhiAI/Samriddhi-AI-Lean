# Audit and proposal: working-agreement enforcement architecture (skills / CLAUDE.md / hooks / subagents)

- **Date:** 2026-06-02
- **Branch:** `chore/v15-wa-enforcement-architecture`, cut off fresh `main` at `7907a0e` (post PR #14).
- **Mode:** Read-only audit plus written proposal. No skills, hooks, CLAUDE.md, subagents, slash commands, or settings were created in this pass. The only write is this document. The primary reviews before anything is built.
- **Location choice:** This lands in `docs/audits/` (not `docs/proposals/`, which does not exist). The audit corpus already carries proposal-shaped docs, for example `docs/audits/2026-06-01_yield_to_tr_conversion_proposal.md`, so `docs/audits/` is the established convention for a read-only-audit-plus-recommendation deliverable.
- **WAs governing this doc:** WA22 (this is itself an audit-phase deliverable), WA21 (verify before asserting, quote as evidence), WA27 (repo-relative paths throughout), WA07 (no long dashes anywhere in this doc), WA24 (any new artifact IDs resolved at landing, not pre-allocated), WA28 (the genuine judgment calls are surfaced to the primary in Section 8, not silently defaulted), WA01 (squash-merge only on the primary's explicit confirmation; this branch is preserved, not auto-deleted).
- **Revision:** Rev 2 (2026-06-02 follow-up). After the primary reviewed Rev 1 (commit `a4978d7`), this revision folds in three settled decisions and one new principle: the spec-versus-implementation north star (stated next), the chat-side project-instruction block promoted to a first-class implementation (Sections 3.6, 7, 8), the WA07 two-layer reframing (Sections 2, 3.1, 8), and a candidate new working agreement (parallel reads, serial writes) recorded for ratification at build-landing (Section 8). This revision pass likewise builds nothing; it edits this doc only.

---

## North star (settled framing): the working agreements are the specification, everything else is an implementation

The primary has locked the architectural principle that governs every choice below, so it is stated first.

**The `docs/working_agreements/` files are the specification: the single source of truth. Every other artifact, `CLAUDE.md`, skills, hooks, subagent definitions, permissions, and the chat-side project-instruction block, is an _implementation_ of that specification on a particular surface. Implementations reference the spec; they never copy its prose.**

This is WA23 fully realized rather than merely enforced: drift is impossible by construction when no implementation carries a second copy of the rule to drift from. It also resolves the plugin tension cleanly. A plugin, if it is ever built, is just one more implementation that references the spec; it is never a second source of truth (Section 4 carries this through). Read every row of the triage in Section 2, and every component in the rollup in Section 3, as an implementation pointing back at the canonical files, never as a home for the rule itself.

---

## 0. Method and verification provenance

Two evidence streams back this proposal, per WA21 (verify before asserting):

1. **In-repo state** was read directly. All 28 working-agreement files in `docs/working_agreements/` were read in full. The tooling surface was swept with `find` and `grep`. The prior `docs/audits/2026-05-18_conventions_consolidation.md` and `docs/audits/2026-05-31_buildable_now_and_model_tiering.md` were read in full. The debt logs under `docs/debt/` were grepped for enforcement signals. Paths and quotes below are from those reads.

2. **Claude Code capability claims** were verified against current Claude Code behaviour by a read-only `claude-code-guide` subagent (the Explore-style audit pattern this proposal recommends, run here as dogfood). The installed Claude Code version it reported is **2.1.139**. Capability findings are marked "verified (CC 2.1.139)" where they rest on that check. Where a claim is version-sensitive, it is flagged.

Nothing in this pass was assumed from training-data memory of how Claude Code works; the load-bearing capability claims (hook blocking scope, subagent model selection, plugin file-referencing, plan mode, commands-versus-skills) were checked.

---

## 1. Audit findings: current state

### 1.1 The 28 working agreements on disk

All 28 are present in `docs/working_agreements/`, one file per agreement, named `WA01_*.md` through `WA28_*.md`, with a `docs/working_agreements/README.md` index. The per-file structure is header (full agreement text), rationale, trigger or provenance, examples (compliance and non-compliance), cross-references. This is the canonical home; per `docs/working_agreements/README.md` it "supersedes the deferred single `docs/conventions.md` idea and closes debt entry T8."

Phrasing classification (judgment-guidance versus mechanical-rule versus gate), read off the actual text:

- **Hard gates** (stop and wait for an explicit affirmative before a sensitive, hard-to-reverse action): WA01 (merge), WA12 (API spend), WA28 (product-shape choice). WA01 is explicit: "CC stops, asks the owner directly ... and waits for explicit affirmative approval."
- **Mechanical rules** (a script could check compliance): WA07 (no long dashes), WA10 (push every commit), WA13 (no bare S1 or S2 for the workflows), WA14 (origin-based data privacy at commit), WA20 (no memory writes), WA26 (persona-snapshot check at exit 0). Several already name their own enforcement mechanism on disk (see 1.5).
- **Situational judgment** (activates when a workstream or surface opens): WA02, WA03, WA08, WA09, WA15, WA16, WA21, WA22.
- **Always-on judgment** (a posture that applies every turn): WA05, WA06, WA17, WA19, WA24, WA27, WA28.
- **Orchestration and authoring patterns** (who does what, across chats and sessions): WA11, WA18, WA23, WA25.
- **Stub:** WA04 was consolidated into WA01 during T-5.07; `docs/working_agreements/WA04_no_self_merge_workstream_form.md` is a preserved stub kept only so on-disk numbering does not cascade. It needs no enforcement mechanism.

Most WAs are combinations (a gate is also always-on; a mechanical rule still has a judgment residue). The triage in Section 2 records the combinations rather than forcing one class.

### 1.2 Tooling primitives: the surface is greenfield

The current enforcement mechanism for all 28 WAs is prose on disk plus re-pasting into prompts. There is no native tooling wired. Confirmed by sweep:

- **No `CLAUDE.md`** anywhere in the repo (root, nested, or `.claude/`).
- **No skills.** No `SKILL.md` anywhere.
- **No hooks.** No `.husky/`, no `.pre-commit-config.yaml`, no active `.git/hooks/` (only the default `.sample` files), no `.github/` (no CI at all).
- **No subagents.** No `.claude/agents/`.
- **No slash commands.** No `.claude/commands/`.
- **No settings.** No `settings.json` or `settings.local.json`.
- **No plugin scaffolding.** No `.claude-plugin/`, no `marketplace.json`.
- **`.claude/` holds exactly one file:** `.claude/launch.json`, a dev-server launch config (`npm run dev`, port 3000). It is **gitignored** (confirmed via `git check-ignore`) and unrelated to skills, hooks, or agents.

So every component this proposal recommends is net-new. There is no existing wiring to migrate or conflict with. That is the clean part: the build is additive.

One non-obvious current surface worth recording: a handful of WAs are already partially enforced through **Claude Code user-memory feedback files** (the per-user memory store), which currently encode the "ask questions inline, not as pop-ups" rule (WA17), the repo-relative-paths rule (WA27), and the PR-body conventions. That surface is per-machine, not versioned with the repo, and does not transfer to a collaborator; it is a fragile enforcement leg, not a canonical one. It corroborates that these WAs are live and exercised, and it is one more scattered home that a deliberate architecture would consolidate.

### 1.3 The drift problem (WA23) is real and located

WA23 ("Conventions inherited by reference, not by re-listing") names the exact failure this effort targets: "Kickoffs do not re-list WAs from the planner's working memory, because the re-listing introduces drift: the lister works from memory; the canonical files are the truth." Its provenance records a concrete instance: the T-5.07 kickoff re-listed WA1 with superseded text and "operating against the older listing for several turns introduced silent drift."

Where the re-listing happens, located by WA-reference density across `docs/`:

- **In-repo handoff and PR docs** re-list WAs as content blocks: `docs/workstreams/a2_classification_handoff.md`, `docs/workstreams/risk_reward_handoff.md`, `docs/workstreams/snapshot_enrichment_PR.md`.
- **The prior consolidation audit** `docs/audits/2026-05-18_conventions_consolidation.md` already diagnosed this at WA1 through WA11 and found the sharpest gap then: "WA7 and WA9 are cited in-repo by number but their defining text is out-of-repo only." It also found the structural anchor this proposal builds on: WA11 is "the only WA whose enforcement is structural."
- **Out-of-repo kickoff prompts and audit pings** (the planner and task-chat markdown files, the surface this very ping was authored on) are the highest-volume re-paste site. They live in the plan folder, outside the repo, and are exactly where WA23's named failure occurred.

The core win to validate: a skill or CLAUDE.md line that says "read `docs/working_agreements/`" replaces the copy. The canonical text stops being transcribed and starts being referenced. That is achievable; the architecture below is built around it.

### 1.4 Current Claude Code model and subagent config

- **Main session model:** this audit session runs on an Opus-class model. There is no committed session-model config in the repo (no `settings.json`), so model selection is currently whatever the primary launches with, per machine.
- **Subagents:** none defined. No `.claude/agents/`.
- **Subagent model selection is available** (verified, CC 2.1.139): a subagent defined in `.claude/agents/*.md` can pin its own model via a `model:` frontmatter field, valid values being `opus`, `sonnet`, `haiku`, a full model ID, or `inherit`. Resolution order is the `CLAUDE_CODE_SUBAGENT_MODEL` env var, then a per-invocation model parameter, then frontmatter, then the main session model. This is the capability the model-tiering leg (Section 6) depends on, and it is real.
- **Skills cannot pin a model** (verified, CC 2.1.139): there is no `model:` field in `SKILL.md` frontmatter. A skill inherits the session model. So CC model tiering is a subagent and settings concern, not a skill concern, exactly as the ping framed it.

### 1.5 In-repo enforcement signals already logged

The repo has already reasoned about mechanical enforcement for three WAs, which corroborates their hook classification below and gives the build a head start:

- **WA13 to P28** (`docs/debt/product_debt_log.md`): proposes "(A, recommended minimal) a pre-commit hook grepping changed files for `\bS1\b` / `\bS2\b`, whitelisting legitimate references ..., blocking non-whitelisted matches with a WA13 pointer; (B) a CI check ...; (C) both." The hook design already exists on disk.
- **WA10 to O4** (`docs/debt/operational_debt_log.md`): "whether to add a pre-commit or post-commit hook that enforces push, or whether the explicit per-report verification is sufficient discipline," routed to a "Slice 7 audit (hook-vs-discipline decision)." This proposal is a reasonable home to answer that.
- **WA14 self-enforcement note** (`docs/working_agreements/WA14_privacy_boundary_for_data_artifacts.md`, Enforcement section): "Future P-debt entry may add automated enforcement: a pre-commit hook or CI check that flags new files in data-suggestive paths (`db/fixtures/`, `fixtures/`, etc.) and requires explicit acknowledgment of the classification before commit lands."

WA26 ships with a real check already (`npm run check:persona-snapshot`, utility `scripts/verify-persona-snapshot-alignment.ts`), so its gate is a wiring job, not a build-from-zero.

### 1.6 Security surface (brief)

Skills, hooks, subagents, and slash commands all inject instructions or execute scripts. Everything proposed here is first-party, authored by the primary, committed to the primary's own repo, and reviewed at merge per WA01. There is no third-party skill or marketplace install in scope. The standing discipline (audit all files, trusted sources only) already covers it. The one place to keep this in mind is the eventual plugin (Section 4): when the colleague installs it, the plugin's hook scripts run on their machine, so the plugin should ship only the primary's own reviewed scripts, and the colleague should read them before install, the same posture the primary already applies.

---

## 2. Per-WA triage table

**Enforceability class** uses the ping's taxonomy: **(a)** mechanically checkable by a script (hook), **(b)** always-on judgment (CLAUDE.md), **(c)** situational judgment (skill), **(d)** isolated-task or orchestration pattern (subagent). Combinations are written as they fall.

**Mechanism** abbreviations: HOOK (deterministic script on an event), CLAUDE (a line in a minimal `CLAUDE.md`), SKILL (progressive-disclosure instruction bundle that points at the canonical WA file), SUBAGENT (isolated-context task, optionally model-tiered), CMD (slash command, a saved prompt template), PERM (a `/permissions` allow or deny rule), CHAT (the chat-side project-instruction block, the chat-surface always-on implementation of the WAs, the twin of `CLAUDE.md`; see 3.6), STRUCTURAL (already enforced by file structure), NONE (no mechanism needed).

**Surface:** CC (Claude Code), Chat (planner and task chats), Both.

**Residency:** Repo (committed enforcement component), Plugin (packaged for distribution), Split (canonical WA text stays repo-resident, enforcement component can be packaged). Per the north star, the canonical WA prose (the spec) is **always** repo-resident in `docs/working_agreements/`; the residency column refers to the enforcement component, which is an implementation that references the spec.

| WA | Title | Class | Mechanism | Surface | Residency | One-line rationale |
|----|-------|-------|-----------|---------|-----------|--------------------|
| WA01 | Squash-merge with explicit confirmation gate | a + b | PERM (deny `Bash(gh pr merge:*)`) + HOOK (block merge absent a confirmation marker) + CLAUDE | CC | Repo | The merge is a CC tool call, so it is genuinely gateable; branch protection already backstops `main` server-side. |
| WA02 | Audit before integration | c + d | SKILL + plan mode + SUBAGENT (Explore) | Both | Split | Situational read-first discipline; plan mode is its near-native form, Explore isolates the reads. |
| WA03 | Two hard checkpoints per workstream | c | SKILL + CMD (kickoff template) + CHAT | Both | Split | A workstream-shaped pattern; lives in the kickoff template the chat authors and the skill CC reads. |
| WA04 | Consolidated into WA01 (slot stubbed) | n/a | NONE | n/a | Repo | Registry stub only; preserved for numbering, needs no enforcement. |
| WA05 | Product debt over scope creep | b | CLAUDE + SKILL (debt-routing) | Both | Split | Always-on posture, with a situational "route to the debt log" skill when a discovery lands. |
| WA06 | Flag and wait freely | b | CLAUDE | Both | Repo | Pure always-on judgment; one ruthless CLAUDE line, no script can judge "load-bearing." |
| WA07 | No long dashes anywhere | a + b | HOOK (block long-dash payloads in Write, Edit, `git commit`) + prompt layer (`CLAUDE.md` and the chat-side block) for chat prose + existing `stripLongDashes` (pipeline output) | Both | Repo | Two-layer: mechanical on files and commits (hook), prompt-enforced on free-text chat prose (CLAUDE.md and chat-side block). Both are real layers, not a gap. See 3.1 and 8. |
| WA08 | Surface debt entries before PR | c | SKILL + CMD (PR-prep) | CC | Split | Situational, fires at PR time; a checklist skill or command. |
| WA09 | Capability ships data, design ships render | c | SKILL | Both | Split | Situational scope discipline for capability workstreams; judgment, not mechanizable. |
| WA10 | Push every commit | a | HOOK (PostToolUse on `git commit`: push or verify) | CC | Repo | Push state is mechanically checkable; answers the open O4 hook-versus-discipline question. |
| WA11 | Dual-write hand-off | a + d | HOOK (warn if one of the paired files changed without the other) + SKILL | Both | Split | Already the one structurally-enforced WA; a hook makes the pairing active rather than convention. |
| WA12 | Explicit API-call gate | a + b | PERM (gate the API-invoking commands) + HOOK (block absent a surfaced estimate) + CLAUDE | CC | Repo | API calls fire through CC tool calls (scripts, npm), so they are gateable; cost estimate is the unlock. |
| WA13 | Samriddhi 1 / 2 naming discipline | a + c | HOOK (grep changed-file payloads for bare `S1`/`S2` with whitelist, per P28) + CLAUDE | Both | Repo | Mechanical but false-positive-prone; the whitelist tuning is a judgment call (Section 8). |
| WA14 | Privacy boundary for data artifacts | a + c | HOOK (flag new files in `db/fixtures/`, `fixtures/`, require classification ack) + SKILL (the origin test) | Both | Repo | Commit-time path check is mechanical; the origin-versus-shape classification stays judgment. |
| WA15 | Wireframe before capability | c | SKILL + CHAT | Both | Split | Situational sequencing discipline; surfaces in design-versus-build planning. |
| WA16 | Real reasoning over stubs | c | SKILL (binds to the WA12 gate) | CC | Split | Situational fixture-fidelity rule; its trigger also incurs API spend, so it cross-binds WA12. |
| WA17 | Questions live in the message output | a + b | PERM (deny the pop-up question tool) + CLAUDE | Both | Repo | Cleanly mechanizable in CC: deny the interactive-question tool so questions must be written text. |
| WA18 | Prompts ship as markdown files | c | CHAT (project instruction) + CMD (optional) | Chat | Split | Authoring happens in the chat surface; a CC slash command is a minor convenience, the home is chat. |
| WA19 | Ping-internal gates are criterion-based | b | CLAUDE + SKILL | CC | Split | How to read a gate is always-on judgment; the detail can ride the audit-discipline skill. |
| WA20 | No unsanctioned memory writes | a | PERM (deny Write and Edit to memory paths) + HOOK | CC | Repo (or user settings) | Memory writes are tool calls to known paths; deny by default, allow only on explicit "save this." |
| WA21 | Verify before adding | c + b | SKILL (quote-as-evidence audit) + CLAUDE | Both | Split | Situational registry discipline with an always-on residue; the skill encodes the read-first ritual. |
| WA22 | Audit phase as a versioned deliverable | c + d | SKILL + plan mode + SUBAGENT (Explore, model-tiered) + CMD (`/audit-kickoff`) | Both | Split | The highest-leverage WA for usage efficiency; isolate the reads in a subagent, ship the findings map. |
| WA23 | Conventions inherited by reference | b + d | The architecture itself (SKILL and CLAUDE point at canonical files, never copy) + CHAT | Both | The principle | This is the meta-WA the whole effort serves; satisfied by pointer-not-copy across every component. |
| WA24 | Numbering allocated at landing | b + c | CLAUDE + CHAT + ties to the WA21 skill | Both | Split | Planner-side "next free in series X" plus executor-side resolve-at-landing; partly a chat rule. |
| WA25 | Planner chat vs task chats | d | CHAT (project instructions) + the SUBAGENT isolation analogue in CC | Chat | Split | Retained, not collapsed; stays load-bearing as plan mode absorbs execution planning. CC analogue: planner-thread versus task-subagent isolation. |
| WA26 | Persona holdings verified vs snapshot | a | HOOK (gate persona-lock on `npm run check:persona-snapshot` exit 0) + SKILL | CC | Repo | The check already exists (`scripts/verify-persona-snapshot-alignment.ts`); wire it as a gate. |
| WA27 | Repo-relative paths when referencing files | b + a | CLAUDE (CC chat output) + HOOK (authored docs only) | Both | Repo | CC chat prose cannot be hooked (free text), so the always-on home is CLAUDE; files can be scanned. |
| WA28 | Product-shape decisions: stop and propose | c + b | CLAUDE (the posture) + SKILL | Both | Split | The highest-judgment WA; inherently not mechanizable, it is the rule that defines what NOT to default. |

---

## 3. Mechanism-by-mechanism rollup

### 3.1 Hooks (mechanically enforceable)

WA07 (authored files and commits), WA10, WA11 (pairing check), WA12 (gate), WA13 (per the P28 design), WA14 (path flag), WA20 (memory-write block), WA26 (persona gate). WA01 uses a hook as the hard backstop behind a `/permissions` deny.

The hard capability boundary, verified (CC 2.1.139): a `PreToolUse` hook can block a tool call (exit code 2 or a block decision) and can read the tool input, so it sees the payload of a Write, an Edit, or a `Bash(git commit ...)`. It **cannot** see or block the assistant's free-text output. This is decisive for WA07 and WA27: a long dash or a bare filename in a *file CC is writing* or a *commit message* is hook-blockable; the same character in CC's *chat reply* is not. So WA07 and WA27 are two-layer, not pure hooks: mechanical on files and commits, prompt-enforced on chat prose through `CLAUDE.md` and the chat-side block (3.6). The prompt layer is a legitimate enforcement layer, probabilistic rather than mechanical; the primary's whole workflow runs dash-free by prompt today, so it is proven, not aspirational (Section 8, item 3).

Hooks fire locally. They do not catch a web edit or a force-push from another surface. That is why P28 lists a CI check as arm (B). With no `.github/` today, CI is a later, optional second layer; the local hook is the high-value first move.

### 3.2 CLAUDE.md (always-on judgment, kept ruthlessly minimal)

Candidates, and only these: WA06 (flag and wait), WA05 (debt over scope, one line), WA17 (questions in message output), WA19 (gates are criterion-based), WA27 (repo-relative paths), WA28 (stop and propose on product shape), and a single pointer line to `docs/working_agreements/` that operationalizes WA23. That is roughly seven tight lines plus the pointer.

This is deliberately short. Verified (CC 2.1.139): the guidance is to keep a `CLAUDE.md` under about 200 lines because "longer files consume more context and reduce adherence." Section 5.4 applies the removal test to keep it minimal. Everything situational (WA02, WA08, WA09, WA15, WA16, WA21, WA22) stays out of `CLAUDE.md` and goes to a progressively-disclosed skill, so it costs nothing until its workstream opens.

### 3.3 Skills (situational judgment, as pointers)

WA02, WA08, WA09, WA15, WA16, WA21, WA22, plus skill residues of WA05, WA11, WA13, WA14, WA19, WA26, WA28. The unifying design rule: a skill body is a thin instruction that points at the canonical WA file ("before integration, read `docs/working_agreements/WA02_audit_before_integration.md` and the relevant code; produce the audit doc first"), not a copy of the WA prose. That keeps WA23 satisfied even inside a skill.

Natural groupings rather than 14 separate skills: an **audit-and-verify** skill (WA02, WA21, WA22), a **capability-scope** skill (WA05, WA08, WA09, WA15, WA16), and a **data-and-naming** skill (WA13, WA14, WA26). Fewer, broader skills with progressive disclosure beat many narrow ones.

### 3.4 Subagents (isolated-task and orchestration)

WA22 (the audit run as an Explore-style subagent), WA02 (its read phase), WA25 (the planner-versus-task separation has a CC analogue in main-thread-versus-task-subagent isolation). This is also the home for CC model tiering (Section 6), because only a subagent can pin its own model.

### 3.5 Slash commands (recurring authored prompts)

WA22 (`/audit-kickoff`), WA03 (a workstream kickoff template), WA08 (a PR-prep checklist), optionally WA18. Verified (CC 2.1.139): in current Claude Code, `.claude/commands/*.md` and skills are effectively merged (both produce a `/name`); a command is the lighter form, a saved prompt template with `$ARGUMENTS` substitution, while a skill adds progressive disclosure and automatic description-matched invocation. So the practical rule: if the primary just wants to stamp out a recurring prompt (the audit-ping, the kickoff), author it as a command; if it carries judgment that should auto-activate when a workstream opens, author it as a skill. The recurring authored prompts the primary writes by hand today (audit pings, task kickoffs) are commands, not skills.

### 3.6 The chat-side project-instruction block (the chat-surface implementation, twin of CLAUDE.md)

The planner and task chats run inside a Claude project, and the project's knowledge and instructions are the chat-surface always-on implementation of the WAs, exactly as `CLAUDE.md` is the implementation on the code surface. So the chat-side WAs do not lack a home; they have one, and it is a first-class deliverable, not an afterthought.

A **Samriddhi conventions instruction block**, authored to live in the Claude project's instructions, is the chat-surface twin of the minimal `CLAUDE.md` in 3.2. It implements WA17 (questions in the message output), WA18 (prompts ship as markdown), WA23 (conventions by reference), WA24 (numbering at landing), WA25 (planner versus task chat), and the planner-side halves of WA03 and WA15. It also carries the WA07 prompt layer for chat prose (the no-long-dash rule appears in both this block and the `CLAUDE.md` line, per the two-layer framing).

Two design points, both following the north star: (1) these WAs are **relocated to a chat-side implementation, not collapsed or removed**; the primary retains all of them, and WA25 in particular stays load-bearing, arguably more so as plan mode absorbs the execution-planning layer and the boundary between wide ideation (chat) and grounded execution planning (Claude Code plan mode) has to stay clean. (2) The block follows the same pointers-not-prose discipline, adapted to a surface that may not have the repo mounted: it points at `docs/working_agreements/` and carries the **minimal operative summary** of each rule rather than the full WA prose, so it is a thin implementation, not a second copy of the spec.

Only WA04 (the consolidated stub) has no mechanism on any surface.

---

## 4. Residency map and the plugin endgame

### 4.1 The split, component by component

- **Canonical WA text:** repo-resident, always, in `docs/working_agreements/`. This is the WA23 source of truth and never moves into a skill, a hook, or a plugin as a copy.
- **`CLAUDE.md`:** repo-resident at `./CLAUDE.md`. It is the project's always-on file and belongs with the code. (A second, tiny user-level `~/.claude/CLAUDE.md` could hold cross-project habits, but the project conventions are repo-resident.)
- **Hook scripts:** repo-resident first (committed under, say, `scripts/hooks/`, wired through `settings.json`), versioned with the code they check. Packageable into a plugin later.
- **Skills, slash commands, subagent definitions:** repo-resident first (`.claude/skills/`, `.claude/commands/`, `.claude/agents/`). Packageable later.
- **Settings (`/permissions`, hook registration):** repo-resident in a committed `settings.json`, with machine-specific or secret bits in the gitignored `settings.local.json`.
- **The chat-side project-instruction block:** lives in the Claude project's instructions (the chat-surface always-on implementation, the twin of `CLAUDE.md`). Its canonical pointer is still `docs/working_agreements/`; where the chat cannot resolve a repo path, it carries the minimal operative summary plus the pointer, never the full WA prose. Give it a repo-resident source file (for example a committed `docs/chat_conventions_block.md`) that the primary syncs into the project instructions, so even the chat-side implementation has a versioned source that references the spec rather than a hand-maintained second copy.

### 4.2 The plugin tension, resolved by the north star

The north star resolves what Rev 1 left as an open tension: a plugin, if ever built, is just one more implementation that references the spec, never a second source of truth. The mechanics still have to honour that, so here they are plainly.

The codebase-canonical principle says the repo is the single source of truth. A plugin is a distributable bundle that can live in its own repo and drift. Verified (CC 2.1.139), and this is the load-bearing constraint: **a Claude Code plugin copies its components' text into the bundle. There is no native mechanism for a plugin-packaged skill to reference an external canonical file in another repo.** Plugins can bundle skills, subagents, commands, hooks, MCP servers, and settings, namespaced as `/plugin-name:skill-name`, but a bundled skill carries its own text. So naive packaging would fork the WA prose into the plugin, which is precisely the WA23 failure mode this effort exists to kill. The north star forbids that: the plugin is an implementation, so its components reference the spec rather than reproducing it.

The workable anti-drift pattern, given that constraint:

1. **Package pointers and logic, never prose.** A plugin-packaged skill body says "read `docs/working_agreements/WA02_...` for the canonical rule, then ..." It carries the instruction to go read the repo file, plus the enforcement steps, not the WA text. The hook scripts carry the check logic, not the rationale. So even inside the plugin, the canonical text is referenced, not copied.
2. **Keep CLAUDE.md repo-resident and use its import feature for any text that must be inlined.** Verified (CC 2.1.139): `CLAUDE.md` supports `@path` imports, which a plugin-bundled skill cannot. So if any always-on text genuinely must be inlined, it lives in the repo `CLAUDE.md` via an `@docs/working_agreements/...` style import, not in the plugin.
3. **If the plugin ever must carry text** (for a colleague who installs the plugin without cloning the repo), generate that text from the canonical files by a script, and run that script in CI or a pre-publish step, so the plugin is a build artifact of the repo rather than a hand-maintained second source. Treat any inlined text as generated, never hand-edited.

### 4.3 Path toward the Samriddhi conventions plugin

Design toward it; do not build it first. Sequence: prove the components repo-resident (where they are versioned with the code and the canonical text is one `cd` away), then, once they are stable, bundle the mechanical and situational ones (hooks, skills, the audit subagent, the kickoff commands) into a `samriddhi-conventions` plugin for the colleague (the House View owner) to install as one unit. Plugin-ready now in principle: the hooks and the audit subagent (they carry logic, not prose). Plugin-deferred: anything that would tempt a prose copy, until the generate-from-canonical script exists. The open decision about how the colleague inherits the canonical *text* (shared submodule, generated bundle, or their own repo cloning the WA files) is the genuine WA28-class call in Section 8.

---

## 5. Workflow-upgrade assessment

### 5.1 Explore-style subagent for the audit pattern (highest-leverage for usage efficiency)

Verified (CC 2.1.139): the built-in Explore subagent is read-only, runs on a fast cheap model (Haiku), and returns distilled findings rather than dumping raw file contents into the caller's context.

Applied to WA22: every workstream opens with a grounding audit that today reads many files into the main thread, and that raw context is then carried by every subsequent main-thread turn for the rest of the workstream. Running the audit as an Explore subagent isolates the heavy reads in a throwaway context and returns only the findings map. The main thread never carries the raw reads, so the cost is paid once instead of compounding across the workstream. This is the primary's stated goal (be efficient with weekly usage limits), and it is the single highest-leverage change here. This very audit was run that way as dogfood: the 28 WA reads and the capability checks were partly isolated in a subagent, and the main thread carries the conclusions, not the raw transcript.

Qualitative benefit: the saving scales with workstream length and with how many files the audit touches. A long workstream that today re-pays a large grounding-read context on every turn is where this compounds most.

### 5.2 Plan mode as native audit-first enforcement

Verified (CC 2.1.139): plan mode is read-only until its plan is approved, it proposes an approach before making edits, and it delegates repo-scanning to a read-only Plan subagent that skips `CLAUDE.md` and git status for speed. That is, structurally, the native form of WA02 and WA22: explore first, propose, do not touch code until the human approves. The recommendation: lean on plan mode as the default entry for any capability workstream, so audit-first is enforced by the mode rather than only by prose. It does not produce the versioned audit doc WA22 wants, so it complements rather than replaces the audit skill; the skill adds "and write the findings to `docs/audits/<date>_<slug>.md`."

### 5.3 Slash commands versus skills for recurring prompts

Covered in 3.5. The sharp version: the primary's hand-authored, repeatedly-reused prompts (the audit ping, the task kickoff) are slash commands (saved templates with argument substitution), not skills. Reserve skills for the judgment bundles that should auto-activate on a description match. Given that commands and skills are merged in current CC, this is a guidance distinction more than a mechanism one, but it keeps the mental model clean and keeps the lightweight templates from being over-built.

### 5.4 CLAUDE.md brevity as a hard constraint

Verified (CC 2.1.139): an overlong `CLAUDE.md` measurably reduces adherence; the guidance is under about 200 lines. Applied test for each candidate line (if removed, will CC make a mistake; is it always-needed or context-specific): the seven lines in 3.2 pass (they are always-on and a removal causes a real miss). Everything situational fails the "always-needed" half and is routed to a skill, where progressive disclosure means it costs nothing until its workstream opens. The explicit anti-pattern to avoid: dumping all 28 WAs into `CLAUDE.md`. That would be the longest, least-adhered-to version of the system the repo has, and it would re-create the drift by copying WA text into a second always-loaded file. The pointer line plus seven judgment lines is the whole of it.

### 5.5 /permissions pre-approval as a usage saver

Verified (CC 2.1.139): `settings.json` carries `permissions.allow` and `permissions.deny` arrays with tool-name patterns (for example `Bash(git status:*)`, `Read`, `Agent(Explore)`), deny taking precedence. A sensible set that cuts confirmation round-trips while preserving the real gates:

- **Allow (routine, safe, high-frequency):** `Read`, `Bash(git status:*)`, `Bash(git log:*)`, `Bash(git diff:*)`, `Bash(git fetch:*)`, `Bash(git add:*)`, `Bash(git commit:*)`, `Bash(git push:*)` (WA10 wants push to be automatic and continuous, so pre-approving it serves a WA), `Bash(npm run build:*)`, `Bash(npm run typecheck:*)`, `Bash(tsc:*)`, the read-only verify scripts, and `Agent(Explore)`.
- **Keep gated, by deny or by ask:** `Bash(gh pr merge:*)` (WA01), the API-invoking and end-to-end-pipeline commands (WA12), Write and Edit to the memory paths (WA20), and the interactive pop-up question tool (WA17). These are the gates that must stay deliberate.

Net effect: fewer turns spent on confirmation prompts for reads and routine git, while every WA gate stays explicit. This directly serves the weekly-usage goal.

### 5.6 Considered and set aside (low value for this workflow)

- **Output styles:** cosmetic; they do not enforce a WA. WA07 and WA27 are content rules better served by hooks and `CLAUDE.md`. Set aside.
- **Scheduled tasks and loops:** the workflow is human-paced, workstream by workstream, gated by the primary at every checkpoint. There is no recurring unattended job a cron or loop would serve, and WA12 and WA01 actively want a human in the loop, not automation. Set aside, with one possible exception worth a later look: a nightly CI-style WA-lint (the P28 arm B) could run on a schedule once CI exists, but that is the CI question, not a reason to adopt loops now.
- **MCP servers:** no external-system integration is in scope for WA enforcement. Set aside.

---

## 6. Model-tiering assessment (Claude Code's own usage)

Scope guard first: this is about **Claude Code's own** model usage (the planning and execution this tooling runs on), not Samriddhi's product pipeline. The product pipeline tiering is locked config and out of scope: `LEAN_RUNTIME_OVERRIDES` in `lib/agents/skill-loader.ts` already puts e1 through e7 and s1 on Sonnet and keeps A2 and A3 on Opus, as recorded in `docs/audits/2026-05-31_buildable_now_and_model_tiering.md`. Nothing below touches that.

The verified capability (CC 2.1.139): a subagent can pin its own model; a skill cannot. So CC model tiering lives in the subagents leg and in session settings, exactly as the ping framed it.

The opportunity: the heavy-judgment main thread (planning, scoping, the synthesis in an audit, the product-shape calls) runs on the stronger model; the mechanical and read-heavy isolated tasks run cheaper. Concretely:

- **Audit and read subagents on Haiku or Sonnet.** The Explore subagent is already Haiku by default. A custom audit subagent that does the grounding read for WA22 can pin `model: haiku` or `model: sonnet`. The reading and grepping is not judgment work; it is retrieval and distillation, which the cheaper model does well. The main thread, on the stronger model, consumes the distilled findings and does the synthesis.
- **The main planning and synthesis thread stays on the stronger model.** This is where WA28 product-shape judgment, WA21 verification reasoning, and cross-workstream synthesis happen; do not downgrade it.

Rough cost and benefit, kept honest: the dominant saving here is **not** the per-token model price difference; it is the context-isolation saving from 5.1 (the heavy reads not compounding across the main thread). The model-tier difference is a second, smaller saving on top: a Haiku or Sonnet audit subagent reading twenty files is cheaper per token than the main model doing the same, and that read is the bulk of an audit's tokens. The coordination overhead is low because the audit is already a natural isolated task (it returns one findings doc). The recommendation: tier the audit and read subagents down, keep the main thread up, and treat the dollar saving as a bonus on top of the context-isolation win, which is the real prize. Do not over-engineer a many-tier scheme; one strong main thread plus cheap read subagents is the whole of it.

One caveat to verify at build time, not assume: confirm the audit subagent on the cheaper model still returns findings precise enough to satisfy WA21 (quote-as-evidence). If the cheaper model paraphrases where the audit needs exact quotes, pin it one tier up. This is a build-time validation, flagged here so it is not skipped.

---

## 7. Recommended build sequence

Ordered by leverage for the primary's stated usage-efficiency goal, cheapest-and-highest-value first.

1. **Plan mode plus an Explore-style audit subagent for WA22 and WA02.** Highest leverage, lowest build cost. Plan mode is built-in; the audit subagent is one `.claude/agents/*.md` file with a cheaper `model:` and a "return a findings map, write `docs/audits/<date>_<slug>.md`" instruction. This is the usage-efficiency win; do it first.
2. **The two always-on implementations, plus the permission set.** Cheap, immediate, every-session benefit on both surfaces. (a) A minimal repo `CLAUDE.md` (about seven lines plus the WA23 pointer) for the code surface. (b) The chat-side **Samriddhi conventions instruction block** for the chat surface, its twin (3.6): the same kind of concise, pointer-first conventions block, authored into the Claude project's instructions, with a repo-resident source per 4.1. (c) A `settings.json` `/permissions` set. The pointer lines operationalize WA23 on day one; the permission set cuts confirmation round-trips. Keep both always-on blocks ruthlessly short per 5.4. Author the two blocks together so the code surface and the chat surface carry the same conventions from day one.
3. **The clean, low-false-positive hooks first:** WA20 (memory-write deny), WA01 and WA12 gates (deny plus a confirmation-marker backstop), WA17 (deny the pop-up question tool), WA26 (wire the existing persona check), WA10 (push). These are unambiguous and several already have a design or a script on disk (O4, WA26).
4. **The pointer-style skills, grouped:** the audit-and-verify skill (WA02, WA21, WA22), the capability-scope skill (WA05, WA08, WA09, WA15, WA16), the data-and-naming skill (WA13, WA14, WA26). Bodies point at the canonical files, never copy them.
5. **The fuzzier hooks, after their judgment calls are settled:** WA07 (long-dash scan on authored files and commits, with the chat-prose half left to `CLAUDE.md`), WA13 (the S1 and S2 grep with its whitelist, per P28), WA14 (the data-path flag). These need the whitelist and path-set decisions in Section 8 before they are safe to turn on.
6. **The slash commands for recurring authored prompts:** `/audit-kickoff`, a workstream kickoff template, a PR-prep checklist. Light, convenience-level, do when convenient.
7. **Endgame: the `samriddhi-conventions` plugin.** Bundle the stable hooks, skills, audit subagent, and commands for the colleague, with the generate-from-canonical discipline of 4.2 so the plugin never becomes a second source of WA text. Design toward it from step 1 (keep every component a pointer or a script, never a prose copy), build it last.

Optional and later, not blocking: CI (the P28 arm B, once a `.github/` exists) as the second enforcement layer that catches web edits and force-pushes the local hooks miss.

---

## 8. Open questions and decisions for the primary

These are genuine judgment calls (WA28 class), surfaced rather than defaulted. The 2026-06-02 follow-up review settled two of them: item 3 (WA07 chat prose) and item 6 (the chat-side home) are now marked **Decided** with the primary's resolution recorded in place. Items 1, 2, 4, 5, and 7 remain open. A new subsection at the end records a candidate working agreement the build should ratify.

1. **The colleague's inheritance of canonical WA text (the load-bearing residency call).** When the House View owner installs the `samriddhi-conventions` plugin, how do they get the canonical WA *text* (not just the enforcement logic), given that plugins copy rather than reference? Options: (a) the colleague clones or submodules the WA files so the plugin's pointers resolve; (b) a generate-from-canonical script bakes a read-only text snapshot into the plugin at publish time, regenerated on every WA change; (c) the colleague maintains their own repo that imports the WA files. This is the WA23-versus-distribution tension and it is the primary's call, not mine.

2. **WA13 whitelist scope.** The P28 hook greps for bare `S1` and `S2` and must whitelist legitimate uses (the synthesis-agent names, file names like `s1_case_mode.md`, code identifiers). How aggressive should the block be (hard-block the commit, or warn and allow), and is the false-positive risk on code files acceptable, or should the hook scope to `docs/` and ADRs only? A product-shape call on how much friction is worth the discipline.

3. **WA07 chat prose. Decided (2026-06-02): two-layer enforcement, accepted, not a gap.** WA07 is enforced mechanically on authored files and commit messages (the hook) and by prompt on chat prose (the standing instruction, carried in both the `CLAUDE.md` line and the chat-side block). Prompt-layer enforcement is a legitimate layer, probabilistic rather than mechanical; the primary already maintains it successfully, the whole workflow runs dash-free by prompt today. No new mechanism is needed. The framing is two-layer (mechanical on files and commits, prompt on chat prose), not a half-solved rule. The only build action is to make sure the no-long-dash rule appears in both always-on blocks.

4. **WA10 hook shape (resolves the open O4 question).** Auto-push after every commit (a PostToolUse hook that runs the push), or verify-and-warn only (a hook that checks push state and flags, leaving the push to CC)? O4 explicitly left this open for this kind of audit to answer; the recommendation leans auto-push since WA10 says push is automatic and continuous, but it is the primary's call.

5. **WA20 residency.** The memory-write deny could be a project `settings.json` rule (repo-resident, travels with the repo) or a user-level rule (covers every project on the machine). Memory writes are a cross-project concern, which argues user-level, but repo-residency keeps it versioned. Pick the home.

6. **Chat-surface homes. Decided (2026-06-02): the chat-side project-instruction block is the implementation, and it is a first-class deliverable.** The planner and task chats run inside a Claude project, so the project instructions are the chat-surface always-on implementation of the WAs, the twin of `CLAUDE.md` (3.6). WA17, WA18, WA23, WA24, WA25 and the planner halves of WA03 and WA15 are **relocated to that block, not collapsed or removed**; all are retained, and WA25 stays load-bearing as plan mode absorbs execution planning. The block points at `docs/working_agreements/` and carries the minimal operative summary where the chat cannot resolve a repo path, with a repo-resident source per 4.1. It is sequenced into the build at Section 7 item 2 as the twin of the `CLAUDE.md` step. The one residual that stays open is how a collaborator without the repo mounted resolves the pointer, which is question 1, not this one.

7. **CI as a second layer (scope and timing).** Worth a `.github/` workflow for the P28 arm B (catching web edits and force-pushes the local hooks miss), or is the local hook layer enough for a single-primary repo until the colleague joins? Adds a maintenance surface; defer or adopt is the primary's call.

### Candidate working agreements to ratify at build-landing

Per the primary, WA changes are arrived at through the build, not assumed by default, so these are recorded as **candidates** for ratification when the build lands, not as edits to the registry now. None is pre-numbered; the actual WA number is resolved at landing against `docs/working_agreements/` per WA24 and WA23.

- **Candidate (next free WA, resolved at landing): parallel reads, serial writes.** Read-only and exploratory work (audits, codebase scans, the Explore and Haiku subagents, capability verification) may run in parallel freely; parallelism there is pure upside and carries no execution risk. Work that writes, edits, commits, or executes stays **sequential and gated behind explicit primary approval**, and is never parallelized across subagents. The rationale: parallel execution is the one place the primary's oversight genuinely thins, since you cannot watch three writing agents the way you watch one sequential thread, so the discipline keeps the efficiency of parallel reads without surrendering control over writes. This is a deliberate conservative posture, an explicit guardrail held until the primary's fluency with Claude Code subagents grows, at which point it can be revisited; it is not a permanent ceiling. It interacts with but does not replace the existing hard stops: WA01 (merge) and WA12 (cost) remain the hard gates, and this candidate governs the parallelism dimension specifically. This proposal's own structure already honours it: the read-only audit work fanned out to a subagent, while every write (this doc, the commits) stayed sequential on the main thread.
- **Candidate (meta, recorded only): sharpen WA23 to name the implementation architecture.** Once the implementations exist, WA23 could be sharpened from "conventions inherited by reference" to explicitly name the spec-versus-implementation architecture (the WAs are the spec; `CLAUDE.md`, skills, hooks, subagents, permissions, and the chat-side block are implementations that reference it). Candidate only, arrived at through the build.
- **Candidate (meta, recorded only): make the spec-versus-implementation north star a stated WA.** The north star at the top of this doc could itself become a working agreement, so the principle is canonical rather than only stated in a proposal. Candidate only, arrived at through the build.

No new debt IDs or ADR numbers are pre-allocated in this doc, per WA24; if the build workstream wants a debt entry for the enforcement tooling, it resolves the next free P-series number against `docs/debt/product_debt_log.md` at landing, and the candidate WA above is numbered the same way against `docs/working_agreements/`. The existing P28 (WA13), O4 (WA10), and WA14's self-noted future entry already cover three of the mechanical legs.

---

This audit reads the current state and proposes the architecture; it builds nothing. The primary reviews, decides the open questions in Section 8, and kicks off the build as a separate pass. Per WA01, this branch merges only on the primary's explicit confirmation, and the branch is preserved (no auto-delete).
