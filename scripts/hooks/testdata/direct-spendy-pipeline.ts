/* Test fixture for the WA12 gate (never executed). VALUE-imports the SDK
 * directly; the gate-word in the filename engages the hook's keyword branch,
 * and the checker must report direct reach. */
import Anthropic from "@anthropic-ai/sdk";

console.log("test fixture; would construct:", typeof Anthropic);
