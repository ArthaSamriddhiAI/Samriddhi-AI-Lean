/* Verification script for the E1 / E2 case-mode scope-builders (ADR-0024).
 * Run via: npx tsx scripts/_verify-scope-builders.ts
 *
 * Deterministic, no API spend, no DB. Loads the immutable t0 enriched
 * snapshot and the structured holdings, then asserts the scope strings are
 * data-grounded, source-labeled, honest about coverage misses, and apply the
 * PMS / AIF / non-equity look-through limitation per foundation.md:198.
 *
 * Coverage: E1 and E2 across proposal-target types (covered-MF, PMS, AIF,
 * debt/bond), direct-equity per-stock fundamentals, an honest coverage miss,
 * and a regression guard against the pre-enrichment templated string. */

import { loadSnapshot } from "../lib/agents/snapshot-loader";
import { buildE1Scope, buildE2Scope } from "../lib/agents/case/scope-builders";
import { HOLDINGS_BY_INVESTOR } from "../db/fixtures/structured-holdings";
import type { Proposal } from "../lib/agents/proposal";

type Failure = { name: string; detail: string };
const failures: Failure[] = [];

function assert(cond: boolean, name: string, detail: string) {
  if (!cond) failures.push({ name, detail });
}
function assertIncludes(haystack: string, needle: string, name: string) {
  assert(haystack.includes(needle), name, `expected to find ${JSON.stringify(needle)}`);
}
function assertExcludes(haystack: string, needle: string, name: string) {
  assert(!haystack.includes(needle), name, `expected NOT to find ${JSON.stringify(needle)}`);
}

const SNAPSHOT_ID = "t0_q2_2026";
const LIMIT_NOTE = "foundation.md:198, v8:705";

function prop(over: Partial<Proposal>): Proposal {
  return {
    action_type: "new_investment",
    target_category: "mutual_fund",
    target_instrument: "Unnamed",
    ticket_size_cr: 1,
    source_of_funds: "fresh_inflow",
    timeline: "this_quarter",
    rationale: null,
    ...over,
  };
}

