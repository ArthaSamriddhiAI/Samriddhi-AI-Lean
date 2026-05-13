# Proposed Investor Profiles for Review

The six investor profiles the Lean Samriddhi MVP will seed against. Five are lifted verbatim from Section 4 of the [foundation document](foundation/foundation.md); one (Sharma family) is authored from the local `sharma_marcellus_evidence_verdicts.md` file plus wireframe references, with all authored elements explicitly flagged.

This artifact is the review gate before any of this content lands in the seed script. After approval, the profile content goes into the `Investor.profile_md` column on the Investor table; the structured fields (slug, name, risk, horizon, AUM, etc.) populate adjacent columns; the onboarding transcripts (for Malhotra and Menon) live as the `Investor.onboarding_transcript` nullable column.

## Source provenance

| Archetype | Slug | Source | Authored content |
|---|---|---|---|
| A1 Malhotra | `malhotra` | Foundation doc Section 4.1 + Appendix Transcript A | None; verbatim. |
| A2 Iyengar | `iyengar` | Foundation doc Section 4.2 | None; verbatim. |
| A3 Bhatt | `bhatt` | Foundation doc Section 4.3 | None; verbatim. |
| A4 Menon | `menon` | Foundation doc Section 4.4 + Appendix Transcript B | None; verbatim. |
| A5 Surana | `surana` | Foundation doc Section 4.5 | None; verbatim. |
| A6 Sharma | `sharma` | `sharma_marcellus_evidence_verdicts.md` + wireframe references + foundation doc taxonomy | Household biography, specific instrument names, neighbourhood. Authored elements flagged inline. |

## Wireframe display field crosswalk

The `InvestorList` component in `screen4_investors.jsx` expects these fields per row. Each profile below has the values that map to those fields; this section is the consolidated reference.

| Slug | Display name | Initials | Meta | Structure | Risk | Horizon | AUM (Rs Cr) | Tier |
|---|---|---|---|---|---|---|---|---|
| `malhotra` | Dr. Vikram & Dr. Shruti Malhotra | VM | 47 / 44 · Gurgaon DLF Ph 4 · joint household, 2 children | Dual-professional · dermatology + cardiothoracic | Aggressive | Over 5y | 11.85 | Essential |
| `iyengar` | Mrs. Lalitha Iyengar | LI | 67 · Chennai · widow, 18 months | Distribution · inherited corpus | Conservative | 3-5y operational | 3.41 | Secondary |
| `bhatt` | Shailesh Bhatt | SB | 52 · Ahmedabad · textile exporter, 2nd gen | Family business · partnership firm | Aggressive · stated | Over 5y | 22.10 | Essential |
| `menon` | Arjun Menon | AM | 38 · Bengaluru · recent UAE return | Founder exit · NRE → resident | Aggressive | Over 5y | 60.65 | Essential (deep, transitional) |
| `surana` | Rajiv Surana | RS | 44 · Mumbai Bandra W · 2 children | Tech founder · Series D | Aggressive | Over 5y | 34.50 | Essential |
| `sharma` | Sharma family | SF | 56 · Mumbai · 2nd-gen manufacturing | Family business · individual filer | Aggressive · stated | Over 5y | 18.00 | Essential |

The `cases` and `lastFinding` fields are computed at render time from the case table; they are not stored on the investor record.

---

## A1: Dr. Vikram and Dr. Shruti Malhotra (slug `malhotra`)

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

**Onboarding transcript (Transcript A from the foundation document appendix).**

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

---

## A2: Mrs. Lalitha Iyengar (slug `iyengar`)

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

---

## A3: Shailesh Bhatt (slug `bhatt`)

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

---

## A4: Arjun Menon (slug `menon`)

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

**Onboarding transcript (Transcript B from the foundation document appendix).**

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

---

## A5: Rajiv Surana (slug `surana`)

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

---

## A6: Sharma family (slug `sharma`)

> **Authored from limited input.** The verdicts file `sharma_marcellus_evidence_verdicts.md` and the wireframe (case list row plus S1 New Case form mockup) carry the known facts: age 56, Mumbai, manufacturing, HNI, individual filer, liquid AUM Rs 18 Cr, equity 55%, FD position Rs 5.4 Cr, one existing growth-quality PMS at 8% of corpus (added 2023), one Cat II private credit AIF added 2024, sophistication accumulated via peer network, FDs treated as inert reserve. All other identity, household biography, and specific instrument names are **authored** to match the foundation document's archetype convention. Authored elements are flagged inline with **[authored]**.

**Identity.** 56-year-old second-generation industrialist based in Mumbai western suburbs **[authored: Powai]**. Runs the family-owned specialty chemicals and engineering plastics business **[authored: business description; the verdicts file says "manufacturing sector business owner" only]** founded by his father in 1978; the business is privately held with annual revenue around Rs 180 Cr **[authored: revenue figure]**. Wife **[authored: Geeta Sharma]** (53), homemaker active in community trust work **[authored]**. Two adult children **[authored]**: son (28, MBA from FMS Delhi, now joined the family business in operations) **[authored]**; daughter (24, completing post-graduation in pharmaceutical sciences at Mumbai University) **[authored]**. Marwari Hindu, individual tax filer (despite the household being colloquially referred to as the "Sharma family" by the advisor's office, the structure is individual for tax purposes per the case verdict's E6 gate finding).

**Wealth profile.** Advisory-scope liquid wealth Rs 18.00 Cr. The operating business equity sits outside advisory scope **[authored: estimated Rs 40-60 Cr based on revenue band, treated as unlisted_family_business outside advisory per foundation §3]**. Annual business dividend distribution covers household consumption comfortably **[authored]**.

