from typing import Any


def calculate_financial_metrics(
    application_id: str,
    financials: dict[str, Any],
    loan: dict[str, Any],
) -> dict[str, Any]:
    """
    Calculate financial metrics for a business loan application.

    This function uses the financial and loan structures defined in
    seed_demo_data.py.

    DSCR is calculated using monthly net income as a simplified
    cash-flow proxy because the current application data does not
    provide a complete cash-flow/debt-service schedule.
    """

    # Extract financial inputs
    monthly_revenue = financials["monthly_revenue"]
    monthly_expenses = financials["monthly_expenses"]
    monthly_net_income = financials["monthly_net_income"]

    outstanding_debt = financials["total_outstanding_debt"]
    monthly_debt_payment = financials["existing_monthly_debt_payment"]

    # Extract loan inputs
    requested_loan = loan["amount"]

    # Derive annual revenue from the monthly revenue supplied
    annual_revenue = monthly_revenue * 12

    # Validate required denominators
    if monthly_revenue <= 0:
        raise ValueError("Monthly revenue must be greater than zero.")

    if annual_revenue <= 0:
        raise ValueError("Annual revenue must be greater than zero.")

    # Calculate DSCR safely.
    # A business with no existing debt service is valid, but
    # DSCR cannot be calculated by dividing by zero.
    if monthly_debt_payment > 0:
        dscr_value = monthly_net_income / monthly_debt_payment
        dscr_calculation = (
            f"{monthly_net_income} / {monthly_debt_payment}"
        )
    else:
        dscr_value = None
        dscr_calculation = (
            "Not applicable: no existing debt service"
        )

    # Calculate financial metrics
    metrics = {
        "net_profit_margin": {
            "value": monthly_net_income / monthly_revenue,
            "calculation": (
                f"{monthly_net_income} / {monthly_revenue}"
            ),
        },
        "debt_to_revenue": {
            "value": outstanding_debt / annual_revenue,
            "calculation": (
                f"{outstanding_debt} / {annual_revenue}"
            ),
        },
        "dscr": {
            "value": dscr_value,
            "calculation": dscr_calculation,
        },
        "loan_to_annual_revenue": {
            "value": requested_loan / annual_revenue,
            "calculation": (
                f"{requested_loan} / {annual_revenue}"
            ),
        },
        "expense_ratio": {
            "value": monthly_expenses / monthly_revenue,
            "calculation": (
                f"{monthly_expenses} / {monthly_revenue}"
            ),
        },
    }

    return {
        "application_id": application_id,
        "metrics": metrics,
    }