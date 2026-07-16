(() => {
  'use strict';

  const storage = window.VPS_STORAGE;
  const formatting = window.VPS_FORMATTING;
  if (!storage || !formatting) return;

  const MAX_RECENT = 8;

  function normalizeSnapshot(snapshot = {}) {
    return {
      version: 3,
      record: snapshot.build?.record || null,
      selections: { ...(snapshot.build?.selections || {}) },
      values: { ...(snapshot.build?.values || {}) },
      activeStep: snapshot.ui?.activeStep || 'main',
      openAssetDetails: [...(snapshot.ui?.openAssetDetails || [])]
    };
  }

  function createDraft(snapshot = {}) {
    const normalized = normalizeSnapshot(snapshot);
    if (!normalized.record) return null;

    return {
      version: 2,
      savedAt: new Date().toISOString(),
      record: normalized.record,
      selections: normalized.selections,
      values: normalized.values,
      activeStep: normalized.activeStep,
      openAssetDetails: normalized.openAssetDetails
    };
  }

  function loadDraft() {
    const draft = storage.readJson(storage.keys.draft, null);
    return draft?.record && draft?.values ? draft : null;
  }

  function saveDraft(snapshot) {
    const draft = createDraft(snapshot);
    return draft ? storage.writeJson(storage.keys.draft, draft) : false;
  }

  function clearDraft() {
    return storage.remove(storage.keys.draft);
  }

  function loadPreferences() {
    const preferences = storage.readJson(storage.keys.preferences, {});
    return preferences && typeof preferences === 'object' ? preferences : {};
  }

  function savePreferences(ui = {}) {
    return storage.writeJson(storage.keys.preferences, {
      activeStep: typeof ui.activeStep === 'string' && ui.activeStep ? ui.activeStep : 'main'
    });
  }

  function loadRecent() {
    const recent = storage.readJson(storage.keys.recent, []);
    return Array.isArray(recent) ? recent : [];
  }

  function currentFilename(snapshot = {}) {
    const id = snapshot.build?.record?.id || 'output';
    return `${formatting.safeFilename(id)}_table-config.yml`;
  }

  function createRecentEntry(snapshot = {}, action = 'Saved', filename = currentFilename(snapshot)) {
    const record = snapshot.build?.record;
    if (!record) return null;

    return {
      id: record.id || '',
      name: record.name || record.id || 'Unknown table',
      completedAt: new Date().toISOString(),
      action,
      filename,
      yaml: snapshot.build?.yaml || '---\n',
      snapshot: normalizeSnapshot(snapshot)
    };
  }

  function saveRecent(entries) {
    return storage.writeJson(storage.keys.recent, Array.isArray(entries) ? entries.slice(0, MAX_RECENT) : []);
  }

  function addRecent(snapshot, action = 'Saved', filename) {
    const entry = createRecentEntry(snapshot, action, filename);
    if (!entry) return null;

    const next = [entry, ...loadRecent().filter(item => item?.id !== entry.id)].slice(0, MAX_RECENT);
    saveRecent(next);
    return entry;
  }

  function removeRecent(match) {
    const current = loadRecent();
    const predicate = typeof match === 'function'
      ? match
      : entry => entry === match || entry?.completedAt === match || entry?.id === match;
    const next = current.filter(entry => !predicate(entry));
    saveRecent(next);
    return next;
  }

  function clearRecent() {
    storage.remove(storage.keys.recent);
    return [];
  }

  window.VPS_BUILD_PERSISTENCE = Object.freeze({
    maxRecent: MAX_RECENT,
    normalizeSnapshot,
    createDraft,
    loadDraft,
    saveDraft,
    clearDraft,
    loadPreferences,
    savePreferences,
    loadRecent,
    saveRecent,
    currentFilename,
    createRecentEntry,
    addRecent,
    removeRecent,
    clearRecent
  });
})();