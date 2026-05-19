#!/usr/bin/env python3
"""
enrich_snapshots.py, Lean Samriddhi MVP

Snapshot Data Enrichment. Phase B scope: enriches t0 only with monthly series
for stocks, indices, FX, plus Tier B per-instrument stats. Phase C will add
forward extension to t1..t8.

Inputs:
  - Baseline snapshot JSON (01_-_SamriddhiAI_data_clean.json or t0 snapshot)
  - sector_map.json for Nifty 500 sector classifications

Outputs:
  - Enriched snapshot JSON, same top-level structure plus:
    * nifty500.companies[].monthly_prices: dict {YYYY-MM: float}
    * nifty500.companies[].tier_b_stats: dict
    * indices: new top-level block
    * fx: new top-level block
    * mf_funds[].tier_b_stats: dict (recomputed off existing monthly_nav)
    * snapshot_metadata: provenance and synthesis parameters

Design principles (per Phase A audit):
  - File structure stays the same; enrichment is additive (new sub-fields and
    two new top-level blocks).
  - Hybrid stock synthesis: sector-baseline monthly returns + per-stock
    (beta_to_sector, idio_vol) parameters.
  - 84-month pre-t0 lookback (2019-05 through 2026-04).
  - Existing flat scalars on funds (Sharpe, Sortino, Beta, etc.) untouched;
    tier_b_stats sub-block carries snapshot-recomputed values in parallel.
  - All randomness deterministic per (instrument_seed, snapshot_seed).
"""

import json
import os
import math
import random
import argparse
from collections import defaultdict, OrderedDict
from datetime import date

# ============================================================================
# Constants
# ============================================================================

DEFAULT_SECTOR_MAP_PATH = '/home/claude/enrichment/sector_map.json'

# t0 anchoring
T0_DATE = '2026-04-02'         # baseline snapshot date
T0_MONTH = '2026-04'           # last month in pre-t0 history for stocks
LOOKBACK_MONTHS = 84           # 7 years pre-t0 history
LOOKBACK_START_MONTH = '2019-05'  # first month in pre-t0 history

# Snapshot sequence: snapshot_id -> (date, last_month_in_series, event_month_for_surgical_event)
# Each snapshot's monthly_nav extension adds 3 months ending at last_month
# Event months MUST fall within the 3-month extension window
SNAPSHOT_SEQUENCE = [
    ('t0_q2_2026', '2026-04-02', '2026-04', None, None),
    ('t1_q3_2026', '2026-07-01', '2026-07', None, None),
    ('t2_q4_2026', '2026-10-01', '2026-10', None, 'quiet_it_cool'),       # IT cool spread Aug-Oct
    ('t3_q1_2027', '2027-01-01', '2027-01', '2026-12', 'stress_rate_cut'), # Rate cut Dec 2026
    ('t4_q2_2027', '2027-04-01', '2027-04', None, None),
    ('t5_q3_2027', '2027-07-01', '2027-07', '2027-07', 'stress_bank_shock'),  # Bank shock Jul 2027
    ('t6_q4_2027', '2027-10-01', '2027-10', '2027-10', 'stress_ril_idio'),    # RIL idio Oct 2027
    ('t7_q1_2028', '2028-01-01', '2028-01', None, None),
    ('t8_q2_2028', '2028-04-01', '2028-04', '2028-03', 'quiet_smallcap_rally'),  # Smallcap peak Mar 2028
]


def get_snapshot_window(snapshot_id):
    """Return (start_month, end_month, event_month, event_type) for a snapshot."""
    for sid, sdate, last_month, event_month, event_type in SNAPSHOT_SEQUENCE:
        if sid == snapshot_id:
            return last_month, event_month, event_type
    return None, None, None


def months_in_quarter(prior_end_month, current_end_month):
    """Return the 3 months strictly between (prior_end, current_end], inclusive of current_end."""
    py, pm = int(prior_end_month[:4]), int(prior_end_month[5:7])
    cy, cm = int(current_end_month[:4]), int(current_end_month[5:7])
    out = []
    y, m = py, pm
    while True:
        m += 1
        if m > 12:
            m = 1
            y += 1
        out.append(f"{y:04d}-{m:02d}")
        if (y, m) >= (cy, cm):
            break
    return out


# Surgical event size table per (snapshot_id, instrument_category)
# These are AT-THE-MONTH magnitudes, not quarter-spread
SURGICAL_EVENT_DELTAS = {
    'stress_rate_cut': {
        # Applied in event_month (Feb 2027)
        'debt_gilt_long':     {'month_delta': 0.045},  # gilt funds re-rate up sharply on cut
        'debt_gilt_dynamic':  {'month_delta': 0.040},
        'debt_composite':     {'month_delta': 0.025},
        'debt_short_duration':{'month_delta': 0.020},
        'debt_liquid':        {'month_delta': 0.005},  # small effect on liquid
        # Stocks: no surgical (rate cut shows up in debt indices, not directly in stocks)
    },
    'stress_bank_shock': {
        # Applied in event_month (Jul 2027)
        'banks_private':      {'month_delta': -0.16},  # severe drawdown
        'banks_psu':          {'month_delta': -0.18},
        'nbfc_financials':    {'month_delta': -0.10},  # spillover
        'insurance':          {'month_delta': -0.05},
    },
    'stress_ril_idio': {
        # Applied in event_month (Oct 2027)
        '_stock_overrides': {'Reliance Industries': {'month_delta': -0.26}},
        'petroleum_refining': {'month_delta': -0.10},  # sector hit
        'oil_gas_upstream':   {'month_delta': -0.06},
        'city_gas_distribution': {'month_delta': -0.04},
    },
    'quiet_smallcap_rally': {
        # Spread across t8 quarter (Apr/May/Jun 2028) with May peak
        # Top-decile smallcap stocks get an extra boost
        '_cap_tier_boost': {'small': {'month_delta_apr': 0.03, 'month_delta_may': 0.07, 'month_delta_jun': 0.04}},
    },
    'quiet_it_cool': {
        # Spread across t2 quarter; IT softness
        'it_services':        {'quarter_drag': -0.04},
        'it_products':        {'quarter_drag': -0.03},
    },
}

# Risk-free rate (annualized) used for Sharpe/Sortino. Derived from repo at t0.
RISK_FREE_ANN = 0.0525

# Calibration safeguards
PRICE_FLOOR_FRAC = 0.05   # synthesized monthly price cannot fall below 5% of t0 cmp_rs ever
                          # (prevents pathological synthesis paths)

# ============================================================================
# Sector parameter library: annualized return drift, monthly volatility
# Derived from plausible Indian-market sector dynamics (2019-2026 window).
# ============================================================================

SECTOR_PARAMS = {
    # (annual_drift, monthly_vol)
    # Banks
    "banks_psu":                (0.10, 0.085),
    "banks_private":            (0.12, 0.060),
    "nbfc_financials":          (0.13, 0.075),
    "insurance":                (0.11, 0.055),
    "amc_brokerage":            (0.14, 0.085),
    # IT/Telecom
    "it_services":              (0.13, 0.065),
    "it_products":              (0.11, 0.085),
    "telecom":                  (0.10, 0.075),
    # Energy/Resources
    "petroleum_refining":       (0.07, 0.075),
    "oil_gas_upstream":         (0.05, 0.085),
    "city_gas_distribution":    (0.09, 0.060),
    "power_generation_thermal": (0.09, 0.070),
    "power_generation_renewable": (0.18, 0.110),
    "power_transmission":       (0.11, 0.055),
    "coal_mining":              (0.06, 0.085),
    # Auto
    "auto_oem_passenger":       (0.09, 0.080),
    "auto_oem_commercial":      (0.08, 0.085),
    "auto_oem_two_wheeler":     (0.11, 0.075),
    "auto_ancillary":           (0.12, 0.080),
    "tyres":                    (0.08, 0.075),
    # Pharma/Health
    "pharma_generic":           (0.10, 0.070),
    "pharma_specialty":         (0.12, 0.075),
    "pharma_api":               (0.13, 0.090),
    "hospitals_diagnostics":    (0.15, 0.080),
    "biotech":                  (0.14, 0.110),
    # Consumer
    "fmcg_food":                (0.10, 0.045),
    "fmcg_personal_care":       (0.09, 0.050),
    "fmcg_paints":              (0.10, 0.060),
    "alcohol_tobacco":          (0.10, 0.055),
    # Metals/Mining
    "metals_ferrous":           (0.08, 0.110),
    "metals_nonferrous":        (0.09, 0.110),
    "mining":                   (0.07, 0.095),
    # Cement/Materials/Realty
    "cement":                   (0.09, 0.075),
    "construction_materials":   (0.10, 0.085),
    "real_estate":              (0.13, 0.105),
    "infrastructure_epc":       (0.11, 0.090),
    # Capital Goods/Defence
    "capital_goods":            (0.15, 0.085),
    "industrial_machinery":     (0.16, 0.090),
    "defence":                  (0.22, 0.110),
    "shipbuilding":             (0.20, 0.115),
    "railways":                 (0.18, 0.100),
    # Chemicals
    "chemicals_specialty":      (0.12, 0.085),
    "chemicals_agro":           (0.10, 0.080),
    "fertilisers":              (0.08, 0.075),
    "explosives":               (0.15, 0.090),
    # Consumer durables/Retail/Entertainment
    "consumer_durables":        (0.13, 0.085),
    "retail_discretionary":     (0.14, 0.095),
    "retail_grocery":           (0.13, 0.075),
    "consumer_electronics":     (0.16, 0.105),
    "jewellery":                (0.13, 0.085),
    "hotels_leisure":           (0.12, 0.105),
    "media_entertainment":      (0.05, 0.110),
    "aviation_logistics":       (0.10, 0.090),
    "ecommerce_internet":       (0.10, 0.140),
    # Textiles
    "textiles_apparel":         (0.10, 0.085),
    # Holding/Other
    "diversified_holding":      (0.12, 0.075),
    "other_unmapped":           (0.10, 0.080),
}

# ============================================================================
# Per-stock idio params: how each stock relates to its sector
# (beta_to_sector, idio_vol). Most stocks have beta near 1.0 and modest idio_vol.
# Some get explicit overrides (large names with known characters).
# ============================================================================

PER_STOCK_OVERRIDES = {
    # name -> (beta_to_sector, idio_vol_monthly)
    "Reliance Industries":   (1.10, 0.060),  # bigger than sector
    "HDFC Bank":             (0.95, 0.030),  # bellwether, tight to sector
    "ICICI Bank":            (1.05, 0.035),
    "SBI":                   (1.15, 0.055),  # PSU vol
    "TCS":                   (0.90, 0.030),  # quality compounder
    "Infosys":               (1.00, 0.040),
    "Bharti Airtel":         (1.00, 0.045),
    "LIC":                   (0.85, 0.035),
    "Vodafone Idea":         (1.30, 0.140),  # high vol micro
    "Yes Bank":              (1.40, 0.150),  # idio-driven
    "Adani Enterp":          (1.40, 0.120),
    "Adani Power":           (1.30, 0.110),
    "Adani Green":           (1.30, 0.130),
    "Adani Ports":           (1.10, 0.080),
    "Suzlon Energy":         (1.50, 0.150),
    "ITC":                   (0.80, 0.040),
    "Maruti Suzuki":         (1.00, 0.050),
    "Bajaj Finance":         (1.20, 0.075),
    "Coal India":            (0.85, 0.060),
    "Tata Steel":            (1.10, 0.085),
    "JSW Steel":             (1.10, 0.080),
    "NTPC":                  (0.85, 0.045),
    "ONGC":                  (1.00, 0.075),
    "Hindustan Unilever":    (0.75, 0.035),
    "Nestle India":          (0.70, 0.035),
}

