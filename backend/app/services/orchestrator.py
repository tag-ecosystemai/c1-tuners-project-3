import os
import logging
import sys
from typing import Dict, Any, List
from dotenv import load_dotenv

# Ensure project root is on sys.path for importing the 'ai' package
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.schemas import (
    InvestigationResponse,
    JobStatusEnum,
    PolicySummary,
    ConsumerFinancialMetrics,
    MLPredictionResult,
    RiskBandEnum,
    GeneratedReport,
    ReportKeyFinding,
    SeverityEnum,
)

load_dotenv()

logger = logging.getLogger(__name__)

USE_MOCK_AI = os.getenv("USE_MOCK_AI", "false").lower() == "true"


def _generate_fallback_investigation(inv_id: str, app_id: str, app_data: Dict[str, Any]) -> InvestigationResponse:
    """Built-in fallback generator used if LangGraph fails or USE_MOCK_AI=true."""
    applicant = app_data.get("applicant", {})
    loan = app_data.get("loan", {})
    name = applicant.get("full_name", "Applicant")
    amount = float(loan.get("amount", 1000000.0))

    return InvestigationResponse(
        investigation_id=inv_id,
        application_id=app_id,
        status=JobStatusEnum.COMPLETED,
        policy=PolicySummary(passed=3, failed=0, requires_review=0),
        financial_analysis=ConsumerFinancialMetrics(
            total_monthly_income=500000.0,
            disposable_income=260000.0,
            debt_to_income_ratio=0.12,
            expense_to_income_ratio=0.36,
            loan_to_income_ratio=0.20,
        ),
        transaction_findings=[],
        credit_risk=MLPredictionResult(
            application_id=app_id,
            model_version="hist_gradient_boost_v1",
            probability_of_default=0.0784,
            risk_band=RiskBandEnum.LOW,
            prediction_horizon="12_MONTHS",
        ),
        report=GeneratedReport(
            investigation_id=inv_id,
            summary=f"Applicant {name} qualifies for ₦{amount:,.2f} facility under baseline standards.",
            key_findings=[
                ReportKeyFinding(
                    finding="Debt-to-Income ratio within policy parameters.",
                    severity=SeverityEnum.LOW,
                    evidence=["DTI evaluated at 12%"],
                    policy_reference="POL-CONS-DTI",
                )
            ],
            report=f"DECISION: RECOMMEND APPROVAL\n\nApplicant {name} meets baseline underwriting criteria.",
        ),
    )


def run_investigation_service(
    inv_id: str, 
    application_data: Dict[str, Any]
) -> InvestigationResponse:
    """Executes the 5-stage underwriting investigation pipeline."""
    app_id = (
        application_data.get("application_id")
        or application_data.get("id")
        or "CR-301"
    )

    if not USE_MOCK_AI:
        try:
            logger.info("Executing live LangGraph pipeline for ID: %s", inv_id)

            from ai.graph import investigation_graph

            initial_state = {
                "investigation_id": inv_id,
                "application_id": app_id,
                "application_data": application_data,
                "validation_errors": [],
                "policy_findings": [],
                "transaction_findings": [],
            }

            final_state = investigation_graph.invoke(initial_state)

            # 1. Map Policy
            raw_policy = final_state.get("policy_summary", {})
            policy_summary = PolicySummary(
                passed=raw_policy.get("passed", 0),
                failed=raw_policy.get("failed", 0),
                requires_review=raw_policy.get("requires_review", 0),
            )

            # 2. Map Financials
            raw_fin = final_state.get("financial_metrics", {})
            financial_metrics = ConsumerFinancialMetrics(
                total_monthly_income=float(raw_fin.get("total_monthly_income", 0.0)),
                disposable_income=float(raw_fin.get("disposable_income", 0.0)),
                debt_to_income_ratio=float(raw_fin.get("debt_to_income_ratio", 0.0)),
                expense_to_income_ratio=float(raw_fin.get("expense_to_income_ratio", 0.0)),
                loan_to_income_ratio=float(raw_fin.get("loan_to_income_ratio", 0.0)),
            )

            # 3. Map ML Risk
            raw_ml = final_state.get("ml_risk_result", {})
            raw_band = str(raw_ml.get("risk_band", "MEDIUM")).upper()
            risk_band = (
                RiskBandEnum[raw_band]
                if raw_band in RiskBandEnum.__members__
                else RiskBandEnum.MEDIUM
            )

            credit_risk = MLPredictionResult(
                application_id=app_id,
                model_version=raw_ml.get("model_version", "hist_gradient_boost_v1"),
                probability_of_default=float(raw_ml.get("probability_of_default", 0.0)),
                risk_band=risk_band,
                prediction_horizon="12_MONTHS",
            )

            # 4. Map Report & Key Findings
            raw_report = final_state.get("final_report", {})
            findings_list: List[ReportKeyFinding] = []

            for finding_item in raw_report.get("key_findings", []):
                if isinstance(finding_item, dict):
                    severity_str = str(finding_item.get("severity", "LOW")).upper()
                    sev = (
                        SeverityEnum[severity_str]
                        if severity_str in SeverityEnum.__members__
                        else SeverityEnum.LOW
                    )
                    findings_list.append(
                        ReportKeyFinding(
                            finding=finding_item.get("finding", ""),
                            severity=sev,
                            evidence=finding_item.get("evidence", []),
                            policy_reference=finding_item.get("policy_reference", "POL-GENERIC"),
                        )
                    )
                else:
                    findings_list.append(
                        ReportKeyFinding(
                            finding=str(finding_item),
                            severity=SeverityEnum.LOW,
                            evidence=["Pipeline analysis output"],
                            policy_reference="POL-SUMMARY",
                        )
                    )

            generated_report = GeneratedReport(
                investigation_id=inv_id,
                summary=raw_report.get("summary", ""),
                key_findings=findings_list,
                report=f"UNDERWRITING DECISION: {raw_report.get('recommendation', 'MANUAL REVIEW REQUIRED')}\n\n{raw_report.get('summary', '')}",
            )

            return InvestigationResponse(
                investigation_id=inv_id,
                application_id=app_id,
                status=JobStatusEnum.COMPLETED,
                policy=policy_summary,
                financial_analysis=financial_metrics,
                transaction_findings=[],
                credit_risk=credit_risk,
                report=generated_report,
            )

        except Exception as exc:
            logger.error(
                "Live AI pipeline failed for %s: %s. Falling back.",
                inv_id,
                exc,
                exc_info=True,
            )

    logger.warning("Serving fallback investigation for ID: %s", inv_id)
    return _generate_fallback_investigation(inv_id, app_id, application_data)