
import os
import json
from typing import Dict, Any
from dotenv import load_dotenv
from groq import Groq

from ai.state import InvestigationGraphState

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")


def run_reporting_node(state: InvestigationGraphState) -> Dict[str, Any]:
    """
    Stage 5: Underwriting Report Synthesis Node
    Invokes Groq LLM with clear audit tags indicating generation source.
    """
    app_data = state.get("application_data", {})
    applicant = app_data.get("applicant", {})
    loan = app_data.get("loan", {})
    fin_metrics = state.get("financial_metrics", {})
    policy_summary = state.get("policy_summary", {})
    policy_findings = state.get("policy_findings", [])
    ml_risk = state.get("ml_risk_result", {})

    full_name = applicant.get("full_name", "Applicant")
    amount = float(loan.get("amount", 0.0))
    purpose = loan.get("purpose", "Personal")
    pd_score = ml_risk.get("probability_of_default", 0.0)
    risk_band = ml_risk.get("risk_band", "MEDIUM")
    dti = fin_metrics.get("debt_to_income_ratio", 0.0) * 100
    disposable = fin_metrics.get("disposable_income", 0.0)
    income = fin_metrics.get("total_monthly_income", 0.0)

    # 1. Check API Key presence
    if not GROQ_API_KEY:
        print("\n[AI LLM WARNING] GROQ_API_KEY is not set in environment. Falling back to deterministic logic.")
        return _build_fallback_report(
            full_name, amount, purpose, pd_score, risk_band, dti, disposable, policy_summary,
            reason="GROQ_API_KEY environment variable missing"
        )

    # 2. Invoke Groq LLM
    try:
        print("\n[AI LLM] Calling Groq API (openai/gpt-oss-20b)...")
        client = Groq(api_key=GROQ_API_KEY)

        system_prompt = (
            "You are an expert senior credit risk officer and underwriter at a digital lending institution. "
            "Analyze the provided borrower investigation data, policy compliance checks, and machine learning risk score. "
            "Synthesize an underwriting memo and output your response strictly as valid JSON matching this schema:\n"
            "{\n"
            '  "recommendation": "RECOMMEND APPROVAL" | "RECOMMEND DECLINE" | "MANUAL REVIEW REQUIRED",\n'
            '  "summary": "<1-2 sentence crisp executive summary explaining the decision>",\n'
            '  "key_findings": ["<bullet 1>", "<bullet 2>", "<bullet 3>", "<bullet 4>"]\n'
            "}\n"
            "Do not include code fences, markdown blocks, or text outside the JSON."
        )

        user_context = f"""
Applicant Name: {full_name}
Age: {applicant.get('age')}
Employment: {applicant.get('employment_status')} ({applicant.get('employment_duration_months', 0)} months tenure)
Loan Facility: ₦{amount:,.2f} ({purpose})
Total Monthly Income: ₦{income:,.2f}
Monthly Disposable Income: ₦{disposable:,.2f}
Debt-to-Income (DTI): {dti:.1f}%

Policy Audit:
- Rules Passed: {policy_summary.get('passed', 0)}
- Rules Flagged for Review: {policy_summary.get('requires_review', 0)}
- Hard Violations: {policy_summary.get('failed', 0)}
- Detail: {json.dumps(policy_findings)}

Machine Learning Default Model:
- Probability of Default: {pd_score * 100:.2f}%
- Risk Classification: {risk_band}
"""

        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_context},
            ],
            model="openai/gpt-oss-20b",
            temperature=0.2,
            response_format={"type": "json_object"},
        )

        raw_response = chat_completion.choices[0].message.content
        parsed = json.loads(raw_response)

        print("[AI LLM SUCCESS] Report generated successfully by Groq LLM.")

        return {
            "final_report": {
                "recommendation": parsed.get("recommendation", "MANUAL REVIEW REQUIRED"),
                "summary": parsed.get("summary", ""),
                "key_findings": parsed.get("key_findings", []),
                "generated_by": "openai/gpt-oss-20b",
                "is_llm_generated": True,
            }
        }

    except Exception as exc:
        print(f"\n[AI LLM ERROR] Groq API call failed: {exc}")
        print("[AI LLM FALLBACK] Reverting to deterministic rule engine.")
        return _build_fallback_report(
            full_name, amount, purpose, pd_score, risk_band, dti, disposable, policy_summary,
            reason=f"Groq API Error: {str(exc)}"
        )


def _build_fallback_report(
    full_name: str,
    amount: float,
    purpose: str,
    pd_score: float,
    risk_band: str,
    dti: float,
    disposable: float,
    policy_summary: dict,
    reason: str
) -> Dict[str, Any]:
    """Helper creating labeled fallback payload."""
    if risk_band == "LOW" and policy_summary.get("failed", 0) == 0:
        recommendation = "RECOMMEND APPROVAL"
        summary = (
            f"{full_name} demonstrates a stable consumer credit profile for the requested ₦{amount:,.2f} "
            f"{purpose} facility. Verifiable income and manageable leverage provide adequate debt service capacity."
        )
    elif risk_band == "HIGH" or policy_summary.get("failed", 0) > 0:
        recommendation = "RECOMMEND DECLINE"
        summary = (
            f"High credit risk detected for {full_name}. Application exhibits elevated default probability "
            f"or specific policy guideline breaches that compromise repayment feasibility."
        )
    else:
        recommendation = "MANUAL REVIEW REQUIRED"
        summary = (
            f"Moderate risk metrics identified for {full_name}. While primary income is present, policy exceptions "
            f"warrant senior credit analyst discretion before underwriting commitment."
        )

    key_findings = [
        f"Applicant maintains a Debt-to-Income (DTI) ratio of {dti:.1f}%.",
        f"Monthly unencumbered disposable cashflow evaluated at ₦{disposable:,.2f}.",
        f"ML Credit Risk model estimated Default Probability of {pd_score * 100:.2f}% (Risk Band: {risk_band}).",
        f"RAG Policy audit: {policy_summary.get('passed', 0)} rules passed, "
        f"{policy_summary.get('requires_review', 0)} flagged for review, "
        f"{policy_summary.get('failed', 0)} hard failures.",
    ]

    return {
        "final_report": {
            "recommendation": recommendation,
            "summary": summary,
            "key_findings": key_findings,
            "generated_by": "deterministic_fallback",
            "is_llm_generated": False,
            "generation_note": reason,
        }
    }