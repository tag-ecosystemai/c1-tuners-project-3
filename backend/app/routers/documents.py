import os
import shutil
import uuid
from typing import List
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.application import ApplicationModel, DocumentModel
from app.schemas import DocumentMetadata

router = APIRouter(prefix="/documents", tags=["Documents"])

# Directory where uploaded files will be stored on your local disk
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload", response_model=DocumentMetadata, status_code=status.HTTP_201_CREATED)
async def upload_document(
    application_id: str = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    1. Validates that the application exists.
    2. Writes the file to the local uploads directory.
    3. Persists document metadata to the SQLite database.
    """
    # 1. Verify application exists first
    app_record = (
        db.query(ApplicationModel)
        .filter(ApplicationModel.application_id == application_id)
        .first()
    )
    if not app_record:
        raise HTTPException(
            status_code=404,
            detail=f"Cannot upload document. Application '{application_id}' does not exist."
        )

    # 2. Save file to disk under an application-specific folder
    app_folder = os.path.join(UPLOAD_DIR, application_id)
    os.makedirs(app_folder, exist_ok=True)
    
    file_path = os.path.join(app_folder, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 3. Create database record
    doc_id = f"DOC-{str(uuid.uuid4().int)[:3]}"
    storage_relative_path = f"applications/{application_id}/{file.filename}"

    new_doc = DocumentModel(
        document_id=doc_id,
        application_id=application_id,
        document_type=document_type,
        file_name=file.filename,
        storage_path=storage_relative_path
    )

    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    return new_doc


@router.get("/application/{application_id}", response_model=List[DocumentMetadata])
def list_documents_for_application(application_id: str, db: Session = Depends(get_db)):
    """Retrieves all documents associated with a specific loan application."""
    docs = (
        db.query(DocumentModel)
        .filter(DocumentModel.application_id == application_id)
        .all()
    )
    return docs