/* React PDF briefing renderer. Foundation §6 seven-section layout.
 *
 * Visual contract: the redesign in
 * docs/../11 - Slice-By-Slice Implementation/03 - Briefing Doc PDF Design/
 * (Briefing PDF Redesign HTML + its 4-page print export). Source Serif 4
 * for the document title, Geist for body / headings / table cells,
 * Geist Mono for all numerics and source pills. TTFs in lib/pdf/fonts/.
 *
 * Dynamic Page X of Y in the footer uses @react-pdf/renderer's render
 * prop on <Text fixed>; works on 4.5.1 (the 4.1 issue noted in
 * DEFERRED.md is resolved by the version bump).
 */

import * as path from "node:path";
import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Font,
  StyleSheet,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type {
  BriefingContent,
  ConcentrationBreach,
  EvidenceAppendixRow,
  HeadlineObservation,
  ModelComparisonRow,
  PortfolioOverviewRow,
  RiskFlag,
  SourceTag,
  TalkingPoint,
} from "@/lib/agents/s1-diagnostic";
import { transformRupeesDeep } from "@/lib/format/rupees";

const FONT_DIR = path.join(process.cwd(), "lib/pdf/fonts");

Font.register({
  family: "Source Serif 4",
  fonts: [
    { src: path.join(FONT_DIR, "SourceSerif4-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "SourceSerif4-Semibold.ttf"), fontWeight: 600 },
  ],
});

Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(FONT_DIR, "Geist-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Geist-Medium.ttf"), fontWeight: 500 },
    { src: path.join(FONT_DIR, "Geist-SemiBold.ttf"), fontWeight: 600 },
  ],
});