**Mandate and risk profile.** Stated risk appetite: aggressive. Time horizon: over 5 years. Mandate equity band 50-70%, current equity allocation 55%. I0 enrichment: life_stage = transition (high confidence; age 56, succession planning underway with the son's recent business entry), liquidity_tier = essential (5-15%).

**Behavioural and contextual attributes.** The father is the principal financial decision-maker (per the verdicts file's E4 finding). Sophistication-tier additions to the portfolio have been peer-network-influenced rather than driven by structured portfolio-architecture conversations: the existing growth-quality PMS was added in 2023 after two industry-association peers (manufacturers' federation members) mentioned their own PMS holdings; the Cat II private credit AIF was added in 2024 through a similar referral path. Treats fixed deposits as a near-static reserve rather than an active asset class (the Rs 5.4 Cr FD block has been held flat across three reset cycles per the verdicts file's E4 finding). Has not raised mid-cycle review or exit framing in the last six advisor interactions. Comfortable with PMS lock-in structure and the minimum-ticket threshold. **Key concerns**: continuing the wrapper accumulation pattern without deliberate architecture, the structural question of how the operating-business equity outside advisory scope should inform the liquid-corpus risk envelope, and the eventual handover trajectory (the son joining operations is a recent development).

**Current portfolio snapshot.**

| Asset Class | Sub-Category | Instrument | Value (Rs Cr) | Weight |
|---|---|---|---|---|
| Equity | mf_active_large_cap | Mirae Asset Large Cap Fund **[authored: specific MF; verdicts file says "3 actively managed MF holdings"]** | 3.20 | 17.8% |
| Equity | mf_active_flexi_cap | Parag Parikh Flexi Cap Fund **[authored]** | 3.00 | 16.7% |
| Equity | mf_active_mid_cap | Kotak Emerging Equity Fund **[authored]** | 2.26 | 12.6% |
| Equity | pms_growth_quality | White Oak India Pioneers PMS **[authored: specific PMS; verdicts says "growth-quality PMS, 8% of corpus, added 2023"]** | 1.44 | 8.0% |
| Debt | bank_fd | HDFC Bank FD | 2.80 | 15.6% |
| Debt | bank_fd | SBI FD | 2.60 | 14.4% |
| Alternatives | aif_cat_ii_private_credit | Cat II private credit AIF (2024 vintage) **[authored: specific fund name omitted; verdicts says "Cat II private credit AIF added 2024"]** | 1.80 | 10.0% |
| Cash | savings | Bank savings | 0.90 | 5.0% |

Aggregate: equity 55.1%, debt 30.0%, alternatives 10.0%, cash 5.0% (rounding). The portfolio sits at the lower half of the mandate equity band (50-70%) with a single PMS, three MF positions, and one Cat II AIF. Diagnostic interest is **less acute** than for Bhatt or Surana, but still substantive: the wrapper accumulation pattern (1 PMS + 1 AIF) is set to escalate if the Marcellus proposal proceeds (moves to 2 PMS strategies plus 1 AIF), and the FDs at 30% sit above the model's debt target (25%) reflecting the family's inert-reserve treatment. The Sharma family is the demonstration archetype for the **proposal evaluation (Samriddhi 1)** workflow because the case file `sharma_marcellus_evidence_verdicts.md` is keyed to this household, and the case list's flagship S1 row in the wireframe is the Marcellus PMS proposal for this family.

---

## Notes for review

1. **The five A1-A5 profiles are lifted verbatim from `foundation/foundation.md` Section 4.** No edits applied. If the foundation document is updated, the seed script re-syncs from there; this artifact is a snapshot of what the seed will hold at first run.

2. **The Sharma profile is authored.** Every authored element is flagged with **[authored]** so you can scan for what to keep, change, or remove. The strongest source for Sharma is the verdicts file, which is rich on behavioural attributes and sparse on identity. The most consequential authored choices:
   - **Specific MF and PMS holdings:** picked to align with the foundation document's named fund universe and the Marcellus-evaluation case's analytical premises (e.g., the existing growth-quality PMS being White Oak makes the Marcellus proposal a non-trivial wrapper-architecture decision rather than a duplication of an existing PMS, which would change the case's substance).
   - **Business description (specialty chemicals and engineering plastics, Mumbai, founded 1978):** plausible-sounding but invented. If the user wants a different industry within manufacturing, the holdings and case narrative do not change.
   - **Household biography (wife, two adult children, Marwari Hindu, Powai):** invented per the foundation document's archetype convention. Substitutable.
   - **Operating-business value Rs 40-60 Cr (outside advisory scope):** invented from the HNI bracket and the revenue band. Used only as context for the structural-concentration framing.

3. **Slug strings are stable.** `malhotra`, `iyengar`, `bhatt`, `menon`, `surana`, `sharma`. These become the `Investor.id` primary key. Changing them later is a migration; consider them locked once approved.

4. **Foundation document edits, if any, ripple to the seed.** If you want a profile change, edit `foundation/foundation.md` first and then re-sync this artifact (or, for Sharma, edit this artifact directly since Sharma is not in the foundation doc).

5. **Once approved, this artifact informs the seed script** (`db/seed.ts`) when the scaffolding work begins. The seed script copies each profile's markdown block into `Investor.profile_md`, populates the structured fields (slug, name, AUM, etc.) from the crosswalk table above, and inserts the Malhotra and Menon onboarding transcripts into `Investor.onboarding_transcript`.

Awaiting review.
