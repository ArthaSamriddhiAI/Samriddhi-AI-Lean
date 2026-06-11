/* Test fixture for the WA12 gate (never executed). A library that VALUE-imports
 * the Anthropic SDK, so anything importing it has genuine SDK reach. Exists so
 * the hook test can prove the gate still fires on transitive reach. */
import Anthropic from "@anthropic-ai/sdk";

export function client(): unknown {
  return new Anthropic({ apiKey: "test-fixture-never-runs" });
}
