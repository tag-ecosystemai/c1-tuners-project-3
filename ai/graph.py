from langgraph.graph import StateGraph, END
from ai.state import InvestigationGraphState
from ai.nodes.validation import run_validation_node
from ai.nodes.policy_rag import run_policy_rag_node
from ai.nodes.financial import run_financial_node
from ai.nodes.credit_risk import run_credit_risk_node
from ai.nodes.reporting import run_reporting_node


def build_investigation_graph():
    """
    Compiles the 5-stage sequential LangGraph pipeline:
    Validation -> Policy RAG -> Financial Analysis -> Credit Risk -> Report Synthesis
    """
    workflow = StateGraph(InvestigationGraphState)

    # 1. Register Nodes
    workflow.add_node("validate", run_validation_node)
    workflow.add_node("policy_rag", run_policy_rag_node)
    workflow.add_node("financial_analysis", run_financial_node)
    workflow.add_node("credit_risk", run_credit_risk_node)
    workflow.add_node("generate_report", run_reporting_node)

    # 2. Sequential Edges
    workflow.set_entry_point("validate")
    workflow.add_edge("validate", "policy_rag")
    workflow.add_edge("policy_rag", "financial_analysis")
    workflow.add_edge("financial_analysis", "credit_risk")
    workflow.add_edge("credit_risk", "generate_report")
    workflow.add_edge("generate_report", END)

    # 3. Compile Graph
    return workflow.compile()


# Export the compiled instance
investigation_graph = build_investigation_graph()