"""Regenerate fund monthly_nav to co-move with the resolved canonical index.

ADR-0014. For every fund that resolves to a canonical-16 benchmark, the
post-2019 (index-overlap) portion of monthly_nav is regenerated as a
single-factor series r_F = alpha + beta*r_B + eps, with (alpha, beta,
sigma_eps) calibrated per fund so the regenerated series reproduces the
existing tier_b_stats (vol_3y exactly; return implied by sharpe_3y exactly;
sortino/maxDD/calmar within tolerance) and the pre-2019 path and level are
kept continuous. Deterministic: seed is derived from amfi_code.

Not regenerated: Type-1 (benchmark_structurally_inapplicable), Type-2
(benchmark_not_in_snapshot), and data_window_insufficient funds. Stocks,
indices, fx, rolling_metrics untouched.

Run:
  python3 scripts/regenerate_fund_nav.py --validate   # in-memory t0, 10-fund sample, no writes
  python3 scripts/regenerate_fund_nav.py --write       # regenerate + write back t0..t8
"""

import argparse
import json
import math
import os
import random
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import enrich_snapshots as E  # __main__ guarded; stat functions reused for consistency

ENRICHED_DIR = os.path.join(os.path.dirname(__file__), "..", "fixtures", "snapshots", "enriched")
SNAPSHOT_IDS = [
    "t0_q2_2026", "t1_q3_2026", "t2_q4_2026", "t3_q1_2027", "t4_q2_2027",
    "t5_q3_2027", "t6_q4_2027", "t7_q1_2028", "t8_q2_2028",
]
CANON = {
    "nifty_50_tri", "nifty_next_50_tri", "nifty_100_tri", "nifty_midcap_150_tri",
    "nifty_smallcap_250_tri", "nifty_500_tri", "bse_sensex_tri", "nifty_bank_tri",
    "nifty_it_tri", "crisil_composite_bond", "crisil_short_term_bond",
    "crisil_dynamic_gilt", "nifty_10y_gsec", "crisil_liquid", "gold_inr", "sp_500_tri_inr",
}

# ---- benchmark_resolution (Step 3 Rulings A-D + tracked-index detector) ----

def _name_to_idx(s):
    if not s:
        return None
    t = re.sub(r"\s+", " ", str(s).strip().lower())
    if "+" in t or "%" in t or "silver" in t:
        return None
    if "gold" in t:
        return "gold_inr"
    if any(k in t for k in ["nasdaq", "s&p 500", "s and p 500", "russell 1000", "msci usa", "s&p global 1200", "us treasury"]):
        return "sp_500_tri_inr"
    if any(k in t for k in ["msci", "golden dragon", "asean", "europe", "acwi", "emerging market", "world index", "asia pacific", "bharat bond", "sdl", "ibx", "psu bond"]):
        return None
    if any(k in t for k in ["momentum", "quality", "low volatility", "low vol", "alpha", "equal weight", "value 20", "value 30", "dividend", "consumption", "healthcare", "pharma", "defence", "infrastructure", "commodit", "mnc", "tourism", "chemical", "housing", "capital market", "internet", "financial services", "realty", "reit", "metal", "auto", "fmcg", "media", "psu", "energy", "manufactur", "digital", "innovation", "esg"]):
        return None
    if "nifty bank" in t:
        return "nifty_bank_tri"
    if t.startswith("nifty it") or " nifty it" in t:
        return "nifty_it_tri"
    if re.search(r"\bnext 50\b", t):
        return "nifty_next_50_tri"
    if re.search(r"\bnifty 50\b", t) and not any(k in t for k in ["arbitrage", "hybrid", "value", "equal", "next"]):
        return "nifty_50_tri"
    if re.search(r"\bnifty 100\b", t) and not any(k in t for k in ["low", "quality", "equal", "alpha"]):
        return "nifty_100_tri"
    if "nifty 500" in t and not any(k in t for k in ["multicap", "momentum", "quality", "value"]):
        return "nifty_500_tri"
    if "midcap 150" in t and "momentum" not in t:
        return "nifty_midcap_150_tri"
    if "smallcap 250" in t:
        return "nifty_smallcap_250_tri"
    if "sensex" in t:
        return "bse_sensex_tri"
    if "arbitrage" in t:
        return "crisil_liquid"
    if any(k in t for k in ["liquid", "overnight", "1d rate", "money market"]):
        return "crisil_liquid"
    if "10 year" in t or "10y g" in t or "g-sec" in t or "gilt" in t:
        return "crisil_dynamic_gilt"
    if any(k in t for k in ["short duration", "short term", "ultra short", "low duration"]):
        return "crisil_short_term_bond"
    if any(k in t for k in ["composite debt", "corporate bond", "dynamic bond", "medium duration", "long duration"]):
        return "crisil_composite_bond"
    return None