async function main() {
  const snapshot = await loadSnapshot(SNAPSHOT_ID);

  /* T1: E1, covered-MF target (Iyengar). Existing equity-MF look-through is
   * data-grounded; structure headers present; old templated string gone. */
  {
    const s = buildE1Scope(
      snapshot,
      prop({ target_category: "mutual_fund", target_instrument: "HDFC Balanced Advantage Fund", ticket_size_cr: 0.5, source_of_funds: "fixed_deposits" }),
      HOLDINGS_BY_INVESTOR.iyengar,
    );
    assertIncludes(s, "== Existing portfolio: listed-equity look-through ==", "T1.header");
    assertIncludes(s, "== Proposal target ==", "T1.target_header");
    assertIncludes(s, "Axis Large Cap Fund", "T1.existing_mf");
    assertExcludes(s, "Look-through universe of", "T1.no_old_template");
  }

  /* T2: E1, honest coverage miss. HDFC Index Fund Nifty 50 is an equity MF
   * not present in mf_funds (debt D8); it must be named and marked uncovered,
   * not dropped. */
  {
    const s = buildE1Scope(
      snapshot,
      prop({ target_category: "mutual_fund", target_instrument: "HDFC Balanced Advantage Fund", ticket_size_cr: 0.5 }),
      HOLDINGS_BY_INVESTOR.iyengar,
    );
    assertIncludes(s, "HDFC Index Fund Nifty 50", "T2.miss_named");
    assertIncludes(s, "not in mf_funds coverage", "T2.miss_marked");
  }

  /* T3: E1, direct-equity per-stock fundamentals (Surana holds Reliance).
   * The join lands real fundamentals with a source label. */
  {
    const s = buildE1Scope(
      snapshot,
      prop({ target_category: "bond_listed", target_instrument: "NHAI / REC / PFC tax-free bond ladder", ticket_size_cr: 5, source_of_funds: "cash_balance" }),
      HOLDINGS_BY_INVESTOR.surana,
    );
    assertIncludes(s, "Reliance Industries", "T3.stock_named");
    assertIncludes(s, "ROCE 9.69%", "T3.stock_fundamental");
    assertIncludes(s, "[source: nifty500 snapshot]", "T3.source_label");
    // bond_listed target gets the limitation note, not look-through
    assertIncludes(s, LIMIT_NOTE, "T3.target_limitation");
  }

  /* T4: E1, PMS target (Malhotra). Target carries the limitation note and the
   * marginal-impact framing; existing MF context still data-grounded. */
  {
    const s = buildE1Scope(
      snapshot,
      prop({ target_category: "pms", target_instrument: "Quality Compounders PMS", ticket_size_cr: 1, source_of_funds: "mutual_funds" }),
      HOLDINGS_BY_INVESTOR.malhotra,
    );
    assertIncludes(s, LIMIT_NOTE, "T4.pms_limitation");
    assertIncludes(s, "marginal", "T4.marginal_framing");
    assertIncludes(s, "Mirae Asset Large Cap Fund", "T4.existing_mf");
  }

  /* T5: E1, AIF target (Menon). AIF target limitation note; Menon's foreign
   * equity is flagged as outside nifty500 coverage, not joined. */
  {
    const s = buildE1Scope(
      snapshot,
      prop({ target_category: "aif", target_instrument: "Cat II Private Credit AIF", ticket_size_cr: 5 }),
      HOLDINGS_BY_INVESTOR.menon,
    );
    assertIncludes(s, "aif", "T5.aif_target");
    assertIncludes(s, LIMIT_NOTE, "T5.aif_limitation");
    assertIncludes(s, "Foreign listed equity", "T5.foreign_note");
  }

  /* T6: E2 MF sector path. The workhorse funds these investors hold are
   * outside the 160/1773 sector-covered set (foundation.md:196), so the
   * positive source-labeled path is exercised via a genuinely covered fund
   * as the proposal target, while the held funds degrade honestly. */
  {
    const s = buildE2Scope(
      snapshot,
      prop({ target_category: "mutual_fund", target_instrument: "Aditya Birla Sun Life Large & Mid Cap Fund", ticket_size_cr: 1 }),
      HOLDINGS_BY_INVESTOR.iyengar,
    );
    assertIncludes(s, "== Existing portfolio: sector and business-model context ==", "T6.header");
    assertIncludes(s, "[source: mf_funds snapshot]", "T6.covered_mf_sector_source");
    assertIncludes(s, "top-5 sectors not disclosed in snapshot", "T6.uncovered_degrades_honestly");
    // DP2 guardrail: Iyengar's existing funds are uncovered, so the no-supplementation
    // instruction must be appended.
    assertIncludes(s, "Do not supplement from training-data category knowledge", "T6.guardrail_present");
  }

  /* T7: E2, direct-equity sector (Surana / Reliance) from tier_b_stats meta. */
  {
    const s = buildE2Scope(
      snapshot,
      prop({ target_category: "bond_listed", target_instrument: "tax-free bond ladder", ticket_size_cr: 5 }),
      HOLDINGS_BY_INVESTOR.surana,
    );
    assertIncludes(s, "Reliance Industries", "T7.stock_named");
    assertIncludes(s, "sector", "T7.sector_word");
    assertIncludes(s, "[source: nifty500 snapshot]", "T7.source_label");
  }

  /* T8: E2, PMS target (Bhatt). Sector limitation note for the PMS target. */
  {
    const s = buildE2Scope(
      snapshot,
      prop({ target_category: "pms", target_instrument: "Capital Goods Thematic PMS", ticket_size_cr: 2 }),
      HOLDINGS_BY_INVESTOR.bhatt,
    );
    assertIncludes(s, LIMIT_NOTE, "T8.pms_sector_limitation");
    assertIncludes(s, "ITC", "T8.existing_direct_equity");
  }

  /* T9: DP2 guardrail negative path. A fully-covered scenario (direct equity
   * with a nifty500 sector, target also a covered direct equity) must NOT
   * append the no-supplementation guardrail. */
  {
    const coveredOnly = {
      totalLiquidAumCr: 10,
      holdings: [
        { instrument: "Reliance Industries", assetClass: "Equity" as const, subCategory: "listed_large_cap" as const, valueCr: 5, weightPct: 50 },
      ],
    };
    const s = buildE2Scope(
      snapshot,
      prop({ target_category: "listed_equity_direct", target_instrument: "Reliance Industries", ticket_size_cr: 1 }),
      coveredOnly,
    );
    assertIncludes(s, "sector", "T9.has_sector");
    assertExcludes(s, "Do not supplement from training-data category knowledge", "T9.no_guardrail_when_covered");
  }

  const total = 9;
  if (failures.length) {
    console.error(`\nFAIL: ${failures.length} assertion(s) failed across ${total} tests:\n`);
    for (const f of failures) console.error(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log(`PASS: all scope-builder checks passed across ${total} tests.`);
}

main().catch((err) => {
  console.error("ERROR running scope-builder verification:", err);
  process.exit(1);
});
