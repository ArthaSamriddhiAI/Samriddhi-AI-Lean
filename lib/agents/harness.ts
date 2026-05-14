/* Evidence-agent and synthesis-agent call harness.
 *
 * One entry point: callAgent({ skillId, userPrompt, validate, stubKey? }).
 * The harness loads the skill (applies LEAN_RUNTIME_OVERRIDES), then either
 *   (a) calls Anthropic with the skill's prompt body as the system message
 *       and the supplied user prompt, or
 *   (b) loads a pre-recorded stub fixture when STUB_MODE is active AND
 *       stubKey was supplied by the caller.
 * It then extracts a JSON-fenced block from the response text, runs the
 * validator, and returns the typed output plus usage stats. After a
 * successful live-mode call with stubKey supplied, the raw response is
 * optionally recorded as a stub fixture (STUB_RECORD gate, idempotent).
 *
 * On parse or validation failure in live mode, the harness retries ONCE
 * with the actual error message fed back to the model as a follow-up user
 * turn (per Slice 2 approval refinement on decision 5). Second failure
 * throws hard.
 *
 * On parse or validation failure in stub mode, the harness fails hard
 * immediately: the recorded text is fixed, so retrying produces the same
 * failure. The error points the operator at the offending stub file.
 */

import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { loadSkill } from "./skill-loader";
import { getClaudeClient } from "@/lib/claude";
import {
  loadStub,
  recordStubIfMissing,
  resolveStubMode,
  type StubKey,
} from "./stub";

export type AgentUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type AgentCallResult<T> = {
  output: T;
  usage: AgentUsage;
  attemptCount: number;
  rawText: string;
};

export type AgentCallOptions<T> = {
  /** Skill file name without extension, e.g. "e3_macro_policy_news". */
  skillId: string;
  /** User-side prompt: case context, schema description, fenced-JSON instruction. */
  userPrompt: string;
  /** Throws on validation failure; the message becomes retry feedback. */
  validate: (parsed: unknown) => T;
  /** When set, the harness is stub-aware: it loads a recorded fixture if
   * STUB_MODE is active, and records the live response if STUB_RECORD is
   * active and no fixture exists. When omitted, the call always hits the
   * SDK (live mode) and never records. Slice 3 commit 4 onwards plumbs
   * this through the new Samriddhi 1 pipeline; Slice 2's diagnostic
   * pipeline does not pass it and is unaffected by STUB_MODE. */
  stubKey?: { caseFixtureId: string };
};

const FENCED_JSON_RE = /```json\s*\n?([\s\S]*?)```/i;
const FENCED_ANY_RE = /```\s*\n?([\s\S]*?)```/i;

function extractJSON(raw: string): unknown {
  // Prefer a json-tagged fence; fall back to any fence; fall back to the
  // whole text if no fence at all.
  const m = raw.match(FENCED_JSON_RE) ?? raw.match(FENCED_ANY_RE);
  const jsonText = (m ? m[1] : raw).trim();
  try {
    return JSON.parse(jsonText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`JSON.parse failed: ${msg}`);
  }
}