Font.register({
  family: "Geist Mono",
  fonts: [
    { src: path.join(FONT_DIR, "GeistMono-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "GeistMono-Medium.ttf"), fontWeight: 500 },
  ],
});

/* Design tokens, mirroring the redesign HTML's CSS variables. */
const PAPER = "#FFFFFF";
const PAPER_S = "#F4F3EE";
const INK_1 = "#14181F";
const INK_2 = "#3C4350";
const INK_3 = "#6B7280";
const INK_4 = "#9AA0A8";
const INK_5 = "#C7C8C3";
const RULE_S = "#D4D1C8";
const RULE_F = "#EDEBE4";
const ACCENT = "#1F3A5F";
const ACCENT_T = "#E8EDF3";
const ACCENT_R = "#C9D4E0";
const POS = "#1F6B3D";
const POS_T = "#E6EFE7";
const POS_R = "#C4D9C7";
const NEG = "#9B2A1F";
const WARN = "#8B6A1F";
const WARN_T = "#F3ECDB";
const WARN_R = "#DDD0B5";

const FS = "Source Serif 4";
const FG = "Geist";
const FM = "Geist Mono";

const styles = StyleSheet.create({
  /* No lineHeight on Page: a Page-level lineHeight cascades into every
   * <Text render>, where the render prop fires but the dynamic content
   * is never drawn (reproduced and confirmed in @react-pdf/renderer
   * 4.5.1). lineHeight is applied per-component below. */
  page: {
    backgroundColor: PAPER,
    paddingTop: "14mm",
    paddingBottom: "13mm",
    paddingHorizontal: "19mm",
    fontFamily: FG,
    fontSize: 9,
    color: INK_1,
  },
  /* Top header strip, fixed on every page. */
  pgHd: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 4.5,
    marginBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE_S,
    fontFamily: FM,
    fontSize: 7,
    color: INK_4,
    letterSpacing: 0.3,
  },
  pgHdL: { color: INK_3, textTransform: "uppercase" },
  pgHdR: { color: INK_4 },
  /* Bottom footer: two separate fixed Text elements with absolute
   * positioning. A <View fixed> wrapper around Text-render children
   * silently dropped the footer in @react-pdf/renderer 4.5.1; the
   * two-Text pattern is the documented working form for dynamic page
   * numbers. */
  pgFtRule: {
    position: "absolute",
    bottom: 32,
    left: 54,
    right: 54,
    height: 0.5,
    backgroundColor: RULE_S,
  },
  pgFtLeft: {
    position: "absolute",
    bottom: 18,
    left: 54,
    fontFamily: FM,
    fontSize: 7,
    color: INK_4,
    letterSpacing: 0.15,
  },
  pgFtRight: {
    position: "absolute",
    bottom: 18,
    right: 54,
    width: 380,
    fontFamily: FM,
    fontSize: 7,
    color: INK_4,
    letterSpacing: 0.15,
    textAlign: "right",
  },
  /* Document header, page 1 only. */
  docHd: {
    paddingBottom: 11,
    marginBottom: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE_S,
  },
  docEye: {
    fontFamily: FG,
    fontWeight: 500,
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: INK_3,
    marginBottom: 6,
  },
  docTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  docTitleLeft: { flexGrow: 1, flexShrink: 1, paddingRight: 20 },
  docTitle: {
    fontFamily: FS,
    fontSize: 24,
    fontWeight: 400,
    color: INK_1,
    lineHeight: 1.08,
    marginBottom: 4,
  },
  docSubRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    fontFamily: FM,
    fontSize: 8,
    color: INK_3,
  },
  docSubSep: { color: INK_5 },
  docSubVal: { color: INK_1 },
  docMeta: {
    fontFamily: FM,
    fontSize: 7.5,
    color: INK_3,
    textAlign: "right",
    flexShrink: 0,
  },
  docMetaLine: { marginBottom: 2, lineHeight: 1.6 },
  /* The "Page X of Y" line uses no lineHeight at all because the
   * render prop on <Text> is silently no-opped when any lineHeight is
   * in scope (Page-level cascade or self). */
  docMetaPageLine: { marginBottom: 2 },
  docMetaVal: { color: INK_1 },
  /* Diagnostic summary bar (KPI strip). */
  diagBar: {
    flexDirection: "row",
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: RULE_S,
    borderRadius: 2,
  },
  diagCell: {
    flexGrow: 1,
    flexBasis: 0,
    flexDirection: "column",
    padding: 7,
    backgroundColor: PAPER_S,
    borderRightWidth: 0.5,
    borderRightColor: RULE_S,
  },
  diagCellLast: { borderRightWidth: 0 },
  diagEye: {
    fontFamily: FM,
    fontWeight: 500,
    fontSize: 6.5,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    color: INK_4,
    marginBottom: 4,
  },
  diagVal: {
    fontFamily: FM,
    fontWeight: 500,
    fontSize: 11,
    color: INK_1,
    lineHeight: 1.1,
    marginBottom: 3,
  },
  diagSub: {
    fontFamily: FG,
    fontSize: 7,
    color: INK_3,
    lineHeight: 1.35,
  },
  /* Section structure. */
  section: { marginBottom: 13 },
  secHd: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE_S,
    marginBottom: 7,
  },
  secN: {
    fontFamily: FM,
    fontSize: 7.5,
    color: INK_4,
    marginRight: 7,
  },
  secT: {
    fontFamily: FS,
    fontSize: 11,
    fontWeight: 500,
    color: INK_1,
  },
  secSub: {
    fontFamily: FG,
    fontSize: 7.5,
    color: INK_3,
    marginLeft: "auto",
  },
  /* Headline observation bullets (rendered as compact paragraphs). */
  obsItem: {
    flexDirection: "row",
    marginBottom: 8,
    paddingLeft: 1,
  },
  obsDash: {
    width: 8,
    fontSize: 9,
    color: INK_4,
    marginTop: 1,
  },
  obsBody: {
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 9,
    color: INK_1,
    lineHeight: 1.55,
  },
  obsVocab: {
    fontFamily: FG,
    fontWeight: 500,
  },
  /* Source pills. */
  pill: {
    fontFamily: FM,
    fontWeight: 500,
    fontSize: 6.5,
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginLeft: 3,
    borderRadius: 2,
    letterSpacing: 0.3,
    borderWidth: 0.5,
  },
  pillMetric: { color: ACCENT, backgroundColor: ACCENT_T, borderColor: ACCENT_R },
  pillInterp: { color: WARN, backgroundColor: WARN_T, borderColor: WARN_R },
  pillHybrid: { color: INK_3, backgroundColor: PAPER_S, borderColor: RULE_F },
  pillEvid: { color: POS, backgroundColor: POS_T, borderColor: POS_R },
  /* Mono span helper. */
  mono: { fontFamily: FM, letterSpacing: -0.1 },
  /* Table. */
  tbl: { width: "100%", marginBottom: 0 },
  tblHead: {
    flexDirection: "row",
    backgroundColor: PAPER_S,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: RULE_S,
  },
  tblTh: {
    fontFamily: FG,
    fontWeight: 500,
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    color: INK_3,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tblRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: RULE_F,
  },
  tblRowLast: { flexDirection: "row" },
  tblTd: {
    fontFamily: FG,
    fontSize: 8.5,
    color: INK_1,
    paddingVertical: 5.5,
    paddingHorizontal: 6,
    lineHeight: 1.35,
  },
  tblTdMono: {
    fontFamily: FM,
    fontSize: 8,
    color: INK_1,
    paddingVertical: 5.5,
    paddingHorizontal: 6,
    letterSpacing: -0.1,
  },
  tblTdMuted: {
    fontFamily: FG,
    fontSize: 8,
    color: INK_3,
    paddingVertical: 5.5,
    paddingHorizontal: 6,
  },
  tblTdMutedMono: {
    fontFamily: FM,
    fontSize: 8,
    color: INK_3,
    paddingVertical: 5.5,
    paddingHorizontal: 6,
    letterSpacing: -0.1,
  },
  tblTot: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: RULE_S,
    backgroundColor: PAPER_S,
  },
  tblTotTd: {
    fontFamily: FG,
    fontWeight: 500,
    fontSize: 8.5,
    color: INK_1,
    paddingVertical: 5.5,
    paddingHorizontal: 6,
  },
  tblTotTdMono: {
    fontFamily: FM,
    fontWeight: 500,
    fontSize: 8,
    color: INK_1,
    paddingVertical: 5.5,
    paddingHorizontal: 6,
    letterSpacing: -0.1,
  },
  /* Table note (mono small text below a table). */
  tblNote: {
    fontFamily: FM,
    fontSize: 7.5,
    color: INK_3,
    lineHeight: 1.5,
    marginTop: 5,
    paddingHorizontal: 1,
  },
  tblNoteIntro: {
    fontFamily: FM,
    fontSize: 7.5,
    color: INK_3,
    lineHeight: 1.5,
    marginBottom: 6,
    paddingHorizontal: 1,
  },
  tblNoteVal: { color: INK_2 },
  tblNoteFaint: { color: INK_4 },
  /* Concentration breaches: 3-column row with wrappers so the body
   * column wraps correctly under flex constraints. */
  brRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE_F,
    alignItems: "flex-start",
  },
  brSev: {
    width: 78,
    flexDirection: "column",
    paddingRight: 8,
  },
  brSevText: {
    fontFamily: FM,
    fontSize: 7,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  brBodWrap: {
    flex: 1,
    paddingRight: 8,
  },
  brBod: {
    fontFamily: FG,
    fontSize: 8.5,
    color: INK_1,
    lineHeight: 1.5,
  },
  brBodEvid: {
    fontFamily: FG,
    fontSize: 8,
    color: INK_3,
  },
  brFigWrap: {
    width: 48,
  },
  brFig: {
    fontFamily: FM,
    fontSize: 9,
    color: INK_1,
    textAlign: "right",
    letterSpacing: -0.1,
  },
  /* Risk flag cards: 2-column with colored left border. */
  flCard: {
    flexDirection: "row",
    paddingVertical: 6.5,
    paddingHorizontal: 10,
    marginBottom: 5,
    borderLeftWidth: 1.5,
    borderLeftColor: RULE_S,
    alignItems: "flex-start",
  },
  flCat: {
    width: 70,
    flexDirection: "column",
    paddingRight: 10,
    paddingTop: 1,
  },
  flCatText: {
    fontFamily: FM,
    fontWeight: 500,
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  flBodWrap: {
    flex: 1,
  },
  flBod: {
    fontFamily: FG,
    fontSize: 8.5,
    color: INK_1,
    lineHeight: 1.55,
  },
  flBodTitle: {
    fontFamily: FG,
    fontWeight: 500,
  },
  /* Talking points. */
  tpItem: {
    flexDirection: "row",
    paddingVertical: 7,
    borderTopWidth: 0.5,
    borderTopColor: RULE_F,
    alignItems: "flex-start",
  },
  tpItemFirst: {
    flexDirection: "row",
    paddingTop: 0,
    paddingBottom: 7,
    alignItems: "flex-start",
  },
  tpN: {
    width: 22,
    fontFamily: FM,
    fontSize: 7.5,
    color: INK_4,
    paddingTop: 1,
  },
  tpBWrap: {
    flex: 1,
  },
  tpB: {
    fontFamily: FG,
    fontSize: 9,
    color: INK_1,
    lineHeight: 1.6,
  },
  tpEmph: { color: INK_3 },
  /* Coverage note, framed box. */
  covLabelRow: {
    paddingBottom: 4,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE_S,
  },
  covLabel: {
    fontFamily: FG,
    fontWeight: 500,
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: INK_3,
  },
  covBox: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: PAPER_S,
    borderWidth: 0.5,
    borderColor: RULE_F,
    borderRadius: 2,
    fontFamily: FG,
    fontSize: 8,
    color: INK_2,
    lineHeight: 1.6,
  },
  /* Severity vocab term colors. */
  vocabEsc: { color: NEG },
  vocabFlg: { color: WARN },
  vocabInfo: { color: ACCENT },
  vocabOk: { color: POS },
});

function sourceStyle(source: SourceTag) {
  if (source === "metric") return styles.pillMetric;
  if (source === "interpretation") return styles.pillInterp;
  if (source === "hybrid") return styles.pillHybrid;
  return styles.pillEvid;
}

function sourceLabel(source: SourceTag): string {
  if (source === "metric") return "METRIC";
  if (source === "interpretation") return "INTERPRETATION";
  if (source === "hybrid") return "HYBRID";
  return "EVIDENCE";
}

function SourcePill({ source }: { source: SourceTag }): ReactElement {
  return <Text style={[styles.pill, sourceStyle(source)]}>{sourceLabel(source)}</Text>;
}

function severityColor(severity: string): string {
  if (severity === "escalate") return NEG;
  if (severity === "flag") return WARN;
  if (severity === "info") return ACCENT;
  return POS;
}

function severityVocabStyle(severity: string) {
  if (severity === "escalate") return styles.vocabEsc;
  if (severity === "flag") return styles.vocabFlg;
  if (severity === "info") return styles.vocabInfo;
  return styles.vocabOk;
}

function severityTagLabel(severity: string): string {
  if (severity === "escalate") return "Escalate";
  if (severity === "flag") return "Flag";
  if (severity === "info") return "Info";
  return "OK";
}

/* Pull a "blended fee" figure from the Fee risk flags. Looks for the
 * fee-inefficiency pattern with a percent-of-AUM figure. Falls back to
 * the first bps figure on any Fee flag, else null. */
