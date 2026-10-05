# Kredt — Frontend

An AI-assisted credit investigation platform: a borrower portal for loan applications,
and an analyst portal for AI-assisted investigation and decisioning. Plain HTML/CSS/JS —
no build step, no framework.

> **The AI investigates. The analyst decides.**

## Investigation workspace (v9)

`investigate.html?id=...` is one workspace with six stage screens: Validation, Policy Retrieval,
Financial Analysis, Transaction Analysis, Risk Prediction, Report Generation. A persistent stage rail
on the left shows each stage's state. The pipeline runs automatically (the analyst observes it):

- a **completed** stage can be opened and inspected at any time (`?stage=financial_analysis` deep-links);
- a stage that hasn't finished is **locked**;
- until the analyst picks a stage, the page **follows the live one**; picking a stage pins it, and a
  "Jump to live stage" button returns to following;
- when all six finish, an "Investigation complete" banner leads to the Report.

`KredtApi.investigations.getStage(jobId, stage)` returns one stage's output (mock: derived from the same
report the Report screen shows, so numbers always agree). Fields the data doesn't contain — e.g. policy
clauses *retrieved* vs *applicable*, or transaction count/period — are deliberately not shown until the
backend provides them.

## Sign-up and sign-in behaviour

- After **Register**, an "Account created successfully" screen confirms the user is signed in, then continues to Complete Profile.
- After every **borrower** sign-in, Complete Profile comes next (treated like a new user). Set
  `window.KREDT_PROFILE_ON_LOGIN = false` in `config.js` to limit this to accounts with an incomplete profile.

## Design notes (v8)

- Same palette (navy `#142D4E`, teal `#0F9D8A`, off-white); tokens live in `assets/css/base.css`.
- Analyst shell: light sidebar with SVG icons, grouped sections and a user card. Borrower shell: top navigation.
- Icons are an inline SVG set in `ui.js` (`KredtUI.icon(name)` or `<i data-icon="name">` in partials).
- Analyst dashboard charts are dependency-free SVG (`assets/js/charts.js`): donut (status), bars
  (monthly intake), histogram (requested amounts). No CDN or build step.

## Quick start

This app must be served over `http://localhost:3000` — opening `index.html` directly
(double-clicking it) will not work, since browsers block the app's internal data loading
and page navigation for files opened via `file://`.

**Mac / Linux**
```bash
./start-server.sh
```

**Windows**
```
start-server.bat
```

Then open **http://localhost:3000** in your browser.

The script uses whichever of these you already have installed — no extra install needed
if you have one of them:
- Python (any of `py`, `python`, or `python3` — tried in that order, and preferred first
  since it needs no internet connection to run)
- Node.js (`npx serve` — this is the fallback since it needs an internet connection the
  first time it runs, to download the `serve` package)

Either way, your browser should open to `http://localhost:3000` automatically a second
after the server starts. If it doesn't, just open that address yourself.

If you have neither Python nor Node.js installed, the script will tell you so clearly and
link to where to get one of them — it won't just silently fail.

## What's included

- **Landing page** (`index.html`)
- **Borrower portal** (`app/borrower/`) — my applications, a three-step application
  (Application → Documents → Review, business or individual), submission straight into
  tracking, and a simple top-navigation shell (bottom nav on phones).
- **Analyst portal** (`app/analyst/`) — dashboard, filterable application queue,
  application details, document viewer, live six-stage investigation progress,
  evidence-backed investigation report, assessment/decision, and audit log.
- **Demo Mode** — a fictional application, ABC Manufacturing Ltd., ships pre-seeded with
  a completed investigation and report (`CI-DEMO-001` in the analyst queue), labeled
  **FICTIONAL DEMO DATA** throughout.

## Sign-in and roles

Accounts are mocked in the browser (`assets/js/auth.js`). Two demo accounts ship ready to use,
both with password `demo1234`:

- Borrower: `david.chen@example.com`
- Analyst: `grace.okafor@kredt.example`

**Borrowers** register themselves (first/last name, email, password) and then go through
**Complete Profile** (name, phone, NIN, BVN, bank, account number, account name) before
reaching their portal. **Analysts do not register or onboard** — their accounts are
provisioned by the organisation (seeded in `auth.js` for now) and they sign in at
`analyst-login.html`. Each sign-in page rejects the other role's account.
Validation is format-only in mock mode, and only the last 4 digits of NIN, BVN and account
number are kept. Every `app/` page checks the session and role and sends visitors to the
right place.

