/* Verification script for A2 Layer 1, the deterministic verdict assigner.
 * Run via: npx tsx scripts/_verify-a2-classification.ts
 *
 * Layer 1 only (no LLM). Covers:
 *   1. The skill file's Worked Example (4-PMS wrapper over-accumulation):
 *      all four Discuss, Marcellus carries an extra position driver,
 *      Motilal carries an extra complexity_premium driver.
 *   2. Determinism: same input run twice produces byte-identical output.
 *   3. Escalate path: a >15% position lifts a holding to Review.
 *   4. Default to Maintain: a clean holding with no signals.
 *   5. E4 behavioural corroborator: watch-capped, never lifts the tier,
 *      only attaches where a holding-scope driver already exists.
 *   6. Edge case 2: metrics genuinely missing -> unable_to_classify.
 *
 * Per the skill, Layer 1 is the audit surface and must be replayable; this
 * script is the standing guard on that property.
 *
 * Reconciliation note: the skill's Worked Example prose says "Motilal 10%"
 * but its Layer 1 table gives Motilal no position driver, and the same
 * paragraph states the weights are "approximately ... between 8% and 11%".
 * A2 anchors the position threshold to M0.PortfolioRiskAnalytics (flag at
 * >= 10%, the single source of truth; A2 does not invent thresholds), so
 * this fixture uses Motilal 9.8% to reproduce the table's intended driver
 * set without diverging from the M0 boundary. Surfaced for the Checkpoint 2
 * candidate review.
 */

import {
  classifyHoldings,
  stripLongDashes,
  type A2ClassifyInput,
  type A2Layer1Result,
} from "../lib/agents/a2-classification";
import type { EvidenceBundle } from "../lib/agents/stitcher";
import type { PortfolioMetrics } from "../lib/agents/portfolio-risk-analytics";
import type { E6Output, E6PerProduct } from "../lib/agents/e6-wrappers";
import type {
  StructuredHoldings,
  AssetClass,
  SubCategory,
} from "../db/fixtures/structured-holdings";

type Failure = { name: string; detail: string };
const failures: Failure[] = [];

function assert(cond: boolean, name: string, detail: string) {
  if (!cond) failures.push({ name, detail });
}

function driverTypes(
  result: A2Layer1Result,
  holdingRef: string,
): string[] {
  const h = result.holding_verdicts.find((x) => x.holding_ref === holdingRef);
  return h ? h.drivers.map((d) => d.driver_type) : ["<holding not found>"];
}

function verdictOf(result: A2Layer1Result, holdingRef: string): string {
  return (
    result.holding_verdicts.find((x) => x.holding_ref === holdingRef)?.verdict ??
    "<holding not found>"
  );
}

const EMPTY_EVIDENCE: EvidenceBundle = {
  e1: null,
  e2: null,
  e3: null,
  e4: null,
  e6: null,
  e7: null,
};

function makeMetrics(over: {
  positionFlags?: PortfolioMetrics["concentration"]["positionFlags"];
  wrappers?: Partial<PortfolioMetrics["concentration"]["wrappers"]>;
  sector?: PortfolioMetrics["concentration"]["sectorExposureMfLookThrough"];
  floorBreach?: boolean;
}): PortfolioMetrics {
  const acBlock = {
    actualPct: 0,
    targetPct: 0,
    band: [0, 0] as [number, number],
    deviationPct: 0,
    inBand: true,
  };
  return {
    totalLiquidAumCr: 22.1,
    holdingsCount: 0,
    assetClass: {
      Equity: acBlock,
      Debt: acBlock,
      Alternatives: acBlock,
      Cash: acBlock,
    } as PortfolioMetrics["assetClass"],
    concentration: {
      hhiHoldingLevel: 0.2,
      hhiAssetClassLevel: 0.5,
      top1: { instrument: "(none)", weightPct: 0 },
      top5: [],
      bucketCeilingHhi: 0.3,
      bucketTier: "Aggressive",
      hhiBreach: false,
      positionFlags: over.positionFlags ?? [],
      wrappers: {
        pmsCount: 0,
        pmsAggregatePct: 0,
        pmsList: [],
        aifCount: 0,
        aifAggregatePct: 0,
        aifList: [],
        wrapperCountFlag: false,
        wrapperShareFlag: false,
        ...over.wrappers,
      },
      sectorExposureMfLookThrough: over.sector ?? [],
      mfCoverage: {
        coveredCount: 0,
        uncoveredCount: 0,
        coveredWeightPct: 0,
        uncoveredWeightPct: 0,
      },
    },
    liquidity: {
      bucketBreakdown: { T_30: 0, T_90: 0, T_365: 0, Locked: 0 },
      t30PlusT90Pct: 0,
      tier: "essential",
      tierFloor: { minPct: 5, maxPct: 15 },
      floorBreach: over.floorBreach ?? false,
    },
    cashDeployment: { cashSharePct: 0, deploymentGapPct: 0, cashDragFlag: false },
    computedAt: "fixed",
  };
}