function extractBlendedFee(flags: RiskFlag[]): string | null {
  const feeFlags = flags.filter((f) => f.category === "Fee");
  for (const f of feeFlags) {
    const text = `${f.title} ${f.body}`;
    const pctMatch = text.match(/~?(\d+(?:\.\d+)?)\s*%/);
    if (pctMatch && parseFloat(pctMatch[1]) >= 0.5 && parseFloat(pctMatch[1]) <= 5) {
      return `~${pctMatch[1]}%`;
    }
  }
  for (const f of feeFlags) {
    const bpsMatch = `${f.title} ${f.body}`.match(/~?(\d{2,3}(?:-\d{2,3})?)\s*bps/);
    if (bpsMatch) return `~${bpsMatch[1]} bps`;
  }
  return null;
}

/* The largest concentration breach figure: parse percent values from
 * section 3 and return the breach with the highest one. Used for the
 * fifth KPI cell. */
function largestBreach(breaches: ConcentrationBreach[]): ConcentrationBreach | null {
  let best: { br: ConcentrationBreach; pct: number } | null = null;
  for (const br of breaches) {
    const m = br.figure.match(/(\d+(?:\.\d+)?)\s*%/);
    if (!m) continue;
    const pct = parseFloat(m[1]);
    if (!best || pct > best.pct) best = { br, pct };
  }
  return best?.br ?? null;
}