export async function callAgent<T>(opts: AgentCallOptions<T>): Promise<AgentCallResult<T>> {
  const skill = await loadSkill(opts.skillId);

  /* Stub-mode fast path. Only engaged when the caller opted in by passing
   * stubKey AND STUB_MODE resolves true (Setting row override or env). The
   * recorded fixture is parsed exactly once: a fixed text cannot be made
   * to parse differently by retrying. */
  const fullStubKey: StubKey | null = opts.stubKey
    ? { caseFixtureId: opts.stubKey.caseFixtureId, agentId: opts.skillId }
    : null;
  if (fullStubKey && (await resolveStubMode())) {
    const stub = await loadStub(fullStubKey);
    if (stub.stop_reason === "max_tokens") {
      throw new Error(
        `Stub fixture for ${fullStubKey.caseFixtureId}/${fullStubKey.agentId} ` +
          `records stop_reason="max_tokens"; the recorded text is truncated and ` +
          `cannot be parsed. Re-record by disabling STUB_MODE and rerunning live ` +
          `with a higher max_tokens override.`,
      );
    }
    try {
      const parsed = extractJSON(stub.text);
      const output = opts.validate(parsed);
      return {
        output,
        usage: { inputTokens: stub.usage.input_tokens, outputTokens: stub.usage.output_tokens },
        attemptCount: 1,
        rawText: stub.text,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Stub fixture for ${fullStubKey.caseFixtureId}/${fullStubKey.agentId} ` +
          `failed JSON parse: ${msg}. The recorded text is fixed; retrying will ` +
          `fail the same way. Inspect the stub file, fix it manually, or ` +
          `re-record from a fresh live-mode run.`,
      );
    }
  }

  const client = await getClaudeClient();

  const messages: MessageParam[] = [{ role: "user", content: opts.userPrompt }];

  let totalInput = 0;
  let totalOutput = 0;
  let lastRaw = "";
  let lastStopReason: string | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    /* Opus 4.x (4.5, 4.6, 4.7) does not accept temperature on
     * messages.create; the API rejects with invalid_request_error. The
     * skill files declare temperature for documentation; we honour it
     * only when the underlying model supports it. */
    const acceptsTemperature = !skill.llm_model.startsWith("claude-opus-4");
    const response = acceptsTemperature
      ? await client.messages.create({
          model: skill.llm_model,
          max_tokens: skill.max_tokens,
          temperature: skill.temperature,
          system: skill.body,
          messages,
        })
      : await client.messages.create({
          model: skill.llm_model,
          max_tokens: skill.max_tokens,
          system: skill.body,
          messages,
        });
    totalInput += response.usage.input_tokens;
    totalOutput += response.usage.output_tokens;

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error(`Agent ${opts.skillId}: no text content in response on attempt ${attempt}`);
    }
    lastRaw = textBlock.text;
    lastStopReason = response.stop_reason;

    /* If the response stopped at max_tokens the JSON is almost certainly
     * truncated; retrying with the same budget will fail the same way. Fail
     * loudly with a clear error so the caller can raise the skill's
     * max_tokens override. */
    if (response.stop_reason === "max_tokens") {
      throw new Error(
        `Agent ${opts.skillId} hit max_tokens (${skill.max_tokens}) before finishing the JSON output. ` +
          `Raise the max_tokens override in lib/agents/skill-loader.ts for "${opts.skillId}".`,
      );
    }

    let output: T;
    try {
      const parsed = extractJSON(lastRaw);
      output = opts.validate(parsed);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (attempt < 2) {
        /* Per Slice 2 approval refinement on decision 5: include the actual
         * parse error in the retry prompt so the model has concrete feedback. */
        messages.push({ role: "assistant", content: lastRaw });
        messages.push({
          role: "user",
          content:
            `Your previous response failed to parse with this error: "${errMsg}".\n\n` +
            `Please respond with a single fenced JSON block (\`\`\`json ... \`\`\`) ` +
            `matching the schema in my original message. Do not include prose ` +
            `outside the fence. Do not wrap the JSON in additional explanation.`,
        });
        continue;
      }
      throw new Error(
        `Agent ${opts.skillId} failed JSON parse after 2 attempts. ` +
          `Last error: ${errMsg}. ` +
          `Last raw output (first 800 chars): ${lastRaw.slice(0, 800)}`,
      );
    }

    /* Successful live-mode parse. If the caller supplied stubKey and
     * STUB_RECORD is on, persist the raw response now (idempotent: a
     * pre-existing fixture is left untouched). This is how incidental
     * fixture capture happens during live runs. Errors here propagate;
     * the parse-retry path above is for model-output problems, not for
     * disk I/O. */
    if (fullStubKey) {
      await recordStubIfMissing({
        key: fullStubKey,
        model: skill.llm_model,
        text: lastRaw,
        stopReason: lastStopReason,
        usage: { input_tokens: totalInput, output_tokens: totalOutput },
      });
    }
    return {
      output,
      usage: { inputTokens: totalInput, outputTokens: totalOutput },
      attemptCount: attempt,
      rawText: lastRaw,
    };
  }

  throw new Error("unreachable: harness retry loop exited without return");
}
