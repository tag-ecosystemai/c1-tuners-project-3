import os
import json
import logging
from typing import Dict, Any, List
from groq import Groq

from ai.state import InvestigationGraphState
from ai.utils.document_parser import get_application_documents_text

logger = logging.getLogger(__name__)


def _audit_documents_with_llm(
    applicant_data: Dict[str, Any], 
    documents_text: Dict[str, str]
) -> Dict[str, Any]:
    """
    Calls Groq to cross-reference declared application form data
    against raw text extracted via Tesseract and pdfplumber from uploaded files.
    """
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        logger.warning("GROQ_API_KEY not configured. Skipping LLM document cross-examination.")
        return {"discrepancies": [], "transaction_findings": []}

    client = Groq(api_key=groq_api_key)

    docs_summary = "\n\n".join(
        [f"--- DOCUMENT: {fname} ---\n{content[:2500]}" for fname, content in documents_text.items()]
    )

    prompt = f"""
You are a senior credit underwriting auditor evaluating loan KYC and documentation.

Declared Application Data:
- Full Name: {applicant_data.get('applicant', {}).get('full_name')}
- Declared Age: {applicant_data.get('applicant', {}).get('age')}
- Declared Monthly Income: {applicant_data.get('financials', {}).get('monthly_salary_income')}
- Employment Status: {applicant_data.get('applicant', {}).get('employment_status')}
- Location: {applicant_data.get('applicant', {}).get('location')}

Uploaded Documents Extracted Content (OCR / Parsed Tables):
{docs_summary}

Perform a verification audit:
1. Does the legal name on identity documents match the declared name? (Flag severe mismatch as Section 4.3 violation)
2. Does the document confirm the applicant is >= 18 years old?
3. Do bank statements or payslips corroborate income credits around the declared salary?
4. Identify any notable transaction patterns on bank statements (e.g., SALARY_DETECTED, HIGH_REPAYMENTS, INSUFFICIENT_FUNDS).

Respond strictly with valid JSON without markdown fences:
{{
  "name_verified": true,
  "age_verified": true,
  "income_verified": true,
  "discrepancies": ["list of concrete discrepancies or violations found"],
  "transaction_findings": [
    {{
      "type": "SALARY_DETECTED",
      "severity": "LOW",
      "amount": 0.0,
      "date": "YYYY-MM-DD",
      "description": "Evidence from statement",
      "transaction_reference": "REF123"
    }}
  ]
}}
"""

    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": "You are a credit underwriting KYC verification engine. Return valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0,
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as exc:
        logger.error(f"Document LLM verification audit failed: {exc}")
        return {"discrepancies": [], "transaction_findings": []}


def run_validation_node(state: InvestigationGraphState) -> Dict[str, Any]:
    """
    Stage 1: Validation Node
    Enforces statutory eligibility boundaries under CBN regulations
    and cross-examines declared data against uploaded documents.
    """
    app_id = state.get("application_id", "")
    app_data = state.get("application_data", {})
    applicant = app_data.get("applicant", {})
    loan = app_data.get("loan", {})
    fin = app_data.get("financials", {})

    errors: List[str] = []
    transaction_findings: List[Dict[str, Any]] = state.get("transaction_findings", [])

    # 1. Applicant Profile Sanity Checks (Section 3.2 & Section 4.1)
    full_name = applicant.get("full_name")
    if not full_name or not str(full_name).strip():
        errors.append("Applicant full name is mandatory (POL-CDD-4.1).")

    age = applicant.get("age", 0)
    if age < 18:
        errors.append(f"Applicant does not meet the minimum statutory age requirement of 18 years. Received: {age} (POL-ELIG-3.2).")
    elif age > 100:
        errors.append(f"Applicant age exceeds maximum operational limit of 100 years. Received: {age}.")

    # 2. Loan Details Sanity Checks (Section 5.5)
    loan_amount = float(loan.get("amount", 0.0))
    if loan_amount <= 0:
        errors.append(f"Requested loan principal must be greater than zero. Received: {loan_amount}.")

    tenor = int(loan.get("tenor_months", 0))
    if tenor < 1 or tenor > 24:
        errors.append(f"Loan tenor must be between 1 and 24 months per policy parameters. Received: {tenor} months (POL-TENOR-5.5).")

    # 3. Financial Baseline Sanity Checks (Section 5.3)
    salary = float(fin.get("monthly_salary_income", 0.0))
    if salary <= 0:
        errors.append(f"Verifiable monthly income must be greater than zero. Received: {salary} (POL-CRED-5.3).")

    # 4. Document Verification & KYC Cross-Examination
    docs_text = get_application_documents_text(app_id) if app_id else {}
    if docs_text:
        audit_result = _audit_documents_with_llm(app_data, docs_text)
        for disc in audit_result.get("discrepancies", []):
            errors.append(f"Document Discrepancy (POL-CDD-4.3): {disc}")

        if audit_result.get("transaction_findings"):
            transaction_findings.extend(audit_result["transaction_findings"])

    status = "PASSED" if not errors else "FAILED"

    return {
        "validation_status": status,
        "validation_errors": errors,
        "transaction_findings": transaction_findings
    }