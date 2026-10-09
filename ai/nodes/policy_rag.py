import os
import logging
from typing import Dict, Any, List
import chromadb
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import MarkdownHeaderTextSplitter

from ai.state import InvestigationGraphState

logger = logging.getLogger(__name__)

# 1. Initialize embedder and persistent/in-memory ChromaDB client
_EMBED_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
_CHROMA_CLIENT = chromadb.Client()
COLLECTION_NAME = "credit_policies"


def setup_policy_knowledge_base():
    """
    Loads, chunks by Markdown headers, embeds, and indexes credit policy rules.
    """
    try:
        return _CHROMA_CLIENT.get_collection(COLLECTION_NAME)
    except Exception:
        pass

    collection = _CHROMA_CLIENT.create_collection(
        name=COLLECTION_NAME,
        metadata={"description": "Kredt CBN Consumer Credit Underwriting Rules"}
    )

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Check possible locations for credit_policy.md
    possible_paths = [
        os.path.join(base_dir, "knowledge_base", "credit_policy.md"),
        os.path.join(base_dir, "data", "credit_policy.md"),
        os.path.join(os.path.dirname(base_dir), "data", "credit_policy.md"),
    ]
    policy_file = next((p for p in possible_paths if os.path.exists(p)), None)

    if not policy_file:
        logger.warning("credit_policy.md not found in expected paths. Vector store is empty.")
        return collection

    with open(policy_file, "r", encoding="utf-8") as f:
        policy_markdown = f.read()

    # Split markdown along H2 headings
    headers_to_split_on = [("##", "policy_section")]
    splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
    chunks = splitter.split_text(policy_markdown)

    documents: List[str] = []
    metadatas: List[Dict[str, Any]] = []
    ids: List[str] = []

    for idx, chunk in enumerate(chunks):
        content = chunk.page_content.strip()
        if not content:
            continue

        meta = dict(chunk.metadata) if chunk.metadata else {}
        meta["chunk_id"] = idx
        meta["policy_section"] = meta.get("policy_section", f"section_{idx}")

        documents.append(content)
        metadatas.append(meta)
        ids.append(f"policy_chunk_{idx}")

    if documents:
        embeddings = _EMBED_MODEL.encode(documents).tolist()
        collection.add(
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )

    return collection


# Initialize policy collection
_POLICY_STORE = setup_policy_knowledge_base()


def retrieve_relevant_policies(query_context: str, k: int = 3) -> List[str]:
    """Retrieves top-k relevant policy clauses from ChromaDB."""
    try:
        query_vector = _EMBED_MODEL.encode([query_context]).tolist()
        results = _POLICY_STORE.query(
            query_embeddings=query_vector,
            n_results=k
        )
        return results.get("documents", [[]])[0]
    except Exception as exc:
        logger.error(f"Error querying ChromaDB: {exc}")
        return []