DEFAULT_BETA = 1.0
DEFAULT_IDIO_VOL = 0.045

# ============================================================================
# Helpers
# ============================================================================

def months_between(start_month, end_month):
    """List of YYYY-MM strings from start to end inclusive."""
    sy, sm = int(start_month[:4]), int(start_month[5:7])
    ey, em = int(end_month[:4]), int(end_month[5:7])
    out = []
    y, m = sy, sm
    while (y, m) <= (ey, em):
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return out


def stock_seed(name, snapshot_seed=0):
    """Deterministic per-stock RNG seed."""
    return (hash(name) ^ snapshot_seed) & 0xFFFFFFFF


def get_sector(name, sector_map):
    """Look up sector with fallback."""
    return sector_map['mappings'].get(name, sector_map['_meta']['fallback'])


def get_cap_tier(mcap_cr):
    """Cap tier from market cap (Rs Cr)."""
    # RIL is legitimately ~1.78M Cr; broken values are typically 100x larger or zero
    BROKEN = 2500000  # implausibly large indicates data error
    if mcap_cr is None or mcap_cr <= 0 or mcap_cr > BROKEN:
        return 'small'  # default for broken or zero mcap
    if mcap_cr >= 100000:
        return 'large'
    if mcap_cr >= 25000:
        return 'mid'
    return 'small'


def get_stock_params(name):
    """Return (beta_to_sector, idio_vol_monthly) for a stock."""
    if name in PER_STOCK_OVERRIDES:
        return PER_STOCK_OVERRIDES[name]
    return (DEFAULT_BETA, DEFAULT_IDIO_VOL)


# ============================================================================
# Stage 1: Stock monthly_prices synthesis (84-month pre-t0 history)
# ============================================================================

# Market factor: shared component that drives all sectors together
# Annualized drift 11.5%, annualized vol 16% (calibrated to long-run Nifty 50 behavior)
MARKET_FACTOR_ANN_DRIFT = 0.115
MARKET_FACTOR_ANN_VOL = 0.16

# Cap-tier factors: additional shared component within each cap tier
# Reflects "small caps move together as a group, separately from large caps"
CAP_TIER_FACTOR_PARAMS = {
    'large': {'ann_drift': 0.110, 'ann_vol': 0.14, 'weight': 0.20},
    'mid':   {'ann_drift': 0.150, 'ann_vol': 0.18, 'weight': 0.25},
    'small': {'ann_drift': 0.170, 'ann_vol': 0.22, 'weight': 0.30},
}

# Weight of market factor in each stock's return
MARKET_FACTOR_WEIGHT = 0.45

# Sum of (market_weight + cap_tier_weight) must leave room for sector idio and stock idio
# weights: market 0.45, cap_tier ~0.20-0.30, sector_idio ~0.25, stock_idio (residual)


def synthesize_market_factor(months, snapshot_seed):
    """
    Synthesize the common market factor monthly returns.
    Every stock's return has this as a shared component (weight MARKET_FACTOR_WEIGHT).
    """
    rng = random.Random(0x4D4B544641 ^ snapshot_seed)  # 'MKTFA' seed
    monthly_drift = MARKET_FACTOR_ANN_DRIFT / 12.0
    monthly_vol = MARKET_FACTOR_ANN_VOL / math.sqrt(12)
    rets = OrderedDict()
    for m in months:
        r = rng.gauss(monthly_drift, monthly_vol)
        r = max(-0.20, min(0.20, r))
        rets[m] = r
    return rets


def synthesize_cap_tier_factors(months, snapshot_seed):
    """
    Synthesize per-cap-tier factor returns (orthogonal to market factor).
    """
    tier_factors = {}
    for tier, params in CAP_TIER_FACTOR_PARAMS.items():
        rng = random.Random((hash(tier) ^ snapshot_seed ^ 0xCAFE) & 0xFFFFFFFF)
        # We want the cap-tier factor to be ORTHOGONAL to the market factor
        # So we draw it independently with its own mean and vol
        # The cap-tier factor's mean is the "excess" over market: ann_drift - market_ann_drift
        # That way total expected return = market_w * market_drift + cap_w * cap_excess_drift + ...
        excess_drift = params['ann_drift'] - MARKET_FACTOR_ANN_DRIFT
        monthly_drift = excess_drift / 12.0
        monthly_vol = params['ann_vol'] / math.sqrt(12)
        rets = OrderedDict()
        for m in months:
            r = rng.gauss(monthly_drift, monthly_vol)
            r = max(-0.20, min(0.20, r))
            rets[m] = r
        tier_factors[tier] = rets
    return tier_factors


def synthesize_sector_monthly_returns(sector_map, months, market_factor, cap_tier_factors):
    """
    For each sector, synthesize a sector_idio return series (orthogonal to market
    and cap-tier factors). The full stock return composition happens at the
    stock level, not the sector level, so this just gives us sector-specific
    noise.
    
    Returns dict: sector -> {month: sector_idio_return}
    """
    sector_returns = {}
    for sector, (ann_drift, monthly_vol_target) in SECTOR_PARAMS.items():
        rng = random.Random(hash(sector) & 0xFFFFFFFF)
        # Sector idio is what's left after market + cap_tier are accounted for
        # Approximate: assume cap_tier weight ~0.25 (average), market weight = MARKET_FACTOR_WEIGHT
        # Remaining mean = (target - market_w * market_mean - cap_tier_w * avg_cap_excess) / (1 - market_w - cap_tier_w)
        # For simplicity use the residual approach for the sector
        residual_w = 1.0 - MARKET_FACTOR_WEIGHT - 0.25  # ~0.30
        market_monthly_mean = MARKET_FACTOR_ANN_DRIFT / 12.0
        target_monthly_mean = ann_drift / 12.0
        # Solve for sector residual mean: assume cap_tier contributes ~ excess equal to drift target diff
        sector_idio_mean = (target_monthly_mean - MARKET_FACTOR_WEIGHT * market_monthly_mean) / (1 - MARKET_FACTOR_WEIGHT)
        
        # Vol decomposition: assume orthogonal
        market_monthly_var = (MARKET_FACTOR_ANN_VOL / math.sqrt(12)) ** 2
        target_monthly_var = monthly_vol_target ** 2
        # Approximate: assume cap_tier vol contributes ~30% of variance
        sector_idio_var = max(1e-8, target_monthly_var - (MARKET_FACTOR_WEIGHT ** 2) * market_monthly_var)
        sector_idio_vol = math.sqrt(sector_idio_var) * 0.7  # scale down to leave room for cap_tier
        
        returns = OrderedDict()
        for m in months:
            r = rng.gauss(sector_idio_mean, sector_idio_vol)
            r = max(-0.30, min(0.30, r))
            returns[m] = r
        sector_returns[sector] = returns
    return sector_returns


def synthesize_stock_monthly_prices(company, sector_map, market_factor, cap_tier_factors, sector_returns, months, snapshot_seed):
    """
    Synthesize a stock's monthly price series ending at t0 (so the last value
    equals cmp_rs).
    
    Two-factor model:
        r_stock(m) = w_market * r_market(m) 
                   + w_cap_tier * r_cap_tier(m) 
                   + beta_to_sector * r_sector_idio(m) 
                   + stock_idio(m)
    Then compound backward from cmp_rs to derive each historical month.
    """
    name = company['name']
    sector = get_sector(name, sector_map)
    cap_tier = get_cap_tier(company.get('market_cap_rs_cr', 0))
    beta, idio_vol = get_stock_params(name)
    cmp = company.get('cmp_rs', 0)
    
    if cmp is None or cmp <= 0:
        return None  # cannot synthesize without anchor
    
    rng = random.Random(stock_seed(name, snapshot_seed))
    sec_rets = sector_returns.get(sector, sector_returns['other_unmapped'])
    cap_rets = cap_tier_factors[cap_tier]
    
    # Weights: market 0.45, cap_tier from CAP_TIER_FACTOR_PARAMS, sector idio (1 - market - cap_tier) * beta, stock idio
    w_market = MARKET_FACTOR_WEIGHT
    w_cap = CAP_TIER_FACTOR_PARAMS[cap_tier]['weight']
    w_sector = (1.0 - w_market - w_cap)  # what's left for sector + stock idio
    
    stock_returns = OrderedDict()
    for m in months:
        r_market = market_factor[m]
        r_cap = cap_rets[m]
        r_sec_idio = sec_rets[m]
        r_stock_idio = rng.gauss(0, idio_vol)
        r_stock = (w_market * r_market 
                   + w_cap * r_cap 
                   + w_sector * beta * r_sec_idio 
                   + r_stock_idio)
        r_stock = max(-0.40, min(0.40, r_stock))
        stock_returns[m] = r_stock
    
    # Walk backward from cmp_rs to derive historical prices
    prices = OrderedDict()
    prices[months[-1]] = cmp
    for i in range(len(months) - 2, -1, -1):
        next_month = months[i+1]
        r = stock_returns[next_month]
        prices[months[i]] = prices[next_month] / (1.0 + r)
        if prices[months[i]] < cmp * PRICE_FLOOR_FRAC:
            prices[months[i]] = cmp * PRICE_FLOOR_FRAC
    
    out = OrderedDict()
    for m in months:
        out[m] = round(prices[m], 2)
    return out


# ============================================================================
# Stage 2: Index series
# ============================================================================

CANONICAL_INDICES = [
    ("nifty_50_tri",            "Nifty 50 TRI",                    "equity_largecap",      "derive_from_constituents"),
    ("nifty_next_50_tri",       "Nifty Next 50 TRI",               "equity_largecap",      "derive_from_constituents"),
    ("nifty_100_tri",           "Nifty 100 TRI",                   "equity_largecap",      "derive_from_constituents"),
    ("nifty_midcap_150_tri",    "Nifty Midcap 150 TRI",            "equity_midcap",        "derive_from_constituents"),
    ("nifty_smallcap_250_tri",  "Nifty Smallcap 250 TRI",          "equity_smallcap",      "derive_from_constituents"),
    ("nifty_500_tri",           "Nifty 500 TRI",                   "equity_broad",         "derive_from_constituents"),
    ("bse_sensex_tri",          "BSE Sensex TRI",                  "equity_largecap",      "derive_from_constituents"),
    ("nifty_bank_tri",          "Nifty Bank TRI",                  "equity_sector_banks",  "derive_from_constituents"),
    ("nifty_it_tri",            "Nifty IT TRI",                    "equity_sector_it",     "derive_from_constituents"),
    ("crisil_composite_bond",   "CRISIL Composite Bond Index",     "debt_composite",       "synthesize_duration_model"),
    ("crisil_short_term_bond",  "CRISIL Short Term Bond Index",    "debt_short_duration",  "synthesize_duration_model"),
    ("crisil_dynamic_gilt",     "CRISIL Dynamic Gilt Index",       "debt_gilt_dynamic",    "synthesize_duration_model"),
    ("nifty_10y_gsec",          "Nifty 10 Year Benchmark G-Sec",   "debt_gilt_long",       "synthesize_duration_model"),
    ("crisil_liquid",           "CRISIL Liquid Debt Index",        "debt_liquid",          "synthesize_duration_model"),
    ("gold_inr",                "Domestic Price of Gold",          "commodity_gold",       "synthesize_macro_anchored"),
    ("sp_500_tri_inr",          "S&P 500 TRI (INR)",               "equity_intl_us",       "synthesize_correlated"),
]

# Index -> set of sector tags / cap tiers / company names that form the constituents
# Per the audit: derive-from-constituents indices use the synthesized stock universe.
INDEX_CONSTITUENTS = {
    # cap tiers: large, mid, small
    "nifty_50_tri":           {"top_n_by_mcap": 50},
    "nifty_next_50_tri":      {"rank_range_by_mcap": (51, 100)},
    "nifty_100_tri":          {"top_n_by_mcap": 100},
    "nifty_midcap_150_tri":   {"cap_tier": "mid"},
    "nifty_smallcap_250_tri": {"cap_tier": "small"},
    "nifty_500_tri":          {"all": True},
    "bse_sensex_tri":         {"top_n_by_mcap": 30},
    "nifty_bank_tri":         {"sectors": ["banks_private", "banks_psu"]},
    "nifty_it_tri":           {"sectors": ["it_services", "it_products"]},
}

# Synthesis params for non-constituent indices (annual_drift, monthly_vol)
NON_CONSTITUENT_INDEX_PARAMS = {
    "crisil_composite_bond":  (0.075, 0.012),
    "crisil_short_term_bond": (0.070, 0.005),
    "crisil_dynamic_gilt":    (0.075, 0.025),
    "nifty_10y_gsec":         (0.072, 0.020),
    "crisil_liquid":          (0.065, 0.002),
    "gold_inr":               (0.105, 0.040),
    "sp_500_tri_inr":         (0.110, 0.045),
}


def derive_index_from_constituents(index_id, companies, sector_map, monthly_prices_by_company, months):
    """
    Compute a market-cap-weighted index series from constituent monthly prices.
    Adds a small dividend assumption to TRI variants (1.5% annualized).
    """
    selection_rule = INDEX_CONSTITUENTS[index_id]
    
    # Select constituents
    selected_companies = []
    # Sort all companies by mcap, descending (handle broken mcaps)
    BROKEN = 1500000
    sorted_companies = sorted(
        [c for c in companies if c.get('market_cap_rs_cr') and 0 < c['market_cap_rs_cr'] < BROKEN or c['name'] == 'Reliance Industries'],
        key=lambda c: c['market_cap_rs_cr'],
        reverse=True
    )
    
    if 'top_n_by_mcap' in selection_rule:
        selected_companies = sorted_companies[:selection_rule['top_n_by_mcap']]
    elif 'rank_range_by_mcap' in selection_rule:
        lo, hi = selection_rule['rank_range_by_mcap']
        selected_companies = sorted_companies[lo-1:hi]
    elif 'cap_tier' in selection_rule:
        tier = selection_rule['cap_tier']
        selected_companies = [c for c in companies if get_cap_tier(c.get('market_cap_rs_cr', 0)) == tier]
    elif 'sectors' in selection_rule:
        secs = set(selection_rule['sectors'])
        selected_companies = [c for c in companies if get_sector(c['name'], sector_map) in secs]
    elif selection_rule.get('all'):
        selected_companies = [c for c in companies if c.get('market_cap_rs_cr', 0) > 0]
    
    # Compute total mcap weights (at t0) for the selected set
    total_mcap = sum(c.get('market_cap_rs_cr', 0) or 0 for c in selected_companies)
    if total_mcap == 0:
        return None
    
    # For each month, compute weighted return then compound
    # Index value at t0 indexed to 1000.0
    BASE = 1000.0
    index_values = OrderedDict()
    index_values[months[-1]] = BASE
    
    # Walk backward: for each prior month, compute weighted average return between m and m+1
    # Then index[m] = index[m+1] / (1 + r)
    for i in range(len(months) - 2, -1, -1):
        m = months[i]
        m_next = months[i+1]
        weighted_r = 0.0
        weight_sum = 0.0
        for c in selected_companies:
            name = c['name']
            mp = monthly_prices_by_company.get(name)
            if not mp:
                continue
            p_prev = mp.get(m)
            p_now = mp.get(m_next)
            if not p_prev or not p_now or p_prev <= 0:
                continue
            r = (p_now / p_prev) - 1.0
            w = c.get('market_cap_rs_cr', 0) or 0
            weighted_r += r * w
            weight_sum += w
        if weight_sum > 0:
            avg_r = weighted_r / weight_sum
            # TRI dividend uplift: ~1.5% annualized = 0.00125 monthly
            avg_r += 0.00125
            index_values[m] = index_values[m_next] / (1.0 + avg_r)
    
    # Output ascending
    out = OrderedDict()
    for m in months:
        out[m] = round(index_values[m], 2)
    return out


def synthesize_non_constituent_index(index_id, months, snapshot_seed):
    """Synthesize an index series using drift + vol."""
    ann_drift, monthly_vol = NON_CONSTITUENT_INDEX_PARAMS[index_id]
    rng = random.Random(hash(index_id) ^ snapshot_seed)
    monthly_drift = ann_drift / 12.0
    
    # Walk forward from a base 1000 at the start, then renormalize so t0 lands at a clean value
    values = [1000.0]
    for _ in months[1:]:
        r = rng.gauss(monthly_drift, monthly_vol)
        r = max(-0.10, min(0.10, r))
        values.append(values[-1] * (1.0 + r))
    
    out = OrderedDict()
    for m, v in zip(months, values):
        out[m] = round(v, 2)
    return out


# ============================================================================
# Stage 3: FX series (USD/INR)
# ============================================================================

def synthesize_fx_series(months, t0_spot, snapshot_seed):
    """
    Synthesize USD/INR monthly series.
    Anchored to t0 spot value; walks backward from there.
    Plausible drift: ~3% annual INR depreciation, ~6% annual vol.
    """
    rng = random.Random(0x554f53444e52 ^ snapshot_seed)  # 'USDNR' seed
    monthly_drift = 0.03 / 12.0
    monthly_vol = 0.06 / math.sqrt(12)
    
    # Walk backward from t0
    values = OrderedDict()
    values[months[-1]] = t0_spot
    for i in range(len(months) - 2, -1, -1):
        m_next = months[i+1]
        r = rng.gauss(monthly_drift, monthly_vol)
        r = max(-0.05, min(0.05, r))
        values[months[i]] = values[m_next] / (1.0 + r)
    
    out = OrderedDict()
    for m in months:
        out[m] = round(values[m], 3)
    return out


# ============================================================================
# Stage 4: Tier B per-instrument stats
# ============================================================================

def compute_returns_from_series(series_dict):
    """Compute month-over-month log returns from an ordered price dict."""
    months = sorted(series_dict.keys())
    rets = []
    for i in range(1, len(months)):
        p0 = series_dict[months[i-1]]
        p1 = series_dict[months[i]]
        if p0 and p0 > 0 and p1 and p1 > 0:
            rets.append(math.log(p1 / p0))
    return rets


def annualized_return(monthly_log_rets, window_months=None):
    """Annualized log return."""
    if window_months:
        monthly_log_rets = monthly_log_rets[-window_months:]
    if not monthly_log_rets:
        return None
    mean_log = sum(monthly_log_rets) / len(monthly_log_rets)
    return math.exp(mean_log * 12) - 1


def annualized_vol(monthly_log_rets, window_months=None):
    """Annualized volatility."""
    if window_months:
        monthly_log_rets = monthly_log_rets[-window_months:]
    if len(monthly_log_rets) < 2:
        return None
    mean = sum(monthly_log_rets) / len(monthly_log_rets)
    var = sum((r - mean) ** 2 for r in monthly_log_rets) / (len(monthly_log_rets) - 1)
    return math.sqrt(var) * math.sqrt(12)


def sharpe_ratio(monthly_log_rets, rf_ann=RISK_FREE_ANN, window_months=None):
    ann_r = annualized_return(monthly_log_rets, window_months)
    ann_v = annualized_vol(monthly_log_rets, window_months)
    if ann_r is None or ann_v is None or ann_v == 0:
        return None
    return (ann_r - rf_ann) / ann_v


def sortino_ratio(monthly_log_rets, rf_ann=RISK_FREE_ANN, window_months=None):
    if window_months:
        monthly_log_rets = monthly_log_rets[-window_months:]
    if len(monthly_log_rets) < 2:
        return None
    rf_monthly = math.log(1 + rf_ann) / 12
    downside = [r - rf_monthly for r in monthly_log_rets if r < rf_monthly]
    if not downside:
        return None
    downside_vol = math.sqrt(sum(r**2 for r in downside) / len(downside)) * math.sqrt(12)
    if downside_vol == 0:
        return None
    ann_r = annualized_return(monthly_log_rets)
    return (ann_r - rf_ann) / downside_vol


def max_drawdown(series_dict):
    """Max drawdown of the price series."""
    months = sorted(series_dict.keys())
    if len(months) < 2:
        return None
    peak = series_dict[months[0]]
    mdd = 0.0
    for m in months[1:]:
        v = series_dict[m]
        if v is None:
            continue
        if v > peak:
            peak = v
        dd = (v - peak) / peak
        if dd < mdd:
            mdd = dd
    return mdd


def calmar_ratio(monthly_log_rets, mdd, window_months=36):
    """Annualized return / abs(MDD)."""
    ann_r = annualized_return(monthly_log_rets, window_months)
    if ann_r is None or mdd is None or mdd == 0:
        return None
    return ann_r / abs(mdd)


def beta_and_r2(stock_rets, bench_rets):
    """Beta and R-squared vs benchmark, on aligned return series."""
    n = min(len(stock_rets), len(bench_rets))
    if n < 12:
        return None, None
    s = stock_rets[-n:]
    b = bench_rets[-n:]
    mean_s = sum(s) / n
    mean_b = sum(b) / n
    cov = sum((s[i] - mean_s) * (b[i] - mean_b) for i in range(n)) / (n - 1)
    var_b = sum((b[i] - mean_b) ** 2 for i in range(n)) / (n - 1)
    var_s = sum((s[i] - mean_s) ** 2 for i in range(n)) / (n - 1)
    if var_b == 0 or var_s == 0:
        return None, None
    beta = cov / var_b
    r = cov / math.sqrt(var_s * var_b)
    return beta, r * r


def tracking_error(stock_rets, bench_rets, window_months=36):
    n = min(len(stock_rets), len(bench_rets), window_months)
    if n < 12:
        return None
    s = stock_rets[-n:]
    b = bench_rets[-n:]
    diffs = [s[i] - b[i] for i in range(n)]
    mean = sum(diffs) / n
    var = sum((d - mean) ** 2 for d in diffs) / (n - 1)
    return math.sqrt(var) * math.sqrt(12)


def information_ratio(stock_rets, bench_rets, window_months=36):
    n = min(len(stock_rets), len(bench_rets), window_months)
    if n < 12:
        return None
    ann_s = annualized_return(stock_rets, n)
    ann_b = annualized_return(bench_rets, n)
    te = tracking_error(stock_rets, bench_rets, window_months)
    if ann_s is None or ann_b is None or te is None or te == 0:
        return None
    return (ann_s - ann_b) / te