function makeE6Product(
  instrument: string,
  opts: {
    complexity?: E6PerProduct["complexity_premium_earned"];
    verdict?: E6PerProduct["overall_verdict"];
  },
): E6PerProduct {
  return {
    instrument,
    wrapper_type: "PMS",
    sub_category: "pms_concentrated_quality",
    weight_pct: 10,
    manager_quality: "adequate",
    strategy_consistency: "moderate",
    fee_structure_assessment: "2% fixed plus 20% performance over hurdle",
    fee_normalised_bps: 200,
    liquidity_terms: "quarterly redemption, 30-day notice",
    concentration_or_strategy_profile: "concentrated quality, 18 to 22 names",
    performance_vs_benchmark: "trails Nifty 500 TRI by 1.8pp over 4 quarters",
    complexity_premium_earned: opts.complexity ?? "yes",
    capacity_concern: "low",
    overall_verdict: opts.verdict ?? "positive",
    key_drivers: [],
    key_risks: [],
    recommended_alternatives: [],
    confidence: 0.7,
    reasoning_trace: "fixture",
  };
}

function e6Bundle(products: E6PerProduct[]): EvidenceBundle {
  const e6: E6Output = {
    analysis_scope: products.map((p) => p.instrument),
    per_product_evaluations: products,
    cross_product_observations: [],
    scope_notes: "fixture",
    overall_e6_verdict: "positive_with_caution",
    escalate_to_master: false,
    reasoning_summary: "fixture",
  };
  return { ...EMPTY_EVIDENCE, e6 };
}

/* ---------------------------------------------------------------- */
/* Test 1 + 2: skill Worked Example and determinism.                */
/* ---------------------------------------------------------------- */

const MARCELLUS = "Marcellus Consistent Compounder PMS";
const WHITE_OAK = "White Oak India Pioneers PMS";
const MOTILAL = "Motilal Oswal Value PMS";
const ASK = "ASK India Select PMS";

const workedHoldings: StructuredHoldings = {
  totalLiquidAumCr: 22.1,
  holdings: [
    { instrument: MARCELLUS, assetClass: "Equity" as AssetClass, subCategory: "pms_concentrated_quality" as SubCategory, valueCr: 2.43, weightPct: 11.0 },
    { instrument: WHITE_OAK, assetClass: "Equity" as AssetClass, subCategory: "pms_growth_quality" as SubCategory, valueCr: 1.99, weightPct: 9.0 },
    { instrument: MOTILAL, assetClass: "Equity" as AssetClass, subCategory: "pms_value" as SubCategory, valueCr: 2.17, weightPct: 9.8 },
    { instrument: ASK, assetClass: "Equity" as AssetClass, subCategory: "pms_focused_midcap" as SubCategory, valueCr: 1.99, weightPct: 9.0 },
  ],
};

const workedMetrics = makeMetrics({
  positionFlags: [{ instrument: MARCELLUS, weightPct: 11.0, severity: "flag" }],
  wrappers: {
    pmsCount: 4,
    pmsAggregatePct: 38.8,
    pmsList: workedHoldings.holdings.map((h) => ({ instrument: h.instrument, weightPct: h.weightPct })),
    wrapperCountFlag: true,
    wrapperShareFlag: true,
  },
});