def run_policy_rag_node(state: InvestigationGraphState) -> Dict[str, Any]:
    """
    Stage 2: Policy RAG & Compliance Audit Node.
    Retrieves policy context and audits financial and applicant metrics
    against official Kredt / CBN Consumer Protection criteria.
    """
    app_data = state.get("application_data", {})
    applicant = app_data.get("applicant", {})
    loan = app_data.get("loan", {})
    fin_metrics = state.get("financial_metrics", {})

    age = int(applicant.get("age", 30))
    tenure_months = int(applicant.get("employment_duration_months", 12))
    employment_status = applicant.get("employment_status", "Employed")
    
    # Retrieve computed metrics directly from the Financial Node (avoiding recalculation mismatches)
    dti = fin_metrics.get("debt_to_income_ratio", 0.0)
    disposable_income = fin_metrics.get("disposable_income", 0.0)
    principal_multiple = fin_metrics.get("principal_to_income_multiple", 0.0)

    # 1. Retrieve relevant policy chunks for downstream reporting context
    retrieval_query = (
        f"Borrower profile: {employment_status} individual, age {age}, "
        f"tenure {tenure_months} months, seeking {loan.get('purpose', 'Personal')} loan. "
        f"Debt-to-Income (DTI) cap, minimum disposable income, and loan principal sizing limits."
    )
    retrieved_policy_chunks = retrieve_relevant_policies(retrieval_query, k=3)

    # 2. Audit against Kredt Consumer Loan Policy (CBN Aligned)
    findings: List[Dict[str, Any]] = []
    passed = 0
    failed = 0
    review = 0

    # Policy 1: Minimum Age Criteria (Section 3.2, CPR 3.1.1)
    if age < 18:
        failed += 1
        findings.append({
            "finding": f"Applicant age ({age}) breaches statutory minimum age requirement of 18.",
            "severity": "HIGH",
            "evidence": [f"Applicant age: {age}"],
            "policy_reference": "POL-ELIG-3.2 (CPR 3.1.1)"
        })
    else:
        passed += 1
        findings.append({
            "finding": f"Applicant age ({age}) satisfies statutory eligibility requirement.",
            "severity": "LOW",
            "evidence": [f"Applicant age: {age} >= 18"],
            "policy_reference": "POL-ELIG-3.2"
        })

    # Policy 2: Income Evidence & Employment Tenure (Section 5.3.1)
    # 3 months for salaried, 6 months for self-employed
    is_salaried = "salar" in employment_status.lower() or "employ" in employment_status.lower()
    min_tenure = 3 if is_salaried else 6

    if tenure_months < min_tenure:
        review += 1
        findings.append({
            "finding": f"Tenure of {tenure_months} months is below recommended {min_tenure} months for {employment_status} status.",
            "severity": "MEDIUM",
            "evidence": [f"Tenure: {tenure_months} mos, Threshold: {min_tenure} mos"],
            "policy_reference": "POL-CRED-5.3.1"
        })
    else:
        passed += 1
        findings.append({
            "finding": f"Employment tenure of {tenure_months} months meets required verification guidelines.",
            "severity": "LOW",
            "evidence": [f"Tenure: {tenure_months} mos >= {min_tenure} mos"],
            "policy_reference": "POL-CRED-5.3.1"
        })

    # Policy 3: Debt-to-Income Cap (Section 5.4.1 - max 40%)
    if dti > 0.40:
        failed += 1
        findings.append({
            "finding": f"Total Debt-to-Income ratio ({dti * 100:.1f}%) exceeds maximum statutory cap of 40.0%.",
            "severity": "HIGH",
            "evidence": [f"DTI: {dti * 100:.1f}%, Cap: 40.0%"],
            "policy_reference": "POL-AFF-5.4.1 (CPR 5.2.2)"
        })
    else:
        passed += 1
        findings.append({
            "finding": f"Debt-to-Income ratio ({dti * 100:.1f}%) is within statutory limit (<= 40.0%).",
            "severity": "LOW",
            "evidence": [f"DTI: {dti * 100:.1f}% <= 40.0%"],
            "policy_reference": "POL-AFF-5.4.1"
        })

    # Policy 4: Disposable Income Floor (Section 5.4.2 - min NGN 30,000)
    if disposable_income < 30000:
        failed += 1
        findings.append({
            "finding": f"Monthly disposable income (₦{disposable_income:,.2f}) falls below required living floor of ₦30,000.",
            "severity": "HIGH",
            "evidence": [f"Residual cashflow: ₦{disposable_income:,.2f}"],
            "policy_reference": "POL-AFF-5.4.2"
        })
    else:
        passed += 1
        findings.append({
            "finding": f"Monthly unencumbered disposable cashflow (₦{disposable_income:,.2f}) meets regulatory floor (>= ₦30,000).",
            "severity": "LOW",
            "evidence": [f"Disposable: ₦{disposable_income:,.2f} >= ₦30,000"],
            "policy_reference": "POL-AFF-5.4.2"
        })

    # Policy 5: Maximum Principal Leverage Sizing (Section 5.5 - max 3x monthly income)
    if principal_multiple > 3.0:
        review += 1
        findings.append({
            "finding": f"Requested loan facility is {principal_multiple:.1f}x monthly income, exceeding the 3x policy benchmark.",
            "severity": "MEDIUM",
            "evidence": [f"Loan multiple: {principal_multiple:.1f}x > 3.0x"],
            "policy_reference": "POL-SIZE-5.5"
        })
    else:
        passed += 1
        findings.append({
            "finding": f"Loan principal is sized within the 3x monthly income limit ({principal_multiple:.1f}x).",
            "severity": "LOW",
            "evidence": [f"Loan multiple: {principal_multiple:.1f}x <= 3.0x"],
            "policy_reference": "POL-SIZE-5.5"
        })

    return {
        "policy_summary": {
            "passed": passed,
            "failed": failed,
            "requires_review": review
        },
        "policy_findings": findings,
        "retrieved_policy_context": retrieved_policy_chunks
    }