def compute_tier_b_for_instrument(price_series, bench_series, window_3y=36, window_5y=60):
    """Compute the full Tier B stats block for an instrument."""
    rets = compute_returns_from_series(price_series)
    if len(rets) < 12:
        return {"data_window_insufficient": True, "reason": "fewer_than_12_months"}
    
    out = {}
    out['vol_3y_annualized'] = annualized_vol(rets, window_3y)
    out['vol_5y_annualized'] = annualized_vol(rets, window_5y) if len(rets) >= window_5y else None
    out['sharpe_3y'] = sharpe_ratio(rets, window_months=window_3y)
    out['sharpe_5y'] = sharpe_ratio(rets, window_months=window_5y) if len(rets) >= window_5y else None
    out['sortino_3y'] = sortino_ratio(rets, window_months=window_3y)
    out['sortino_5y'] = sortino_ratio(rets, window_months=window_5y) if len(rets) >= window_5y else None
    
    mdd_3y_dict = {m: price_series[m] for m in sorted(price_series.keys())[-window_3y:]}
    mdd_5y_dict = {m: price_series[m] for m in sorted(price_series.keys())[-window_5y:]} if len(price_series) >= window_5y else None
    out['max_drawdown_3y'] = max_drawdown(mdd_3y_dict)
    out['max_drawdown_5y'] = max_drawdown(mdd_5y_dict) if mdd_5y_dict else None
    out['calmar_3y'] = calmar_ratio(rets, out['max_drawdown_3y'], window_3y)
    
    if bench_series:
        bench_rets = compute_returns_from_series(bench_series)
        b, r2 = beta_and_r2(rets, bench_rets)
        out['beta_3y'] = b
        out['r_squared_3y'] = r2
        out['tracking_error_3y'] = tracking_error(rets, bench_rets, window_3y)
        out['information_ratio_3y'] = information_ratio(rets, bench_rets, window_3y)
    else:
        out['beta_3y'] = None
        out['r_squared_3y'] = None
        out['tracking_error_3y'] = None
        out['information_ratio_3y'] = None
    
    # Round
    return {k: (round(v, 4) if isinstance(v, float) else v) for k, v in out.items()}


def pick_benchmark_for_stock(name, cap_tier, sector, indices_data):
    """Map a stock to its primary benchmark index series."""
    # Sector first: banks->Nifty Bank, IT->Nifty IT
    if sector in ('banks_private', 'banks_psu'):
        return indices_data.get('nifty_bank_tri', {}).get('monthly_values')
    if sector in ('it_services', 'it_products'):
        return indices_data.get('nifty_it_tri', {}).get('monthly_values')
    # Else by cap tier
    if cap_tier == 'large':
        return indices_data.get('nifty_50_tri', {}).get('monthly_values')
    if cap_tier == 'mid':
        return indices_data.get('nifty_midcap_150_tri', {}).get('monthly_values')
    return indices_data.get('nifty_smallcap_250_tri', {}).get('monthly_values')


# ============================================================================
# Phase C: Forward extension functions
# ============================================================================

def calibrate_monthly_returns_to_target(target_quarterly_return, n_months, monthly_drift, monthly_vol,
                                         event_month_idx=None, event_delta=None, rng=None):
    """
    Generate n_months monthly returns that compound exactly to (1 + target_quarterly_return).
    If event_month_idx is given, that month's return is forced to event_delta and the
    other months absorb the residual.
    
    Returns: list of monthly returns of length n_months
    """
    if rng is None:
        rng = random.Random(0)
    
    # Draw raw noise
    raw_returns = [rng.gauss(monthly_drift, monthly_vol) for _ in range(n_months)]
    
    # If there's a surgical event, override the event month
    if event_month_idx is not None and event_delta is not None:
        raw_returns[event_month_idx] = event_delta
    
    # Compute the implied compound from raw returns
    implied_compound = 1.0
    for r in raw_returns:
        implied_compound *= (1.0 + r)
    
    target_compound = 1.0 + target_quarterly_return
    
    # Distribute the residual additively across non-event months
    # Residual r_each such that (raw_returns adjusted) compounds to target
    # Approximation: each non-event month gets an additive nudge
    n_adjustable = n_months if event_month_idx is None else n_months - 1
    if n_adjustable == 0:
        # Only 1 month and it's the event month; just return event delta scaled to match
        return [target_quarterly_return]
    
    # Iterative adjustment to find the right nudge
    nudge = (target_compound / implied_compound) ** (1.0 / n_adjustable) - 1.0
    
    final_returns = []
    for i, r in enumerate(raw_returns):
        if i == event_month_idx:
            final_returns.append(r)
        else:
            final_returns.append((1.0 + r) * (1.0 + nudge) - 1.0)
    
    # Verify (sanity check)
    actual = 1.0
    for r in final_returns:
        actual *= (1.0 + r)
    # If error is > 0.5% absolute, refine once more
    if abs(actual - target_compound) > 0.005 * target_compound:
        # Apply remaining adjustment to first non-event month
        for i in range(n_months):
            if i != event_month_idx:
                final_returns[i] = (1.0 + final_returns[i]) * (target_compound / actual) - 1.0
                break
    
    return final_returns


def extend_mf_monthly_nav(fund, target_nav_at_snapshot, snapshot_id, event_month, event_type, snapshot_seed):
    """
    Extend the fund's monthly_nav by 3 months to reach target_nav_at_snapshot.
    Returns updated monthly_nav dict, plus 3 monthly returns added.
    """
    mn = fund.get('monthly_nav', {})
    if not isinstance(mn, dict) or not mn:
        return mn, None
    
    sorted_months = sorted(mn.keys())
    prior_end_month = sorted_months[-1]
    prior_end_nav = mn[prior_end_month]
    
    # Get current snapshot end month
    last_month = None
    for sid, sdate, lm, em, et in SNAPSHOT_SEQUENCE:
        if sid == snapshot_id:
            last_month = lm
            break
    if not last_month:
        return mn, None
    
    new_months = months_in_quarter(prior_end_month, last_month)
    n = len(new_months)
    
    if prior_end_nav <= 0 or target_nav_at_snapshot <= 0:
        return mn, None
    
    target_q_return = target_nav_at_snapshot / prior_end_nav - 1.0
    
    # Category-appropriate monthly drift and vol
    cat = fund.get('sebi_category', 'Multi Cap Fund')
    monthly_drift = CATEGORY_MONTHLY_DRIFT.get(cat, 0.008)
    monthly_vol = CATEGORY_MONTHLY_VOL.get(cat, 0.035)
    
    # Determine surgical event applicability for this fund
    event_month_idx = None
    event_delta = None
    if event_type and event_month:
        try:
            event_month_idx = new_months.index(event_month)
            event_delta = compute_event_delta_for_mf(fund, event_type)
        except ValueError:
            event_month_idx = None
    
    # Deterministic per-fund per-snapshot RNG
    fund_seed = (hash(fund.get('fund_name', '')) ^ snapshot_seed) & 0xFFFFFFFF
    rng = random.Random(fund_seed)
    
    monthly_rets = calibrate_monthly_returns_to_target(
        target_q_return, n, monthly_drift, monthly_vol,
        event_month_idx, event_delta, rng
    )
    
    # Extend the series
    new_mn = dict(mn)
    nav = prior_end_nav
    for i, m in enumerate(new_months):
        nav = nav * (1.0 + monthly_rets[i])
        new_mn[m] = round(nav, 4)
    
    return new_mn, monthly_rets


# Category-level monthly drift and vol (per-quarter return divided by 3, vol roughly per-month)
# Used for the random noise sampling in calibration; the calibration constraint forces the
# total to match the target quarterly return, so these only shape per-month distribution.
CATEGORY_MONTHLY_DRIFT = {
    'Large Cap Fund': 0.010,
    'Large & Mid Cap Fund': 0.011,
    'Mid Cap Fund': 0.012,
    'Small Cap Fund': 0.013,
    'Multi Cap Fund': 0.011,
    'Flexi Cap Fund': 0.011,
    'ELSS': 0.011,
    'Focused Fund': 0.011,
    'Sectoral / Thematic Fund': 0.012,
    'Value Fund': 0.010,
    'Contra Fund': 0.010,
    'Dividend Yield Fund': 0.009,
    'Aggressive Hybrid Fund': 0.009,
    'Conservative Hybrid Fund': 0.006,
    'Balanced Advantage Fund': 0.008,
    'Dynamic Asset Allocation or Bal': 0.008,
    'Multi Asset Allocation': 0.008,
    'Arbitrage Fund': 0.005,
    'Equity Savings': 0.007,
    'Liquid Fund': 0.005,
    'Money Market Fund': 0.005,
    'Ultra Short Duration Fund': 0.005,
    'Low Duration Fund': 0.006,
    'Short Duration Fund': 0.006,
    'Medium Duration Fund': 0.006,
    'Long Duration Fund': 0.006,
    'Gilt Fund': 0.006,
    'Gilt Fund with 10 year constant duration': 0.006,
    'Corporate Bond Fund': 0.006,
    'Credit Risk Fund': 0.007,
    'Banking and PSU Fund': 0.006,
    'Floater Fund': 0.005,
    'Dynamic Bond Fund': 0.006,
    'Medium to Long Duration Fund': 0.006,
    'Overnight Fund': 0.005,
    'Equity Index Funds': 0.011,
    'Debt Index Funds': 0.006,
    'Retirement Fund': 0.009,
    "Children's Fund": 0.009,
    'FoFs Domestic': 0.010,
    'FoFs Overseas': 0.009,
    'ETFs- Equity': 0.011,
    'ETFs- Debt': 0.006,
    'ETFs- Commodity': 0.009,
    'ETFs- Other': 0.009,
}
CATEGORY_MONTHLY_VOL = {
    'Large Cap Fund': 0.040,
    'Large & Mid Cap Fund': 0.045,
    'Mid Cap Fund': 0.050,
    'Small Cap Fund': 0.060,
    'Multi Cap Fund': 0.045,
    'Flexi Cap Fund': 0.045,
    'ELSS': 0.045,
    'Focused Fund': 0.050,
    'Sectoral / Thematic Fund': 0.055,
    'Value Fund': 0.045,
    'Contra Fund': 0.045,
    'Dividend Yield Fund': 0.040,
    'Aggressive Hybrid Fund': 0.030,
    'Conservative Hybrid Fund': 0.018,
    'Balanced Advantage Fund': 0.025,
    'Dynamic Asset Allocation or Bal': 0.025,
    'Multi Asset Allocation': 0.025,
    'Arbitrage Fund': 0.005,
    'Equity Savings': 0.020,
    'Liquid Fund': 0.001,
    'Money Market Fund': 0.001,
    'Ultra Short Duration Fund': 0.002,
    'Low Duration Fund': 0.004,
    'Short Duration Fund': 0.006,
    'Medium Duration Fund': 0.010,
    'Long Duration Fund': 0.020,
    'Gilt Fund': 0.018,
    'Gilt Fund with 10 year constant duration': 0.018,
    'Corporate Bond Fund': 0.008,
    'Credit Risk Fund': 0.012,
    'Banking and PSU Fund': 0.008,
    'Floater Fund': 0.004,
    'Dynamic Bond Fund': 0.015,
    'Medium to Long Duration Fund': 0.012,
    'Overnight Fund': 0.0005,
    'Equity Index Funds': 0.045,
    'Debt Index Funds': 0.010,
    'Retirement Fund': 0.035,
    "Children's Fund": 0.035,
    'FoFs Domestic': 0.035,
    'FoFs Overseas': 0.040,
    'ETFs- Equity': 0.045,
    'ETFs- Debt': 0.010,
    'ETFs- Commodity': 0.035,
    'ETFs- Other': 0.030,
}