EQ_BROAD = {"Flexi Cap Fund", "Multi Cap Fund", "Large & Mid Cap Fund", "Focused Fund",
            "Value Fund", "Contra Fund", "Dividend Yield Fund", "ELSS"}
ACCRUAL = {"Corporate Bond Fund", "Short Duration Fund", "Ultra Short Duration Fund",
           "Low Duration Fund", "Floater Fund", "Banking and PSU Fund", "Credit Risk Fund"}
DURATION = {"Dynamic Bond", "Medium Duration Fund", "Medium to Long Duration Fund"}
PASSIVE = {"Equity Index Funds", "ETFs- Equity", "Passive ELSS", "Debt Index Funds",
           "ETFs- Debt", "ETFs- Commodity", "ETFs- Global"}
T1 = {"Dynamic Asset Allocation or Bal", "Multi Asset Allocation", "Equity Savings",
      "Conservative Hybrid Fund", "Retirement Fund", "Childrens Fund"}

# Target R-squared by resolution class / category (ADR-0014). beta is DERIVED
# from R-squared and the fund/benchmark vol ratio, so a low-vol fund versus a
# high-vol index gets a low beta even when highly correlated (correct). A
# passive tracker is near-perfectly explained by its index; active equity less
# so; a hybrid least (it carries a debt sleeve the equity index cannot explain).
def _r2_target(path, cat):
    if path in ("source-string", "tracked-index"):
        return 0.985  # tracking regime: NAV is the index plus small tracking error
    if cat in ("Large Cap Fund", "Mid Cap Fund", "Small Cap Fund") or cat in EQ_BROAD:
        return 0.80
    if cat == "Aggressive Hybrid Fund":
        return 0.65
    # debt funds versus a debt index: looser comovement (duration/credit mix)
    return 0.55


def resolve(f):
    tb = f.get("tier_b_stats")
    if isinstance(tb, dict) and tb.get("data_window_insufficient"):
        return (None, "data_window_insufficient", "data_window_insufficient")
    cat = f.get("sebi_category") or "(none)"
    s = f.get("Benchmark Index")
    if isinstance(s, str) and s.strip():
        v = _name_to_idx(s)
        if v in CANON:
            return (v, "source-string", None)
        return (None, "source-string-noncanon", "benchmark_not_in_snapshot")
    if cat in PASSIVE:
        v = _name_to_idx(f.get("fund_name", ""))
        if v in CANON:
            return (v, "tracked-index", None)
        return (None, "passive-untracked", "benchmark_not_in_snapshot")
    if cat == "Large Cap Fund":
        return ("nifty_50_tri", "category-clean", None)
    if cat == "Mid Cap Fund":
        return ("nifty_midcap_150_tri", "category-clean", None)
    if cat == "Small Cap Fund":
        return ("nifty_smallcap_250_tri", "category-clean", None)
    if cat in ("Liquid Fund", "Overnight Fund", "Money Market Fund", "Arbitrage Fund"):
        return ("crisil_liquid", "category-clean", None)
    if cat == "Gilt Fund with 10 year Constant":
        return ("nifty_10y_gsec", "category-clean", None)
    if cat == "Gilt Fund":
        return ("crisil_dynamic_gilt", "category-clean", None)
    if cat in EQ_BROAD or cat == "Aggressive Hybrid Fund":
        return ("nifty_500_tri", "defensible", None)
    if cat in ACCRUAL:
        return ("crisil_short_term_bond", "defensible", None)
    if cat in DURATION:
        return ("crisil_composite_bond", "defensible", None)
    if cat == "Long Duration Fund":
        return ("nifty_10y_gsec", "defensible", None)
    if cat in T1:
        return (None, "structural", "benchmark_structurally_inapplicable")
    if cat in ("FoFs Domestic", "FoFs Overseas", "Sectoral- Foreign Equity"):
        return (None, "fof/intl", "benchmark_not_in_snapshot")
    return (None, "nocat", "benchmark_not_in_snapshot")


