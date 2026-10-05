(function () {
  const me = KredtAuth.current();
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const title = document.getElementById('greeting-title');
  if (title && me) title.textContent = `${part}, ${me.first_name}`;
})();
(async function () {
  const $ = (id) => document.getElementById(id);
  const E = KredtUI.escapeHtml;
  const nameOf = (a) => a.applicant_details?.business_name || a.applicant_details?.full_name || '—';

  const AWAITING = ['submitted', 'under_review'];
  const ACTIONABLE = ['submitted', 'under_review', 'investigation_complete', 'additional_info_requested'];
  const NEXT_STEP = {
    submitted: 'Review application',
    under_review: 'Start investigation',
    investigation_complete: 'Assess report',
    additional_info_requested: 'Awaiting borrower',
  };

  function kpiHTML(apps) {
    const count = (list) => apps.filter((a) => list.includes(a.status)).length;
    const cards = [
      { icon: 'layers', tone: 'navy', value: apps.length, label: 'Total applications', sub: 'Across every status' },
      { icon: 'clock', tone: 'amber', value: count(AWAITING), label: 'Awaiting review', sub: 'Waiting for an analyst' },
      { icon: 'search', tone: 'teal', value: count(['investigation_in_progress']), label: 'In investigation', sub: 'Pipeline is running' },
      { icon: 'check', tone: 'green', value: count(['investigation_complete']), label: 'Ready to assess', sub: 'Report is ready to read' },
    ];
    return cards.map((c) => `
      <div class="card kpi-card">
        <div class="kpi-top"><span class="kpi-icon tone-${c.tone}">${KredtUI.icon(c.icon, 19)}</span></div>
        <div class="kpi-value">${c.value}</div>
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-sub">${c.sub}</div>
      </div>`).join('');
  }

  function statusChart(apps) {
    const order = ['submitted', 'under_review', 'investigation_in_progress', 'investigation_complete', 'additional_info_requested', 'decided'];
    const data = order.map((s) => ({
      label: KredtUI.statusLabel(s),
      value: apps.filter((a) => a.status === s).length,
      color: KredtCharts.STATUS_COLORS[s],
    }));
    return KredtCharts.donut({ data, centerLabel: 'applications' });
  }

  function monthlyChart(apps) {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-GB', { month: 'short' }), value: 0 };
    });
    apps.forEach((a) => {
      const d = new Date(a.created_at);
      const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) m.value += 1;
    });
    return KredtCharts.bars({ data: months });
  }

  function amountsChart(apps) {
    const millions = apps.map((a) => (a.requested_amount || 0) / 1e6);
    const sorted = [...millions].sort((a, b) => a - b);
    const median = sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2 : 0;
    $('hist-sub').textContent = apps.length ? `Median request ${KredtUI.currency(median * 1e6, 'NGN')}, grouped in ₦5M bands` : 'How large the requests are';
    return KredtCharts.histogram({ values: millions, binSize: 5, height: 268, formatEdge: (v) => (v === 0 ? '₦0' : `₦${v}M`) });
  }

  function attentionHTML(apps) {
    const list = apps.filter((a) => ACTIONABLE.includes(a.status))
      .sort((a, b) => new Date(a.submitted_at || a.created_at) - new Date(b.submitted_at || b.created_at))
      .slice(0, 5);
    if (!list.length) {
      return `<div class="attn-empty"><span class="kpi-icon tone-green">${KredtUI.icon('check', 19)}</span><strong>You're all caught up</strong><span>Nothing is waiting on you right now.</span></div>`;
    }
    return `<ul class="attn-list">${list.map((a) => `
      <li><a class="attn-row" href="applications/detail.html?id=${a.id}">
        <span class="attn-avatar">${E(nameOf(a).trim().charAt(0).toUpperCase())}</span>
        <span class="attn-main">
          <span class="attn-name">${E(nameOf(a))}</span>
          <span class="attn-meta">${E(a.reference)} · ${KredtUI.currency(a.requested_amount, a.currency)}</span>
        </span>
        <span class="attn-action">${NEXT_STEP[a.status]}${KredtUI.icon('arrow', 14)}</span>
      </a></li>`).join('')}</ul>`;
  }

  function rowHTML(app) {
    return `<tr class="is-clickable" data-href="applications/detail.html?id=${app.id}">
      <td class="cell-ref">${E(app.reference)} ${app.is_demo ? KredtUI.demoBadge() : ''}</td>
      <td>${E(nameOf(app))}</td>
      <td>${app.loan_type === 'business' ? 'Business' : 'Individual'}</td>
      <td class="cell-num">${KredtUI.currency(app.requested_amount, app.currency)}</td>
      <td>${KredtUI.statusBadge(app.status)}</td>
      <td class="cell-date">${KredtUI.formatDate(app.created_at)}</td>
    </tr>`;
  }

  async function load() {
    try {
      await KredtStore.init();
      const apps = await KredtApi.applications.getAll();

      $('summary-cards').innerHTML = kpiHTML(apps);
      $('chart-status').innerHTML = statusChart(apps);
      $('chart-monthly').innerHTML = monthlyChart(apps);
      $('chart-amounts').innerHTML = amountsChart(apps);
      $('attention-region').innerHTML = attentionHTML(apps);

      const recent = [...apps].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
      const recentEl = $('recent-region');
      if (!recent.length) {
        recentEl.innerHTML = KredtUI.emptyState({ title: 'No applications found', message: 'Applications will appear here once submitted.' });
        return;
      }
      recentEl.innerHTML = `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Reference</th><th>Applicant</th><th>Loan type</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>${recent.map(rowHTML).join('')}</tbody>
      </table></div>`;
      recentEl.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => { window.location.href = tr.dataset.href; }));
    } catch (err) {
      console.error(err);
      $('summary-cards').innerHTML = '';
      $('recent-region').innerHTML = KredtUI.errorState({ message: "We couldn't load the applications." });
      document.getElementById('state-retry-btn')?.addEventListener('click', load);
    }
  }

  load();
})();
