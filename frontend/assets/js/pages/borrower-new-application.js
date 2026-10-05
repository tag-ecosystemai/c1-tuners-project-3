// Step 1 of 3 — Application: loan type, loan information, and applicant
// information on a single screen (the form changes with the loan type).
// New application: no ?id — the draft is created on Save Draft / Continue.
// Existing draft: ?id=... pre-fills and updates it.
(async function () {
  const params = new URLSearchParams(window.location.search);
  const appId = params.get('id');
  const root = document.getElementById('page-root');
  const STEPS = ['Application', 'Documents', 'Review'];
  const E = KredtUI.escapeHtml;

  function progressHTML(active) {
    return `<div class="form-progress">${STEPS.map((label, i) => `
      ${i > 0 ? '<div class="form-progress-sep"></div>' : ''}
      <div class="form-progress-step ${i === active ? 'is-active' : i < active ? 'is-complete' : ''}">
        <span class="num">${i < active ? '✓' : i + 1}</span><span class="label">${label}</span>
      </div>`).join('')}</div>`;
  }

  let app = null;
  try {
    await KredtStore.init();
    if (appId) {
      app = await KredtApi.applications.get(appId);
      if (app.status !== 'draft') { window.location.replace(`detail.html?id=${appId}`); return; }
    }
  } catch (err) {
    if (!err.expected) console.error(err); else console.warn(err.message);
    root.innerHTML = KredtUI.errorState({ title: 'Application not found', message: "We couldn't load this application." });
    return;
  }

  let selected = app?.loan_type || null;
  // Shared loan fields survive switching loan type before saving.
  const shared = { amount: app?.requested_amount || '', purpose: app?.purpose || '' };
  const details = () => (app && app.loan_type === selected ? app.applicant_details || {} : {});

  const val = (id) => document.getElementById(id)?.value?.trim() || '';
  const numVal = (id) => Number(document.getElementById(id)?.value) || 0;
  const options = (list, current) => list.map((t) => `<option ${current === t ? 'selected' : ''}>${t}</option>`).join('');

  // ---------- Applicant section (depends on loan type) ----------
  function applicantHTML() {
    const d = details();
    const fin = d.financials || {};
    if (selected === 'business') {
      return `
        <div class="form-section-title">Business information</div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label" for="f-business-name">Business name</label>
            <input class="input" id="f-business-name" value="${E(d.business_name || '')}">
            <div class="form-error">Please enter your business name.</div>
          </div>
          <div class="form-field">
            <label class="form-label" for="f-business-type">Business type</label>
            <select class="input" id="f-business-type">${options(['Limited Liability Company', 'Sole Proprietorship', 'Partnership'], d.business_type)}</select>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label" for="f-industry">Industry</label>
            <input class="input" id="f-industry" value="${E(d.industry || '')}">
          </div>
          <div class="form-field">
            <label class="form-label" for="f-age">Business age (months)</label>
            <input type="number" min="0" class="input" id="f-age" value="${d.business_age_months ?? ''}">
          </div>
        </div>
        <div class="form-field">
          <label class="form-label" for="f-location">Business location</label>
          <input class="input" id="f-location" value="${E(d.location || '')}">
        </div>

        <div class="form-section-title">Financial information</div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label" for="f-revenue">Monthly revenue (₦)</label>
            <input type="number" min="0" class="input" id="f-revenue" value="${fin.monthly_revenue ?? ''}">
          </div>
          <div class="form-field">
            <label class="form-label" for="f-expenses">Monthly expenses (₦)</label>
            <input type="number" min="0" class="input" id="f-expenses" value="${fin.monthly_expenses ?? ''}">
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label" for="f-debt-payment">Existing monthly debt payment (₦)</label>
            <input type="number" min="0" class="input" id="f-debt-payment" value="${fin.existing_monthly_debt_payment ?? ''}">
          </div>
          <div class="form-field">
            <label class="form-label" for="f-debt-total">Total outstanding debt (₦)</label>
            <input type="number" min="0" class="input" id="f-debt-total" value="${fin.total_outstanding_debt ?? ''}">
          </div>
        </div>
        <div class="net-income-line">Monthly net income (calculated): <strong id="net-income">—</strong></div>`;
    }
    return `
      <div class="form-section-title">Personal information</div>
      <div class="form-grid-2">
        <div class="form-field">
          <label class="form-label" for="f-full-name">Full name</label>
          <input class="input" id="f-full-name" value="${E(d.full_name || '')}">
          <div class="form-error">Please enter your full name.</div>
        </div>
        <div class="form-field">
          <label class="form-label" for="f-employment">Employment status</label>
          <select class="input" id="f-employment">${options(['Salaried', 'Self-employed', 'Unemployed'], d.employment_status)}</select>
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-field">
          <label class="form-label" for="f-income">Monthly income (₦)</label>
          <input type="number" min="0" class="input" id="f-income" value="${d.monthly_income ?? ''}">
        </div>
        <div class="form-field">
          <label class="form-label" for="f-monthly-expenses">Monthly expenses (₦)</label>
          <input type="number" min="0" class="input" id="f-monthly-expenses" value="${d.monthly_expenses ?? ''}">
        </div>
      </div>`;
  }

  function updateNetIncome() {
    const el = document.getElementById('net-income');
    if (!el) return;
    const hasInput = val('f-revenue') !== '' || val('f-expenses') !== '';
    el.textContent = hasInput ? KredtUI.currency(numVal('f-revenue') - numVal('f-expenses'), 'NGN') : '—';
  }

  // ---------- Page ----------
  function render() {
    root.innerHTML = `
      <div class="page-header">
        <h1>${app ? 'Your Application' : 'New Application'}</h1>
        <p>${app ? `Application #${E(app.reference)}` : 'Tell us what you need. You can save a draft and come back later.'}</p>
      </div>
      ${progressHTML(0)}
      <div class="card card-pad">
        <div class="form-field">
          <label class="form-label">Choose your loan type</label>
          <div class="select-card-group" id="loan-type-group">
            <div class="select-card ${selected === 'business' ? 'is-selected' : ''}" data-value="business">
              <h3>Business Loan</h3><p>For business funding.</p>
            </div>
            <div class="select-card ${selected === 'individual' ? 'is-selected' : ''}" data-value="individual">
              <h3>Individual Loan</h3><p>For personal credit.</p>
            </div>
          </div>
          <div class="form-error" id="err-type">Choose a loan type to continue.</div>
        </div>

        <div id="form-body" ${selected ? '' : 'hidden'}>
          <div class="form-section-title">Loan information</div>
          <div class="form-field">
            <label class="form-label" for="f-amount">Requested amount</label>
            <div class="input-currency-wrap">
              <span class="input-currency-symbol">₦</span>
              <input type="number" min="0" step="1000" class="input" id="f-amount" placeholder="5,000,000" value="${shared.amount}">
            </div>
            <div class="form-error">Enter an amount greater than zero.</div>
          </div>
          <div class="form-field">
            <label class="form-label" for="f-purpose">Purpose</label>
            <textarea class="input" id="f-purpose" placeholder="What will the loan be used for?">${E(shared.purpose)}</textarea>
            <div class="form-error">Tell us what the loan will be used for.</div>
          </div>
          <div id="applicant-region">${selected ? applicantHTML() : ''}</div>
        </div>

        <div class="form-actions">
          <a href="../applications.html" class="btn btn-secondary">Cancel</a>
          <div class="form-actions-group">
            <button type="button" class="btn btn-secondary" id="btn-save-draft" ${selected ? '' : 'disabled'}>Save Draft</button>
            <button type="button" class="btn btn-primary" id="btn-continue" ${selected ? '' : 'disabled'}>Continue</button>
          </div>
        </div>
      </div>`;
    wire();
  }

  function wire() {
    root.querySelectorAll('.select-card').forEach((card) => card.addEventListener('click', () => {
      shared.amount = val('f-amount') || shared.amount;
      shared.purpose = document.getElementById('f-purpose')?.value || shared.purpose;
      selected = card.dataset.value;
      render();
    }));
    ['f-revenue', 'f-expenses'].forEach((id) => document.getElementById(id)?.addEventListener('input', updateNetIncome));
    updateNetIncome();
    document.getElementById('btn-save-draft').addEventListener('click', (e) => save(e.currentTarget, 'draft'));
    document.getElementById('btn-continue').addEventListener('click', (e) => save(e.currentTarget, 'continue'));
  }

  function collectPayload() {
    const base = { loan_type: selected, requested_amount: numVal('f-amount'), currency: 'NGN', purpose: val('f-purpose') };
    if (selected === 'business') {
      const revenue = numVal('f-revenue'), expenses = numVal('f-expenses');
      base.applicant_details = {
        business_name: val('f-business-name'),
        business_type: val('f-business-type'),
        industry: val('f-industry'),
        business_age_months: numVal('f-age'),
        location: val('f-location'),
        financials: {
          monthly_revenue: revenue,
          monthly_expenses: expenses,
          monthly_net_income: revenue - expenses,
          existing_monthly_debt_payment: numVal('f-debt-payment'),
          total_outstanding_debt: numVal('f-debt-total'),
        },
      };
    } else {
      base.applicant_details = {
        full_name: val('f-full-name'),
        employment_status: val('f-employment'),
        monthly_income: numVal('f-income'),
        monthly_expenses: numVal('f-monthly-expenses'),
      };
    }
    return base;
  }

  // Continue needs a complete Step 1; Save Draft only needs a loan type.
  function validate() {
    const nameId = selected === 'business' ? 'f-business-name' : 'f-full-name';
    const checks = [
      [document.getElementById('f-amount').closest('.form-field'), numVal('f-amount') > 0],
      [document.getElementById('f-purpose').closest('.form-field'), !!val('f-purpose')],
      [document.getElementById(nameId).closest('.form-field'), !!val(nameId)],
    ];
    checks.forEach(([el, ok]) => el.classList.toggle('has-error', !ok));
    return checks.every(([, ok]) => ok);
  }

  async function save(btn, mode) {
    document.getElementById('err-type').closest('.form-field').classList.toggle('has-error', !selected);
    if (!selected) return;
    if (mode === 'continue' && !validate()) return;

    const label = btn.innerHTML;
    document.querySelectorAll('#btn-save-draft, #btn-continue').forEach((b) => { b.disabled = true; });
    btn.innerHTML = '<span class="btn-spinner"></span> Saving...';
    try {
      const payload = collectPayload();
      let id = appId;
      if (app) await KredtApi.applications.update(app.id, payload);
      else id = (await KredtApi.applications.create(payload)).id;
      window.location.href = mode === 'draft'
        ? '../applications.html?saved=draft'
        : `detail.html?id=${id}&step=documents`;
    } catch (err) {
      console.error(err);
      KredtUI.toast("Couldn't save your application. Please try again.", 'error');
      document.querySelectorAll('#btn-save-draft, #btn-continue').forEach((b) => { b.disabled = false; });
      btn.innerHTML = label;
    }
  }

  render();
})();
