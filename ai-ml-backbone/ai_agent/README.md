# Kredt AI Agent

The **Kredt AI Agent** is the orchestration layer for the credit-risk investigation pipeline. It retrieves application data, coordinates the available analysis components, handles errors, collects evidence, and returns a unified investigation result.

## Responsibilities

* Retrieve applications from the Kredt backend database.
* Coordinate policy, financial, transaction, and credit-risk analysis.
* Map application data to the credit-risk model's required features.
* Collect investigation evidence.
* Handle component-level errors.
* Return `COMPLETED`, `PARTIAL`, or `FAILED` investigation results.

## Structure

```text
ai_agent/
├── agent/
│   ├── credit_risk_agent.py
│   ├── schemas.py
│   └── tools.py
└── test_agent.py
```

* **`credit_risk_agent.py`** — Main investigation orchestration.
* **`tools.py`** — Integration adapters for backend and analysis components.
* **`schemas.py`** — Agent request, error, and evidence contracts.
* **`test_agent.py`** — Agent integration test.

## Integration Status

| Component             | Status            |
| --------------------- | ----------------- |
| Application retrieval | Integrated      |
| Agent orchestration   | Integrated      |
| Financial analysis    | Integrated      |
| Credit-risk model     | Integrated      |
| Evidence collection   | Integrated      |
| Error handling        | Integrated      |
| Policy checking       | Temporary mock |
| Transaction analysis  | Temporary mock |

> Policy checking and transaction analysis will be replaced with the team's final implementations when their interfaces are available.

## Running the Agent

From the project root:

```powershell
cd ai-ml-backbone\ai_agent
.\.venv\Scripts\Activate.ps1
python test_agent.py
```

The current test uses:

```text
CR-CONS-01
```


Demo applications can be seeded with:

```powershell
python scripts\seed_demo_data.py
```

## Successful Integration Test

```text
Application: CR-CONS-01
Status: COMPLETED
Errors: []
Risk Probability: 0.0854
Risk Band: MEDIUM
```

The Agent has been successfully integrated with the backend application database, financial-analysis component, and credit-risk ML model.
