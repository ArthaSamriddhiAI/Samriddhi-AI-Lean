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
 * STUB_MODE handling in this commit mirrors Slice 3's evidence agents:
 * the harness loads stub fixtures when STUB_MODE is active and a
 * stubKey was passed; missing stubs throw with the standard developer-
 * facing error. The sentinel-on-missing-stub branch lands in commit 3
 * so the Sharma case can render under STUB_MODE without IC1 stubs in
 * place (Option A funding-aware mode).
 *
 * The pipeline is only invoked when materiality.fires=true; the
 * Samriddhi 1 orchestrator (pipeline-case.ts, wired in commit 3)
 * evaluates materiality first and short-circuits when fires=false,
 * persisting IC1Deliberation as { fires: false, materiality_reason }.
 */

import type { CaseEvidenceVerdict } from "./case/case-verdict";
import type { GateResult } from "./case/governance/types";
import type {
  BriefingCaseContent,
  SynthesisVerdictSection,
} from "./case/briefing-case-content";
import type { CaseAgentContext } from "./case/case-context";
import type { MaterialityOutput } from "./materiality";
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
import type {
  ChairPayload,
  CounterfactualEnginePayload,
  DevilsAdvocatePayload,
  IC1Deliberation,
  MinutesRecorderPayload,
  RiskAssessorPayload,
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

const ZERO_USAGE: IC1Usage = {
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
      usage: { ...ZERO_USAGE },
    };
  }

  /* Step 1: Chair and Risk Assessor in parallel. */
  const baseRoleInput = {
    ctx: input.ctx,
    synthesis: input.synthesis,
    briefing: input.briefing,
    evidence: input.evidence,
    gates: input.gates,
    materiality: input.materiality,
  };
  const [chairRes, riskRes] = await Promise.all([
    runIC1Chair(baseRoleInput, opts),
    runIC1RiskAssessor(baseRoleInput, opts),
  ]);

  /* Step 2: Devil's Advocate, consuming Chair. */
  const devilsRes = await runIC1DevilsAdvocate(
    { ...baseRoleInput, chair: chairRes.output },
    opts,
  );

  /* Step 3: Counterfactual Engine, consuming Risk Assessor. */
  const cfRes = await runIC1CounterfactualEngine(
    { ...baseRoleInput, risk_assessor: riskRes.output },
    opts,
  );

  /* Step 4: Minutes Recorder, consuming all four. */
  const minutesRes = await runIC1MinutesRecorder(
    {
      ctx: input.ctx,
      synthesis: input.synthesis,
      briefing: input.briefing,
      materiality: input.materiality,
      chair: chairRes.output,
      devils_advocate: devilsRes.output,
      risk_assessor: riskRes.output,
      counterfactual_engine: cfRes.output,
    },
    opts,
  );

  return {
    deliberation: {
      fires: true,
      minutes_recorder: minutesRecorderToPayload(minutesRes.output),
      chair: chairToPayload(chairRes.output),
      devils_advocate: devilsAdvocateToPayload(devilsRes.output),
      risk_assessor: riskAssessorToPayload(riskRes.output),
      counterfactual_engine: counterfactualEngineToPayload(cfRes.output),
    },
    usage: {
      ic1_chair_input: chairRes.usage.inputTokens,
      ic1_chair_output: chairRes.usage.outputTokens,
      ic1_devils_advocate_input: devilsRes.usage.inputTokens,
      ic1_devils_advocate_output: devilsRes.usage.outputTokens,
      ic1_risk_assessor_input: riskRes.usage.inputTokens,
      ic1_risk_assessor_output: riskRes.usage.outputTokens,
      ic1_counterfactual_engine_input: cfRes.usage.inputTokens,
      ic1_counterfactual_engine_output: cfRes.usage.outputTokens,
      ic1_minutes_recorder_input: minutesRes.usage.inputTokens,
      ic1_minutes_recorder_output: minutesRes.usage.outputTokens,
    },
  };
}
