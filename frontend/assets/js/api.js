// KREDT — API client
//
// One function per endpoint in the Handbook's API contract (see
// docs/api-contract-additions.md for the few extra fields the UI needs
// that the contract doesn't define yet). Every function currently reads
// and writes through KredtStore (mock mode). When the backend is ready,
// flip window.KREDT_USE_MOCK to false in config.js and fill in the
// fetch() calls already stubbed below each mock implementation — no page
// needs to change, since pages only ever call KredtApi.*.

const KredtApi = (() => {
  const STAGE_ORDER = ['validation', 'policy_retrieval', 'financial_analysis', 'transaction_analysis', 'risk_prediction', 'report_generation'];
  const STAGE_LABELS = {
    validation: 'Validation',
    policy_retrieval: 'Policy Retrieval',
    financial_analysis: 'Financial Analysis',
    transaction_analysis: 'Transaction Analysis',
    risk_prediction: 'Risk Prediction',
    report_generation: 'Report Generation',
  };
  const STAGE_DURATION_MS = 2200;

  function delay(ms = window.KREDT_MOCK_DELAY_MS) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function genId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function currentUser() { return (window.KredtAuth && window.KredtAuth.current()) || null; }
  function borrowerActor() { const u = currentUser(); return `${u ? u.full_name : 'Borrower'} (Borrower)`; }

  function analystName() { const u = currentUser(); return u ? u.full_name : 'Analyst'; }

  function nowISO() {
    return new Date().toISOString();
  }

  function nextReference(applications) {
    const nums = applications
      .map((a) => parseInt((a.reference || '').replace('CI-', ''), 10))
      .filter((n) => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 100000) + 1;
    return `CI-${String(next).padStart(6, '0')}`;
  }

  function pushAudit(store, appId, actor, event) {
    if (!store.audit[appId]) store.audit[appId] = [];
    store.audit[appId].push({ timestamp: nowISO(), actor, event });
  }

  // ---- Report generation for applications that don't have a
  // pre-authored report (i.e. everything except the two scripted
  // examples). Uses the same ratio formulas as the Data Contracts doc so
  // numbers stay internally consistent. ----
  function generateReport(application) {
    const isBusiness = application.loan_type === 'business';
    const fin = application.applicant_details?.financials;
    const monthlyIncome = isBusiness ? fin?.monthly_net_income : (application.applicant_details?.monthly_income - application.applicant_details?.monthly_expenses);
    const monthlyRevenueOrIncome = isBusiness ? fin?.monthly_revenue : application.applicant_details?.monthly_income;
    const monthlyDebtPayment = isBusiness ? (fin?.existing_monthly_debt_payment || 1) : Math.max(1, Math.round((application.applicant_details?.monthly_expenses || 0) * 0.2));

    const netProfitMargin = monthlyRevenueOrIncome ? (monthlyIncome / monthlyRevenueOrIncome) : 0;
    const debtToRevenue = monthlyRevenueOrIncome ? (monthlyDebtPayment / monthlyRevenueOrIncome) : 0;
    const dscr = monthlyDebtPayment ? (monthlyIncome / monthlyDebtPayment) : 0;
    const annualRevenue = (monthlyRevenueOrIncome || 0) * 12;
    const loanToAnnualRevenue = annualRevenue ? (application.requested_amount / annualRevenue) : 0;

    const pct = (n) => `${(n * 100).toFixed(1)}%`;
    const flagFor = (value, threshold, direction) => {
      const ratio = direction === 'min' ? value / threshold : threshold / Math.max(value, 0.0001);
      if (direction === 'min' ? value >= threshold : value <= threshold) return 'within_policy';
      return ratio > 0.75 ? 'attention' : 'breach';
    };

    const dscrFlag = flagFor(dscr, 1.25, 'min');
    const marginFlag = flagFor(netProfitMargin, 0.15, 'min');
    const debtFlag = flagFor(debtToRevenue, 0.50, 'max');
    const loanFlag = flagFor(loanToAnnualRevenue, 0.30, 'max');

    const businessAge = application.applicant_details?.business_age_months;
    const ageOk = isBusiness ? (businessAge ?? 0) >= 24 : true;

    const policyFindings = [
      {
        clause_ref: 'Commercial Lending Policy §4.2',
        clause_text_excerpt: 'Minimum DSCR requirement is 1.25x for all lending facilities.',
        relevance: `Applicant's calculated DSCR is ${dscr.toFixed(2)}x, ${dscrFlag === 'within_policy' ? 'above' : 'below'} the minimum threshold.`,
        applies_to: 'Repayment capacity',
        result: dscrFlag === 'within_policy' ? 'PASS' : dscrFlag === 'attention' ? 'REQUIRES_REVIEW' : 'FAIL',
      },
    ];
    if (isBusiness) {
      policyFindings.push({
        clause_ref: 'SME Lending Policy §3.1',
        clause_text_excerpt: 'Minimum business age of 24 months required for SME lending eligibility.',
        relevance: `Applicant has been operating for ${businessAge} months, ${ageOk ? 'satisfying' : 'falling short of'} this requirement.`,
        applies_to: 'Eligibility',
        result: ageOk ? 'PASS' : 'FAIL',
      });
    }

    const riskScore = Math.min(0.9, Math.max(0.03, 0.42 - (dscr * 0.22) + (debtToRevenue * 0.28) + (ageOk ? 0 : 0.08)));
    const band = riskScore < 0.12 ? 'low' : riskScore < 0.28 ? 'medium' : 'high';

    return {
      id: genId('report'),
      generated_at: nowISO(),
      summary: `${application.applicant_details?.business_name || application.applicant_details?.full_name || 'The applicant'} was evaluated against the applicable lending policy, financial ratios, and the credit-risk model. ${dscrFlag === 'breach' ? 'The calculated DSCR falls below the required minimum, indicating limited repayment headroom.' : 'Repayment capacity appears adequate for the requested facility.'} Risk prediction places the applicant in the ${band} band.`,
      financial_ratios: [
        { name: 'Net Profit Margin', value: pct(netProfitMargin), policy_threshold: '15% min', flag: marginFlag },
        { name: 'Debt-to-Revenue', value: debtToRevenue.toFixed(2), policy_threshold: '0.50 max', flag: debtFlag },
        { name: 'DSCR', value: `${dscr.toFixed(2)}x`, policy_threshold: '1.25x min', flag: dscrFlag },
        { name: 'Loan-to-Annual-Revenue', value: loanToAnnualRevenue.toFixed(3), policy_threshold: '0.30 max', flag: loanFlag },
      ],
      policy_findings: policyFindings,
      transaction_findings: [],
      risk_prediction: {
        score: Number(riskScore.toFixed(2)),
        band,
        model_version: 'credit-risk-v1',
        prediction_horizon: '12_months',
        inputs_used: ['annual_revenue', 'loan_amount', 'existing_debt', 'debt_to_revenue', 'dscr', 'loan_to_revenue', 'previous_defaults'],
      },
      missing_information: [],
    };
  }

  // A "not found" (e.g. a bad bookmark, a stale/typo'd link, an id for
  // something that was never created) is an expected, user-facing
  // condition — the UI already handles it gracefully with a friendly
  // error state. Marking it lets pages log it quietly (console.warn)
  // instead of as an alarming console.error, while genuinely unexpected
  // failures still get logged loudly for debugging.
  function notFoundError(message) {
    const err = new Error(message);
    err.expected = true;
    return err;
  }

  const SUBMITTED_TO_REVIEW_MS = 4000;

  // Auto-advances "submitted" applications to "under_review" once enough
  // time has passed — reload-safe, since it's computed from elapsed time
  // rather than a running timer (a setTimeout scheduled on the submit page
  // would be killed the instant the browser navigates to the confirmation
  // page). Scoped to _runtimeSubmittedAt (set only by submit() below), not
  // the display field submitted_at, so pre-seeded demo applications with
  // old fixed dates keep their seeded status instead of all flipping to
  // "under_review" the instant anyone loads the app.
  function resolveApplicationState(store, app) {
    if (app.status === 'submitted' && app._runtimeSubmittedAt) {
      const elapsed = Date.now() - app._runtimeSubmittedAt;
      if (elapsed >= SUBMITTED_TO_REVIEW_MS) {
        app.status = 'under_review';
        pushAudit(store, app.id, 'System', 'Application moved to Under Review');
        store.persist();
      }
    }
    return app;
  }

  // Reads (and advances) an investigation job's state based on elapsed
  // wall-clock time since it started — this makes the "live" six-stage
  // progress reload-safe without needing a running timer or websocket.
  function resolveJobState(store, job) {
    if (job.status === 'complete' || job.status === 'failed') return job;

    const startedAt = new Date(job.started_at).getTime();
    const elapsed = Date.now() - startedAt;
    const stagesElapsed = Math.min(STAGE_ORDER.length, Math.floor(elapsed / STAGE_DURATION_MS));

    job.stages = STAGE_ORDER.map((name, i) => ({
      name,
      label: STAGE_LABELS[name],
      status: i < stagesElapsed ? 'complete' : i === stagesElapsed ? 'running' : 'pending',
      started_at: i <= stagesElapsed ? job.started_at : null,
      finished_at: i < stagesElapsed ? job.started_at : null,
    }));

    if (stagesElapsed >= STAGE_ORDER.length) {
      job.status = 'complete';
      job.current_stage = 'done';
      job.finished_at = nowISO();
      job.stages = job.stages.map((s) => ({ ...s, status: 'complete' }));

      if (!store.reports[job.id]) {
        const application = store.applications.find((a) => a.id === job.application_id);
        const report = generateReport(application);
        report.investigation_job_id = job.id;
        report.application_id = job.application_id;
        store.reports[job.id] = report;
      }

      const application = store.applications.find((a) => a.id === job.application_id);
      if (application && application.status !== 'decided') {
        application.status = 'investigation_complete';
        pushAudit(store, application.id, 'System', 'Investigation completed');
      }
    } else {
      job.current_stage = STAGE_ORDER[stagesElapsed];
    }

    store.persist();
    return job;
  }

  // =========================================================
  // Applications
  // =========================================================
  const applications = {
    async getMine(borrowerId = (currentUser() && currentUser().id) || 'user-borrower-1') {
      await delay();
      if (!window.KREDT_USE_MOCK) {
        // return (await fetch(`${window.KREDT_API_BASE}/applications/mine`, { headers: authHeaders() })).json();
      }
      const store = KredtStore.get();
      return store.applications
        .filter((a) => a.borrower_id === borrowerId)
        .map((a) => resolveApplicationState(store, a));
    },

    async getAll(filters = {}) {
      await delay();
      const store = KredtStore.get();
      // Drafts belong to the borrower until they submit — analysts never see them.
      let list = store.applications.filter((a) => a.status !== 'draft').map((a) => resolveApplicationState(store, a));
      if (filters.status && filters.status !== 'all') list = list.filter((a) => a.status === filters.status);
      if (filters.demo === 'demo') list = list.filter((a) => a.is_demo);
      if (filters.demo === 'real') list = list.filter((a) => !a.is_demo);
      if (filters.loan_type && filters.loan_type !== 'all') list = list.filter((a) => a.loan_type === filters.loan_type);
      // Date inputs give 'YYYY-MM-DD' (midnight, local). Compare whole local days so
      // applications created on the "To" date itself are included.
      if (filters.from_date) list = list.filter((a) => new Date(a.created_at) >= new Date(`${filters.from_date}T00:00:00`));
      if (filters.to_date) list = list.filter((a) => new Date(a.created_at) <= new Date(`${filters.to_date}T23:59:59.999`));
      if (filters.search) {
        const q = filters.search.toLowerCase();
        list = list.filter((a) =>
          a.reference.toLowerCase().includes(q) ||
          (a.applicant_details?.business_name || '').toLowerCase().includes(q) ||
          (a.applicant_details?.full_name || '').toLowerCase().includes(q)
        );
      }
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return list;
    },

    async get(id) {
      await delay();
      const store = KredtStore.get();
      const app = store.applications.find((a) => a.id === id);
      if (!app) throw notFoundError('Application not found');
      return resolveApplicationState(store, app);
    },

    async create(payload) {
      await delay();
      const store = KredtStore.get();
      const app = {
        id: genId('app'),
        reference: nextReference(store.applications),
        borrower_id: payload.borrower_id || (currentUser() && currentUser().id) || 'user-borrower-1',
        is_demo: false,
        status: 'draft',
        loan_type: payload.loan_type,
        requested_amount: payload.requested_amount || 0,
        currency: payload.currency || 'NGN',
        purpose: payload.purpose || '',
        applicant_details: payload.applicant_details || {},
        created_at: nowISO(),
        submitted_at: null,
        decided_at: null,
      };
      store.applications.push(app);
      pushAudit(store, app.id, borrowerActor(), 'Application draft created');
      store.persist();
      return app;
    },

    async update(id, payload) {
      await delay();
      const store = KredtStore.get();
      const app = store.applications.find((a) => a.id === id);
      if (!app) throw notFoundError('Application not found');
      Object.assign(app, payload);
      store.persist();
      return app;
    },

    async submit(id) {
      await delay();
      const store = KredtStore.get();
      const app = store.applications.find((a) => a.id === id);
      if (!app) throw notFoundError('Application not found');
      app.status = 'submitted';
      app.submitted_at = nowISO();
      app._runtimeSubmittedAt = Date.now();
      pushAudit(store, app.id, borrowerActor(), 'Application submitted');
      store.persist();
      return app;
    },

    // Borrower-safe view of a final decision: the outcome only — never the
    // analyst's notes, report or risk detail.
    async getDecision(id) {
      await delay(150);
      const store = KredtStore.get();
      const app = store.applications.find((a) => a.id === id);
      const rec = store.assessments[id];
      if (!app || app.status !== 'decided' || !rec) return null;
      return { outcome: rec.decision === 'approve' ? 'approved' : 'declined', decided_at: app.decided_at };
    },

    async updateStatus(id, status) {
      await delay();
      const store = KredtStore.get();
      const app = store.applications.find((a) => a.id === id);
      if (!app) throw notFoundError('Application not found');
      app.status = status;
      store.persist();
      return app;
    },
  };

  // =========================================================
  // Documents
  // =========================================================
  const documents = {
    async list(applicationId) {
      await delay(250);
      const store = KredtStore.get();
      return store.documents[applicationId] || [];
    },

    async upload(applicationId, file) {
      await delay(900);
      const store = KredtStore.get();
      if (!store.documents[applicationId]) store.documents[applicationId] = [];
      const doc = {
        id: genId('doc'),
        application_id: applicationId,
        document_type: 'supporting_document',
        file_name: file.name,
        file_size: file.size ? (file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`) : '—',
        uploaded_at: nowISO(),
        status: 'PROCESSED',
      };
      store.documents[applicationId].push(doc);
      store.persist();
      return doc;
    },

    async get(applicationId, docId) {
      await delay(200);
      const store = KredtStore.get();
      const doc = (store.documents[applicationId] || []).find((d) => d.id === docId);
      if (!doc) throw notFoundError('Document not found');
      return doc;
    },

    async remove(applicationId, docId) {
      await delay(300);
      const store = KredtStore.get();
      store.documents[applicationId] = (store.documents[applicationId] || []).filter((d) => d.id !== docId);
      store.persist();
      return true;
    },
  };

  // =========================================================
  // Investigations
  // =========================================================
  const investigations = {
    async start(applicationId) {
      await delay(500);
      const store = KredtStore.get();
      const app = store.applications.find((a) => a.id === applicationId);
      if (!app) throw notFoundError('Application not found');

      const job = {
        id: genId('job'),
        application_id: applicationId,
        status: 'running',
        current_stage: 'validation',
        stages: STAGE_ORDER.map((name, i) => ({
          name, label: STAGE_LABELS[name],
          status: i === 0 ? 'running' : 'pending',
          started_at: i === 0 ? nowISO() : null,
          finished_at: null,
        })),
        started_at: nowISO(),
        finished_at: null,
        error: null,
      };
      if (!store.investigations[applicationId]) store.investigations[applicationId] = [];
      store.investigations[applicationId].push(job);

      app.status = 'investigation_in_progress';
      pushAudit(store, applicationId, `${analystName()} (Analyst)`, 'Investigation started');
      store.persist();
      return job;
    },

    async get(jobId) {
      await delay(200);
      const store = KredtStore.get();
      for (const appId in store.investigations) {
        const job = store.investigations[appId].find((j) => j.id === jobId);
        if (job) return resolveJobState(store, job);
      }
      throw notFoundError('Investigation job not found');
    },

    // Output of a single stage, for the per-stage investigation screens. Only a
    // *completed* stage returns data — later stages stay locked until they finish.
    // (Mock: derived from the same report the final Report screen shows, so the
    // numbers always agree. A real backend would return each stage's stored output.)
    async getStage(jobId, stageName) {
      await delay(150);
      const store = KredtStore.get();
      let job = null;
      for (const appId in store.investigations) {
        job = store.investigations[appId].find((j) => j.id === jobId) || job;
      }
      if (!job) throw notFoundError('Investigation job not found');
      resolveJobState(store, job);
      const stage = job.stages.find((s) => s.name === stageName);
      if (!stage) throw notFoundError('Unknown investigation stage');
      if (stage.status !== 'complete') return { stage: stageName, status: stage.status, data: null };

      const app = store.applications.find((a) => a.id === job.application_id);
      const report = store.reports[job.id] || generateReport(app);
      const docs = store.documents[app.id] || [];
      const d = app.applicant_details || {};
      const fin = d.financials || {};
      const isBusiness = app.loan_type === 'business';
      let data;

      if (stageName === 'validation') {
        const checks = [
          { label: 'Applicant information', ok: !!(d.business_name || d.full_name), detail: d.business_name || d.full_name || 'Applicant name is missing' },
          { label: 'Loan information', ok: !!(app.loan_type && app.requested_amount > 0 && app.purpose), detail: app.requested_amount > 0 && app.purpose ? 'Loan type, amount and purpose provided' : 'Amount or purpose is missing' },
          { label: 'Financial information', ok: isBusiness ? (fin.monthly_revenue > 0) : (d.monthly_income > 0), detail: (isBusiness ? fin.monthly_revenue > 0 : d.monthly_income > 0) ? 'Income and expense figures provided' : 'Income figures are missing' },
          { label: 'Supporting documents', ok: docs.length > 0, detail: docs.length ? `${docs.length} document${docs.length === 1 ? '' : 's'} submitted` : 'No documents were submitted' },
        ];
        data = { checks, issues: checks.filter((c) => !c.ok).map((c) => c.label) };
      } else if (stageName === 'policy_retrieval') {
        const findings = report.policy_findings || [];
        data = {
          findings,
          applicable: findings.length,
          passed: findings.filter((f) => f.result === 'PASS').length,
          needs_review: findings.filter((f) => f.result !== 'PASS').length,
        };
      } else if (stageName === 'financial_analysis') {
        const money = (v) => (v == null ? null : v);
        data = {
          applicant: d.business_name || d.full_name || '—',
          figures: isBusiness
            ? [['Monthly revenue', money(fin.monthly_revenue)], ['Monthly expenses', money(fin.monthly_expenses)], ['Monthly net income', money(fin.monthly_net_income)], ['Existing monthly debt payment', money(fin.existing_monthly_debt_payment)], ['Total outstanding debt', money(fin.total_outstanding_debt)]]
            : [['Monthly income', money(d.monthly_income)], ['Monthly expenses', money(d.monthly_expenses)], ['Monthly net income', d.monthly_income != null ? d.monthly_income - (d.monthly_expenses || 0) : null]],
          ratios: report.financial_ratios || [],
          currency: app.currency,
        };
      } else if (stageName === 'transaction_analysis') {
        data = { findings: report.transaction_findings || [] };
      } else if (stageName === 'risk_prediction') {
        const r = report.risk_prediction || {};
        const ratio = (n) => (report.financial_ratios || []).find((x) => x.name === n)?.value;
        data = {
          band: r.band,
          probability: r.score != null ? `${(r.score * 100).toFixed(1)}%` : '—',
          horizon: String(r.prediction_horizon || '').replace('_', ' '),
          model_version: r.model_version,
          key_inputs: [
            ['DSCR', ratio('DSCR')],
            ['Debt-to-Revenue', ratio('Debt-to-Revenue')],
            ['Loan-to-Annual-Revenue', ratio('Loan-to-Annual-Revenue')],
            ...(isBusiness ? [['Business age', d.business_age_months != null ? `${d.business_age_months} months` : null]] : []),
          ].filter(([, v]) => v != null),
        };
      } else {
        data = { ready: true, generated_at: report.generated_at, sections: ['Validation', 'Policy findings', 'Financial analysis', 'Transaction analysis', 'Risk prediction'] };
      }
      return { stage: stageName, status: 'complete', data };
    },

    async history(applicationId) {
      await delay(200);
      const store = KredtStore.get();
      return store.investigations[applicationId] || [];
    },

    async latestForApplication(applicationId) {
      const list = await this.history(applicationId);
      return list.length ? list[list.length - 1] : null;
    },
  };

  // =========================================================
  // Reports
  // =========================================================
  const reports = {
    async get(jobId) {
      await delay(250);
      const store = KredtStore.get();
      const report = store.reports[jobId];
      if (!report) throw notFoundError('Report not available yet');
      return report;
    },
  };

  // =========================================================
  // Assessments
  // =========================================================
  const assessments = {
    async submit(applicationId, payload) {
      await delay(500);
      const store = KredtStore.get();
      const record = {
        application_id: applicationId,
        notes: payload.notes || '',
        decision: payload.decision,
        created_at: nowISO(),
        analyst: analystName(),
      };
      store.assessments[applicationId] = record;

      const app = store.applications.find((a) => a.id === applicationId);
      const decisionLabel = {
        approve: 'Approved', decline: 'Declined',
        request_info: 'Additional information requested', continue_review: 'Marked for continued review',
      }[payload.decision] || payload.decision;

      if (app) {
        if (payload.decision === 'approve' || payload.decision === 'decline') {
          app.status = 'decided';
          app.decided_at = nowISO();
        } else if (payload.decision === 'request_info') {
          app.status = 'additional_info_requested';
        }
        pushAudit(store, applicationId, `${analystName()} (Analyst)`, `Assessment recorded — ${decisionLabel}`);
      }
      store.persist();
      return record;
    },

    async get(applicationId) {
      await delay(200);
      const store = KredtStore.get();
      return store.assessments[applicationId] || null;
    },
  };

  // =========================================================
  // Audit log
  // =========================================================
  const audit = {
    async get(applicationId) {
      await delay(250);
      const store = KredtStore.get();
      return (store.audit[applicationId] || []).slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },
  };

  return { applications, documents, investigations, reports, assessments, audit, STAGE_ORDER, STAGE_LABELS };
})();
