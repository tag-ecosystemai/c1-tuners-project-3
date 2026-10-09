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
  const shared = {
    amount: app?.loan?.amount ?? app?.requested_amount ?? '',
    tenor: app?.loan?.tenor_months ?? app?.tenor_months ?? 12,
    purpose: app?.loan?.purpose ?? app?.purpose ?? ''
  };

  const details = () => {
    if (!app || app.loan_type !== selected) return {};
    return app.applicant || app.applicant_details || {};
  };

  const getFinancials = () => {
    if (!app || app.loan_type !== selected) return {};
    return app.financials || app.applicant_details?.financials || {};
  };

  const val = (id) => document.getElementById(id)?.value?.trim() || '';
  const numVal = (id) => {
    const raw = document.getElementById(id)?.value;
    return raw === '' || isNaN(Number(raw)) ? 0 : Number(raw);
  };
  const options = (list, current) => list.map((t) => `<option value="${t}" ${current === t ? 'selected' : ''}>${t}</option>`).join('');

  // ---------- Applicant & Financial section (depends on loan type) ----------
  function applicantHTML() {
    const d = details();
    const fin = getFinancials();

    if (selected === 'business') {
      return `
        <div class="form-section-title">Business information</div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label" for="f-business-name">Business name *</label>
            <input class="input" id="f-business-name" value="${E(d.business_name || d.full_name || '')}">
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
          <input class="input" id="f-location" placeholder="e.g. Lagos" value="${E(d.location || '')}">
        </div>

        <div class="form-section-title">Financial information</div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label" for="f-revenue">Monthly revenue (₦) *</label>
            <input type="number" min="0" class="input" id="f-revenue" value="${fin.monthly_revenue ?? fin.monthly_salary_income ?? ''}">
          </div>
          <div class="form-field">
            <label class="form-label" for="f-additional-income">Additional monthly income (₦)</label>
            <input type="number" min="0" class="input" id="f-additional-income" value="${fin.additional_income ?? ''}">
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label" for="f-expenses">Monthly operating expenses (₦)</label>
            <input type="number" min="0" class="input" id="f-expenses" value="${fin.monthly_expenses ?? fin.monthly_living_expenses ?? ''}">
          </div>
          <div class="form-field">
            <label class="form-label" for="f-debt-payment">Existing monthly debt payments (₦)</label>
            <input type="number" min="0" class="input" id="f-debt-payment" value="${fin.existing_monthly_debt_payment ?? fin.existing_loan_obligations ?? ''}">
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label" for="f-debt-total">Total outstanding debt (₦)</label>
            <input type="number" min="0" class="input" id="f-debt-total" value="${fin.total_outstanding_debt ?? fin.total_debt ?? ''}">
          </div>
        </div>
        <div class="net-income-line">Monthly net income (calculated): <strong id="net-income">—</strong></div>`;
    }

    // Individual Borrower Form (matches target API contract)
    return `
      <div class="form-section-title">Personal information</div>
      <div class="form-grid-2">
        <div class="form-field">
          <label class="form-label" for="f-full-name">Full name *</label>
          <input class="input" id="f-full-name" value="${E(d.full_name || '')}">
          <div class="form-error">Please enter your full name.</div>
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label" for="f-borrower-age">Age *</label>
            <input type="number" min="18" max="100" class="input" id="f-borrower-age" value="${d.age ?? ''}" placeholder="30">
            <div class="form-error">Enter a valid age (18+).</div>
          </div>
          <div class="form-field">
            <label class="form-label" for="f-gender">Gender</label>
            <select class="input" id="f-gender">${options(['Male', 'Female', 'Other', 'Prefer not to say'], d.gender)}</select>
          </div>
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-field">
          <label class="form-label" for="f-marital-status">Marital status</label>
          <select class="input" id="f-marital-status">${options(['Single', 'Married', 'Divorced', 'Widowed'], d.marital_status)}</select>
        </div>
        <div class="form-field">
          <label class="form-label" for="f-education-level">Education level</label>
          <select class="input" id="f-education-level">${options(['Secondary', 'BSc', 'MSc', 'Doctorate', 'Vocational'], d.education_level)}</select>
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-field">
          <label class="form-label" for="f-housing-type">Housing type</label>
          <select class="input" id="f-housing-type">${options(['Renting', 'Own Home', 'Living with Family', 'Mortgage'], d.housing_type)}</select>
        </div>
        <div class="form-field">
          <label class="form-label" for="f-location">Location (City / State)</label>
          <input class="input" id="f-location" placeholder="e.g. Lagos" value="${E(d.location || '')}">
        </div>
      </div>

      <div class="form-section-title">Employment & Financials</div>
      <div class="form-grid-2">
        <div class="form-field">
          <label class="form-label" for="f-employment">Employment status</label>
          <select class="input" id="f-employment">${options(['Employed', 'Self-employed', 'Unemployed'], d.employment_status)}</select>
        </div>
        <div class="form-field">
          <label class="form-label" for="f-employment-duration">Employment tenure (months)</label>
          <input type="number" min="0" class="input" id="f-employment-duration" value="${d.employment_duration_months ?? ''}" placeholder="24">
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-field">
          <label class="form-label" for="f-income">Monthly salary income (₦) *</label>
          <input type="number" min="0" class="input" id="f-income" value="${fin.monthly_salary_income ?? d.monthly_income ?? ''}">
          <div class="form-error">Please provide your monthly salary income.</div>
        </div>
        <div class="form-field">
          <label class="form-label" for="f-additional-income">Additional monthly income (₦)</label>
          <input type="number" min="0" class="input" id="f-additional-income" value="${fin.additional_income ?? ''}">
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-field">
          <label class="form-label" for="f-monthly-expenses">Monthly living expenses (₦)</label>
          <input type="number" min="0" class="input" id="f-monthly-expenses" value="${fin.monthly_living_expenses ?? d.monthly_expenses ?? ''}">
        </div>
        <div class="form-field">
          <label class="form-label" for="f-debt-payment">Existing monthly loan obligations (₦)</label>
          <input type="number" min="0" class="input" id="f-debt-payment" value="${fin.existing_loan_obligations ?? fin.existing_monthly_debt_payment ?? ''}">
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-field">
          <label class="form-label" for="f-debt-total">Total outstanding debt (₦)</label>
          <input type="number" min="0" class="input" id="f-debt-total" value="${fin.total_debt ?? fin.total_outstanding_debt ?? ''}">
        </div>
      </div>
      <div class="net-income-line">Estimated disposable income: <strong id="net-income">—</strong></div>`;
  }

  function updateNetIncome() {
    const el = document.getElementById('net-income');
    if (!el) return;
    if (selected === 'business') {
      const hasInput = val('f-revenue') !== '' || val('f-expenses') !== '';
      el.textContent = hasInput ? KredtUI.currency(numVal('f-revenue') - numVal('f-expenses'), 'NGN') : '—';
    } else {
      const hasInput = val('f-income') !== '' || val('f-monthly-expenses') !== '';
      const totalIncome = numVal('f-income') + numVal('f-additional-income');
      const totalOutgoings = numVal('f-monthly-expenses') + numVal('f-debt-payment');
      el.textContent = hasInput ? KredtUI.currency(totalIncome - totalOutgoings, 'NGN') : '—';
    }
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
          <div class="form-grid-2">
            <div class="form-field">
              <label class="form-label" for="f-amount">Requested amount *</label>
              <div class="input-currency-wrap">
                <span class="input-currency-symbol">₦</span>
                <input type="number" min="0" step="1000" class="input" id="f-amount" placeholder="1,200,000" value="${shared.amount}">
              </div>
              <div class="form-error">Enter an amount greater than zero.</div>
            </div>
            <div class="form-field">
              <label class="form-label" for="f-tenor">Tenor (months) *</label>
              <select class="input" id="f-tenor">
                ${[3, 6, 12, 18, 24, 36].map((m) => `<option value="${m}" ${Number(shared.tenor) === m ? 'selected' : ''}>${m} months</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-field">
            <label class="form-label" for="f-purpose">Purpose *</label>
            <textarea class="input" id="f-purpose" placeholder="e.g. Working capital, Personal equipment, etc.">${E(shared.purpose)}</textarea>
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
      shared.tenor = numVal('f-tenor') || shared.tenor;
      shared.purpose = document.getElementById('f-purpose')?.value || shared.purpose;
      selected = card.dataset.value;
      render();
    }));

    ['f-revenue', 'f-expenses', 'f-income', 'f-additional-income', 'f-monthly-expenses', 'f-debt-payment']
      .forEach((id) => document.getElementById(id)?.addEventListener('input', updateNetIncome));

    updateNetIncome();
    document.getElementById('btn-save-draft').addEventListener('click', (e) => save(e.currentTarget, 'draft'));
    document.getElementById('btn-continue').addEventListener('click', (e) => save(e.currentTarget, 'continue'));
  }

  function collectPayload() {
    const loanPayload = {
      amount: numVal('f-amount'),
      currency: 'NGN',
      purpose: val('f-purpose'),
      tenor_months: numVal('f-tenor') || 12
    };

    let applicantPayload = {};
    let financialsPayload = {};

    if (selected === 'business') {
      const revenue = numVal('f-revenue');
      const expenses = numVal('f-expenses');
      const addIncome = numVal('f-additional-income');
      const debtPayment = numVal('f-debt-payment');
      const debtTotal = numVal('f-debt-total');

      applicantPayload = {
        full_name: val('f-business-name'),
        business_name: val('f-business-name'),
        business_type: val('f-business-type'),
        industry: val('f-industry'),
        business_age_months: numVal('f-age'),
        location: val('f-location')
      };

      financialsPayload = {
        monthly_salary_income: revenue,
        monthly_revenue: revenue,
        additional_income: addIncome,
        monthly_living_expenses: expenses,
        monthly_expenses: expenses,
        monthly_net_income: (revenue + addIncome) - expenses,
        existing_loan_obligations: debtPayment,
        existing_monthly_debt_payment: debtPayment,
        total_debt: debtTotal,
        total_outstanding_debt: debtTotal
      };
    } else {
      const salary = numVal('f-income');
      const addIncome = numVal('f-additional-income');
      const livingExpenses = numVal('f-monthly-expenses');
      const obligations = numVal('f-debt-payment');
      const totalDebt = numVal('f-debt-total');

      applicantPayload = {
        full_name: val('f-full-name'),
        age: numVal('f-borrower-age'),
        gender: val('f-gender') || 'Prefer not to say',
        marital_status: val('f-marital-status') || 'Single',
        employment_status: val('f-employment') || 'Employed',
        employment_duration_months: numVal('f-employment-duration'),
        education_level: val('f-education-level') || 'BSc',
        housing_type: val('f-housing-type') || 'Renting',
        location: val('f-location') || 'Lagos'
      };

      financialsPayload = {
        monthly_salary_income: salary,
        additional_income: addIncome,
        monthly_living_expenses: livingExpenses,
        existing_loan_obligations: obligations,
        total_debt: totalDebt
      };
    }

    return {
      // 1. Strict Target Backend Contract
      applicant: applicantPayload,
      loan: loanPayload,
      financials: financialsPayload,

      // 2. Backward Compatibility for Mock Store & Analyst Pipeline
      loan_type: selected,
      requested_amount: loanPayload.amount,
      currency: loanPayload.currency,
      purpose: loanPayload.purpose,
      tenor_months: loanPayload.tenor_months,
      applicant_details: {
        ...applicantPayload,
        monthly_income: financialsPayload.monthly_salary_income,
        monthly_expenses: financialsPayload.monthly_living_expenses,
        financials: financialsPayload
      }
    };
  }

  // Continue needs a complete Step 1; Save Draft only needs a loan type.
  function validate() {
    const isBus = selected === 'business';
    const nameId = isBus ? 'f-business-name' : 'f-full-name';
    const checks = [
      [document.getElementById('f-amount')?.closest('.form-field'), numVal('f-amount') > 0],
      [document.getElementById('f-purpose')?.closest('.form-field'), !!val('f-purpose')],
      [document.getElementById(nameId)?.closest('.form-field'), !!val(nameId)]
    ];

    if (!isBus) {
      checks.push([document.getElementById('f-borrower-age')?.closest('.form-field'), numVal('f-borrower-age') >= 18]);
      checks.push([document.getElementById('f-income')?.closest('.form-field'), numVal('f-income') > 0]);
    } else {
      checks.push([document.getElementById('f-revenue')?.closest('.form-field'), numVal('f-revenue') > 0]);
    }

    checks.forEach(([el, ok]) => {
      if (el) el.classList.toggle('has-error', !ok);
    });
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