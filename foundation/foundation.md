# Lean Samriddhi MVP: Factual Foundation

## Scope and Purpose

This document is the factual ground truth for Lean Samriddhi MVP. It defines the model portfolio that diagnostics reference, the data layer vocabulary that diagnostics use, the investor archetypes the demo runs against, and the shape of the briefing PDF the system produces. Downstream design and build phases operate on what is in this document; anything not in this document is out of scope, deferred, or to be negotiated explicitly.

Lean Samriddhi MVP is a case-driven portfolio diagnostic tool for wealth advisors in the Indian HNI and UHNI context. The advisor opens a case for an upcoming investor meeting; the system analyses the investor's portfolio against a single indicative model portfolio using the investor's profile as context; the system produces a 1-2 page briefing PDF that the advisor uses as meeting talking points. A verbose on-platform case view exists for auditability, and a read-only chat lets the advisor interrogate the case. That is the entire product. It does not generate recommendations, it does not consume live market data, it does not run multi-agent orchestration visible to the user, and it does not onboard investors as a functional flow. Those capabilities live in the broader Samriddhi vision; this document does not address them.

## Indicative Model Portfolio

### Anchor Profile

The MVP ships with one indicative model portfolio, anchored to the most common HNI client profile in the demo set: an investor with **aggressive** risk appetite and **long-term** time horizon (over 5 years). This corresponds to the `aggressive_long_term` cell of the broader 3x3 model portfolio matrix. The same diagnostic mechanics compare any investor's portfolio against this reference, regardless of the investor's own (risk_appetite, time_horizon) pair; the diagnostic surfaces alignment or divergence as part of its observation set.

The anchor profile is a notional investor: 40-50 years old, peak accumulation life stage, Rs 10-50 Cr liquid AUM, dual-income or business-owner household with 10-15 year operational horizon and multi-decade stewardship horizon. This is not a single archetype from Section 4; it is the composite reference against which all archetypes are diagnostically compared.

### Allocation Targets

The indicative model portfolio has four asset classes and a 65-25-7-3 split with sub-allocations.

| Asset Class | Target | Range | Vehicle Mix |
|---|---|---|---|
| Equity | 65% | 60-70% | MF active 40%, MF passive index 10%, PMS 10%, direct large cap 5% |
| Debt | 25% | 20-30% | Tax-free bonds 8%, corporate debt MF 8%, short-term debt MF 5%, bank FD 4% |
| Alternatives | 7% | 5-10% | AIF Cat II PE/private credit 4%, gold (SGB or physical) 3% |
| Cash | 3% | 2-5% | Liquid MF or savings, for tactical opportunities and short-term needs |

### Equity Sub-Allocation Detail

Within the 65% equity allocation, the model portfolio targets the following market-cap and style distribution:

| Equity Sleeve | Target Share of Equity | Notes |
|---|---|---|
| Large cap (active MF + passive index) | 50% | Anchor of portfolio; lower volatility |
| Flexi cap (active MF) | 20% | Manager discretion across market caps |
| Mid cap (active MF or PMS) | 15% | Growth tilt with managed concentration |
| Small cap (active MF, capped exposure) | 5% | Long-horizon alpha; capped for volatility |
| International (US ETF via GIFT or feeder) | 10% | Geographic diversification |

### Rationale Notes

The 65% equity weighting reflects aggressive risk appetite with long horizon; equity is the wealth-building engine over 5+ year horizons.

The 25% debt weighting provides ballast and comfortably covers the **essential** liquidity tier floor that the anchor profile is classified into (5-15% in highly liquid instruments). The excess over the tier floor is portfolio-construction ballast, not liquidity buffer. Tax-free bonds are favoured for their post-tax yield in HNI brackets; arbitrage and short-term debt MFs are favoured over long-duration debt to reduce duration risk in the current rate cycle.

The 7% alternatives sleeve introduces uncorrelated return sources without breaching the mandate ceiling typical for non-institutional HNI investors. Cat II AIF (PE and private credit) and SGB or physical gold are the two vehicle types. Cat III long-short is not in the indicative allocation because the diagnostic vocabulary treats Cat III as a complexity-premium product the MVP flags rather than recommends.

The 3% cash floor exists for tactical opportunities and immediate-need coverage; it is deliberately small because most HNI mandates do not require deep cash reserves at the aggressive long-term cell.

The vehicle mix within equity (40% MF active, 10% MF passive, 10% PMS, 5% direct large cap) reflects HNI ticket size that supports PMS access (Rs 50 L minimum per SEBI), while retaining passive index exposure for cost efficiency and direct large cap for advisor-curated conviction positions.

### What the Model Portfolio Is Not

This portfolio is an indicative reference for diagnostic comparison, not a recommendation. The MVP does not propose this allocation to any investor; it uses it as the comparison baseline against which investor portfolios are evaluated. Real firm deployment of Samriddhi would replace this default with the firm's own curated model portfolio per their investment philosophy.

## Data Layer Essentials

The data layer essentials are the shared factual scaffolding that the model portfolio (Section 2) and the investor framework (Section 4) sit on, and that the briefing output (Section 6) consumes. Everything in this section is internally consistent: a sub-category named in the asset class taxonomy is the same sub-category that appears in investor holdings and in the model portfolio's vehicle mix.

### Asset Class Taxonomy

The MVP recognises four asset classes, each with a fixed set of sub-categories. No diagnostic surfaces an asset class or sub-category outside this taxonomy.

