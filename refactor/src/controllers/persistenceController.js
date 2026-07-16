(() => {
  'use strict';

  const store = window.VPS_APP_STORE;
  const persistence = window.VPS_BUILD_PERSISTENCE;
  if (!store || !persistence) return;

  let autosaveTimer = 0;
  let unsubscribe = null;

  function cancelAutosave() {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = 0;
  }

  function saveDraftNow(snapshot = store.getSnapshot()) {
    cancelAutosave();
    return persistence.saveDraft(snapshot);
  }

  function scheduleDraft(snapshot) {
    cancelAutosave();
    autosaveTimer = window.setTimeout(() => saveDraftNow(snapshot), 350);
  }

  function handleState(snapshot, metadata = {}) {
    const changed = metadata.changedSections || [];
    if (metadata.source?.startsWith('persistence:')) return;

    if (changed.includes('ui')) persistence.savePreferences(snapshot.ui || {});

    if (!changed.some(section => section === 'build' || section === 'yaml' || section === 'ui')) return;
    if (snapshot.build?.record) {
      scheduleDraft(snapshot);
      return;
    }

    cancelAutosave();
    if (metadata.source === 'workspace:cleared' || metadata.source === 'clearBuild') persistence.clearDraft();
  }

  function start() {
    if (unsubscribe) return;
    unsubscribe = store.subscribe(handleState);
  }

  function stop() {
    unsubscribe?.();
    unsubscribe = null;
    cancelAutosave();
  }

  function addRecent(action = 'Saved', filename, snapshot = store.getSnapshot()) {
    return persistence.addRecent(snapshot, action, filename);
  }

  window.VPS_PERSISTENCE_CONTROLLER = Object.freeze({
    start,
    stop,
    saveDraftNow,
    scheduleDraft: () => scheduleDraft(store.getSnapshot()),
    loadDraft: persistence.loadDraft,
    clearDraft: persistence.clearDraft,
    loadPreferences: persistence.loadPreferences,
    savePreferences: () => persistence.savePreferences(store.getSnapshot().ui || {}),
    getRecent: persistence.loadRecent,
    addRecent,
    removeRecent: persistence.removeRecent,
    clearRecent: persistence.clearRecent
  });

  start();
})();