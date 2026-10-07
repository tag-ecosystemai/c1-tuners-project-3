import uuid

from .tools import (
    get_application,
    check_policy,
    analyze_financials,
    analyze_transactions,
    predict_credit_risk,
)

from .schemas import EvidencePackage, InvestigationError


class CreditRiskAgent:
    def _collect_evidence(self, component: str, result) -> list:
        """
        Extract evidence returned by a component.
        The agent does not generate evidence; it only collects it.
        """

        if isinstance(result, dict):
            evidence = result.get("evidence", [])

            if evidence:
                return [
                    {
                        "component": component,
                        "data": item
                    }
                    for item in evidence
                ]

        elif isinstance(result, list):
            collected = []

            for item in result:
                if isinstance(item, dict) and "evidence" in item:
                    collected.append(
                        {
                            "component": component,
                            "data": item["evidence"]
                        }
                    )

            return collected

        return []

    def investigate(self, application_id: str) -> EvidencePackage:
        """
        Investigate a credit application by coordinating
        the available credit-risk analysis tools.
        """

        investigation_id = f"INV-{uuid.uuid4().hex[:8].upper()}"

        policy_findings = []
        financial_analysis = {}
        transaction_findings = []
        credit_risk = {}
        errors = []
        evidence = []

        # 1. Retrieve application information
        try:
            application = get_application(application_id)
        except Exception as e:
            errors.append(
                InvestigationError(
                    component="application_data",
                    error=str(e)
                )
            )

            return EvidencePackage(
                application_id=application_id,
                investigation_id=investigation_id,
                status="FAILED",
                policy_findings=[],
                financial_analysis={},
                transaction_findings=[],
                credit_risk={},
                evidence=[],
                errors=errors,
            )

        # 2. Check lending policies
        try:
            policy_findings = check_policy(
                application_id,
                application
            )

            evidence.extend(
                self._collect_evidence(
                    "policy_check",
                    policy_findings
                )
            )

        except Exception as e:
            errors.append(
                InvestigationError(
                    component="policy_check",
                    error=str(e)
                )
            )

        # 3. Analyze financial information
        try:
            financial_analysis = analyze_financials(
                application_id,
                application["financials"],
                application["loan"]
            )

        except Exception as e:
            errors.append(
                InvestigationError(
                    component="financial_analysis",
                    error=str(e)
                )
            )

        # 4. Analyze transactions
        try:
            transaction_findings = analyze_transactions(
                application_id,
                application
            )

        except Exception as e:
            errors.append(
                InvestigationError(
                    component="transaction_analysis",
                    error=str(e)
                )
            )

        # 5. Get credit-risk prediction
        try:
            credit_risk = predict_credit_risk(
                application_id,
                application
            )

        except Exception as e:
            errors.append(
                InvestigationError(
                    component="credit_risk_model",
                    error=str(e)
                )
            )

        # 6. Determine investigation status
        if len(errors) == 0:
            status = "COMPLETED"
        elif len(errors) < 5:
            status = "PARTIAL"
        else:
            status = "FAILED"

        # 7. Combine all results
        return EvidencePackage(
            application_id=application_id,
            investigation_id=investigation_id,
            status=status,
            policy_findings=policy_findings,
            financial_analysis=financial_analysis,
            transaction_findings=transaction_findings,
            credit_risk=credit_risk,
            evidence=evidence,
            errors=errors,
        )