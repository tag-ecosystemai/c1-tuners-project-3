from typing import Dict, Any
from ai.state import InvestigationGraphState


def run_financial_node(state: InvestigationGraphState) -> Dict[str, Any]:
    """
    Stage 3: Financial Analysis Node
    Calculates consumer underwriting metrics: Proposed Debt Service, DTI,
    Disposable Income, and Affordability ratios aligned with Kredt Policy.
    """
    app_data = state.get("application_data", {})
    loan = app_data.get("loan", {})
    fin = app_data.get("financials", {})

    salary = float(fin.get("monthly_salary_income", 0.0))
    additional_income = float(fin.get("additional_income", 0.0))
    total_monthly_income = salary + additional_income

    living_expenses = float(fin.get("monthly_living_expenses", 0.0))
    existing_debt = float(fin.get("existing_loan_obligations", 0.0))
    loan_amount = float(loan.get("amount", 0.0))
    tenor = int(loan.get("tenor_months", 12))

    # Proposed monthly loan installment (straight-line repayment amortisation)
    proposed_monthly_installment = (loan_amount / tenor) if tenor > 0 else 0.0

    # Total debt service includes existing debt obligations + the new facility (Section 5.4.1)
    total_monthly_debt_service = existing_debt + proposed_monthly_installment

    # Unencumbered disposable income after debt service and living expenses (Section 5.4.2)
    disposable_income = total_monthly_income - (living_expenses + total_monthly_debt_service)

    # Ratio Calculations (safe division)
    if total_monthly_income > 0:
        dti_ratio = round(total_monthly_debt_service / total_monthly_income, 4)
        expense_ratio = round(living_expenses / total_monthly_income, 4)
        annual_income = total_monthly_income * 12.0
        loan_to_income = round(loan_amount / annual_income, 4)
        principal_multiple = round(loan_amount / total_monthly_income, 2)
    else:
        dti_ratio = 1.0
        expense_ratio = 1.0
        loan_to_income = 1.0
        principal_multiple = 999.0

    financial_metrics = {
        "total_monthly_income": round(total_monthly_income, 2),
        "disposable_income": round(disposable_income, 2),
        "debt_to_income_ratio": dti_ratio,
        "expense_to_income_ratio": expense_ratio,
        "loan_to_income_ratio": loan_to_income,
        "monthly_debt_service": round(total_monthly_debt_service, 2),
        "proposed_monthly_installment": round(proposed_monthly_installment, 2),
        "principal_to_income_multiple": principal_multiple,
    }

    return {"financial_metrics": financial_metrics}