import os
import sys

# Ensure backend package can be imported from root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.db import SessionLocal, engine, Base
from app.models.application import ApplicationModel

# Ensure tables exist
Base.metadata.create_all(bind=engine)

DEMO_APPLICATIONS = [
    {
        "application_id": "CR-DEMO-01",
        "status": "SUBMITTED",
        "applicant": {
            "name": "Apex Logistics Ltd.",
            "business_type": "Limited Liability Company",
            "industry": "Logistics & Transport",
            "business_age_months": 48,
            "location": "Lagos, Nigeria"
        },
        "loan": {
            "amount": 15000000.0,
            "currency": "NGN",
            "purpose": "Fleet expansion",
            "tenor_months": 24
        },
        "financials": {
            "monthly_revenue": 12000000.0,
            "monthly_expenses": 8000000.0,
            "monthly_net_income": 4000000.0,
            "existing_monthly_debt_payment": 1500000.0,
            "total_outstanding_debt": 9000000.0
        }
    },
    {
        "application_id": "CR-DEMO-02",
        "status": "SUBMITTED",
        "applicant": {
            "name": "Kano Agro Processing Co.",
            "business_type": "Partnership",
            "industry": "Agriculture & Processing",
            "business_age_months": 36,
            "location": "Kano, Nigeria"
        },
        "loan": {
            "amount": 25000000.0,
            "currency": "NGN",
            "purpose": "Working capital",
            "tenor_months": 12
        },
        "financials": {
            "monthly_revenue": 7000000.0,
            "monthly_expenses": 6200000.0,
            "monthly_net_income": 800000.0,
            "existing_monthly_debt_payment": 2500000.0,
            "total_outstanding_debt": 18000000.0
        }
    },
    {
        "application_id": "CR-DEMO-03",
        "status": "SUBMITTED",
        "applicant": {
            "name": "QuickBite Fast Foods",
            "business_type": "Sole Proprietorship",
            "industry": "Food & Hospitality",
            "business_age_months": 14,
            "location": "Abuja, Nigeria"
        },
        "loan": {
            "amount": 5000000.0,
            "currency": "NGN",
            "purpose": "Equipment purchase",
            "tenor_months": 18
        },
        "financials": {
            "monthly_revenue": 3500000.0,
            "monthly_expenses": 2600000.0,
            "monthly_net_income": 900000.0,
            "existing_monthly_debt_payment": 500000.0,
            "total_outstanding_debt": 2000000.0
        }
    }
]

def seed():
    db = SessionLocal()
    try:
        for app_data in DEMO_APPLICATIONS:
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
                print(f"Seeded: {app_data['application_id']} ({app_data['applicant']['name']})")
            else:
                print(f"Skipped existing: {app_data['application_id']}")

        db.commit()
        print("Demo data seeding completed successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed()