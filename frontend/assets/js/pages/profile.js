(function () {
  const me = KredtAuth.current();
  if (!me) return;
  const E = KredtUI.escapeHtml;
  const isBorrower = me.role === 'borrower';
  const p = me.profile || {};
  const mask = (last4) => (last4 ? `•••• ${E(last4)}` : '—');
  const row = (k, v) => `<div class="kv-item"><div class="kv-label">${k}</div><div class="kv-value">${v}</div></div>`;
  document.getElementById('page-root').innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div><h1>Profile</h1><p>${isBorrower ? 'Your account and verification details.' : 'Your account details.'}</p></div>
        ${isBorrower ? `<a href="${window.SITE_ROOT}complete-profile.html" class="btn btn-secondary">Update details</a>` : ''}
      </div>
    </div>
    <div class="card card-pad" style="margin-bottom:20px;">
      <h3 style="margin-bottom:16px;">Account</h3>
      <div class="kv-grid">
        ${row('Full name', E(me.full_name))}
        ${row('Email', E(me.email))}
        ${row('Role', me.role === 'analyst' ? 'Credit Analyst' : 'Borrower')}
      </div>
    </div>
    ${isBorrower ? `<div class="card card-pad">
      <h3 style="margin-bottom:16px;">Verification</h3>
      <div class="kv-grid">
        ${row('Phone', E(p.phone || '—'))}
        ${row('NIN', mask(p.nin_last4))}
        ${row('BVN', mask(p.bvn_last4))}
        ${row('Bank', E(p.bank || '—'))}
        ${row('Account name', E(p.account_name || '—'))}
        ${row('Account number', mask(p.account_last4))}
        ${row('Status', '<span class="badge badge-success"><span class="badge-dot"></span>Verified</span>')}
      </div>
    </div>` : `<div class="card card-pad"><p style="margin:0; font-size:14px; color:var(--color-text-faint);">Your analyst account is managed by your organisation. Contact your Kredt administrator to change your details or reset your password.</p></div>`}`;
})();