const workedEvidence = e6Bundle([
  makeE6Product(MARCELLUS, { complexity: "yes", verdict: "positive" }),
  makeE6Product(WHITE_OAK, { complexity: "yes", verdict: "positive" }),
  makeE6Product(MOTILAL, { complexity: "no", verdict: "positive" }),
  makeE6Product(ASK, { complexity: "yes", verdict: "positive" }),
]);

const workedInput: A2ClassifyInput = {
  caseId: "verify-worked-example",
  asOfDate: "2026-04-02",
  holdings: workedHoldings,
  metrics: workedMetrics,
  evidence: workedEvidence,
};

const r1 = classifyHoldings(workedInput);
const r2 = classifyHoldings(workedInput);

assert(
  JSON.stringify(r1) === JSON.stringify(r2),
  "determinism",
  "classifyHoldings produced different output on a second run with identical input",
);

for (const ref of [MARCELLUS, WHITE_OAK, MOTILAL, ASK]) {
  assert(
    verdictOf(r1, ref) === "discuss",
    `worked:${ref}:verdict`,
    `expected discuss, got ${verdictOf(r1, ref)}`,
  );
}

assert(
  JSON.stringify(driverTypes(r1, MARCELLUS)) ===
    JSON.stringify(["wrapper_over_accumulation", "position_concentration"]),
  "worked:marcellus:drivers",
  `got ${JSON.stringify(driverTypes(r1, MARCELLUS))}`,
);
assert(
  JSON.stringify(driverTypes(r1, WHITE_OAK)) ===
    JSON.stringify(["wrapper_over_accumulation"]),
  "worked:whiteoak:drivers",
  `got ${JSON.stringify(driverTypes(r1, WHITE_OAK))}`,
);
assert(
  JSON.stringify(driverTypes(r1, MOTILAL)) ===
    JSON.stringify(["wrapper_over_accumulation", "complexity_premium"]),
  "worked:motilal:drivers",
  `got ${JSON.stringify(driverTypes(r1, MOTILAL))}`,
);
assert(
  JSON.stringify(driverTypes(r1, ASK)) ===
    JSON.stringify(["wrapper_over_accumulation"]),
  "worked:ask:drivers",
  `got ${JSON.stringify(driverTypes(r1, ASK))}`,
);

assert(
  r1.summary.discuss_count === 4 &&
    r1.summary.maintain_count === 0 &&
    r1.summary.monitor_count === 0 &&
    r1.summary.review_count === 0 &&
    r1.summary.unable_to_classify_count === 0,
  "worked:summary",
  `got ${JSON.stringify(r1.summary)}`,
);

/* ---------------------------------------------------------------- */
/* Test 3: escalate path. >15% position -> Review.                  */
/* ---------------------------------------------------------------- */

const RIL = "Reliance Industries";
const escalateInput: A2ClassifyInput = {
  caseId: "verify-escalate",
  asOfDate: "2026-04-02",
  holdings: {
    totalLiquidAumCr: 34.5,
    holdings: [
      { instrument: RIL, assetClass: "Equity" as AssetClass, subCategory: "listed_large_cap" as SubCategory, valueCr: 7, weightPct: 20.3 },
    ],
  },
  metrics: makeMetrics({
    positionFlags: [{ instrument: RIL, weightPct: 20.3, severity: "escalate" }],
  }),
  evidence: EMPTY_EVIDENCE,
};
const rEsc = classifyHoldings(escalateInput);
assert(
  verdictOf(rEsc, RIL) === "review",
  "escalate:verdict",
  `expected review, got ${verdictOf(rEsc, RIL)}`,
);

/* ---------------------------------------------------------------- */
/* Test 4: default to Maintain. Clean holding, no signals.          */
/* ---------------------------------------------------------------- */