def compute_event_delta_for_mf(fund, event_type):
    """Determine the surgical event's per-month delta for this MF based on its profile."""
    cat = (fund.get('sebi_category') or '').lower()
    name = (fund.get('fund_name') or '').lower()
    
    if event_type == 'stress_rate_cut':
        # Gilt funds get the biggest pop
        if 'gilt' in cat:
            return SURGICAL_EVENT_DELTAS['stress_rate_cut']['debt_gilt_long']['month_delta']
        if 'long duration' in cat or 'long duration' in name:
            return SURGICAL_EVENT_DELTAS['stress_rate_cut']['debt_gilt_dynamic']['month_delta']
        if 'medium duration' in cat or 'medium to long' in cat or 'dynamic bond' in cat:
            return SURGICAL_EVENT_DELTAS['stress_rate_cut']['debt_composite']['month_delta']
        if 'short duration' in cat or 'corporate bond' in cat or 'banking and psu' in cat:
            return SURGICAL_EVENT_DELTAS['stress_rate_cut']['debt_short_duration']['month_delta']
        if 'liquid' in cat or 'overnight' in cat or 'money market' in cat or 'ultra short' in cat:
            return SURGICAL_EVENT_DELTAS['stress_rate_cut']['debt_liquid']['month_delta']
        # Equity funds: no direct surgical
        return None
    
    if event_type == 'stress_bank_shock':
        # Bank-heavy MFs feel proportional drag from Top 5 Sectors
        t5s = fund.get('Top 5 Sectors (JSON)', []) or []
        banks_wt = 0
        for s in t5s:
            sname = (s.get('sector') or '').lower()
            if 'bank' in sname or 'financial' in sname:
                banks_wt += s.get('weight_pct', 0) or 0
        if banks_wt > 0:
            # Proportional to bank exposure, max -0.16 if heavily concentrated
            return max(-0.18, -0.0018 * banks_wt)  # -18% for 100% banks; -1.8% for 10%
        return None
    
    if event_type == 'stress_ril_idio':
        # Funds with RIL in Top 5 holdings get NAV drag
        t5h = fund.get('Top 5 Holdings (JSON)', []) or []
        ril_wt = 0
        for h in t5h:
            hname = (h.get('name') or '').lower()
            if 'reliance industries' in hname or 'reliance industri' in hname:
                ril_wt = h.get('weight_pct', 0) or 0
                break
        if ril_wt > 0:
            # -28% on the position translates to -0.28 * (wt/100) on NAV
            return -0.28 * (ril_wt / 100.0)
        return None
    
    if event_type == 'quiet_smallcap_rally':
        # Small cap funds get a positive May 2028 peak
        if 'small cap' in cat:
            return 0.07  # +7% in May
        if 'mid cap' in cat:
            return 0.03
        return None
    
    if event_type == 'quiet_it_cool':
        # IT-heavy funds get a small negative spread; surgical_event_delta returns None
        # because it cool spreads across the quarter, not one month
        return None
    
    return None


def extend_stock_monthly_prices(company, target_cmp_at_snapshot, snapshot_id, event_month, event_type,
                                  sector_map, snapshot_seed):
    """Extend a stock's monthly_prices by 3 months."""
    mp = company.get('monthly_prices')
    if not mp or not isinstance(mp, dict):
        return mp, None
    
    sorted_months = sorted(mp.keys())
    prior_end_month = sorted_months[-1]
    prior_end_price = mp[prior_end_month]
    
    last_month = None
    for sid, sdate, lm, em, et in SNAPSHOT_SEQUENCE:
        if sid == snapshot_id:
            last_month = lm
            break
    if not last_month:
        return mp, None
    
    new_months = months_in_quarter(prior_end_month, last_month)
    n = len(new_months)
    
    if prior_end_price <= 0 or target_cmp_at_snapshot <= 0:
        return mp, None
    
    target_q_return = target_cmp_at_snapshot / prior_end_price - 1.0
    
    name = company['name']
    sector = get_sector(name, sector_map)
    cap_tier = get_cap_tier(company.get('market_cap_rs_cr', 0))
    beta, idio_vol = get_stock_params(name)
    
    # Per-month stock drift = sector ann_drift / 12, vol = stock idio + sector vol
    ann_drift, sector_monthly_vol = SECTOR_PARAMS.get(sector, (0.10, 0.080))
    monthly_drift = ann_drift / 12.0
    monthly_vol = math.sqrt(sector_monthly_vol ** 2 + idio_vol ** 2)
    
    # Determine surgical event
    event_month_idx = None
    event_delta = None
    if event_type and event_month:
        try:
            event_month_idx = new_months.index(event_month)
            event_delta = compute_event_delta_for_stock(name, sector, cap_tier, event_type, new_months)
        except ValueError:
            event_month_idx = None
    
    stock_s = (hash(name) ^ snapshot_seed) & 0xFFFFFFFF
    rng = random.Random(stock_s)
    
    monthly_rets = calibrate_monthly_returns_to_target(
        target_q_return, n, monthly_drift, monthly_vol,
        event_month_idx, event_delta, rng
    )
    
    new_mp = dict(mp)
    price = prior_end_price
    for i, m in enumerate(new_months):
        price = price * (1.0 + monthly_rets[i])
        new_mp[m] = round(price, 2)
    
    return new_mp, monthly_rets


def compute_event_delta_for_stock(name, sector, cap_tier, event_type, new_months):
    """Determine the surgical event's per-month delta for this stock."""
    if event_type == 'stress_bank_shock':
        if sector == 'banks_private':
            return SURGICAL_EVENT_DELTAS['stress_bank_shock']['banks_private']['month_delta']
        if sector == 'banks_psu':
            return SURGICAL_EVENT_DELTAS['stress_bank_shock']['banks_psu']['month_delta']
        if sector == 'nbfc_financials':
            return SURGICAL_EVENT_DELTAS['stress_bank_shock']['nbfc_financials']['month_delta']
        if sector == 'insurance':
            return SURGICAL_EVENT_DELTAS['stress_bank_shock']['insurance']['month_delta']
        return None
    
    if event_type == 'stress_ril_idio':
        if name == 'Reliance Industries':
            return SURGICAL_EVENT_DELTAS['stress_ril_idio']['_stock_overrides']['Reliance Industries']['month_delta']
        if sector == 'petroleum_refining':
            return SURGICAL_EVENT_DELTAS['stress_ril_idio']['petroleum_refining']['month_delta']
        if sector == 'oil_gas_upstream':
            return SURGICAL_EVENT_DELTAS['stress_ril_idio']['oil_gas_upstream']['month_delta']
        if sector == 'city_gas_distribution':
            return SURGICAL_EVENT_DELTAS['stress_ril_idio']['city_gas_distribution']['month_delta']
        return None
    
    if event_type == 'quiet_smallcap_rally':
        if cap_tier == 'small':
            # event_month is May (peak), but we want to be agnostic; just return peak delta
            return 0.07
        if cap_tier == 'mid':
            return 0.04
        return None
    
    if event_type == 'stress_rate_cut':
        # Stocks don't get surgical effect; rate cut shows up in debt
        return None
    
    return None


# ============================================================================
# Phase C: Forward extension main routine
# ============================================================================

def extend_snapshot_from_prior(prior_enriched, current_snapshot, sector_map, snapshot_id, verbose=True):
    """
    Given a prior enriched snapshot and the current snapshot (which has been evolved by
    the quarterly engine but has frozen monthly_nav, etc.), produce the current snapshot
    with monthly series extended forward by 3 months and all derived metrics recomputed.
    """
    snapshot_seed = sum(ord(c) for c in snapshot_id) * 1009
    last_month, event_month, event_type = get_snapshot_window(snapshot_id)
    
    if verbose:
        print(f"[+] Extending to '{snapshot_id}' (end month: {last_month}, event: {event_type or 'none'} @ {event_month or 'N/A'})")
    
    # Deep copy the current snapshot
    extended = json.loads(json.dumps(current_snapshot))
    
    # Build lookup of prior monthly_nav, monthly_prices, etc.
    prior_mn = {f['fund_name']: f.get('monthly_nav', {}) for f in prior_enriched['mf_funds']}
    prior_mp = {c['name']: c.get('monthly_prices', {}) for c in prior_enriched['nifty500']['companies']}
    prior_indices = prior_enriched.get('indices', {})
    prior_fx = prior_enriched.get('fx', {}).get('usd_inr', {}).get('monthly_values', {})
    
    # ====================================================================
    # Stage 1: Extend stock monthly_prices
    # ====================================================================
    if verbose:
        print("[+] Stage 1: Extend stock monthly_prices forward")
    
    n_extended = 0
    n_skipped = 0
    monthly_prices_by_company = {}
    
    for c in extended['nifty500']['companies']:
        name = c['name']
        target_cmp = c.get('cmp_rs')
        prior = prior_mp.get(name, {})
        
        if not prior or target_cmp is None or target_cmp <= 0:
            c['monthly_prices'] = prior  # carry forward whatever exists
            n_skipped += 1
            continue
        
        # Inject prior monthly_prices into c for the extension function to use
        c['monthly_prices'] = prior
        new_mp, rets = extend_stock_monthly_prices(
            c, target_cmp, snapshot_id, event_month, event_type, sector_map, snapshot_seed
        )
        c['monthly_prices'] = new_mp if new_mp else prior
        if new_mp:
            monthly_prices_by_company[name] = new_mp
            n_extended += 1
        else:
            n_skipped += 1
    
    if verbose:
        print(f"    Extended: {n_extended}, skipped: {n_skipped}")
    
    # ====================================================================
    # Stage 2: Extend indices (derived from constituents, or synthesized)
    # ====================================================================
    if verbose:
        print("[+] Stage 2: Extend indices forward")
    
    months_full = months_between(LOOKBACK_START_MONTH, last_month)
    # Compute new months from prior nifty_50 series
    prior_nifty50 = prior_indices.get('nifty_50_tri', {}).get('monthly_values', {})
    if prior_nifty50:
        prior_idx_end = sorted(prior_nifty50.keys())[-1]
    else:
        prior_idx_end = LOOKBACK_START_MONTH
    new_months = months_in_quarter(prior_idx_end, last_month)
    
    indices_data = {}
    for index_id, name_idx, category, method in CANONICAL_INDICES:
        prior_vals = prior_indices.get(index_id, {}).get('monthly_values', {})
        new_vals = dict(prior_vals)
        
        if method == 'derive_from_constituents':
            # Recompute from constituents for the new months
            # Use the same constituent selection as Phase B
            extended_vals = derive_index_extension(
                index_id, extended['nifty500']['companies'],
                sector_map, monthly_prices_by_company, new_months, prior_vals
            )
            if extended_vals:
                new_vals.update(extended_vals)
        else:
            # Synthesize forward extension
            extended_vals = synthesize_index_extension(index_id, new_months, prior_vals, snapshot_seed, event_type)
            new_vals.update(extended_vals)
        
        # Sort
        new_vals_sorted = OrderedDict((k, new_vals[k]) for k in sorted(new_vals.keys()))
        indices_data[index_id] = {
            'name': name_idx,
            'category': category,
            'synthesis_method': method,
            'monthly_values': new_vals_sorted,
            'metadata': {
                'base_value': 1000.0,
                'base_month': sorted(new_vals.keys())[0] if new_vals else None,
                'currency': 'INR' if 'inr' in index_id or '_tri' in index_id or 'crisil' in index_id or 'nifty' in index_id else 'USD'
            }
        }
    
    extended['indices'] = indices_data
    if verbose:
        print(f"    Extended {len(indices_data)} indices")
    
    # ====================================================================
    # Stage 3: Extend FX
    # ====================================================================
    if verbose:
        print("[+] Stage 3: Extend FX forward")
    
    # Target USD/INR from current snapshot's macro
    t_usd_inr = None
    for dim in extended.get('macro', {}).get('data_snapshot', {}).get('dimensions', []):
        if 'GLOBAL' in dim.get('dimension', ''):
            for ind in dim.get('indicators', []):
                if 'USD/INR' in ind.get('indicator', ''):
                    v = ind.get('value', '')
                    if isinstance(v, str):
                        try:
                            t_usd_inr = float(v.split()[0])
                        except (ValueError, IndexError):
                            pass
    if t_usd_inr is None:
        t_usd_inr = list(prior_fx.values())[-1] if prior_fx else 94.787
    
    new_fx = dict(prior_fx)
    prior_end_month = sorted(prior_fx.keys())[-1]
    prior_end_fx = prior_fx[prior_end_month]
    fx_new_months = months_in_quarter(prior_end_month, last_month)
    fx_target_q_ret = t_usd_inr / prior_end_fx - 1.0
    
    rng = random.Random(0x554f53444e52 ^ snapshot_seed)
    fx_drift = 0.03 / 12.0
    fx_vol = 0.06 / math.sqrt(12)
    fx_rets = calibrate_monthly_returns_to_target(
        fx_target_q_ret, len(fx_new_months), fx_drift, fx_vol, None, None, rng
    )
    fx_val = prior_end_fx
    for i, m in enumerate(fx_new_months):
        fx_val = fx_val * (1.0 + fx_rets[i])
        new_fx[m] = round(fx_val, 3)
    
    extended['fx'] = {
        'usd_inr': {
            'monthly_values': OrderedDict((k, new_fx[k]) for k in sorted(new_fx.keys())),
            'metadata': {
                't_spot': t_usd_inr,
                'synthesis_method': 'drift_plus_gaussian_vol',
                'annual_drift_pct': 3.0,
                'annual_vol_pct': 6.0
            }
        },
        'eur_inr': None,
        'gbp_inr': None,
        'aed_inr': None
    }
    if verbose:
        print(f"    USD/INR: ...{prior_end_fx:.3f} -> {fx_val:.3f}")
    
    # ====================================================================
    # Stage 4: Extend MF monthly_nav, recompute period scalars and tier_b
    # ====================================================================
    if verbose:
        print("[+] Stage 4: Extend MF monthly_nav forward")
    
    n_mf_extended = 0
    n_mf_skipped = 0
    for f in extended['mf_funds']:
        name = f['fund_name']
        target_nav = f.get('NAV')
        prior_series = prior_mn.get(name, {})
        
        if not prior_series or target_nav is None or target_nav <= 0:
            f['monthly_nav'] = prior_series
            n_mf_skipped += 1
            continue
        
        # Inject prior into f for extension function
        f['monthly_nav'] = prior_series
        new_mn, rets = extend_mf_monthly_nav(f, target_nav, snapshot_id, event_month, event_type, snapshot_seed)
        f['monthly_nav'] = new_mn if new_mn else prior_series
        if new_mn:
            n_mf_extended += 1
        else:
            n_mf_skipped += 1
    
    if verbose:
        print(f"    Extended: {n_mf_extended}, skipped: {n_mf_skipped}")
    
    # ====================================================================
    # Stage 5: Recompute Tier B per stock and per MF
    # ====================================================================
    if verbose:
        print("[+] Stage 5: Recompute Tier B")
    
    n_tb_stocks = 0
    for c in extended['nifty500']['companies']:
        mp = c.get('monthly_prices')
        if not mp:
            c['tier_b_stats'] = {"data_window_insufficient": True, "reason": "no_monthly_prices"}
            continue
        sector = get_sector(c['name'], sector_map)
        cap_tier = get_cap_tier(c.get('market_cap_rs_cr', 0))
        bench = pick_benchmark_for_stock(c['name'], cap_tier, sector, indices_data)
        c['tier_b_stats'] = compute_tier_b_for_instrument(mp, bench)
        c['tier_b_stats']['_meta'] = {
            'sector': sector,
            'cap_tier': cap_tier,
            'benchmark_index_id': _resolve_bench_id(c['name'], cap_tier, sector)
        }
        n_tb_stocks += 1
    
    n_tb_mfs = 0
    for f in extended['mf_funds']:
        mn = f.get('monthly_nav')
        if not isinstance(mn, dict) or len(mn) < 12:
            f['tier_b_stats'] = {"data_window_insufficient": True, "reason": "monthly_nav_too_short"}
            continue
        f['tier_b_stats'] = compute_tier_b_for_instrument(mn, None)
        n_tb_mfs += 1
    
    if verbose:
        print(f"    Tier B: {n_tb_stocks} stocks, {n_tb_mfs} MFs")
    
    # ====================================================================
    # Stage 6: Recompute period return scalars and rolling_metrics for MFs
    # ====================================================================
    snap_date_str = None
    for sid, sdate, lm, em, et in SNAPSHOT_SEQUENCE:
        if sid == snapshot_id:
            snap_date_str = sdate
            break
    if snap_date_str:
        recompute_fund_period_scalars_and_rolling(extended, snap_date_str, verbose)
    
    # ====================================================================
    # Update snapshot_metadata to flag enrichment
    # ====================================================================
    sm = extended.get('snapshot_metadata', {})
    sm['enrichment_version'] = '0.2.0-phase-c-forward-extension'
    sm['enrichment_applied_at'] = date.today().isoformat()
    sm['snapshot_id_enrichment'] = snapshot_id
    extended['snapshot_metadata'] = sm
    
    return extended


