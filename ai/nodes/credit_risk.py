import os
import joblib
import pandas as pd
from typing import Dict, Any

from ai.state import InvestigationGraphState

# Resolve absolute path to Fawaz's trained model artifact
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(CURRENT_DIR))

MODEL_PATH = os.path.join(
    PROJECT_ROOT,
    "ai-ml-backbone",
    "risk_model",
    "models",
    "hist_gradient_boost.joblib"
)

# Exact FEATURE_COLUMNS contract
FEATURE_COLUMNS = [
    "age_years",
    "employment_years",
    "credit_to_income",
    "income_per_family_member",
    "CNT_FAM_MEMBERS",
    "NAME_INCOME_TYPE",
    "OCCUPATION_TYPE",
    "NAME_EDUCATION_TYPE",
    "NAME_FAMILY_STATUS",
    "NAME_HOUSING_TYPE",
    "FLAG_OWN_CAR",
    "FLAG_OWN_REALTY",
]


def _build_features_from_application(app_data: dict) -> pd.DataFrame:
    """
    Adapter that transforms the incoming backend JSON payload
    into the exact feature matrix required by Fawaz's model.
    """
    applicant = app_data.get("applicant", {})
    loan = app_data.get("loan", {})
    fin = app_data.get("financials", {})

    # Incomes & Obligations
    salary = float(fin.get("monthly_salary_income", 1.0))
    additional = float(fin.get("additional_income", 0.0))
    total_annual_income = max((salary + additional) * 12.0, 1.0)
    loan_amount = float(loan.get("amount", 0.0))
    family_members = float(applicant.get("family_members", 1))

    # Derived Ratios
    age_years = float(applicant.get("age", 30))
    emp_months = float(applicant.get("employment_duration_months", 12))
    employment_years = emp_months / 12.0
    credit_to_income = loan_amount / total_annual_income
    income_per_fam = total_annual_income / family_members

    # Mappings matching standard Home Credit categories
    edu_map = {
        "BSc": "Higher education",
        "MSc": "Higher education",
        "PhD": "Higher education",
        "HND": "Higher education",
        "High School": "Secondary / secondary special",
    }

    housing_map = {
        "Owns": "House / apartment",
        "Renting": "Rented apartment",
        "Living with Parents": "With parents",
    }

    income_type_map = {
        "Employed": "Working",
        "Salaried": "Working",
        "Self-Employed": "Commercial associate",
        "Unemployed": "Unemployed",
        "Retired": "Pensioner",
    }

    row = {
        # Numeric Features
        "age_years": age_years,
        "employment_years": employment_years,
        "credit_to_income": round(credit_to_income, 4),
        "income_per_family_member": round(income_per_fam, 2),
        "CNT_FAM_MEMBERS": family_members,

        # Categorical Features
        "NAME_INCOME_TYPE": income_type_map.get(applicant.get("employment_status"), "Working"),
        "OCCUPATION_TYPE": applicant.get("occupation", "Core staff"),
        "NAME_EDUCATION_TYPE": edu_map.get(applicant.get("education_level"), "Higher education"),
        "NAME_FAMILY_STATUS": applicant.get("marital_status", "Single"),
        "NAME_HOUSING_TYPE": housing_map.get(applicant.get("housing_type"), "House / apartment"),

        # Binary Features
        "FLAG_OWN_CAR": "N",
        "FLAG_OWN_REALTY": "Y" if applicant.get("housing_type") == "Owns" else "N",
    }

    return pd.DataFrame([row])[FEATURE_COLUMNS]


def run_credit_risk_node(state: InvestigationGraphState) -> Dict[str, Any]:
    """
    Stage 4 Node: Runs real inference through Fawaz's hist_gradient_boost model.
    """
    app_data = state.get("application_data", {})
    features_df = _build_features_from_application(app_data)

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Fawaz's model artifact not found at: {MODEL_PATH}. "
            "Verify that you ran `git pull origin main`."
        )

    # 1. Load trained Scikit-Learn HistGradientBoosting pipeline
    model = joblib.load(MODEL_PATH)

    # 2. Score probability of default (Class 1 = Default)
    # predict_proba returns array shape (1, 2)
    probs = model.predict_proba(features_df)
    prob_default = float(probs[0][1])

    # 3. Discretize into Risk Bands
    if prob_default < 0.15:
        risk_band = "LOW"
    elif prob_default <= 0.35:
        risk_band = "MEDIUM"
    else:
        risk_band = "HIGH"

    return {
        "ml_risk_result": {
            "probability_of_default": round(prob_default, 4),
            "risk_band": risk_band,
            "model_version": "hist_gradient_boost_v1",
        }
    }