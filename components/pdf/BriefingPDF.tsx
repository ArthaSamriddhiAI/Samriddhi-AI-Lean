/* React PDF briefing renderer. Foundation §6 seven-section layout.
 *
 * Approved format from cc_msg_04: plain firm-name header with thin
 * horizontal rule; per-page footer with advisor + firm + case ID +
 * generation timestamp + "Page X of Y" + the static line "Prepared, not
 * generated. Lean Samriddhi MVP." Source tags (metric / interpretation /
 * hybrid / evidence_agent) get a small uppercase pill so a reviewer can
 * scan provenance at a glance.
 *
 * Fonts: React PDF's built-in Times-Roman / Helvetica family. The
 * lean MVP's Source Serif 4 / Geist register would need TTF assets in
 * the repo; deferred to Slice 7 polish (font upgrade for the PDF).
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { BriefingContent, SourceTag } from "@/lib/agents/s1-diagnostic";
import { transformRupeesDeep } from "@/lib/format/rupees";

const COLOR_INK_1 = "#0f1419";
const COLOR_INK_2 = "#3a4148";
const COLOR_INK_3 = "#5a6168";
const COLOR_INK_4 = "#7a8088";
const COLOR_INK_5 = "#9aa0a8";
const COLOR_INK_6 = "#cbd0d6";
const COLOR_ACCENT = "#1d3557";
const COLOR_NEG = "#a03333";
const COLOR_WARN = "#a67100";
const COLOR_INFO = "#1d3557";
const COLOR_OK = "#3a7c4c";
const COLOR_RULE = "#cbd0d6";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: "Times-Roman",
    fontSize: 9.5,
    color: COLOR_INK_2,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR_RULE,
    marginBottom: 16,
  },
  headerLeft: {},
  headerEyebrow: {
    fontSize: 7.5,
    color: COLOR_INK_4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
    fontFamily: "Helvetica",
  },
  headerTitle: {
    fontSize: 18,
    color: COLOR_INK_1,
    fontFamily: "Times-Roman",
    marginBottom: 4,
  },
  headerMeta: {
    fontSize: 8.5,
    color: COLOR_INK_3,
    fontFamily: "Helvetica",
  },
  headerRight: {
    alignItems: "flex-end",
    fontSize: 8,
    color: COLOR_INK_4,
    fontFamily: "Helvetica",
  },
  headerRightLine: {
    fontSize: 8,
    color: COLOR_INK_4,
    fontFamily: "Helvetica",
    marginBottom: 2,
  },
  workbenchLede: {
    fontSize: 10,
    color: COLOR_INK_2,
    lineHeight: 1.5,
    marginBottom: 18,
    fontStyle: "italic",
  },
  section: {
    marginBottom: 14,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionNum: {
    fontSize: 8,
    color: COLOR_INK_5,
    fontFamily: "Helvetica-Bold",
    marginRight: 8,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 11.5,
    color: COLOR_INK_1,
    fontFamily: "Helvetica-Bold",
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 6,
  },
  bulletDot: {
    width: 10,
    fontSize: 9.5,
    color: COLOR_INK_4,
  },
  bulletBody: {
    flex: 1,
  },
  vocab: {
    fontFamily: "Helvetica-Bold",
    color: COLOR_INK_1,
  },
  table: {
    borderTopWidth: 0.5,
    borderTopColor: COLOR_RULE,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR_RULE,
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR_RULE,
    paddingVertical: 4,
    backgroundColor: "#f6f5f1",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 0.25,
    borderBottomColor: "#e5e2dc",
  },
  tableRowLast: {
    flexDirection: "row",
    paddingVertical: 4,
  },
  th: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: COLOR_INK_3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  td: {
    fontSize: 9,
    color: COLOR_INK_2,
  },
  tdMuted: {
    fontSize: 9,
    color: COLOR_INK_4,
  },
  tdMono: {
    fontSize: 9,
    color: COLOR_INK_2,
    fontFamily: "Courier",
  },
  alignRight: {
    textAlign: "right",
  },
  lineNote: {
    fontSize: 8.5,
    color: COLOR_INK_3,
    fontFamily: "Courier",
    marginBottom: 4,
  },
  breachRow: {
    flexDirection: "row",
    marginBottom: 6,
    alignItems: "flex-start",
  },
  breachKind: {
    width: 64,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: COLOR_INK_2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginRight: 8,
  },
  breachKindEscalate: {
    width: 64,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: COLOR_NEG,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginRight: 8,
  },
  breachDetail: {
    flex: 1,
    fontSize: 9.5,
    color: COLOR_INK_2,
    marginRight: 8,
  },
  breachFigure: {
    width: 64,
    fontSize: 9.5,
    color: COLOR_INK_1,
    fontFamily: "Courier",
    textAlign: "right",
  },
  flagItem: {
    flexDirection: "row",
    marginBottom: 6,
    alignItems: "flex-start",
  },
  flagCat: {
    width: 72,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: COLOR_INK_3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginRight: 8,
    marginTop: 2,
  },
  flagBody: {
    flex: 1,
  },
  flagTitle: {
    fontFamily: "Helvetica-Bold",
    color: COLOR_INK_1,
  },
  talkItem: {
    flexDirection: "row",
    marginBottom: 8,
  },
  talkNum: {
    width: 20,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: COLOR_ACCENT,
    marginRight: 8,
  },
  talkBody: {
    flex: 1,
    fontSize: 9.5,
    color: COLOR_INK_2,
  },
  coverage: {
    fontSize: 8.5,
    color: COLOR_INK_4,
    lineHeight: 1.5,
    fontStyle: "italic",
    marginTop: 4,
  },
  /* Source tag pills */
  sourcePill: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginLeft: 4,
    borderRadius: 2,
    letterSpacing: 0.4,
  },
  sourceMetric: {
    color: "#214a78",
    backgroundColor: "#e2ecf6",
  },
  sourceInterpretation: {
    color: "#634916",
    backgroundColor: "#f4eedc",
  },
  sourceHybrid: {
    color: "#3a4148",
    backgroundColor: "#e9e7e1",
  },
  sourceEvidence: {
    color: "#385c3f",
    backgroundColor: "#e0ebe2",
  },
  /* Footer (rendered as a fixed page footer)
   * React PDF: position:absolute + bottom + left/right pins to page edge;
   * the `fixed` prop on the element causes it to repeat on every page. */
  footerLeft: {
    position: "absolute",
    bottom: 22,
    left: 48,
    fontSize: 7,
    color: COLOR_INK_4,
    fontFamily: "Helvetica",
  },
  footerRight: {
    position: "absolute",
    bottom: 22,
    right: 48,
    width: 280,
    fontSize: 7,
    color: COLOR_INK_4,
    fontFamily: "Helvetica",
    textAlign: "right",
  },
  footerRule: {
    position: "absolute",
    bottom: 38,
    left: 48,
    right: 48,
    height: 0.5,
    backgroundColor: COLOR_RULE,
  },
});