def derive_index_extension(index_id, companies, sector_map, monthly_prices_by_company, new_months, prior_vals):
    """Compute index values for the new months from constituent prices."""
    selection_rule = INDEX_CONSTITUENTS.get(index_id, {})
    
    BROKEN = 2500000
    sorted_companies = sorted(
        [c for c in companies if (c.get('market_cap_rs_cr', 0) or 0) > 0 and (c.get('market_cap_rs_cr', 0) or 0) < BROKEN],
        key=lambda c: c['market_cap_rs_cr'],
        reverse=True
    )
    
    if 'top_n_by_mcap' in selection_rule:
        selected = sorted_companies[:selection_rule['top_n_by_mcap']]
    elif 'rank_range_by_mcap' in selection_rule:
        lo, hi = selection_rule['rank_range_by_mcap']
        selected = sorted_companies[lo-1:hi]
    elif 'cap_tier' in selection_rule:
        tier = selection_rule['cap_tier']
        selected = [c for c in companies if get_cap_tier(c.get('market_cap_rs_cr', 0)) == tier]
    elif 'sectors' in selection_rule:
        secs = set(selection_rule['sectors'])
        selected = [c for c in companies if get_sector(c['name'], sector_map) in secs]
    elif selection_rule.get('all'):
        selected = [c for c in companies if (c.get('market_cap_rs_cr', 0) or 0) > 0]
    else:
        return None
    
    if not selected:
        return None
    
    prior_end_month = sorted(prior_vals.keys())[-1]
    prior_end_val = prior_vals[prior_end_month]
    
    # For each new month, compute weighted-average return between this month and prior month
    all_months_back = [prior_end_month] + new_months
    out = {}
    cur_val = prior_end_val
    for i in range(1, len(all_months_back)):
        m_prev = all_months_back[i-1]
        m_curr = all_months_back[i]
        weighted_r = 0.0
        weight_sum = 0.0
        for c in selected:
            mp = monthly_prices_by_company.get(c['name'])
            if not mp: continue
            p_prev = mp.get(m_prev)
            p_curr = mp.get(m_curr)
            if not p_prev or not p_curr or p_prev <= 0:
                continue
            r = p_curr / p_prev - 1.0
            w = c.get('market_cap_rs_cr', 0) or 0
            weighted_r += r * w
            weight_sum += w
        if weight_sum > 0:
            avg_r = weighted_r / weight_sum + 0.00125  # TRI dividend uplift
            cur_val = cur_val * (1.0 + avg_r)
        out[m_curr] = round(cur_val, 2)
    return out


def synthesize_index_extension(index_id, new_months, prior_vals, snapshot_seed, event_type):
    """Synthesize forward extension for non-constituent indices (CRISIL, gold, S&P)."""
    if not prior_vals:
        return {}
    
    ann_drift, monthly_vol = NON_CONSTITUENT_INDEX_PARAMS.get(index_id, (0.10, 0.025))
    
    # Apply event boosts for rate-cut snapshot to debt indices
    extra_month_delta = 0
    if event_type == 'stress_rate_cut' and index_id in ('nifty_10y_gsec', 'crisil_dynamic_gilt'):
        extra_month_delta = 0.045  # land in event month
    elif event_type == 'stress_rate_cut' and index_id == 'crisil_composite_bond':
        extra_month_delta = 0.025
    elif event_type == 'stress_rate_cut' and index_id == 'crisil_short_term_bond':
        extra_month_delta = 0.015
    
    rng = random.Random((hash(index_id) ^ snapshot_seed) & 0xFFFFFFFF)
    monthly_drift = ann_drift / 12.0
    
    prior_end_month = sorted(prior_vals.keys())[-1]
    cur_val = prior_vals[prior_end_month]
    out = {}
    
    # event_month for rate cut is the first new month (Feb 2027 = idx 1 in months_in_quarter for t3)
    for i, m in enumerate(new_months):
        r = rng.gauss(monthly_drift, monthly_vol)
        if i == 0 and event_type == 'stress_rate_cut' and index_id in ('nifty_10y_gsec', 'crisil_dynamic_gilt', 'crisil_composite_bond', 'crisil_short_term_bond'):
            # actually rate cut is in Feb = second month of t3, but for simplicity put boost in any month
            # for now apply in middle month
            pass
        r = max(-0.10, min(0.10, r))
        # Apply event delta in second month if applicable
        if i == 1 and extra_month_delta != 0:
            r = extra_month_delta
        cur_val = cur_val * (1.0 + r)
        out[m] = round(cur_val, 2)
    
    return out


# ============================================================================
# Phase D: rolling_metrics and period return scalar recomputation
# ============================================================================

# Period return windows in months. Note: 7Y is stored as percentage in source
# (10.69 = 10.69%) while others are decimals (0.045 = 4.5%). We match that.
PERIOD_RETURN_WINDOWS = [
    ('1M',  1,   'decimal'),
    ('3M',  3,   'decimal'),
    ('6M',  6,   'decimal'),
    ('1Y',  12,  'decimal'),
    ('2Y',  24,  'decimal_annualized'),
    ('3Y',  36,  'decimal_annualized'),
    ('5Y',  60,  'decimal_annualized'),
    ('7Y',  84,  'percent_annualized'),  # Source stores as percentage
    ('10Y', 120, 'decimal_annualized'),
    ('15Y', 180, 'decimal_annualized'),
]


def compute_period_return(monthly_nav_sorted, window_months, fmt='decimal'):
    """
    Compute a period return from a sorted monthly_nav dict.
    
    fmt='decimal': total return over window as decimal (e.g. 0.045 = 4.5%)
    fmt='decimal_annualized': annualized return as decimal
    fmt='percent_annualized': annualized return as percentage (matches source 7Y convention)
    
    Returns None if insufficient history.
    """
    keys = list(monthly_nav_sorted.keys())
    if len(keys) < window_months + 1:
        return None
    
    end_nav = monthly_nav_sorted[keys[-1]]
    start_nav = monthly_nav_sorted[keys[-1 - window_months]]
    
    if start_nav is None or end_nav is None or start_nav <= 0 or end_nav <= 0:
        return None
    
    total_return = end_nav / start_nav - 1.0
    
    if fmt == 'decimal':
        return round(total_return, 6)
    elif fmt == 'decimal_annualized':
        years = window_months / 12.0
        ann = (1 + total_return) ** (1.0 / years) - 1
        return round(ann, 6)
    elif fmt == 'percent_annualized':
        years = window_months / 12.0
        ann = (1 + total_return) ** (1.0 / years) - 1
        return round(ann * 100, 2)
    return None


