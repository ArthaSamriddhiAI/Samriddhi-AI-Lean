/* Re-back-fill the whole-book look-through metric fields (T-5.16) after the
 * PMS-sector field-name fix (`s.sector` -> `s.name`, portfolio-risk-analytics.ts).
 *
 * Deterministic recompute over existing data: NO agent, NO API, NO prose change.
 * Replaces ONLY the three look-through fields in content.metrics.concentration
 * (stockExposureLookThrough, sectorExposureLookThrough, lookThroughCoverage) with
 * the recomputed values; everything else in the fixture (prose, betas, the rest of
 * metrics, evidence, blocks) is byte-identical. The look-through is profile- and
 * mandate-independent, so the recomputed values are correct regardless of the
 * profile passed; only the affected cases (those with a disclosed-sector PMS) are
 * touched. Mirrors the additive-write discipline (JSON.stringify(fixture,null,2)+\n).
 *
 * Run: npx tsx scripts/backfill-lookthrough.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { computeMetrics } from "../lib/agents/portfolio-risk-analytics";
import { loadSnapshot } from "../lib/agents/snapshot-loader";
import { HOLDINGS_BY_INVESTOR } from "../db/fixtures/structured-holdings";
import { MANDATES_BY_INVESTOR } from "../db/fixtures/structured-mandates";

const FIXTURE_DIR = path.resolve(process.cwd(), "db", "fixtures", "cases");
// Only the cases with a disclosed-sector PMS are affected by the fix.
const AFFECTED = ["c-2026-05-14-bhatt-01", "c-2026-05-15-surana-01"];
const PROFILE = { riskAppetite: "Aggressive", liquidityTier: "Essential" } as const;

async function main() {
  for (const id of AFFECTED) {
    const fp = path.join(FIXTURE_DIR, `${id}.json`);
    const fixture = JSON.parse(await fs.readFile(fp, "utf-8"));
    const holdings = HOLDINGS_BY_INVESTOR[fixture.investorId];
    if (!holdings) { console.log(`  ${id}: no structured holdings; skip`); continue; }
    const snapshot = await loadSnapshot(fixture.snapshotId);
    const mandate = MANDATES_BY_INVESTOR[fixture.investorId] ?? null;
    const m = computeMetrics(holdings, snapshot, PROFILE as any, mandate as any);

    const c = fixture.content?.metrics?.concentration;
    if (!c) { console.log(`  ${id}: no content.metrics.concentration; skip`); continue; }
    const beforeNull = (c.sectorExposureLookThrough ?? []).find((e: any) => e.sector == null);
    // Replace ONLY the three look-through fields; nothing else is touched.
    c.stockExposureLookThrough = m.concentration.stockExposureLookThrough;
    c.sectorExposureLookThrough = m.concentration.sectorExposureLookThrough;
    c.lookThroughCoverage = m.concentration.lookThroughCoverage;
    const afterNull = c.sectorExposureLookThrough.find((e: any) => e.sector == null);

    await fs.writeFile(fp, JSON.stringify(fixture, null, 2) + "\n", "utf-8");
    console.log(
      `  ${id}: look-through refreshed; null-sector before=${beforeNull ? beforeNull.weightPct + "%" : "none"} after=${afterNull ? afterNull.weightPct + "%" : "none"}`,
    );
  }
  console.log("Done (deterministic; no agent, no API).");
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
