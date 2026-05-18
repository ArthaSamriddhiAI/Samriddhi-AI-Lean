/* A2.classification, the per-holding meeting-behaviour classifier.
 *
 * Skill: agents/a2_classification.md
 *
 * A2 has the same two-layer shape as M0.PortfolioRiskAnalytics:
 *
 *   Layer 1 (classifyHoldings): pure, deterministic. Same evidence in
 *   produces the same verdict out. No LLM, no Date.now, no randomness.
 *   This is the audit surface and the load-bearing decision.
 *
 *   Layer 2 (runA2ReasonText): one Claude call per case (all drivers
 *   batched) that writes the one-sentence advisor-facing reason for each
 *   driver and the rollup characterisation. Layer 2 cannot change a
 *   verdict: it returns reason strings only; verdict and driver structure
 *   are owned by Layer 1 and assembled here in TypeScript.
 *
 * A2 runs only on Samriddhi 2 (diagnostic) cases, wired into
 * runDiagnosticPipeline after S1 synthesis. It consumes already-produced
 * outputs from the case bundle (M0 metrics, E1/E4/E6/E7 verdicts); it does
 * not invoke evidence agents.
 *
 * Threshold constants are imported from portfolio-risk-analytics.ts so the
 * foundation §3 numbers have a single source of truth. A2 does not invent
 * thresholds (skill Discipline).
 */

import { callAgent, type AgentCallResult, type AgentUsage } from "./harness";
import type { EvidenceBundle } from "./stitcher";
import type { PortfolioMetrics } from "./portfolio-risk-analytics";
import {
  POSITION_FLAG_PCT,
  POSITION_ESCALATE_PCT,
  SECTOR_FLAG_PCT,
  SECTOR_ESCALATE_PCT,
  WRAPPER_SHARE_FLAG_PCT,
  BUCKET_BY_SUBCATEGORY,
} from "./portfolio-risk-analytics";
import type { StructuredHoldings, Holding } from "@/db/fixtures/structured-holdings";

/* ----- Output contract (skill Output Schema, as TypeScript types) ----- */

export type A2Verdict =
  | "maintain"
  | "monitor"
  | "discuss"
  | "review"
  | "unable_to_classify";

export type A2DriverSeverity = "watch" | "flag" | "escalate";
export type A2DriverScope = "holding" | "portfolio_propagated";

export type A2DriverType =
  | "position_concentration"
  | "sector_concentration"
  | "wrapper_over_accumulation"
  | "allocation_drift"
  | "liquidity"
  | "fee_inefficiency"
  | "complexity_premium"
  | "thesis"
  | "behavioural"
  | "regulatory"
  | "evidence_unavailable";

export type A2Driver = {
  driver_type: A2DriverType;
  severity: A2DriverSeverity;
  scope: A2DriverScope;
  source_observation: string;
  reason: string;
};

export type A2HoldingVerdict = {
  holding_ref: string;
  instrument_display_name: string;
  asset_class: string;
  sub_category: string;
  weight_pct: number;
  verdict: A2Verdict;
  drivers: A2Driver[];
};

export type A2Summary = {
  maintain_count: number;
  monitor_count: number;
  discuss_count: number;
  review_count: number;
  unable_to_classify_count: number;
  one_line_characterization: string;
};

export type A2Output = {
  agent_id: "a2_classification";
  case_id: string;
  as_of_date: string;
  holding_verdicts: A2HoldingVerdict[];
  summary: A2Summary;
  reasoning_summary: string;
};

/* ----- Layer 1 internal shapes -----
 *
 * The computed driver carries `facts` (the structured numbers Layer 2
 * cites). `facts` is stripped before the persisted A2Output so the on-disk
 * driver matches the skill schema exactly (five fields). */

type A2DriverComputed = {
  driver_type: A2DriverType;
  severity: A2DriverSeverity;
  scope: A2DriverScope;
  source_observation: string;
  facts: Record<string, unknown>;
};

type A2HoldingComputed = {
  holding_ref: string;
  instrument_display_name: string;
  asset_class: string;
  sub_category: string;
  weight_pct: number;
  verdict: A2Verdict;
  drivers: A2DriverComputed[];
};

export type A2Layer1Result = {
  case_id: string;
  as_of_date: string;
  holding_verdicts: A2HoldingComputed[];
  summary: Omit<A2Summary, "one_line_characterization">;
};