const CLEAN = "Parag Parikh Flexi Cap Fund";
const cleanInput: A2ClassifyInput = {
  caseId: "verify-clean",
  asOfDate: "2026-04-02",
  holdings: {
    totalLiquidAumCr: 18,
    holdings: [
      { instrument: CLEAN, assetClass: "Equity" as AssetClass, subCategory: "mf_active_flexi_cap" as SubCategory, valueCr: 1.2, weightPct: 6.7 },
    ],
  },
  metrics: makeMetrics({}),
  evidence: EMPTY_EVIDENCE,
};
const rClean = classifyHoldings(cleanInput);
assert(
  verdictOf(rClean, CLEAN) === "maintain" &&
    driverTypes(rClean, CLEAN).length === 0,
  "clean:maintain",
  `expected maintain with no drivers, got ${verdictOf(rClean, CLEAN)} / ${JSON.stringify(driverTypes(rClean, CLEAN))}`,
);

/* ---------------------------------------------------------------- */
/* Test 5: E4 behavioural corroborator. watch-capped, never lifts.  */
/* ---------------------------------------------------------------- */

const e4Material: EvidenceBundle = {
  ...e6Bundle([makeE6Product(MARCELLUS, { complexity: "no", verdict: "positive" })]),
  e4: {
    stated_risk_tolerance: { bucket: "aggressive", specific_language: "x", horizon: "5y+" },
    revealed_behavioural_patterns: {
      market_event_response: "x",
      initiative_pattern: "mixed",
      engagement_style: "distant",
      product_addition_pattern: "peer_network",
      notes: [],
    },
    family_advisor_dynamics: {
      decision_structure: "sole",
      formal_authority: "x",
      practical_influence: "x",
      friction_points: [],
    },
    historical_decision_pattern: {
      prior_cases_count: 0,
      trajectory_summary: "x",
      acceptance_rate: "unknown",
      time_to_decision: "unknown",
    },
    stated_vs_revealed_divergence: {
      direction: "stated_more_aggressive_than_revealed",
      magnitude: "material",
      implication: "treat the effective risk tolerance as moderate-aggressive",
    },
    limited_history_flag: true,
    key_drivers: [],
    key_risks: [],
    confidence: 0.62,
    escalate_to_master: false,
    reasoning_summary: "fixture",
  },
};

const behaviouralInput: A2ClassifyInput = {
  caseId: "verify-behavioural",
  asOfDate: "2026-04-02",
  holdings: {
    totalLiquidAumCr: 22.1,
    holdings: [
      { instrument: MARCELLUS, assetClass: "Equity" as AssetClass, subCategory: "pms_concentrated_quality" as SubCategory, valueCr: 2.5, weightPct: 11.3 },
      { instrument: "HDFC Bank FD", assetClass: "Debt" as AssetClass, subCategory: "bank_fd" as SubCategory, valueCr: 1.5, weightPct: 7.0 },
    ],
  },
  metrics: makeMetrics({
    positionFlags: [{ instrument: MARCELLUS, weightPct: 11.3, severity: "flag" }],
  }),
  evidence: e4Material,
};
const rBeh = classifyHoldings(behaviouralInput);
const marc = rBeh.holding_verdicts.find((h) => h.holding_ref === MARCELLUS)!;
const behDriver = marc.drivers.find((d) => d.driver_type === "behavioural");
assert(
  !!behDriver && behDriver.severity === "watch",
  "behavioural:attached",
  `expected a watch behavioural driver on Marcellus, got ${JSON.stringify(marc.drivers.map((d) => [d.driver_type, d.severity]))}`,
);
assert(
  marc.verdict === "discuss",
  "behavioural:no-tier-lift",
  `behavioural watch must not lift the tier; Marcellus already had a flag driver so it stays discuss, got ${marc.verdict}`,
);
const fd = rBeh.holding_verdicts.find((h) => h.holding_ref === "HDFC Bank FD")!;
assert(
  fd.verdict === "maintain" && fd.drivers.length === 0,
  "behavioural:not-standalone",
  `a clean holding with no holding-scope driver must not receive a behavioural driver, got ${fd.verdict} / ${JSON.stringify(fd.drivers.map((d) => d.driver_type))}`,
);

/* ---------------------------------------------------------------- */
/* Test 6: edge case 2. metrics missing -> unable_to_classify.      */
/* ---------------------------------------------------------------- */