**Equity:**

- `mf_active_large_cap`: actively managed large cap mutual funds
- `mf_passive_index`: passive index funds (Nifty 50, Nifty Next 50)
- `mf_active_flexi_cap`: actively managed flexi cap funds
- `mf_active_mid_cap`: actively managed mid cap funds
- `mf_active_small_cap`: actively managed small cap funds
- `mf_hybrid_dynamic_aa`: dynamic asset allocation or balanced advantage funds
- `pms_growth_quality`: PMS strategies positioned as growth-quality
- `pms_concentrated_quality`: PMS strategies with concentrated quality-compounder mandates
- `pms_value`: PMS value strategies
- `pms_focused_midcap`: PMS focused on mid-cap with concentrated portfolios
- `listed_large_cap`: direct holdings in Nifty 100 stocks
- `intl_us_etf`: US ETFs (typically VOO, IVV) held via GIFT city or US brokerage
- `intl_us_individual`: individual US stocks held via US brokerage
- `unlisted_family_business`: founder equity in operating family businesses
- `unlisted_pre_ipo`: founder shares in late-stage private companies

**Debt:**

- `bank_fd`: bank fixed deposits
- `tax_free_bond`: tax-free bonds (NHAI, PFC, REC)
- `mf_corporate_debt`: corporate debt mutual funds
- `mf_short_term_debt`: short-term debt mutual funds
- `mf_arbitrage`: arbitrage funds (technically equity-taxed but debt-like in return profile)

**Alternatives:**

- `aif_cat_ii_pe`: Cat II AIF private equity
- `aif_cat_ii_real_estate`: Cat II AIF real estate
- `aif_cat_ii_private_credit`: Cat II AIF private credit
- `aif_cat_iii_long_short`: Cat III AIF long-short strategies
- `physical_gold`: physical gold (bullion or jewellery)
- `sovereign_gold_bond`: SGB
- `reit`: listed REITs (Embassy, Mindspace, Brookfield)

**Cash:**

- `savings`: bank savings account balances and liquid MF holdings treated as cash equivalents

### Risk Taxonomy

The diagnostic surfaces six categories of risk. Every observation in the briefing output maps to one of these categories.

**Concentration Risk.** Excessive weight in a single instrument, sector, or wrapper type. Surfaced when any single holding exceeds the position concentration threshold, when sector exposure exceeds the sector concentration threshold, or when wrapper-type accumulation exceeds the wrapper concentration threshold.

**Liquidity Risk.** Mismatch between the investor's liquidity tier (Section 4 archetypes carry a tier) and the actual liquidity profile of the portfolio. Surfaced when the share of holdings accessible within 30 days falls below the threshold implied by the investor's liquidity tier, or when an upcoming known outflow (medical contingency, property purchase, education corpus draw) is not covered by appropriate liquidity buckets.

**Mandate Drift.** The portfolio's actual asset allocation has drifted from the bands implied by the investor's (risk_appetite, time_horizon) cell. Surfaced when actual allocation in any asset class is outside the band associated with the investor's model portfolio cell. Note that the MVP compares all investors against the single `aggressive_long_term` indicative portfolio, so for non-aggressive investors this surface is presented as informational, not as drift from their own cell.

**Behavioural Risk.** Divergence between stated risk tolerance and revealed behavioural pattern, or between current portfolio composition and historical decision patterns. Surfaced when an archetype's bible indicates a stated-vs-revealed mismatch (Shailesh Bhatt, for instance), or when the portfolio shows evidence of accumulation through unrelated decisions (multiple overlapping PMS strategies, for instance).

**Fee Drag.** Aggregate fee burden across the portfolio exceeds the threshold appropriate to the portfolio's complexity and the investor's mandate. Surfaced when total fees as a percentage of AUM exceed the fee drag threshold, or when individual high-fee products (Cat III long-short, multiple PMS) are not earning their complexity premium relative to passive alternatives.

**Deployment Efficiency.** The share of the corpus actually working in return-generating instruments. Surfaced when cash or near-cash holdings exceed the deployment threshold, particularly for aggressive long-term investors where idle capital represents a material opportunity cost.

### Concentration Definitions and Thresholds

The MVP uses three concentration constructs:

| Construct | Definition | Threshold |
|---|---|---|
| Position concentration | Any single instrument's share of liquid AUM | Flag at 10%, escalate at 15% |
| Sector concentration | Aggregate share of liquid AUM in any single sector (look-through for MFs and PMS) | Flag at 25%, escalate at 35% |
| Wrapper concentration | Aggregate share in a single wrapper type (e.g., PMS), or count of overlapping wrappers | Flag at 4+ PMS strategies, or any wrapper exceeding 25% |
| HHI (holding-level) | Sum of squared portfolio weights at holding level (with wrapper-level aggregation: PMS aggregate, AIF aggregate, etc.) | Conservative ceiling 0.20; Moderate-Aggressive ceiling 0.25; Aggressive ceiling 0.30 |

Concentration thresholds are advisor-facing reference points, not hard rules. The briefing surfaces concentration observations with the threshold context so the advisor judges materiality in the meeting. HHI is computed at holding level with wrapper-level aggregation; asset-class HHI is reported as context but not thresholded.

### Liquidity Bucket Definitions

Holdings are bucketed by time-to-cash for liquidity diagnostics:

| Bucket | Definition | Typical holdings |
|---|---|---|
| T+30 | Convertible to cash within 30 days at minimal loss | Liquid MF, savings, short-term debt MF, arbitrage MF, listed equity (subject to exit liquidity) |
| T+90 | Convertible within 30 to 90 days | Most debt MFs, equity MFs (with redemption windows), tax-free bonds (subject to secondary market) |
| T+365 | Convertible within 90 days to 1 year | Bank FDs with break costs, mid-vintage AIF positions, PMS strategies with exit notices |
| Locked | Greater than 1 year to cash | Early-vintage Cat II AIF (in investment period), unlisted equity, real estate AIF |

The investor's liquidity tier (essential, secondary, deep) implies a minimum share that should be in T+30 plus T+90: essential implies 5-15%, secondary implies 15-30%, deep implies 30% or more.

### Diagnostic Vocabulary

The briefing output uses a fixed vocabulary of named observations. Each observation maps to one or more risk categories from above. These are the only observation types the MVP surfaces.

**Position over-concentration.** A single instrument exceeds the position concentration threshold. Surfaces holding identity, weight, threshold context.

**Sector over-concentration.** Sectoral exposure exceeds the sector threshold. Surfaces sector, weight, and the underlying holdings contributing.

**Wrapper over-accumulation.** Multiple overlapping PMS or AIF holdings without clear differentiation. Surfaces wrapper count, wrapper types, aggregate share.

**Cash drag.** Cash and near-cash exceed the deployment efficiency threshold for the investor's risk profile. Surfaces cash share and the deployment gap.

**Allocation drift.** Asset class allocation outside the band associated with the investor's (risk_appetite, time_horizon) cell. Surfaces asset class, actual share, target band.

**Liquidity gap.** T+30 plus T+90 share below the floor implied by the investor's liquidity tier. Surfaces actual liquid share, tier floor, and any known upcoming outflows.

**Stated-revealed divergence.** The investor's stated risk profile and the behavioural pattern in the bible disagree. Surfaces the stated profile, the revealed pattern, and the implication for current holdings.

**Fee inefficiency.** Aggregate fee load exceeds the fee threshold, or a specific high-fee product is underperforming its passive alternative. Surfaces fee burden, the products contributing, and an indicative passive comparison where available.

**Complexity premium not earned.** A complex wrapper (Cat III long-short, focused PMS) is not delivering returns commensurate with its complexity and fee. Surfaces the wrapper, its returns, and a benchmark comparison.

**Mandate-consistent.** A positive observation surfaced when an investor's portfolio aligns cleanly with their (risk_appetite, time_horizon) cell. Used to anchor the briefing's tone and provide balance.

### Data Coverage Constraints

The diagnostic operates against a real data snapshot with known coverage limits. These limits are not bugs; they reflect the available structured disclosure in Indian wealth advisory data, and the diagnostic vocabulary is designed to work within them.

**Mutual fund coverage.** Approximately 220 of 1,773 mutual funds in the snapshot carry top-5 stock holdings data, and approximately 160 carry top-5 sector data. For the remaining funds, only aggregate concentration percentages (top 3%, top 5%, top 10%, top 20%) are available, with no stock-level or sector-level detail. Many mainstream HNI workhorse funds (Mirae Asset Large Cap, Axis Bluechip, Parag Parikh Flexi Cap, SBI Small Cap, ICICI Pru Balanced Advantage, HDFC Nifty 50 Index, Franklin India Corporate Debt) fall outside the well-covered set. When a fund is outside coverage, only aggregate concentration data is consumable.

**PMS and AIF opacity.** PMS strategies and AIF positions are treated as structurally opaque wrappers with no look-through. This reflects Indian regulatory disclosure: PMS and AIF holdings are not published with the same regularity or detail as MF holdings. Where the diagnostic surfaces sector or strategy-style claims about a PMS or AIF, the claim is sourced from the strategy's published positioning (fact sheet, quarterly letter) and is qualitative; the diagnostic does not compute through-look concentration for these wrappers.

**Implication for the diagnostic vocabulary.** The named observations in this section are designed to operate within these bounds. Wrapper-level observations (wrapper over-accumulation, complexity premium not earned), count-based observations (multiple overlapping PMS), and asset-class allocation observations (allocation drift, cash drag) work without look-through. Position concentration through direct holdings (listed_large_cap, intl_us_individual, unlisted_pre_ipo) works because the holding is the position. Position concentration through MF look-through is reliable only for funds in the well-covered set; for funds outside coverage, the diagnostic surfaces aggregate fund-level exposure without claiming visibility into specific underlying stocks.

When the MVP encounters an archetype whose holdings are mostly outside MF coverage, the briefing surfaces what it can (wrapper, asset-class, count-based observations) and does not fabricate stock-level claims. This is the constraint, not a workaround.

## Investor Framework (Lean)

This section presents the five archetypes the MVP runs against in the demo. Each archetype is a recognisable person with structural circumstances and a current portfolio that produces interesting diagnostic results when compared to the model portfolio in Section 2. The mix spans diagnostic range: one is broadly aligned to the model with subtle issues, two diverge meaningfully with large flags, one is in an extreme transitional state, and one is in a different risk-horizon cell entirely.

