from ai.graph import investigation_graph

# Sample borrower application payload
test_payload = {
    "applicant": {
        "full_name": "Segun Adebayo",
        "age": 31,
        "employment_status": "Employed",
        "employment_duration_months": 24,
        "education_level": "BSc",
        "marital_status": "Single",
        "housing_type": "Renting",
    },
    "loan": {
        "amount": 1200000,
        "purpose": "Personal",
        "tenor_months": 12,
    },
    "financials": {
        "monthly_salary_income": 450000,
        "additional_income": 50000,
        "monthly_living_expenses": 180000,
        "existing_loan_obligations": 60000,
    },
}

# Initial LangGraph state
initial_state = {
    "investigation_id": "INV-TEST-001",
    "application_id": "CR-301",
    "application_data": test_payload,
}

print("Running LangGraph Pipeline...\n")
result = investigation_graph.invoke(initial_state)

print("=== PIPELINE OUTPUT ===")
print("1. Validation Status :", result.get("validation_status"))
print("2. Policy Summary     :", result.get("policy_summary"))
print("3. Financial Metrics  :", result.get("financial_metrics"))
print("4. ML Risk Score      :", result.get("ml_risk_result"))
print("5. Recommendation     :", result.get("final_report", {}).get("recommendation"))
print("6. Summary Memo       :", result.get("final_report", {}).get("summary"))