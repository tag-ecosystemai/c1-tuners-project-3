import uuid
from typing import List
from fastapi import APIRouter, UploadFile, File, Form, status
from app.schemas import DocumentMetadata

router = APIRouter(prefix="/documents", tags=["Documents"])

DOCUMENTS_STORE: dict = {}

@router.post("/upload", response_model=DocumentMetadata, status_code=status.HTTP_201_CREATED)
async def upload_document(
    application_id: str = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...)
):
    doc_id = f"DOC-{str(uuid.uuid4().int)[:3]}"
    meta = DocumentMetadata(
        document_id=doc_id,
        application_id=application_id,
        document_type=document_type,
        file_name=file.filename,
        storage_path=f"applications/{application_id}/{file.filename}"
    )
    DOCUMENTS_STORE[doc_id] = meta
    return meta