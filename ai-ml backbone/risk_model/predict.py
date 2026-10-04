from pathlib import Path

import joblib
import pandas as pd

from features import build_features


# --------------------------------------------------
# Paths
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "hist_gradient_boost.joblib"

MODEL_VERSION = "credit-risk-v1"
LOW_CUTOFF = 0.062867
HIGH_CUTOFF = 0.112622

# --------------------------------------------------
# Load trained model
# --------------------------------------------------

model = joblib.load(MODEL_PATH)


def assign_risk_band(probability: float) -> str:
    if probability < LOW_CUTOFF:
        return "LOW"
    elif probability < HIGH_CUTOFF:
        return "MEDIUM"
    else:
        return "HIGH"
    
# --------------------------------------------------
# Credit-risk prediction
# --------------------------------------------------

def predict_credit_risk(
    application_id: str,
    features: dict,
) -> dict:
    """
    Generate a credit-risk prediction for an application.

    Parameters
    ----------
    application_id : str
        Unique identifier for the application.

    features : dict
        Model-ready applicant features matching the
        credit-risk feature contract.

    Returns
    -------
    dict
        Structured credit-risk prediction.
    """

    # Convert incoming features to a DataFrame.
    feature_data = pd.DataFrame([features])

    # Enforce the model's fixed feature order.
    feature_matrix = build_features(feature_data)

    # Generate probability of payment difficulty.
    probability = float(
        model.predict_proba(feature_matrix)[0, 1]
    )

    return {
        "application_id": application_id,
        "model_version": MODEL_VERSION,
        "probability_of_default": probability,
        "risk_band": assign_risk_band(probability)
    }


# --------------------------------------------------
# Local smoke test
# --------------------------------------------------

if __name__ == "__main__":

    sample_features = {
        "age_years": 32.8,
        "employment_years": 8.2,
        "credit_to_income": 2.5,
        "income_per_family_member": 50000,
        "CNT_FAM_MEMBERS": 4,
        "NAME_INCOME_TYPE": "Working",
        "OCCUPATION_TYPE": "Laborers",
        "NAME_EDUCATION_TYPE": "Higher education",
        "NAME_FAMILY_STATUS": "Married",
        "NAME_HOUSING_TYPE": "House / apartment",
        "FLAG_OWN_CAR": "Y",
        "FLAG_OWN_REALTY": "Y",
    }

    result = predict_credit_risk(
        application_id="CR-001",
        features=sample_features,
    )

    print("\nCredit Risk Prediction")
    print("----------------------")
    print(result)