Each archetype carries: identity attributes, wealth profile, mandate and risk profile, behavioural and contextual attributes, and a current portfolio snapshot with specific holdings. I0 enrichment fields (life_stage, liquidity_tier) are computed from the archetype's stated age, risk_appetite, and time_horizon per the heuristics in the broader framework.

### Archetype 1: Dr. Vikram and Dr. Shruti Malhotra

**Identity.** Dual-professional dermatology and cardiothoracic surgery household, 47 and 44 years old, based in Gurgaon DLF Phase 4. Two children (12 and 9), both at DPS RK Puram. Punjabi-Hindu, second-generation urban, financially literate. Self-occupied home Rs 5.8 Cr (no loan), rental property Rs 2.7 Cr. Joint household tax structure (individual filers).

**Wealth profile.** Liquid net worth Rs 11.85 Cr. Combined practice income Rs 5.6 Cr per year (Vikram Rs 3.2 Cr, Shruti Rs 2.4 Cr). Annual practice bonus Rs 80 L to Rs 1.2 Cr range. Children's education corpus is a structured priority: target Rs 4 Cr by 2036.

**Mandate and risk profile.** Stated risk appetite: aggressive. Time horizon: over 5 years (12-15 years operational to peak retirement, 25+ years stewardship). I0 enrichment: life_stage = accumulation (high confidence), liquidity_tier = essential (5-15%).

**Behavioural and contextual attributes.** Vikram is the primary financial decision-maker; Shruti is informed and consenting. Twelve-year SIP discipline across four funds maintained through 2018-19 corrections, 2020 COVID dip, 2022 drawdown. During COVID Vikram increased SIPs rather than withdrawing. Responsive to analytical framing. Sophistication-curious (peer cardiologist with PMS exposure influences exploration) but not yet sophistication-committed. Key concerns: education corpus protection, peak accumulation trajectory.

**Current portfolio snapshot.**

| Asset Class | Sub-Category | Instrument | Value (Rs Cr) | Weight |
|---|---|---|---|---|
| Equity | mf_active_large_cap | Mirae Asset Large Cap Fund | 1.85 | 15.6% |
| Equity | mf_active_large_cap | Axis Bluechip Fund | 1.40 | 11.8% |
| Equity | mf_active_flexi_cap | Parag Parikh Flexi Cap Fund | 1.68 | 14.2% |
| Equity | mf_active_mid_cap | Kotak Emerging Equity Fund | 1.25 | 10.5% |
| Debt | tax_free_bond | NHAI Tax-Free Bonds 2032 | 2.15 | 18.1% |
| Debt | tax_free_bond | PFC Tax-Free Bonds 2031 | 0.97 | 8.2% |
| Debt | bank_fd | HDFC Bank FD | 1.55 | 13.1% |
| Alternatives | physical_gold | Physical gold | 1.00 | 8.4% |

Aggregate: equity 52.2%, debt 39.4%, alternatives 8.4%, cash 0%. The portfolio is broadly disciplined but materially under-allocated to equity relative to the model portfolio's 65% target. No PMS, no AIF, no international exposure. This is a textbook "well-managed but conservative-by-revealed-pattern" portfolio that diagnostics surface as mandate-consistent in spirit but allocation-drift on the equity sleeve.

### Archetype 2: Mrs. Lalitha Iyengar

**Identity.** 67-year-old widow, 18 months since the death of her husband (a senior Apollo Hospital Chennai consultant who built the family wealth). Lives alone in self-occupied Chennai home. One son (38), software engineer in Singapore, supportive but operationally distant. B.A. Literature (1978), no formal financial training; lived as homemaker for 42 years. Tamil-Brahmin, individual tax filer.

**Wealth profile.** Liquid net worth Rs 3.41 Cr (excluding self-occupied home and Rs 80 L rental property in Adyar). Family pension Rs 72,000 per month. Monthly outflows run marginally negative before investment income.

**Mandate and risk profile.** Stated risk appetite: conservative. Time horizon: 3 to 5 years operational (medical trajectory uncertain), perpetual stewardship beyond. I0 enrichment: life_stage = distribution (high confidence), liquidity_tier = secondary (15-30%).

**Behavioural and contextual attributes.** Trust-based advisory relationship with Priya Nair. Reactive engagement pattern; defers most active decisions. Has never proposed a new product type. Revealed pattern more conservative than stated: in 2022 drawdown she requested partial withdrawal of Rs 30 L from equity MFs, locking in approximately Rs 4 L of realised loss. Inheritance corpus emotional context: the MFs were built by her late husband and she has never modified them. Key concerns: medical contingency, son's distance versus stated independence.

**Current portfolio snapshot.**

| Asset Class | Sub-Category | Instrument | Value (Rs Cr) | Weight |
|---|---|---|---|---|
| Debt | bank_fd | HDFC Bank FD | 0.93 | 27.3% |
| Debt | bank_fd | SBI FD | 0.92 | 27.0% |
| Debt | mf_corporate_debt | Franklin India Corporate Debt Fund | 0.35 | 10.3% |
| Equity | mf_active_large_cap | Axis Bluechip Fund | 0.40 | 11.7% |
| Equity | mf_passive_index | HDFC Index Fund Nifty 50 | 0.48 | 14.1% |
| Equity | mf_hybrid_dynamic_aa | ICICI Pru Balanced Advantage Fund | 0.33 | 9.7% |