def _stats_from_series(series):
    rets = E.compute_returns_from_series(series)
    return rets


def regenerate_one(fund, idx_series, seed):
    """Return a new monthly_nav dict for a resolvable fund, calibrated to its
    existing tier_b_stats. Returns (new_nav, converged_bool, diag)."""
    nav = fund.get("monthly_nav")
    tb = fund.get("tier_b_stats") or {}
    if not isinstance(nav, dict) or not nav or not idx_series:
        return None, False, "no_series"
    v3 = tb.get("vol_3y_annualized")
    s3 = tb.get("sharpe_3y")
    if v3 is None or s3 is None or v3 <= 0:
        return None, False, "no_target_stats"

    months = sorted(nav.keys())
    idx_months = sorted(idx_series.keys())
    idx_start = idx_months[0]
    # splice: last fund month strictly before the index window starts
    pre = [m for m in months if m < idx_start]
    regen_months = [m for m in months if m >= idx_start]
    if len(regen_months) < 24:
        return None, False, "overlap_too_short"
    splice_val = nav[pre[-1]] if pre else nav[regen_months[0]]

    # benchmark monthly log returns aligned to the regen window
    rB = {}
    for i in range(1, len(idx_months)):
        a, b = idx_series[idx_months[i - 1]], idx_series[idx_months[i]]
        if a and b and a > 0 and b > 0:
            rB[idx_months[i]] = math.log(b / a)
    common = [m for m in regen_months if m in rB]
    if len(common) < 24:
        return None, False, "aligned_too_short"

    # 36-month calibration window (what tier_b 3y reads): last 36 of common
    w = common[-36:] if len(common) >= 36 else common
    bvals = [rB[m] for m in w]
    n = len(bvals)
    mean_B = sum(bvals) / n
    var_B = sum((x - mean_B) ** 2 for x in bvals) / (n - 1)

    # targets from existing tier_b (preserved exactly: vol_3y, and the return
    # implied by sharpe_3y at the documented RF; sortino/maxDD reported)
    target_var_m = (v3 / math.sqrt(12.0)) ** 2          # monthly var (ddof=1), annualised_vol convention
    target_ann_r = s3 * v3 + E.RISK_FREE_ANN            # sharpe = (ann_r - rf)/vol
    target_mean_log = math.log(1.0 + target_ann_r) / 12.0
    if var_B <= 0:
        return None, False, "degenerate_benchmark"

    path, cat = fund.get("_rr_path"), fund.get("sebi_category")
    r2 = _r2_target(path, cat)

    # Option A exact construction (no iteration). r_F = alpha + beta*r_B + e,
    # where e is built so that, ON THE 36m CALIBRATION WINDOW w (which equals
    # the tier_b 3y window after the Bug 2 _assemble fix), e has exactly zero
    # mean and is exactly orthogonal to r_B. Then on w:
    #   mean(r_F) = alpha + beta*mean_B          -> set alpha to pin the mean
    #   var(r_F)  = beta^2*var_B + var(e)        -> choose beta, var(e) to split
    # so vol_3y and sharpe_3y are preserved EXACTLY and R-squared equals the
    # category target exactly. beta = sqrt(r2 * target_var / var_B) is a
    # calibrated OUTPUT (its magnitude reflects the fund/index vol ratio; the
    # synthesised indices are lower-vol than stored fund vols, so equity betas
    # run above 1; this is the accepted Option A consequence, ADR-0014).
    beta = math.sqrt(r2 * target_var_m / var_B)
    target_resid_sd = math.sqrt((1.0 - r2) * target_var_m)

    rng = random.Random(seed)
    raw = {m: rng.gauss(0.0, 1.0) for m in common}

    # OLS slope of raw on r_B over w; subtract it so the residual is exactly
    # orthogonal to r_B on w. Apply the same affine map over all of `common`
    # so the single-factor process is consistent across the full overlap that
    # the calendar-aligned beta/r2 recompute (ADR-0015) reads.
    rawv = [raw[m] for m in w]
    mrw = sum(rawv) / len(rawv)
    cov_br = sum((rB[m] - mean_B) * (raw[m] - mrw) for m in w) / (n - 1)
    slope = cov_br / var_B if var_B > 0 else 0.0
    e_res = {m: raw[m] - slope * rB[m] for m in common}
    resw = [e_res[m] for m in w]
    mres = sum(resw) / len(resw)
    sdres = math.sqrt(sum((x - mres) ** 2 for x in resw) / (n - 1)) or 1.0
    scale = target_resid_sd / sdres
    e = {m: (e_res[m] - mres) * scale for m in common}

    alpha = target_mean_log - beta * mean_B
    rF = {m: alpha + beta * rB[m] + e[m] for m in common}

    # Verify on w (should be exact to floating point).
    wv = [rF[m] for m in w]
    m_ = sum(wv) / len(wv)
    v_ = sum((x - m_) ** 2 for x in wv) / (n - 1)
    cur_vol = math.sqrt(v_) * math.sqrt(12.0)
    cur_ann = math.exp(m_ * 12.0) - 1.0
    cur_sh = (cur_ann - E.RISK_FREE_ANN) / cur_vol if cur_vol > 0 else None
    conv = (cur_vol > 0 and abs(cur_vol - v3) < 1e-6
            and cur_sh is not None and abs(cur_sh - s3) < 1e-3)
    diag = {"vol3": round(cur_vol, 4), "sharpe3": round(cur_sh, 4) if cur_sh else None}
    return _assemble(nav, pre, common, rF, splice_val), conv, diag


