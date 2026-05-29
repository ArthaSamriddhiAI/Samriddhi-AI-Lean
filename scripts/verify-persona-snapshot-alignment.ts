/* Persona-snapshot alignment check (deterministic, read-only, no API).
 *
 * Every investor persona references specific PMS / AIF / MF / listed product
 * variants by instrument name. Those names must resolve to a real record in
 * the snapshot universe (the same category-guarded strict join A3 uses for its
 * operational surfacing), or the persona will carry holdings whose per-
 * instrument operational metadata can never be surfaced (Reading-B silence).
 *
 * This utility makes that reconciliation a gate: run it on a persona until it
 * exits 0 before treating the persona as locked. On the existing personas it
 * exits 1 by design, documenting the known persona-universe mismatch logged in
 * docs/debt/product_debt_log.md (P40). See docs/working_agreements/persona-
 * snapshot-alignment.md.
 *
 * Usage:
 *   npm run check:persona-snapshot
 *   npm run check:persona-snapshot -- --investor=bhatt
 *   npm run check:persona-snapshot -- --snapshot=t0_q2_2026
 *
 * Exit code: 0 when every checkable holding (PMS / AIF / MF / listed) strict-
 * matches a category-consistent snapshot record; 1 when any does not. Holdings
 * with no relevant collection (intl, FD, bond, cash, gold, REIT, unlisted) are
 * reported as not-applicable and do not affect the exit code.
 */

import { HOLDINGS_BY_INVESTOR } from "@/db/fixtures/structured-holdings";
import { loadSnapshot } from "@/lib/agents/snapshot-loader";
import {
  dispatchCollection,
  collectionRecords,
  strictNameMatch,
  expectedCategory,
  nameOverlapScore,
  type SnapshotCollection,
} from "@/lib/agents/operational-scope";

const DEFAULT_SNAPSHOT = "t0_q2_2026";
const FUND_COLLECTIONS: SnapshotCollection[] = ["pms", "aif", "mf"];

type Outcome = "match" | "category_violation" | "non_match" | "not_applicable";

function parseArgs(argv: string[]): { investor?: string; snapshot: string } {
  let investor: string | undefined;
  let snapshot = DEFAULT_SNAPSHOT;
  for (const a of argv) {
    const mi = /^--investor=(.+)$/.exec(a);
    if (mi) investor = mi[1].toLowerCase();
    const ms = /^--snapshot=(.+)$/.exec(a);
    if (ms) snapshot = ms[1];
  }
  return { investor, snapshot };
}

async function main(): Promise<void> {
  const { investor, snapshot: snapshotId } = parseArgs(process.argv.slice(2));
  const snapshot = await loadSnapshot(snapshotId);

  const personas = investor
    ? (HOLDINGS_BY_INVESTOR[investor] ? [investor] : [])
    : Object.keys(HOLDINGS_BY_INVESTOR);
  if (investor && personas.length === 0) {
    console.error(`Unknown investor "${investor}". Known: ${Object.keys(HOLDINGS_BY_INVESTOR).join(", ")}`);
    process.exit(2);
  }

  console.log("=".repeat(78));
  console.log(`PERSONA-SNAPSHOT ALIGNMENT CHECK  (snapshot ${snapshotId})`);
  console.log("=".repeat(78));

  let totalCheckable = 0;
  let totalMatch = 0;
  let totalCategoryViolation = 0;
  let totalNonMatch = 0;

  for (const name of personas) {
    const holdings = HOLDINGS_BY_INVESTOR[name];
    console.log(`\n### ${name.toUpperCase()}  (${holdings.holdings.length} holdings)`);

    for (const h of holdings.holdings) {
      const collection = dispatchCollection(h.subCategory);
      if (collection === "na") {
        console.log(`  [n/a ] ${h.instrument}  (${h.subCategory}: no snapshot collection)`);
        continue;
      }
      totalCheckable += 1;
      const recs = collectionRecords(snapshot, collection);
      const guard = expectedCategory(h.subCategory);
      const nameMatches = recs.filter((r) => strictNameMatch(r.name, h.instrument));
      const consistent = nameMatches.filter((r) => !guard || (r.category != null && guard.test(r.category)));

      let outcome: Outcome;
      if (consistent.length > 0) {
        outcome = "match";
        totalMatch += 1;
        console.log(`  [MATCH] ${h.instrument}  (${collection})  ->  ${consistent[0].name}`);
      } else if (nameMatches.length > 0) {
        outcome = "category_violation";
        totalCategoryViolation += 1;
        const m = nameMatches[0];
        console.log(`  [CATG!] ${h.instrument}  (${collection})  name-matches "${m.name}" but category "${m.category ?? "?"}" fails guard "${guard?.label ?? "?"}"  ->  silent`);
      } else {
        outcome = "non_match";
        totalNonMatch += 1;
        console.log(`  [MISS ] ${h.instrument}  (${collection})  ->  no strict match`);
        const near = recs
          .map((r) => ({ name: r.name, score: nameOverlapScore(h.instrument, r.name) }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
        for (const n of near) console.log(`            near-miss ${n.score.toFixed(2)}: ${n.name}`);
        for (const other of FUND_COLLECTIONS) {
          if (other === collection) continue;
          const hit = collectionRecords(snapshot, other).find((r) => strictNameMatch(r.name, h.instrument));
          if (hit) console.log(`            possible mis-tag: strict match exists in "${other}" -> ${hit.name}`);
        }
      }
      void outcome;
    }
  }

  console.log("\n" + "=".repeat(78));
  console.log(
    `SUMMARY: ${totalCheckable} checkable holdings | ${totalMatch} match | ` +
      `${totalCategoryViolation} category-violation | ${totalNonMatch} non-match`,
  );
  const ok = totalCategoryViolation === 0 && totalNonMatch === 0;
  console.log(ok ? "RESULT: all checkable holdings aligned (exit 0)" : "RESULT: misalignment present (exit 1)");
  console.log("=".repeat(78));
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
