import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";

/* Anthropic client utility.
 *
 * Plumbed but not yet called from the reasoning runtime; the slice 2
 * (Samriddhi 2 reasoning) work imports getClaudeClient() and uses it
 * to drive E1-E7 evidence agents, M0.Stitcher, and the S1 synthesis
 * modes. Today this file exists so the import path is stable.
 *
 * The /api/anthropic-test route does NOT use this helper because it
 * tests an unsaved candidate key from the Settings form. Production
 * code paths read the saved key via this helper.
 */

async function getApiKey(): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  return setting?.apiKey ?? null;
}

async function getModelChoice(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  return setting?.modelChoice ?? "claude-opus-4-7";
}

export async function getClaudeClient(): Promise<Anthropic> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("Anthropic API key not configured. Set one in /settings before running a case.");
  }
  return new Anthropic({ apiKey });
}

export async function getDefaultModel(): Promise<string> {
  return getModelChoice();
}