const naInput: A2ClassifyInput = {
  caseId: "verify-na",
  asOfDate: "2026-04-02",
  holdings: {
    totalLiquidAumCr: 10,
    holdings: [
      { instrument: "Some Fund", assetClass: "Equity" as AssetClass, subCategory: "mf_active_large_cap" as SubCategory, valueCr: 1, weightPct: 10 },
    ],
  },
  metrics: null,
  evidence: EMPTY_EVIDENCE,
};
const rNa = classifyHoldings(naInput);
assert(
  verdictOf(rNa, "Some Fund") === "unable_to_classify" &&
    rNa.summary.unable_to_classify_count === 1 &&
    driverTypes(rNa, "Some Fund")[0] === "evidence_unavailable",
  "edge2:unable_to_classify",
  `got verdict ${verdictOf(rNa, "Some Fund")}, drivers ${JSON.stringify(driverTypes(rNa, "Some Fund"))}`,
);

/* ---------------------------------------------------------------- */
/* Test 7: instrument-match precision. A debt FD must not inherit    */
/* the listed equity's position flag via name-stem containment.      */
/* ---------------------------------------------------------------- */

const matchInput: A2ClassifyInput = {
  caseId: "verify-match",
  asOfDate: "2026-04-02",
  holdings: {
    totalLiquidAumCr: 22.1,
    holdings: [
      { instrument: "HDFC Bank", assetClass: "Equity" as AssetClass, subCategory: "listed_large_cap" as SubCategory, valueCr: 2.5, weightPct: 11.3 },
      { instrument: "HDFC Bank FD", assetClass: "Debt" as AssetClass, subCategory: "bank_fd" as SubCategory, valueCr: 1.55, weightPct: 7.0 },
    ],
  },
  // M0 only flags the listed position (11.3% >= 10%); the FD at 7% is not flagged.
  metrics: makeMetrics({
    positionFlags: [{ instrument: "HDFC Bank", weightPct: 11.3, severity: "flag" }],
  }),
  evidence: EMPTY_EVIDENCE,
};
const rMatch = classifyHoldings(matchInput);
assert(
  verdictOf(rMatch, "HDFC Bank") === "discuss" &&
    driverTypes(rMatch, "HDFC Bank")[0] === "position_concentration",
  "match:listed-flagged",
  `expected HDFC Bank discuss with position_concentration, got ${verdictOf(rMatch, "HDFC Bank")} / ${JSON.stringify(driverTypes(rMatch, "HDFC Bank"))}`,
);
assert(
  verdictOf(rMatch, "HDFC Bank FD") === "maintain" &&
    driverTypes(rMatch, "HDFC Bank FD").length === 0,
  "match:fd-not-cross-flagged",
  `the FD (7%, below 10%) must not inherit the listed HDFC Bank flag, got ${verdictOf(rMatch, "HDFC Bank FD")} / ${JSON.stringify(driverTypes(rMatch, "HDFC Bank FD"))}`,
);

/* ---------------------------------------------------------------- */
/* Test 8: long-dash sanitizer. Hard repo rule: no long dash in      */
/* committed content; ordinary hyphen-minus must survive.            */
/* ---------------------------------------------------------------- */

const dashy =
  "No Review verdicts attach — nothing escalated; stated–revealed gap is moderate−to‐none.";
const cleaned = stripLongDashes(dashy);
assert(
  !/[‒–—―−]/.test(cleaned),
  "sanitizer:strips-long-dashes",
  `long dash survived sanitization: ${JSON.stringify(cleaned)}`,
);
assert(
  stripLongDashes("moderate-aggressive positive-with-caution").includes(
    "moderate-aggressive",
  ),
  "sanitizer:preserves-hyphen",
  `ordinary hyphen-minus must be preserved, got ${JSON.stringify(stripLongDashes("moderate-aggressive positive-with-caution"))}`,
);

/* ---------------------------------------------------------------- */

if (failures.length === 0) {
  console.log("PASS: A2 Layer 1 verification (8 tests, all assertions green)");
  process.exit(0);
} else {
  console.error(`FAIL: ${failures.length} assertion(s) failed:`);
  for (const f of failures) console.error(`  - [${f.name}] ${f.detail}`);
  process.exit(1);
}