def _assemble(orig_nav, pre, common, rF, splice_val):
    # Bug 2 fix: the regenerated series ends at the last calendar-aligned
    # month (common[-1]). Original fund-nav months past that (for example a
    # 2026-05 orphan when the index ends 2026-04) are intentionally dropped,
    # not flat-carried, so no synthetic zero-return month sits inside the
    # trailing-36 window that defines vol_3y / sharpe_3y / sortino_3y. The
    # consequence is that the regenerated nav ends at the snapshot's last
    # aligned month, which also matches the snapshot effective date.
    out = {}
    for m in pre:
        out[m] = orig_nav[m]
    prev = splice_val
    for m in common:
        prev = prev * math.exp(rF[m])
        out[m] = round(prev, 6)
    return out


def seed_for(fund):
    return (int(fund.get("amfi_code") or 0) * 2654435761) & 0x7FFFFFFF


def _logrets_by_month(series):
    ks = sorted(series.keys())
    o = {}
    for i in range(1, len(ks)):
        a, b = series[ks[i - 1]], series[ks[i]]
        if a and b and a > 0 and b > 0:
            o[ks[i]] = math.log(b / a)
    return o


def cal_metrics(nav, bser):
    """Calendar-aligned beta/r2/te/ir for a fund versus a benchmark.

    ADR-0015 deviation from ADR-0012's tail-align (s[-n:] vs b[-n:]): funds
    carry far more NAV history than the 84-month synthesised index, and may
    end on a different month, so tail-align compares calendar-misaligned
    pairs and destroys correlation. Aligning on shared YYYY-MM keys is
    necessary and correct for funds. beta/r2 use the full month intersection
    (ADR-0012 used the full overlap for stocks); te/ir use trailing 36.
    """
    fr = _logrets_by_month(nav)
    br = _logrets_by_month(bser)
    common = sorted(set(fr) & set(br))
    if len(common) < 12:
        return None, None, None, None

    def stats(ms):
        n = len(ms)
        s = [fr[m] for m in ms]
        b = [br[m] for m in ms]
        msx, mbx = sum(s) / n, sum(b) / n
        cov = sum((s[i] - msx) * (b[i] - mbx) for i in range(n)) / (n - 1)
        vb = sum((x - mbx) ** 2 for x in b) / (n - 1)
        vs = sum((x - msx) ** 2 for x in s) / (n - 1)
        return s, b, msx, mbx, cov, vb, vs, n

    s, b, msx, mbx, cov, vb, vs, n = stats(common)
    if vb == 0 or vs == 0:
        return None, None, None, None
    beta = cov / vb
    r2 = (cov / math.sqrt(vs * vb)) ** 2
    w = common[-36:] if len(common) >= 36 else common
    sw = [fr[m] for m in w]
    bw = [br[m] for m in w]
    nw = len(w)
    diffs = [sw[i] - bw[i] for i in range(nw)]
    md = sum(diffs) / nw
    te = math.sqrt(sum((d - md) ** 2 for d in diffs) / (nw - 1)) * math.sqrt(12)
    ann_s = math.exp((sum(sw) / nw) * 12) - 1
    ann_b = math.exp((sum(bw) / nw) * 12) - 1
    ir = (ann_s - ann_b) / te if te else None
    return beta, r2, te, ir