Aggregate: debt 64.5%, equity 35.5%, alternatives 0%, cash 0%. Portfolio is appropriately conservative for her stated profile and life stage. Diagnostic interest: liquidity profile against medical contingency, FD maturity laddering, and whether the inherited equity MF positions should be touched at all given emotional weight. When compared to the aggressive_long_term model portfolio in Section 2, the briefing surfaces the divergence as informational rather than as drift (she is a conservative-distribution investor and the comparison is intentionally indirect).

### Archetype 3: Shailesh Bhatt

**Identity.** 52-year-old second-generation textile exporter based in Ahmedabad. Runs the family business founded by his father in 1978; personal share Rs 48 Cr. Wife Bhavna (49), English teacher. Two daughters: Aanchal (24, IIM Bangalore MBA finance, recently surfaced as analytical catalyst) and Ritika (19, NID Ahmedabad fashion design). Gujarati-Jain, partnership-firm tax structures plus individual filing.

**Wealth profile.** Personal liquid wealth Rs 22.10 Cr (separate from business equity). Self-occupied home Rs 9 Cr (ancestral), second property near Gandhinagar Rs 4 Cr.

**Mandate and risk profile.** Stated risk appetite: aggressive (verbally). Mandate-set risk appetite: moderate-aggressive (closer to moderate by revealed pattern). Time horizon: over 5 years (12-15 years to handover/retirement, perpetual stewardship beyond). I0 enrichment: life_stage = transition (high confidence; age 52, long horizon), liquidity_tier = essential (5-15%).

**Behavioural and contextual attributes.** Classic Ahmedabad business-family accumulation pattern: relationships drive product additions. Four PMS schemes added over six years through different RM relationships, none benchmarked against each other or against alternatives. One Cat III long-short fund (2018 vintage) acquired similarly, never benchmarked. Stated aggressive, revealed moderate. Daughter Aanchal returned home in December 2025 and produced a structured analysis flagging the under-differentiated PMS stack, undifferentiated performance, fee aggregation, and Cat III complexity premium not earned. Aanchal is now an observer-with-influence; Shailesh consults her on advisor decisions. Cleanup inflection point active.

**Current portfolio snapshot.**

| Asset Class | Sub-Category | Instrument | Value (Rs Cr) | Weight |
|---|---|---|---|---|
| Equity | pms_concentrated_quality | Marcellus Consistent Compounder PMS | 2.50 | 11.3% |
| Equity | pms_growth_quality | White Oak India Pioneers PMS | 2.20 | 10.0% |
| Equity | pms_value | Motilal Oswal Value Strategy PMS | 2.10 | 9.5% |
| Equity | pms_focused_midcap | Alchemy Smart Alpha 250 PMS | 1.90 | 8.6% |
| Equity | listed_large_cap | Reliance Industries | 2.70 | 12.2% |
| Equity | listed_large_cap | HDFC Bank | 2.50 | 11.3% |
| Equity | listed_large_cap | ITC Limited | 1.10 | 5.0% |
| Equity | mf_active_large_cap | Mirae Asset Large Cap Fund | 0.50 | 2.3% |
| Equity | mf_active_flexi_cap | Parag Parikh Flexi Cap Fund | 0.45 | 2.0% |
| Alternatives | aif_cat_iii_long_short | Avendus Absolute Return Fund | 3.00 | 13.6% |
| Debt | bank_fd | HDFC Bank FD | 1.55 | 7.0% |
| Debt | mf_arbitrage | Aditya Birla Arbitrage Fund | 1.60 | 7.2% |

Aggregate: equity 72.2%, debt 14.3%, alternatives 13.6%, cash 0%. Diagnostic interest is rich: wrapper over-accumulation (four PMS strategies, threshold breach), complexity premium not earned (Cat III at 8.2% CAGR over seven years), stated-revealed divergence, sector concentration through PMS look-through, and fee inefficiency. The cleanup arc is the live narrative.

### Archetype 4: Arjun Menon

**Identity.** 38-year-old recently returned UAE founder. Sold Dubai IT services firm in November 2025 to a Bengaluru mid-cap listed IT company for USD 6.8M. Indian remittance net of cross-border tax optimisation: Rs 52 Cr. Currently renting in Indiranagar; intent to purchase 4BHK in Sadashivanagar within 12 months (Rs 12-14 Cr range). Unmarried, partner Priya (UX designer) relocating from Dubai by Q3 2026. Malayali Christian, second-generation business family. Tax structure: individual, transitioning from RNOR to resident in FY 2026-27.

**Wealth profile.** Total liquid AUM Rs 60.65 Cr (Rs 52 Cr fresh liquidity, Rs 4.15 Cr NRE deposits in transit, Rs 4 Cr US brokerage legacy holding). Excludes Rs 8 Cr Kochi ancestral property (jointly held, not saleable without family consent). Parents in Kochi supported informally at Rs 30,000/month; Rs 50 L dedicated parents-care fund planned (separate consideration).

**Mandate and risk profile.** Stated risk appetite: aggressive. Time horizon: over 5 years (6-9 years operational, multi-decade stewardship). I0 enrichment: life_stage = accumulation (high confidence; age 38), liquidity_tier = essential (5-15%) by mandate, but actual portfolio sits at deep due to acute under-deployment.

