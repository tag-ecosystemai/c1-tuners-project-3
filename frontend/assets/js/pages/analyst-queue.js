(function () {
  const tableRegion = document.getElementById('table-region');
  const statusEl = document.getElementById('f-status');
  const typeEl = document.getElementById('f-type');
  const demoEl = document.getElementById('f-demo');
  const fromEl = document.getElementById('f-from');
  const toEl = document.getElementById('f-to');
  const searchEl = document.getElementById('f-search');

  function currentFilters() {
    return {
      status: statusEl.value,
      loan_type: typeEl.value,
      demo: demoEl.value,
      from_date: fromEl.value || null,
      to_date: toEl.value || null,
      search: searchEl.value.trim(),
    };
  }

  function hasActiveFilters(f) {
    return f.status !== 'all' || f.loan_type !== 'all' || f.demo !== 'all' || f.from_date || f.to_date || f.search;
  }

  function clearFilters() {
    statusEl.value = 'all'; typeEl.value = 'all'; demoEl.value = 'all'; fromEl.value = ''; toEl.value = ''; searchEl.value = '';
    render();
  }

  function rowHTML(app) {
    return `<tr class="is-clickable" data-href="applications/detail.html?id=${app.id}">
      <td class="cell-ref">${KredtUI.escapeHtml(app.reference)} ${app.is_demo ? KredtUI.demoBadge() : ''}</td>
      <td>${KredtUI.escapeHtml(app.applicant_details?.business_name || app.applicant_details?.full_name || '—')}</td>
      <td>${app.loan_type === 'business' ? 'Business' : 'Individual'}</td>
      <td>${KredtUI.currency(app.requested_amount, app.currency)}</td>
      <td>${KredtUI.statusBadge(app.status)}</td>
      <td>${KredtUI.formatDate(app.created_at)}</td>
      <td><a href="applications/detail.html?id=${app.id}" class="btn btn-secondary btn-sm">View</a></td>
    </tr>`;
  }

  let loadToken = 0;

  async function render() {
    const token = ++loadToken;
    tableRegion.innerHTML = `<div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>`;
    try {
      await KredtStore.init();
      const filters = currentFilters();
      const apps = await KredtApi.applications.getAll(filters);
      if (token !== loadToken) return;

      if (!apps.length) {
        tableRegion.innerHTML = `
          <div class="state-block">
            <div class="state-icon state-icon-empty">▤</div>
            <h3>No applications found</h3>
            <p>${hasActiveFilters(filters) ? 'Try changing your filters or search criteria.' : 'Applications will appear here once submitted.'}</p>
            ${hasActiveFilters(filters) ? '<button type="button" class="btn btn-secondary" id="clear-filters-btn">Clear Filters</button>' : ''}
          </div>`;
        document.getElementById('clear-filters-btn')?.addEventListener('click', clearFilters);
        return;
      }

      tableRegion.innerHTML = `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Reference</th><th>Applicant</th><th>Loan Type</th><th>Amount</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
        <tbody>${apps.map(rowHTML).join('')}</tbody>
      </table></div>`;
      tableRegion.querySelectorAll('tr[data-href]').forEach((tr) => {
        tr.addEventListener('click', (e) => {
          if (e.target.closest('a')) return;
          window.location.href = tr.dataset.href;
        });
      });
    } catch (err) {
      console.error(err);
      if (token !== loadToken) return;
      tableRegion.innerHTML = KredtUI.errorState({ message: "We couldn't load the applications." });
      document.getElementById('state-retry-btn')?.addEventListener('click', render);
    }
  }

  [statusEl, typeEl, demoEl, fromEl, toEl].forEach((el) => el.addEventListener('change', render));
  let searchTimer;
  searchEl.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(render, 300); });

  render();
})();
