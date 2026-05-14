# Gate 1, Shailesh Bhatt diagnostic case output sample

This is the first end-to-end output of the Slice 2 diagnostic pipeline.
Generated for review before the other five investors are run.

**Case ID:** `c-2026-05-14-bhatt-01`
**Investor:** Shailesh Bhatt
**Snapshot:** 2026-04-02 (t0 baseline)
**Generation:** 579.0s end to end
**Severity (derived):** `escalate`
**Headline:** Four PMS strategies aggregate 39.4% of liquid AUM; combined PMS + AIF wrapper-tier exposure is 53.0% (Rs 11.7 Cr) at blended fee load ~340-350 bps weighted average.

## Token usage (Sonnet 4.6 across all agents)

Total input tokens: `79417`; total output tokens: `33306`.
Per-agent breakdown:

- `e3`: 6603 in / 3877 out
- `e4`: 3917 in / 2445 out
- `e1`: 6017 in / 4049 out
- `e2`: 3048 in / 3789 out
- `e6`: 5431 in / 7321 out
- `e7`: 5144 in / 5969 out
- `s1`: 49257 in / 5856 out

Router decision: e1_listed_fundamental_equity, e2_industry_business, e3_macro_policy_news, e4_behavioural_historical, e6_pms_aif_sif, e7_mutual_fund activated. case_mode=diagnostic; listed_equity=true; mf=true; pms=true; aif=true; unlisted_in_scope=false

---

## Header (chrome metadata)

- Investor: Shailesh Bhatt
- Case label: Quarterly review
- Snapshot date: 2 Apr 2026
- Liquid AUM: Rs 22.10 Cr
- Holdings: 12 holdings
- Stated/revealed: Aggressive stated; moderate-aggressive revealed
- Severity counts: escalate=2, flag=7, total=9

## Workbench lede

> Diagnostic surfaces nine material observations across a Rs 22.10 Cr, 12-holding portfolio dominated by a 53.0% wrapper-tier sleeve (4 PMS + 1 AIF). Two items escalate: wrapper over-accumulation at four PMS strategies aggregating 39.4% of liquid AUM, and a complexity premium not earned at Motilal Oswal Value Strategy PMS with negative since-inception alpha at the highest fee load in the sleeve. Five position-level concentration flags and a debt allocation 10.8 pp below mandate band complete the deterministic picture. Qualitative overlay: a material stated-revealed divergence on risk appetite shapes how every recommendation must be framed.

## Section 1, Headline observations (5)

- **`wrapper_over_accumulation`** [escalate, source: hybrid]
  Four PMS strategies aggregate 39.4% of liquid AUM; combined PMS + AIF wrapper-tier exposure is 53.0% (Rs 11.7 Cr) at blended fee load ~340-350 bps weighted average.
- **`complexity_premium_not_earned`** [escalate, source: evidence_agent]
  Motilal Oswal Value Strategy PMS (9.5% weight) shows since-inception alpha of -0.72% net of fees vs BSE 500 TRI at the highest fixed management fee in the sleeve (2.5% p.a., ~360 bps blended).
- **`allocation_drift`** [flag, source: metric]
  Debt allocation at 14.2% sits 10.8 pp below the 20-30% mandate band; equity at 72.2% breaches the 60-70% ceiling by 2.2 pp.
- **`stated_revealed_divergence`** [flag, source: interpretation]
  Stated aggressive risk appetite diverges materially from revealed moderate-aggressive pattern across six years of relationship-trust PMS accumulation without benchmarking.
- **`position_over_concentration`** [flag, source: metric]
  Five positions breach the 10% single-instrument flag: Avendus AIF 13.6%, Reliance 12.2%, Marcellus PMS 11.3%, HDFC Bank 11.3%, White Oak PMS 10.0%.

## Section 2, Portfolio overview

| Asset class | Actual | Target | Band | Deviation | In band |
|---|---|---|---|---|---|
| Equity | 72.2% | 65% | 60-70% | +7.2 pp | no |
| Debt | 14.2% | 25% | 20-30% | -10.8 pp | no |
| Alternatives | 13.6% | 7% | 5-10% | +6.6 pp | no |
| Cash | 0.0% | 3% | 2-5% | -3.0 pp | no |

*Liquid AUM Rs 22.10 Cr across 12 holdings*
*Liquidity tier essential (5-15% floor); T+30 share 35.7%, T+90 4.3%, T+365 60.0%, locked 0%; tier floor not breached*

