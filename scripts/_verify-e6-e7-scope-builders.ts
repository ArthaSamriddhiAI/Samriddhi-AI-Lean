/* Verification for the E6 (PMS/AIF) and E7 (mutual fund) target scope-builders
 * (Phase 1.5, ADR-0026). Deterministic, no API, no DB. Loads the t0 enriched
 * snapshot and asserts E6/E7 produce data-grounded, source-labeled target scope
 * for covered instruments, honest-miss instructions for uncovered ones, and the
 * no-supplementation guardrail throughout.
 * Run via: npx tsx scripts/_verify-e6-e7-scope-builders.ts */

import { loadSnapshot } from "../lib/agents/snapshot-loader";
import { buildE6Scope, buildE7Scope } from "../lib/agents/case/scope-builders";
import type { Proposal, TargetCategory } from "../lib/agents/proposal";

const failures: string[] = [];
function inc(h: string, n: string, name: string) { if (!h.includes(n)) failures.push(`${name}: expected ${JSON.stringify(n)}`); }
function exc(h: string, n: string, name: string) { if (h.includes(n)) failures.push(`${name}: expected NOT ${JSON.stringify(n)}`); }

const GUARD = "do not";
const GUARD2 = "supplement from training-data";

function prop(target_category: TargetCategory, target_instrument: string): Proposal {
  return { action_type: "new_investment", target_category, target_instrument, ticket_size_cr: 2, source_of_funds: "fresh_inflow", timeline: "this_quarter", rationale: null };
}

async function main() {
  const snap = await loadSnapshot("t0_q2_2026");

  // T1: E7 covered MF
  const e7cov = buildE7Scope(snap, prop("mutual_fund_debt", "ICICI Prudential Corporate Bond Fund"));
  inc(e7cov, "AUM Rs 31712", "T1.aum");
  inc(e7cov, "7.32%", "T1.return3y");
  inc(e7cov, "[source: mf_funds snapshot]", "T1.source");
  inc(e7cov, GUARD2, "T1.guardrail");
  exc(e7cov, "Target scheme:", "T1.no_old_template");

  // T2: E7 absent MF
  const e7abs = buildE7Scope(snap, prop("mutual_fund_debt", "Nonexistent Phantom Debt Fund XYZ"));
  inc(e7abs, "not in mf_funds snapshot coverage", "T2.honest_miss");
  inc(e7abs, GUARD2, "T2.guardrail");
  exc(e7abs, "[source: mf_funds snapshot]", "T2.no_source_when_absent");

  // T3: E6 covered PMS (Stallion / Malhotra)
  const e6pms = buildE6Scope(snap, prop("pms", "Stallion Asset Core Fund"));
  inc(e6pms, "Amit Jeswani", "T3.manager");
  inc(e6pms, "hurdle", "T3.fee");
  inc(e6pms, "[source: pms snapshot]", "T3.source");
  inc(e6pms, GUARD2, "T3.guardrail");

  // T4: E6 covered PMS re-pick (Ambit Build India / Bhatt)
  const e6bhatt = buildE6Scope(snap, prop("pms", "Ambit Build India Portfolio (PMS)"));
  inc(e6bhatt, "[source: pms snapshot]", "T4.source");
  inc(e6bhatt, "manager", "T4.manager_field");

  // T5: E6 covered AIF (Cat I)
  const e6aif = buildE6Scope(snap, prop("aif", "INDIA DISCOVERY FUND II"));
  inc(e6aif, "[source: aif snapshot]", "T5.source");
  inc(e6aif, "fee", "T5.fee_field");

  // T6: E6 absent AIF (Cat II private credit / Menon honest-miss)
  const e6menon = buildE6Scope(snap, prop("aif", "Vivriti Alpha Debt Fund (Cat II private credit AIF)"));
  inc(e6menon, "wrapper-level data not available in snapshot for this product class", "T6.honest_miss");
  inc(e6menon, GUARD2, "T6.guardrail");
  exc(e6menon, "[source: aif snapshot]", "T6.no_source_when_absent");

  // T7: regression, no old templated wrapper string
  exc(e6pms, "Target wrapper:", "T7.no_old_template");

  const total = 7;
  if (failures.length) {
    console.error(`\nFAIL: ${failures.length} assertion(s):`);
    for (const f of failures) console.error("  -", f);
    process.exit(1);
  }
  console.log(`PASS: all E6/E7 scope-builder checks passed across ${total} test groups.`);
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
