# Credit Risk Model

Credit-risk scoring component for the Kredt AI pipeline.

The model estimates an applicant's likelihood of the payment-difficulty
outcome observed in the training dataset and assigns a relative risk band.
It is intended to support analyst review, not make automated approval or
decline decisions.

## Pipeline

Historical Home Credit application data
→ Cash-loan filtering
→ Feature preparation
→ Feature engineering
→ Train/test split
→ Model training
→ Evaluation
→ Versioned model
→ Prediction

## Dataset

Training data:  [ Home Credit application data](https://www.kaggle.com/competitions/home-credit-default-risk/data)

Only `Cash loans` applications are used.

The target is the dataset's `TARGET` variable. In Home Credit, this represents
payment difficulty rather than a general or time-bounded default event.

The final feature set contains 12 engineered applicant features covering
demographic, employment, credit-to-income, household, education, occupation,
housing and ownership information.

## Models

Two models were evaluated:

- **Logistic Regression** — interpretable baseline.
- **HistGradientBoostingClassifier**— selected as the final model because it
  captured nonlinear relationships while providing better test-set
  performance than the baseline.

### Test-set performance

| Model | ROC-AUC | PR-AUC | Brier |
|---|---:|---:|---:|
| Logistic Regression | 0.6392 | 0.1384 | 0.2356 |
| HistGradientBoosting | **0.6483** | **0.1449** | **0.0747** |

The HistGradientBoosting model is therefore used for inference.

## Risk Bands

Risk bands are relative rankings against the Home Credit reference population.
They are not approval thresholds.

The cutoffs were derived from the 40th and 80th percentiles of reference
predicted scores:

- LOW: probability < `0.062867`
- MEDIUM: `0.062867` to < `0.112622`
- HIGH: probability >= `0.112622`

The 40/40/20 distribution was a judgment-based choice made in the absence
of business cost data. The cutoffs are fixed with the model version and are
not recalculated for individual predictions.

### Held-out band evaluation

| Band | Share | Observed payment-difficulty rate |
|---|---:|---:|
| LOW | 39.75% | 4.80% |
| MEDIUM | 40.37% | 8.28% |
| HIGH | 19.89% | 15.57% |

The increasing observed outcome rate across the bands supports their use as
relative risk-ranking signals.

## Prediction Output

`predict.py` returns:

```json
{
  "application_id": "CR-001",
  "model_version": "credit-risk-v1",
  "probability_of_default": 0.06,
  "risk_band": "LOW"
}
```
`probability_of_default` is retained for compatibility with the team contract. For this implementation, it should be interpreted as the probability of the training dataset's payment-difficulty outcome. No prediction horizon is claimed because the dataset and project specification do not establish a supported time horizon.


## Limitations
- The model was trained on Home Credit data rather than Kredt's Nigerian applicant population.
- Absolute predicted probabilities may not transfer to the target population.
- Model discrimination is modest (ROC-AUC 0.6483).
- Risk bands represent relative model risk and must not be treated as
automatic approve/decline decisions.
- Further validation and calibration shall be performed when representative Kredt data becomes available.

### Files
- `features.py` — canonical data preparation and feature engineering
- `train.py` — model training and evaluation
- `predict.py` — inference interface
- `models/hist_gradient_boost.joblib` — selected model
- `models/logistic_baseline.joblib` — baseline model
- `data/application_train.csv` — training dataset
- `tests/` — model-related tests

### Status

Credit-risk model pipeline implemented and ready for integration with the Kredt orchestration layer.

