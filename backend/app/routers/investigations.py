import time
import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import SessionLocal, get_db
from app.models.application import ApplicationModel, InvestigationModel
from app.schemas import (
    FinancialMetrics,
    GeneratedReport,
    InvestigationResponse,
    JobStatusEnum,
    MLPredictionResult,
    PolicySummary,
    ReportKeyFinding,
    RiskBandEnum,
    SeverityEnum,
    TransactionFinding,
)

router = APIRouter(prefix="/investigations", tags=["Investigations"])


def run_pipeline_worker(inv_id: str, app_id: str):
    """
    Background worker that runs asynchronously.
    Uses its own dedicated database session.
    """
    db = SessionLocal()
    try:
        # 1. Update status to RUNNING
        inv_record = (
            db.query(InvestigationModel)
            .filter(InvestigationModel.investigation_id == inv_id)
            .first()
        )
        if not inv_record:
            return

        inv_record.status = JobStatusEnum.RUNNING.value
        db.commit()

        # Fetch applicant financial details to generate realistic output
        app_record = (
            db.query(ApplicationModel)
            .filter(ApplicationModel.application_id == app_id)
            .first()
        )
        if not app_record:
            inv_record.status = JobStatusEnum.FAILED.value
            db.commit()
            return

        # 2. Simulate AI pipeline execution time (2.5 seconds)
        time.sleep(2.5)

        fin = app_record.financials
        loan = app_record.loan

        monthly_rev = fin.get("monthly_revenue", 1)
        monthly_net = fin.get("monthly_net_income", 0)
        debt_payment = fin.get("existing_monthly_debt_payment", 0)

        # 3. Construct the exact Section 10 contract payload
        completed_package = InvestigationResponse(
            investigation_id=inv_id,
            application_id=app_id,
            status=JobStatusEnum.COMPLETED,
            policy=PolicySummary(passed=2, failed=1, requires_review=1),
            financial_analysis=FinancialMetrics(
                net_profit_margin=round(monthly_net / monthly_rev, 2),
                debt_to_revenue=round(debt_payment / monthly_rev, 2),
                income_to_debt_payment=round(monthly_net / debt_payment, 2) if debt_payment > 0 else 1.0,
                dscr=0.50,
                loan_to_annual_revenue=round(loan.get("amount", 0) / (monthly_rev * 12), 3)
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
                summary=f"Analysis completed for {app_record.applicant.get('name', 'Applicant')}. Operating cash flows are regular, but debt obligations exceed policy covenants.",
                key_findings=[
                    ReportKeyFinding(
                        finding="Calculated DSCR of 0.50x fails minimum policy covenant of 1.25x.",
                        severity=SeverityEnum.HIGH,
                        evidence=["DOC-001"],
                        policy_reference="POL-001"
                    )
                ],
                report="Full Credit Investigation Report: The applicant demonstrates stable operating revenues across manufacturing activities. However, existing debt obligations constrain liquidity..."
            )
        )

        # 4. Save results payload and update status to COMPLETED
        inv_record.result_payload = completed_package.model_dump()
        inv_record.status = JobStatusEnum.COMPLETED.value
        
        # Also update Application status to reflect review state
        app_record.status = "UNDER_REVIEW"
        
        db.commit()

    except Exception:
        db.rollback()
        inv_record = (
            db.query(InvestigationModel)
            .filter(InvestigationModel.investigation_id == inv_id)
            .first()
        )
        if inv_record:
            inv_record.status = JobStatusEnum.FAILED.value
            db.commit()
    finally:
        db.close()


@router.post("/trigger/{application_id}", status_code=status.HTTP_202_ACCEPTED)
def trigger_investigation(
    application_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Validates application existence, creates a PENDING investigation record,
    and enqueues the AI background pipeline.
    """
    app_record = (
        db.query(ApplicationModel)
        .filter(ApplicationModel.application_id == application_id)
        .first()
    )
    if not app_record:
        raise HTTPException(
            status_code=404,
            detail=f"Application '{application_id}' does not exist."
        )

    # Check if an investigation record already exists for this application
    existing_inv = (
        db.query(InvestigationModel)
        .filter(InvestigationModel.application_id == application_id)
        .first()
    )

    inv_id = existing_inv.investigation_id if existing_inv else f"INV-{uuid.uuid4().hex[:6].upper()}"

    if existing_inv:
        existing_inv.status = JobStatusEnum.PENDING.value
        existing_inv.result_payload = None
    else:
        new_inv = InvestigationModel(
            investigation_id=inv_id,
            application_id=application_id,
            status=JobStatusEnum.PENDING.value
        )
        db.add(new_inv)

    db.commit()

    # Enqueue background execution
    background_tasks.add_task(run_pipeline_worker, inv_id, application_id)

    return {"investigation_id": inv_id, "status": JobStatusEnum.PENDING.value}


@router.get("/status/{investigation_id}")
def get_job_status(investigation_id: str, db: Session = Depends(get_db)):
    """Allows frontend to poll the current execution state."""
    inv = (
        db.query(InvestigationModel)
        .filter(InvestigationModel.investigation_id == investigation_id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation job not found")
    return {"investigation_id": inv.investigation_id, "status": inv.status}


@router.get("/{application_id}", response_model=InvestigationResponse)
def get_investigation_result(application_id: str, db: Session = Depends(get_db)):
    """Fetches the final Section 10 report once completed."""
    inv = (
        db.query(InvestigationModel)
        .filter(InvestigationModel.application_id == application_id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="No investigation initiated for this application")
    
    if inv.status != JobStatusEnum.COMPLETED.value or not inv.result_payload:
        raise HTTPException(
            status_code=400,
            detail=f"Investigation is currently '{inv.status}'. Report is not ready yet."
        )

    return inv.result_payload