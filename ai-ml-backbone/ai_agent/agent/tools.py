from typing import Any
from pathlib import Path
import sys


# ============================================================
# PROJECT PATHS
# ============================================================

# Project root:
# c1-tuners-project-3/
REPO_ROOT = Path(__file__).resolve().parents[3]


# ============================================================
# BACKEND DATABASE
# ============================================================

BACKEND_PATH = REPO_ROOT / "backend"

if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

from app.db import SessionLocal
from app.models.application import ApplicationModel


# ============================================================
# FINANCIAL ANALYSIS
# ============================================================

FINANCIAL_ANALYSIS_PATH = (
    REPO_ROOT / "ai-ml-backbone" / "financial_analysis"
)

if str(FINANCIAL_ANALYSIS_PATH) not in sys.path:
    sys.path.insert(0, str(FINANCIAL_ANALYSIS_PATH))

from calculator import calculate_financial_metrics


# ============================================================
# CREDIT RISK MODEL
# ============================================================

RISK_MODEL_PATH = (
    REPO_ROOT / "ai-ml-backbone" / "risk_model"
)

if str(RISK_MODEL_PATH) not in sys.path:
    sys.path.insert(0, str(RISK_MODEL_PATH))

from predict import predict_credit_risk as teammate_predict_credit_risk


# ============================================================
# APPLICATION DATA
# ============================================================

def get_application(application_id: str) -> dict[str, Any]:
    """
    Retrieve an application from the existing Kredt backend database.

    The Agent does not create or modify application data.
    It only retrieves the application and converts the SQLAlchemy
    model into the dictionary format expected by the Agent.
    """

    db = SessionLocal()

    try:
        application = (
            db.query(ApplicationModel)
            .filter(
                ApplicationModel.application_id == application_id
            )
            .first()
        )

        if not application:
            raise ValueError(
                f"Application {application_id} not found"
            )

        return {
            "application_id": application.application_id,
            "status": application.status,
            "created_at": application.created_at,
            "applicant": application.applicant,
            "loan": application.loan,
            "financials": application.financials,
        }

    finally:
        db.close()


# ============================================================
# POLICY CHECK
# ============================================================

