# API Contract Additions

The frontend is built against the Handbook's `docs/api-contract.md` (v1). A few UI
requirements need fields the base contract doesn't define yet. This file lists every
addition the frontend currently relies on (as mock data), so the backend can add them —
or the frontend can be adjusted if the team decides differently.

Ideally, PJ folds these into `docs/api-contract.md` directly and this file goes away.

## 1. `Application` — queue display fields

The queue table needs the applicant's display name and a risk indicator without a second
API call per row. The frontend currently reads these off `applicant_details` (already in
the base contract) plus a risk value it gets from the latest completed report.

**Suggestion:** either have `GET /applications` embed a `latest_risk_band` field per
application, or accept the extra client-side lookup (current approach — one report fetch
per application shown, cached).

## 2. `PolicyFinding.result`

The base contract's `policy_findings` shape has `clause_ref`, `clause_text_excerpt`,
`relevance`, `applies_to` — but no explicit pass/fail outcome. The UI needs a clear
PASS / FAIL / REQUIRES_REVIEW badge per policy check (this matches the `result` field
already present in the AI Pipeline Data Contracts doc's policy-check output).

**Addition used by the frontend:**
```json
{
  "clause_ref": "string",
  "clause_text_excerpt": "string",
  "relevance": "string",
  "applies_to": "string",
  "result": "PASS | FAIL | REQUIRES_REVIEW"
}
```

## 3. `RiskPrediction.prediction_horizon`

The base contract's `risk_prediction` object doesn't include the prediction horizon,
but the UI spec explicitly calls for it ("model prediction, risk indicators, model
version, and prediction horizon").

**Addition used by the frontend:**
```json
{
  "score": 0.0,
  "band": "low|medium|high",
  "model_version": "string",
  "prediction_horizon": "12_months",
  "inputs_used": ["field"]
}
```

## 4. Assessment / decision payload

`POST /applications/{id}/assessment` exists in the base contract but its request body
isn't specified. The frontend sends:

```json
{
  "decision": "approve | decline | request_info | continue_review",
  "notes": "string"
}
```

`request_info` and `continue_review` are additions beyond a simple approve/decline —
they come from the UI spec's four decision actions (Request More Information, Continue
Review, Approve, Decline).

## 5. Auth endpoints (mocked in the browser today)

The sign-in screens exist and run against `assets/js/auth.js` (mock accounts in
`localStorage`). The frontend expects, once wired to the backend:

- `POST /auth/register` — **borrowers only** (`first_name`, `last_name`, `email`, `password`).
  There is no analyst registration: analyst accounts are provisioned by the organisation.
- `POST /auth/login` — both roles. The response must include `role` (`borrower` | `analyst`);
  the two sign-in pages reject a mismatched role with a pointer to the right page.
- `GET /auth/me` — current user, including `profile_complete` (borrowers only; analysts are
  always complete).
- Borrower profile completion: `first_name`, `last_name`, `phone`, `nin`, `bvn`, `bank`,
  `account_number`, `account_name`. The UI only ever keeps the last 4 digits of NIN, BVN and
  account number.

## 5b. Borrower tracking

- `POST /applications/{id}/submit` moves the borrower **directly to Tracking** — there is no
  confirmation screen.
- Borrower-safe decision view: when `status = decided` the Tracking screen needs only the
  outcome (`approved` | `declined`) and `decided_at`. It must **not** receive the analyst's
  notes, report, risk or policy detail. (Mocked as `KredtApi.applications.getDecision`.)
- `additional_info_requested`: the Tracking screen shows an "Action Required" state. The
  mechanism for what the analyst asks for and how the borrower responds is **not defined yet**.
  The UI will render `info_request.items[]` (strings) and `info_request.deadline` if the
  application response includes them, but there is no upload/respond action until the backend
  contract exists.
- Uploads: PDF, JPG, PNG are enforced in the UI. A size limit and a required-document list are
  deliberately **not** hard-coded; set `window.KREDT_MAX_UPLOAD_MB` in `config.js` once the
  backend confirms the limit.

## 6. Document upload response

`POST /applications/{id}/documents` — the frontend expects the created document record
back in the response body (id, document_type, file_name, file_size, uploaded_at,
status), matching the shape in `documents.json`. The base contract doesn't specify a
response body for this endpoint.