def process_snapshot(snap, write):
    funds = snap["mf_funds"]
    idxs = snap.get("indices") or {}
    counts = {"regenerated": 0, "converged": 0, "skipped_sentinel": 0, "skipped_fail": 0}
    for f in funds:
        idx_id, path, sent = resolve(f)
        f["_rr_path"] = path
        if sent is not None or idx_id is None:
            counts["skipped_sentinel"] += 1
            continue
        iser = idxs.get(idx_id, {}).get("monthly_values")
        new_nav, conv, diag = regenerate_one(f, iser, seed_for(f))
        if new_nav is None:
            counts["skipped_fail"] += 1
            continue
        counts["regenerated"] += 1
        counts["converged"] += 1 if conv else 0
        if write:
            f["monthly_nav"] = new_nav
        else:
            f["_rr_new_nav"] = new_nav
    for f in funds:
        f.pop("_rr_path", None)
    return counts


def recompute_snapshot(snap):
    """ADR-0015: write calendar-aligned beta/r2/te/ir into each resolvable
    fund's tier_b_stats. Non-resolvable funds get _benchmark_resolution set
    to the partition sentinel; data_window_insufficient funds are untouched.
    Stocks are untouched (they keep the ADR-0012 tail-align values)."""
    funds = snap["mf_funds"]
    idxs = snap.get("indices") or {}
    c = {"resolved": 0, "structural": 0, "not_in_snapshot": 0,
         "data_window_insufficient": 0, "no_overlap": 0}
    for f in funds:
        tb = f.get("tier_b_stats")
        if not isinstance(tb, dict):
            continue
        if tb.get("data_window_insufficient"):
            c["data_window_insufficient"] += 1
            continue  # left exactly as ADR-0012 produced it
        idx_id, path, sent = resolve(f)
        if sent is not None or idx_id is None:
            # Type-1 / Type-2: four metrics stay null; stamp the sentinel.
            tb["beta_3y"] = None
            tb["r_squared_3y"] = None
            tb["tracking_error_3y"] = None
            tb["information_ratio_3y"] = None
            tb["_benchmark_resolution"] = sent
            c["structural" if sent == "benchmark_structurally_inapplicable" else "not_in_snapshot"] += 1
            continue
        iser = idxs.get(idx_id, {}).get("monthly_values")
        beta, r2, te, ir = cal_metrics(f.get("monthly_nav") or {}, iser or {})
        if beta is None:
            tb["_benchmark_resolution"] = "insufficient_overlap"
            c["no_overlap"] += 1
            continue
        rnd = lambda x: round(x, 4) if isinstance(x, float) else x
        tb["beta_3y"] = rnd(beta)
        tb["r_squared_3y"] = rnd(r2)
        tb["tracking_error_3y"] = rnd(te)
        tb["information_ratio_3y"] = rnd(ir)
        meta = tb.get("_meta") or {}
        meta["benchmark_index_id"] = idx_id
        tb["_meta"] = meta
        tb["_benchmark_resolution"] = "resolved"
        c["resolved"] += 1
    for f in funds:
        f.pop("_rr_path", None)
    return c


