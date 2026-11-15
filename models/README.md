# models/ — financial model structures and calculations

- `MODEL_SPEC.md` — model architecture, formula dictionary, double-count checks.
- `scenario_inputs_TEMPLATE.csv` — input sheet (one row per input per phase, BASE/DOWNSIDE/UPSIDE, status, sources).
- `cashflows_TEMPLATE.csv` — period cash-flow format consumed by the calculator.
- `scripts/fincalc.py` — NPV, IRR, MOIC, payback, DSCR, WACC (stdlib only; withholds metrics with missing inputs).
- `tests/test_fincalc.py` — unit tests with synthetic values: `python3 -m unittest discover -s models/tests`.

Per-study files go in `models/<study-slug>/`. No project data is included in this setup.
