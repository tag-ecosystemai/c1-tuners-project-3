from agent.credit_risk_agent import CreditRiskAgent


agent = CreditRiskAgent()

result = agent.investigate("CR-CONS-01")

print(result.model_dump_json(indent=2))