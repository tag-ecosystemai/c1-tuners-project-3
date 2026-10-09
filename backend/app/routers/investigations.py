import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import SessionLocal, get_db
from app.models.application import ApplicationModel, InvestigationModel
from app.schemas import InvestigationResponse, JobStatusEnum
from app.services.orchestrator import run_investigation_service

router = APIRouter(prefix="/investigations", tags=["Investigations"])


def run_pipeline_worker(inv_id: str, app_id: str):
    """
    Background worker that runs asynchronously using an isolated DB session.
    Delegates consumer calculation logic to the orchestrator service.
    """
    db = SessionLocal()
    try:
        inv_record = (
            db.query(InvestigationModel)
            .filter(InvestigationModel.investigation_id == inv_id)
            .first()
        )
        if not inv_record:
            return

        inv_record.status = JobStatusEnum.RUNNING.value
        db.commit()

        app_record = (
            db.query(ApplicationModel)
            .filter(ApplicationModel.application_id == app_id)
            .first()
        )
        if not app_record:
            inv_record.status = JobStatusEnum.FAILED.value
            db.commit()
            return

        app_data = {
            "application_id": app_record.application_id,
            "applicant": app_record.applicant,
            "loan": app_record.loan,
            "financials": app_record.financials,
        }

        # Run consumer underwriting service
        completed_package = run_investigation_service(inv_id, app_data)

        inv_record.result_payload = completed_package.model_dump()
        inv_record.status = JobStatusEnum.COMPLETED.value
        app_record.status = "UNDER_REVIEW"

        db.commit()

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Investigation failed: {e}")
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
    Creates a PENDING investigation record and enqueues the async pipeline task.
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

    background_tasks.add_task(run_pipeline_worker, inv_id, application_id)

    return {"investigation_id": inv_id, "status": JobStatusEnum.PENDING.value}


@router.get("/status/{investigation_id}")
def get_job_status(investigation_id: str, db: Session = Depends(get_db)):
    """Allows client to poll job execution state."""
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
    """Returns the completed Section 10 consumer report payload."""
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

@router.get("/by-id/{investigation_id}", response_model=InvestigationResponse)
def get_investigation_by_job_id(investigation_id: str, db: Session = Depends(get_db)):
    """Allows lookup directly via investigation_id (INV-xxxxxx)."""
    inv = db.query(InvestigationModel).filter(InvestigationModel.investigation_id == investigation_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    if inv.status != JobStatusEnum.COMPLETED.value or not inv.result_payload:
        raise HTTPException(status_code=400, detail="Investigation not completed yet")
    return inv.result_payload