**Behavioural and contextual attributes.** High deployment readiness; chafes at slow processes. Analytically engaged, tax-aware above median (optimised UAE-US-India sale routing himself). Comfort with complexity (understands Cat II AIF structures from Dubai exposure). US brokerage holding pattern shows eight years of disciplined behaviour with no panic selling. Speed preference is real; advisors must calibrate against it. Key concerns: NRE-to-resident conversion mechanics blocking some decisions; Rs 12-14 Cr property purchase reserve within 12 months; future angel investing interest (deferred to post-deployment review).

**Current portfolio snapshot.**

| Asset Class | Sub-Category | Instrument | Value (Rs Cr) | Weight |
|---|---|---|---|---|
| Cash | savings | Bank savings account | 52.50 | 86.6% |
| Debt | bank_fd | HDFC Bank FD | 4.15 | 6.8% |
| Equity | intl_us_individual | US listed equities (legacy holding) | 4.00 | 6.6% |

Aggregate: cash 86.6%, debt 6.8%, equity 6.6%, alternatives 0%. This is the extreme transitional state. The portfolio represents post-exit liquidity awaiting deployment, with the NRE-resident conversion mechanically constraining some moves. Diagnostic interest is acute cash drag (eighty-plus percentage points above the deployment efficiency floor for an aggressive long-term investor) and the question of how to stage deployment given the property purchase earmark, the parents-care reserve, and the conversion timing.

### Archetype 5: Rajiv Surana

**Identity.** 44-year-old co-founder and CEO of a B2B SaaS company (founded 2015) that closed Series D at USD 240M post-money in October 2025. Owns 26% of the company; paper value Rs 165 Cr at last round. Took Rs 14 Cr cash in secondary during the Series D. Wife Nandini (42), non-profit education NGO director. Two children (15 and 12, both at Cathedral and John Connon School). Mumbai (Bandra West), self-owned home Rs 7.2 Cr (no loan). Marwari (Rajasthani diaspora), first-generation tech entrepreneur.

**Wealth profile.** Personal liquid wealth Rs 34.5 Cr (excluding the Rs 165 Cr private company stake, which is outside advisory scope). Education corpus structured: target Rs 8 Cr by 2032.

**Mandate and risk profile.** Stated risk appetite: aggressive. Time horizon: over 5 years (8-10 years operational to company exit or scale plateau, 25+ years stewardship). I0 enrichment: life_stage = accumulation (high confidence; age 44), liquidity_tier = essential (5-15%).

**Behavioural and contextual attributes.** Sophisticated, analytical, monitoring-driven, fee-conscious. Fee-only advised by preference; does not engage with banker-RM relationships. Maintains a personal spreadsheet tracking each MF's performance versus benchmark across multiple horizons. Has held one focused mid-cap PMS for four years with disciplined evaluation including a manager-continuity assessment when the lead PM left in 2022. Uses GIFT city for international (Rs 3 Cr in VOO ETF). Angel portfolio of 23 investments tracked with IRR discipline. Sustained 15-year SIP discipline, COVID-dip-buy with measured topups. Key concerns: concentrated company-equity stake versus liquid corpus diversification, education corpus protection, post-company-exit corpus reframe anticipated 4-7 years out.

**Current portfolio snapshot (advisory scope only; excludes Rs 165 Cr company stake).**

| Asset Class | Sub-Category | Instrument | Value (Rs Cr) | Weight (Total)* |
|---|---|---|---|---|
| Equity | unlisted_pre_ipo | B2B SaaS Pvt Ltd founder shares | 165.00 | n/a (excluded) |
| Equity | mf_active_flexi_cap | Parag Parikh Flexi Cap Fund | 4.00 | 11.6% |
| Equity | mf_active_large_cap | Axis Bluechip Fund | 3.80 | 11.0% |
| Equity | mf_active_large_cap | Mirae Asset Large Cap Fund | 3.00 | 8.7% |
| Equity | mf_active_mid_cap | Kotak Emerging Equity Fund | 3.00 | 8.7% |
| Equity | mf_active_small_cap | SBI Small Cap Fund | 2.20 | 6.4% |
| Equity | pms_growth_quality | White Oak India Pioneers PMS | 3.00 | 8.7% |
| Equity | listed_large_cap | Reliance Industries | 7.00 | 20.3% |
| Equity | listed_large_cap | HDFC Bank | 2.00 | 5.8% |
| Equity | intl_us_etf | Vanguard S&P 500 ETF (GIFT) | 3.00 | 8.7% |
| Alternatives | physical_gold | Physical gold | 2.00 | 5.8% |
| Cash | savings | Bank savings | 1.50 | 4.3% |

*Weights are computed against the Rs 34.5 Cr advisory-scope liquid corpus, excluding the Rs 165 Cr private company stake.

Aggregate (advisory scope): equity 89.9%, alternatives 5.8%, cash 4.3%, debt 0%. Diagnostic interest: position concentration in Reliance (20.3% of advisory-scope liquid corpus, breaching the position threshold), zero debt allocation in a high-volatility portfolio, and the larger meta-question of how to think about diversification when the dominant wealth driver is the private company equity outside advisory scope. This is a portfolio designed by a sophisticated owner who has thought about it carefully; the diagnostic surfaces tensions rather than mistakes.

### Appendix to Section 4: Sample Onboarding Chat Transcripts

These transcripts show how an archetype would have been built through the conversational onboarding flow described in the broader framework. They are decorative content for the wireframe; the MVP does not run live onboarding. Each transcript is approximately 10 turns and ends with an enriched investor profile.

#### Transcript A: Onboarding the Malhotras