export type A2ClassifyInput = {
  caseId: string;
  asOfDate: string;
  holdings: StructuredHoldings;
  metrics: PortfolioMetrics | null;
  evidence: EvidenceBundle;
};

/* ----- Severity / verdict algebra ----- */

const SEVERITY_RANK: Record<A2DriverSeverity, number> = {
  watch: 1,
  flag: 2,
  escalate: 3,
};

function verdictFromDrivers(drivers: A2DriverComputed[]): A2Verdict {
  if (drivers.some((d) => d.driver_type === "evidence_unavailable")) {
    return "unable_to_classify";
  }
  if (drivers.length === 0) return "maintain";
  const max = drivers.reduce((m, d) => Math.max(m, SEVERITY_RANK[d.severity]), 0);
  if (max >= SEVERITY_RANK.escalate) return "review";
  if (max >= SEVERITY_RANK.flag) return "discuss";
  return "monitor";
}

/* Most-severe-first. On equal severity, propagated portfolio drivers sort
 * ahead of holding drivers so the wrapper/sector observation reads first
 * in the verdict column (matches the skill's Worked Example ordering). */
const TYPE_TIE_PRIORITY: A2DriverType[] = [
  "wrapper_over_accumulation",
  "sector_concentration",
  "position_concentration",
  "complexity_premium",
  "thesis",
  "fee_inefficiency",
  "liquidity",
  "regulatory",
  "behavioural",
  "evidence_unavailable",
];

function sortDrivers(drivers: A2DriverComputed[]): A2DriverComputed[] {
  return [...drivers].sort((a, b) => {
    const s = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (s !== 0) return s;
    return (
      TYPE_TIE_PRIORITY.indexOf(a.driver_type) -
      TYPE_TIE_PRIORITY.indexOf(b.driver_type)
    );
  });
}

/* ----- Holding-type and instrument matching ----- */

