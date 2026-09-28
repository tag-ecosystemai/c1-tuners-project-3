import uuid
from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from app.schemas import (
    InvestigationResponse,
    JobStatusEnum,
    PolicySummary,
    FinancialMetrics,
    TransactionFinding,
    SeverityEnum,
    MLPredictionResult,
    RiskBandEnum,
    GeneratedReport,
    ReportKeyFinding,
)

router = APIRouter(prefix="/investigations", tags=["Investigations"])

INVESTIGATIONS_STORE: dict = {}
JOBS_STORE: dict = {}

def simulate_pipeline(inv_id: str, app_id: str):
    """Placeholder background runner matching Section 10 contract."""
    JOBS_STORE[inv_id] = JobStatusEnum.RUNNING

    # Build the exact Section 10 mock package
    result = InvestigationResponse(
        investigation_id=inv_id,
        application_id=app_id,
        status=JobStatusEnum.COMPLETED,
        policy=PolicySummary(passed=2, failed=1, requires_review=1),
        financial_analysis=FinancialMetrics(
            net_profit_margin=0.20,
            debt_to_revenue=0.40,
            income_to_debt_payment=0.50,
            dscr=0.50,
            loan_to_annual_revenue=0.167
        ),
        transaction_findings=[
            TransactionFinding(
                type="LARGE_INFLOW",
                severity=SeverityEnum.MEDIUM,
                amount=4500000.0,
                date="2026-08-12",
                description="Transaction significantly exceeds typical inflow amount.",
                transaction_reference="TXN-002"
            )
        ],
        credit_risk=MLPredictionResult(
            application_id=app_id,
            model_version="credit-risk-v1",
            probability_of_default=0.18,
            risk_band=RiskBandEnum.MEDIUM,
            prediction_horizon="12_MONTHS"
        ),
        report=GeneratedReport(
            investigation_id=inv_id,
            summary="ABC Manufacturing Ltd. demonstrates steady operational cash flow but has an elevated debt ratio.",
            key_findings=[
                ReportKeyFinding(
                    finding="DSCR of 0.50x falls below minimum requirement of 1.25x.",
                    severity=SeverityEnum.HIGH,
                    evidence=["DOC-001"],
                    policy_reference="POL-001"
                )
            ],
            report="Full credit assessment report text..."
        )
    )
    INVESTIGATIONS_STORE[app_id] = result
    JOBS_STORE[inv_id] = JobStatusEnum.COMPLETED

@router.post("/trigger/{application_id}", status_code=status.HTTP_202_ACCEPTED)
def trigger_investigation(application_id: str, background_tasks: BackgroundTasks):
    inv_id = f"INV-{uuid.uuid4().hex[:6].upper()}"
    JOBS_STORE[inv_id] = JobStatusEnum.PENDING
    background_tasks.add_task(simulate_pipeline, inv_id, application_id)
    return {"investigation_id": inv_id, "status": JobStatusEnum.PENDING}

@router.get("/status/{investigation_id}")
def get_job_status(investigation_id: str):
    if investigation_id not in JOBS_STORE:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"investigation_id": investigation_id, "status": JOBS_STORE[investigation_id]}

@router.get("/{application_id}", response_model=InvestigationResponse)
def get_investigation_result(application_id: str):
    if application_id not in INVESTIGATIONS_STORE:
        raise HTTPException(status_code=404, detail="Report not ready or not found")
    return INVESTIGATIONS_STORE[application_id]