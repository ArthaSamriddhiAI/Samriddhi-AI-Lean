/* IC1 deliberation orchestrator.
 *
 * Per Slice 4 orientation Q3, the five sub-agents fire in four steps:
 *
 *   Step 1 (parallel): Chair and Risk Assessor.
 *   Step 2:            Devil's Advocate (consumes Chair's framing).
 *   Step 3:            Counterfactual Engine (consumes Risk Assessor).
 *   Step 4:            Minutes Recorder (consumes all four).
 *
 * Total: 5 LLM calls across 4 sequential steps. Estimated wall-clock at
 * current serial Anthropic dispatch is roughly 3-5 minutes per case in
 * live mode; under STUB_MODE the replay completes in 1-2 seconds.
 *
 * STUB_MODE handling per Slice 4 orientation §7 and the scoping
 * confirmation's sentinel shape Option (a):
 *
 *   - In live mode (no stubKey or stub mode off), each runner makes a
 *     real LLM call; failures throw and abort the pipeline.
 *   - In stub mode, the orchestrator checks each role's stub presence
 *     via shouldUseSentinel before invoking its runner. A missing stub
 *     short-circuits to an "infrastructure_ready" sentinel payload for
 *     that role with zero usage; a present stub flows through the
 *     standard harness path (which loads the recorded response).
 *
 * Cascade rule for the sentinel state:
 *   Step 2 (Devil's Advocate) is sentinel if its own stub is missing
 *     OR Chair is sentinel.
 *   Step 3 (Counterfactual Engine) is sentinel if its own stub is
 *     missing OR Risk Assessor is sentinel.
 *   Step 4 (Minutes Recorder) is sentinel if its own stub is missing
 *     OR any of the four upstream is sentinel.
 *
 * This cascade matches the natural failure pattern of the live-mode
 * sequential generation (a step-N failure leaves step-N+1...M unrun)
 * and keeps the rendered surface honest: a downstream role that lacks
 * its upstream's input cannot meaningfully exist as populated.
 */

import type { CaseEvidenceVerdict } from "./case/case-verdict";
import type { GateResult } from "./case/governance/types";
import type {
  BriefingCaseContent,
  SynthesisVerdictSection,
} from "./case/briefing-case-content";
import type { CaseAgentContext } from "./case/case-context";
import type { MaterialityOutput } from "./materiality";
import { shouldUseSentinel, type StubKey } from "./stub";
import type { AgentCallResult, AgentUsage } from "./harness";
import { runIC1Chair, type ChairOutput } from "./ic1/chair";
import {
  runIC1DevilsAdvocate,
  type DevilsAdvocateOutput,
} from "./ic1/devils-advocate";
import {
  runIC1RiskAssessor,
  type RiskAssessorOutput,
} from "./ic1/risk-assessor";
import {
  runIC1CounterfactualEngine,
  type CounterfactualEngineOutput,
} from "./ic1/counterfactual-engine";
import {
  runIC1MinutesRecorder,
  type MinutesRecorderOutput,
} from "./ic1/minutes-recorder";
import {
  sentinelChair,
  sentinelCounterfactualEngine,
  sentinelDevilsAdvocate,
  sentinelMinutesRecorder,
  sentinelRiskAssessor,
  type ChairPayload,
  type CounterfactualEnginePayload,
  type DevilsAdvocatePayload,
  type IC1Deliberation,
  type MinutesRecorderPayload,
  type RiskAssessorPayload,
} from "./ic1/types";

export type RunIC1Input = {
  ctx: CaseAgentContext;
  synthesis: SynthesisVerdictSection;
  briefing: BriefingCaseContent;
  evidence: CaseEvidenceVerdict[];
  gates: GateResult[];
  materiality: MaterialityOutput;
};

export type RunIC1Opts = {
  stubKey?: { caseFixtureId: string };
};

export type IC1Usage = {
  ic1_chair_input: number;
  ic1_chair_output: number;
  ic1_devils_advocate_input: number;
  ic1_devils_advocate_output: number;
  ic1_risk_assessor_input: number;
  ic1_risk_assessor_output: number;
  ic1_counterfactual_engine_input: number;
  ic1_counterfactual_engine_output: number;
  ic1_minutes_recorder_input: number;
  ic1_minutes_recorder_output: number;
};

export type IC1PipelineResult = {
  deliberation: IC1Deliberation;
  usage: IC1Usage;
};

const ZERO_USAGE: AgentUsage = { inputTokens: 0, outputTokens: 0 };

const ZERO_PIPELINE_USAGE: IC1Usage = {
  ic1_chair_input: 0,
  ic1_chair_output: 0,
  ic1_devils_advocate_input: 0,
  ic1_devils_advocate_output: 0,
  ic1_risk_assessor_input: 0,
  ic1_risk_assessor_output: 0,
  ic1_counterfactual_engine_input: 0,
  ic1_counterfactual_engine_output: 0,
  ic1_minutes_recorder_input: 0,
  ic1_minutes_recorder_output: 0,
};

/* Sentinel-aware role runner.
 *
 * In live mode (no stubKey resolved), always invokes the runner.
 * In stub mode with the stub present, invokes the runner (which loads
 *   from disk via the harness's STUB_MODE fast path).
 * In stub mode with the stub missing, returns null + zero usage to
 *   signal sentinel state. */
async function runRoleOrSentinel<T>(args: {
  stubKey: StubKey | null;
  run: () => Promise<AgentCallResult<T>>;
}): Promise<{ output: T | null; usage: AgentUsage }> {
  if (args.stubKey && (await shouldUseSentinel(args.stubKey))) {
    return { output: null, usage: ZERO_USAGE };
  }
  const r = await args.run();
  return { output: r.output, usage: r.usage };
}