function sourceStyle(source: SourceTag) {
  if (source === "metric") return styles.sourceMetric;
  if (source === "interpretation") return styles.sourceInterpretation;
  if (source === "hybrid") return styles.sourceHybrid;
  return styles.sourceEvidence;
}

function sourceLabel(source: SourceTag) {
  if (source === "metric") return "METRIC";
  if (source === "interpretation") return "INTERPRETATION";
  if (source === "hybrid") return "HYBRID";
  return "EVIDENCE";
}

function SourcePill({ source }: { source: SourceTag }): ReactElement {
  return <Text style={[styles.sourcePill, sourceStyle(source)]}>{sourceLabel(source)}</Text>;
}

function colorForSeverity(severity: string): string {
  if (severity === "escalate") return COLOR_NEG;
  if (severity === "flag") return COLOR_WARN;
  if (severity === "info") return COLOR_INFO;
  return COLOR_OK;
}

export type BriefingPDFProps = {
  briefing: BriefingContent;
  investorName: string;
  snapshotDate: string;
  caseId: string;
  advisorName: string;
  firmName: string;
  generatedAt: string;
};

export function BriefingPDF(props: BriefingPDFProps): ReactElement<DocumentProps> {
  const { briefing, investorName, snapshotDate, caseId, advisorName, firmName, generatedAt } = props;
  /* Render-time currency substitution. The data layer keeps "Rs"
   * verbatim from foundation and LLM outputs; here we walk the briefing
   * tree once and replace "Rs <digit>" → "₹<digit>". Applied inside the
   * component so every PDF rendering caller (route, script) gets it
   * automatically. */
  const b = transformRupeesDeep(briefing);

  return (
    <Document title={`Briefing ${caseId} ${investorName}`} author={advisorName} producer="Lean Samriddhi MVP">
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            <Text style={styles.headerEyebrow}>{firmName}</Text>
            <Text style={styles.headerTitle}>{investorName}</Text>
            <Text style={styles.headerMeta}>
              {b.header.case_label} · Snapshot {snapshotDate} · {b.header.liquid_aum_label} · {b.header.stated_revealed_label}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerRightLine}>Case {caseId}</Text>
            <Text style={styles.headerRightLine}>Generated {generatedAt}</Text>
            <Text style={styles.headerRightLine}>Frozen artefact</Text>
          </View>
        </View>

        {/* Workbench lede */}
        <Text style={styles.workbenchLede}>{b.workbench_lede}</Text>

        {/* Section 1, Headline observations */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionNum}>01</Text>
            <Text style={styles.sectionTitle}>Headline observations</Text>
          </View>
          {b.section_1_headline_observations.map((o, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletDot}>·</Text>
              <View style={styles.bulletBody}>
                <Text>
                  <Text style={[styles.vocab, { color: colorForSeverity(o.severity) }]}>{o.vocab.replace(/_/g, " ")}.</Text>
                  {" "}
                  {o.one_line}
                  {" "}
                  <SourcePill source={o.source} />
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Section 2, Portfolio overview */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionNum}>02</Text>
            <Text style={styles.sectionTitle}>Portfolio overview</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { flex: 2 }]}>Asset class</Text>
              <Text style={[styles.th, styles.alignRight, { flex: 1 }]}>Actual</Text>
              <Text style={[styles.th, styles.alignRight, { flex: 1 }]}>Model</Text>
              <Text style={[styles.th, styles.alignRight, { flex: 1 }]}>Band</Text>
              <Text style={[styles.th, styles.alignRight, { flex: 2 }]}>Deviation</Text>
            </View>
            {b.section_2_portfolio_overview.rows.map((row, idx, arr) => (
              <View key={row.asset_class} style={idx === arr.length - 1 ? styles.tableRowLast : styles.tableRow}>
                <Text style={[styles.td, { flex: 2 }]}>{row.asset_class}</Text>
                <Text style={[styles.tdMono, styles.alignRight, { flex: 1 }]}>{row.actual_pct.toFixed(1)}%</Text>
                <Text style={[styles.tdMono, styles.alignRight, { flex: 1 }]}>{row.target_pct}%</Text>
                <Text style={[styles.tdMuted, styles.alignRight, { flex: 1 }]}>{row.band[0]}-{row.band[1]}%</Text>
                <Text style={[styles.tdMono, styles.alignRight, { flex: 2, color: row.in_band ? COLOR_INK_4 : COLOR_WARN }]}>
                  {row.deviation_pp > 0 ? "+" : ""}{row.deviation_pp.toFixed(1)} pp
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.lineNote}>{b.section_2_portfolio_overview.total_aum_line}</Text>
          <Text style={styles.lineNote}>{b.section_2_portfolio_overview.liquidity_tier_line}</Text>
        </View>

        {/* Section 3, Concentration analysis */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionNum}>03</Text>
            <Text style={styles.sectionTitle}>Concentration analysis</Text>
          </View>
          {b.section_3_concentration_analysis.length === 0 ? (
            <Text style={styles.lineNote}>No concentration breaches surfaced.</Text>
          ) : (
            b.section_3_concentration_analysis.map((br, i) => (
              <View key={i} style={styles.breachRow}>
                <Text style={br.severity === "escalate" ? styles.breachKindEscalate : styles.breachKind}>
                  {br.kind}
                </Text>
                <Text style={styles.breachDetail}>
                  {br.detail}{" "}
                  <Text style={{ fontStyle: "italic", color: COLOR_INK_4 }}>{br.evidence}</Text>
                  {" "}
                  <SourcePill source={br.source} />
                </Text>
                <Text style={styles.breachFigure}>{br.figure}</Text>
              </View>
            ))
          )}
        </View>

        {/* Section 4, Risk flags */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionNum}>04</Text>
            <Text style={styles.sectionTitle}>Risk flags</Text>
          </View>
          {b.section_4_risk_flags.map((flag, i) => (
            <View key={i} style={styles.flagItem}>
              <Text style={[styles.flagCat, { color: colorForSeverity(flag.severity) }]}>{flag.category}</Text>
              <View style={styles.flagBody}>
                <Text>
                  <Text style={styles.flagTitle}>{flag.title}.</Text> {flag.body}
                  {" "}
                  <SourcePill source={flag.source} />
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Section 5, Comparison vs model */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionNum}>05</Text>
            <Text style={styles.sectionTitle}>Comparison versus model portfolio</Text>
          </View>
          <Text style={[styles.lineNote, { marginBottom: 8 }]}>{b.section_5_comparison_vs_model.framing_line}</Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { flex: 3 }]}>Sleeve</Text>
              <Text style={[styles.th, styles.alignRight, { flex: 1 }]}>Model</Text>
              <Text style={[styles.th, styles.alignRight, { flex: 1 }]}>Actual</Text>
              <Text style={[styles.th, { flex: 3, paddingLeft: 8 }]}>Note</Text>
            </View>
            {b.section_5_comparison_vs_model.rows.map((row, idx, arr) => (
              <View key={idx} style={idx === arr.length - 1 ? styles.tableRowLast : styles.tableRow}>
                <Text style={[styles.td, { flex: 3 }]}>{row.sleeve}</Text>
                <Text style={[styles.tdMono, styles.alignRight, { flex: 1 }]}>{row.model_pct}</Text>
                <Text style={[styles.tdMono, styles.alignRight, { flex: 1 }]}>{row.actual_pct}</Text>
                <Text style={[styles.tdMuted, { flex: 3, paddingLeft: 8 }]}>{row.note}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Section 6, Talking points */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionNum}>06</Text>
            <Text style={styles.sectionTitle}>Suggested talking points</Text>
          </View>
          {b.section_6_talking_points.map((tp, i) => (
            <View key={i} style={styles.talkItem}>
              <Text style={styles.talkNum}>{tp.number}</Text>
              <Text style={styles.talkBody}>
                {tp.body}
                {tp.emphasis ? <Text style={{ fontStyle: "italic", color: COLOR_INK_3 }}> {tp.emphasis}</Text> : null}
              </Text>
            </View>
          ))}
        </View>

        {/* Section 7, Evidence appendix */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionNum}>07</Text>
            <Text style={styles.sectionTitle}>Evidence appendix</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { flex: 4 }]}>Holding</Text>
              <Text style={[styles.th, { flex: 3 }]}>Sub-category</Text>
              <Text style={[styles.th, styles.alignRight, { flex: 1 }]}>Value</Text>
              <Text style={[styles.th, styles.alignRight, { flex: 1 }]}>Weight</Text>
            </View>
            {b.section_7_evidence_appendix.map((row, idx, arr) => (
              <View key={row.name + idx} style={idx === arr.length - 1 ? styles.tableRowLast : styles.tableRow}>
                <Text style={[styles.td, { flex: 4 }]}>{row.name}</Text>
                <Text style={[styles.tdMuted, { flex: 3, fontFamily: "Courier", fontSize: 8 }]}>{row.sub_category}</Text>
                <Text style={[styles.tdMono, styles.alignRight, { flex: 1 }]}>{row.value_cr}</Text>
                <Text style={[styles.tdMono, styles.alignRight, { flex: 1 }]}>{row.weight_pct}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Coverage note */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionNum}>—</Text>
            <Text style={styles.sectionTitle}>Coverage note</Text>
          </View>
          <Text style={styles.coverage}>{b.coverage_note}</Text>
        </View>

        {/* Footer (fixed across pages). Each element is absolutely
         * positioned and marked fixed so it repeats on every page.
         * Dynamic page numbering via the render() prop is not landing
         * reliably in this @react-pdf/renderer version; deferred to
         * Slice 7 polish. The case ID + frozen marker carries the
         * institutional provenance for now. */}
        <View style={styles.footerRule} fixed />
        <Text style={styles.footerLeft} fixed>
          {advisorName} · {firmName} · Prepared, not generated. Lean Samriddhi MVP.
        </Text>
        <Text style={styles.footerRight} fixed>
          Case {caseId} · Frozen artefact
        </Text>
      </Page>
    </Document>
  );
}
