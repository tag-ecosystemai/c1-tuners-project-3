// Investigation workspace — one workspace, six stage screens.
//
// The backend runs the pipeline automatically; the analyst observes it.
//   - The stage rail shows every stage's state at a glance.
//   - A completed stage can be opened and inspected at any time.
//   - A stage that hasn't finished yet can't be opened (it's locked).
//   - Until the analyst picks a stage, the page follows the live one.
//   - ?stage=<name> deep-links to a stage (only honoured once it's complete).
(function () {
  const params = new URLSearchParams(window.location.search);
  const appId = params.get('id');
  const root = document.getElementById('page-root');
  const E = KredtUI.escapeHtml;
  const STAGES = KredtApi.STAGE_ORDER;

  const META = {
    validation: {
      question: 'Is this application complete and valid enough to investigate?',
      running: 'Checking application information and submitted documents...',
    },
    policy_retrieval: {
      question: 'Which lending policy clauses apply to this application?',
      running: 'Retrieving the relevant lending policy clauses...',
    },
    financial_analysis: {
      question: 'What do the applicant’s numbers show?',
      running: 'Calculating financial ratios from the submitted figures...',
    },
    transaction_analysis: {
      question: 'Is there any unusual activity in the transactions?',
      running: 'Reviewing transaction activity for unusual patterns...',
    },
    risk_prediction: {
      question: 'What does the credit-risk model predict?',
      running: 'Running the credit-risk model...',
    },
    report_generation: {
      question: 'Is the evidence-backed report ready?',
      running: 'Generating evidence-backed report...',
    },
  };

  const FLAG = {
    within_policy: { label: 'Pass', cls: 'badge-success' },
    attention: { label: 'Review', cls: 'badge-warning' },
    breach: { label: 'Breach', cls: 'badge-error' },
  };
  const RESULT = {
    PASS: { label: 'Pass', cls: 'badge-success', accent: 'accent-success' },
    REQUIRES_REVIEW: { label: 'Requires review', cls: 'badge-warning', accent: 'accent-warning' },
    FAIL: { label: 'Fail', cls: 'badge-error', accent: 'accent-error' },
  };
  const BAND = { low: 'Low', medium: 'Medium', high: 'High' };

  let app = null;
  let job = null;
  let selected = null;
  let pinned = false;        // true once the analyst chooses a stage themselves
  let lastSignature = '';
  let pollTimer = null;
  let renderToken = 0;

  const idx = (name) => STAGES.indexOf(name);
  const stageOf = (name) => job.stages.find((s) => s.name === name);
  const liveStageName = () => (job.status === 'complete' ? 'report_generation' : (job.stages.find((s) => s.status === 'running') || job.stages[0]).name);
  const openable = (name) => ['complete', 'running'].includes(stageOf(name)?.status);

  // ---------- Shell ----------
  function shell(body) {
    return `
      ${app.is_demo ? `<div class="demo-banner demo-banner-inset">FICTIONAL DEMO DATA</div>` : ''}
      <div class="page-header">
        <h1>Investigation</h1>
        <p>${E(app.reference)} • ${E(app.applicant_details?.business_name || app.applicant_details?.full_name || '')}</p>
      </div>
      ${KredtAnalystShell.tabsHTML(app.id, 'investigate', app)}
      ${body}`;
  }

  function railHTML() {
    const done = job.stages.filter((s) => s.status === 'complete').length;
    return `
      <aside class="card inv-rail" aria-label="Investigation stages">
        <div class="inv-rail-head">
          <div class="inv-rail-title">Investigation stages</div>
          <div class="inv-rail-count">${done} of ${STAGES.length} complete</div>
          <div class="inv-rail-bar"><span style="width:${(done / STAGES.length) * 100}%"></span></div>
        </div>
        <ol class="inv-rail-list">
          ${job.stages.map((s, i) => {
            const can = openable(s.name);
            const sub = s.status === 'complete' ? 'Complete' : s.status === 'running' ? 'In progress' : 'Waiting';
            const marker = s.status === 'complete' ? KredtUI.icon('tick', 14) : s.status === 'running' ? '<span class="spinner"></span>' : `<span>${i + 1}</span>`;
            return `
            <li>
              <button type="button" class="inv-rail-item is-${s.status} ${s.name === selected ? 'is-selected' : ''}" data-stage="${s.name}" ${can ? '' : 'disabled aria-disabled="true" title="Available once this stage has run"'}>
                <span class="inv-marker">${marker}</span>
                <span class="inv-rail-text"><span class="inv-rail-num">0${i + 1}</span> <span class="inv-rail-label">${E(s.label)}</span><span class="inv-rail-sub">${sub}</span></span>
              </button>
            </li>`;
          }).join('')}
        </ol>
        <div class="inv-rail-links">
          <a href="detail.html?id=${app.id}">${KredtUI.icon('file', 15)}Application</a>
          ${job.status === 'complete' ? `<a href="report.html?id=${app.id}">${KredtUI.icon('layers', 15)}Report</a><a href="assessment.html?id=${app.id}">${KredtUI.icon('pen', 15)}Assessment</a>` : ''}
          <a href="audit.html?id=${app.id}">${KredtUI.icon('clock', 15)}Audit Log</a>
        </div>
      </aside>`;
  }

  function completeBanner() {
    if (job.status !== 'complete') return '';
    return `
      <div class="inv-complete card">
        <span class="inv-complete-icon">${KredtUI.icon('check', 22)}</span>
        <div class="inv-complete-text"><strong>Investigation complete</strong><span>All six stages finished successfully. The investigation report is ready for review.</span></div>
        <a href="report.html?id=${app.id}" class="btn btn-accent">View Report</a>
      </div>`;
  }

  // ---------- Stage bodies ----------
  const kv = (label, value) => `<div class="kv-item"><div class="kv-label">${label}</div><div class="kv-value">${value}</div></div>`;
  const noteHTML = (tone, title, text) => `<div class="inv-note is-${tone}"><strong>${title}</strong><span>${text}</span></div>`;

  function runningBody(name) {
    const earlier = name === 'report_generation'
      ? `<ul class="inv-checklist">${STAGES.slice(0, 5).map((n) => `<li class="is-ok">${KredtUI.icon('tick', 14)}${E(KredtApi.STAGE_LABELS[n])}</li>`).join('')}<li class="is-now"><span class="spinner"></span>Generating evidence-backed report...</li></ul>`
      : '';
    return `
      <div class="inv-working">
        <span class="spinner spinner-lg"></span>
        <div><div class="inv-working-title">${META[name].running}</div><div class="inv-working-sub">This screen updates automatically — no need to refresh.</div></div>
      </div>
      ${earlier}
      <div class="inv-skel"><div class="skeleton" style="height:14px; width:62%;"></div><div class="skeleton" style="height:14px; width:80%;"></div><div class="skeleton" style="height:14px; width:48%;"></div></div>`;
  }

  function validationBody(d) {
    return `
      <ul class="inv-checks">${d.checks.map((c) => `
        <li class="${c.ok ? 'is-ok' : 'is-bad'}">
          <span class="inv-check-icon">${KredtUI.icon(c.ok ? 'tick' : 'alert', 15)}</span>
          <span class="inv-check-main"><strong>${c.label}</strong><span>${E(c.detail)}</span></span>
        </li>`).join('')}</ul>
      ${d.issues.length
        ? `<div class="inv-note is-warn"><strong>Validation issue</strong><span>Missing: ${d.issues.map(E).join(', ')}.</span><a href="detail.html?id=${app.id}" class="btn btn-secondary btn-sm" style="margin-top:10px;">View Application</a></div>`
        : noteHTML('ok', 'Validation complete', 'The application and its documents are complete enough to investigate.')}`;
  }

  function policyBody(d) {
    if (!d.findings.length) return noteHTML('ok', 'No applicable clauses', 'No lending policy clauses were identified for this application.');
    return `
      <div class="inv-chips">
        <span class="inv-chip">${d.applicable} applicable clause${d.applicable === 1 ? '' : 's'}</span>
        <span class="inv-chip is-ok">${d.passed} passed</span>
        ${d.needs_review ? `<span class="inv-chip is-warn">${d.needs_review} need${d.needs_review === 1 ? 's' : ''} review</span>` : ''}
      </div>
      ${d.findings.map((f) => {
        const r = RESULT[f.result] || { label: f.result, cls: 'badge-neutral', accent: 'accent-neutral' };
        return `
        <div class="finding-card ${r.accent}">
          <div class="finding-card-head"><span class="clause">${E(f.clause_ref)}</span><span class="badge ${r.cls}">${r.label}</span></div>
          <div class="excerpt">"${E(f.clause_text_excerpt)}"</div>
          <div class="relevance">${E(f.relevance)}</div>
          <div class="applies-to">Applies to: ${E(f.applies_to)}</div>
          <button type="button" class="evidence-link" data-evidence="policy" data-title="${E(f.clause_ref)}" data-body="${E(f.clause_text_excerpt)}" style="margin-top:10px;">${KredtUI.icon('file', 13)}View Source Clause</button>
        </div>`;
      }).join('')}`;
  }

  function financialBody(d) {
    return `
      <div class="inv-subject"><span>Applicant</span><strong>${E(d.applicant)}</strong></div>
      <div class="kv-grid inv-figures">
        ${d.figures.filter(([, v]) => v != null).map(([label, v]) => kv(label, KredtUI.currency(v, d.currency))).join('')}
      </div>
      <h4 class="inv-sub-title">Financial ratios</h4>
      <div class="inv-ratios">
        ${d.ratios.map((r) => {
          const f = FLAG[r.flag] || { label: r.flag, cls: 'badge-neutral' };
          return `
          <div class="inv-ratio is-${r.flag}">
            <div class="inv-ratio-top"><span>${E(r.name)}</span><span class="badge ${f.cls}">${f.label}</span></div>
            <div class="inv-ratio-value">${E(r.value)}</div>
            <div class="inv-ratio-req">Policy: ${E(r.policy_threshold)}</div>
            <button type="button" class="evidence-link" data-evidence="ratio" data-title="${E(r.name)}" data-body="${E(r.value)}">${KredtUI.icon('file', 13)}View Evidence</button>
          </div>`;
        }).join('')}
      </div>
      <p class="inv-source">Source: submitted financial information</p>`;
  }

  function transactionBody(d) {
    if (!d.findings.length) return noteHTML('ok', 'No unusual activity detected', 'The transaction review did not flag any patterns that need an analyst’s attention.');
    return `
      <div class="inv-chips"><span class="inv-chip is-warn">${d.findings.length} anomal${d.findings.length === 1 ? 'y' : 'ies'} detected</span></div>
      <h4 class="inv-sub-title">Detected patterns</h4>
      ${d.findings.map((t) => `
        <div class="finding-card accent-warning">
          <div class="finding-card-head"><span class="clause inv-flag-title">${KredtUI.icon('alert', 15)}${E((t.type || 'finding').replace(/^./, (c) => c.toUpperCase()))}</span><span class="badge badge-warning">Flagged</span></div>
          <div class="relevance" style="font-size:14px; color:var(--color-text-muted);">${E(t.description)}</div>
          <div class="applies-to">Evidence reference: ${E(t.evidence_ref || '—')}</div>
          <button type="button" class="evidence-link" data-evidence="txn" data-title="${E(t.evidence_ref || 'Transaction')}" data-body="${E(t.description)}" style="margin-top:10px;">${KredtUI.icon('file', 13)}View Evidence</button>
        </div>`).join('')}`;
  }

  function riskBody(d) {
    const band = (d.band || '').toLowerCase();
    return `
      <div class="inv-risk">
        <div class="inv-risk-band is-${band}"><span>Risk band</span><strong>${BAND[band] || E(d.band || '—')}</strong></div>
        <div class="inv-risk-stat"><span>Probability of default</span><strong>${E(d.probability)}</strong></div>
        <div class="inv-risk-stat"><span>Prediction horizon</span><strong>${E(d.horizon || '—')}</strong></div>
        <div class="inv-risk-stat"><span>Model version</span><strong>${E(d.model_version || '—')}</strong></div>
      </div>
      <h4 class="inv-sub-title">Key inputs</h4>
      <div class="kv-grid inv-figures">${d.key_inputs.map(([k, v]) => kv(E(k), E(v))).join('')}</div>
      ${noteHTML('info', 'This is a model output', 'The risk prediction is produced by an AI model. The final credit assessment is made by the analyst.')}`;
  }

  function reportBody(d) {
    return `
      <ul class="inv-checklist">${[...d.sections, 'Report generation'].map((n) => `<li class="is-ok">${KredtUI.icon('tick', 14)}${E(n)}</li>`).join('')}</ul>
      <div class="inv-ready">
        <span class="inv-complete-icon">${KredtUI.icon('check', 22)}</span>
        <div><strong>Report ready</strong><span>The investigation report has been generated successfully.</span></div>
        <a href="report.html?id=${app.id}" class="btn btn-primary">View Report</a>
      </div>`;
  }

  const BODIES = { validation: validationBody, policy_retrieval: policyBody, financial_analysis: financialBody, transaction_analysis: transactionBody, risk_prediction: riskBody, report_generation: reportBody };

  // ---------- Main panel ----------
  async function mainHTML() {
    const name = selected;
    const i = idx(name);
    const st = stageOf(name);
    const live = liveStageName();
    let body;
    if (st.status === 'complete') {
      const res = await KredtApi.investigations.getStage(job.id, name);
      body = res.status === 'complete' ? BODIES[name](res.data) : runningBody(name);
    } else {
      body = runningBody(name);
    }

    const next = STAGES[i + 1];
    const prev = STAGES[i - 1];
    const nextSt = next && stageOf(next);
    const nextBtn = !next
      ? ''   // last stage: its own panel carries the "View Report" action
      : nextSt.status === 'complete'
        ? `<button type="button" class="btn btn-primary" data-go="${next}">Next: ${E(nextSt.label)} ${KredtUI.icon('arrow', 16)}</button>`
        : nextSt.status === 'running'
          ? `<button type="button" class="btn btn-secondary" disabled><span class="spinner"></span>${E(nextSt.label)} in progress</button>`
          : `<button type="button" class="btn btn-secondary" disabled title="Available once this stage finishes">Next: ${E(nextSt.label)}</button>`;

    const badge = st.status === 'complete' ? '<span class="badge badge-success"><span class="badge-dot"></span>Complete</span>' : '<span class="badge badge-info"><span class="badge-dot"></span>In progress</span>';
    const jump = pinned && job.status !== 'complete' && name !== live
      ? `<button type="button" class="btn btn-secondary btn-sm" data-go="${live}">Jump to live stage</button>` : '';

    return `
      <section class="card card-pad inv-main" aria-live="polite">
        <div class="inv-stage-head">
          <div>
            <div class="inv-stage-eyebrow">Stage ${i + 1} of ${STAGES.length}</div>
            <h2>${E(st.label)}</h2>
            <p>${META[name].question}</p>
          </div>
          <div class="inv-stage-badges">${jump}${badge}</div>
        </div>
        <div class="inv-stage-body">${body}</div>
        <div class="inv-stage-foot">
          ${prev ? `<button type="button" class="btn btn-secondary" data-go="${prev}">${KredtUI.icon('arrow', 16).replace('<svg', '<svg style="transform:rotate(180deg)"')} Previous</button>` : '<span></span>'}
          ${nextBtn}
        </div>
      </section>`;
  }

  async function render() {
    const token = ++renderToken;
    const main = await mainHTML();
    if (token !== renderToken) return; // a newer render superseded this one
    root.innerHTML = shell(`
      ${completeBanner()}
      <div class="inv-layout">${railHTML()}${main}</div>`);
    wire();
  }

  function choose(name) {
    if (!openable(name)) return;
    pinned = true;
    selected = name;
    const url = new URL(window.location.href);
    url.searchParams.set('stage', name);
    history.replaceState(null, '', url);
    lastSignature = '';
    sync();
  }

  function wire() {
    root.querySelectorAll('[data-stage]').forEach((b) => b.addEventListener('click', () => choose(b.dataset.stage)));
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
      const target = b.dataset.go;
      if (target === liveStageName() && job.status !== 'complete') { pinned = false; selected = target; history.replaceState(null, '', `?id=${appId}`); lastSignature = ''; sync(); return; }
      choose(target);
    }));
    root.querySelectorAll('[data-evidence]').forEach((b) => b.addEventListener('click', () => {
      const kind = b.dataset.evidence;
      const body = kind === 'policy'
        ? `<em>"${b.dataset.body}"</em><p style="margin-top:10px;">Retrieved from the bank's lending policy library by the Policy Retrieval stage of the investigation pipeline.</p>`
        : kind === 'ratio'
          ? `<p>Value: <strong>${b.dataset.body}</strong></p><p style="margin-top:8px;">Calculated from the applicant's submitted financial information during the Financial Analysis stage.</p>`
          : `<p>${b.dataset.body}</p><p style="margin-top:8px;">Identified by the Transaction Analysis stage from the applicant's submitted bank statements.</p>`;
      KredtAnalystShell.showEvidence(b.dataset.title, body);
    }));
  }

  // Re-render only when something the analyst can see has actually changed.
  async function sync() {
    if (!pinned || !openable(selected)) { pinned = pinned && openable(selected); if (!pinned) selected = liveStageName(); }
    const sig = `${job.status}|${job.stages.map((s) => s.status).join(',')}|${selected}|${pinned}`;
    if (sig === lastSignature) return;
    lastSignature = sig;
    await render();
  }

  async function tick() {
    try {
      await KredtStore.init();
      app = await KredtApi.applications.get(appId);
      KredtAnalystShell.setBreadcrumb(app.id, app.reference, 'Investigation');
      const latest = await KredtApi.investigations.latestForApplication(appId);
      if (!latest) {
        root.innerHTML = `${shellNoJob()}`;
        stopPolling();
        return;
      }
      job = await KredtApi.investigations.get(latest.id);

      if (job.status === 'failed') {
        root.innerHTML = shell(`<div class="card card-pad">${KredtUI.errorState({ title: 'The investigation failed', message: job.error || 'Something went wrong while running the investigation.' })}</div>`);
        stopPolling();
        return;
      }
      await sync();
      if (job.status === 'complete') stopPolling();
    } catch (err) {
      if (!err.expected) console.error(err); else console.warn(err.message);
      root.innerHTML = KredtUI.errorState({ message: "We couldn't load the investigation." });
      document.getElementById('state-retry-btn')?.addEventListener('click', start);
      stopPolling();
    }
  }

  function shellNoJob() {
    return shell(KredtUI.emptyState({
      icon: 'search', title: 'No investigation started yet',
      message: 'Start an investigation from the application details page to follow it here, stage by stage.',
      actionLabel: 'Go to Application', actionHref: `detail.html?id=${app.id}`,
    }));
  }

  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

  async function start() {
    const wanted = params.get('stage');
    await tick();
    // Honour a deep link only if that stage can already be opened.
    if (job && wanted && STAGES.includes(wanted) && openable(wanted)) { pinned = true; selected = wanted; lastSignature = ''; await sync(); }
    if (job && job.status !== 'complete' && !pollTimer) pollTimer = setInterval(tick, 1500);
  }

  start();
})();
