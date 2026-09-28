# backend/app/models/application.py
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.db import Base

class ApplicationModel(Base):
    __tablename__ = "applications"

    application_id = Column(String, primary_key=True, index=True)
    status = Column(String, default="SUBMITTED", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Nested applicant, loan, and financial objects stored as structured JSON
    applicant = Column(JSON, nullable=False)
    loan = Column(JSON, nullable=False)
    financials = Column(JSON, nullable=False)

    # Relationships
    documents = relationship("DocumentModel", back_populates="application", cascade="all, delete-orphan")
    investigation = relationship("InvestigationModel", back_populates="application", uselist=False)


class DocumentModel(Base):
    __tablename__ = "documents"

    document_id = Column(String, primary_key=True, index=True)
    application_id = Column(String, ForeignKey("applications.application_id"), nullable=False)
    document_type = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("ApplicationModel", back_populates="documents")


class InvestigationModel(Base):
    __tablename__ = "investigations"

    investigation_id = Column(String, primary_key=True, index=True)
    application_id = Column(String, ForeignKey("applications.application_id"), unique=True, nullable=False)
    status = Column(String, default="PENDING", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Stores the Section 10 results package produced by the AI pipeline
    result_payload = Column(JSON, nullable=True)

    application = relationship("ApplicationModel", back_populates="investigation")