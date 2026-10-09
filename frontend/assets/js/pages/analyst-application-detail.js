(function () {
  const appId = new URLSearchParams(window.location.search).get('id');
  const root = document.getElementById('page-root');

  function loanTypeTitle(app) { return app.loan_type === 'business' ? 'Business Loan' : 'Individual Loan'; }
  const requestedAmount = (app) => app.loan?.amount ?? app.requested_amount ?? 0;
  const loanTenor = (app) => app.loan?.tenor_months ?? app.tenor_months ?? 12;
  const currency = (app) => app.loan?.currency ?? app.currency ?? 'NGN';
  const loanPurpose = (app) => app.loan?.purpose ?? app.purpose ?? '—';

  function applicantFieldsHTML(app) {
    const isBusiness = app.loan_type === 'business';
    const d = app.applicant || app.applicant_details || {};
    const fin = app.financials || d.financials || {};
    const curr = currency(app);

    if (isBusiness) {
      return `
        <div class="kv-item"><div class="kv-label">Business Name</div><div class="kv-value">${KredtUI.escapeHtml(d.business_name || d.full_name || '—')}</div></div>
        <div class="kv-item"><div class="kv-label">Business Type</div><div class="kv-value">${KredtUI.escapeHtml(d.business_type || '—')}</div></div>
        <div class="kv-item"><div class="kv-label">Industry</div><div class="kv-value">${KredtUI.escapeHtml(d.industry || '—')}</div></div>
        <div class="kv-item"><div class="kv-label">Business Age</div><div class="kv-value">${d.business_age_months ?? '—'} months</div></div>
        <div class="kv-item"><div class="kv-label">Location</div><div class="kv-value">${KredtUI.escapeHtml(d.location || '—')}</div></div>
        <div class="kv-item"><div class="kv-label">Monthly Revenue</div><div class="kv-value">${KredtUI.currency(fin.monthly_revenue ?? fin.monthly_salary_income, curr)}</div></div>
        <div class="kv-item"><div class="kv-label">Additional Income</div><div class="kv-value">${KredtUI.currency(fin.additional_income || 0, curr)}</div></div>
        <div class="kv-item"><div class="kv-label">Monthly Expenses</div><div class="kv-value">${KredtUI.currency(fin.monthly_expenses ?? fin.monthly_living_expenses, curr)}</div></div>
        <div class="kv-item"><div class="kv-label">Existing Debt Payment</div><div class="kv-value">${KredtUI.currency(fin.existing_monthly_debt_payment ?? fin.existing_loan_obligations ?? 0, curr)}</div></div>
        <div class="kv-item"><div class="kv-label">Total Debt</div><div class="kv-value">${KredtUI.currency(fin.total_outstanding_debt ?? fin.total_debt ?? 0, curr)}</div></div>`;
    }

    return `
      <div class="kv-item"><div class="kv-label">Full Name</div><div class="kv-value">${KredtUI.escapeHtml(d.full_name || '—')}</div></div>
      <div class="kv-item"><div class="kv-label">Demographics</div><div class="kv-value">${d.age ? `${d.age} yrs` : '—'} • ${KredtUI.escapeHtml(d.gender || '—')} • ${KredtUI.escapeHtml(d.marital_status || '—')}</div></div>
      <div class="kv-item"><div class="kv-label">Employment</div><div class="kv-value">${KredtUI.escapeHtml(d.employment_status || '—')} (${d.employment_duration_months != null ? `${d.employment_duration_months} mos` : '—'})</div></div>
      <div class="kv-item"><div class="kv-label">Education & Housing</div><div class="kv-value">${KredtUI.escapeHtml(d.education_level || '—')} • ${KredtUI.escapeHtml(d.housing_type || '—')}</div></div>
      <div class="kv-item"><div class="kv-label">Location</div><div class="kv-value">${KredtUI.escapeHtml(d.location || '—')}</div></div>
      <div class="kv-item"><div class="kv-label">Monthly Salary Income</div><div class="kv-value">${KredtUI.currency(fin.monthly_salary_income ?? d.monthly_income, curr)}</div></div>
      <div class="kv-item"><div class="kv-label">Additional Income</div><div class="kv-value">${KredtUI.currency(fin.additional_income || 0, curr)}</div></div>
      <div class="kv-item"><div class="kv-label">Monthly Living Expenses</div><div class="kv-value">${KredtUI.currency(fin.monthly_living_expenses ?? d.monthly_expenses, curr)}</div></div>
      <div class="kv-item"><div class="kv-label">Monthly Debt Obligations</div><div class="kv-value">${KredtUI.currency(fin.existing_loan_obligations || 0, curr)}</div></div>
      <div class="kv-item"><div class="kv-label">Total Outstanding Debt</div><div class="kv-value">${KredtUI.currency(fin.total_debt || 0, curr)}</div></div>`;
  }

  function timelineHTML(app) {
    const rank = { draft: 0, submitted: 1, under_review: 2, investigation_in_progress: 3, investigation_complete: 4, additional_info_requested: 2.5, decided: 5 };
    const currentRank = rank[app.status] ?? 0;
    const items = [
      { label: 'Created', at: currentRank >= 0 },
      { label: 'Submitted', at: currentRank >= 1 },
      { label: 'Under Review', at: currentRank >= 2 },
      { label: 'Investigation in Progress', at: currentRank >= 3 },
      { label: 'Investigation Complete', at: currentRank >= 4 },
      { label: 'Decided', at: currentRank >= 5 },
    ];
    if (app.status === 'additional_info_requested') {
      items.splice(3, 0, { label: 'Additional Information Requested', at: true, special: true });
    }
    return `<div class="status-timeline">${items.map((it) => `
      <div class="status-timeline-item ${it.at ? 'is-done' : ''}">
        <div class="status-timeline-marker">${it.at ? '✓' : '○'}</div>
        <div class="status-timeline-content"><h4>${it.label}</h4></div>
      </div>`).join('')}</div>`;
  }

  async function actionButtonHTML(app) {
    if (app.status === 'decided') {
      return `<a href="report.html?id=${app.id}" class="btn btn-secondary">View Report</a>`;
    }
    const job = await KredtApi.investigations.latestForApplication(app.id);
    if (job && job.status !== 'complete' && job.status !== 'failed') {
      return `<a href="investigate.html?id=${app.id}" class="btn btn-primary">View Investigation</a>`;
    }
    if (job && job.status === 'complete') {
      return `<a href="report.html?id=${app.id}" class="btn btn-primary">View Report</a>`;
    }
    if (app.status === 'draft') {
      return `<span class="badge badge-neutral">Awaiting borrower submission</span>`;
    }
    return `<button type="button" class="btn btn-primary" id="start-investigation-btn">Start Investigation</button>`;
  }

  async function render() {
    try {
      await KredtStore.init();
      const [app, docs] = await Promise.all([
        KredtApi.applications.get(appId),
        KredtApi.documents.list(appId),
      ]);
      KredtAnalystShell.setBreadcrumb(app.id, app.reference, 'Application');

      const appName = app.applicant?.full_name || app.applicant_details?.business_name || app.applicant_details?.full_name || '—';
      const amount = requestedAmount(app);
      const curr = currency(app);
      const tenor = loanTenor(app);

      root.innerHTML = `
        ${app.is_demo ? `<div class="demo-banner demo-banner-inset">FICTIONAL DEMO DATA</div>` : ''}

        <div class="page-header">
          <div class="page-header-row">
            <div>
              <a href="../queue.html" class="text-faint" style="font-size:13.5px;">← Applications</a>
              <h1 style="margin-top:6px;">${KredtUI.escapeHtml(app.reference)}</h1>
              <p>${KredtUI.escapeHtml(appName)} • ${loanTypeTitle(app)} • ${KredtUI.currency(amount, curr)} (${tenor} mos)${app.is_demo ? ' • Demo Application' : ''}</p>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              ${KredtUI.statusBadge(app.status)}
              <span id="action-slot"></span>
            </div>
          </div>
        </div>
        ${KredtAnalystShell.tabsHTML(app.id, 'details', app)}

        <div id="confirm-slot"></div>

        <div class="detail-grid">
          <div>
            <div class="card card-pad" style="margin-bottom:20px;">
              <h3 style="margin-bottom:16px;">Loan Information</h3>
              <div class="kv-grid">
                <div class="kv-item"><div class="kv-label">Loan Type</div><div class="kv-value">${loanTypeTitle(app)}</div></div>
                <div class="kv-item"><div class="kv-label">Requested Amount</div><div class="kv-value">${KredtUI.currency(amount, curr)}</div></div>
                <div class="kv-item"><div class="kv-label">Tenor</div><div class="kv-value">${tenor} months</div></div>
                <div class="kv-item"><div class="kv-label">Currency</div><div class="kv-value">${curr}</div></div>
              </div>
              <hr class="divider">
              <div class="kv-label" style="margin-bottom:6px;">Purpose</div>
              <div style="font-size:14px;">${KredtUI.escapeHtml(loanPurpose(app))}</div>
            </div>

            <div class="card card-pad">
              <h3 style="margin-bottom:16px;">Applicant & Financial Profile</h3>
              <div class="kv-grid">${applicantFieldsHTML(app)}</div>
            </div>
          </div>

          <div>
            <div class="card card-pad" style="margin-bottom:20px;">
              <div class="card-header"><h3>Documents</h3></div>
              <p style="font-size:14px; margin-bottom:14px;">${docs.length} document${docs.length === 1 ? '' : 's'} uploaded</p>
              <a href="documents.html?id=${app.id}" class="btn btn-secondary btn-block">View Documents</a>
            </div>

            <div class="card card-pad">
              <h3 style="margin-bottom:16px;">Application Timeline</h3>
              ${timelineHTML(app)}
            </div>
          </div>
        </div>`;

      document.getElementById('action-slot').innerHTML = await actionButtonHTML(app);
      const startBtn = document.getElementById('start-investigation-btn');
      const confirmSlot = document.getElementById('confirm-slot');
      startBtn?.addEventListener('click', () => {
        startBtn.hidden = true;
        confirmSlot.innerHTML = `
          <div class="card card-pad inline-confirm" role="alertdialog" aria-labelledby="ic-title">
            <h3 id="ic-title">Start Investigation?</h3>
            <p>This application will be sent through the Kredt investigation pipeline. The available application information, policies, financial information, transactions and risk factors will be analyzed.</p>
            <div class="inline-confirm-actions">
              <button type="button" class="btn btn-secondary" id="ic-cancel">Cancel</button>
              <button type="button" class="btn btn-primary" id="ic-start">Start Investigation</button>
            </div>
          </div>`;
        document.getElementById('ic-cancel').addEventListener('click', () => { confirmSlot.innerHTML = ''; startBtn.hidden = false; });
        document.getElementById('ic-start').addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          document.getElementById('ic-cancel').disabled = true;
          btn.innerHTML = '<span class="btn-spinner"></span> Starting...';
          try {
            await KredtApi.investigations.start(app.id);
            window.location.href = `investigate.html?id=${app.id}`;
          } catch (err) {
            console.error(err);
            KredtUI.toast("Couldn't start the investigation.", 'error');
            btn.disabled = false; btn.textContent = 'Start Investigation';
            document.getElementById('ic-cancel').disabled = false;
          }
        });
      });
    } catch (err) {
      if (!err.expected) console.error(err); else console.warn(err.message);
      root.innerHTML = KredtUI.errorState({ title: 'Unable to load application', message: "We couldn't load this application." });
      document.getElementById('state-retry-btn')?.addEventListener('click', render);
    }
  }

  render();
})();