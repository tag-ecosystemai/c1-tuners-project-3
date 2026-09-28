from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import engine, Base
import app.models.application  # Ensures models are registered before create_all
from app.routers import applications, documents, investigations

# Automatically create tables on startup if they don't exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title = "Kredt Backend API",
    version="1.0.0",
    description="Understanding engine and AI orchestraation backend for Kredt."
)

# Allowing the frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# Wire routers under the /api/v1 prefix
app.include_router(applications.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(investigations.router, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "kerdt-backend"}

