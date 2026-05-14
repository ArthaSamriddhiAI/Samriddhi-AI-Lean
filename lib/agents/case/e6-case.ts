/* E6 case-mode: PMS, AIF, SIF fund analysis. Activates when the
 * proposed target or source involves a wrapper-tier product. For
 * Sharma + Marcellus this is the load-bearing agent: it runs the gate
 * sub-check (SEBI minimum, mandate band, wrapper-count discipline),
 * the manager-quality read, the strategy-consistency read, the fee
 * normalisation against MF substitutes, and the capacity-trajectory
 * read.
 *
 * Per the verdicts file, E6 carries the most consequential signal in
 * the Sharma case: post-action equity at the upper boundary of the
 * mandate band (no headroom but no breach) and the wrapper-count
 * doubling (1 PMS → 2 PMS, style-overlap consideration).
 */

import { runCaseAgent } from "./runner";
import type { CaseAgentContext } from "./case-context";
import type { ActivatedVerdict } from "./case-verdict";
import type { AgentCallResult } from "../harness";

export type E6CaseScope = {
  /** Target wrapper description — the PMS/AIF/SIF being added or
   * modified. Includes manager identity, strategy style, fee structure
   * where known. */
  targetWrapperContext: string;
  /** Existing wrapper-tier inventory in the household, summarised. The
   * wrapper-count, style-overlap, and aggregate fee-load reads draw on
   * this. */
  existingWrapperInventory: string;
  /** Mandate-band and concentration arithmetic for the post-action
   * portfolio (equity %, wrapper-count, sector tilts). Pre-computed by
   * the orchestrator from the proposal's ticket size and the existing
   * holdings. */
  postActionArithmetic: string;
};

export function runE6Case(
  ctx: CaseAgentContext,
  scope: E6CaseScope,
  opts: { stubKey?: { caseFixtureId: string } } = {},
): Promise<AgentCallResult<ActivatedVerdict>> {
  const scopeBlock = [
    "Target wrapper context:",
    scope.targetWrapperContext,
    "",
    "Existing wrapper-tier inventory:",
    scope.existingWrapperInventory,
    "",
    "Post-action arithmetic:",
    scope.postActionArithmetic,
    "",
    "Evaluate across five sub-agent dimensions:",
    "1. Gate: SEBI minimum tickets, mandate-band compliance, wrapper-",
    "   count discipline, structural eligibility for the investor type.",
    "2. Manager quality: tenure, team depth, continuity across regimes.",
    "3. Strategy consistency: style stability, concentration discipline,",
    "   turnover, drift signals.",
    "4. Fee normalisation: management + performance fees, hurdle,",
    "   high-water-mark, blended cost vs comparable MF substitute,",
    "   historical alpha coverage of the premium.",
    "5. Capacity: strategy AUM, alpha-decay inflection trajectory.",
    "",
    "Surface the gate result explicitly. The verdict's risk_level",
    "should reflect both product-level read and mandate-architecture",
    "considerations (band headroom, style overlap with existing",
    "wrappers).",
  ].join("\n");

  return runCaseAgent({
    agentId: "e6_pms_aif_sif",
    agentLabel: "E6 (PMS / AIF / SIF)",
    scopeBlock,
    ctx,
    stubKey: opts.stubKey,
  });
}