function isPMS(sub: string): boolean {
  return sub.startsWith("pms_");
}
function isAIF(sub: string): boolean {
  return sub.startsWith("aif_");
}
function isMF(sub: string): boolean {
  return sub.startsWith("mf_");
}
function isListed(sub: string): boolean {
  return sub.startsWith("listed_") || sub.startsWith("intl_");
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* Position flags, E6, and E7 rows are keyed off the same holdings list,
 * so exact (case- and spacing-insensitive) instrument equality is the
 * correct join. A bare substring test cross-matches distinct instruments
 * that share a name stem: "HDFC Bank FD" (a debt row) would inherit the
 * listed "HDFC Bank" position flag. Exact equality removes that class. */
function instrumentExact(a: string, b: string): boolean {
  const x = normalise(a);
  const y = normalise(b);
  return x.length > 0 && x === y;
}

/* E1 keys by stock symbol, which can be a ticker or a short form of the
 * holding name, so exact equality is too strict. A prefix match in either
 * direction handles "Reliance" vs "Reliance Industries" while still
 * rejecting the mid-string collisions a bare substring test allows. E1
 * runs only for listed holdings, so a debt row such as an FD never
 * reaches this path. If no confident match exists, A2 attaches no thesis
 * driver rather than mis-attributing one. */
function instrumentMatchE1(symbol: string, instrument: string): boolean {
  const x = normalise(symbol);
  const y = normalise(instrument);
  if (!x || !y) return false;
  return x === y || x.startsWith(y) || y.startsWith(x);
}

/* ----- Threshold-boundary convention (ADR 0005) -----
 *
 * Checkpoint 2 taste call 1: strictly greater than a threshold triggers
 * that severity; exactly at the threshold is one tier lower (the flag
 * boundary becomes watch, the escalate boundary becomes flag); below the
 * threshold is no driver. A2 interprets M0's foundation thresholds this
 * way. M0's own positionFlags uses `>=`, so A2 and M0 diverge by one
 * severity tier exactly at a boundary. This divergence is intentional and
 * recorded in docs/decisions/0005_a2_threshold_boundary_convention.md. */

function positionSeverity(weightPct: number): A2DriverSeverity | null {
  if (weightPct > POSITION_ESCALATE_PCT) return "escalate";
  if (weightPct > POSITION_FLAG_PCT) return "flag";
  if (weightPct === POSITION_FLAG_PCT) return "watch";
  return null;
}

function sectorSeverity(weightPct: number): A2DriverSeverity | null {
  if (weightPct > SECTOR_ESCALATE_PCT) return "escalate";
  if (weightPct > SECTOR_FLAG_PCT) return "flag";
  if (weightPct === SECTOR_FLAG_PCT) return "watch";
  return null;
}

/* "4+ PMS strategies" is a literal count (four or more is the trigger by
 * definition, not a boundary ambiguity), so it stays a count test and
 * yields flag. "Any wrapper above 25%" follows the ADR 0005 convention. */
function wrapperPmsSeverity(
  w: PortfolioMetrics["concentration"]["wrappers"],
): A2DriverSeverity | null {
  if (w.wrapperCountFlag) return "flag";
  if (w.pmsAggregatePct > WRAPPER_SHARE_FLAG_PCT) return "flag";
  if (w.pmsAggregatePct === WRAPPER_SHARE_FLAG_PCT) return "watch";
  return null;
}

function wrapperAifSeverity(
  w: PortfolioMetrics["concentration"]["wrappers"],
): A2DriverSeverity | null {
  if (w.aifAggregatePct > WRAPPER_SHARE_FLAG_PCT) return "flag";
  if (w.aifAggregatePct === WRAPPER_SHARE_FLAG_PCT) return "watch";
  return null;
}

/* ----- Layer 1: deterministic verdict assignment ----- */

export function classifyHoldings(input: A2ClassifyInput): A2Layer1Result {
  const { holdings, metrics, evidence } = input;

  const summary = {
    maintain_count: 0,
    monitor_count: 0,
    discuss_count: 0,
    review_count: 0,
    unable_to_classify_count: 0,
  };

  /* Edge case 2: M0.PortfolioRiskAnalytics output genuinely missing. A2
   * cannot classify any holding without the metric foundation. Rare; the
   * pipeline runs A2 after metrics so this is a defensive path. */
  if (!metrics) {
    const holding_verdicts: A2HoldingComputed[] = holdings.holdings.map((h) => ({
      holding_ref: h.instrument,
      instrument_display_name: h.instrument,
      asset_class: h.assetClass,
      sub_category: h.subCategory,
      weight_pct: h.weightPct,
      verdict: "unable_to_classify" as A2Verdict,
      drivers: [
        {
          driver_type: "evidence_unavailable" as A2DriverType,
          severity: "flag" as A2DriverSeverity,
          scope: "holding" as A2DriverScope,
          source_observation:
            "evidence_unavailable: M0.PortfolioRiskAnalytics metrics absent",
          facts: { missing: "metrics" },
        },
      ],
    }));
    summary.unable_to_classify_count = holding_verdicts.length;
    return {
      case_id: input.caseId,
      as_of_date: input.asOfDate,
      holding_verdicts,
      summary,
    };
  }

  const e4 = evidence.e4;
  const e4Material =
    !!e4 && e4.stated_vs_revealed_divergence?.magnitude === "material";

  /* Sector over-concentration: foundation §3, flag 25%, escalate 35%,
   * applied with the ADR 0005 boundary convention. Propagates to every
   * holding the MF look-through attributes to that sector. Built once,
   * applied per holding below. */
  const sectorDriversByInstrument = new Map<string, A2DriverComputed[]>();
  for (const s of metrics.concentration.sectorExposureMfLookThrough) {
    const severity = sectorSeverity(s.weightPct);
    if (!severity) continue;
    for (const inst of s.coveredFunds) {
      const list = sectorDriversByInstrument.get(inst) ?? [];
      list.push({
        driver_type: "sector_concentration",
        severity,
        scope: "portfolio_propagated",
        source_observation: "sector_over_concentration",
        facts: {
          sector: s.sector,
          sector_weight_pct: s.weightPct,
          threshold:
            "above 25% flags, above 35% escalates; exactly at a threshold is one tier lower (ADR 0005)",
        },
      });
      sectorDriversByInstrument.set(inst, list);
    }
  }

  /* Wrapper over-accumulation: foundation §3, 4+ PMS strategies or any
   * wrapper aggregate above 25%. Per the skill propagation table every
   * holding in the triggered wrapper set gets the same driver; severity
   * follows the ADR 0005 boundary convention on the 25% share rule. */
  const w = metrics.concentration.wrappers;
  const pmsWrapperSeverity = wrapperPmsSeverity(w);
  const aifWrapperSeverity = wrapperAifSeverity(w);

  const holding_verdicts: A2HoldingComputed[] = [];

  for (const h of holdings.holdings) {
    const drivers: A2DriverComputed[] = [];

    // Position weight vs foundation §3 (flag 10%, escalate 15%). The
    // instrument set is anchored to M0's positionFlags (single source of
    // truth for which holdings clear 10%); the severity is re-derived
    // here under the ADR 0005 boundary convention rather than inherited
    // from M0's `>=` severity.
    //
    // ADR 0006: holdings whose asset class is Cash are excluded from
    // position_concentration. Cash concentration is the cash-drag
    // observation, which the skill propagation table marks as
    // deployment-level and explicitly non-propagating to individual
    // holdings; firing position_concentration on a cash line would
    // contradict the rest of the diagnostic. Exclusion is by asset class
    // so future cash-equivalent additions inherit the carve-out.
    if (h.assetClass !== "Cash") {
      const pf = metrics.concentration.positionFlags.find((p) =>
        instrumentExact(p.instrument, h.instrument),
      );
      if (pf) {
        const severity = positionSeverity(pf.weightPct);
        if (severity) {
          drivers.push({
            driver_type: "position_concentration",
            severity,
            scope: "holding",
            source_observation: "position_over_concentration",
            facts: {
              weight_pct: pf.weightPct,
              threshold:
                "above 10% flags, above 15% escalates; exactly at a threshold is one tier lower (ADR 0005)",
            },
          });
        }
      }
    }

    // Thesis intactness and complexity premium, per the relevant evidence
    // agent for the holding's wrapper type. cannot_evaluate is opacity
    // (skill edge case 1, normal), not a thesis concern: no driver.
    if (isPMS(h.subCategory) || isAIF(h.subCategory)) {
      const p = evidence.e6?.per_product_evaluations.find((x) =>
        instrumentExact(x.instrument, h.instrument),
      );
      if (p) {
        if (p.complexity_premium_earned === "no") {
          drivers.push({
            driver_type: "complexity_premium",
            severity: "flag",
            scope: "holding",
            source_observation: "complexity_premium_not_earned",
            facts: {
              performance_vs_benchmark: p.performance_vs_benchmark,
              fee_structure_assessment: p.fee_structure_assessment,
            },
          });
        } else if (p.complexity_premium_earned === "mixed") {
          drivers.push({
            driver_type: "complexity_premium",
            severity: "watch",
            scope: "holding",
            source_observation: "complexity_premium_not_earned",
            facts: {
              performance_vs_benchmark: p.performance_vs_benchmark,
              fee_structure_assessment: p.fee_structure_assessment,
            },
          });
        }
        const t = thesisFromVerdict(p.overall_verdict);
        if (t) {
          drivers.push({
            driver_type: "thesis",
            severity: t,
            scope: "holding",
            source_observation: `e6_overall_verdict_${p.overall_verdict}`,
            facts: {
              overall_verdict: p.overall_verdict,
              key_risks: p.key_risks,
            },
          });
        }
      }
    } else if (isMF(h.subCategory)) {
      const p = evidence.e7?.per_scheme_verdicts.find((x) =>
        instrumentExact(x.instrument, h.instrument),
      );
      if (p) {
        const t = thesisFromVerdict(p.overall_verdict);
        if (t) {
          drivers.push({
            driver_type: "thesis",
            severity: t,
            scope: "holding",
            source_observation: `e7_overall_verdict_${p.overall_verdict}`,
            facts: {
              overall_verdict: p.overall_verdict,
              key_risks: p.key_risks,
            },
          });
        }
      }
    } else if (isListed(h.subCategory)) {
      const p = evidence.e1?.per_stock_verdicts.find((x) =>
        instrumentMatchE1(x.symbol, h.instrument),
      );
      if (p) {
        const t = thesisFromE1Verdict(p.overall_verdict);
        if (t) {
          drivers.push({
            driver_type: "thesis",
            severity: t,
            scope: "holding",
            source_observation: `e1_overall_verdict_${p.overall_verdict}`,
            facts: {
              overall_verdict: p.overall_verdict,
              key_risks: p.key_risks,
            },
          });
        }
      }
    }

    // Liquidity: only when the portfolio breaches its tier floor. The
    // illiquid holdings (Locked / T+365) are the material contributors;
    // flag (Discuss), not escalate (we do not deterministically single
    // out the one holding whose lockup causes the breach).
    if (metrics.liquidity.floorBreach) {
      const bucket = BUCKET_BY_SUBCATEGORY[h.subCategory];
      if (bucket === "Locked" || bucket === "T_365") {
        drivers.push({
          driver_type: "liquidity",
          severity: "flag",
          scope: "holding",
          source_observation: "liquidity_gap",
          facts: {
            bucket,
            t30_plus_t90_pct: metrics.liquidity.t30PlusT90Pct,
            tier: metrics.liquidity.tier,
            tier_floor: metrics.liquidity.tierFloor,
          },
        });
      }
    }

    // Sector propagation (built above).
    for (const sd of sectorDriversByInstrument.get(h.instrument) ?? []) {
      drivers.push(sd);
    }

    // Wrapper propagation.
    if (pmsWrapperSeverity && isPMS(h.subCategory)) {
      drivers.push({
        driver_type: "wrapper_over_accumulation",
        severity: pmsWrapperSeverity,
        scope: "portfolio_propagated",
        source_observation: "wrapper_over_accumulation",
        facts: {
          pms_count: w.pmsCount,
          pms_aggregate_pct: w.pmsAggregatePct,
          threshold:
            "4+ PMS strategies, or any wrapper above 25% of liquid AUM (boundary-exact one tier lower, ADR 0005)",
        },
      });
    }
    if (aifWrapperSeverity && isAIF(h.subCategory)) {
      drivers.push({
        driver_type: "wrapper_over_accumulation",
        severity: aifWrapperSeverity,
        scope: "portfolio_propagated",
        source_observation: "wrapper_over_accumulation",
        facts: {
          aif_count: w.aifCount,
          aif_aggregate_pct: w.aifAggregatePct,
          threshold: "4+ PMS strategies, or any wrapper > 25% of liquid AUM",
        },
      });
    }

    /* Behavioural (E4) corroborator, watch-capped (Checkpoint 1 decision).
     * E4 stated-revealed divergence is investor-level, not keyed to
     * holdings. It does not independently propagate (consistent with the
     * skill rule that only wrapper/sector propagate). It attaches at watch
     * severity only on a holding that already carries a holding-scope
     * driver, so it annotates the conversation without ever lifting a
     * healthy holding's tier. */
    if (e4Material && drivers.some((d) => d.scope === "holding")) {
      drivers.push({
        driver_type: "behavioural",
        severity: "watch",
        scope: "portfolio_propagated",
        source_observation: "stated_revealed_divergence",
        facts: {
          direction: e4!.stated_vs_revealed_divergence.direction,
          magnitude: e4!.stated_vs_revealed_divergence.magnitude,
          implication: e4!.stated_vs_revealed_divergence.implication,
        },
      });
    }

    const sorted = sortDrivers(drivers);
    const verdict = verdictFromDrivers(sorted);
    summary[`${verdict}_count` as keyof typeof summary] += 1;

    holding_verdicts.push({
      holding_ref: h.instrument,
      instrument_display_name: h.instrument,
      asset_class: h.assetClass,
      sub_category: h.subCategory,
      weight_pct: h.weightPct,
      verdict,
      drivers: sorted,
    });
  }

  return {
    case_id: input.caseId,
    as_of_date: input.asOfDate,
    holding_verdicts,
    summary,
  };
}

/* E6/E7 overall_verdict to thesis-driver severity. positive and
 * cannot_evaluate produce no driver: the first is intact, the second is
 * opacity (skill edge case 1), neither is a thesis concern. */
function thesisFromVerdict(
  v: "positive" | "positive_with_caution" | "hold" | "negative" | "cannot_evaluate",
): A2DriverSeverity | null {
  switch (v) {
    case "negative":
      return "escalate";
    case "hold":
      return "flag";
    case "positive_with_caution":
      return "watch";
    default:
      return null;
  }
}

function thesisFromE1Verdict(
  v:
    | "positive"
    | "positive_with_caution"
    | "neutral"
    | "hold_with_attention"
    | "negative"
    | "cannot_evaluate",
): A2DriverSeverity | null {
  switch (v) {
    case "negative":
      return "escalate";
    case "hold_with_attention":
      return "flag";
    case "positive_with_caution":
    case "neutral":
      return "watch";
    default:
      return null;
  }
}

/* Repo hard rule: no em, en, or any long dash in committed content. The
 * Layer 2 prompt forbids them, but the model is not trusted to comply;
 * this deterministic pass is the guarantee before anything is persisted.
 * Ordinary hyphen-minus (U+002D) is preserved: "moderate-aggressive" and
 * "positive-with-caution" must survive. A long dash is replaced with a
 * comma separator, then doubled or stranded punctuation is tidied.
 *
 * The dash set is declared via \u escapes (a normal string literal) so
 * this source file contains no literal long-dash glyph: U+2012 figure
 * dash, U+2013 en dash, U+2014 em dash, U+2015 horizontal bar, U+2212
 * minus sign. */
const LONG_DASH_CHARS = String.fromCharCode(0x2012, 0x2013, 0x2014, 0x2015, 0x2212);
const LONG_DASH_RE = new RegExp(`\\s*[${LONG_DASH_CHARS}]\\s*`, "g");

export function stripLongDashes(s: string): string {
  return s
    .replace(LONG_DASH_RE, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* ----- Layer 2: LLM-glossed reason text ----- */

type A2ReasonRow = { holding_ref: string; driver_index: number; reason: string };
type A2ReasonPayload = {
  reasons: A2ReasonRow[];
  one_line_characterization: string;
  reasoning_summary: string;
};

function buildReasonPrompt(
  layer1: A2Layer1Result,
  summary: Omit<A2Summary, "one_line_characterization">,
): string {
  // Only holdings that carry drivers need per-driver reason text.
  const withDrivers = layer1.holding_verdicts
    .filter((h) => h.drivers.length > 0)
    .map((h) => ({
      holding_ref: h.holding_ref,
      instrument: h.instrument_display_name,
      asset_class: h.asset_class,
      sub_category: h.sub_category,
      weight_pct: h.weight_pct,
      verdict: h.verdict,
      drivers: h.drivers.map((d, i) => ({
        driver_index: i,
        driver_type: d.driver_type,
        severity: d.severity,
        scope: d.scope,
        source_observation: d.source_observation,
        facts: d.facts,
      })),
    }));

  return [
    `# A2 Reason Text Request`,
    ``,
    `Case ${layer1.case_id}, as of ${layer1.as_of_date}.`,
    ``,
    `Layer 1 has already assigned every verdict deterministically. Your job`,
    `is Layer 2 only: write the one-sentence advisor-facing reason for each`,
    `driver, plus the rollup characterisation. You must NOT change any`,
    `verdict; the verdict and the driver list are fixed.`,
    ``,
    `## Verdict counts (fixed, for the characterisation)`,
    ``,
    "```json",
    JSON.stringify(summary, null, 2),
    "```",
    ``,
    `## Holdings carrying drivers`,
    ``,
    `For every driver below, write a one-sentence reason. Cite the specific`,
    `numbers in \`facts\` and the threshold context, in the language of the`,
    `diagnostic vocabulary. No recommendation language: state why the`,
    `conversation is on the agenda, never what trade to make. Use only`,
    `commas, semicolons, colons, or periods as separators; never an em`,
    `dash, en dash, or any other long dash. Propagated`,
    `wrapper or sector drivers that repeat across holdings should read with`,
    `the same wrapper-level or sector-level framing each time (the`,
    `repetition is the intended signal).`,
    ``,
    "```json",
    JSON.stringify(withDrivers, null, 2),
    "```",
    ``,
    `## Output`,
    ``,
    `Return a single fenced JSON block with this exact shape:`,
    ``,
    "```json",
    `{`,
    `  "reasons": [`,
    `    { "holding_ref": "<verbatim from input>", "driver_index": <int>, "reason": "<one sentence, cites the numbers, no recommendation language>" }`,
    `  ],`,
    `  "one_line_characterization": "<e.g. '8 Maintain, 1 Monitor, 4 Discuss, 0 Review; wrapper-led'; describe the classification picture, do not recommend>",`,
    `  "reasoning_summary": "<2-4 sentences on what drives the classification picture for this portfolio; descriptive, advisor register, no recommendation>"`,
    `}`,
    "```",
    ``,
    `Provide exactly one reasons entry for every (holding_ref, driver_index)`,
    `pair present in the input, and no others. Respond with a single fenced`,
    `JSON block. No prose outside the fence.`,
  ].join("\n");
}

function validateReasonPayload(parsed: unknown): A2ReasonPayload {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("A2 Layer 2 output is not an object");
  }
  const o = parsed as Record<string, unknown>;
  if (!Array.isArray(o.reasons)) {
    throw new Error("A2 Layer 2 output.reasons must be an array");
  }
  for (const r of o.reasons as unknown[]) {
    const row = r as Record<string, unknown>;
    if (typeof row.holding_ref !== "string" || row.holding_ref.trim() === "") {
      throw new Error("A2 Layer 2 reason row missing holding_ref");
    }
    if (typeof row.driver_index !== "number") {
      throw new Error("A2 Layer 2 reason row missing numeric driver_index");
    }
    if (typeof row.reason !== "string" || row.reason.trim() === "") {
      throw new Error("A2 Layer 2 reason row missing reason text");
    }
  }
  if (
    typeof o.one_line_characterization !== "string" ||
    o.one_line_characterization.trim() === ""
  ) {
    throw new Error("A2 Layer 2 output missing one_line_characterization");
  }
  if (typeof o.reasoning_summary !== "string" || o.reasoning_summary.trim() === "") {
    throw new Error("A2 Layer 2 output missing reasoning_summary");
  }
  return o as unknown as A2ReasonPayload;
}

export async function runA2ReasonText(
  layer1: A2Layer1Result,
): Promise<AgentCallResult<A2ReasonPayload>> {
  return callAgent<A2ReasonPayload>({
    skillId: "a2_classification",
    userPrompt: buildReasonPrompt(layer1, layer1.summary),
    validate: validateReasonPayload,
  });
}

/* ----- Orchestration ----- */

export type A2DiagnosticResult = {
  output: A2Output;
  usage: AgentUsage;
};

export async function runA2Diagnostic(
  input: A2ClassifyInput,
): Promise<A2DiagnosticResult> {
  const layer1 = classifyHoldings(input);

  const reasonResult = await runA2ReasonText(layer1);
  const payload = reasonResult.output;

  /* Index Layer 2 reasons by (holding_ref, driver_index). Layer 2 cannot
   * change the verdict: we read only its reason strings and merge them
   * into the Layer 1 structure. Any driver whose reason is missing fails
   * validation upstream (the harness retries once); here we hard-require a
   * reason so no driver ships with empty text. */
  const reasonByKey = new Map<string, string>();
  for (const r of payload.reasons) {
    reasonByKey.set(`${r.holding_ref}::${r.driver_index}`, r.reason);
  }

  const holding_verdicts: A2HoldingVerdict[] = layer1.holding_verdicts.map(
    (h) => ({
      holding_ref: h.holding_ref,
      instrument_display_name: h.instrument_display_name,
      asset_class: h.asset_class,
      sub_category: h.sub_category,
      weight_pct: h.weight_pct,
      verdict: h.verdict,
      drivers: h.drivers.map((d, i) => {
        const reason = reasonByKey.get(`${h.holding_ref}::${i}`);
        if (!reason) {
          throw new Error(
            `A2 Layer 2 did not return a reason for ${h.holding_ref} driver ${i} ` +
              `(${d.driver_type}). Layer 1 verdicts are intact; rerun Layer 2.`,
          );
        }
        return {
          driver_type: d.driver_type,
          severity: d.severity,
          scope: d.scope,
          source_observation: d.source_observation,
          reason: stripLongDashes(reason),
        };
      }),
    }),
  );

  const output: A2Output = {
    agent_id: "a2_classification",
    case_id: layer1.case_id,
    as_of_date: layer1.as_of_date,
    holding_verdicts,
    summary: {
      ...layer1.summary,
      one_line_characterization: stripLongDashes(payload.one_line_characterization),
    },
    reasoning_summary: stripLongDashes(payload.reasoning_summary),
  };

  return { output, usage: reasonResult.usage };
}
