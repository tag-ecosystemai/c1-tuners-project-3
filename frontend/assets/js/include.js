// KREDT — include.js
// Injects components/*.html into any page with <div data-include="name"></div>.
// Each page sets window.SITE_ROOT (path back to project root) before this runs.

(function () {
  if (window.location.protocol === 'file:') {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.innerHTML = `
        <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:#F5F7FA; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:24px;">
          <div style="max-width:480px; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:16px; padding:36px; text-align:center;">
            <div style="width:52px; height:52px; border-radius:14px; background:#FDECEC; color:#DC2626; display:flex; align-items:center; justify-content:center; font-size:22px; margin:0 auto 18px;">!</div>
            <h1 style="font-family:'Inter',sans-serif; font-size:20px; margin:0 0 10px; color:#142D4E;">This page needs a local server</h1>
            <p style="color:#334155; font-size:14px; line-height:1.6; margin:0 0 18px;">
              You opened this file directly (double-clicked it). Browsers block the app's
              data and navigation from loading that way. Run <strong>start-server.bat</strong>
              (Windows) or <strong>start-server.sh</strong> (Mac/Linux) in the project's root
              folder — see <strong>README.md</strong> — then open the
              <code>http://localhost:3000</code> address it gives you instead.
            </p>
          </div>
        </div>`;
    });
    window.__kredtFileProtocol = true;
  }

  const SITE_ROOT = window.SITE_ROOT || './';

  // Every page that declares a portal needs a signed-in user of that role.
  if (document.body && document.body.dataset.portal && window.KredtAuth) {
    if (!window.KredtAuth.guard(document.body.dataset.portal)) return;
  }

  function resolveTokens(html) {
    return html.replaceAll('{{ROOT}}', SITE_ROOT);
  }

  function setActiveNav() {
    const currentPage = document.body.dataset.page;
    if (!currentPage) return;
    document.querySelectorAll('[data-page]').forEach((link) => {
      if (link === document.body) return;
      link.classList.toggle('is-active', link.dataset.page === currentPage);
    });
  }

  function wireMobileToggle() {
    const toggle = document.querySelector('.mobile-sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (toggle && sidebar) {
      toggle.addEventListener('click', () => sidebar.classList.toggle('is-open'));
    }
  }

  function currentIdentity() {
    const u = window.KredtAuth && window.KredtAuth.current();
    if (u) return { name: u.full_name, email: u.email, initials: u.initials, role: u.role };
    return { name: 'Guest', email: '', initials: '?', role: '' };
  }

  // Fill any [data-user-*] placeholders in injected components, and point
  // profile / logout links at the right place for the signed-in role.
  function wireIdentity() {
    const id = currentIdentity();
    document.querySelectorAll('[data-user-name]').forEach((el) => { el.textContent = id.name; });
    document.querySelectorAll('[data-user-initials]').forEach((el) => { el.textContent = id.initials; });
    document.querySelectorAll('[data-user-role]').forEach((el) => { el.textContent = id.role === 'analyst' ? 'Credit Analyst' : 'Borrower'; });
    document.querySelectorAll('[data-profile-link]').forEach((el) => { el.href = `${SITE_ROOT}app/${id.role === 'analyst' ? 'analyst' : 'borrower'}/profile.html`; });
    document.querySelectorAll('[data-logout]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.KredtAuth.logout();
        window.location.href = `${SITE_ROOT}login.html`;
      });
    });
    const crumbs = document.querySelector('[data-breadcrumbs]');
    if (crumbs && !crumbs.innerHTML.trim() && document.body.dataset.title) {
      crumbs.innerHTML = `<span class="current">${document.body.dataset.title}</span>`;
    }
  }

  function wireUserDropdown() {
    const trigger = document.getElementById('user-menu-toggle');
    const dropdown = document.getElementById('user-menu-dropdown');
    const identity = currentIdentity();

    const nameEls = document.querySelectorAll('#topbar-user-name, #dropdown-name');
    nameEls.forEach((el) => { if (el) el.textContent = el.id === 'topbar-user-name' ? identity.name.split(' ')[0] : identity.name; });
    const emailEl = document.getElementById('dropdown-email');
    if (emailEl) emailEl.textContent = identity.email;
    const avatarEl = document.getElementById('topbar-avatar');
    if (avatarEl) avatarEl.textContent = identity.initials;

    if (!trigger || !dropdown) return;
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('is-open');
    });
    document.addEventListener('click', () => dropdown.classList.remove('is-open'));

    const notifToggle = document.getElementById('notif-toggle');
    notifToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.KredtUI) window.KredtUI.toast('No new notifications.');
    });
  }

  function wireOfflineBanner() {
    let banner = document.getElementById('offline-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'offline-banner';
      banner.className = 'offline-banner';
      banner.textContent = "You're offline — check your internet connection and try again.";
      document.body.prepend(banner);
    }
    const update = () => banner.classList.toggle('is-visible', !navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  async function includePartial(el) {
    const name = el.dataset.include;
    try {
      const res = await fetch(`${SITE_ROOT}components/${name}.html`);
      const html = await res.text();
      // Keep the host element when it carries its own layout class (e.g.
      // <header class="topbar">) — replacing it dropped that styling.
      if (el.className) { el.innerHTML = resolveTokens(html); el.removeAttribute('data-include'); }
      else el.outerHTML = resolveTokens(html);
    } catch (err) {
      console.error(`Failed to load component: ${name}`, err);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const includes = Array.from(document.querySelectorAll('[data-include]'));
    await Promise.all(includes.map(includePartial));
    if (window.KredtUI) window.KredtUI.hydrateIcons();
    setActiveNav();
    wireMobileToggle();
    wireIdentity();
    wireUserDropdown();
    wireOfflineBanner();
    document.dispatchEvent(new CustomEvent('kredt:shell-ready'));
  });
})();