## Section 3, Concentration analysis (7)

- **Position concentration** [flag, source: metric] · 13.6%
  Avendus Absolute Return Fund — largest single position in portfolio *Flag threshold 10%; weight 13.6% (Rs 3.00 Cr); quarterly redemption window creates liquidity concentration at largest weight*
- **Position concentration** [flag, source: metric] · 12.2%
  Reliance Industries direct equity *Flag threshold 10%; weight 12.2% (Rs 2.70 Cr)*
- **Position concentration** [flag, source: metric] · 11.3%
  Marcellus Consistent Compounder PMS *Flag threshold 10%; weight 11.3% (Rs 2.50 Cr); quality-factor overlap with White Oak*
- **Position concentration** [flag, source: metric] · 11.3%
  HDFC Bank direct equity *Flag threshold 10%; weight 11.3% (Rs 2.50 Cr)*
- **Position concentration** [flag, source: metric] · 10.0%
  White Oak India Pioneers PMS *Flag threshold 10%; weight 10.0% (Rs 2.20 Cr)*
- **Wrapper concentration** [escalate, source: metric] · 39.4%
  PMS aggregate across four strategies *Wrapper threshold 4+ PMS strategies or any wrapper >25% of liquid AUM; actual 4 PMS at 39.4% combined*
- **Wrapper concentration** [flag, source: metric] · HHI 0.56
  Asset-class HHI concentration *Asset-class HHI 0.5599 reflects equity-heavy distribution; holding-level HHI 0.2149 below bucket ceiling 0.30 (no breach at holding level)*

## Section 4, Risk flags (8)

- **Debt allocation 10.8 pp below band** [Mandate drift, flag, source: metric]
  Debt sits at 14.2% vs 20-30% mandate band; alternatives at 13.6% vs 5-10% band absorbs much of the shortfall, but the debt underweight reduces ballast against an active macro stress environment.
- **Complexity premium not earned — Motilal Oswal Value Strategy PMS** [Fee, escalate, source: evidence_agent]
  Since-inception alpha -0.72% net of fees vs BSE 500 TRI; 2Y alpha episode -6.14%; highest fixed mgmt fee in sleeve (2.5% p.a.). Snapshot also carries a fund-name mismatch flag (snapshot reads 'Ethical Strategy' vs instrument 'Value Strategy') requiring resolution.
- **Aggregate wrapper-tier fee load ~340-350 bps** [Fee, flag, source: evidence_agent]
  PMS sleeve blended fees of 310/320/360/310 bps and AIF at ~390 bps imply Rs 28-30 lakh annual fee drag across the wrapper sleeve before performance fees; sustained aggregate alpha of 200-250 bps over passive alternatives is the threshold to justify.
- **MF plan-type ambiguity — Parag Parikh and Mirae** [Fee, flag, source: evidence_agent]
  Parag Parikh Flexi Cap snapshot confirms Regular Plan at 1.28% TER; Direct plan would save ~65-70 bps annually. Mirae Asset Large Cap plan type ambiguous at 1.52% TER; clarification needed.
- **Aditya Birla position — labelling mismatch and underperformance** [Fee, escalate, source: evidence_agent]
  Instrument labelled 'Aditya Birla Arbitrage Fund' but snapshot identifies it as 'Aditya Birla Sun Life Large & Mid Cap Fund - Regular Growth' — different product, different risk profile. On its own merits the fund shows 28% rolling 5Y beat frequency, 104.5% downside capture, max drawdown -63.5% with 63-month recovery, TER 1.90%. At 7.2% weight (Rs 1.60 Cr), the largest MF position is also the weakest.
- **Stated-revealed divergence on risk appetite** [Behavioural, flag, source: evidence_agent]
  Six years of relationship-trust PMS accumulation, passive 7Y Cat III hold without benchmarking, and advisor/family-driven decision pattern reveal moderate-aggressive profile vs stated aggressive. Aanchal Bhatt (daughter, IIM-B MBA finance) is the analytical catalyst behind the December 2025 cleanup inflection.
- **Zero cash, no dry powder** [Deployment, flag, source: hybrid]
  Cash at 0% vs 2-5% band; in an active macro stress environment (Brent $118.95, INR 94.79, FII outflows Rs -56,401 Cr in April 2026), no rebalancing capacity without liquidating existing positions.