def compute_period_return_scalars(monthly_nav, snapshot_date_str):
    """
    Compute the full set of period return scalars from an extended monthly_nav.
    Returns a dict ready to merge into the fund record.
    Also computes MTD and YTD from the snapshot_date.
    """
    if not isinstance(monthly_nav, dict) or len(monthly_nav) < 2:
        return {}
    
    sorted_mn = OrderedDict((k, monthly_nav[k]) for k in sorted(monthly_nav.keys()))
    out = {}
    
    for label, window, fmt in PERIOD_RETURN_WINDOWS:
        v = compute_period_return(sorted_mn, window, fmt)
        if v is not None:
            out[label] = v
    
    # MTD: not derivable from monthly NAV (need daily); approximate as 1M
    # YTD: months since January of snapshot year
    try:
        snap_year = int(snapshot_date_str[:4])
        snap_month = int(snapshot_date_str[5:7])
        ytd_months = snap_month  # months from start of year to snapshot
        if ytd_months > 0:
            v = compute_period_return(sorted_mn, ytd_months, 'decimal')
            if v is not None:
                out['YTD'] = round(v * 100, 2)  # source YTD is percentage
        # MTD: derive from latest available month vs prior month
        # (Approximate; real MTD needs daily prices)
        keys = list(sorted_mn.keys())
        if len(keys) >= 2:
            mtd_return = (sorted_mn[keys[-1]] / sorted_mn[keys[-2]] - 1) * 100
            out['MTD'] = round(mtd_return, 2)  # source MTD is percentage
    except (ValueError, KeyError, IndexError):
        pass
    
    return out


def compute_rolling_metrics_from_series(monthly_nav, category_funds_monthly_navs=None):
    """
    Compute rolling_metrics from extended monthly_nav.
    
    If category_funds_monthly_navs is provided (list of other funds' monthly_nav
    in the same category), computes category-relative metrics. Otherwise leaves
    those fields as None.
    
    Formulas:
    - max_drawdown: full-history max DD
    - max_dd_recovery_months: months to recover from historical max DD (or None if not recovered)
    - rolling_3y_pct_beat_cat: fraction of rolling 36M windows where fund return > category median
    - rolling_3y_avg_excess: mean of (fund 36M return - category 36M return) across rolling windows
    - rolling_5y_*: same with 60M
    - alpha_trend_slope: slope of linear regression on rolling 36M excess returns
    - alpha_trend_direction: 'improving' / 'stable' / 'deteriorating' from slope
    - regime_stability: stdev of rolling 36M excess returns (lower = more stable)
    - upside_capture_3y / downside_capture_3y: vs category median, last 36M
    - rolling_ir_current: latest 36M IR (excess return / tracking error vs category)
    """
    if not isinstance(monthly_nav, dict) or len(monthly_nav) < 12:
        return {}
    
    sorted_mn = OrderedDict((k, monthly_nav[k]) for k in sorted(monthly_nav.keys()))
    keys = list(sorted_mn.keys())
    vals = [sorted_mn[k] for k in keys]
    
    out = {}
    
    # Full-history max DD
    peak = vals[0]
    mdd = 0.0
    mdd_idx = 0
    peak_idx = 0
    for i, v in enumerate(vals):
        if v is None or v <= 0:
            continue
        if v > peak:
            peak = v
            peak_idx = i
        dd = (v - peak) / peak
        if dd < mdd:
            mdd = dd
            mdd_idx = i
    out['max_drawdown'] = round(mdd, 6)
    
    # Recovery months: how many months from mdd_idx until value reaches the peak again
    if mdd < 0 and peak_idx < mdd_idx:
        recovery_idx = None
        for i in range(mdd_idx, len(vals)):
            if vals[i] is not None and vals[i] >= peak:
                recovery_idx = i
                break
        if recovery_idx is not None:
            out['max_dd_recovery_months'] = float(recovery_idx - mdd_idx)
        else:
            out['max_dd_recovery_months'] = None  # not yet recovered
    else:
        out['max_dd_recovery_months'] = 0.0
    
    # Compute fund monthly returns
    rets = []
    for i in range(1, len(vals)):
        if vals[i-1] and vals[i] and vals[i-1] > 0:
            rets.append(vals[i] / vals[i-1] - 1)
        else:
            rets.append(None)
    
    # Category-relative metrics
    if category_funds_monthly_navs and len(category_funds_monthly_navs) >= 3:
        # Compute category median return for each month
        cat_median_rets = _compute_category_median_returns(category_funds_monthly_navs, keys)
        
        # Rolling 36M windows
        win = 36
        rolling_3y_excess = []
        rolling_3y_fund_returns = []
        rolling_3y_cat_returns = []
        for end_idx in range(win, len(rets) + 1):
            window_rets = rets[end_idx - win:end_idx]
            window_cat = cat_median_rets[end_idx - win:end_idx] if cat_median_rets else None
            if window_cat and all(r is not None for r in window_rets) and all(r is not None for r in window_cat):
                fund_total = 1.0
                cat_total = 1.0
                for r in window_rets: fund_total *= (1 + r)
                for r in window_cat: cat_total *= (1 + r)
                fund_total -= 1
                cat_total -= 1
                rolling_3y_excess.append(fund_total - cat_total)
                rolling_3y_fund_returns.append(fund_total)
                rolling_3y_cat_returns.append(cat_total)
        
        if rolling_3y_excess:
            pct_beat = sum(1 for e in rolling_3y_excess if e > 0) / len(rolling_3y_excess)
            avg_excess = sum(rolling_3y_excess) / len(rolling_3y_excess)
            out['rolling_3y_pct_beat_cat'] = round(pct_beat, 4)
            out['rolling_3y_avg_excess'] = round(avg_excess, 6)
            
            # Alpha trend: linear regression slope on rolling_3y_excess
            n = len(rolling_3y_excess)
            xs = list(range(n))
            x_mean = sum(xs) / n
            y_mean = sum(rolling_3y_excess) / n
            num = sum((xs[i] - x_mean) * (rolling_3y_excess[i] - y_mean) for i in range(n))
            den = sum((xs[i] - x_mean) ** 2 for i in range(n))
            slope = num / den if den != 0 else 0
            out['alpha_trend_slope'] = round(slope, 6)
            if slope > 0.0005:
                out['alpha_trend_direction'] = 'improving'
            elif slope < -0.0005:
                out['alpha_trend_direction'] = 'deteriorating'
            else:
                out['alpha_trend_direction'] = 'stable'
            
            # Regime stability: stdev of rolling excess returns
            if len(rolling_3y_excess) > 1:
                var_e = sum((e - y_mean) ** 2 for e in rolling_3y_excess) / (len(rolling_3y_excess) - 1)
                out['regime_stability'] = round(math.sqrt(var_e), 6)
        
        # Rolling 60M for 5Y
        win5 = 60
        rolling_5y_excess = []
        for end_idx in range(win5, len(rets) + 1):
            window_rets = rets[end_idx - win5:end_idx]
            window_cat = cat_median_rets[end_idx - win5:end_idx] if cat_median_rets else None
            if window_cat and all(r is not None for r in window_rets) and all(r is not None for r in window_cat):
                fund_total = 1.0; cat_total = 1.0
                for r in window_rets: fund_total *= (1 + r)
                for r in window_cat: cat_total *= (1 + r)
                rolling_5y_excess.append((fund_total - 1) - (cat_total - 1))
        
        if rolling_5y_excess:
            out['rolling_5y_pct_beat_cat'] = round(sum(1 for e in rolling_5y_excess if e > 0) / len(rolling_5y_excess), 4)
            out['rolling_5y_avg_excess'] = round(sum(rolling_5y_excess) / len(rolling_5y_excess), 6)
        
        # Upside/downside capture (last 36M)
        if len(rets) >= 36 and cat_median_rets:
            recent_rets = rets[-36:]
            recent_cat = cat_median_rets[-36:]
            up_fund = []
            up_cat = []
            down_fund = []
            down_cat = []
            for i in range(36):
                if recent_rets[i] is None or recent_cat[i] is None:
                    continue
                if recent_cat[i] > 0:
                    up_fund.append(recent_rets[i])
                    up_cat.append(recent_cat[i])
                elif recent_cat[i] < 0:
                    down_fund.append(recent_rets[i])
                    down_cat.append(recent_cat[i])
            
            if up_cat and sum(up_cat) != 0:
                out['upside_capture_3y'] = round(sum(up_fund) / sum(up_cat), 4)
            if down_cat and sum(down_cat) != 0:
                out['downside_capture_3y'] = round(sum(down_fund) / sum(down_cat), 4)
        
        # Rolling IR current: latest 36M IR
        if len(rets) >= 36 and cat_median_rets:
            recent_rets = [r for r in rets[-36:] if r is not None]
            recent_cat = [c for c in cat_median_rets[-36:] if c is not None]
            if len(recent_rets) == 36 and len(recent_cat) == 36:
                fund_total_ann = ((1.0 + sum(math.log(1+r) for r in recent_rets) / 36) ** 12) - 1
                cat_total_ann = ((1.0 + sum(math.log(1+r) for r in recent_cat) / 36) ** 12) - 1
                excess = fund_total_ann - cat_total_ann
                # Tracking error
                diffs = [recent_rets[i] - recent_cat[i] for i in range(36)]
                mean_d = sum(diffs) / 36
                var_d = sum((d - mean_d) ** 2 for d in diffs) / 35
                te_ann = math.sqrt(var_d) * math.sqrt(12)
                if te_ann > 0:
                    out['rolling_ir_current'] = round(excess / te_ann, 4)
    
    return out


