/* Render-time currency-symbol substitution.
 *
 * The underlying data layer keeps "Rs" throughout: foundation document,
 * seed strings, structured holdings, LLM-generated case content. This is
 * deliberate; "Rs" is the literal carried in source documents and the seed
 * strings should not drift from those sources. The render layer
 * substitutes "Rs " → "₹" (no trailing space) at display time so the UI
 * shows the proper rupee glyph.
 *
 * The substitution requires a digit immediately after the "Rs " (with
 * optional dot) to avoid clobbering unit labels like "Rs Cr" in column
 * headers ("Value (Rs Cr)"). Those stay as-is; the glyph appears only
 * adjacent to amounts.
 *
 * Use formatRupees(text) for individual strings. Use transformRupeesDeep
 * for an entire JSON tree, e.g., a parsed BriefingContent or a holdings
 * map; it walks the tree and substitutes in every string leaf.
 */

const RUPEES_BEFORE_DIGIT = /Rs\.?\s+(?=[\d-])/g;

export function formatRupees(text: string): string {
  return text.replace(RUPEES_BEFORE_DIGIT, "₹");
}

export function transformRupeesDeep<T>(value: T): T {
  if (typeof value === "string") return formatRupees(value) as unknown as T;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(transformRupeesDeep) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = transformRupeesDeep(v);
    }
    return out as unknown as T;
  }
  return value;
}