- **Liquidity tier within floor** [Liquidity, info, source: metric]
  T+30 + T+90 share at 40.0% materially above the 5-15% essential-tier floor; floor not breached. T+365 at 60.0% reflects PMS + AIF + FD ladder.

## Section 5, Comparison vs model portfolio

*Direct comparison applies for the aggressive_long_term bucket; the model portfolio framework is the reference for sleeve weight and wrapper sequencing.*

| Equity sleeve | Model | Actual | Note |
|---|---|---|---|
| Equity total | 65% | 72.2% | Above band ceiling by 2.2 pp |
| Debt total | 25% | 14.2% | Below band floor by 5.8 pp |
| Alternatives total | 7% | 13.6% | Above band ceiling by 3.6 pp, single AIF position |
| Cash | 3% | 0% | Below band floor by 2 pp |
| PMS wrapper (within equity) | - | 39.4% | Four strategies; wrapper threshold breach |
| Direct listed equity | - | 28.5% | Three large-cap names; deep India macro beta |
| Active MF (equity) | - | 4.3% | Mirae 2.3%, Parag Parikh 2.0% |

## Section 6, Suggested talking points

**01.** The four-PMS sleeve at 39.4% of liquid AUM reflects six years of relationship-trust accumulation. Aanchal's December framing of the consolidation question is well-anchored; the diagnostic supports her read. *wrapper consolidation, not wrapper exit*

**02.** Motilal Oswal Value Strategy is the cleanest exit candidate on evidence: negative since-inception alpha, highest fixed fee in the sleeve, and a fund-name mismatch in the snapshot that needs resolution before any action. *resolve mismatch first*

**03.** Avendus at 13.6% is the largest single position and the largest fee load. The drawdown protection thesis is real for 2020 and 2022 but the long-run net-of-fee alpha vs passive is marginal for a 12-15 year horizon. *complexity premium tension, not exit verdict*

**04.** The stated-aggressive label sits above revealed moderate-aggressive behaviour. Frame any consolidation conversation at moderate-aggressive; this aligns with how Shailesh has actually invested rather than how he describes himself. *anchor to revealed, not stated*

**05.** Debt at 14.2% sits 5.8 pp below the band floor with zero cash buffer; in the current macro (crude shock, INR depreciation, heavy FII outflows), the absence of dry powder is the most operationally constraining gap. *ballast and dry powder*

**06.** Parag Parikh is on the Regular Plan at 1.28% TER per the snapshot. A direct-plan switch is a clean fee optimisation worth surfacing alongside the larger conversations. *Direct plan switch*

## Section 7, Evidence appendix

| Holding | Sub-category | Value | Weight |
|---|---|---|---|
| Marcellus Consistent Compounder PMS | `pms_concentrated_quality` | 2.50 | 11.3% |
| White Oak India Pioneers PMS | `pms_growth_quality` | 2.20 | 10.0% |
| Motilal Oswal Value Strategy PMS | `pms_value` | 2.10 | 9.5% |
| Alchemy Smart Alpha 250 PMS | `pms_focused_midcap` | 1.90 | 8.6% |
| Reliance Industries | `listed_large_cap` | 2.70 | 12.2% |
| HDFC Bank | `listed_large_cap` | 2.50 | 11.3% |
| Avendus Absolute Return Fund | `aif_cat_iii_long_short` | 3.00 | 13.6% |
| Parag Parikh Flexi Cap Fund | `mf_active_flexi_cap` | 0.45 | 2.0% |
| Mirae Asset Large Cap Fund | `mf_active_large_cap` | 0.50 | 2.3% |
| Aditya Birla Arbitrage Fund | `mf_arbitrage` | 1.60 | 7.2% |

## Coverage note

> The diagnostic operated on deterministic metrics for all twelve holdings and evidence-agent verdicts for the five wrapper-tier products (E6) and three mutual funds (E7) plus three direct listed names (E1/E2). Three of five wrapper products (Marcellus, White Oak, Alchemy, Avendus) carry null snapshot records — fee, performance, and strategy claims for these rely on published positioning with confidence capped at 0.55-0.65. Two critical data-integrity flags require resolution before action: the Motilal Oswal snapshot fund name ('Ethical Strategy') does not match the instrument name ('Value Strategy'), and the Aditya Birla position is labelled 'Arbitrage Fund' but the snapshot identifies it as a Large & Mid Cap Fund — fundamentally different product categories. MF look-through coverage is 0% (three uncovered funds at 11.5% weight); sector concentration via mutual fund holdings cannot be assessed. Plan-type (Direct vs Regular) is confirmed only for Parag Parikh; Mirae remains ambiguous. The macro overlay from E3 (Brent $118.95, INR 94.79, heavy FII outflows) is an active stress environment, not a latent risk, and shapes the read on the zero-cash deployment gap.

