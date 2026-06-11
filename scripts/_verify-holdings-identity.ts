/* _verify-holdings-identity: the B5 freeze invariant (Package 07).
 *
 * For each canonical transaction-bearing record, deriveStructuredHoldings()
 * must reproduce the hand-authored db/fixtures/structured-holdings.ts record
 * byte-identically (JSON.stringify equality). This is what lets the canonical
 * layer evolve beneath the five frozen demo investors without any drift in
 * the demo surface: if this script exits 0, the freeze holds.
 *
 * Also asserts internal consistency of the canonical layer itself: closing
 * units times the anchor NAV tie to the holding value for every
 * transaction-bearing holding (within a rupee), and transaction unit sums
 * match closing units.
 *
 * Deterministic, offline, zero API (WA12 not engaged). Run:
 *   npx tsx scripts/_verify-holdings-identity.ts
 */

import { HOLDINGS_BY_INVESTOR } from "../db/fixtures/structured-holdings";
import { INVESTOR_TRANSACTIONS } from "../db/fixtures/investor-transactions";
import { deriveStructuredHoldings } from "../db/fixtures/canonical-holdings";

let failures = 0;

function check(label: string, ok: boolean, detail?: string): void {
  if (!ok) {
    failures += 1;
    console.error("  FAIL " + label + (detail ? ": " + detail : ""));
  } else {
    console.log("  ok   " + label);
  }
}

console.log("B5 freeze invariant (derived StructuredHoldings byte-identity):");
const covered = new Set<string>();
for (const rec of INVESTOR_TRANSACTIONS) {
  covered.add(rec.investorId);
  const frozen = HOLDINGS_BY_INVESTOR[rec.investorId];
  if (!frozen) {
    check(rec.investorId, false, "no frozen fixture for this investor");
    continue;
  }
  const derived = JSON.stringify(deriveStructuredHoldings(rec));
  const target = JSON.stringify(frozen);
  check(
    rec.investorId + " byte-identity",
    derived === target,
    derived === target
      ? undefined
      : "first divergence at char " +
          [...derived].findIndex((c, i) => c !== target[i]),
  );
}

console.log("canonical-layer internal consistency:");
for (const rec of INVESTOR_TRANSACTIONS) {
  for (const h of rec.holdings) {
    if (!h.transactions) continue;
    const unitRows = h.transactions.filter((t) => t.units !== null);
    const unitSum = unitRows.reduce((s, t) => s + (t.units ?? 0), 0);
    check(
      rec.investorId + " / " + h.instrument + " unit-sum tie",
      Math.abs(unitSum - (h.closingUnits ?? NaN)) < 0.01,
    );
    const terminal = (h.closingUnits ?? 0) * (h.closingNav ?? 0);
    check(
      rec.investorId + " / " + h.instrument + " terminal tie",
      Math.abs(terminal - h.valueCr * 1e7) <= 1.0,
      terminal.toFixed(2) + " vs " + (h.valueCr * 1e7).toFixed(2),
    );
  }
}

const exempt = Object.keys(HOLDINGS_BY_INVESTOR).filter((k) => !covered.has(k));
console.log(
  "exempt (hand-authored only, no canonical record): " +
    (exempt.join(", ") || "none"),
);

if (failures > 0) {
  console.error("\n_verify-holdings-identity: " + failures + " failure(s)");
  process.exit(1);
}
console.log("\n_verify-holdings-identity: PASS");