def check_policy(
    application_id: str,
    application: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Temporary policy-checking adapter.

    NOTE:
    This is still MOCK policy logic and should eventually be
    replaced with Emmanuel's real policy-checking component.
    """

    findings = []

    applicant = application.get("applicant", {})
    financials = application.get("financials", {})

    # Minimum age policy
    age = applicant.get("age")

    if age is not None:
        findings.append(
            {
                "criterion": "minimum_age",
                "actual_value": age,
                "required_value": 18,
                "result": "PASS" if age >= 18 else "FAIL",
                "evidence": {
                    "source": "application_data"
                },
            }
        )

    # Minimum income policy
    monthly_income = (
        financials.get("monthly_salary_income", 0)
        + financials.get("additional_income", 0)
    )

    findings.append(
        {
            "criterion": "minimum_income",
            "actual_value": monthly_income,
            "required_value": 100_000,
            "result": (
                "PASS"
                if monthly_income >= 100_000
                else "FAIL"
            ),
            "evidence": {
                "source": "application_data"
            },
        }
    )

    return findings


# ============================================================
# FINANCIAL ANALYSIS
# ============================================================

def analyze_financials(
    application_id: str,
    financials: dict[str, Any],
    loan: dict[str, Any],
) -> dict[str, Any]:
    """
    Adapter between the consumer application schema
    and the existing financial-analysis component.

    The Agent does not modify the financial-analysis component.
    It only maps the consumer fields to the fields expected
    by the existing calculator.
    """

    monthly_income = (
        financials.get("monthly_salary_income", 0)
        + financials.get("additional_income", 0)
    )

    monthly_expenses = financials.get(
        "monthly_living_expenses",
        0,
    )

    existing_monthly_debt_payment = financials.get(
        "existing_loan_obligations",
        0,
    )

    total_debt = financials.get(
        "total_debt",
        0,
    )

    financial_analysis_input = {
        "monthly_revenue": monthly_income,
        "monthly_expenses": monthly_expenses,
        "monthly_net_income": (
            monthly_income - monthly_expenses
        ),
        "total_outstanding_debt": total_debt,
        "existing_monthly_debt_payment": (
            existing_monthly_debt_payment
        ),
    }

    return calculate_financial_metrics(
        application_id,
        financial_analysis_input,
        loan,
    )


# ============================================================
# TRANSACTION ANALYSIS
# ============================================================

def analyze_transactions(
    application_id: str,
    application: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Temporary transaction-analysis mock.

    NOTE:
    Replace this with Fawaz's real transaction-analysis
    component once its function/API contract is available.
    """

    return [
        {
            "type": "LARGE_INFLOW",
            "severity": "MEDIUM",
            "amount": 4_500_000,
            "date": "2026-08-12",
            "description": (
                "Transaction significantly exceeds "
                "typical inflow amount."
            ),
            "transaction_reference": "TXN-002",
        }
    ]


# ============================================================
# CREDIT RISK MODEL
# ============================================================

def predict_credit_risk(
    application_id: str,
    application: dict[str, Any],
) -> dict[str, Any]:
    """
    Adapter between the consumer application schema
    and Fawaz's credit-risk model.

    The Agent prepares the canonical 12 features expected
    by the risk model and calls the teammate's predictor.
    """

    applicant = application.get("applicant", {})
    loan = application.get("loan", {})
    financials = application.get("financials", {})

    # --------------------------------------------------------
    # Income
    # --------------------------------------------------------

    monthly_income = (
        financials.get("monthly_salary_income", 0)
        + financials.get("additional_income", 0)
    )

    if monthly_income <= 0:
        raise ValueError(
            "Monthly income must be greater than zero "
            "for credit-risk prediction."
        )

    annual_income = monthly_income * 12

    # --------------------------------------------------------
    # Family members
    # --------------------------------------------------------

    family_members = applicant.get("family_members")

    if family_members is None or family_members < 1:
        raise ValueError(
            "family_members must be provided and at least 1 "
            "for credit-risk prediction."
        )

    # --------------------------------------------------------
    # Canonical features expected by Fawaz's model
    # --------------------------------------------------------

    features = {
        "age_years": applicant.get("age"),

        "employment_years": (
            applicant.get("employment_duration_months", 0)
            / 12
        ),

        "credit_to_income": (
            loan.get("amount", 0)
            / annual_income
        ),

        "income_per_family_member": (
            annual_income
            / family_members
        ),

        "CNT_FAM_MEMBERS": family_members,

        "NAME_INCOME_TYPE": applicant.get(
            "income_type"
        ),

        "OCCUPATION_TYPE": applicant.get(
            "occupation"
        ),

        "NAME_EDUCATION_TYPE": applicant.get(
            "education_level"
        ),

        "NAME_FAMILY_STATUS": applicant.get(
            "marital_status"
        ),

        "NAME_HOUSING_TYPE": applicant.get(
            "housing_type"
        ),

        "FLAG_OWN_CAR": applicant.get(
            "owns_car"
        ),

        "FLAG_OWN_REALTY": applicant.get(
            "owns_property"
        ),
    }

    # --------------------------------------------------------
    # Validate required values
    # --------------------------------------------------------

    missing_fields = [
        field
        for field, value in features.items()
        if value is None
    ]

    if missing_fields:
        raise ValueError(
            "Risk model requires fields that are not available "
            f"in the current application data: "
            f"{', '.join(missing_fields)}"
        )

    # --------------------------------------------------------
    # Call teammate's actual risk model
    # --------------------------------------------------------

    return teammate_predict_credit_risk(
        application_id,
        features,
    )