---

## Deterministic metrics annex (M0.PortfolioRiskAnalytics output)

These are the auditable numbers the LLM agents reasoned against.

```json
{
  "totalLiquidAumCr": 22.1,
  "holdingsCount": 12,
  "assetClass": {
    "Equity": {
      "actualPct": 72.2,
      "targetPct": 65,
      "band": [
        60,
        70
      ],
      "deviationPct": 7.2,
      "inBand": false
    },
    "Debt": {
      "actualPct": 14.2,
      "targetPct": 25,
      "band": [
        20,
        30
      ],
      "deviationPct": -10.8,
      "inBand": false
    },
    "Alternatives": {
      "actualPct": 13.6,
      "targetPct": 7,
      "band": [
        5,
        10
      ],
      "deviationPct": 6.6,
      "inBand": false
    },
    "Cash": {
      "actualPct": 0,
      "targetPct": 3,
      "band": [
        2,
        5
      ],
      "deviationPct": -3,
      "inBand": false
    }
  },
  "concentration": {
    "hhiHoldingLevel": 0.2149,
    "hhiAssetClassLevel": 0.5599,
    "top1": {
      "instrument": "PMS aggregate",
      "weightPct": 39.4
    },
    "top5": [
      {
        "instrument": "PMS aggregate",
        "weightPct": 39.4
      },
      {
        "instrument": "AIF aggregate",
        "weightPct": 13.6
      },
      {
        "instrument": "Reliance Industries",
        "weightPct": 12.2
      },
      {
        "instrument": "HDFC Bank",
        "weightPct": 11.3
      },
      {
        "instrument": "Aditya Birla Arbitrage Fund",
        "weightPct": 7.2
      }
    ],
    "bucketCeilingHhi": 0.3,
    "bucketTier": "Aggressive",
    "hhiBreach": false,
    "positionFlags": [
      {
        "instrument": "Marcellus Consistent Compounder PMS",
        "weightPct": 11.3,
        "severity": "flag"
      },
      {
        "instrument": "White Oak India Pioneers PMS",
        "weightPct": 10,
        "severity": "flag"
      },
      {
        "instrument": "Reliance Industries",
        "weightPct": 12.2,
        "severity": "flag"
      },
      {
        "instrument": "HDFC Bank",
        "weightPct": 11.3,
        "severity": "flag"
      },
      {
        "instrument": "Avendus Absolute Return Fund",
        "weightPct": 13.6,
        "severity": "flag"
      }
    ],
    "wrappers": {
      "pmsCount": 4,
      "pmsAggregatePct": 39.4,
      "pmsList": [
        {
          "instrument": "Marcellus Consistent Compounder PMS",
          "weightPct": 11.3
        },
        {
          "instrument": "White Oak India Pioneers PMS",
          "weightPct": 10
        },
        {
          "instrument": "Motilal Oswal Value Strategy PMS",
          "weightPct": 9.5
        },
        {
          "instrument": "Alchemy Smart Alpha 250 PMS",
          "weightPct": 8.6
        }
      ],
      "aifCount": 1,
      "aifAggregatePct": 13.6,
      "aifList": [
        {
          "instrument": "Avendus Absolute Return Fund",
          "weightPct": 13.6
        }
      ],
      "wrapperCountFlag": true,
      "wrapperShareFlag": true
    },
    "sectorExposureMfLookThrough": [],
    "mfCoverage": {
      "coveredCount": 0,
      "uncoveredCount": 3,
      "coveredWeightPct": 0,
      "uncoveredWeightPct": 11.5
    }
  },
  "liquidity": {
    "bucketBreakdown": {
      "T_30": 35.7,
      "T_90": 4.3,
      "T_365": 60,
      "Locked": 0
    },
    "t30PlusT90Pct": 40,
    "tier": "essential",
    "tierFloor": {
      "minPct": 5,
      "maxPct": 15
    },
    "floorBreach": false
  },
  "cashDeployment": {
    "cashSharePct": 0,
    "deploymentGapPct": 0,
    "cashDragFlag": false
  },
  "computedAt": "2026-05-14T09:54:56.772Z"
}
```
