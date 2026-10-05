(function () {
  const appId = new URLSearchParams(window.location.search).get('id');
  const root = document.getElementById('page-root');

  function resultBadge(result) {
    const map = {
      PASS: ['badge-success', 'Pass'],
      FAIL: ['badge-error', 'Fail'],
      REQUIRES_REVIEW: ['badge-warning', 'Requires Review'],
    };
    const [cls, label] = map[result] || ['badge-neutral', result || '—'];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  // Maps a result/flag to the finding-card's left accent colour, so the
  // outcome reads at a glance down a long list without reading every badge.
  function findingAccent(result) {
    const map = { PASS: 'accent-success', FAIL: 'accent-error', REQUIRES_REVIEW: 'accent-warning' };
    return map[result] || 'accent-neutral';
  }

  function showEvidenceModal(title, bodyHTML) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay is-open';
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <h3>${KredtUI.escapeHtml(title)}</h3>
        <div style="font-size:14px; color:var(--color-text-muted); line-height:1.6;">${bodyHTML}</div>
        <div class="modal-actions"><button type="button" class="btn btn-primary" data-close>Close</button></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-close]')) overlay.remove(); });
  }

  function shellHTML(app, body) {
    return `
      ${app.is_demo ? `<div class="demo-banner demo-banner-inset">FICTIONAL DEMO DATA</div>` : ''}
      <div class="page-header">
        <div class="page-header-row">
          <div>
            <h1>Investigation Report</h1>
            <p>Application #${KredtUI.escapeHtml(app.reference)}</p>
          </div>
          <a href="assessment.html?id=${app.id}" class="btn btn-primary">Go to Assessment</a>
        </div>
      </div>
      ${KredtAnalystShell.tabsHTML(app.id, 'report', app)}
      ${body}`;
  }

  function renderReport(app, report) {
    const policyPassCount = report.policy_findings.filter((f) => f.result === 'PASS').length;
    const policyFailCount = report.policy_findings.filter((f) => f.result === 'FAIL').length;
    const policyReviewCount = report.policy_findings.filter((f) => f.result === 'REQUIRES_REVIEW').length;

    root.innerHTML = shellHTML(app, `
      <div class="card card-pad report-section">
        <h3>Summary</h3>
        <p style="font-size:14.5px; line-height:1.7;">${KredtUI.escapeHtml(report.summary)}</p>
        <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
          <span class="badge badge-success">${policyPassCount} Passed</span>
          ${policyFailCount ? `<span class="badge badge-error">${policyFailCount} Failed</span>` : ''}
          ${policyReviewCount ? `<span class="badge badge-warning">${policyReviewCount} Requires Review</span>` : ''}
          ${report.transaction_findings.length ? `<span class="badge badge-warning">${report.transaction_findings.length} Transaction Flag${report.transaction_findings.length > 1 ? 's' : ''}</span>` : `<span class="badge badge-success">No Transaction Flags</span>`}
        </div>
      </div>

      <div class="card card-pad report-section">
        <h3>Policy Checks</h3>
        ${report.policy_findings.map((f) => `
          <div class="finding-card ${findingAccent(f.result)}">
            <div class="finding-card-head">
              <div class="clause">${KredtUI.escapeHtml(f.clause_ref)}</div>
              ${resultBadge(f.result)}
            </div>
            <div class="excerpt">"${KredtUI.escapeHtml(f.clause_text_excerpt)}"</div>
            <div class="relevance">${KredtUI.escapeHtml(f.relevance)}</div>
            <div class="applies-to">Applies to: ${KredtUI.escapeHtml(f.applies_to)}</div>
            <button type="button" class="evidence-link view-evidence-policy" data-clause="${KredtUI.escapeHtml(f.clause_ref)}" data-excerpt="${KredtUI.escapeHtml(f.clause_text_excerpt)}" style="margin-top:10px;">${KredtUI.icon('file', 13)}View Source Clause</button>
          </div>`).join('')}
      </div>

      <div class="card card-pad report-section">
        <h3>Financial Analysis</h3>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Metric</th><th>Value</th><th>Policy Threshold</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${report.financial_ratios.map((r) => `
                <tr>
                  <td style="font-weight:600; color:var(--color-navy);">${KredtUI.escapeHtml(r.name)}</td>
                  <td>${KredtUI.escapeHtml(r.value)}</td>
                  <td class="text-faint">${KredtUI.escapeHtml(r.policy_threshold)}</td>
                  <td>${KredtUI.flagBadge(r.flag)}</td>
                  <td><button type="button" class="evidence-link view-evidence-ratio" data-name="${KredtUI.escapeHtml(r.name)}" data-value="${KredtUI.escapeHtml(r.value)}">${KredtUI.icon('file', 13)}View Evidence</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card card-pad report-section">
        <h3>Transaction Analysis</h3>
        ${report.transaction_findings.length ? report.transaction_findings.map((t) => `
          <div class="finding-card accent-warning">
            <div class="finding-card-head">
              <div class="clause">${(t.type || '').toUpperCase()}</div>
              <span class="badge badge-warning">Flagged</span>
            </div>
            <div class="relevance">${KredtUI.escapeHtml(t.description)}</div>
            <button type="button" class="evidence-link view-evidence-txn" data-ref="${KredtUI.escapeHtml(t.evidence_ref)}" data-desc="${KredtUI.escapeHtml(t.description)}" style="margin-top:10px;">${KredtUI.icon('file', 13)}View Transaction Evidence</button>
          </div>`).join('') : `<p class="text-faint" style="font-size:14px;">No unusual transaction patterns were identified.</p>`}
      </div>

      <div class="card card-pad report-section">
        <h3>Credit Risk</h3>
        <div class="risk-card-grid">
          <div class="kv-item"><div class="kv-label">Risk Band</div><div class="kv-value">${KredtUI.riskBadge(report.risk_prediction.band)}</div></div>
          <div class="kv-item"><div class="kv-label">Probability of Default</div><div class="kv-value">${(report.risk_prediction.score * 100).toFixed(0)}%</div></div>
          <div class="kv-item"><div class="kv-label">Model Version</div><div class="kv-value">${KredtUI.escapeHtml(report.risk_prediction.model_version)}</div></div>
          <div class="kv-item"><div class="kv-label">Prediction Horizon</div><div class="kv-value">${report.risk_prediction.prediction_horizon.replace('_', ' ')}</div></div>
        </div>
        <hr class="divider">
        <div class="kv-label" style="margin-bottom:8px;">Model Inputs Used</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${report.risk_prediction.inputs_used.map((f) => `<span class="badge badge-neutral">${f.replace(/_/g, ' ')}</span>`).join('')}
        </div>
      </div>

      ${report.missing_information.length ? `
        <div class="card card-pad report-section">
          <h3>Missing Information</h3>
          <ul style="list-style: disc; padding-left: 20px;">
            ${report.missing_information.map((m) => `<li style="font-size:14px; margin-bottom:6px; color:var(--color-text-muted);">${KredtUI.escapeHtml(m)}</li>`).join('')}
          </ul>
        </div>` : ''}

      <div class="form-actions" style="border-top:none; padding-top:0;">
        <a href="detail.html?id=${app.id}" class="btn btn-secondary">Back to Application</a>
        <a href="assessment.html?id=${app.id}" class="btn btn-primary">Go to Assessment</a>
      </div>
    `);

    document.querySelectorAll('.view-evidence-policy').forEach((btn) => {
      btn.addEventListener('click', () => showEvidenceModal(btn.dataset.clause, `<em>"${KredtUI.escapeHtml(btn.dataset.excerpt)}"</em><p style="margin-top:10px;">Retrieved from the bank's lending policy library by the Policy RAG stage of the investigation pipeline.</p>`));
    });
    document.querySelectorAll('.view-evidence-ratio').forEach((btn) => {
      btn.addEventListener('click', () => showEvidenceModal(btn.dataset.name, `<p>Value: <strong>${KredtUI.escapeHtml(btn.dataset.value)}</strong></p><p style="margin-top:8px;">Calculated from the applicant's submitted financial statements and bank statements during the Financial Analysis stage.</p>`));
    });
    document.querySelectorAll('.view-evidence-txn').forEach((btn) => {
      btn.addEventListener('click', () => showEvidenceModal(`Transaction ${btn.dataset.ref}`, `<p>${KredtUI.escapeHtml(btn.dataset.desc)}</p><p style="margin-top:8px;">Identified from the applicant's uploaded bank statement during the Transaction Analysis stage.</p>`));
    });
  }

  async function render() {
    try {
      await KredtStore.init();
      const app = await KredtApi.applications.get(appId);
      KredtAnalystShell.setBreadcrumb(app.id, app.reference, 'Report');

      const job = await KredtApi.investigations.latestForApplication(appId);
      if (!job || job.status !== 'complete') {
        root.innerHTML = shellHTML(app, KredtUI.emptyState({
          icon: 'file', title: 'No report available yet',
          message: 'A report will be generated once an investigation has completed.',
          actionLabel: 'Go to Application', actionHref: `detail.html?id=${app.id}`,
        }));
        return;
      }

      const report = await KredtApi.reports.get(job.id);
      renderReport(app, report);
    } catch (err) {
      if (!err.expected) console.error(err); else console.warn(err.message);
      root.innerHTML = KredtUI.errorState({ message: "We couldn't load the investigation report." });
      document.getElementById('state-retry-btn')?.addEventListener('click', render);
    }
  }

  render();
})();
