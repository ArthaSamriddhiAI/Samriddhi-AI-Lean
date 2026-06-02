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
 * Under the ADR 0005 boundary convention exactly 10% would be a watch
 * driver, which still differs from the table's no-driver, so this fixture
 * uses Motilal 9.8% (below 10%, no driver) to reproduce the table's
 * intended set. The underlying skill self-inconsistency is tracked as
 * PRODUCT_DEBT_LOG P10 for the next skill revision.
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
      stockExposureLookThrough: [],
      sectorExposureLookThrough: [],
      lookThroughCoverage: {
        stock: { coveredWeightPct: 0, uncoveredWeightPct: 0, footnote: null },
        sector: { coveredWeightPct: 0, uncoveredWeightPct: 0, footnote: null },
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

const D = String.fromCharCode(0x2012, 0x2013, 0x2014, 0x2015, 0x2212);
const dashy =
  "No Review verdicts attach " + D[2] + " nothing escalated; stated" +
  D[1] + "revealed gap is moderate" + D[4] + "to none.";
const cleaned = stripLongDashes(dashy);
assert(
  !new RegExp(`[${D}]`).test(cleaned),
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
/* Test 9: ADR 0005 position boundary convention.                    */
/*   > 10 flag (Discuss); == 10 watch (Monitor); == 15 flag           */
/*   (one tier below escalate); > 15 escalate (Review).               */
/* ---------------------------------------------------------------- */

const posBoundaryInput: A2ClassifyInput = {
  caseId: "verify-pos-boundary",
  asOfDate: "2026-04-02",
  holdings: {
    totalLiquidAumCr: 100,
    holdings: [
      { instrument: "Pos At 10", assetClass: "Equity" as AssetClass, subCategory: "listed_large_cap" as SubCategory, valueCr: 10, weightPct: 10.0 },
      { instrument: "Pos Above 10", assetClass: "Equity" as AssetClass, subCategory: "listed_large_cap" as SubCategory, valueCr: 11, weightPct: 10.5 },
      { instrument: "Pos At 15", assetClass: "Equity" as AssetClass, subCategory: "listed_large_cap" as SubCategory, valueCr: 15, weightPct: 15.0 },
      { instrument: "Pos Above 15", assetClass: "Equity" as AssetClass, subCategory: "listed_large_cap" as SubCategory, valueCr: 16, weightPct: 15.5 },
    ],
  },
  metrics: makeMetrics({
    positionFlags: [
      { instrument: "Pos At 10", weightPct: 10.0, severity: "flag" },
      { instrument: "Pos Above 10", weightPct: 10.5, severity: "flag" },
      { instrument: "Pos At 15", weightPct: 15.0, severity: "escalate" },
      { instrument: "Pos Above 15", weightPct: 15.5, severity: "escalate" },
    ],
  }),
  evidence: EMPTY_EVIDENCE,
};
const rPos = classifyHoldings(posBoundaryInput);
function posSev(ref: string): string {
  const h = rPos.holding_verdicts.find((x) => x.holding_ref === ref);
  const d = h?.drivers.find((x) => x.driver_type === "position_concentration");
  return d ? d.severity : "<none>";
}
assert(
  posSev("Pos At 10") === "watch" && verdictOf(rPos, "Pos At 10") === "monitor",
  "pos-boundary:eq10-watch",
  `exactly 10% must be watch/Monitor, got ${posSev("Pos At 10")} / ${verdictOf(rPos, "Pos At 10")}`,
);
assert(
  posSev("Pos Above 10") === "flag" && verdictOf(rPos, "Pos Above 10") === "discuss",
  "pos-boundary:gt10-flag",
  `above 10% must be flag/Discuss, got ${posSev("Pos Above 10")} / ${verdictOf(rPos, "Pos Above 10")}`,
);
assert(
  posSev("Pos At 15") === "flag" && verdictOf(rPos, "Pos At 15") === "discuss",
  "pos-boundary:eq15-flag",
  `exactly 15% must be flag/Discuss (one tier below escalate), got ${posSev("Pos At 15")} / ${verdictOf(rPos, "Pos At 15")}`,
);
assert(
  posSev("Pos Above 15") === "escalate" && verdictOf(rPos, "Pos Above 15") === "review",
  "pos-boundary:gt15-escalate",
  `above 15% must be escalate/Review, got ${posSev("Pos Above 15")} / ${verdictOf(rPos, "Pos Above 15")}`,
);

/* ---------------------------------------------------------------- */
/* Test 10: ADR 0005 sector boundary convention.                     */
/*   > 25 flag; == 25 watch; == 35 flag; > 35 escalate.              */
/* ---------------------------------------------------------------- */

const secBoundaryInput: A2ClassifyInput = {
  caseId: "verify-sec-boundary",
  asOfDate: "2026-04-02",
  holdings: {
    totalLiquidAumCr: 100,
    holdings: [
      { instrument: "Fund Sec 25", assetClass: "Equity" as AssetClass, subCategory: "mf_active_large_cap" as SubCategory, valueCr: 5, weightPct: 5 },
      { instrument: "Fund Sec 25p", assetClass: "Equity" as AssetClass, subCategory: "mf_active_large_cap" as SubCategory, valueCr: 5, weightPct: 5 },
      { instrument: "Fund Sec 35", assetClass: "Equity" as AssetClass, subCategory: "mf_active_large_cap" as SubCategory, valueCr: 5, weightPct: 5 },
      { instrument: "Fund Sec 35p", assetClass: "Equity" as AssetClass, subCategory: "mf_active_large_cap" as SubCategory, valueCr: 5, weightPct: 5 },
    ],
  },
  metrics: makeMetrics({
    sector: [
      { sector: "Banking", weightPct: 25.0, coveredFunds: ["Fund Sec 25"] },
      { sector: "IT", weightPct: 25.5, coveredFunds: ["Fund Sec 25p"] },
      { sector: "Pharma", weightPct: 35.0, coveredFunds: ["Fund Sec 35"] },
      { sector: "Auto", weightPct: 35.5, coveredFunds: ["Fund Sec 35p"] },
    ],
  }),
  evidence: EMPTY_EVIDENCE,
};
const rSec = classifyHoldings(secBoundaryInput);
function secSev(ref: string): string {
  const h = rSec.holding_verdicts.find((x) => x.holding_ref === ref);
  const d = h?.drivers.find((x) => x.driver_type === "sector_concentration");
  return d ? d.severity : "<none>";
}
assert(
  secSev("Fund Sec 25") === "watch" && verdictOf(rSec, "Fund Sec 25") === "monitor",
  "sec-boundary:eq25-watch",
  `sector exactly 25% must be watch/Monitor, got ${secSev("Fund Sec 25")} / ${verdictOf(rSec, "Fund Sec 25")}`,
);
assert(
  secSev("Fund Sec 25p") === "flag" && verdictOf(rSec, "Fund Sec 25p") === "discuss",
  "sec-boundary:gt25-flag",
  `sector above 25% must be flag/Discuss, got ${secSev("Fund Sec 25p")} / ${verdictOf(rSec, "Fund Sec 25p")}`,
);
assert(
  secSev("Fund Sec 35") === "flag" && verdictOf(rSec, "Fund Sec 35") === "discuss",
  "sec-boundary:eq35-flag",
  `sector exactly 35% must be flag/Discuss (one tier below escalate), got ${secSev("Fund Sec 35")} / ${verdictOf(rSec, "Fund Sec 35")}`,
);
assert(
  secSev("Fund Sec 35p") === "escalate" && verdictOf(rSec, "Fund Sec 35p") === "review",
  "sec-boundary:gt35-escalate",
  `sector above 35% must be escalate/Review, got ${secSev("Fund Sec 35p")} / ${verdictOf(rSec, "Fund Sec 35p")}`,
);

/* ---------------------------------------------------------------- */
/* Test 11: ADR 0006 cash carve-out. A Cash holding above the 15%    */
/* escalate line must NOT receive a position_concentration driver;    */
/* cash concentration is the non-propagating cash-drag observation.   */
/* ---------------------------------------------------------------- */

const cashInput: A2ClassifyInput = {
  caseId: "verify-cash-carveout",
  asOfDate: "2026-04-02",
  holdings: {
    totalLiquidAumCr: 60.65,
    holdings: [
      { instrument: "Bank savings account", assetClass: "Cash" as AssetClass, subCategory: "savings" as SubCategory, valueCr: 52.5, weightPct: 86.6 },
      { instrument: "Some Equity", assetClass: "Equity" as AssetClass, subCategory: "listed_large_cap" as SubCategory, valueCr: 8, weightPct: 13.4 },
    ],
  },
  // M0 flags any instrument over 15% regardless of asset class.
  metrics: makeMetrics({
    positionFlags: [
      { instrument: "Bank savings account", weightPct: 86.6, severity: "escalate" },
      { instrument: "Some Equity", weightPct: 13.4, severity: "flag" },
    ],
  }),
  evidence: EMPTY_EVIDENCE,
};
const rCash = classifyHoldings(cashInput);
assert(
  verdictOf(rCash, "Bank savings account") === "maintain" &&
    driverTypes(rCash, "Bank savings account").length === 0,
  "cash-carveout:savings-maintain",
  `cash at 86.6% must not get a position driver (ADR 0006), got ${verdictOf(rCash, "Bank savings account")} / ${JSON.stringify(driverTypes(rCash, "Bank savings account"))}`,
);
assert(
  verdictOf(rCash, "Some Equity") === "discuss" &&
    driverTypes(rCash, "Some Equity")[0] === "position_concentration",
  "cash-carveout:non-cash-unaffected",
  `non-cash holding above 10% must still flag, got ${verdictOf(rCash, "Some Equity")} / ${JSON.stringify(driverTypes(rCash, "Some Equity"))}`,
);

/* ---------------------------------------------------------------- */

if (failures.length === 0) {
  console.log("PASS: A2 Layer 1 verification (11 tests, all assertions green)");
  process.exit(0);
} else {
  console.error(`FAIL: ${failures.length} assertion(s) failed:`);
  for (const f of failures) console.error(`  - [${f.name}] ${f.detail}`);
  process.exit(1);
}