def _compute_category_median_returns(category_funds_monthly_navs, target_months):
    """
    For each month in target_months (after the first), compute the median
    of category fund returns for that month.
    Returns list of length len(target_months) - 1 (returns require prior month).
    """
    if not category_funds_monthly_navs:
        return None
    
    median_rets = [None]  # first month has no prior, no return
    for i in range(1, len(target_months)):
        m_curr = target_months[i]
        m_prev = target_months[i-1]
        cat_rets = []
        for fund_mn in category_funds_monthly_navs:
            if m_prev in fund_mn and m_curr in fund_mn:
                p = fund_mn[m_prev]
                c = fund_mn[m_curr]
                if p and c and p > 0:
                    cat_rets.append(c / p - 1)
        if cat_rets:
            cat_rets.sort()
            median = cat_rets[len(cat_rets) // 2]
            median_rets.append(median)
        else:
            median_rets.append(None)
    return median_rets


def recompute_fund_period_scalars_and_rolling(extended, snapshot_date_str, verbose=True):
    """
    For each fund in the extended snapshot:
    - Recompute period return scalars (1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 15Y, MTD, YTD)
    - Recompute rolling_metrics
    Done in place on the extended snapshot.
    """
    if verbose:
        print(f"[+] Recomputing period scalars and rolling_metrics for {len(extended['mf_funds'])} funds")
    
    # Build category-level monthly_nav lookup for category-relative metrics
    from collections import defaultdict
    cat_to_funds_mn = defaultdict(list)
    for f in extended['mf_funds']:
        cat = f.get('sebi_category')
        mn = f.get('monthly_nav')
        if cat and isinstance(mn, dict) and len(mn) >= 12:
            cat_to_funds_mn[cat].append(mn)
    
    n_period = 0
    n_rolling = 0
    for f in extended['mf_funds']:
        mn = f.get('monthly_nav')
        if not isinstance(mn, dict) or len(mn) < 2:
            continue
        
        # Period scalars
        period_scalars = compute_period_return_scalars(mn, snapshot_date_str)
        for k, v in period_scalars.items():
            f[k] = v
        if period_scalars:
            n_period += 1
        
        # Rolling metrics
        cat = f.get('sebi_category')
        cat_funds = [m for m in cat_to_funds_mn.get(cat, []) if m is not mn]
        rm = compute_rolling_metrics_from_series(mn, cat_funds)
        if rm:
            # Preserve any source fields we don't recompute by merging
            existing = f.get('rolling_metrics', {})
            if isinstance(existing, dict):
                existing.update(rm)
                f['rolling_metrics'] = existing
            else:
                f['rolling_metrics'] = rm
            n_rolling += 1
    
    if verbose:
        print(f"    Period scalars updated: {n_period}, rolling_metrics updated: {n_rolling}")




def enrich_snapshot(baseline, sector_map, snapshot_id='t0_q2_2026', verbose=True):
    """
    Apply Phase B enrichment to a baseline (t0-shaped) snapshot.
    Returns enriched snapshot dict.
    """
    snapshot_seed = sum(ord(c) for c in snapshot_id) * 1009
    
    months = months_between(LOOKBACK_START_MONTH, T0_MONTH)
    if verbose:
        print(f"[+] Enriching snapshot '{snapshot_id}'")
        print(f"    Months in synthesis window: {len(months)} ({months[0]} to {months[-1]})")
    
    # Deep copy the baseline to avoid mutating input
    enriched = json.loads(json.dumps(baseline))
    
    # ====================================================================
    # Stage 1: Stock monthly_prices synthesis
    # ====================================================================
    if verbose:
        print("[+] Stage 1: Stock monthly_prices synthesis")
    
    market_factor = synthesize_market_factor(months, snapshot_seed)
    cap_tier_factors = synthesize_cap_tier_factors(months, snapshot_seed)
    sector_returns = synthesize_sector_monthly_returns(sector_map, months, market_factor, cap_tier_factors)
    if verbose:
        print(f"    Synthesized market factor + {len(cap_tier_factors)} cap-tier factors + {len(sector_returns)} sector idio series")
    
    monthly_prices_by_company = {}
    n_synthesized = 0
    n_skipped = 0
    for c in enriched['nifty500']['companies']:
        mp = synthesize_stock_monthly_prices(c, sector_map, market_factor, cap_tier_factors, sector_returns, months, snapshot_seed)
        if mp is not None:
            c['monthly_prices'] = mp
            monthly_prices_by_company[c['name']] = mp
            n_synthesized += 1
        else:
            c['monthly_prices'] = None
            n_skipped += 1
    if verbose:
        print(f"    Synthesized: {n_synthesized}, skipped (no cmp_rs): {n_skipped}")
    
    # ====================================================================
    # Stage 2: Index series
    # ====================================================================
    if verbose:
        print("[+] Stage 2: Index series")
    
    indices_data = {}
    for index_id, name, category, method in CANONICAL_INDICES:
        if method == 'derive_from_constituents':
            series = derive_index_from_constituents(
                index_id, enriched['nifty500']['companies'],
                sector_map, monthly_prices_by_company, months
            )
        else:
            series = synthesize_non_constituent_index(index_id, months, snapshot_seed)
        indices_data[index_id] = {
            'name': name,
            'category': category,
            'synthesis_method': method,
            'monthly_values': series,
            'metadata': {
                'base_value': 1000.0,
                'base_month': months[0],
                'currency': 'INR' if 'inr' in index_id or '_tri' in index_id or 'crisil' in index_id or 'nifty' in index_id else 'USD'
            }
        }
        if verbose:
            sm0 = series[months[0]] if series else None
            smT = series[months[-1]] if series else None
            print(f"    {index_id}: {sm0} -> {smT}")
    
    enriched['indices'] = indices_data
    
    # ====================================================================
    # Stage 3: FX series
    # ====================================================================
    if verbose:
        print("[+] Stage 3: FX series")
    
    # Find USD/INR spot value from macro
    t0_usd_inr = 94.787  # fallback
    for dim in enriched.get('macro', {}).get('data_snapshot', {}).get('dimensions', []):
        if 'GLOBAL' in dim.get('dimension', ''):
            for ind in dim.get('indicators', []):
                if 'USD/INR' in ind.get('indicator', ''):
                    v = ind.get('value', '')
                    if isinstance(v, str):
                        # Parse "94.787 (Apr 29, today)"
                        try:
                            t0_usd_inr = float(v.split()[0])
                        except (ValueError, IndexError):
                            pass
    
    fx_usd_inr = synthesize_fx_series(months, t0_usd_inr, snapshot_seed)
    enriched['fx'] = {
        'usd_inr': {
            'monthly_values': fx_usd_inr,
            'metadata': {
                't0_spot': t0_usd_inr,
                'synthesis_method': 'drift_plus_gaussian_vol',
                'annual_drift_pct': 3.0,
                'annual_vol_pct': 6.0
            }
        },
        'eur_inr': None,  # reserved for future
        'gbp_inr': None,
        'aed_inr': None
    }
    if verbose:
        print(f"    USD/INR: {fx_usd_inr[months[0]]} -> {fx_usd_inr[months[-1]]}")
    
    # ====================================================================
    # Stage 4: Tier B per-stock stats
    # ====================================================================
    if verbose:
        print("[+] Stage 4: Tier B per-stock stats")
    
    tier_b_computed = 0
    for c in enriched['nifty500']['companies']:
        mp = c.get('monthly_prices')
        if not mp:
            c['tier_b_stats'] = {"data_window_insufficient": True, "reason": "no_monthly_prices"}
            continue
        sector = get_sector(c['name'], sector_map)
        cap_tier = get_cap_tier(c.get('market_cap_rs_cr', 0))
        bench = pick_benchmark_for_stock(c['name'], cap_tier, sector, indices_data)
        c['tier_b_stats'] = compute_tier_b_for_instrument(mp, bench)
        c['tier_b_stats']['_meta'] = {
            'sector': sector,
            'cap_tier': cap_tier,
            'benchmark_index_id': _resolve_bench_id(c['name'], cap_tier, sector)
        }
        tier_b_computed += 1
    if verbose:
        print(f"    Tier B computed for {tier_b_computed} stocks")
    
    # ====================================================================
    # Stage 5: MF Tier B refresh (use existing monthly_nav at t0)
    # ====================================================================
    if verbose:
        print("[+] Stage 5: MF Tier B refresh")
    
    mf_tier_b_computed = 0
    mf_tier_b_skipped = 0
    for f in enriched['mf_funds']:
        mn = f.get('monthly_nav')
        if not isinstance(mn, dict) or len(mn) < 12:
            f['tier_b_stats'] = {"data_window_insufficient": True, "reason": "monthly_nav_too_short"}
            mf_tier_b_skipped += 1
            continue
        # No benchmark mapping for MFs in Phase B; just compute the standalone stats
        # Phase C will add benchmark_resolution mapping
        f['tier_b_stats'] = compute_tier_b_for_instrument(mn, None)
        mf_tier_b_computed += 1
    if verbose:
        print(f"    Tier B computed for {mf_tier_b_computed} MFs, skipped {mf_tier_b_skipped}")
    
    # ====================================================================
    # Snapshot metadata
    # ====================================================================
    enriched['snapshot_metadata'] = enriched.get('snapshot_metadata', {})
    enriched['snapshot_metadata'].update({
        'enrichment_version': '0.1.0-phase-b-t0-prototype',
        'enrichment_applied_at': date.today().isoformat(),
        'lookback_months': LOOKBACK_MONTHS,
        'lookback_start_month': months[0],
        'lookback_end_month': months[-1],
        'new_fields_added': [
            'nifty500.companies[].monthly_prices',
            'nifty500.companies[].tier_b_stats',
            'indices (new top-level block, 16 canonical indices)',
            'fx (new top-level block, USD/INR with EUR/GBP/AED reserved)',
            'mf_funds[].tier_b_stats',
        ],
        'sector_map_version': sector_map['_meta']['schema_version'],
        'rng_seed': snapshot_seed,
    })
    
    return enriched


# Helper for resolution (called from main pipeline)
def _resolve_bench_id(name, cap_tier, sector):
    if sector in ('banks_private', 'banks_psu'):
        return 'nifty_bank_tri'
    if sector in ('it_services', 'it_products'):
        return 'nifty_it_tri'
    if cap_tier == 'large':
        return 'nifty_50_tri'
    if cap_tier == 'mid':
        return 'nifty_midcap_150_tri'
    return 'nifty_smallcap_250_tri'


# ============================================================================
# CLI
# ============================================================================

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mode', choices=['t0', 'sequence'], default='t0',
                    help='t0: enrich baseline only. sequence: enrich t0 then forward-extend t1..t8')
    ap.add_argument('--input', help='Path to baseline snapshot JSON (mode=t0)')
    ap.add_argument('--output', help='Path to write enriched snapshot (mode=t0)')
    ap.add_argument('--input-dir', help='Path to directory with t0..t8 snapshots (mode=sequence)')
    ap.add_argument('--output-dir', help='Path to write enriched snapshots (mode=sequence)')
    ap.add_argument('--sector-map', default=DEFAULT_SECTOR_MAP_PATH)
    ap.add_argument('--snapshot-id', default='t0_q2_2026')
    ap.add_argument('--quiet', action='store_true')
    args = ap.parse_args()
    
    with open(args.sector_map) as f:
        sector_map = json.load(f)
    
    if args.mode == 't0':
        if not args.input or not args.output:
            ap.error("--mode t0 requires --input and --output")
        with open(args.input) as f:
            baseline = json.load(f)
        enriched = enrich_snapshot(baseline, sector_map, args.snapshot_id, verbose=not args.quiet)
        with open(args.output, 'w') as f:
            json.dump(enriched, f, separators=(',', ':'))
        if not args.quiet:
            size_mb = os.path.getsize(args.output) / 1024 / 1024
            print(f"\n[+] Wrote {args.output} ({size_mb:.2f} MB)")
    else:
        if not args.input_dir or not args.output_dir:
            ap.error("--mode sequence requires --input-dir and --output-dir")
        os.makedirs(args.output_dir, exist_ok=True)
        
        # Process t0 first
        t0_path = os.path.join(args.input_dir, 'snapshot_t0_q2_2026.json')
        with open(t0_path) as f:
            t0_base = json.load(f)
        if not args.quiet:
            print(f"\n=== t0_q2_2026: baseline enrichment ===")
        prior_enriched = enrich_snapshot(t0_base, sector_map, 't0_q2_2026', verbose=not args.quiet)
        out_path = os.path.join(args.output_dir, 'snapshot_t0_q2_2026.json')
        with open(out_path, 'w') as f:
            json.dump(prior_enriched, f, separators=(',', ':'))
        if not args.quiet:
            print(f"[+] Wrote {out_path} ({os.path.getsize(out_path)/1024/1024:.2f} MB)")
        
        # Forward extension t1..t8
        for sid, sdate, lm, em, et in SNAPSHOT_SEQUENCE[1:]:
            if not args.quiet:
                print(f"\n=== {sid}: forward extension ===")
            in_path = os.path.join(args.input_dir, f'snapshot_{sid}.json')
            with open(in_path) as f:
                current_raw = json.load(f)
            extended = extend_snapshot_from_prior(prior_enriched, current_raw, sector_map, sid, verbose=not args.quiet)
            out_path = os.path.join(args.output_dir, f'snapshot_{sid}.json')
            with open(out_path, 'w') as f:
                json.dump(extended, f, separators=(',', ':'))
            if not args.quiet:
                print(f"[+] Wrote {out_path} ({os.path.getsize(out_path)/1024/1024:.2f} MB)")
            prior_enriched = extended


if __name__ == '__main__':
    main()
