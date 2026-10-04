import os
import sys

# Anchor import to backend/
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.db import SessionLocal, engine, Base
from app.models.application import ApplicationModel

# Ensure tables are built
Base.metadata.create_all(bind=engine)

CONSUMER_DEMO_APPLICATIONS = [
    {
        "application_id": "CR-CONS-01",
        "status": "SUBMITTED",
        "applicant": {
            "full_name": "Tunde Bakare",
            "age": 34,
            "gender": "Male",
            "marital_status": "Married",
            "employment_status": "Employed",
            "employment_duration_months": 42,
            "education_level": "MSc",
            "housing_type": "Owns",
            "location": "Lekki, Lagos"
        },
        "loan": {
            "amount": 2500000.0,
            "currency": "NGN",
            "purpose": "Home Improvement",
            "tenor_months": 18
        },
        "financials": {
            "monthly_salary_income": 850000.0,
            "additional_income": 120000.0,
            "monthly_living_expenses": 350000.0,
            "existing_loan_obligations": 100000.0,
            "total_debt": 600000.0
        }
    },
    {
        "application_id": "CR-CONS-02",
        "status": "SUBMITTED",
        "applicant": {
            "full_name": "Chioma Okonkwo",
            "age": 27,
            "gender": "Female",
            "marital_status": "Single",
            "employment_status": "Employed",
            "employment_duration_months": 8,
            "education_level": "BSc",
            "housing_type": "Renting",
            "location": "Ikeja, Lagos"
        },
        "loan": {
            "amount": 1500000.0,
            "currency": "NGN",
            "purpose": "Debt Consolidation",
            "tenor_months": 12
        },
        "financials": {
            "monthly_salary_income": 280000.0,
            "additional_income": 0.0,
            "monthly_living_expenses": 160000.0,
            "existing_loan_obligations": 140000.0,  # 50% DTI -> Will fail the 40% rule
            "total_debt": 1100000.0
        }
    },
    {
        "application_id": "CR-CONS-03",
        "status": "SUBMITTED",
        "applicant": {
            "full_name": "Ibrahim Danjuma",
            "age": 45,
            "gender": "Male",
            "marital_status": "Married",
            "employment_status": "Self-Employed",
            "employment_duration_months": 60,
            "education_level": "HND",
            "housing_type": "Owns",
            "location": "Wuse, Abuja"
        },
        "loan": {
            "amount": 800000.0,
            "currency": "NGN",
            "purpose": "Medical Expenses",
            "tenor_months": 6
        },
        "financials": {
            "monthly_salary_income": 450000.0,
            "additional_income": 50000.0,
            "monthly_living_expenses": 250000.0,
            "existing_loan_obligations": 80000.0,
            "total_debt": 320000.0
        }
    }
]

def seed():
    db = SessionLocal()
    try:
        for app_data in CONSUMER_DEMO_APPLICATIONS:
            existing = (
                db.query(ApplicationModel)
                .filter(ApplicationModel.application_id == app_data["application_id"])
                .first()
            )
            if not existing:
                record = ApplicationModel(
                    application_id=app_data["application_id"],
                    status=app_data["status"],
                    applicant=app_data["applicant"],
                    loan=app_data["loan"],
                    financials=app_data["financials"]
                )
                db.add(record)
                print(f"Seeded: {app_data['application_id']} ({app_data['applicant']['full_name']})")
            else:
                print(f"Skipped existing: {app_data['application_id']}")

        db.commit()
        print("Consumer demo data seeded successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed()