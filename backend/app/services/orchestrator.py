import os
import sys
import time
from pathlib import Path
from typing import Any, Dict

from app.schemas import (
    ConsumerFinancialMetrics,
    GeneratedReport,
    InvestigationResponse,
    JobStatusEnum,
    MLPredictionResult,
    PolicySummary,
    ReportKeyFinding,
    RiskBandEnum,
    SeverityEnum,
    TransactionFinding,
)

# Allow imports from repository root
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.append(str(REPO_ROOT))

USE_MOCK_AI = os.getenv("USE_MOCK_AI", "true").lower() == "true"


def run_investigation_service(inv_id: str, application_data: Dict[str, Any]) -> InvestigationResponse:
    """
    Main service entry point. Dispatches to live AI orchestrator or consumer mock engine.
    """
    if not USE_MOCK_AI:
        try:
            # Plug in Fawaz / Shukrah's real pipeline here once ready
            pass
        except ImportError:
            pass

    return _generate_mock_consumer_investigation(inv_id, application_data)


def _generate_mock_consumer_investigation(inv_id: str, app_data: Dict[str, Any]) -> InvestigationResponse:
    """
    Consumer underwriting engine: computes Debt-to-Income (DTI),
    disposable cash flow, and policy checks.
    """
    time.sleep(2.0)  # Simulation delay

    applicant = app_data.get("applicant", {})
    loan = app_data.get("loan", {})
    fin = app_data.get("financials", {})

    salary = float(fin.get("monthly_salary_income", 1.0))
    add_inc = float(fin.get("additional_income", 0.0))
    total_income = salary + add_inc

    living_expenses = float(fin.get("monthly_living_expenses", 0.0))
    existing_debt = float(fin.get("existing_loan_obligations", 0.0))
    loan_amount = float(loan.get("amount", 0.0))

    disposable_income = total_income - (living_expenses + existing_debt)
    dti_ratio = round(existing_debt / total_income, 3) if total_income > 0 else 1.0
    expense_to_income = round(living_expenses / total_income, 3) if total_income > 0 else 1.0
    loan_to_annual_income = round(loan_amount / (total_income * 12), 3) if total_income > 0 else 1.0

    # Underwriting Policy Rule: Debt-to-Income must not exceed 40% (0.40)
    dti_passed = dti_ratio <= 0.40

    return InvestigationResponse(
        investigation_id=inv_id,
        application_id=app_data.get("application_id", ""),
        status=JobStatusEnum.COMPLETED,
        policy=PolicySummary(
            passed=3 if dti_passed else 2,
            failed=0 if dti_passed else 1,
            requires_review=1
        ),
        financial_analysis=ConsumerFinancialMetrics(
            total_monthly_income=round(total_income, 2),
            disposable_income=round(disposable_income, 2),
            debt_to_income_ratio=dti_ratio,
            expense_to_income_ratio=expense_to_income,
            loan_to_income_ratio=loan_to_annual_income
        ),
        transaction_findings=[
            TransactionFinding(
                type="SALARY_DETECTED",
                severity=SeverityEnum.LOW,
                amount=round(salary, 2),
                date="2026-08-25",
                description="Regular payroll deposit detected from primary employer.",
                transaction_reference="TXN-PAYROLL-01"
            )
        ],
        credit_risk=MLPredictionResult(
            application_id=app_data.get("application_id", ""),
            model_version="consumer-risk-v1",
            probability_of_default=0.08 if dti_passed else 0.42,
            risk_band=RiskBandEnum.LOW if dti_passed else RiskBandEnum.HIGH,
            prediction_horizon="12_MONTHS"
        ),
        report=GeneratedReport(
            investigation_id=inv_id,
            summary=f"Automated credit assessment for {applicant.get('full_name', 'Applicant')}. "
                    f"Monthly disposable income is NGN {disposable_income:,.2f}. "
                    f"Debt-to-Income (DTI) test: {'PASSED' if dti_passed else 'FAILED'}.",
            key_findings=[
                ReportKeyFinding(
                    finding=f"Calculated Debt-to-Income (DTI) ratio is {dti_ratio * 100:.1f}%, against policy ceiling of 40.0%.",
                    severity=SeverityEnum.LOW if dti_passed else SeverityEnum.HIGH,
                    evidence=["DOC-PAYSLIP-01"],
                    policy_reference="POL-CONS-DTI"
                )
            ],
            report=f"Consumer Loan Evaluation for {applicant.get('full_name')}: The applicant is {applicant.get('employment_status')} "
                   f"with {applicant.get('employment_duration_months')} months in current employment. "
                   f"The requested facility of {loan.get('currency')} {loan_amount:,.2f} for purpose '{loan.get('purpose')}' "
                   f"has been scored against standard consumer underwriting guidelines."
        )
    )