/* Extract the integer holdings count from a label like "12 holdings". */
function holdingsCount(label: string): number | null {
  const m = label.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export type BriefingPDFProps = {
  briefing: BriefingContent;
  investorName: string;
  snapshotDate: string;
  caseId: string;
  advisorName: string;
  firmName: string;
  generatedAt: string;
  stubbed?: boolean | null;
};

export function BriefingPDF(props: BriefingPDFProps): ReactElement<DocumentProps> {
  const { briefing, investorName, snapshotDate, caseId, advisorName, generatedAt, stubbed } = props;
  const b = transformRupeesDeep(briefing);

  const blendedFee = extractBlendedFee(b.section_4_risk_flags);
  const lb = largestBreach(b.section_3_concentration_analysis);
  const obsCount = b.section_1_headline_observations.length;
  const escalateCount = b.header.severity_counts.escalate;
  const flagCount = b.header.severity_counts.flag;
  const totalHoldings = holdingsCount(b.header.holdings_label);
  const frozenLine = stubbed ? "Stubbed reasoning" : "Frozen artefact";

  return (
    <Document title={`Briefing ${caseId} ${investorName}`} author={advisorName} producer="Lean Samriddhi MVP">
      <Page size="A4" style={styles.page} wrap>
        {/* Top header strip, fixed */}
        <View style={styles.pgHd} fixed>
          <Text style={styles.pgHdL}>Investor Briefing · Lean Samriddhi MVP</Text>
          <Text style={styles.pgHdR}>
            {caseId} · {investorName} · {advisorName}
          </Text>
        </View>

        {/* Document header, page 1 only (not fixed; flows once) */}
        <View style={styles.docHd}>
          <Text style={styles.docEye}>Investor Briefing</Text>
          <View style={styles.docTitleRow}>
            <View style={styles.docTitleLeft}>
              <Text style={styles.docTitle}>{investorName}</Text>
              <View style={styles.docSubRow}>
                <Text>{b.header.case_label} </Text>
                <Text style={styles.docSubSep}>·</Text>
                <Text> Snapshot </Text>
                <Text style={styles.docSubVal}>{snapshotDate} </Text>
                <Text style={styles.docSubSep}>·</Text>
                <Text> Liquid AUM </Text>
                <Text style={[styles.docSubVal, styles.mono]}>{b.header.liquid_aum_label} </Text>
                <Text style={styles.docSubSep}>·</Text>
                <Text> {b.header.stated_revealed_label}</Text>
              </View>
            </View>
            <View style={styles.docMeta}>
              <Text style={styles.docMetaLine}>
                Case <Text style={styles.docMetaVal}>{caseId}</Text>
              </Text>
              <Text style={styles.docMetaLine}>
                Generated <Text style={styles.docMetaVal}>{generatedAt}</Text>
              </Text>
              <Text style={styles.docMetaLine}>
                {frozenLine} · Model <Text style={styles.docMetaVal}>Samriddhi S2</Text>
              </Text>
              <Text
                style={styles.docMetaPageLine}
                render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
              />
            </View>
          </View>
        </View>

        {/* Diagnostic summary bar (KPI strip), page 1 only */}
        <View style={styles.diagBar}>
          <View style={styles.diagCell}>
            <Text style={styles.diagEye}>Severity</Text>
            <Text style={[styles.diagVal, { color: severityColor(escalateCount > 0 ? "escalate" : flagCount > 0 ? "flag" : "ok") }]}>
              {escalateCount > 0 ? "Escalate" : flagCount > 0 ? "Flag" : "OK"}
            </Text>
            <Text style={styles.diagSub}>
              {escalateCount > 0
                ? `${escalateCount} observation${escalateCount === 1 ? "" : "s"} require advisor review`
                : `${obsCount} observations surfaced`}
            </Text>
          </View>
          <View style={styles.diagCell}>
            <Text style={styles.diagEye}>Also flagged</Text>
            <Text style={[styles.diagVal, { color: WARN }]}>{flagCount} Flag</Text>
            <Text style={styles.diagSub}>Threshold breached; materiality is advisor judgment</Text>
          </View>
          <View style={styles.diagCell}>
            <Text style={styles.diagEye}>Liquid AUM</Text>
            <Text style={styles.diagVal}>{b.header.liquid_aum_label}</Text>
            <Text style={styles.diagSub}>
              {totalHoldings ? `${totalHoldings} holdings analysed; snapshot frozen` : "Snapshot frozen"}
            </Text>
          </View>
          {blendedFee ? (
            <View style={styles.diagCell}>
              <Text style={styles.diagEye}>Blended fee est.</Text>
              <Text style={[styles.diagVal, { color: WARN }]}>{blendedFee}</Text>
              <Text style={styles.diagSub}>Passive equivalent would carry under 0.6%</Text>
            </View>
          ) : null}
          <View style={[styles.diagCell, styles.diagCellLast]}>
            <Text style={styles.diagEye}>Largest breach</Text>
            <Text style={[styles.diagVal, { color: lb?.severity === "escalate" ? NEG : WARN }]}>
              {lb?.figure ?? "—"}
            </Text>
            <Text style={styles.diagSub}>
              {lb ? `${lb.kind} ${lb.severity === "escalate" ? "escalate" : "flag"}` : "No breaches surfaced"}
            </Text>
          </View>
        </View>

        {/* Section 01, Headline observations */}
        <Section1HeadlineObservations
          items={b.section_1_headline_observations}
          escalate={escalateCount}
          flag={flagCount}
        />

        {/* Section 02, Portfolio overview */}
        <Section2PortfolioOverview
          rows={b.section_2_portfolio_overview.rows}
          totalAumLine={b.section_2_portfolio_overview.total_aum_line}
          liquidityLine={b.section_2_portfolio_overview.liquidity_tier_line}
        />

        {/* Section 03, Concentration analysis */}
        <Section3ConcentrationAnalysis breaches={b.section_3_concentration_analysis} />

        {/* Section 04, Risk flags */}
        <Section4RiskFlags flags={b.section_4_risk_flags} />

        {/* Section 05, Comparison vs model */}
        <Section5Comparison
          framingLine={b.section_5_comparison_vs_model.framing_line}
          rows={b.section_5_comparison_vs_model.rows}
        />

        {/* Section 06, Talking points */}
        <Section6TalkingPoints items={b.section_6_talking_points} />

        {/* Section 07, Evidence appendix */}
        <Section7EvidenceAppendix rows={b.section_7_evidence_appendix} totalHoldings={totalHoldings} />

        {/* Coverage note */}
        <CoverageNoteBlock body={b.coverage_note} />

        {/* Bottom footer strip, fixed on every page */}
        <View style={styles.pgFtRule} fixed />
        <Text style={styles.pgFtLeft} fixed>
          Prepared, not generated.
        </Text>
        <Text
          style={styles.pgFtRight}
          fixed
          render={({ pageNumber, totalPages }) => (
            <Text>{`Page ${pageNumber} of ${totalPages} · Lean Samriddhi MVP · ${frozenLine}`}</Text>
          )}
        />
      </Page>
    </Document>
  );
}

function Section1HeadlineObservations({
  items,
  escalate,
  flag,
}: {
  items: HeadlineObservation[];
  escalate: number;
  flag: number;
}): ReactElement {
  return (
    <View style={styles.section} wrap>
      <View style={styles.secHd}>
        <Text style={styles.secN}>01</Text>
        <Text style={styles.secT}>Headline observations</Text>
        <Text style={styles.secSub}>
          {items.length} observations · {escalate} escalate · {flag} flag
        </Text>
      </View>
      {items.map((o, i) => (
        <View key={i} style={styles.obsItem} wrap={false}>
          <Text style={styles.obsDash}>·</Text>
          <Text style={styles.obsBody}>
            <Text style={[styles.obsVocab, severityVocabStyle(o.severity)]}>
              {o.vocab.replace(/_/g, " ")}.
            </Text>
            {" "}
            {o.one_line}
            {" "}
            <SourcePill source={o.source} />
          </Text>
        </View>
      ))}
    </View>
  );
}

function Section2PortfolioOverview({
  rows,
  totalAumLine,
  liquidityLine,
}: {
  rows: PortfolioOverviewRow[];
  totalAumLine: string;
  liquidityLine: string;
}): ReactElement {
  return (
    <View style={styles.section} wrap>
      <View style={styles.secHd}>
        <Text style={styles.secN}>02</Text>
        <Text style={styles.secT}>Portfolio overview</Text>
        <Text style={styles.secSub}>Model bands · severity colour reflects status</Text>
      </View>
      <View style={styles.tbl}>
        <View style={styles.tblHead}>
          <Text style={[styles.tblTh, { flex: 2 }]}>Asset class</Text>
          <Text style={[styles.tblTh, { flex: 1, textAlign: "right" }]}>Actual</Text>
          <Text style={[styles.tblTh, { flex: 1, textAlign: "right" }]}>Model target</Text>
          <Text style={[styles.tblTh, { flex: 1, textAlign: "right" }]}>Band</Text>
          <Text style={[styles.tblTh, { flex: 1.5, textAlign: "right" }]}>vs. Band</Text>
          <Text style={[styles.tblTh, { flex: 1, textAlign: "right" }]}>Status</Text>
        </View>
        {rows.map((row, idx) => {
          const isInBand = row.in_band;
          const sev = isInBand ? "info" : "flag";
          const vsBandLabel = vsBandText(row);
          return (
            <View key={row.asset_class} style={idx === rows.length - 1 ? styles.tblRowLast : styles.tblRow}>
              <Text style={[styles.tblTd, { flex: 2 }]}>{row.asset_class}</Text>
              <Text style={[styles.tblTdMono, { flex: 1, textAlign: "right" }]}>
                {row.actual_pct.toFixed(1)}%
              </Text>
              <Text style={[styles.tblTdMono, { flex: 1, textAlign: "right" }]}>
                {row.target_pct.toFixed(1)}%
              </Text>
              <Text style={[styles.tblTdMutedMono, { flex: 1, textAlign: "right" }]}>
                {row.band[0]}-{row.band[1]}%
              </Text>
              <Text
                style={[
                  styles.tblTdMono,
                  { flex: 1.5, textAlign: "right", color: isInBand ? INK_4 : WARN },
                ]}
              >
                {vsBandLabel}
              </Text>
              <Text
                style={[
                  styles.tblTd,
                  { flex: 1, textAlign: "right", color: isInBand ? INK_4 : WARN },
                ]}
              >
                {severityTagLabel(sev)}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.tblNote}>{totalAumLine}</Text>
      <Text style={styles.tblNote}>{liquidityLine}</Text>
      <Text style={[styles.tblNote, styles.tblNoteFaint]}>
        Vs. band measures distance from the nearest band boundary (ceiling above, floor below); not deviation from the model target.
      </Text>
    </View>
  );
}

function vsBandText(row: PortfolioOverviewRow): string {
  if (row.in_band) {
    const sign = row.deviation_pp >= 0 ? "+" : "";
    return `${sign}${row.deviation_pp.toFixed(1)} pp`;
  }
  const [floor, ceiling] = row.band;
  const dist =
    row.actual_pct > ceiling
      ? { pp: row.actual_pct - ceiling, dir: "above" }
      : { pp: floor - row.actual_pct, dir: "below" };
  return `${dist.pp >= 0 ? "+" : ""}${dist.pp.toFixed(1)} pp ${dist.dir}`;
}

function Section3ConcentrationAnalysis({
  breaches,
}: {
  breaches: ConcentrationBreach[];
}): ReactElement {
  const escalate = breaches.filter((b) => b.severity === "escalate").length;
  const flag = breaches.filter((b) => b.severity === "flag").length;
  return (
    <View style={styles.section} wrap>
      <View style={styles.secHd}>
        <Text style={styles.secN}>03</Text>
        <Text style={styles.secT}>Concentration analysis</Text>
        <Text style={styles.secSub}>
          {breaches.length} breaches · {escalate} escalate · {flag} flag
        </Text>
      </View>
      {breaches.length === 0 ? (
        <Text style={styles.tblNote}>No concentration breaches surfaced.</Text>
      ) : (
        breaches.map((br, i) => (
          <View
            key={i}
            style={i === breaches.length - 1 ? { ...styles.brRow, borderBottomWidth: 0 } : styles.brRow}
            wrap={false}
          >
            <View style={styles.brSev}>
              <Text style={[styles.brSevText, { color: severityColor(br.severity) }]}>
                {br.kind}
              </Text>
              <Text style={[styles.brSevText, { color: severityColor(br.severity), marginTop: 2 }]}>
                {severityTagLabel(br.severity)}
              </Text>
              <View style={{ marginTop: 3, alignSelf: "flex-start" }}>
                <SourcePill source={br.source} />
              </View>
            </View>
            <View style={styles.brBodWrap}>
              <Text style={styles.brBod}>
                {br.detail}
                {br.evidence ? <Text style={styles.brBodEvid}> {br.evidence}</Text> : null}
              </Text>
            </View>
            <View style={styles.brFigWrap}>
              <Text style={styles.brFig}>{br.figure}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function Section4RiskFlags({ flags }: { flags: RiskFlag[] }): ReactElement {
  const escalate = flags.filter((f) => f.severity === "escalate").length;
  const flag = flags.filter((f) => f.severity === "flag").length;
  const ok = flags.filter((f) => f.severity === "ok").length;
  return (
    <View style={styles.section} wrap>
      <View style={styles.secHd}>
        <Text style={styles.secN}>04</Text>
        <Text style={styles.secT}>Risk flags</Text>
        <Text style={styles.secSub}>
          {escalate} escalate · {flag} flag · {ok} ok
        </Text>
      </View>
      {flags.map((f, i) => (
        <View
          key={i}
          style={[styles.flCard, { borderLeftColor: severityColor(f.severity) }]}
          wrap={false}
        >
          <View style={styles.flCat}>
            <Text style={[styles.flCatText, { color: severityColor(f.severity) }]}>
              {f.category}
            </Text>
            <Text style={[styles.flCatText, { color: severityColor(f.severity), marginTop: 3 }]}>
              {severityTagLabel(f.severity)}
            </Text>
            <View style={{ marginTop: 3, alignSelf: "flex-start" }}>
              <SourcePill source={f.source} />
            </View>
          </View>
          <View style={styles.flBodWrap}>
            <Text style={styles.flBod}>
              <Text style={styles.flBodTitle}>{f.title}.</Text> {f.body}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Section5Comparison({
  framingLine,
  rows,
}: {
  framingLine: string;
  rows: ModelComparisonRow[];
}): ReactElement {
  return (
    <View style={styles.section} wrap>
      <View style={styles.secHd}>
        <Text style={styles.secN}>05</Text>
        <Text style={styles.secT}>Comparison versus model portfolio</Text>
        <Text style={styles.secSub}>Aggressive long-term model</Text>
      </View>
      <Text style={styles.tblNoteIntro}>{framingLine}</Text>
      <View style={styles.tbl}>
        <View style={styles.tblHead}>
          <Text style={[styles.tblTh, { flex: 3 }]}>Sleeve</Text>
          <Text style={[styles.tblTh, { flex: 1, textAlign: "right" }]}>Model</Text>
          <Text style={[styles.tblTh, { flex: 1, textAlign: "right" }]}>Actual</Text>
          <Text style={[styles.tblTh, { flex: 3 }]}>Note</Text>
        </View>
        {rows.map((row, idx) => (
          <View key={idx} style={idx === rows.length - 1 ? styles.tblRowLast : styles.tblRow}>
            <Text style={[styles.tblTd, { flex: 3 }]}>{row.sleeve}</Text>
            <Text style={[styles.tblTdMono, { flex: 1, textAlign: "right" }]}>{row.model_pct}</Text>
            <Text style={[styles.tblTdMono, { flex: 1, textAlign: "right" }]}>{row.actual_pct}</Text>
            <Text style={[styles.tblTdMuted, { flex: 3 }]}>{row.note}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Section6TalkingPoints({ items }: { items: TalkingPoint[] }): ReactElement {
  return (
    <View style={styles.section} wrap>
      <View style={styles.secHd}>
        <Text style={styles.secN}>06</Text>
        <Text style={styles.secT}>Suggested talking points</Text>
        <Text style={styles.secSub}>
          <SourcePill source="interpretation" />
        </Text>
      </View>
      {items.map((tp, i) => (
        <View key={i} style={i === 0 ? styles.tpItemFirst : styles.tpItem} wrap={false}>
          <Text style={styles.tpN}>{tp.number}</Text>
          <View style={styles.tpBWrap}>
            <Text style={styles.tpB}>
              {tp.body}
              {tp.emphasis ? <Text style={styles.tpEmph}> {tp.emphasis}</Text> : null}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Section7EvidenceAppendix({
  rows,
  totalHoldings,
}: {
  rows: EvidenceAppendixRow[];
  totalHoldings: number | null;
}): ReactElement {
  const shown = rows.length;
  const valueSum = rows
    .map((r) => parseFloat(r.value_cr))
    .filter((v) => !Number.isNaN(v))
    .reduce((acc, v) => acc + v, 0);
  const weightSum = rows
    .map((r) => parseFloat(r.weight_pct.replace("%", "")))
    .filter((v) => !Number.isNaN(v))
    .reduce((acc, v) => acc + v, 0);
  return (
    <View style={styles.section} wrap>
      <View style={styles.secHd}>
        <Text style={styles.secN}>07</Text>
        <Text style={styles.secT}>Evidence appendix</Text>
        <Text style={styles.secSub}>Primary diagnostic holdings · {shown} shown</Text>
      </View>
      <View style={styles.tbl}>
        <View style={styles.tblHead}>
          <Text style={[styles.tblTh, { flex: 4 }]}>Holding</Text>
          <Text style={[styles.tblTh, { flex: 3 }]}>Sub-category</Text>
          <Text style={[styles.tblTh, { flex: 1.4, textAlign: "right" }]}>Value (Rs Cr)</Text>
          <Text style={[styles.tblTh, { flex: 1.2, textAlign: "right" }]}>Weight</Text>
        </View>
        {rows.map((row, idx) => (
          <View key={`${row.name}-${idx}`} style={idx === rows.length - 1 ? styles.tblRowLast : styles.tblRow}>
            <Text style={[styles.tblTd, { flex: 4 }]}>{row.name}</Text>
            <Text style={[styles.tblTdMutedMono, { flex: 3 }]}>{row.sub_category}</Text>
            <Text style={[styles.tblTdMono, { flex: 1.4, textAlign: "right" }]}>{row.value_cr}</Text>
            <Text style={[styles.tblTdMono, { flex: 1.2, textAlign: "right" }]}>{row.weight_pct}</Text>
          </View>
        ))}
        <View style={styles.tblTot}>
          <Text style={[styles.tblTotTd, { flex: 7 }]}>
            Holdings shown ({shown}{totalHoldings ? ` of ${totalHoldings}` : ""})
          </Text>
          <Text style={[styles.tblTotTdMono, { flex: 1.4, textAlign: "right" }]}>{valueSum.toFixed(2)}</Text>
          <Text style={[styles.tblTotTdMono, { flex: 1.2, textAlign: "right" }]}>{weightSum.toFixed(1)}%</Text>
        </View>
      </View>
      <Text style={styles.tblNote}>
        Full holdings detail is in the case audit view. Sub-category codes follow the Samriddhi asset class taxonomy.
      </Text>
    </View>
  );
}

function CoverageNoteBlock({ body }: { body: string }): ReactElement {
  return (
    <View style={styles.section} wrap>
      <View style={styles.covLabelRow}>
        <Text style={styles.covLabel}>Coverage note</Text>
      </View>
      <Text style={styles.covBox}>{body}</Text>
    </View>
  );
}