> **Advisor:** Hi, I want to onboard a new client.
>
> **Samriddhi:** Happy to help. Who is the client?
>
> **Advisor:** Dr. Vikram Malhotra. He and his wife Dr. Shruti are a dual-professional household, both doctors. They're long-time clients of my colleague Amit but they want their own household profile.
>
> **Samriddhi:** Got it. Let me set up an investor record for Vikram first; we can link Shruti as a joint household member. Vikram's email and phone?
>
> **Advisor:** vikram.malhotra@gmail.com, +91 98100 12345. PAN AAAPM1234B.
>
> **Samriddhi:** Recorded. Age?
>
> **Advisor:** 47.
>
> **Samriddhi:** Investment profile next. How would you describe his risk appetite: conservative, moderate, or aggressive?
>
> **Advisor:** Aggressive. He's been disciplined about it for 12 years. Bought the dip in 2020.
>
> **Samriddhi:** Good context. And time horizon: under 3 years, 3 to 5 years, or over 5 years?
>
> **Advisor:** Over 5. They're targeting reduced practice load by mid-50s. Operational horizon 12-15 years, stewardship 25+.
>
> **Samriddhi:** Recorded. Based on this, I've classified Vikram as: life stage = accumulation (high confidence), liquidity tier = essential (5-15%). The aggressive long-term model portfolio cell applies. Anything else for the profile?
>
> **Advisor:** Yes. Note that they have a structured education corpus priority: Rs 4 Cr by 2036 for the two kids. Currently Rs 1.2 Cr.
>
> **Samriddhi:** Noted as a structured goal on the profile. I'll create Vikram now and queue Shruti as the second household member. Confirm to proceed?
>
> **Advisor:** Confirm.
>
> **Samriddhi:** Investor record created. ULID 01J9N6F7GZ3M8K2NQRBTYWVXA1. Profile is ready to view. Shall I start Shruti's record?

#### Transcript B: Onboarding Arjun Menon

> **Advisor:** Need to onboard a new client. Recent UAE return, significant liquidity.
>
> **Samriddhi:** Happy to help. Who is the client?
>
> **Advisor:** Arjun Menon. Sold his Dubai IT services firm in November; Rs 52 Cr Indian remittance net of tax optimisation. Plus Rs 4 Cr in NRE and Rs 4 Cr in legacy US brokerage. Total liquid Rs 60 Cr.
>
> **Samriddhi:** Significant. Email, phone, PAN?
>
> **Advisor:** arjun.menon@gmail.com, +91 98860 12345. PAN ABCPM5678C.
>
> **Samriddhi:** Age?
>
> **Advisor:** 38. Unmarried, partner relocating from Dubai later this year. Important context: he's in RNOR status for FY 2025-26, transitioning to resident in FY 2026-27. NRE-to-resident conversion is in progress.
>
> **Samriddhi:** Noted. Tax-status transition flagged on the profile. Risk appetite?
>
> **Advisor:** Aggressive. He's articulate about it. Built a business, comfortable with drawdown.
>
> **Samriddhi:** Horizon?
>
> **Advisor:** Over 5 years. Operational 6-9, stewardship multi-decade.
>
> **Samriddhi:** Based on this: life stage = accumulation (high confidence), liquidity tier = essential (5-15%). One thing to flag: the current portfolio is in transitional state with Rs 52 Cr in cash awaiting deployment, which will read as deep liquidity until deployment proceeds. The diagnostic will likely surface cash drag on the first case. Want me to note that on the profile?
>
> **Advisor:** Yes, note it. Also note Rs 12-14 Cr property purchase reserve within 12 months and Rs 50 L parents-care fund planned.
>
> **Samriddhi:** Both noted as structural reserves on the profile. Confirm to create?
>
> **Advisor:** Confirm.
>
> **Samriddhi:** Investor record created. ULID 01J9N6F8KZ4N9L3PRSCUZWVYB2. The transitional-state note is visible to all advisors viewing the profile.

## Briefing Output Spec

The briefing is the 1-2 page PDF the advisor takes into the meeting. It is the primary user-facing artifact of the MVP. The on-platform case view is the verbose audit surface; the briefing is the curated talking-points document.

### Structure

The briefing has seven sections in this order. Each section has a fixed role; the analytical voice and density are calibrated to talking-points use, not to comprehensive reporting.

**1. Headline Observations.** Three to five bullet observations capturing what the advisor needs to walk into the meeting knowing. Each observation references a named diagnostic vocabulary item from Section 3 (e.g., "wrapper over-accumulation: four PMS strategies, aggregate 39% of equity sleeve"). The voice is declarative and specific; no hedging language. This section earns the right to be 1-2 pages by being ruthlessly compressed.

