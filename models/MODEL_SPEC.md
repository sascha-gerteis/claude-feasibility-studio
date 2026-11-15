# Integrated Financial Model — Structure and Formula Dictionary

Owner: `investment-banking`, integrated by `head-of-market-research`. Contains **no project data**.
Every input must trace to `outputs/assumption_register.csv` (assumption ID + status). All outputs are PROJECTIONS.

## 1. Model architecture
```
Assumptions (scenario_inputs.csv)
  ├─ Timing: phases, construction start/end, opening, ramp-up, horizon, periodicity
  ├─ Demand & price (real-estate-hospitality): occupancy, ADR, visitors, ticket price, rents, unit prices, absorption
  ├─ Capex (project-technology, environmental-technologies, ai-strategy): by phase and work package, contingency
  ├─ Opex (investment-banking with specialists): fixed/variable, ramp-up, operator fees, FF&E reserve
  ├─ Financing (syndications): debt sizing, rate, tenor, fees, DSRA, equity sequence, waterfall
  └─ Macro: inflation, FX, tax, discount rates / WACC
        ↓
Revenue build (by asset, by phase) → Opex → EBITDA / NOI → Tax → Capex & working capital
        ↓
Unlevered free cash flow → Project NPV / IRR / payback
        ↓
CFADS → Debt service → DSCR; Equity cash flows → Equity IRR / MOIC
        ↓
Scenarios (BASE / DOWNSIDE / UPSIDE / stress) and sensitivities → outputs/02_financial_scenarios.md
```

## 2. Formula dictionary
| Metric | Formula | Notes |
| --- | --- | --- |
| Room nights sold | keys × days open × occupancy | Ramp-up years explicit |
| Rooms revenue | room nights × ADR | State net/gross of VAT, service charge, commissions |
| RevPAR | ADR × occupancy | = rooms revenue / available room nights |
| Residential sales revenue | units sold (absorption) × net price | Recognition vs cash collection timing |
| Lease revenue | GLA × occupancy × rent − incentives | Fit-out and rent-free periods |
| EBITDA | revenue − operating expenses | Before FF&E reserve unless stated |
| NOI | property revenue − property operating expenses | Real-estate convention |
| Unlevered FCF | EBITDA − tax on EBIT − capex − Δ working capital | Project perspective |
| CFADS | revenue − opex − tax − maintenance capex ± Δ WC − reserve top-ups | Lender perspective |
| DSCR | CFADS / (interest + principal) | Per period; report minimum and average |
| LTC / LTV | debt / total cost; debt / value | |
| NPV | Σ CFₜ / (1 + r)ᵗ | Rate disclosed and sourced |
| Project IRR | r such that NPV(unlevered FCF) = 0 | |
| Equity IRR | r such that NPV(equity contributions & distributions) = 0 | After debt service |
| MOIC | Σ distributions / Σ contributions | |
| Payback | first period cumulative CF ≥ 0 | Also discounted payback |
| WACC | E/V·kₑ + D/V·k_d·(1 − t) | Inputs sourced; country risk explicit |
| Terminal value | NOI_{n+1} / exit yield, or FCF_{n+1} / (r − g) | Justify method and inputs |
| Yield on cost | stabilised NOI / total development cost | |

## 3. Double-counting checks
- MICE delegates and hotel guests not counted twice across rooms, F&B and attractions.
- AI and sustainability savings appear once — either in opex or as a separate line, never both.
- Debt/equity proceeds never appear as revenue. Grants only if documented.

## 4. Running calculations
1. Build period cash flows into `models/<study>/cashflows_<scenario>.csv` (format: `cashflows_TEMPLATE.csv`).
2. Run: `python3 models/scripts/fincalc.py models/<study>/cashflows_base.csv --rate <r> --equity-rate <ke> --json`
3. Save outputs next to the inputs and cite them in `outputs/02_financial_scenarios.md`.
4. A spreadsheet (XLSX) model is acceptable if every input cell references an assumption ID.
