/* Evidence-agent and synthesis-agent call harness.
 *
 * One entry point: callAgent({ skillId, userPrompt, validate }). The harness
 * loads the skill (applies LEAN_RUNTIME_OVERRIDES), calls Anthropic with the
 * skill's prompt body as the system message and the supplied user prompt,
 * extracts a JSON-fenced block from the response, runs the validator, and
 * returns the typed output plus usage stats.
 *
 * On parse or validation failure, the harness retries ONCE with the actual
 * error message fed back to the model as a follow-up user turn (per Slice 2
 * approval refinement on decision 5). Second failure throws hard.
 */

import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { loadSkill } from "./skill-loader";
import { getClaudeClient } from "@/lib/claude";

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
  const client = await getClaudeClient();

  const messages: MessageParam[] = [{ role: "user", content: opts.userPrompt }];

  let totalInput = 0;
  let totalOutput = 0;
  let lastRaw = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await client.messages.create({
      model: skill.llm_model,
      max_tokens: skill.max_tokens,
      temperature: skill.temperature,
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

    try {
      const parsed = extractJSON(lastRaw);
      const output = opts.validate(parsed);
      return {
        output,
        usage: { inputTokens: totalInput, outputTokens: totalOutput },
        attemptCount: attempt,
        rawText: lastRaw,
      };
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
  }

  throw new Error("unreachable: harness retry loop exited without return");
}
