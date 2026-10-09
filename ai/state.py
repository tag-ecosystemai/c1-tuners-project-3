from typing import TypedDict, List, Dict, Any, Optional


class InvestigationGraphState(TypedDict, total=False):
    # Core Pipeline Identifiers & Inputs
    investigation_id: str
    application_id: str
    application_data: Dict[str, Any]

    # Stage 1: Validation
    validation_status: str  # "PASSED" | "FAILED"
    validation_errors: List[str]

    # Stage 2: Policy Retrieval & Evaluation (RAG)
    policy_summary: Dict[str, int]  # {"passed": 3, "failed": 0, "requires_review": 1}
    policy_findings: List[Dict[str, Any]]

    # Stage 3: Financial Analysis
    financial_metrics: Dict[str, float]  # dti, disposable_income, ratios

    # Stage 4: ML Risk Prediction (Shifted up!)
    ml_risk_result: Dict[str, Any]  # default probability, risk band, model version

    # Stage 5: Report Synthesis
    final_report: Dict[str, Any]  # summary, key_findings, narrative markdown

    # Optional/Bypassed: Kept as empty list for frontend schema compatibility
    transaction_findings: List[Dict[str, Any]]