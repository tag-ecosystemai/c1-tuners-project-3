(function () {
  const appId = new URLSearchParams(window.location.search).get('id');
  const root = document.getElementById('page-root');

  async function render() {
    try {
      await KredtStore.init();
      const app = await KredtApi.applications.get(appId);
      const events = await KredtApi.audit.get(appId);
      KredtAnalystShell.setBreadcrumb(app.id, app.reference, 'Audit Log');

      function actorTone(actor) {
        if (/\(Analyst\)/i.test(actor)) return { cls: 'tone-teal', icon: 'user' };
        if (/\(Borrower\)/i.test(actor)) return { cls: 'tone-info', icon: 'user' };
        return { cls: 'tone-navy', icon: 'layers' };
      }

      root.innerHTML = `
        ${app.is_demo ? `<div class="demo-banner demo-banner-inset">FICTIONAL DEMO DATA</div>` : ''}
        <div class="page-header">
          <h1>Audit Log</h1>
          <p>Chronological event history for Application #${KredtUI.escapeHtml(app.reference)}</p>
        </div>
        ${KredtAnalystShell.tabsHTML(app.id, 'audit', app)}
        <div class="card card-pad">
          ${events.length ? `<div class="audit-timeline">${events.map((e) => {
            const tone = actorTone(e.actor);
            return `
            <div class="audit-timeline-item">
              <div class="audit-timeline-marker ${tone.cls}">${KredtUI.icon(tone.icon, 15)}</div>
              <div class="audit-timeline-content">
                <div class="audit-timeline-head">
                  <span class="event">${KredtUI.escapeHtml(e.event)}</span>
                  <span class="audit-time">${KredtUI.formatDateTime(e.timestamp)}</span>
                </div>
                <div class="actor">${KredtUI.escapeHtml(e.actor)}</div>
              </div>
            </div>`;
          }).join('')}</div>` : `<p class="text-faint" style="font-size:14px;">No events recorded yet.</p>`}
        </div>
        <div class="form-actions" style="border-top:none; padding-top:16px;">
          <a href="detail.html?id=${app.id}" class="btn btn-secondary">Back to Application</a>
        </div>`;
    } catch (err) {
      if (!err.expected) console.error(err); else console.warn(err.message);
      root.innerHTML = KredtUI.errorState({ message: "We couldn't load the audit log." });
      document.getElementById('state-retry-btn')?.addEventListener('click', render);
    }
  }

  render();
})();
