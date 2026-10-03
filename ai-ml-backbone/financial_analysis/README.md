# Financial Analysis

Financial analysis for the Credit Intelligence investigation pipeline.

This module calculates key financial metrics from a business loan application's financial and loan data. The resulting metrics provide an auditable summary of the applicant's profitability, existing debt burden, debt-service capacity, requested-loan size, and operating expenses.

The financial analysis stage feeds into the broader credit-risk investigation pipeline.

## Interface

The module exposes one public function:

```python
calculate_financial_metrics(
    application_id: str,
    financials: dict[str, Any],
    loan: dict[str, Any],
) -> dict[str, Any]
```

### Input

The function follows the data structure used by `seed_demo_data.py`

```python
financials = {
    "monthly_revenue": 5_000_000,
    "monthly_expenses": 4_000_000,
    "monthly_net_income": 1_000_000,
    "existing_monthly_debt_payment": 2_000_000,
    "total_outstanding_debt": 12_000_000,
}
```
```python

loan = {
    "amount": 10_000_000,
    "currency": "NGN",
    "purpose": "Working capital",
    "tenor_months": 24,
}
```

Annual revenue is derived internally:

`annual_revenue` = `monthly_revenue` × 12

### Metrics

The calculator produces five metrics:

- **Net Profit Margin:** Net Income / Revenue
- **Debt-to-Revenue:** Total Outstanding Debt / Annual Revenue
- **DSCR**: Monthly Net Income / Existing Monthly Debt Payment
- **Loan-to-Annual-Revenue:** Requested Loan / Annual Revenue
- **Expense Ratio:** Operating Expenses / Revenue

Each metric includes its calculated value and the underlying calculation expression for auditability.

#### DSCR Handling

The current application data does not provide a complete cash-flow or projected debt-service schedule. Monthly net income is therefore used as a simplified cash-flow proxy.

If existing monthly debt service is zero, DSCR is returned as null rather than causing a division-by-zero error.

### Output

The function returns:
```python
{
    "application_id": "CR-001",
    "metrics": {
        "net_profit_margin": {
            "value": 0.20,
            "calculation": "1000000 / 5000000"
        },
        "debt_to_revenue": {
            "value": 0.20,
            "calculation": "12000000 / 60000000"
        },
        "dscr": {
            "value": 0.50,
            "calculation": "1000000 / 2000000"
        },
        "loan_to_annual_revenue": {
            "value": 0.1667,
            "calculation": "10000000 / 60000000"
        },
        "expense_ratio": {
            "value": 0.80,
            "calculation": "4000000 / 5000000"
        }
    }
}
```

**Validation:**
Monthly revenue must be greater than zero.
Annual revenue must be greater than zero.
Zero existing debt service is valid and results in a null DSCR.

**Testing:**

Run the unit tests from the financial_analysis directory: `pytest test_calculator.py`. The test suite covers metric calculations, output structure, auditability, zero-debt handling, and invalid revenue values.