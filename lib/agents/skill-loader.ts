/* Skill loader for the 21 lifted agent skill files in /agents/.
 *
 * Reads a .md file, parses YAML frontmatter, returns the prompt body alongside
 * the resolved model parameters (after applying LEAN_RUNTIME_OVERRIDES, the
 * Slice 2 per-agent overrides).
 *
 * The skill files stay byte-identical on disk per the Slice 2 Q2 decision.
 * All tuning happens here at runtime.
 *
 * The frontmatter parser is hand-written because the frontmatter shape is
 * simple (flat key-value, occasional string-list under a parent key). Pulling
 * in gray-matter or js-yaml for this is overkill; if the frontmatter ever
 * grows nested structures, switch.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const AGENTS_DIR = path.resolve(process.cwd(), "agents");

const SONNET = "claude-sonnet-4-6";

export type SkillFrontmatter = {
  agent_id: string;
  llm_model: string;
  max_tokens: number;
  temperature: number;
  output_schema_ref?: string;
  [key: string]: unknown;
};

export type LoadedSkill = {
  /** The raw frontmatter from the skill file, untouched. */
  frontmatter: SkillFrontmatter;
  /** The prompt body, used verbatim as the system prompt. */
  body: string;
  /** Resolved model after overrides. */
  llm_model: string;
  /** Resolved max_tokens after overrides. */
  max_tokens: number;
  /** Resolved temperature after overrides. */
  temperature: number;
};

/* Slice 2 runtime overrides.
 *
 * Per the orientation approval: force all evidence agents and the S1
 * diagnostic synthesis to Sonnet for demo economics. The skill files
 * themselves declare Opus on E1, E6, and S1; we override those at the
 * runtime call site rather than editing the skill files.
 *
 * If specific agents read visibly thin at Gate 1 review, we upgrade those
 * targets to Opus by setting llm_model below; we do not edit the skill.
 *
 * max_tokens tuned down for demo speed; values are conservative against
 * the skill-declared envelopes.
 *
 * M0.Router and M0.Stitcher do not appear because they run deterministically
 * in Slice 2 (no LLM call). M0.PortfolioRiskAnalytics is deterministic too.
 */
export const LEAN_RUNTIME_OVERRIDES: Record<string, Partial<SkillFrontmatter>> = {
  /* max_tokens kept at or near the skill-authored values; the demo
   * economics saving is in the llm_model swap from Opus to Sonnet, not in
   * starving the output budget. Tune downward later from empirical token
   * usage logs if cases come in well under the ceilings. */
  e1_listed_fundamental_equity: { llm_model: SONNET },
  e2_industry_business: { llm_model: SONNET },
  e3_macro_policy_news: { llm_model: SONNET },
  e4_behavioural_historical: { llm_model: SONNET },
  e5_unlisted_equity: { llm_model: SONNET },
  e6_pms_aif_sif: { llm_model: SONNET },
  e7_mutual_fund: { llm_model: SONNET },
  s1_diagnostic_mode: { llm_model: SONNET, max_tokens: 5000 },
};

function parseScalar(raw: string): unknown {
  const value = raw.trim();
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  // Strip wrapping single or double quotes
  const m = value.match(/^["'](.*)["']$/);
  return m ? m[1] : value;
}

function parseFrontmatter(yaml: string): SkillFrontmatter {
  const result: Record<string, unknown> = {};
  let currentListKey: string | null = null;

  for (const rawLine of yaml.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.trim() === "") {
      currentListKey = null;
      continue;
    }

    // List item under the last seen key with an empty value.
    const listMatch = line.match(/^\s+-\s+(.*)$/);
    if (listMatch && currentListKey) {
      const arr = result[currentListKey] as unknown[];
      arr.push(listMatch[1].trim());
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const after = line.slice(colonIdx + 1).trim();

    if (after === "") {
      currentListKey = key;
      result[key] = [];
      continue;
    }

    currentListKey = null;
    result[key] = parseScalar(after);
  }

  if (typeof result.agent_id !== "string") {
    throw new Error("Skill frontmatter missing agent_id");
  }
  if (typeof result.llm_model !== "string") {
    throw new Error(`Skill ${result.agent_id} missing llm_model`);
  }
  if (typeof result.max_tokens !== "number") {
    throw new Error(`Skill ${result.agent_id} missing max_tokens`);
  }
  if (typeof result.temperature !== "number") {
    throw new Error(`Skill ${result.agent_id} missing temperature`);
  }

  return result as SkillFrontmatter;
}

export async function loadSkill(skillId: string): Promise<LoadedSkill> {
  const filePath = path.join(AGENTS_DIR, `${skillId}.md`);
  const raw = await fs.readFile(filePath, "utf-8");

  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`Skill file ${skillId} has no YAML frontmatter`);
  }

  const frontmatter = parseFrontmatter(match[1]);
  const body = match[2].trim();
  const overrides = LEAN_RUNTIME_OVERRIDES[skillId] ?? {};

  return {
    frontmatter,
    body,
    llm_model: (overrides.llm_model as string | undefined) ?? frontmatter.llm_model,
    max_tokens: (overrides.max_tokens as number | undefined) ?? frontmatter.max_tokens,
    temperature: (overrides.temperature as number | undefined) ?? frontmatter.temperature,
  };
}