def validate_t0():
    p = os.path.join(ENRICHED_DIR, "snapshot_t0_q2_2026.json")
    snap = json.load(open(p))
    counts = process_snapshot(snap, write=False)
    funds = snap["mf_funds"]
    idxs = snap["indices"]
    print("=== Step 3a validation: t0 regeneration (in-memory, no writes) ===")
    print("counts:", counts)

    def find(pred):
        return next((f for f in funds if pred(f)), None)

    def suff(f):
        tb = f.get("tier_b_stats") or {}
        return isinstance(f.get("monthly_nav"), dict) and not tb.get("data_window_insufficient")

    samples = [
        ("Large Cap", find(lambda f: f.get("sebi_category") == "Large Cap Fund" and suff(f) and "_rr_new_nav" in f)),
        ("Mid Cap", find(lambda f: f.get("sebi_category") == "Mid Cap Fund" and suff(f) and "_rr_new_nav" in f)),
        ("Liquid", find(lambda f: f.get("sebi_category") == "Liquid Fund" and suff(f) and "_rr_new_nav" in f)),
        ("source-string->16", find(lambda f: isinstance(f.get("Benchmark Index"), str) and f["Benchmark Index"].strip() and _name_to_idx(f["Benchmark Index"]) in CANON and suff(f) and "_rr_new_nav" in f)),
        ("tracked-index", find(lambda f: f.get("sebi_category") in ("Equity Index Funds", "ETFs- Equity") and _name_to_idx(f.get("fund_name", "")) in CANON and suff(f) and "_rr_new_nav" in f)),
        ("Aggressive Hybrid", find(lambda f: f.get("sebi_category") == "Aggressive Hybrid Fund" and suff(f) and "_rr_new_nav" in f)),
        ("Long Duration", find(lambda f: f.get("sebi_category") == "Long Duration Fund" and suff(f) and "_rr_new_nav" in f)),
        ("Type1 sentinel", find(lambda f: f.get("sebi_category") in ("Multi Asset Allocation", "Dynamic Asset Allocation or Bal"))),
        ("Type2 sentinel", find(lambda f: f.get("sebi_category") == "ETFs- Equity" and _name_to_idx(f.get("fund_name", "")) is None)),
        ("Arbitrage", find(lambda f: f.get("sebi_category") == "Arbitrage Fund" and suff(f) and "_rr_new_nav" in f)),
    ]
    rnd = lambda x: round(x, 4) if isinstance(x, float) else x
    for label, f in samples:
        if not f:
            print(f"\n[{label}] (no match)")
            continue
        idx_id, pth, sent = resolve(f)
        tb = f.get("tier_b_stats", {}) or {}
        print(f"\n[{label}] amfi={f.get('amfi_code')} | {f.get('fund_name')}")
        print(f"  sebi={f.get('sebi_category')!r} resolved={idx_id} via {pth}" + (f" SENTINEL={sent}" if sent else ""))
        print(f"  existing tier_b: sharpe_3y={tb.get('sharpe_3y')} vol_3y={tb.get('vol_3y_annualized')} sortino_3y={tb.get('sortino_3y')} maxdd_3y={tb.get('max_drawdown_3y')} calmar_3y={tb.get('calmar_3y')}")
        if sent or "_rr_new_nav" not in f:
            print("  NOT regenerated (sentinel) -> beta/r2/te/ir stay null")
            continue
        new = f["_rr_new_nav"]
        bser = idxs[idx_id]["monthly_values"]
        b, r2, te, ir = cal_metrics(new, bser)   # calendar-aligned (ADR-0015)
        # preserved-stat check on regenerated series (single-series stats; the
        # fund's own trailing 36 is internally consistent regardless of align)
        fr = E.compute_returns_from_series(new)
        nv3 = E.annualized_vol(fr, 36)
        nsh = E.sharpe_ratio(fr, window_months=36)
        nso = E.sortino_ratio(fr, window_months=36)
        nmd = E.max_drawdown({m: new[m] for m in sorted(new.keys())[-36:]})
        print(f"  POST-regen recompute: beta_3y={rnd(b)} r_squared_3y={rnd(r2)} tracking_error_3y={rnd(te)} information_ratio_3y={rnd(ir)}")
        print(f"  preserved-stat check : vol_3y {tb.get('vol_3y_annualized')}->{rnd(nv3)}  sharpe_3y {tb.get('sharpe_3y')}->{rnd(nsh)}  sortino_3y {tb.get('sortino_3y')}->{rnd(nso)}  maxdd_3y {tb.get('max_drawdown_3y')}->{rnd(nmd)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--validate", action="store_true", help="in-memory t0, 10-fund sample, no writes")
    ap.add_argument("--write", action="store_true", help="regenerate monthly_nav and write back t0..t8")
    ap.add_argument("--recompute", action="store_true",
                    help="ADR-0015: calendar-aligned beta/r2/te/ir into tier_b_stats, write back t0..t8")
    args = ap.parse_args()
    if args.validate:
        validate_t0()
    elif args.write or args.recompute:
        for sid in SNAPSHOT_IDS:
            p = os.path.join(ENRICHED_DIR, f"snapshot_{sid}.json")
            snap = json.load(open(p))
            c = process_snapshot(snap, write=True) if args.write else recompute_snapshot(snap)
            with open(p, "w") as fh:
                json.dump(snap, fh, separators=(",", ":"))
            print(sid, c)
    else:
        ap.error("pass --validate, --write, or --recompute")


if __name__ == "__main__":
    main()
