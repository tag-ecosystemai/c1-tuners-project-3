// KREDT — shared UI helpers used across every page.

const KredtUI = (() => {
  const STATUS_LABELS = {
    draft: 'Draft',
    submitted: 'Submitted',
    under_review: 'Under Review',
    investigation_in_progress: 'Investigation in Progress',
    investigation_complete: 'Investigation Complete',
    additional_info_requested: 'Additional Information Requested',
    decided: 'Decided',
  };

  // Borrowers see plain-language labels; the analyst workspace keeps the full set.
  const BORROWER_STATUS_LABELS = {
    ...STATUS_LABELS,
    additional_info_requested: 'Action Required',
    decided: 'Decision Made',
  };

  const STATUS_BADGE_CLASS = {
    draft: 'badge-neutral',
    submitted: 'badge-info',
    under_review: 'badge-warning',
    investigation_in_progress: 'badge-info',
    investigation_complete: 'badge-success',
    additional_info_requested: 'badge-warning',
    decided: 'badge-neutral',
  };

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // audience: 'analyst' (default) or 'borrower'
  function statusLabel(status, audience = 'analyst') {
    const map = audience === 'borrower' ? BORROWER_STATUS_LABELS : STATUS_LABELS;
    return map[status] || status;
  }

  function statusBadge(status, audience = 'analyst') {
    const cls = STATUS_BADGE_CLASS[status] || 'badge-neutral';
    return `<span class="badge ${cls}"><span class="badge-dot"></span>${escapeHtml(statusLabel(status, audience))}</span>`;
  }

  function demoBadge() {
    return `<span class="badge badge-demo">DEMO</span>`;
  }

  function flagBadge(flag) {
    const map = {
      within_policy: ['badge-success', 'Within Policy'],
      attention: ['badge-warning', 'Attention'],
      breach: ['badge-error', 'Breach'],
    };
    const [cls, label] = map[flag] || ['badge-neutral', flag];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function riskBadge(band) {
    const map = {
      low: ['badge-success', 'Low Risk'],
      medium: ['badge-warning', 'Medium Risk'],
      high: ['badge-error', 'High Risk'],
    };
    const [cls, label] = map[(band || '').toLowerCase()] || ['badge-neutral', band];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function currency(amount, code = 'NGN') {
    if (amount === null || amount === undefined || amount === '') return '—';
    // U+202F (narrow no-break space) keeps the Naira sign's strokes from
    // visually running into the first digit at bold weight / tight
    // tracking — plain text, so it's safe wherever this is assigned via
    // .textContent as well as innerHTML.
    const symbol = code === 'NGN' ? '\u20a6\u202f' : `${code} `;
    return `${symbol}${Number(amount).toLocaleString('en-NG')}`;
  }

  function formatDate(iso, opts = {}) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', ...opts });
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${formatDate(iso)} — ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function timeAgo(iso) {
    if (!iso) return '—';
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  // ---------- Toasts ----------
  function ensureToastStack() {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }

  function toast(message, type = 'default', duration = 3200) {
    const stack = ensureToastStack();
    const el = document.createElement('div');
    el.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .2s ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 200);
    }, duration);
  }

  // ---------- Confirmation modal ----------
  function confirmModal({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay is-open';
      overlay.innerHTML = `
        <div class="modal-box" role="dialog" aria-modal="true">
          <h3>${escapeHtml(title)}</h3>
          <p>${message}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-action="cancel">${escapeHtml(cancelLabel)}</button>
            <button type="button" class="btn ${destructive ? 'btn-destructive-solid' : 'btn-primary'}" data-action="confirm">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      function close(result) {
        overlay.remove();
        resolve(result);
      }
      overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
      overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
      document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', escHandler); }
      });
    });
  }

  // ---------- Loading / empty / error state blocks ----------
  function skeletonRows(n = 4) {
    return Array.from({ length: n }).map(() => `<div class="skeleton skeleton-row"></div>`).join('');
  }


  // ---------- Icons (stroke set, 24px grid) ----------
  const ICON_PATHS = {
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
    inbox: '<path d="M3 13l2.6-7.2A2 2 0 0 1 7.5 4.5h9a2 2 0 0 1 1.9 1.3L21 13"/><path d="M3 13v4.5A2 2 0 0 0 5 19.5h14a2 2 0 0 0 2-2V13h-5.2a1.5 1.5 0 0 0-1.4 1l-.2.5a1.5 1.5 0 0 1-1.4 1h-1.6a1.5 1.5 0 0 1-1.4-1l-.2-.5a1.5 1.5 0 0 0-1.4-1z"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    logout: '<path d="M9 21H5.5A2.5 2.5 0 0 1 3 18.5v-13A2.5 2.5 0 0 1 5.5 3H9"/><path d="M16 16.5l4.5-4.5L16 7.5"/><path d="M20.5 12H9"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9"/><path d="M10.2 20.5a2 2 0 0 0 3.6 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 1.8"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20.5 20.5l-4.2-4.2"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.4l2.8 2.8L16.2 9.6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    tick: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    upload: '<path d="M12 16V4.5"/><path d="M7.5 9L12 4.5 16.5 9"/><path d="M4.5 15.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    pen: '<path d="M4 20h4L19 9a2.8 2.800 0 0 0-4-4L4 16z"/>',
    alert: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.500v.01"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    idcard: '<rect x="3" y="5" width="18" height="14" rx="2.2"/><circle cx="8.5" cy="12" r="2"/><path d="M13 10h5M13 14.2h3.2"/>',
    home: '<path d="M4 11.2L12 4l8 7.2"/><path d="M6 10v8.5a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1V10"/>',
    briefcase: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8.2 8V6.2a2 2 0 0 1 2-2h3.6a2 2 0 0 1 2 2V8"/><path d="M3 13.2h18"/>',
    close: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    refresh: '<path d="M19.8 11A7.8 7.8 0 1 0 18.6 15.2"/><path d="M20 5.5v6h-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.3M12 7.7v.01"/>',
  };

  function icon(name, size = 18) {
    const p = ICON_PATHS[name] || '';
    return `<svg class="icon-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  }

  // Replaces <i data-icon="grid" data-size="18"></i> placeholders (used in injected partials).
  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      if (el.dataset.iconReady) return;
      el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 18);
      el.dataset.iconReady = '1';
    });
  }
  document.addEventListener('DOMContentLoaded', () => hydrateIcons());

  function emptyState({ icon: iconName = 'file', title, message, actionLabel, actionHref }) {
    return `
      <div class="state-block">
        <div class="state-icon state-icon-empty">${iconName.length > 2 ? icon(iconName, 22) : iconName}</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        ${actionLabel ? `<a href="${actionHref}" class="btn btn-primary">${escapeHtml(actionLabel)}</a>` : ''}
      </div>`;
  }

  function errorState({ title = 'Something went wrong', message, retryId = 'state-retry-btn' }) {
    return `
      <div class="state-block">
        <div class="state-icon state-icon-error">${icon('alert', 22)}</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <button type="button" class="btn btn-secondary" id="${retryId}">Retry</button>
      </div>`;
  }

  return {
    escapeHtml, statusLabel, statusBadge, demoBadge, flagBadge, riskBadge,
    currency, formatDate, formatDateTime, timeAgo,
    toast, confirmModal, skeletonRows, emptyState, errorState,
    icon, hydrateIcons,
  };
})();

window.KredtUI = KredtUI; // lets include.js show toasts (top-level const is not a window property)
