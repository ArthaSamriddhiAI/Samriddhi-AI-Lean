/* Concept C accordion: shared severity vocabulary and mapping helpers.
 *
 * The accordion primitive (components/case-detail/Accordion.tsx) speaks one
 * severity vocabulary. The persisted data speaks two others: S1 evidence
 * verdicts carry a CaseRiskLevel; S2 diagnostic observations carry the
 * diagnostic severity. These mappers are the single place those translate,
 * so the visual hierarchy stays consistent across all three surfaces.
 */

import type { CaseRiskLevel } from "@/lib/agents/case/case-verdict";
import type {
  HeadlineObservation,
  ConcentrationBreach,
  RiskFlag,
} from "@/lib/agents/s1-diagnostic";
import type { MaterialityOutput } from "@/lib/agents/materiality";
import type { IC1Deliberation } from "@/lib/agents/ic1/types";

/* Concept C severity tokens. esc opens by default; everything else stays
 * closed with its pill visible. muted reads quiet (no pill emphasis). */
export type Severity = "esc" | "flg" | "inf" | "ok" | "muted";

/* S1 Analyst Reports: CaseRiskLevel to Concept C severity.
 * Locked decision C: high to esc, elevated to flg, moderate to ok, low to
 * ok. moderate to ok (not flg) keeps the flag tier meaningful as "advisor
 * should look at this" rather than collapsing watch-items into concerns.
 * Non-activated agents are muted (handled by the caller, which has the
 * activation discriminant). */
export function riskLevelToSeverity(level: CaseRiskLevel): Severity {
  switch (level) {
    case "high":
      return "esc";
    case "elevated":
      return "flg";
    case "moderate":
      return "ok";
    case "low":
      return "ok";
  }
}

/* S2 diagnostic data severity to Concept C severity. The diagnostic types
 * already use "ok | info | flag | escalate"; this is a straight rename to
 * the accordion's shorter tokens. */
export function dataSeverityToSeverity(
  sev: "ok" | "info" | "flag" | "escalate",
): Severity {
  switch (sev) {
    case "escalate":
      return "esc";
    case "flag":
      return "flg";
    case "info":
      return "inf";
    case "ok":
      return "ok";
  }
}

/* The severity of an accordion row that wraps a list of observations is the
 * most severe observation in it (esc > flg > inf > ok). An empty list reads
 * muted. Used to derive S2 section-row severity and default-open. */
const SEVERITY_RANK: Record<Severity, number> = {
  esc: 4,
  flg: 3,
  inf: 2,
  ok: 1,
  muted: 0,
};

export function maxSeverity(severities: Severity[]): Severity {
  return severities.reduce<Severity>(
    (acc, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[acc] ? s : acc),
    "muted",
  );
}

/* The three S2 observation types each expose a different scannable field:
 * ConcentrationBreach has figure, RiskFlag has title, HeadlineObservation
 * has one_line (and gains short_form, which supersedes one_line once
 * present). One helper switches on the structural discriminant so the
 * renderer never scatters the type check, and a fourth type later is a
 * one-line edit here. */
type DiagnosticObservation = HeadlineObservation | ConcentrationBreach | RiskFlag;

export function getScannableField(obs: DiagnosticObservation): string {
  if ("figure" in obs) return obs.figure; // ConcentrationBreach
  if ("title" in obs) return obs.title; // RiskFlag
  const ho = obs as HeadlineObservation & { short_form?: string };
  return ho.short_form ?? ho.one_line; // HeadlineObservation
}

/* IC1 deliberation, one accordion row (locked decision A). These are pure
 * functions, kept server-safe here so both the server tab components and
 * the client IC1 bodies can share one source of truth. */
export function ic1AllSentinel(deliberation: IC1Deliberation): boolean {
  return (
    deliberation.fires &&
    deliberation.chair.status === "infrastructure_ready" &&
    deliberation.devils_advocate.status === "infrastructure_ready" &&
    deliberation.risk_assessor.status === "infrastructure_ready" &&
    deliberation.counterfactual_engine.status === "infrastructure_ready" &&
    deliberation.minutes_recorder.status === "infrastructure_ready"
  );
}

/* Not-fired and full-sentinel read muted (a quiet "checked, nothing to
 * surface"); a live committee deliberation reads flg (look at this), never
 * auto-esc, so S1 Outcome opens nothing by default. */
export function ic1Severity(
  materiality: MaterialityOutput,
  deliberation: IC1Deliberation,
): Severity {
  if (!materiality.fires || !deliberation.fires) return "muted";
  if (ic1AllSentinel(deliberation)) return "muted";
  return "flg";
}
