import numpy as np
import pandas as pd

from risk_model.features import (
    prepare_home_credit,
    build_features,
    DAYS_EMPLOYED_SENTINEL,
    FEATURE_COLUMNS,
)


def test_employment_sentinel_becomes_missing():
    df = pd.DataFrame({
        "DAYS_BIRTH": [-10000],
        "DAYS_EMPLOYED": [DAYS_EMPLOYED_SENTINEL],
        "AMT_CREDIT": [100000],
        "AMT_INCOME_TOTAL": [200000],
        "CNT_FAM_MEMBERS": [2],
        "NAME_INCOME_TYPE": ["Working"],
        "OCCUPATION_TYPE": ["Laborers"],
        "NAME_EDUCATION_TYPE": ["Higher education"],
        "NAME_FAMILY_STATUS": ["Married"],
        "NAME_HOUSING_TYPE": ["House / apartment"],
        "FLAG_OWN_CAR": ["Y"],
        "FLAG_OWN_REALTY": ["Y"],
        "default": [0],
    })

    result = prepare_home_credit(df)

    assert pd.isna(result.loc[0, "employment_years"])


def test_age_is_converted_to_years():
    df = pd.DataFrame({
        "DAYS_BIRTH": [-3652.5],
        "DAYS_EMPLOYED": [-3652.5],
        "AMT_CREDIT": [100000],
        "AMT_INCOME_TOTAL": [200000],
        "CNT_FAM_MEMBERS": [2],
        "NAME_INCOME_TYPE": ["Working"],
        "OCCUPATION_TYPE": ["Laborers"],
        "NAME_EDUCATION_TYPE": ["Higher education"],
        "NAME_FAMILY_STATUS": ["Married"],
        "NAME_HOUSING_TYPE": ["House / apartment"],
        "FLAG_OWN_CAR": ["Y"],
        "FLAG_OWN_REALTY": ["Y"],
        "default": [0],
    })

    result = prepare_home_credit(df)

    assert np.isclose(result.loc[0, "age_years"], 10)
    assert np.isclose(result.loc[0, "employment_years"], 10)


def test_credit_to_income():
    df = pd.DataFrame({
        "DAYS_BIRTH": [-10000],
        "DAYS_EMPLOYED": [-3650],
        "AMT_CREDIT": [100000],
        "AMT_INCOME_TOTAL": [200000],
        "CNT_FAM_MEMBERS": [2],
        "NAME_INCOME_TYPE": ["Working"],
        "OCCUPATION_TYPE": ["Laborers"],
        "NAME_EDUCATION_TYPE": ["Higher education"],
        "NAME_FAMILY_STATUS": ["Married"],
        "NAME_HOUSING_TYPE": ["House / apartment"],
        "FLAG_OWN_CAR": ["Y"],
        "FLAG_OWN_REALTY": ["Y"],
        "default": [0],
    })

    result = prepare_home_credit(df)

    assert np.isclose(result.loc[0, "credit_to_income"], 0.5)


def test_income_per_family_member():
    df = pd.DataFrame({
        "DAYS_BIRTH": [-10000],
        "DAYS_EMPLOYED": [-3650],
        "AMT_CREDIT": [100000],
        "AMT_INCOME_TOTAL": [200000],
        "CNT_FAM_MEMBERS": [4],
        "NAME_INCOME_TYPE": ["Working"],
        "OCCUPATION_TYPE": ["Laborers"],
        "NAME_EDUCATION_TYPE": ["Higher education"],
        "NAME_FAMILY_STATUS": ["Married"],
        "NAME_HOUSING_TYPE": ["House / apartment"],
        "FLAG_OWN_CAR": ["Y"],
        "FLAG_OWN_REALTY": ["Y"],
        "default": [0],
    })

    result = prepare_home_credit(df)

    assert np.isclose(
        result.loc[0, "income_per_family_member"],
        50000
    )


def test_feature_column_order():
    df = pd.DataFrame({
        "age_years": [30],
        "employment_years": [5],
        "credit_to_income": [0.5],
        "income_per_family_member": [50000],
        "CNT_FAM_MEMBERS": [2],
        "NAME_INCOME_TYPE": ["Working"],
        "OCCUPATION_TYPE": ["Laborers"],
        "NAME_EDUCATION_TYPE": ["Higher education"],
        "NAME_FAMILY_STATUS": ["Married"],
        "NAME_HOUSING_TYPE": ["House / apartment"],
        "FLAG_OWN_CAR": ["Y"],
        "FLAG_OWN_REALTY": ["Y"],
    })

    result = build_features(df)

    assert list(result.columns) == FEATURE_COLUMNS