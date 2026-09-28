from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "kerdt-backend"}