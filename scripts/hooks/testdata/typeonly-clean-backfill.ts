/* Test fixture for the WA12 gate (never executed). Imports an SDK TYPE only,
 * which is erased at runtime and cannot spend; the checker must prove this
 * entry no-reach. */
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

export function shape(m: MessageParam | null): boolean {
  return m !== null;
}
