# WA29: Parallel reads, serial writes

## Agreement

Read-only and exploratory work may run in parallel freely. Audits, codebase scans, the Explore and grounding-audit subagents, and capability verification can fan out across concurrent subagents without restriction, because parallel reading carries no execution risk and the results are reviewed before anything acts on them. Work that writes, edits, commits, or executes stays sequential and gated behind explicit primary approval, and is never parallelized across subagents. The single writing thread is the main thread; subagents do not write in parallel.

This is a deliberate conservative posture held while the primary's fluency with Claude Code subagents grows. It is not a permanent ceiling: it can be revisited and loosened as confidence in parallel-write orchestration increases. It governs the parallelism dimension specifically and does not replace the existing hard gates: WA01 (merge) and WA12 (API spend) remain the stop-and-confirm gates; WA28 (product-shape stop-and-propose) still fires on its own terms. WA29 adds that even approved writes are serialized, never fanned out.

## Rationale

Parallel execution is the one place the primary's oversight genuinely thins. A human can watch one sequential writing thread, reading each change as it lands; three writing agents acting at once cannot be watched the same way, and a wrong write is harder to catch and to unwind when it is one of several concurrent ones. Parallel reads have the opposite shape: the cost of a bad read is bounded (it is discarded), and the findings are reviewed before they drive any action. So the discipline keeps the efficiency that parallel reads buy (the usage-efficiency win of isolated, fanned-out audits) without surrendering the control that serial writes preserve. The failure mode it prevents: oversight thinning silently as soon as writes are parallelized, with no single moment to catch a bad concurrent change.

## Trigger

Surfaced during the WA enforcement build (the architecture that enabled parallel read-only subagents in the first place). The grounding-audit subagent and the capability-verification subagents fan out reads cheaply; the same machinery could fan out writes, which is where oversight would thin. The primary ring-fenced the parallelism: reads parallel, writes serial, until fluency with subagent orchestration grows. Codified as a standing agreement so the posture is explicit and transferable rather than held by feel.

## Examples

**Compliance:** A workstream opens; three read-only subagents scan the registry, the code paths, and the data shapes concurrently and return distilled findings; the main thread reviews them and then makes every edit and commit sequentially.

**Non-compliance:** Spawning three subagents in worktrees to each implement a different file in parallel and committing their outputs together, so no single change was watched as it landed.

## Cross-references

WA01 (merge gate) and WA12 (API-call gate), the hard stops WA29 sits alongside; WA28 (product-shape stop-and-propose), the judgment gate that still fires independently. WA22 (audit phase as a versioned deliverable) and the grounding-audit subagent, the parallel-read pattern WA29 explicitly blesses. ADR-0044 (the WA enforcement architecture), which records this posture. The build that surfaced it: docs/audits/2026-06-02_wa_enforcement_architecture.md.
