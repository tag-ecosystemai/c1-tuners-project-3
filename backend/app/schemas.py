from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ── Section 1 - Consumer Borrower Profile ──

class ConsumerApplicantDetails(BaseModel):
    full_name: str
    age: int = Field(ge=18, le=100)
    gender: Optional[str] = "Unspecified"
    marital_status: str = "Single"
    employment_status: str = "Employed"  # Employed, Self-Employed, Unemployed, Retired
    employment_duration_months: int = Field(ge=0)
    education_level: Optional[str] = "BSc"
    housing_type: str = "Renting"  # Renting, Owns, Living with Parents
    location: str


class ConsumerLoanDetails(BaseModel):
    amount: float = Field(gt=0)
    currency: str = "NGN"
    purpose: str  # Personal, Medical, Education, Auto, Debt Consolidation
    tenor_months: int = Field(gt=0)


class ConsumerFinancials(BaseModel):
    monthly_salary_income: float = Field(gt=0)
    additional_income: float = Field(default=0.0, ge=0)
    monthly_living_expenses: float = Field(ge=0)
    existing_loan_obligations: float = Field(ge=0)
    total_debt: float = Field(default=0.0, ge=0)


class ApplicationCreate(BaseModel):
    applicant: ConsumerApplicantDetails
    loan: ConsumerLoanDetails
    financials: ConsumerFinancials


class ApplicationRecord(ApplicationCreate):
    application_id: str
    status: str = "SUBMITTED"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


# ── Section 2 - Document Metadata ──

class DocumentMetadata(BaseModel):
    document_id: str
    application_id: str
    document_type: str  # payslip, bank_statement, id_card, utility_bill
    file_name: str
    storage_path: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


# ── Section 10 - Investigation Contracts ──

class JobStatusEnum(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class SeverityEnum(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RiskBandEnum(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class PolicySummary(BaseModel):
    passed: int
    failed: int
    requires_review: int


class ConsumerFinancialMetrics(BaseModel):
    total_monthly_income: float
    disposable_income: float
    debt_to_income_ratio: float  # DTI: Total monthly debt obligations / Total monthly income
    expense_to_income_ratio: float
    loan_to_income_ratio: float  # Requested loan amount / Annual Income


class TransactionFinding(BaseModel):
    type: str  # SALARY_DETECTED, GAMBLING_OUTFLOW, HIGH_NSF_FEES, IRREGULAR_EXPENSE
    severity: SeverityEnum
    amount: float
    date: str
    description: str
    transaction_reference: str


class MLPredictionResult(BaseModel):
    application_id: str
    model_version: str
    probability_of_default: float
    risk_band: RiskBandEnum
    prediction_horizon: str = "12_MONTHS"


class ReportKeyFinding(BaseModel):
    finding: str
    severity: SeverityEnum
    evidence: List[str]
    policy_reference: str


class GeneratedReport(BaseModel):
    investigation_id: str
    summary: str
    key_findings: List[ReportKeyFinding]
    report: str


class InvestigationResponse(BaseModel):
    investigation_id: str
    application_id: str
    status: JobStatusEnum
    policy: PolicySummary
    financial_analysis: ConsumerFinancialMetrics
    transaction_findings: List[TransactionFinding]
    credit_risk: MLPredictionResult
    report: GeneratedReport