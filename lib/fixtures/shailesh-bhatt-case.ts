/* The Shailesh Bhatt diagnostic case content, lifted from the wireframe's
 * screen3_casedetail.jsx. Per the approved orientation Q5 option a, this
 * fixture renders in every case's Analysis and Briefing tabs regardless
 * of the investor and snapshot picked at New Case time. The DB row's
 * Investor and Snapshot fields drive the toolbar chrome (breadcrumb,
 * frozen timestamp); the body is this static content.
 *
 * Real LLM-generated content replaces this in the Samriddhi 2 reasoning
 * slice (slice 2). The shape of the data here is informative for the
 * eventual schema but not yet stable.
 */

export type Severity = "escalate" | "flag" | "info" | "ok";

export const SHAILESH_BHATT_CASE = {
  header: {
    investorName: "Shailesh Bhatt",
    caseLabel: "Quarterly review",
    snapshotDate: "13 Dec 2025",
    snapshotDateLong: "Snapshot 13 Dec 2025",
    liquidAumCr: "Rs 22.10 Cr",
    holdingsLine: "12 holdings",
    statedRevealed: "Aggressive stated; moderate-aggressive revealed",
    severityCounts: { escalate: 2, flag: 4, total: 6 },
  },

  workbenchLede:
    "Six observations surfaced: two escalate-severity, four flag-severity. The portfolio sits outside the model band on all four asset classes: equity above the ceiling (72.2% vs 60-70%), debt below the floor (14.3% vs 20-30%). Wrapper over-accumulation is the primary structural concern: four PMS strategies aggregate 39.4% of liquid AUM, with two concentration thresholds in simultaneous breach. The Avendus Cat III position has not earned its complexity premium over seven years against any reasonable benchmark. Stated-revealed divergence is the behavioural framing for the whole portfolio shape. Liquidity is within the essential tier. PMS and AIF look-through is qualitative; the financials sector concentration figure is an estimate from published strategy positioning.",

  allocationTable: [
    { class: "Equity", actual: "72.2%", target: "65.0%", band: "60-70%", deviation: "+7.2 pp above band", deviationTone: "warn" as const },
    { class: "Debt", actual: "14.3%", target: "25.0%", band: "20-30%", deviation: "-5.7 pp below band", deviationTone: "warn" as const },
    { class: "Alternatives", actual: "13.6%", target: "7.0%", band: "5-10%", deviation: "+3.6 pp above band", deviationTone: "warn" as const },
    { class: "Cash", actual: "0.0%", target: "3.0%", band: "2-5%", deviation: "-2.0 pp below", deviationTone: "muted" as const },
  ],
  liquidityLine: "Liquidity: T+30 plus T+90 share 16.2%; essential tier floor 5-15%; within tier.",

  observations: [
    {
      name: "Wrapper over-accumulation",
      category: "Concentration risk",
      severity: "escalate" as Severity,
      figure: "39.4% · 4 strategies",
      body: "Four PMS strategies (Marcellus, White Oak, Motilal Oswal Value, Alchemy) aggregate 39.4% of liquid AUM. Threshold triggers on two conditions simultaneously: four or more PMS strategies in the portfolio, and a single wrapper type exceeding 25% of AUM. Neither condition has a hard mandate ceiling; the advisor should judge materiality.",
      bodyTail: "No clear mandate differentiation was stated between the four strategies at time of each addition.",
      evidence: {
        eye: "Holdings driving this observation",
        rows: [
          { label: "Marcellus Consistent Compounder PMS", value: "11.3%" },
          { label: "White Oak India Pioneers PMS", value: "10.0%" },
          { label: "Motilal Oswal Value Strategy PMS", value: "9.5%" },
          { label: "Alchemy Smart Alpha 250 PMS", value: "8.6%" },
        ],
      },
    },
    {
      name: "Complexity premium not earned",
      category: "Fee drag",
      severity: "escalate" as Severity,
      figure: "8.2% CAGR · 7y",
      body: "Avendus Absolute Return Fund (Cat III long-short, 2018 vintage) has returned 8.2% CAGR over seven years. Nifty 500 TRI returned approximately 13.1% over the same window; a conservative hybrid benchmark prints approximately 9.5%. The 2-and-20 fee structure compounds the underperformance gap. The fund is the largest single holding in the portfolio.",
      bodyTail: "The complexity premium test: a complex wrapper should outperform its closest passive substitute by at least its incremental fee. This one has not.",
      evidence: {
        eye: "Benchmarks",
        rows: [
          { label: "Avendus Absolute Return · 7Y CAGR (2018 vintage)", value: "8.2%" },
          { label: "Nifty 500 TRI · same window", value: "~13.1%" },
          { label: "Conservative hybrid benchmark", value: "~9.5%" },
          { label: "Fund weight in portfolio", value: "13.6%" },
        ],
      },
    },
    {
      name: "Stated-revealed divergence",
      category: "Behavioural risk",
      severity: "flag" as Severity,
      figure: "Stated agg; revealed mod-agg",
      body: "Stated aggressive at onboarding. Revealed pattern from six years of additions reads moderate-aggressive: relationship-driven product additions across four separate RM relationships, none benchmarked against each other or against passive alternatives. The portfolio shape reflects accumulation through ambient social signals, not mandate-directed construction. The cleanup inflection point is now active; the daughter's structured analysis is the natural conversation entry.",
    },
    {
      name: "Position over-concentration",
      category: "Concentration risk",
      severity: "flag" as Severity,
      figure: "Three breaches at flag threshold",
      body: "Three direct and wrapper holdings exceed the 10% position concentration flag threshold. None have reached the 15% escalation threshold. Avendus at 13.6% is the nearest to escalation.",
      evidence: {
        eye: "Holdings above the 10% flag threshold",
        rows: [
          { label: "Avendus Absolute Return Fund", value: "13.6% · near escalate" },
          { label: "Reliance Industries", value: "12.2% · flag" },
          { label: "HDFC Bank (direct holding)", value: "11.3% · flag" },
        ],
      },
    },
    {
      name: "Sector over-concentration",
      category: "Concentration risk · qualitative",
      severity: "flag" as Severity,
      figure: "~30% financials",
      body: "Financials exposure estimated at 28-31% of liquid AUM from HDFC Bank direct (11.3%) plus inferred bank weighting inside the PMS stack. PMS look-through is unavailable in the data layer; the figure is sourced from published strategy positioning rather than computed look-through. Flag threshold is 25%; escalation is 35%. Current estimate sits between the two.",
    },
    {
      name: "Fee inefficiency",
      category: "Fee drag",
      severity: "flag" as Severity,
      figure: "~2.1% blended",
      body: "Blended fee load across PMS management and performance fees, Cat III 2-and-20, and MF expense ratios is estimated at approximately 2.1% of AUM. A passive equivalent on the same asset class allocation would carry under 0.6%. The approximately 1.5 pp fee gap compounds materially over a multi-decade stewardship horizon.",
    },
  ],

  holdings: [
    { name: "Marcellus Consistent Compounder PMS", subCat: "pms_concentrated_quality", value: "2.50", weight: "11.3%", bucket: "T+365" },
    { name: "White Oak India Pioneers PMS", subCat: "pms_growth_quality", value: "2.20", weight: "10.0%", bucket: "T+365" },
    { name: "Motilal Oswal Value Strategy PMS", subCat: "pms_value", value: "2.10", weight: "9.5%", bucket: "T+365" },
    { name: "Alchemy Smart Alpha 250 PMS", subCat: "pms_focused_midcap", value: "1.90", weight: "8.6%", bucket: "T+365" },
    { name: "Reliance Industries", subCat: "listed_large_cap", value: "2.70", weight: "12.2%", bucket: "T+30" },
    { name: "HDFC Bank", subCat: "listed_large_cap", value: "2.50", weight: "11.3%", bucket: "T+30" },
    { name: "ITC Limited", subCat: "listed_large_cap", value: "1.10", weight: "5.0%", bucket: "T+30" },
    { name: "Mirae Asset Large Cap Fund", subCat: "mf_active_large_cap", value: "0.50", weight: "2.3%", bucket: "T+90" },
    { name: "Parag Parikh Flexi Cap Fund", subCat: "mf_active_flexi_cap", value: "0.45", weight: "2.0%", bucket: "T+90" },
    { name: "Avendus Absolute Return Fund", subCat: "aif_cat_iii_long_short", value: "3.00", weight: "13.6%", bucket: "T+365" },
    { name: "HDFC Bank FD", subCat: "bank_fd", value: "1.55", weight: "7.0%", bucket: "T+365" },
    { name: "Aditya Birla Arbitrage Fund", subCat: "mf_arbitrage", value: "1.60", weight: "7.2%", bucket: "T+30" },
  ],
  holdingsTotal: { value: "22.10", weight: "100.0%" },

  coverageNote:
    "PMS and AIF holdings are treated as structurally opaque wrappers; no look-through is available from Indian regulatory disclosure at the holding level. Mirae Asset Large Cap and Parag Parikh Flexi Cap sit outside the well-covered MF set (top-5 stock and sector data unavailable); only aggregate concentration data is consumable. Sector observations are qualitative and sourced from the strategies' published positioning.",

  briefing: {
    headerRight: ["Generated 13 Dec 2025, 09:14 IST", "Frozen artefact · 1 of 2 pages"],

    headlineObservations: [
      {
        vocab: "Wrapper over-accumulation.",
        body: "Four PMS strategies (Marcellus, White Oak, Motilal Oswal Value, Alchemy) aggregate ",
        strong: "39.4% of liquid AUM",
        tail: ", against a wrapper threshold of four or more PMS strategies or any wrapper exceeding 25%. Both conditions trigger.",
      },
      {
        vocab: "Complexity premium not earned.",
        body: "Avendus Absolute Return (Cat III long-short, 2018 vintage) sits at ",
        strong: "13.6% of liquid AUM",
        tail: ". Seven-year CAGR 8.2%; Nifty 500 TRI over the same window approximately 13.1%. Below the unhedged passive over the holding period.",
      },
      {
        vocab: "Stated-revealed divergence.",
        body: "Stated aggressive at onboarding; revealed pattern is moderate-aggressive. Portfolio shape reflects relationship-driven product additions, not mandate-directed construction.",
        strong: "",
        tail: "",
      },
      {
        vocab: "Allocation drift.",
        body: "Equity ",
        strong: "72.2%",
        tail: " sits above the aggressive long-term band ceiling (60-70%); debt 14.3% sits below the 20-30% floor.",
      },
    ],

    concentrationBreaches: [
      { kind: "Position", kindClass: "escalate" as const, detail: "Avendus Absolute Return at 13.6% of liquid AUM.", em: "Threshold: flag at 10%, escalate at 15%.", figure: "13.6%" },
      { kind: "Position", kindClass: "" as const, detail: "Reliance Industries direct holding.", em: "Flagged: above 10% single-instrument threshold.", figure: "12.2%" },
      { kind: "Position", kindClass: "" as const, detail: "HDFC Bank direct holding plus inferred PMS exposure compounds the position.", em: "Direct holding alone breaches.", figure: "11.3%" },
      { kind: "Position", kindClass: "" as const, detail: "Marcellus Consistent Compounder PMS at the position-instrument level.", em: "Wrapper exceeds the per-instrument flag.", figure: "11.3%" },
      { kind: "Sector", kindClass: "" as const, detail: "Financials exposure estimated at 28-31% from HDFC Bank direct plus inferred bank weighting inside the PMS stack.", em: "Qualitative; PMS look-through limited. Flag at 25%, escalate at 35%.", figure: "~30%" },
      { kind: "Wrapper", kindClass: "escalate" as const, detail: "Four PMS strategies aggregate 39.4% of liquid AUM.", em: "Threshold: 4+ PMS strategies, or any wrapper exceeding 25%. Both conditions trigger.", figure: "39.4%" },
    ],

    riskFlags: [
      {
        cat: "Behavioural",
        tone: "warn" as const,
        title: "Stated-revealed divergence.",
        body: "Stated aggressive at onboarding; revealed moderate-aggressive across six years of additions. PMS stack accumulated through four separate RM relationships, none benchmarked against another.",
        em: "Implication: the current portfolio reflects accumulation, not construction.",
      },
      {
        cat: "Fee",
        tone: "warn" as const,
        title: "Fee inefficiency.",
        body: "Blended fee load estimated at approximately 2.1% of AUM. PMS aggregate management plus performance fees, Cat III at 2-and-20 over hurdle. Passive equivalents on a 65% equity / 25% debt / 7% alt construction would carry under 0.6%.",
      },
      {
        cat: "Fee",
        tone: "neg" as const,
        title: "Complexity premium not earned.",
        body: "Avendus Absolute Return seven-year CAGR 8.2%; Nifty 500 TRI over same window approximately 13.1%; conservative hybrid benchmark approximately 9.5%. The 2-and-20 fee structure compounds the gap.",
      },
      {
        cat: "Mandate",
        tone: "info" as const,
        title: "Allocation drift.",
        body: "Equity above the 60-70% band ceiling; debt below the 20-30% floor. Drift is driven by wrapper accumulation rather than active rebalancing.",
      },
    ],

    modelComparison: [
      { sleeve: "Large cap (active + passive)", model: "50%", actual: "23%", note: "Direct stocks heavy; little MF participation" },
      { sleeve: "Flexi cap (active)", model: "20%", actual: "2%", note: "Single MF position; effectively absent" },
      { sleeve: "Mid cap (active or PMS)", model: "15%", actual: "8%", note: "Alchemy PMS only" },
      { sleeve: "Small cap", model: "5%", actual: "0%", note: "Not held" },
      { sleeve: "International (GIFT / feeder)", model: "10%", actual: "0%", note: "Not held" },
      { sleeve: "PMS quality / value (uncategorised by model)", model: "-", actual: "39%", note: "Accumulated outside the model's sleeve construction" },
    ],

    talkingPoints: [
      {
        num: "01",
        body: "The PMS stack is the natural opening. Aanchal already surfaced the question in December; the framing the briefing supports is ",
        em: "four overlapping wrappers, no benchmarked differentiation, aggregate 39% of liquid AUM",
        tail: ". Concrete, single-question.",
      },
      {
        num: "02",
        body: "Avendus Cat III is the cleanest cleanup conversation. Seven years, ",
        em: "8.2% CAGR, the index returned more without the 2-and-20",
        tail: ". The Aanchal-flagged \"complexity premium not earned\" frame applies cleanly here.",
      },
      {
        num: "03",
        body: "International exposure is a quiet add. Zero international today; model targets 10% of equity via GIFT or feeder. Worth surfacing as a sleeve completion question, not a recommendation.",
        em: "",
        tail: "",
      },
      {
        num: "04",
        body: "Mandate refresh is worth offering. Stated aggressive; revealed moderate-aggressive. The cleanup conversation is a natural occasion to formalise the mandate so subsequent additions are mandate-anchored.",
        em: "",
        tail: "",
      },
    ],

    evidenceAppendix: [
      { name: "Marcellus Consistent Compounder PMS", sub: "pms_concentrated_quality", value: "2.50", weight: "11.3%" },
      { name: "White Oak India Pioneers PMS", sub: "pms_growth_quality", value: "2.20", weight: "10.0%" },
      { name: "Motilal Oswal Value Strategy PMS", sub: "pms_value", value: "2.10", weight: "9.5%" },
      { name: "Alchemy Smart Alpha 250 PMS", sub: "pms_focused_midcap", value: "1.90", weight: "8.6%" },
      { name: "Reliance Industries", sub: "listed_large_cap", value: "2.70", weight: "12.2%" },
      { name: "HDFC Bank", sub: "listed_large_cap", value: "2.50", weight: "11.3%" },
      { name: "ITC Limited", sub: "listed_large_cap", value: "1.10", weight: "5.0%" },
      { name: "Avendus Absolute Return Fund", sub: "aif_cat_iii_long_short", value: "3.00", weight: "13.6%" },
    ],
  },

  chatMessages: [
    {
      who: "user" as const,
      name: "Priya",
      bubble: "Why did you flag the wrapper concentration?",
    },
    {
      who: "bot" as const,
      name: "Samriddhi",
      bubbleParts: [
        { kind: "text" as const, value: "Four PMS strategies (Marcellus, White Oak, Motilal Oswal Value, Alchemy) aggregate to 39.4% of liquid AUM." },
        { kind: "cite" as const, value: "§3" },
        { kind: "text" as const, value: " The wrapper threshold flags at four or more PMS strategies, or any single wrapper type exceeding 25%. Both conditions trigger here." },
        { kind: "cite" as const, value: "§3" },
      ],
    },
    {
      who: "user" as const,
      name: "Priya",
      bubble: "What's the threshold for sector concentration?",
    },
    {
      who: "bot" as const,
      name: "Samriddhi",
      bubbleParts: [
        { kind: "text" as const, value: "Sector concentration flags at 25% of liquid AUM in a single sector, and escalates at 35%." },
        { kind: "cite" as const, value: "§3" },
        { kind: "text" as const, value: " For Shailesh, financials sits at an estimated 28-31% from HDFC Bank direct plus inferred bank weighting inside the PMS stack. The figure is qualitative because PMS look-through is unavailable in the data layer." },
        { kind: "cite" as const, value: "§3" },
      ],
    },
    {
      who: "user" as const,
      name: "Priya",
      bubble: "Where does the 8.2% CAGR for Avendus come from?",
    },
    {
      who: "bot" as const,
      name: "Samriddhi",
      bubbleParts: [
        { kind: "text" as const, value: "From the fund's published NAV series, 2018 vintage to snapshot date." },
        { kind: "cite" as const, value: "§4" },
        { kind: "text" as const, value: " The case operates on the frozen snapshot; no live updates." },
      ],
    },
  ],
} as const;