## Screen flow

- **Borrower** (top nav: My Applications, Profile): Landing → Register → Complete Profile →
  My Applications → Step 1 *Application* (loan type, loan info, applicant info; Save Draft /
  Continue) → Step 2 *Documents* → Step 3 *Review & Submit* → Tracking. There is no separate
  "submitted" screen. Drafts reopen at Step 1; submitted applications open on Tracking.
- **Analyst** (sidebar: Dashboard, Applications, Profile, Log out): Analyst Login → Dashboard →
  Queue → Application → Documents / Start Investigation (confirmed inline) → Investigation workspace
  (six stage screens, see below) → Report → Assessment → Audit Log.
  Investigation, Report and Assessment unlock in order as the application's status advances.
  Drafts never appear in the analyst queue.

## Running against mock data (default)

Out of the box, the app runs entirely on local mock data — no backend required. Every
action (starting a draft, uploading a document, submitting an application, starting an
investigation, recording an assessment) is saved to your browser's `localStorage`, so
your changes persist across reloads. To reset everything back to the original seed data,
open the browser console and run:

```js
KredtStore.reset()
```

## Connecting the real backend

1. Open `assets/js/config.js` and set:
   ```js
   window.KREDT_USE_MOCK = false;
   window.KREDT_API_BASE = 'http://localhost:8000/api/v1'; // or wherever the backend runs
   ```
2. Make sure the FastAPI backend's CORS config allows `http://localhost:3000` (the
   origin this app is served from) in `allow_origins`.
3. In `assets/js/api.js`, each function already has the mock implementation in place —
   fill in the commented-out `fetch()` call beneath each one to point at the real
   endpoint. No page or UI code needs to change; every page calls through `KredtApi.*`
   only, never `fetch()` directly.
4. See `docs/api-contract-additions.md` for the handful of fields the UI needs that
   aren't yet defined in the base API contract (`docs/api-contract.md` in the main
   project handbook) — these need to exist on the backend responses for the real data to
   render correctly.

## Project structure

```
kredt/
├── index.html                   # Landing page
├── login.html / register.html / complete-profile.html   # borrower
├── analyst-login.html                                    # analyst (no register)
├── app/
│   ├── borrower/
│   │   ├── applications.html    # My Applications
│   │   ├── profile.html
│   │   └── applications/
│   │       ├── new.html         # Step 1: application (?id= to edit a draft)
│   │       └── detail.html      # Steps 2-3 (draft, ?step=documents|review) / Tracking (submitted+)
│   └── analyst/
│       ├── profile.html
│       ├── dashboard.html
│       ├── queue.html           # Full filterable application table
│       └── applications/
│           ├── detail.html
│           ├── documents.html
│           ├── investigate.html # Live six-stage progress
│           ├── report.html      # Evidence-backed investigation report
│           ├── assessment.html  # Decision: approve / decline / request info / continue
│           └── audit.html
├── components/                  # Analyst sidebar + topbar, borrower top nav, injected via include.js
├── assets/
│   ├── css/                     # base.css (tokens), components.css, app-shell.css, pages/
│   └── js/
│       ├── config.js            # Backend URL + mock toggle
│       ├── auth.js              # Mock sign-in, session, role guard
│       ├── store.js             # localStorage-backed mock database
│       ├── api.js               # One function per contract endpoint
│       ├── ui.js                # Formatting, badges, toasts, modals, state blocks
│       ├── include.js           # Shell/component loader
│       ├── analyst-shell.js     # Application-level tab nav for analyst pages
│       └── pages/                # One file per page
├── data/mock/                   # Seed JSON: applications, documents, investigations, etc.
├── docs/
│   └── api-contract-additions.md
├── start-server.sh / .bat
└── README.md
```

## Design

Deep navy (`#142D4E`), white, and neutral gray, with a teal accent (`#0F9D8A`) for
interactive elements, and green/amber/red reserved for status and risk indicators only.
Typeface is Inter throughout. See `assets/css/base.css` for the full token set.
