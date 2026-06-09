/* The gated LLM-assist ingestion fallback (Package 07, B3).
 *
 * For documents the deterministic adapters cannot parse confidently (free
 * prose, unseen layouts), the architecture routes the SANITISED text to a
 * model with a strict extraction schema, and the result still goes through
 * the reconciliation gate like any parsed document.
 *
 * Two hard properties, per the rulings:
 * 1. Ordering by type: the request builder accepts only SanitisedText (the
 *    brand minted exclusively by lib/privacy), so un-sanitised content cannot
 *    reach this path at compile time. PII is stripped BEFORE the fallback
 *    ever sees the data, never after.
 * 2. Build-but-do-not-live-test (WA12): the executor below never calls the
 *    model. It throws unless the explicit runtime opt-in is set, and even
 *    then it throws at the wiring point, which is left deliberately
 *    unimplemented until a WA12-approved budget exists. The untested-live
 *    state is logged as debt. Do not wire this to the SDK in a test.
 */

import type { SanitisedText } from "../privacy/sanitised";

export type FallbackRequest = {
  /* The prompt the future call would send: sanitised document text plus the
   * extraction instruction. */
  prompt: string;
  /* The JSON shape the model would be forced to return; reconciliation runs
   * on it exactly as on a deterministic parse. */
  schemaNote: string;
};

export function buildIngestionFallbackRequest(
  sanitisedDocument: SanitisedText,
): FallbackRequest {
  const prompt = [
    "Extract portfolio holdings from the following advisor-supplied document.",
    "Return strictly the JSON schema given; do not invent holdings; omit",
    "anything you cannot ground in the text. Every value must carry the line",
    "it came from.",
    "",
    String(sanitisedDocument),
  ].join("\n");
  return {
    prompt,
    schemaNote:
      '{ "holdings": [{ "rawLabel": string, "valueInr": number | null, "sourceLine": number }] }',
  };
}

export function runIngestionFallback(_request: FallbackRequest): never {
  if (process.env.SAMRIDDHI_ENABLE_LLM_INGESTION_FALLBACK !== "approved-wa12") {
    throw new Error(
      "WA12 gate: the LLM ingestion fallback is built but not enabled. It " +
        "must never run in tests; live validation is deferred debt, gated on " +
        "an explicitly approved budget.",
    );
  }
  throw new Error(
    "The LLM ingestion fallback wiring point is deliberately unimplemented " +
      "in this build (build-but-do-not-live-test, Package 07). Wire it to " +
      "the agent layer only under an explicit WA12 approval.",
  );
}
