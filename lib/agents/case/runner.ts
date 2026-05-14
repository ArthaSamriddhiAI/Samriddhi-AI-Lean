/* Shared runner for Samriddhi 1 case-mode evidence agents.
 *
 * The seven agent files (e1-case.ts ... e7-case.ts) each call this with
 * their agent_id, label, and the agent-specific scope block. The skill
 * body (loaded by skill-loader from agents/<agent_id>.md) is the system
 * prompt; the user prompt is built here from the case context, the
 * agent-specific scope, and the canonical verdict-shape instruction.
 * The validator enforces the discriminated-union invariant on the
 * fenced JSON output before returning.
 *
 * stubKey support: the harness honours stubKey when the caller passes
 * one. The orchestrator (commit 9) plumbs the case-fixture ID through
 * so live runs incidentally record stubs and stub-mode runs replay
 * from disk.
 */

import { callAgent, type AgentCallResult } from "../harness";
import {
  formatCaseContextHeader,
  verdictShapeInstruction,
  type CaseAgentContext,
} from "./case-context";
import {
  validateActivatedVerdict,
  type ActivatedVerdict,
  type CaseAgentId,
} from "./case-verdict";

export type RunCaseAgentOpts = {
  agentId: CaseAgentId;
  /** Human-readable label included in the user prompt, e.g.
   * "E6 (PMS / AIF / SIF)". Helps the model anchor the response in role. */
  agentLabel: string;
  /** Agent-specific scope block, included after the case header.
   * Each agent file builds this from its inputs (macro data, wrapper
   * inventory, profile md, etc.). */
  scopeBlock: string;
  ctx: CaseAgentContext;
  stubKey?: { caseFixtureId: string };
};

export async function runCaseAgent(
  opts: RunCaseAgentOpts,
): Promise<AgentCallResult<ActivatedVerdict>> {
  const userPrompt = [
    `# ${opts.agentLabel} verdict request`,
    "",
    "## Case context",
    "",
    formatCaseContextHeader(opts.ctx),
    "",
    "## Agent scope",
    "",
    opts.scopeBlock,
    "",
    "## Output",
    "",
    verdictShapeInstruction(opts.agentLabel),
  ].join("\n");

  return callAgent<ActivatedVerdict>({
    skillId: opts.agentId,
    userPrompt,
    validate: (raw) => validateActivatedVerdict(raw, opts.agentId),
    stubKey: opts.stubKey,
  });
}
