import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

/* POST /api/anthropic-test
 * Body: { apiKey: string, modelChoice?: string }
 *
 * Smallest possible Claude call to verify a key works. Uses Haiku regardless
 * of the user's chosen model (Haiku is cheapest and fastest for a single
 * ping; the model choice is exercised at case-generation time). */

type Body = {
  apiKey?: string;
};

const TEST_MODEL = "claude-haiku-4-5-20251001";

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Missing API key" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const start = Date.now();
    const result = await client.messages.create({
      model: TEST_MODEL,
      max_tokens: 5,
      messages: [{ role: "user", content: "ping" }],
    });
    const latencyMs = Date.now() - start;
    return NextResponse.json({ ok: true, model: result.model, latencyMs });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
