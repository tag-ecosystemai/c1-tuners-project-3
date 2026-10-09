// Borrower application screen.
//   Draft       -> ?step=documents (Step 2) or ?step=review (Step 3)
//                  (Step 1 lives in new.html?id=...)
//   Submitted+  -> Tracking
(function () {
  const params = new URLSearchParams(window.location.search);
  const appId = params.get('id');
  const root = document.getElementById('page-root');
  const E = KredtUI.escapeHtml;

  const STEP_LABELS = ['Application', 'Documents', 'Review'];

  function progressHTML(activeIndex) {
    return `<div class="form-progress">${STEP_LABELS.map((label, i) => `
      ${i > 0 ? '<div class="form-progress-sep"></div>' : ''}
      <div class="form-progress-step ${i === activeIndex ? 'is-active' : i < activeIndex ? 'is-complete' : ''}">
        <span class="num">${i < activeIndex ? '✓' : i + 1}</span><span class="label">${label}</span>
      </div>`).join('')}</div>`;
  }

  function loanTypeTitle(app) { return app.loan_type === 'business' ? 'Business Loan' : 'Individual Loan'; }
  const applicantName = (app) => app.applicant?.full_name || app.applicant_details?.business_name || app.applicant_details?.full_name || '';
  const requestedAmount = (app) => app.loan?.amount ?? app.requested_amount ?? 0;
  const loanTenor = (app) => app.loan?.tenor_months ?? app.tenor_months ?? 12;
  const loanPurpose = (app) => app.loan?.purpose ?? app.purpose ?? '';
  const isStep1Complete = (app) => !!(app.loan_type && requestedAmount(app) > 0 && loanPurpose(app) && applicantName(app));

  // ============================================================
  // STEP 2 — Documents
  // ============================================================
  const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png'];

  function docIconLabel(type) {
    const map = { bank_statement: 'STMT', financial_statement: 'FIN', business_registration: 'REG', loan_schedule: 'SCH', tax_document: 'TAX' };
    return map[type] || 'DOC';
  }

  function documentChecklistGroups(loanType) {
    const groups = [
      {
        icon: 'idcard', title: 'Identity Verification',
        items: [
          { label: 'Government-issued ID — National ID (NIN) slip, international passport, driver license, or voter card', required: true },
          { label: 'Bank Verification Number (BVN)', required: true },
          { label: 'Recent passport photograph', required: false },
        ],
      },
      {
        icon: 'file', title: 'Income & Employment',
        items: [
          { label: 'Bank statement — most recent 6 months', required: true },
          { label: 'Payslip — most recent 3 months (salaried applicants)', required: true },
          { label: 'Employment letter or staff ID card', required: false },
        ],
      },
      {
        icon: 'home', title: 'Proof of Address',
        items: [
          { label: 'Recent utility bill — electricity, water, or waste', required: true },
          { label: 'Tenancy agreement or landlord letter', required: false },
        ],
      },
    ];
    if (loanType === 'business') {
      groups.push({
        icon: 'briefcase', title: 'Business Documents',
        items: [
          { label: 'Certificate of Incorporation (CAC)', required: true },
          { label: 'Company bank statement — most recent 6 to 12 months', required: true },
          { label: 'Tax Identification Number (TIN)', required: true },
          { label: 'Most recent audited financial statements', required: false },
        ],
      });
    }
    return groups;
  }

  function documentChecklistHTML(loanType) {
    const groups = documentChecklistGroups(loanType);
    return `
      <div class="card card-pad doc-checklist">
        <h3 style="margin-bottom:6px;">Documents You will Need</h3>
        <p class="doc-checklist-intro">Have these ready before you upload. Required documents must be provided to submit your application; optional ones can strengthen your case but will not block submission.</p>
        <div class="doc-checklist-groups">
          ${groups.map((g) => `
            <div class="doc-checklist-group">
              <div class="doc-checklist-group-head">
                <span class="doc-checklist-group-icon">${KredtUI.icon(g.icon, 15)}</span>
                <h4>${E(g.title)}</h4>
              </div>
              <div class="doc-checklist-items">
                ${g.items.map((it) => `
                  <div class="doc-checklist-item">
                    <span class="badge ${it.required ? 'badge-required' : 'badge-optional'}">${it.required ? 'Required' : 'Optional'}</span>
                    <span>${E(it.label)}</span>
                  </div>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  function validateFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) return "This file type is not supported. Please upload a PDF, JPG or PNG.";
    const maxMb = window.KREDT_MAX_UPLOAD_MB;
    if (maxMb && file.size > maxMb * 1024 * 1024) return `This file is too large. Maximum file size: ${maxMb} MB.`;
    return null;
  }

  async function renderDocumentsStep(app) {
    root.innerHTML = `
      <div class="page-header">
        <h1>Documents</h1>
        <p>Upload the documents required to support your application.</p>
      </div>
      ${progressHTML(1)}
      ${documentChecklistHTML(app.loan_type)}
      <div class="card card-pad">
        <div class="upload-zone" id="upload-zone">
          <div class="upload-zone-icon">⬆</div>
          <h4>Drag &amp; drop files here</h4>
          <p style="margin-bottom:12px;">or</p>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-browse">Browse Files</button>
          <p style="margin-top:14px;">PDF, JPG, PNG</p>
          <input type="file" id="file-input" multiple hidden accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png">
        </div>
        <div class="upload-error" id="upload-error" role="alert"></div>
        <div class="doc-list" id="doc-list"></div>
        <div class="form-actions">
          <a href="new.html?id=${appId}" class="btn btn-secondary">Back</a>
          <button type="button" class="btn btn-primary" id="btn-to-review">Continue</button>
        </div>
      </div>`;

    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('file-input');
    const list = document.getElementById('doc-list');
    const errorBox = document.getElementById('upload-error');

    function showErrors(messages) {
      errorBox.innerHTML = messages.map((m) => `<div>${E(m)}</div>`).join('');
      errorBox.classList.toggle('is-visible', messages.length > 0);
    }

    async function refreshList() {
      const docs = await KredtApi.documents.list(appId);
      const pending = Array.from(list.querySelectorAll('[data-uploading]')).map((n) => n.outerHTML);
      list.innerHTML = docs.map((d) => `
        <div class="doc-row" data-doc="${d.id}">
          <div class="doc-icon">${docIconLabel(d.document_type)}</div>
          <div class="doc-info">
            <div class="doc-name">${E(d.file_name)}</div>
            <div class="doc-meta">${E(d.file_size)} • <span class="doc-status-ok">Uploaded ✓</span></div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm remove-doc" data-id="${d.id}">Remove</button>
        </div>`).join('');
      list.insertAdjacentHTML('beforeend', pending.join(''));
      list.querySelectorAll('.retry-upload').forEach((b) => { b.onclick = () => retryFromRow(b.closest('[data-uploading]')); });
      list.querySelectorAll('.remove-doc').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const ok = await KredtUI.confirmModal({
            title: 'Remove Document?',
            message: 'This document will be removed from your application.',
            confirmLabel: 'Remove', destructive: true,
          });
          if (!ok) return;
          await KredtApi.documents.remove(appId, btn.dataset.id);
          KredtUI.toast('Document removed.');
          refreshList();
        });
      });
    }

    const failedFiles = new Map();

    function uploadingRowHTML(id, name) {
      return `<div class="doc-row" data-uploading="${id}">
        <div class="doc-icon">⬆</div>
        <div class="doc-info">
          <div class="doc-name">${E(name)}</div>
          <div class="doc-meta">Uploading...</div>
          <div class="doc-progress-track"><div class="doc-progress-fill" style="width:70%;"></div></div>
        </div>
      </div>`;
    }

    function retryFromRow(row) {
      const tempId = row.dataset.uploading;
      const file = failedFiles.get(tempId);
      if (file) attemptUpload(file, tempId);
    }

    async function attemptUpload(file, tempId) {
      list.querySelector(`[data-uploading="${tempId}"]`)?.remove();
      list.insertAdjacentHTML('beforeend', uploadingRowHTML(tempId, file.name));
      try {
        await KredtApi.documents.upload(appId, file);
        failedFiles.delete(tempId);
        list.querySelector(`[data-uploading="${tempId}"]`)?.remove();
        KredtUI.toast('Document uploaded successfully.', 'success');
        await refreshList();
      } catch (err) {
        console.error(err);
        failedFiles.set(tempId, file);
        const row = list.querySelector(`[data-uploading="${tempId}"]`);
        if (row) {
          row.innerHTML = `<div class="doc-icon" style="background:var(--color-error-bg); color:var(--color-error);">!</div>
            <div class="doc-info"><div class="doc-name">${E(file.name)}</div><div class="doc-meta" style="color:var(--color-error);">Unable to upload this document.</div></div>
            <button type="button" class="btn btn-secondary btn-sm retry-upload">Retry</button>`;
          row.querySelector('.retry-upload').addEventListener('click', () => attemptUpload(file, tempId));
        }
      }
    }

    async function handleFiles(files) {
      const errors = [];
      for (const file of Array.from(files)) {
        const problem = validateFile(file);
        if (problem) { errors.push(`${file.name}: ${problem}`); continue; }
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await attemptUpload(file, tempId);
      }
      showErrors(errors);
      input.value = '';
    }

    zone.addEventListener('click', (e) => { if (!e.target.closest('#btn-browse')) input.click(); });
    document.getElementById('btn-browse').addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => handleFiles(e.target.files));
    ['dragover', 'dragenter'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('is-dragover'); }));
    ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('is-dragover'); }));
    zone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

    document.getElementById('btn-to-review').addEventListener('click', () => {
      window.location.href = `detail.html?id=${appId}&step=review`;
    });

    await refreshList();
  }

  // ============================================================
  // STEP 3 — Review & Submit
  // ============================================================
  async function renderReviewStep(app) {
    const isBusiness = app.loan_type === 'business';
    const d = app.applicant || app.applicant_details || {};
    const fin = app.financials || d.financials || {};
    const docs = await KredtApi.documents.list(appId);
    const kv = (label, value) => `<div class="kv-item"><div class="kv-label">${label}</div><div class="kv-value">${value}</div></div>`;

    const currency = app.loan?.currency || app.currency || 'NGN';
    const amount = requestedAmount(app);
    const tenor = loanTenor(app);
    const purpose = loanPurpose(app);

    root.innerHTML = `
      <div class="page-header">
        <h1>Review &amp; Submit</h1>
        <p>Please review your information carefully before submitting your application.</p>
      </div>
      ${progressHTML(2)}
      <div class="card card-pad">

        <div class="review-section">
          <div class="review-section-head"><h3>Loan Details</h3><a href="new.html?id=${appId}" class="btn btn-secondary btn-sm">Edit</a></div>
          <div class="kv-grid">
            ${kv('Loan Type', loanTypeTitle(app))}
            ${kv('Requested Amount', KredtUI.currency(amount, currency))}
            ${kv('Tenor', `${tenor} months`)}
            ${kv('Currency', currency)}
          </div>
          <div style="margin-top:16px;">
            <div class="kv-label" style="margin-bottom:6px;">Purpose</div>
            <div style="font-size:14px; color:var(--color-text-muted);">${E(purpose || '—')}</div>
          </div>
        </div>

        <div class="review-section">
          <div class="review-section-head"><h3>Applicant &amp; Financial Details</h3><a href="new.html?id=${appId}" class="btn btn-secondary btn-sm">Edit</a></div>
          <div class="kv-grid">
            ${isBusiness ? `
              ${kv('Business Name', E(d.business_name || d.full_name || '—'))}
              ${kv('Business Type', E(d.business_type || '—'))}
              ${kv('Industry', E(d.industry || '—'))}
              ${kv('Business Age', `${d.business_age_months ?? '—'} months`)}
              ${kv('Location', E(d.location || '—'))}
              ${kv('Monthly Revenue', KredtUI.currency(fin.monthly_revenue ?? fin.monthly_salary_income ?? 0, currency))}
              ${kv('Additional Income', KredtUI.currency(fin.additional_income || 0, currency))}
              ${kv('Monthly Expenses', KredtUI.currency(fin.monthly_expenses ?? fin.monthly_living_expenses ?? 0, currency))}
              ${kv('Monthly Debt Obligations', KredtUI.currency(fin.existing_monthly_debt_payment ?? fin.existing_loan_obligations ?? 0, currency))}
              ${kv('Total Debt', KredtUI.currency(fin.total_outstanding_debt ?? fin.total_debt ?? 0, currency))}
            ` : `
              ${kv('Full Name', E(d.full_name || '—'))}
              ${kv('Age', d.age ? `${d.age} yrs` : '—')}
              ${kv('Gender', E(d.gender || '—'))}
              ${kv('Marital Status', E(d.marital_status || '—'))}
              ${kv('Employment Status', E(d.employment_status || '—'))}
              ${kv('Tenure', d.employment_duration_months != null ? `${d.employment_duration_months} months` : '—')}
              ${kv('Education', E(d.education_level || '—'))}
              ${kv('Housing', E(d.housing_type || '—'))}
              ${kv('Location', E(d.location || '—'))}
              ${kv('Monthly Salary', KredtUI.currency(fin.monthly_salary_income ?? d.monthly_income ?? 0, currency))}
              ${kv('Additional Income', KredtUI.currency(fin.additional_income || 0, currency))}
              ${kv('Monthly Living Expenses', KredtUI.currency(fin.monthly_living_expenses ?? d.monthly_expenses ?? 0, currency))}
              ${kv('Loan Obligations', KredtUI.currency(fin.existing_loan_obligations ?? 0, currency))}
              ${kv('Total Debt', KredtUI.currency(fin.total_debt ?? 0, currency))}
            `}
          </div>
        </div>

        <div class="review-section">
          <div class="review-section-head"><h3>Documents</h3><a href="detail.html?id=${appId}&step=documents" class="btn btn-secondary btn-sm">Manage Documents</a></div>
          ${docs.length ? `<div class="doc-list" style="margin-top:0;">${docs.map((doc) => `
            <div class="doc-row"><div class="doc-icon">${docIconLabel(doc.document_type)}</div>
              <div class="doc-info"><div class="doc-name">${E(doc.file_name)}</div><div class="doc-meta">${E(doc.file_size)}</div></div>
              <span class="doc-status-ok">Uploaded ✓</span>
            </div>`).join('')}</div>` : `<p class="text-faint" style="font-size:14px;">No documents uploaded.</p>`}
        </div>

        <div class="review-section">
          <label class="checkbox-row">
            <input type="checkbox" id="confirm-check">
            <span style="font-size:14px; color:var(--color-text-muted);">I confirm that the information provided is accurate and complete.</span>
          </label>
        </div>

        <div class="form-actions">
          <a href="detail.html?id=${appId}&step=documents" class="btn btn-secondary">Back</a>
          <button type="button" class="btn btn-primary" id="btn-submit" disabled>Submit Application</button>
        </div>
      </div>`;

    const checkbox = document.getElementById('confirm-check');
    const submitBtn = document.getElementById('btn-submit');
    checkbox.addEventListener('change', () => { submitBtn.disabled = !checkbox.checked; });

    submitBtn.addEventListener('click', async () => {
      submitBtn.disabled = true;
      checkbox.disabled = true;
      submitBtn.innerHTML = `<span class="btn-spinner"></span> Submitting...`;
      try {
        await KredtApi.applications.submit(appId);
        window.location.href = `detail.html?id=${appId}`;
      } catch (err) {
        console.error(err);
        KredtUI.toast("Could not submit your application.", 'error');
        checkbox.disabled = false;
        submitBtn.disabled = !checkbox.checked;
        submitBtn.textContent = 'Submit Application';
      }
    });
  }

  // ============================================================
  // TRACKING (submitted and beyond)
  // ============================================================
  const STATE_PANELS = {
    submitted: { title: 'Application Submitted', text: 'Your application has been received and is waiting for review.' },
    under_review: { title: 'Under Review', text: 'Your application is currently being reviewed by our credit team.' },
    investigation_in_progress: { title: 'Investigation in Progress', text: 'Your application is currently being investigated using the information provided.', progress: true },
    investigation_complete: { title: 'Investigation Complete', text: 'The investigation of your application has been completed. Your application is now moving toward the final decision.' },
    additional_info_requested: { title: 'Action Required', text: 'We need additional information to continue reviewing your application.', tone: 'warning', action: true },
    decided: { title: 'Decision Made', text: 'Your application has reached a final decision.', tone: 'success' },
  };

  const CURRENT_STEP = { submitted: 0, under_review: 1, additional_info_requested: 1, investigation_in_progress: 2, investigation_complete: 3, decided: 4 };

  function timelineHTML(app, decision) {
    const current = CURRENT_STEP[app.status] ?? 0;
    const finished = app.status === 'decided';
    const items = [
      { label: 'Application Submitted', sub: KredtUI.formatDate(app.submitted_at) },
      { label: 'Under Review', sub: app.status === 'additional_info_requested' ? 'We need some information from you.' : 'Our team is reviewing your application.' },
      { label: 'Investigation', sub: 'Your application will undergo investigation.' },
      { label: 'Investigation Complete' },
      { label: 'Decision', sub: finished && decision ? (decision.outcome === 'approved' ? 'Approved' : 'Declined') : '' },
    ];
    return `<div class="status-timeline">${items.map((it, i) => {
      const done = finished || i < current;
      const isCurrent = !finished && i === current;
      return `
      <div class="status-timeline-item ${done ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}">
        <div class="status-timeline-marker">${done ? '✓' : isCurrent ? '●' : '○'}</div>
        <div class="status-timeline-content"><h4>${it.label}</h4>${it.sub ? `<p>${E(it.sub)}</p>` : ''}</div>
      </div>`;
    }).join('')}</div>`;
  }

  function infoRequestHTML(app) {
    const req = app.info_request || {};
    const items = Array.isArray(req.items) ? req.items : [];
    return `
      <div class="info-request-panel" id="info-request-panel" hidden>
        ${items.length ? `
          <div class="kv-label" style="margin-bottom:8px;">Please provide</div>
          <ul class="info-request-list">${items.map((i) => `<li>${E(i)}</li>`).join('')}</ul>` : `
          <p style="font-size:14px; margin:0;">Our team will share exactly what is needed shortly. You do not need to do anything yet.</p>`}
        ${req.deadline ? `<div style="margin-top:12px; font-size:13.5px;"><span class="kv-label">Deadline</span><br><strong>${KredtUI.formatDate(req.deadline)}</strong></div>` : ''}
      </div>`;
  }

  function statePanelHTML(app, decision) {
    const p = STATE_PANELS[app.status];
    if (!p) return '';
    return `
      <div class="card card-pad status-panel ${p.tone ? `is-${p.tone}` : ''}" style="margin-bottom:20px;">
        <h3>${p.title}</h3>
        <p>${p.text}</p>
        ${p.progress ? '<div class="progress-indeterminate" aria-hidden="true"><span></span></div>' : ''}
        ${app.status === 'decided' && decision ? `<div style="margin-top:14px;"><span class="kv-label">Status</span><br>${decision.outcome === 'approved' ? '<span class="badge badge-success">Approved</span>' : '<span class="badge badge-error">Declined</span>'}</div>` : ''}
        ${p.action ? `<div style="margin-top:16px;"><button type="button" class="btn btn-primary btn-sm" id="btn-view-request" aria-expanded="false">View Request</button></div>${infoRequestHTML(app)}` : ''}
      </div>`;
  }

  function renderTracking(app, decision) {
    const isBusiness = app.loan_type === 'business';
    const d = app.applicant || app.applicant_details || {};
    const fin = app.financials || d.financials || {};
    const currency = app.loan?.currency || app.currency || 'NGN';
    const amount = requestedAmount(app);
    const tenor = loanTenor(app);

    const rows = isBusiness
      ? [
          ['Business name', d.business_name || d.full_name],
          ['Business type', d.business_type],
          ['Industry', d.industry],
          ['Location', d.location],
          ['Monthly revenue', (fin.monthly_revenue ?? fin.monthly_salary_income) != null ? KredtUI.currency(fin.monthly_revenue ?? fin.monthly_salary_income, currency) : null]
        ]
      : [
          ['Full name', d.full_name],
          ['Age / Gender', d.age ? `${d.age} yrs • ${d.gender || '—'}` : null],
          ['Employment', d.employment_status],
          ['Education / Housing', d.education_level ? `${d.education_level} • ${d.housing_type || '—'}` : null],
          ['Location', d.location],
          ['Monthly salary', (fin.monthly_salary_income ?? d.monthly_income) != null ? KredtUI.currency(fin.monthly_salary_income ?? d.monthly_income, currency) : null]
        ];

    root.innerHTML = `
      ${app.is_demo ? `<div class="demo-banner demo-banner-inset">FICTIONAL DEMO DATA</div>` : ''}
      <div class="page-header">
        <a href="../applications.html" class="text-faint" style="font-size:13.5px;">← My Applications</a>
        <div class="page-header-row" style="margin-top:8px;">
          <div>
            <h1>Application #${E(app.reference)}</h1>
            <p>${loanTypeTitle(app)} • ${KredtUI.currency(amount, currency)} (${tenor} mos)</p>
          </div>
          ${KredtUI.statusBadge(app.status, 'borrower')}
        </div>
      </div>

      ${statePanelHTML(app, decision)}

      <div class="tracking-grid">
        <div class="card card-pad">
          <h3 style="margin-bottom:16px;">Progress</h3>
          ${timelineHTML(app, decision)}
        </div>
        <div class="card card-pad">
          <h3 style="margin-bottom:16px;">Application summary</h3>
          <div class="kv-grid" style="grid-template-columns:1fr 1fr;">
            <div class="kv-item"><div class="kv-label">Loan Type</div><div class="kv-value">${loanTypeTitle(app)}</div></div>
            <div class="kv-item"><div class="kv-label">Requested Amount</div><div class="kv-value">${KredtUI.currency(amount, currency)}</div></div>
            <div class="kv-item"><div class="kv-label">Tenor</div><div class="kv-value">${tenor} months</div></div>
            <div class="kv-item"><div class="kv-label">Submitted</div><div class="kv-value">${KredtUI.formatDate(app.submitted_at)}</div></div>
            <div class="kv-item"><div class="kv-label">Status</div><div class="kv-value">${KredtUI.statusLabel(app.status, 'borrower')}</div></div>
          </div>
          <hr class="divider">
          <div class="kv-label" style="margin-bottom:6px;">Purpose</div>
          <div style="font-size:14px; color:var(--color-text-muted);">${E(loanPurpose(app) || '—')}</div>
        </div>
      </div>

      <div class="card card-pad" style="margin-top:20px;">
        <h3 style="margin-bottom:16px;">Application details</h3>
        <div class="kv-grid">
          ${rows.map(([k, v]) => `<div class="kv-item"><div class="kv-label">${k}</div><div class="kv-value">${E(v || '—')}</div></div>`).join('')}
        </div>
      </div>`;

    const viewBtn = document.getElementById('btn-view-request');
    viewBtn?.addEventListener('click', () => {
      const panel = document.getElementById('info-request-panel');
      panel.hidden = !panel.hidden;
      viewBtn.setAttribute('aria-expanded', String(!panel.hidden));
    });
  }

  // ============================================================
  // Entry point
  // ============================================================
  let trackingPollTimer = null;
  let lastStatus = null;

  async function loadDecision(app) {
    return app.status === 'decided' ? KredtApi.applications.getDecision(app.id) : null;
  }

  async function init() {
    if (trackingPollTimer) { clearInterval(trackingPollTimer); trackingPollTimer = null; }
    if (!appId) {
      root.innerHTML = KredtUI.errorState({ title: 'Application not found', message: 'No application ID was provided.' });
      return;
    }
    try {
      await KredtStore.init();
      const app = await KredtApi.applications.get(appId);

      if (app.status === 'draft') {
        const step = params.get('step');
        if ((step !== 'documents' && step !== 'review') || !isStep1Complete(app)) {
          window.location.replace(`new.html?id=${appId}`);
          return;
        }
        if (step === 'documents') await renderDocumentsStep(app);
        else await renderReviewStep(app);
        return;
      }

      lastStatus = app.status;
      renderTracking(app, await loadDecision(app));

      if (app.status !== 'decided') {
        trackingPollTimer = setInterval(async () => {
          try {
            const latest = await KredtApi.applications.get(appId);
            if (latest.status === lastStatus) return;
            lastStatus = latest.status;
            renderTracking(latest, await loadDecision(latest));
            if (latest.status === 'decided') { clearInterval(trackingPollTimer); trackingPollTimer = null; }
          } catch (e) { /* keep showing last good state */ }
        }, 4000);
      }
    } catch (err) {
      if (!err.expected) console.error(err); else console.warn(err.message);
      root.innerHTML = KredtUI.errorState({ title: 'Unable to load application', message: "We could not load this application." });
      document.getElementById('state-retry-btn')?.addEventListener('click', init);
    }
  }

  init();
})();