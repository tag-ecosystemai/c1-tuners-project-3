from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# Enums 
class PolicyResultEnum(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    REQUIRES_REVIEW = "REQUIRES_REVIEW"

class SeverityEnum(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class RiskBandEnum(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

class JobStatusEnum(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

# Section 1: Loan Application
class ApplicantInfo(BaseModel):
    name: str
    business_type: str
    industry: str
    business_age_months: int = Field(ge=0)
    location: str

class LoanDetails(BaseModel):
    amount: float = Field(gt=0)
    currency: str = "NGN"
    purpose: str
    tenor_months: int = Field(gt=0)

class FinancialInputs(BaseModel):
    monthly_revenue: float = Field(gt=0)
    monthly_expenses: float = Field(ge=0)
    monthly_net_income: float
    existing_monthly_debt_payment: float = Field(ge=0)
    total_outstanding_debt: float = Field(ge=0)

class ApplicationCreate(BaseModel):
    applicant: ApplicantInfo
    loan: LoanDetails
    financials: FinancialInputs

class ApplicationRecord(ApplicationCreate):
    application_id: str
    status: str = "SUBMITTED"
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Section 2: Documents
class DocumentMetadata(BaseModel):
    document_id: str
    application_id: str
    document_type: str
    file_name: str
    storage_path: str

# Section 5: Financial Metrics
class FinancialMetrics(BaseModel):
    net_profit_margin: float
    debt_to_revenue: float
    income_to_debt_payment: float
    dscr: float
    loan_to_annual_revenue: float

# Section: Transaction Findings
class TransactionFinding(BaseModel):
    type: str
    severity: SeverityEnum
    amount: Optional[float] = None
    date: Optional[str] = None
    description: str
    transaction_reference: Optional[str] = None

# Section 7: Credit Risk
class MLPredictionResult(BaseModel):
    application_id: str
    model_version: str = "credit-risk-v1"
    probability_of_default: float = Field(ge=0.0, le=1.0)
    risk_band: RiskBandEnum
    prediction_horizon: str = "12_MONTHS"

# Section 9: Reports
class ReportKeyFinding(BaseModel):
    finding: str
    severity: SeverityEnum
    evidence: List[str]
    policy_reference: Optional[str] = None

class GeneratedReport(BaseModel):
    investigation_id: str
    summary: str
    key_findings: List[ReportKeyFinding]
    report: str

# Section 10: Final Investigation Response
class PolicySummary(BaseModel):
    passed: int
    failed: int
    requires_review: int

class InvestigationResponse(BaseModel):
    investigation_id: str
    application_id: str
    status: JobStatusEnum
    policy: PolicySummary
    financial_analysis: FinancialMetrics
    transaction_findings: List[TransactionFinding]
    credit_risk: MLPredictionResult
    report: GeneratedReport