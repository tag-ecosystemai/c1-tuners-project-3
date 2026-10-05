// KREDT — local data store
//
// Since there is no backend yet, this is where "the database" lives for now:
// it seeds itself from data/mock/*.json on first run, then persists every
// change (new draft, uploaded document, submitted application, started
// investigation, recorded assessment) to localStorage so the app behaves
// like a real product across page reloads within this browser.
//
// api.js is the only file that should talk to KredtStore directly — pages
// should always go through api.js, never touch KredtStore themselves. That
// boundary is what lets api.js switch to real fetch() calls later without
// any page needing to change.

const KredtStore = (() => {
  const LS_KEY = 'kredt_store_v1';
  let data = null;
  let loadingPromise = null;

  async function fetchJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    return res.json();
  }

  async function seedFromMock() {
    const root = window.SITE_ROOT || './';
    const [applicationsRes, documents, investigations, reports, audit, assessments, users] = await Promise.all([
      fetchJSON(`${root}data/mock/applications.json`),
      fetchJSON(`${root}data/mock/documents.json`),
      fetchJSON(`${root}data/mock/investigations.json`),
      fetchJSON(`${root}data/mock/reports.json`),
      fetchJSON(`${root}data/mock/audit.json`),
      fetchJSON(`${root}data/mock/assessments.json`),
      fetchJSON(`${root}data/mock/user.json`),
    ]);

    // Jobs seeded with status "running" carry a fixed illustrative timestamp
    // in the JSON. The stage simulator in api.js resolves progress purely
    // from elapsed wall-clock time since started_at, so a stale fixed
    // timestamp would make the job resolve as already "complete" the
    // instant anyone actually loads the app. Re-stamp it to "now" the
    // moment the store is first seeded, so the live six-stage progress
    // genuinely animates on first view.
    Object.values(investigations).forEach((jobList) => {
      jobList.forEach((job) => {
        if (job.status === 'running') {
          job.started_at = new Date().toISOString();
        }
      });
    });

    return {
      applications: applicationsRes.applications,
      documents,
      investigations,
      reports,
      audit,
      assessments,
      users,
    };
  }

  async function init() {
    if (data) return data;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        try {
          data = JSON.parse(saved);
          // Heal missing keys if the schema grew since the save was made.
          const fresh = await seedFromMock();
          data = { ...fresh, ...data };
          return data;
        } catch (e) {
          console.warn('Kredt: saved store was corrupt, reseeding.', e);
        }
      }
      data = await seedFromMock();
      persist();
      return data;
    })();

    return loadingPromise;
  }

  function persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Kredt: could not persist store to localStorage.', e);
    }
  }

  function reset() {
    localStorage.removeItem(LS_KEY);
    data = null;
    loadingPromise = null;
    return init();
  }

  function get() {
    if (!data) throw new Error('KredtStore not initialized — call KredtStore.init() first.');
    // api.js calls `KredtStore.get().persist()` throughout (get() returns
    // the plain data object, not this module) — attach it here so that
    // holds true no matter how many times `data` has been reassigned
    // internally (e.g. the { ...fresh, ...data } merge in init() above).
    if (!data.persist) data.persist = persist;
    return data;
  }

  return { init, get, persist, reset };
})();
