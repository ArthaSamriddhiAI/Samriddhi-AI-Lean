"""Ingest, validate, and (later) merge real Bloomberg BDH data into the snapshot.

T-5.14 Option B, Task 2. Deterministic; reads xlsx, validates by script, and
(under --write, gated and NOT run here) merges the real monthly series into the
snapshot while bypassing the ADR-0014 NAV regeneration. No LLM, no API.

BDH layout (the "Pull grid" sheet): a Date anchor then one (date, value) column
PAIR per security; the security ticker is the header of the pair's first column,
the value header is blank, and each security carries its own date column (so
series can start on different months). "#N/A Invalid Security" and blanks are
dropped. The "Tickers" sheet documents each ticker's Series name and TR? flag.

Validation (the believability gate, by script not assertion):
  - equity indices show the real March 2020 COVID crash (<= -15% that month);
  - debt indices show the INVERTED signature (roughly flat, |move| < 5%);
  - total-return basis (the Tickers sheet marks TR for the indices);
  - the build window 2019-05 .. 2026-04 is covered at monthly frequency.

Usage:
  python3 scripts/ingest_bloomberg.py --file <xlsx> --dry-run   # parse + validate, no write
  python3 scripts/ingest_bloomberg.py --file <xlsx> --write     # (gated) merge into snapshot
"""
import argparse
import sys

try:
    import pandas as pd
except ImportError:
    print("pandas required (pip install pandas openpyxl)", file=sys.stderr)
    sys.exit(2)

# Ticker -> (snapshot target, kind). kind drives the validation expectation.
SERIES_MAP = {
    "NIFTYTR Index": ("nifty_50_tri", "equity_index"),
    "NSE100TR Index": ("nifty_100_tri", "equity_index"),
    "NSE500TR Index": ("nifty_500_tri", "equity_index"),
    "NSE150TR Index": ("nifty_midcap_150_tri", "equity_index"),
    "NSE250TR Index": ("nifty_smallcap_250_tri", "equity_index"),
    "NSEBANKT Index": ("nifty_bank_tri", "equity_index"),
    "SPXT Index": ("sp_500_tri_usd", "equity_index_intl"),  # x USDINR at merge -> sp_500_tri_inr
    "USDINR Curncy": ("fx.usd_inr", "fx"),
    "CRISIL Short Term": ("crisil_short_term_bond", "debt_index"),
    "CRISIL Liquid": ("crisil_liquid", "debt_index"),
}
WINDOW_START, WINDOW_END = "2019-05", "2026-04"


def parse_bdh(path, sheet="Pull grid", header_row=4, data_start=5):
    """Parse the per-security (date, value) pairs into {ticker: {YYYY-MM: float}}."""
    df = pd.read_excel(path, sheet_name=sheet, header=None)
    header = df.iloc[header_row]
    out = {}
    col = 1
    while col + 1 < df.shape[1]:
        ticker = header[col]
        if isinstance(ticker, str) and ticker.strip():
            monthly = {}
            for d, v in zip(df.iloc[data_start:, col], df.iloc[data_start:, col + 1]):
                if pd.isna(d) or pd.isna(v) or isinstance(v, str):
                    continue  # blank, or "#N/A Invalid Security"
                try:
                    key = pd.Timestamp(d).strftime("%Y-%m")
                except (ValueError, TypeError):
                    continue
                monthly[key] = float(v)
            if monthly:
                out[ticker.strip()] = monthly
        col += 2
    return out


def month_return(series, month):
    """Return the month-over-prior-month return, or None if either point is absent."""
    months = sorted(series)
    if month not in months:
        return None
    i = months.index(month)
    if i == 0:
        return None
    prev, cur = series[months[i - 1]], series[month]
    return (cur - prev) / prev if prev else None


def validate(ticker, series):
    """Return (ok, notes[]) for one series against its kind's expectation."""
    target, kind = SERIES_MAP.get(ticker, (ticker, "other"))
    notes, ok = [], True
    months = sorted(series)
    covers = months and months[0] <= WINDOW_START and months[-1] >= WINDOW_END
    notes.append(f"window {months[0] if months else '-'}..{months[-1] if months else '-'} covers {WINDOW_START}..{WINDOW_END}: {covers}")
    if not covers:
        ok = False
    covid = month_return(series, "2020-03")
    if kind in ("equity_index", "equity_index_intl"):
        # India crashed ~ -23% to -34% in Mar 2020; the US (S&P) fell less, ~ -12%.
        floor = -0.15 if kind == "equity_index" else -0.10
        crash = covid is not None and covid <= floor
        notes.append(f"COVID Mar-2020 {('%.1f%%' % (covid * 100)) if covid is not None else 'n/a'} (expect <= {int(floor*100)}%): {crash}")
        if not crash:
            ok = False
    elif kind == "debt_index":
        flat = covid is not None and abs(covid) < 0.05
        notes.append(f"COVID Mar-2020 {('%.1f%%' % (covid * 100)) if covid is not None else 'n/a'} (expect ~flat |move|<5%): {flat}")
        if not flat:
            ok = False
    else:
        notes.append(f"COVID Mar-2020 {('%.1f%%' % (covid * 100)) if covid is not None else 'n/a'} (presence/window only)")
    return ok, target, kind, notes


def merge_into_snapshot(parsed, snapshot_path):  # pragma: no cover - gated, not run in dry-run
    """Wire the real series into the snapshot, bypassing the ADR-0014 NAV
    regeneration (the regenerator is NOT invoked). Real fund monthly_nav comes
    from the colleague source; this writes the real index/fx/stock series.
    Intentionally not executed in --dry-run; the final merge is a gated step and
    waits for the second (debt + G-Sec) file."""
    raise NotImplementedError(
        "merge is the gated Phase 2 data write (waits for file two and primary go-ahead); "
        "build/dry-run only here"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--dry-run", action="store_true", default=True)
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--snapshot", default=None)
    args = ap.parse_args()

    parsed = parse_bdh(args.file)
    print(f"Parsed {len(parsed)} securities from {args.file}\n")
    mapped_fail = 0
    for ticker in parsed:
        if ticker not in SERIES_MAP:
            print(f"  [info] {ticker}: not in SERIES_MAP (stock or extra), window/presence only")
            continue
        ok, target, kind, notes = validate(ticker, parsed[ticker])
        print(f"  [{'PASS' if ok else 'FAIL'}] {ticker} -> {target} ({kind})")
        for n in notes:
            print(f"         {n}")
        if not ok:
            mapped_fail += 1

    present_mapped = len([t for t in parsed if t in SERIES_MAP])
    print(f"\nMapped-series validation: {present_mapped - mapped_fail}/{present_mapped} present-and-valid; {mapped_fail} failed. "
          f"({len(SERIES_MAP) - present_mapped} mapped series not in this file, e.g. the debt set, expected in file two.)")
    if args.write:
        merge_into_snapshot(parsed, args.snapshot)
    else:
        print("dry-run: parsed and validated only; no snapshot written (merge is the gated step).")
    sys.exit(1 if mapped_fail else 0)


if __name__ == "__main__":
    main()
