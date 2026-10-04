import numpy as np
import pandas as pd


# ============================================================
# Feature contract
# ============================================================

TARGET = "default"

NUMERIC_FEATURES = [
    "age_years",
    "employment_years",
    "credit_to_income",
    "income_per_family_member",
    "CNT_FAM_MEMBERS",
]

CATEGORICAL_FEATURES = [
    "NAME_INCOME_TYPE",
    "OCCUPATION_TYPE",
    "NAME_EDUCATION_TYPE",
    "NAME_FAMILY_STATUS",
    "NAME_HOUSING_TYPE",
]

BINARY_FEATURES = [
    "FLAG_OWN_CAR",
    "FLAG_OWN_REALTY",
]

FEATURE_COLUMNS = (
    NUMERIC_FEATURES
    + CATEGORICAL_FEATURES
    + BINARY_FEATURES
)


# Home Credit uses this value to represent clients
# for whom employment duration is not available.
DAYS_EMPLOYED_SENTINEL = 365243


# ============================================================
# Raw Home Credit -> canonical applicant fields
# ============================================================

def prepare_home_credit(df: pd.DataFrame) -> pd.DataFrame:
    """
    Convert raw Home Credit application columns into the
    canonical applicant-level fields used by the risk model.
    """

    data = df.copy()

    # Age
    data["age_years"] = -data["DAYS_BIRTH"] / 365.25

    # Employment duration
    data.loc[
        data["DAYS_EMPLOYED"] == DAYS_EMPLOYED_SENTINEL,
        "DAYS_EMPLOYED"
    ] = np.nan

    data["employment_years"] = (
        -data["DAYS_EMPLOYED"] / 365.25
    )

    # Loan burden relative to income
    data["credit_to_income"] = (
        data["AMT_CREDIT"] / data["AMT_INCOME_TOTAL"]
    )

    # Income available per family member
    data["income_per_family_member"] = (
        data["AMT_INCOME_TOTAL"] / data["CNT_FAM_MEMBERS"]
    )

    return data[FEATURE_COLUMNS]


# ============================================================
# Final feature matrix
# ============================================================

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Return the model-ready feature matrix in a fixed column order.
    """
    features = df[FEATURE_COLUMNS].copy()
    return features