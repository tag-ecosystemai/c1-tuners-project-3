import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.application import ApplicationModel
from app.schemas import ApplicationCreate, ApplicationRecord

router = APIRouter(prefix="/applications", tags=["Applications"])

@router.post("", response_model=ApplicationRecord, status_code=status.HTTP_201_CREATED)
def submit_application(payload: ApplicationCreate, db: Session = Depends(get_db)):
    """Creates a new loan application and persists it directly to the database."""
    app_id = f"CR-{str(uuid.uuid4().int)[:3]}"

    # Convert Pydantic models to dictionaries so SQLAlchemy stores them as JSON
    new_app = ApplicationModel(
        application_id=app_id,
        status="SUBMITTED",
        applicant=payload.applicant.model_dump(),
        loan=payload.loan.model_dump(),
        financials=payload.financials.model_dump(),
    )

    db.add(new_app)
    db.commit()
    db.refresh(new_app)

    return new_app


@router.get("", response_model=List[ApplicationRecord])
def list_applications(db: Session = Depends(get_db)):
    """Retrieves all loan applications saved in the database."""
    return db.query(ApplicationModel).all()


@router.get("/{application_id}", response_model=ApplicationRecord)
def get_application(application_id: str, db: Session = Depends(get_db)):
    """Retrieves a single application by its ID."""
    app_record = (
        db.query(ApplicationModel)
        .filter(ApplicationModel.application_id == application_id)
        .first()
    )
    if not app_record:
        raise HTTPException(status_code=404, detail="Application not found")
    return app_record