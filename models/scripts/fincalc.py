#!/usr/bin/env python3
"""Reproducible feasibility metrics calculator (standard library only).

Computes NPV, IRR, MOIC, payback, discounted payback, DSCR statistics and WACC from a cash-flow CSV.
It contains NO project data. Every number it produces is only as good as the labelled inputs fed to it,
and outputs are PROJECTIONS.

CSV format (one row per period, period 0 = first investment period):
    period,unlevered_cf,equity_cf,cfads,debt_service
Columns other than `period` are optional; metrics needing a missing column are reported as WITHHELD.

Usage:
    python3 models/scripts/fincalc.py cashflows.csv --rate 0.10 [--equity-rate 0.15] [--json]
    python3 models/scripts/fincalc.py --wacc E=60,D=40,ke=0.15,kd=0.07,tax=0.20
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from typing import Iterable, Optional, Sequence


def npv(rate: float, cashflows: Sequence[float]) -> float:
    """NPV with the first cash flow at t=0 (undiscounted)."""
    if rate <= -1:
        raise ValueError("rate must be > -100%")
    return sum(cf / (1 + rate) ** t for t, cf in enumerate(cashflows))


def irr(cashflows: Sequence[float], lo: float = -0.9999, hi: float = 10.0, tol: float = 1e-10) -> Optional[float]:
    """IRR by bisection. Returns None when no sign change exists (IRR undefined).

    Warns (stderr) when cash flows change sign more than once, as multiple IRRs may exist.
    """
    signs = [cf > 0 for cf in cashflows if cf != 0]
    if not signs or all(signs) or not any(signs):
        return None
    changes = sum(1 for a, b in zip(signs, signs[1:]) if a != b)
    if changes > 1:
        print("WARNING: non-conventional cash flows (multiple sign changes); IRR may not be unique.", file=sys.stderr)
    f_lo, f_hi = npv(lo, cashflows), npv(hi, cashflows)
    if f_lo * f_hi > 0:
        return None
    for _ in range(500):
        mid = (lo + hi) / 2
        f_mid = npv(mid, cashflows)
        if abs(f_mid) < tol or (hi - lo) < tol:
            return mid
        if f_lo * f_mid < 0:
            hi, f_hi = mid, f_mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2


def moic(cashflows: Sequence[float]) -> Optional[float]:
    """Multiple on invested capital = total inflows / total outflows."""
    out = -sum(cf for cf in cashflows if cf < 0)
    inflow = sum(cf for cf in cashflows if cf > 0)
    return inflow / out if out > 0 else None


def payback(cashflows: Sequence[float], rate: float = 0.0) -> Optional[float]:
    """(Discounted) payback period in periods, linearly interpolated. None if never paid back."""
    cum = 0.0
    for t, cf in enumerate(cashflows):
        dcf = cf / (1 + rate) ** t
        prev = cum
        cum += dcf
        if t > 0 and prev < 0 <= cum:
            return (t - 1) + (-prev / dcf if dcf else 0.0)
    return None


def dscr_series(cfads: Sequence[float], debt_service: Sequence[float]) -> list[Optional[float]]:
    """DSCR = CFADS / debt service, per period (None where no debt service)."""
    return [c / d if d else None for c, d in zip(cfads, debt_service)]


def wacc(equity: float, debt: float, ke: float, kd: float, tax: float) -> float:
    """Post-tax WACC = E/V*ke + D/V*kd*(1-tax)."""
    v = equity + debt
    if v <= 0:
        raise ValueError("equity + debt must be > 0")
    return equity / v * ke + debt / v * kd * (1 - tax)


def _column(rows: list[dict], name: str) -> Optional[list[float]]:
    if not rows or name not in rows[0] or all((r.get(name) or "").strip() == "" for r in rows):
        return None
    return [float(r[name]) if (r.get(name) or "").strip() else 0.0 for r in rows]


def analyse(rows: list[dict], rate: float, equity_rate: Optional[float]) -> dict:
    res: dict = {"label": "PROJECTION — calculated from supplied inputs", "discount_rate": rate}
    rows = sorted(rows, key=lambda r: int(r["period"]))
    u = _column(rows, "unlevered_cf")
    e = _column(rows, "equity_cf")
    c = _column(rows, "cfads")
    d = _column(rows, "debt_service")
    withheld = "WITHHELD — missing column"
    if u:
        res.update(project_npv=npv(rate, u), project_irr=irr(u), project_moic=moic(u),
                   payback_periods=payback(u), discounted_payback_periods=payback(u, rate))
    else:
        res.update(project_npv=withheld, project_irr=withheld)
    if e:
        res.update(equity_irr=irr(e), equity_moic=moic(e))
        if equity_rate is not None:
            res["equity_npv"] = npv(equity_rate, e)
    else:
        res.update(equity_irr=withheld)
    if c and d:
        s = [x for x in dscr_series(c, d) if x is not None]
        res.update(min_dscr=min(s) if s else None, avg_dscr=sum(s) / len(s) if s else None)
    else:
        res.update(min_dscr=withheld)
    return res


def main(argv: Optional[Iterable[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", nargs="?", help="cash-flow CSV")
    ap.add_argument("--rate", type=float, help="project discount rate, e.g. 0.10")
    ap.add_argument("--equity-rate", type=float, help="equity discount rate for equity NPV")
    ap.add_argument("--wacc", help="E=..,D=..,ke=..,kd=..,tax=..")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(list(argv) if argv is not None else None)
    if a.wacc:
        kv = dict(p.split("=") for p in a.wacc.split(","))
        print(f"WACC = {wacc(float(kv['E']), float(kv['D']), float(kv['ke']), float(kv['kd']), float(kv['tax'])):.6f}")
        return 0
    if not a.csv or a.rate is None:
        ap.error("csv and --rate are required (or use --wacc)")
    with open(a.csv, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    res = analyse(rows, a.rate, a.equity_rate)
    if a.json:
        print(json.dumps(res, indent=2))
    else:
        for k, v in res.items():
            print(f"{k:28s} {v:.6f}" if isinstance(v, float) else f"{k:28s} {v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
