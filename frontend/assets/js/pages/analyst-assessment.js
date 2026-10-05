(function () {
  const appId = new URLSearchParams(window.location.search).get('id');
  const root = document.getElementById('page-root');

  const DECISIONS = [
    { key: 'request_info', icon: 'info', tone: 'info', label: 'Request More Information' },
    { key: 'continue_review', icon: 'refresh', tone: 'neutral', label: 'Continue Review' },
    { key: 'approve', icon: 'check', tone: 'success', label: 'Approve' },
    { key: 'decline', icon: 'close', tone: 'error', label: 'Decline' },
  ];

  function shellHTML(app, body) {
    return `
      ${app.is_demo ? `<div class="demo-banner demo-banner-inset">FICTIONAL DEMO DATA</div>` : ''}
      <div class="page-header">
        <h1>Assessment</h1>
        <p>Application #${KredtUI.escapeHtml(app.reference)}</p>
      </div>
      ${KredtAnalystShell.tabsHTML(app.id, 'assessment', app)}
      ${body}`;
  }

  function summaryCardsHTML(report) {
    if (!report) return '';
    return `
      <div class="assessment-summary-grid">
        <div class="card card-pad"><div class="kv-label">DSCR</div><div class="kv-value">${KredtUI.escapeHtml(report.financial_ratios.find((r) => r.name === 'DSCR')?.value || '—')}</div></div>
        <div class="card card-pad"><div class="kv-label">Risk Band</div><div class="kv-value">${KredtUI.riskBadge(report.risk_prediction.band)}</div></div>
        <div class="card card-pad"><div class="kv-label">Policy Result</div><div class="kv-value">${report.policy_findings.some((f) => f.result === 'FAIL') ? KredtUI.flagBadge('breach') : '<span class="badge badge-success">All Passed</span>'}</div></div>
      </div>`;
  }

  function recordedHTML(app, record) {
    const labelMap = { approve: 'Approved', decline: 'Declined', request_info: 'Additional Information Requested', continue_review: 'Marked for Continued Review' };
    const badgeMap = { approve: 'badge-success', decline: 'badge-error', request_info: 'badge-warning', continue_review: 'badge-info' };
    return `
      <div class="card card-pad">
        <div class="card-header">
          <h3>Assessment Recorded</h3>
          <span class="badge ${badgeMap[record.decision] || 'badge-neutral'}">${labelMap[record.decision] || record.decision}</span>
        </div>
        <div class="kv-grid" style="margin-bottom:16px;">
          <div class="kv-item"><div class="kv-label">Analyst</div><div class="kv-value">${KredtUI.escapeHtml(record.analyst)}</div></div>
          <div class="kv-item"><div class="kv-label">Recorded</div><div class="kv-value">${KredtUI.formatDateTime(record.created_at)}</div></div>
        </div>
        ${record.notes ? `<hr class="divider"><div class="kv-label" style="margin-bottom:6px;">Notes</div><p style="font-size:14px; color:var(--color-text-muted);">${KredtUI.escapeHtml(record.notes)}</p>` : ''}
      </div>
      <div class="form-actions" style="border-top:none; padding-top:0;">
        <a href="detail.html?id=${app.id}" class="btn btn-secondary">Back to Application</a>
        <a href="audit.html?id=${app.id}" class="btn btn-secondary">View Audit Log</a>
      </div>`;
  }

  function previousActionBannerHTML(record) {
    if (!record) return '';
    const labelMap = { request_info: 'Additional Information Requested', continue_review: 'Marked for Continued Review' };
    return `
      <div class="card card-pad" style="margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; gap:16px;">
        <div>
          <div class="kv-label" style="margin-bottom:4px;">Previous Action</div>
          <div style="font-size:14px; font-weight:600; color:var(--color-navy);">${labelMap[record.decision] || record.decision} — ${KredtUI.formatDateTime(record.created_at)}</div>
          ${record.notes ? `<div style="font-size:13px; color:var(--color-text-faint); margin-top:4px;">"${KredtUI.escapeHtml(record.notes)}"</div>` : ''}
        </div>
        <a href="audit.html?id=${'__APPID__'}" class="btn btn-secondary btn-sm">Audit Log</a>
      </div>`;
  }

  function formHTML() {
    return `
      <div class="card card-pad">
        <h3 style="margin-bottom:16px;">Record Your Decision</h3>
        <div class="decision-options" id="decision-options">
          ${DECISIONS.map((d) => `
            <div class="decision-option" data-decision="${d.key}" data-tone="${d.tone}">
              <span class="icon">${KredtUI.icon(d.icon, 19)}</span>${d.label}
            </div>`).join('')}
        </div>
        <div class="form-field">
          <label class="form-label" for="assessment-notes">Assessment Notes</label>
          <textarea class="input" id="assessment-notes" placeholder="Document your reasoning, any conditions, or what additional information is needed..." style="min-height:120px;"></textarea>
        </div>
        <div class="form-actions">
          <a href="report.html?id=${'__APPID__'}" class="btn btn-secondary" id="back-to-report">Back to Report</a>
          <button type="button" class="btn btn-primary" id="submit-assessment-btn" disabled>Submit Assessment</button>
        </div>
      </div>`;
  }

  async function render() {
    try {
      await KredtStore.init();
      const [app, existing, job] = await Promise.all([
        KredtApi.applications.get(appId),
        KredtApi.assessments.get(appId),
        KredtApi.investigations.latestForApplication(appId),
      ]);
      KredtAnalystShell.setBreadcrumb(app.id, app.reference, 'Assessment');
      const isFinal = existing && (existing.decision === 'approve' || existing.decision === 'decline');
      const report = job && job.status === 'complete' ? await KredtApi.reports.get(job.id) : null;

      if (isFinal) {
        root.innerHTML = shellHTML(app, summaryCardsHTML(report) + recordedHTML(app, existing));
        return;
      }

      if (!report) {
        root.innerHTML = shellHTML(app, KredtUI.emptyState({
          icon: 'search', title: 'Investigation not complete',
          message: 'Complete the investigation before recording an assessment.',
          actionLabel: 'Go to Application', actionHref: `detail.html?id=${app.id}`,
        }));
        return;
      }

      root.innerHTML = shellHTML(app, summaryCardsHTML(report) + previousActionBannerHTML(existing).replace(/__APPID__/g, app.id) + formHTML().replace(/__APPID__/g, app.id));

      let selectedDecision = null;
      const options = document.querySelectorAll('.decision-option');
      const submitBtn = document.getElementById('submit-assessment-btn');
      options.forEach((opt) => {
        opt.addEventListener('click', () => {
          options.forEach((o) => o.classList.remove('is-selected'));
          opt.classList.add('is-selected');
          selectedDecision = opt.dataset.decision;
          submitBtn.disabled = false;
        });
      });

      submitBtn.addEventListener('click', async () => {
        if (!selectedDecision) return;
        const notes = document.getElementById('assessment-notes').value.trim();
        const decisionLabel = DECISIONS.find((d) => d.key === selectedDecision)?.label;
        const ok = await KredtUI.confirmModal({
          title: `${decisionLabel}?`,
          message: `This will record your assessment and update the application's status. This action is logged in the audit trail.`,
          confirmLabel: 'Confirm',
          destructive: selectedDecision === 'decline',
        });
        if (!ok) return;

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="btn-spinner"></span> Submitting...`;
        try {
          await KredtApi.assessments.submit(appId, { decision: selectedDecision, notes });
          KredtUI.toast('Assessment recorded successfully.', 'success');
          render();
        } catch (err) {
          console.error(err);
          KredtUI.toast("Couldn't record the assessment.", 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Assessment';
        }
      });
    } catch (err) {
      if (!err.expected) console.error(err); else console.warn(err.message);
      root.innerHTML = KredtUI.errorState({ message: "We couldn't load the assessment." });
      document.getElementById('state-retry-btn')?.addEventListener('click', render);
    }
  }

  render();
})();
