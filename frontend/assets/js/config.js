// KREDT — configuration
//
// Points at the FastAPI backend once it exists. Until then, KREDT_USE_MOCK
// keeps the whole app running on local mock data (data/mock/*.json plus a
// browser-local store), so the product is fully clickable before the
// backend is ready.
//
// To connect the real backend:
//   1. Set KREDT_USE_MOCK = false below (or from the console for testing).
//   2. Make sure the backend is running and its CORS allow_origins includes
//      the address this app is served from (this project defaults to
//      http://localhost:3000 — see README.md).
//   3. Every function in api.js will then call KREDT_API_BASE instead of
//      reading from data/mock/*.json / localStorage.
//
// No login/register screens are wired up yet (deferred per product
// decision) — see api.js for where auth calls will slot in later.

window.KREDT_API_BASE = window.KREDT_API_BASE || 'http://localhost:8000/api/v1';
window.KREDT_USE_MOCK = window.KREDT_USE_MOCK !== undefined ? window.KREDT_USE_MOCK : true;

// Simulated network latency for mock calls, so loading states are visible
// and feel like a real app rather than snapping instantly.
window.KREDT_MOCK_DELAY_MS = 450;

// Document upload rules. The backend contract hasn't confirmed a size limit or
// a required-document list yet, so neither is hard-coded: leave null/[] until
// it does. File type (PDF, JPG, PNG) is enforced regardless.
window.KREDT_MAX_UPLOAD_MB = window.KREDT_MAX_UPLOAD_MB !== undefined ? window.KREDT_MAX_UPLOAD_MB : null;

// After a borrower signs in, show the Complete Profile screen before the dashboard
// (they're treated like a new user). Set to false to only do this for accounts whose
// profile is genuinely incomplete.
window.KREDT_PROFILE_ON_LOGIN = window.KREDT_PROFILE_ON_LOGIN !== undefined ? window.KREDT_PROFILE_ON_LOGIN : true;
