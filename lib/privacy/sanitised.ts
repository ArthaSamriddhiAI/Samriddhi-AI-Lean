/* The sanitised-text brand (Package 07, B2/B3 boundary).
 *
 * SanitisedText is the only string type the LLM-facing surfaces accept: the
 * ingestion fallback and any future prompt assembly take SanitisedText, not
 * string, so the "PII is stripped BEFORE any model-facing path receives the
 * data" ordering is enforced at compile time, not by convention. The brand is
 * only mintable through the sanitiser in lib/privacy/sanitiser.ts.
 */

declare const sanitisedBrand: unique symbol;

export type SanitisedText = string & { readonly [sanitisedBrand]: true };

/* Internal mint; do not call outside lib/privacy. The sanitiser is the one
 * legitimate producer. */
export function _mintSanitised(s: string): SanitisedText {
  return s as SanitisedText;
}
