/* The nine-cell model-portfolio vocabulary (Package 10, BM1 as ratified).
 *
 * The 3x3 grid is (risk profile) x (time horizon) with the cell ids the
 * Investor.modelCell column already uses (aggressive_long_term,
 * conservative_medium_term are live values; the onboarding flow writes the
 * "pending_mandate" sentinel). The enum and the axis mapping follow the
 * locked external reference (FR Entry 13.0 section 3); per-cell DEFAULT
 * content (bands, sub-sleeve splits) is deliberately NOT defined here: no
 * ratified per-cell band source exists on main (P43), and the house-view
 * framework extension that would seed it is held with in-flight colleague
 * work. The only cell with firm reference content is the foundation
 * section 2 anchor cell; every other cell renders its honest state.
 *
 * Resolution precedence (display semantics, ADR-0032): an investor's own
 * mandate bands govern wherever a mandate exists; the anchor-cell
 * MODEL_BANDS are the no-mandate fallback; cell defaults would slot between
 * the two when the P43 framework lands.
 */

export const RISK_ROWS = ["aggressive", "moderate", "conservative"] as const;
export const HORIZON_COLS = ["long_term", "medium_term", "short_term"] as const;

export type RiskRow = (typeof RISK_ROWS)[number];
export type HorizonCol = (typeof HORIZON_COLS)[number];
export type CellId = `${RiskRow}_${HorizonCol}`;

export const HORIZON_LABELS: Record<HorizonCol, string> = {
  long_term: "Long term (over 5 years)",
  medium_term: "Medium term (3 to 5 years)",
  short_term: "Short term (up to 3 years)",
};

export const RISK_LABELS: Record<RiskRow, string> = {
  aggressive: "Aggressive",
  moderate: "Moderate",
  conservative: "Conservative",
};

export function cellId(risk: RiskRow, horizon: HorizonCol): CellId {
  return `${risk}_${horizon}` as CellId;
}

/** The foundation section 2 anchor cell: the single indicative reference. */
export const ANCHOR_CELL: CellId = "aggressive_long_term";

/** The onboarding sentinel value Investor.modelCell carries until a mandate
 * conversation assigns a cell. Not a cell. */
export const PENDING_SENTINEL = "pending_mandate";

export function isCellId(v: string): v is CellId {
  return (RISK_ROWS as readonly string[]).some((r) =>
    (HORIZON_COLS as readonly string[]).some((h) => `${r}_${h}` === v),
  );
}