**2. Portfolio Overview.** A single table summarising the portfolio at the asset class level: actual share, model portfolio target, deviation. Includes a one-line total AUM and a one-line liquidity tier summary (actual T+30 plus T+90 share against the investor's tier floor). No commentary; the table speaks.

**3. Concentration Analysis.** A focused look at the three concentration constructs: position, sector, wrapper. Surfaces any breaches of the thresholds from Section 3. For each breach, identifies the holding(s) involved and the threshold context. If no concentration issues, this section is a single line: "no concentration breaches surfaced."

**4. Risk Flags.** A bullet list of named diagnostic observations from Section 3 that the case surfaced beyond concentration. Each bullet is one sentence stating the observation; one sentence of explanatory context where needed. Categories: liquidity, mandate drift, behavioural, fee, deployment.

**5. Comparison versus Model Portfolio.** A second table or focused prose paragraph showing how the portfolio compares to the aggressive_long_term indicative model from Section 2. For aggressive long-term investors, this is the direct comparison. For investors in other cells (Lalitha, for instance), this section reframes the comparison as informational, noting which deviations are appropriate to the investor's profile and which are not.

**6. Suggested Talking Points.** Three to four advisor-facing prompts for the meeting. These are not recommendations; they are conversation openers ("the wrapper over-accumulation may be worth raising; the daughter's analysis is the natural entry"). The voice is collegial; the briefing assumes a sophisticated advisor.

**7. Evidence Appendix.** A condensed reference table listing the holdings the diagnostic analysed, with weights. Used by the advisor for in-meeting lookup if a specific holding is questioned. Not the full holdings detail (which is in the case view); just the holdings that drove observations in sections 1, 3, and 4.

### Analytical Voice

The briefing voice is observational, not prescriptive. The advisor is the decision-maker; the briefing is the analytical preparation. The voice avoids: hedging ("may be," "could potentially"), advisory framing ("we recommend," "you should consider"), and emotional language. The voice uses: declarative observation, threshold context, evidence reference.

The voice respects the advisor's expertise. The briefing does not explain what concentration means; it states the concentration observation and lets the advisor judge materiality.

### Density and Length

The briefing fits 1-2 A4 pages at a readable density. Headline observations, portfolio overview, and risk flags occupy the first page. Concentration analysis, comparison versus model, talking points, and evidence appendix occupy the second page (when needed). Many briefings will fit on one page; complex portfolios spill to two.

The PDF generation uses the conventions in the broader Samriddhi typography and layout system. Headings, tables, and bullets follow the existing PDF builder pattern.

### What the Briefing Does Not Contain

The briefing does not contain: recommendations or proposed actions, return projections or scenario analyses, real-time market commentary, live news feeds, mandate-compliance verdicts, or governance approvals. Those capabilities exist in the broader Samriddhi vision under different surfaces; the briefing is a diagnostic talking-points document only.

## Explicitly Out of Scope

The following capabilities exist in the broader Samriddhi vision but are explicitly out of scope for the Lean Samriddhi MVP. They are listed here to protect against scope creep during design and build.

**Recommendation generation.** The MVP is diagnostic-only. It does not propose actions, suggest specific instruments, or generate proposed_action cases. The briefing surfaces observations and talking points, not recommendations.

**Multi-agent orchestration visible to the user.** The broader Samriddhi architecture has an evidence agent layer (E1 through E7), an instrument committee (IC1), a synthesis layer (S1), and adversarial review (A1). The MVP's diagnostic produces its output through whatever internal mechanics are convenient; no agent identities, agent debates, or orchestration steps are surfaced to the user.

**Live market data consumption.** No real-time market feeds, no live NAV updates, no breaking news. The MVP operates on the static snapshot of holdings and the indicative model portfolio.

**Mandate drift alerts and notifications.** No proactive monitoring, no advisor briefing notifications, no alert generation. The MVP is reactive: the advisor opens a case, the system produces a briefing.

**Investor onboarding as a functional flow.** Investor profiles are pre-seeded for the demo (per Section 4). The MVP does not include the conversational onboarding chatbot, the form-based onboarding UI, or KYC integration as functional flows. The transcripts in the appendix to Section 4 are decorative wireframe content.

**Multi-investor case orchestration.** Each case operates on a single investor. There is no household-level rollup, no portfolio aggregation across investors, no inter-investor comparison.

**Holdings ingestion and reconciliation.** The MVP works with pre-loaded holdings (per Section 4's archetype snapshots). No custodian sync, no holding-level reconciliation, no daily NAV refresh.

**Full mutual fund portfolio X-ray.** The MVP operates on top-5 stock and top-5 sector data where available, covering approximately 220 of 1,773 funds at the stock level. Complete holdings-level analysis across the full MF universe requires AMFI monthly portfolio disclosure ingestion and a fund-holdings refresh pipeline. Cross-fund stock-level overlap detection, full sector exposure roll-up through MF look-through, and true portfolio X-ray across the entire fund universe are out of scope for the MVP. Diagnostic observations operate at wrapper, sub-category, and asset-class level where look-through is unavailable.

**Multi-approver governance flows.** No CIO approval workflows, no compliance gates, no escalation chains. The case produces a briefing; the advisor uses it.

**Audit replay and snapshot machinery beyond what the case view requires.** The case view shows the data the diagnostic operated on; replay capabilities, snapshot diffing, and historical reconstruction are out of scope.

**Model portfolio customisation by the firm.** The MVP ships with the single indicative model portfolio in Section 2. CIO editing surfaces, tag editing, preferred portfolio curation, and the broader two-layer architecture are out of scope.

**Cross-investor pattern recognition.** No I0 dormant layer, no pattern library, no cross-investor behavioural analysis.

**Production-grade telemetry, observability, or operational monitoring.** Minimum logging sufficient for demo debugging; no T1 telemetry, no audit log surfaces, no operational dashboards.

**Mobile or responsive client surfaces.** Desktop browser only.

**Multi-tenancy, role-based access control beyond demo defaults, or per-firm configuration.** Single deployment, single advisor role, default configuration only.
