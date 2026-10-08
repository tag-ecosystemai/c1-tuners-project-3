from typing import Any
from pydantic import BaseModel


class InvestigationRequest(BaseModel):
    application_id: str


class InvestigationError(BaseModel):
    component: str
    error: str


class EvidencePackage(BaseModel):
    application_id: str
    investigation_id: str
    status: str

    policy_findings: list[Any]
    financial_analysis: dict[str, Any]
    transaction_findings: list[Any]
    credit_risk: dict[str, Any]

    evidence: list[Any]
    errors: list[InvestigationError]