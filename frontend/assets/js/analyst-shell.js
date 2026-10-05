// KREDT — shared helpers for analyst application sub-pages
// (Application Details, Documents, Investigate, Report, Assessment, Audit Log)

const KredtAnalystShell = (() => {
  const TABS = [
    { key: 'details', label: 'Application', href: (id) => `detail.html?id=${id}` },
    { key: 'documents', label: 'Documents', href: (id) => `documents.html?id=${id}` },
    { key: 'investigate', label: 'Investigation', href: (id) => `investigate.html?id=${id}` },
    { key: 'report', label: 'Report', href: (id) => `report.html?id=${id}` },
    { key: 'assessment', label: 'Assessment', href: (id) => `assessment.html?id=${id}` },
    { key: 'audit', label: 'Audit Log', href: (id) => `audit.html?id=${id}` },
  ];

  // The investigation flow is linear: a step opens only once the one before
  // it has happened. Details, Documents and Audit Log are always available.
  const AFTER_INVESTIGATION_STARTED = ['investigation_in_progress', 'investigation_complete', 'additional_info_requested', 'decided'];
  const AFTER_REPORT_READY = ['investigation_complete', 'additional_info_requested', 'decided'];
  const GATES = {
    investigate: { statuses: AFTER_INVESTIGATION_STARTED, hint: 'Start the investigation from the Application tab first' },
    report: { statuses: AFTER_REPORT_READY, hint: 'Available once the investigation is complete' },
    assessment: { statuses: AFTER_REPORT_READY, hint: 'Available once the investigation is complete' },
  };

  function tabsHTML(appId, activeKey, app) {
    return `<nav class="app-tabs">${TABS.map((t) => {
      const gate = GATES[t.key];
      const locked = gate && app && t.key !== activeKey && !gate.statuses.includes(app.status);
      if (locked) return `<span class="app-tab is-locked" title="${gate.hint}" aria-disabled="true">${t.label}</span>`;
      return `<a class="app-tab ${t.key === activeKey ? 'is-active' : ''}" href="${t.href(appId)}">${t.label}</a>`;
    }).join('')}</nav>`;
  }

  function applyBreadcrumb(appId, reference, currentLabel) {
    const el = document.querySelector('[data-breadcrumbs]');
    if (!el) return false;
    el.innerHTML = `<a href="../queue.html">Applications</a> <span class="sep">/</span> <a href="detail.html?id=${appId}">${reference}</a> <span class="sep">/</span> <span class="current">${currentLabel}</span>`;
    return true;
  }

  // The topbar (and its [data-breadcrumbs] element) is injected
  // asynchronously by include.js. Page scripts call this as soon as their
  // data has loaded, which in practice is almost always after the topbar
  // has already been injected — but that ordering isn't guaranteed (e.g.
  // once mock API delays are removed in favour of a fast real backend).
  // Retry once via the shell-ready event rather than silently no-opping.
  function setBreadcrumb(appId, reference, currentLabel) {
    if (applyBreadcrumb(appId, reference, currentLabel)) return;
    document.addEventListener('kredt:shell-ready', () => applyBreadcrumb(appId, reference, currentLabel), { once: true });
  }

  // Small read-only dialog used to show where a finding came from.
  function showEvidence(title, bodyHTML) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay is-open';
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <h3>${KredtUI.escapeHtml(title)}</h3>
        <div style="font-size:14px; color:var(--color-text-muted); line-height:1.6;">${bodyHTML}</div>
        <div class="modal-actions"><button type="button" class="btn btn-primary" data-close>Close</button></div>
      </div>`;
    document.body.appendChild(overlay);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
  }

  return { tabsHTML, setBreadcrumb, showEvidence };
})();
