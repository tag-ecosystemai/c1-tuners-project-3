// KREDT — auth (mock)
//
// Borrowers self-register and complete a profile. Analysts are internal
// users whose accounts are provisioned by the organisation (seeded below) —
// they sign in only: no registration, no profile onboarding.
//
// Mock-mode only: accounts and the session live in this browser's
// localStorage (or sessionStorage when "Remember me" is off). NIN/BVN are never stored in full — only the last 4 digits
// are kept for display. When the backend exists, replace each function body
// with the real call (/auth/register, /auth/login, /auth/me) and keep the
// signatures — no page needs to change.

const KredtAuth = (() => {
  const USERS_KEY = 'kredt_users_v1';
  const SESSION_KEY = 'kredt_session_v1';

  const BANKS = ['Access Bank', 'First Bank of Nigeria', 'Guaranty Trust Bank', 'Kuda Bank', 'Opay', 'Palmpay', 'Stanbic IBTC', 'Sterling Bank', 'United Bank for Africa', 'Wema Bank', 'Zenith Bank'];

  const SEED_USERS = [
    { id: 'user-borrower-1', role: 'borrower', first_name: 'David', last_name: 'Chen', full_name: 'David Chen', email: 'david.chen@example.com', password: 'demo1234',
      profile_complete: true, profile: { phone: '08031234567', nin_last4: '4821', bvn_last4: '7730', bank: 'Guaranty Trust Bank', account_last4: '5512', account_name: 'David Chen' } },
    // Provisioned internal account — analysts never register or onboard.
    { id: 'user-analyst-1', role: 'analyst', first_name: 'Grace', last_name: 'Okafor', full_name: 'Grace Okafor', email: 'grace.okafor@kredt.example', password: 'demo1234',
      profile_complete: true, profile: {} },
  ];

  const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms));
  const root = () => window.SITE_ROOT || './';

  function loadUsers() {
    try {
      const saved = JSON.parse(localStorage.getItem(USERS_KEY));
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (e) { /* fall through to seed */ }
    saveUsers(SEED_USERS);
    return SEED_USERS.map((u) => ({ ...u }));
  }
  function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }

  function publicUser(u) {
    if (!u) return null;
    const { password, ...rest } = u;
    const [first = ''] = (u.full_name || '').split(' ');
    return { ...rest, initials: initials(u.full_name), first_name: u.first_name || first, last_name: u.last_name || (u.full_name || '').split(' ').slice(1).join(' ') };
  }
  function initials(name) {
    return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }

  // "Remember me" off => the session lives in sessionStorage and ends with the tab.
  function sessionId() { return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY); }
  function startSession(id, remember = true) {
    localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, id);
  }

  function current() {
    const id = sessionId();
    if (!id) return null;
    return publicUser(loadUsers().find((u) => u.id === id));
  }

  // Only borrowers onboard; analyst accounts are provisioned complete.
  // After every borrower sign-in the profile screen comes next (they're treated
  // like a new user). Flip window.KREDT_PROFILE_ON_LOGIN to false in config.js to
  // limit it to accounts that really haven't completed their profile.
  const PENDING_KEY = 'kredt_profile_pending';
  const profilePending = () => sessionStorage.getItem(PENDING_KEY) === '1';
  const needsProfile = (u) => u.role === 'borrower' && (!u.profile_complete || profilePending());

  // Where a signed-in user belongs right now.
  function homeFor(user) {
    if (!user) return `${root()}login.html`;
    if (needsProfile(user)) return `${root()}complete-profile.html`;
    return user.role === 'analyst' ? `${root()}app/analyst/dashboard.html` : `${root()}app/borrower/applications.html`;
  }

  // Self-registration is for borrowers only.
  async function register({ first_name, last_name, email, password }) {
    await wait();
    const users = loadUsers();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      const err = new Error('An account with this email already exists. Try signing in instead.');
      err.field = 'email';
      throw err;
    }
    const full_name = `${first_name} ${last_name}`.trim();
    const user = { id: `user-borrower-${Date.now().toString(36)}`, role: 'borrower', first_name, last_name, full_name, email, password, profile_complete: false, profile: {} };
    users.push(user);
    saveUsers(users);
    startSession(user.id, true);
    return publicUser(user);
  }

  // expectedRole keeps the two sign-in pages separate: a borrower signing in on
  // the analyst page (or vice versa) is told where to go instead.
  async function login(email, password, { expectedRole = null, remember = true } = {}) {
    await wait();
    const user = loadUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) throw new Error('Incorrect email or password.');
    if (expectedRole && user.role !== expectedRole) {
      throw new Error(user.role === 'analyst'
        ? 'This account is a credit analyst account. Please use the analyst sign-in page.'
        : 'This is a borrower account. Please use the borrower sign-in page.');
    }
    startSession(user.id, remember);
    if (user.role === 'borrower' && window.KREDT_PROFILE_ON_LOGIN !== false) sessionStorage.setItem(PENDING_KEY, '1');
    return publicUser(user);
  }

  // Mock validation: format checks stand in for the real NIN / BVN / bank lookups.
  async function completeProfile({ first_name, last_name, phone, nin, bvn, bank, account_number, account_name }) {
    await wait(900);
    const users = loadUsers();
    const user = users.find((u) => u.id === sessionId());
    if (!user) throw new Error('Your session has expired. Please sign in again.');
    if (first_name) { user.first_name = first_name; }
    if (last_name) { user.last_name = last_name; }
    if (first_name || last_name) user.full_name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    user.profile = { phone, nin_last4: nin.slice(-4), bvn_last4: bvn.slice(-4), bank, account_last4: account_number.slice(-4), account_name };
    user.profile_complete = true;
    sessionStorage.removeItem(PENDING_KEY);
    saveUsers(users);
    return publicUser(user);
  }

  function logout() { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(PENDING_KEY); }

  // Called by include.js on every app page. Redirects when the visitor
  // shouldn't be here; returns the user otherwise.
  function guard(portal) {
    const user = current();
    if (!user) { window.location.replace(`${root()}login.html`); return null; }
    if (needsProfile(user)) { window.location.replace(`${root()}complete-profile.html`); return null; }
    if (portal && user.role !== portal) { window.location.replace(homeFor(user)); return null; }
    return user;
  }

  const validators = {
    phone: (v) => /^(\+234|0)[789][01]\d{8}$/.test(v.replace(/\s/g, '')),
    nin: (v) => /^\d{11}$/.test(v),
    bvn: (v) => /^\d{11}$/.test(v),
    account: (v) => /^\d{10}$/.test(v),
    name: (v) => v.trim().length >= 2,
  };

  return { BANKS, current, homeFor, register, login, completeProfile, logout, guard, validators, profilePending };
})();

window.KredtAuth = KredtAuth; // top-level const is not a window property; include.js and api.js read it from window
