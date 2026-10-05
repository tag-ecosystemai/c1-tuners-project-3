(function () {
  const appId = new URLSearchParams(window.location.search).get('id');
  const root = document.getElementById('page-root');

  function docIconLabel(type) {
    const map = { bank_statement: 'STMT', financial_statement: 'FIN', business_registration: 'REG', loan_schedule: 'SCH', tax_document: 'TAX' };
    return map[type] || 'DOC';
  }

  function docTypeLabel(type) {
    return (type || '').split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  async function render() {
    try {
      await KredtStore.init();
      const app = await KredtApi.applications.get(appId);
      const docs = await KredtApi.documents.list(appId);
      KredtAnalystShell.setBreadcrumb(app.id, app.reference, 'Documents');

      root.innerHTML = `
        ${app.is_demo ? `<div class="demo-banner demo-banner-inset">FICTIONAL DEMO DATA</div>` : ''}
        <div class="page-header">
          <h1>Documents</h1>
          <p>Application #${KredtUI.escapeHtml(app.reference)}</p>
        </div>
        ${KredtAnalystShell.tabsHTML(app.id, 'documents', app)}

        ${docs.length === 0 ? KredtUI.emptyState({
          icon: 'file', title: 'No documents uploaded',
          message: 'Documents submitted with this application will appear here.',
        }) : `
        <div class="doc-viewer-layout">
          <div class="card card-pad doc-list-panel">
            <h3 style="margin-bottom:14px; font-size:14px;">Submitted Documents</h3>
            <div class="doc-list" id="doc-list">
              ${docs.map((d, i) => `
                <div class="doc-row ${i === 0 ? 'is-active' : ''}" data-doc-id="${d.id}">
                  <div class="doc-icon">${docIconLabel(d.document_type)}</div>
                  <div class="doc-info">
                    <div class="doc-name">${KredtUI.escapeHtml(d.file_name)}</div>
                    <div class="doc-meta">${d.file_size} • ${KredtUI.formatDate(d.uploaded_at)}</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>
          <div class="card doc-preview" id="doc-preview"></div>
        </div>
        <div class="form-actions" style="border-top:none; padding-top:0;">
          <a href="detail.html?id=${app.id}" class="btn btn-secondary">Back to Application</a>
        </div>
        `}
      `;

      if (docs.length) {
        const preview = document.getElementById('doc-preview');
        function showPreview(doc) {
          preview.innerHTML = `
            <div class="doc-preview-icon">▤</div>
            <h3 style="color:var(--color-navy);">${KredtUI.escapeHtml(doc.file_name)}</h3>
            <p>${docTypeLabel(doc.document_type)} • ${doc.file_size}</p>
            <p style="font-size:12.5px;">Uploaded ${KredtUI.formatDateTime(doc.uploaded_at)}</p>
            <p style="font-size:12.5px; max-width:340px;">Document preview will render here once the backend's file-serving endpoint is available. Metadata shown reflects the current API contract.</p>`;
        }
        showPreview(docs[0]);
        document.querySelectorAll('#doc-list .doc-row').forEach((row) => {
          row.addEventListener('click', () => {
            document.querySelectorAll('#doc-list .doc-row').forEach((r) => r.classList.remove('is-active'));
            row.classList.add('is-active');
            const doc = docs.find((d) => d.id === row.dataset.docId);
            showPreview(doc);
          });
        });
      }
    } catch (err) {
      if (!err.expected) console.error(err); else console.warn(err.message);
      root.innerHTML = KredtUI.errorState({ message: "We couldn't load the documents." });
      document.getElementById('state-retry-btn')?.addEventListener('click', render);
    }
  }

  render();
})();