function chairToPayload(o: ChairOutput): ChairPayload {
  return { status: "populated", framing: o.framing, deliberation_question: o.deliberation_question };
}
function devilsAdvocateToPayload(o: DevilsAdvocateOutput): DevilsAdvocatePayload {
  return { status: "populated", position: o.position, specific_challenges: o.specific_challenges };
}
function riskAssessorToPayload(o: RiskAssessorOutput): RiskAssessorPayload {
  return { status: "populated", evaluation: o.evaluation, specific_risks: o.specific_risks };
}
function counterfactualEngineToPayload(o: CounterfactualEngineOutput): CounterfactualEnginePayload {
  return { status: "populated", framing: o.framing, alternative_paths: o.alternative_paths };
}
function minutesRecorderToPayload(o: MinutesRecorderOutput): MinutesRecorderPayload {
  return { status: "populated", summary: o.summary };
}

export async function runIC1Pipeline(
  input: RunIC1Input,
  opts: RunIC1Opts = {},
): Promise<IC1PipelineResult> {
  if (!input.materiality.fires) {
    return {
      deliberation: {
        fires: false,
        materiality_reason: input.materiality.reason,
      },
      usage: { ...ZERO_PIPELINE_USAGE },
    };
  }

  const caseFixtureId = opts.stubKey?.caseFixtureId;
  const stubKeyFor = (agentId: string): StubKey | null =>
    caseFixtureId ? { caseFixtureId, agentId } : null;

  const baseRoleInput = {
    ctx: input.ctx,
    synthesis: input.synthesis,
    briefing: input.briefing,
    evidence: input.evidence,
    gates: input.gates,
    materiality: input.materiality,
  };

  /* Step 1: Chair and Risk Assessor in parallel. Independent of each
   * other; sentinel for each is decided by its own stub presence. */
  const [chair, risk] = await Promise.all([
    runRoleOrSentinel({
      stubKey: stubKeyFor("ic1_chair"),
      run: () => runIC1Chair(baseRoleInput, opts),
    }),
    runRoleOrSentinel({
      stubKey: stubKeyFor("ic1_risk_assessor"),
      run: () => runIC1RiskAssessor(baseRoleInput, opts),
    }),
  ]);

  /* Step 2: Devil's Advocate. Cascade: sentinel if Chair is sentinel. */
  const devils = chair.output === null
    ? { output: null as DevilsAdvocateOutput | null, usage: ZERO_USAGE }
    : await runRoleOrSentinel({
        stubKey: stubKeyFor("ic1_devils_advocate"),
        run: () =>
          runIC1DevilsAdvocate({ ...baseRoleInput, chair: chair.output! }, opts),
      });

  /* Step 3: Counterfactual Engine. Cascade: sentinel if Risk Assessor is sentinel. */
  const cf = risk.output === null
    ? { output: null as CounterfactualEngineOutput | null, usage: ZERO_USAGE }
    : await runRoleOrSentinel({
        stubKey: stubKeyFor("ic1_counterfactual_engine"),
        run: () =>
          runIC1CounterfactualEngine(
            { ...baseRoleInput, risk_assessor: risk.output! },
            opts,
          ),
      });

  /* Step 4: Minutes Recorder. Cascade: sentinel if any of the four
   * upstream is sentinel. */
  const allUpstreamPopulated =
    chair.output !== null &&
    risk.output !== null &&
    devils.output !== null &&
    cf.output !== null;
  const minutes = !allUpstreamPopulated
    ? { output: null as MinutesRecorderOutput | null, usage: ZERO_USAGE }
    : await runRoleOrSentinel({
        stubKey: stubKeyFor("ic1_minutes_recorder"),
        run: () =>
          runIC1MinutesRecorder(
            {
              ctx: input.ctx,
              synthesis: input.synthesis,
              briefing: input.briefing,
              materiality: input.materiality,
              chair: chair.output!,
              devils_advocate: devils.output!,
              risk_assessor: risk.output!,
              counterfactual_engine: cf.output!,
            },
            opts,
          ),
      });

  return {
    deliberation: {
      fires: true,
      minutes_recorder: minutes.output
        ? minutesRecorderToPayload(minutes.output)
        : sentinelMinutesRecorder(),
      chair: chair.output ? chairToPayload(chair.output) : sentinelChair(),
      devils_advocate: devils.output
        ? devilsAdvocateToPayload(devils.output)
        : sentinelDevilsAdvocate(),
      risk_assessor: risk.output
        ? riskAssessorToPayload(risk.output)
        : sentinelRiskAssessor(),
      counterfactual_engine: cf.output
        ? counterfactualEngineToPayload(cf.output)
        : sentinelCounterfactualEngine(),
    },
    usage: {
      ic1_chair_input: chair.usage.inputTokens,
      ic1_chair_output: chair.usage.outputTokens,
      ic1_devils_advocate_input: devils.usage.inputTokens,
      ic1_devils_advocate_output: devils.usage.outputTokens,
      ic1_risk_assessor_input: risk.usage.inputTokens,
      ic1_risk_assessor_output: risk.usage.outputTokens,
      ic1_counterfactual_engine_input: cf.usage.inputTokens,
      ic1_counterfactual_engine_output: cf.usage.outputTokens,
      ic1_minutes_recorder_input: minutes.usage.inputTokens,
      ic1_minutes_recorder_output: minutes.usage.outputTokens,
    },
  };
}
