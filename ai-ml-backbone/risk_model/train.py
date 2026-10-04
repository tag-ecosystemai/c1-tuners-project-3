from pathlib import Path

import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from features import (
    prepare_home_credit,
    build_features,
    NUMERIC_FEATURES,
    CATEGORICAL_FEATURES,
    BINARY_FEATURES,
    TARGET,
)


# --------------------------------------------------
# Paths
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "application_train.csv"
MODEL_DIR = BASE_DIR / "models"


# --------------------------------------------------
# Load data
# --------------------------------------------------

df = pd.read_csv(DATA_PATH)

print(f"Raw dataset shape: {df.shape}")


# --------------------------------------------------
# Restrict to cash loans
# --------------------------------------------------

df = df[df["NAME_CONTRACT_TYPE"] == "Cash loans"].copy()

print(f"Cash-loan dataset shape: {df.shape}")


# --------------------------------------------------
# Separate target before feature preparation
# --------------------------------------------------
y = df["TARGET"].astype(int)

# --------------------------------------------------
# Prepare canonical applicant data
# --------------------------------------------------
df = prepare_home_credit(df)
print(f"Canonical dataset shape: {df.shape}")

# --------------------------------------------------
# Build model features
# --------------------------------------------------
X = build_features(df)

print(f"Feature matrix shape: {X.shape}")
print(f"Target mean: {y.mean():.4f}")


# --------------------------------------------------
# Train/test split
# --------------------------------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    stratify=y,
    random_state=42,
)

print(f"Training rows: {len(X_train)}")
print(f"Test rows: {len(X_test)}")


# --------------------------------------------------
# Preprocessing
# --------------------------------------------------

numeric_pipeline = Pipeline(
    steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ]
)

categorical_pipeline = Pipeline(
    steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        (
            "encoder",
            OneHotEncoder(
                handle_unknown="ignore",
                sparse_output=False,
            ),
        ),
    ]
)

preprocessor = ColumnTransformer(
    transformers=[
        ("numeric", numeric_pipeline, NUMERIC_FEATURES),
        ("categorical", categorical_pipeline, CATEGORICAL_FEATURES),
        ("binary", categorical_pipeline, BINARY_FEATURES),
    ]
)


# --------------------------------------------------
# Logistic Regression baseline
# --------------------------------------------------

logistic_model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "classifier",
            LogisticRegression(
                max_iter=1000,
                class_weight="balanced",
                random_state=42,
            ),
        ),
    ]
)


# --------------------------------------------------
# Train
# --------------------------------------------------

logistic_model.fit(X_train, y_train)

logistic_probabilities = logistic_model.predict_proba(X_test)[:, 1]


# --------------------------------------------------
# Evaluate
# --------------------------------------------------

print("\nLogistic Regression")
print("-------------------")

print(
    f"ROC-AUC: {roc_auc_score(y_test, logistic_probabilities):.4f}"
)

print(
    f"PR-AUC:  {average_precision_score(y_test, logistic_probabilities):.4f}"
)

print(
    f"Brier:   {brier_score_loss(y_test, logistic_probabilities):.4f}"
)

# --------------------------------------------------
# HistGradientBoosting model
# --------------------------------------------------

hist_gradient_model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "classifier",
            HistGradientBoostingClassifier(
                max_iter=200,
                learning_rate=0.05,
                max_leaf_nodes=31,
                l2_regularization=1.0,
                random_state=42,
            ),
        ),
    ]
)

hist_gradient_model.fit(X_train, y_train)

hist_gradient_probabilities = (
    hist_gradient_model.predict_proba(X_test)[:, 1]
)

print("\nHistGradientBoosting")

print("--------------------")

print(
    f"ROC-AUC: {roc_auc_score(y_test, hist_gradient_probabilities):.4f}"
)

print(
    f"PR-AUC:  {average_precision_score(y_test, hist_gradient_probabilities):.4f}"
)

print(
    f"Brier:   {brier_score_loss(y_test, hist_gradient_probabilities):.4f}"
)

# --------------------------------------------------
# Risk-band reference cutoffs
# --------------------------------------------------

# Generate reference scores on the training set.
# These scores are used only to establish the score
# distribution for relative risk bands.
hist_gradient_train_probabilities = (
    hist_gradient_model.predict_proba(X_train)[:, 1]
)

LOW_CUTOFF = float(
    pd.Series(hist_gradient_train_probabilities).quantile(0.40)
)

HIGH_CUTOFF = float(
    pd.Series(hist_gradient_train_probabilities).quantile(0.80)
)

print("\nRisk-band cutoffs")

print("-----------------")

print(f"LOW/MEDIUM cutoff (40th percentile): {LOW_CUTOFF:.6f}")

print(f"MEDIUM/HIGH cutoff (80th percentile): {HIGH_CUTOFF:.6f}")

# --------------------------------------------------
# Evaluate risk bands on untouched test set
# --------------------------------------------------

def assign_risk_band(probability):
    if probability < LOW_CUTOFF:
        return "LOW"
    elif probability < HIGH_CUTOFF:
        return "MEDIUM"
    else:
        return "HIGH"


test_bands = pd.Series(
    hist_gradient_probabilities
).apply(assign_risk_band)

band_results = pd.DataFrame(
    {
        "band": test_bands,
        "target": y_test.to_numpy(),
    }
)

band_summary = (
    band_results
    .groupby("band", observed=True)
    .agg(
        applicants=("target", "size"),
        default_rate=("target", "mean"),
    )
    .reindex(["LOW", "MEDIUM", "HIGH"])
)

band_summary["share"] = (
    band_summary["applicants"] / len(y_test)
)

print("\nRisk-band evaluation")

print("--------------------")

print(band_summary)

# --------------------------------------------------
# Save baseline model
# --------------------------------------------------

MODEL_DIR.mkdir(exist_ok=True)

joblib.dump(
    logistic_model,
    MODEL_DIR / "logistic_baseline.joblib",
)

joblib.dump(
    hist_gradient_model,
    MODEL_DIR / "hist_gradient_boost.joblib",
)

print("\nModels saved.")