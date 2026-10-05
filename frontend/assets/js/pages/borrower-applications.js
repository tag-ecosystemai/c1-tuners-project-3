(async function () {
  const region = document.getElementById('applications-region');

  const STEP_NAMES = ['Submitted', 'Review', 'Investigation', 'Complete', 'Decision'];
  function journeyHTML(app) {
    const at = JOURNEY[app.status] || 0;
    return `<div class="journey" aria-label="Progress: step ${at} of 5">
      <div class="journey-bar">${STEP_NAMES.map((n, i) => `<span class="${i < at ? 'is-on' : ''} ${app.status === 'additional_info_requested' && i === at - 1 ? 'is-warn' : ''}"></span>`).join('')}</div>
      <div class="journey-label">Step ${at} of 5 · ${STEP_NAMES[at - 1]}</div>
    </div>`;
  }

  function cardHTML(app) {
    const title = app.loan_type === 'business' ? 'Business Loan' : 'Individual Loan';
    const isDraft = app.status === 'draft';
    const detailHref = isDraft
      ? `applications/new.html?id=${app.id}`
      : `applications/detail.html?id=${app.id}`;
    return `
      <div class="card app-card">
        <div class="app-card-top">
          <div class="app-head">
            <span class="app-type-icon">${KredtUI.icon(app.loan_type === 'business' ? 'layers' : 'user', 18)}</span>
            <div>
              <div class="app-title">${title}</div>
              <div class="app-ref">#${KredtUI.escapeHtml(app.reference)}</div>
            </div>
          </div>
          ${KredtUI.statusBadge(app.status, 'borrower')}
        </div>
        <div class="app-amount">${KredtUI.currency(app.requested_amount, app.currency)}</div>
        ${isDraft ? '<div class="journey-note">Not submitted yet</div>' : journeyHTML(app)}
        <div class="app-card-footer">
          <span class="date">${isDraft ? 'Started' : 'Submitted'} ${KredtUI.formatDate(app.submitted_at || app.created_at)}</span>
          <a href="${detailHref}" class="app-card-link">${isDraft ? 'Continue Application' : 'View Application'} ${KredtUI.icon('arrow', 14)}</a>
        </div>
      </div>`;
  }

  // Landing here after "Save Draft" on the application form.
  if (new URLSearchParams(window.location.search).get('saved') === 'draft') {
    KredtUI.toast('Draft saved. You can continue it any time.', 'success');
    history.replaceState(null, '', window.location.pathname);
  }

  const me = KredtAuth.current();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const titleEl = document.getElementById('welcome-title');
  if (titleEl && me) titleEl.textContent = `${greet}, ${me.first_name}`;
  document.getElementById('start-new-btn').innerHTML = `${KredtUI.icon('plus', 16)} Start New Application`;

  const ACTIVE = ['submitted', 'under_review', 'investigation_in_progress', 'investigation_complete', 'additional_info_requested'];
  // Position on the five-step journey; drafts haven't started it.
  const JOURNEY = { submitted: 1, under_review: 2, additional_info_requested: 2, investigation_in_progress: 3, investigation_complete: 4, decided: 5 };

  function statsHTML(apps) {
    const tiles = [
      { icon: 'layers', tone: 'navy', value: apps.length, label: 'Total applications' },
      { icon: 'clock', tone: 'teal', value: apps.filter((a) => ACTIVE.includes(a.status)).length, label: 'Active' },
      { icon: 'check', tone: 'green', value: apps.filter((a) => a.status === 'decided').length, label: 'Completed' },
      { icon: 'pen', tone: 'amber', value: apps.filter((a) => a.status === 'draft').length, label: 'Drafts' },
    ];
    return tiles.map((t) => `
      <div class="card stat-tile">
        <span class="kpi-icon tone-${t.tone}">${KredtUI.icon(t.icon, 18)}</span>
        <div><div class="stat-value">${t.value}</div><div class="stat-label">${t.label}</div></div>
      </div>`).join('');
  }

  async function load() {
    region.innerHTML = `<div class="applications-grid"><div class="skeleton skeleton-row" style="height:150px;"></div><div class="skeleton skeleton-row" style="height:150px;"></div></div>`;
    try {
      await KredtStore.init();
      const apps = await KredtApi.applications.getMine(me.id);
      if (!apps.length) {
        region.innerHTML = KredtUI.emptyState({
          icon: 'inbox',
          title: 'No applications yet',
          message: 'Start your first loan application and track it here.',
          actionLabel: 'Start Application',
          actionHref: 'applications/new.html',
        });
        return;
      }
      apps.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      document.getElementById('stat-row').innerHTML = statsHTML(apps);
      document.getElementById('apps-title').hidden = false;
      region.innerHTML = `<div class="applications-grid">${apps.map(cardHTML).join('')}</div>`;
    } catch (err) {
      console.error(err);
      region.innerHTML = KredtUI.errorState({ message: "We couldn't load your applications." });
      document.getElementById('state-retry-btn')?.addEventListener('click', load);
    }
  }

  load();
})();
