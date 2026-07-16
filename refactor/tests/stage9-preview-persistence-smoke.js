(() => {
  'use strict';

  const frame = document.getElementById('appFrame');
  const results = document.getElementById('results');

  function append(name, passed, detail = '') {
    const item = document.createElement('li');
    item.className = passed ? 'pass' : 'fail';
    item.textContent = `${passed ? 'PASS' : 'FAIL'} — ${name}${detail ? `: ${detail}` : ''}`;
    results.appendChild(item);
  }

  function updateSummary() {
    const items = [...results.querySelectorAll('li')];
    const summary = items.find(item => /smoke tests? failed|All \d+ smoke tests passed/.test(item.textContent));
    if (!summary) return;
    const checks = items.filter(item => item !== summary && !item.classList.contains('pending'));
    const failed = checks.filter(item => item.classList.contains('fail')).length;
    summary.className = failed ? 'fail' : 'pass';
    summary.textContent = failed
      ? `${failed} smoke test${failed === 1 ? '' : 's'} failed.`
      : `All ${checks.length} smoke tests passed.`;
  }

  function fixtureState(appWindow, id = 'preview-persistence-table') {
    const checksum = 'a'.repeat(32);
    const record = {
      id,
      name: 'Preview Persistence Table',
      tableFiles: [{ id: `${id}-vpx`, urls: [] }]
    };
    const selections = { tableFiles: `${id}-vpx` };
    const values = {
      tableVPSId: id,
      vpxVPSId: `${id}-vpx`,
      vpxChecksum: checksum,
      fps: 60,
      testers: 'Alpha',
      enabled: false
    };
    return {
      build: { record, selections, values, yaml: '---\n' },
      ui: { activeStep: 'main', openAssetDetails: [] },
      validation: { errors: [], warnings: [] }
    };
  }

  function restoreRaw(storage, key, raw) {
    if (raw === null) storage.remove(key);
    else storage.writeText(key, raw);
  }

  async function run() {
    const appWindow = frame.contentWindow;
    const appDocument = frame.contentDocument;
    if (!appWindow || !appDocument) {
      append('Preview/persistence iframe access', false, 'Unable to access the refactor frame.');
      updateSummary();
      return;
    }

    const globals = [
      'VPS_PREVIEW_MODEL',
      'VPS_PREVIEW_CONTROLLER',
      'VPS_STORAGE',
      'VPS_BUILD_PERSISTENCE',
      'VPS_PERSISTENCE_CONTROLLER'
    ];
    const missingGlobals = globals.filter(name => !appWindow[name]);
    append('Preview and persistence globals', missingGlobals.length === 0, missingGlobals.join(', '));

    const scriptPaths = new Set([...appDocument.scripts].map(script => {
      try { return new URL(script.src, appWindow.location.href).pathname; } catch (_) { return ''; }
    }));
    const requiredPaths = [
      '/refactor/src/services/previewModel.js',
      '/refactor/src/controllers/previewController.js',
      '/refactor/src/services/storageService.js',
      '/refactor/src/services/buildPersistence.js',
      '/refactor/src/controllers/persistenceController.js'
    ];
    const missingPaths = requiredPaths.filter(path => !scriptPaths.has(path));
    append('Preview and persistence script ownership', missingPaths.length === 0, missingPaths.join(', '));

    const previewModel = appWindow.VPS_PREVIEW_MODEL;
    const previewController = appWindow.VPS_PREVIEW_CONTROLLER;
    const storage = appWindow.VPS_STORAGE;
    const persistence = appWindow.VPS_BUILD_PERSISTENCE;
    const persistenceController = appWindow.VPS_PERSISTENCE_CONTROLLER;
    const store = appWindow.VPS_APP_STORE;

    try {
      const fixture = fixtureState(appWindow);
      const model = previewModel.create(fixture.build);
      const validModel = model.yaml.includes('tableVPSId: "preview-persistence-table"')
        && model.yaml.includes('fps: 60')
        && model.lineCount === model.yaml.trimEnd().split('\n').length
        && model.status.key === 'green';
      append('Preview model contract', validModel, `${model.lineCount} lines, ${model.status.key}`);
    } catch (error) {
      append('Preview model contract', false, error?.message || 'Preview model failed.');
    }

    const originalState = store.getSnapshot();
    persistenceController.stop();
    try {
      const fixture = fixtureState(appWindow);
      store.replace(fixture, { source: 'smoke:preview' });
      await new Promise(resolve => appWindow.setTimeout(resolve, 60));

      const synchronized = store.getSnapshot();
      const model = previewController.getModel();
      const previewText = appDocument.getElementById('previewYaml')?.textContent || '';
      const lineLabel = appDocument.getElementById('previewLineCount')?.textContent || '';
      const previewValid = synchronized.build.yaml === model.yaml
        && previewText === model.yaml
        && lineLabel === model.lineLabel;
      append('Preview controller synchronization', previewValid, `${lineLabel}, source ${synchronized.meta.source}`);
    } catch (error) {
      append('Preview controller synchronization', false, error?.message || 'Preview synchronization failed.');
    } finally {
      store.replace(originalState, { source: 'smoke:preview:restore' });
    }

    const temporaryKey = `vpxs-smoke-storage-${Date.now()}`;
    try {
      const writePassed = storage.writeJson(temporaryKey, { alpha: 1, beta: true });
      const readValue = storage.readJson(temporaryKey, null);
      const removePassed = storage.remove(temporaryKey);
      append(
        'Storage service round trip',
        writePassed && readValue?.alpha === 1 && readValue?.beta === true && removePassed
      );
    } catch (error) {
      storage.remove(temporaryKey);
      append('Storage service round trip', false, error?.message || 'Storage round trip failed.');
    }

    const draftRaw = storage.readText(storage.keys.draft, null);
    const recentRaw = storage.readText(storage.keys.recent, null);
    const preferencesRaw = storage.readText(storage.keys.preferences, null);
    try {
      const fixture = fixtureState(appWindow, 'persistence-table');
      const draftSaved = persistence.saveDraft(fixture);
      const draft = persistence.loadDraft();
      const draftValid = draftSaved
        && draft?.record?.id === 'persistence-table'
        && draft?.values?.vpxVPSId === 'persistence-table-vpx'
        && draft?.version === 2;
      append('Draft persistence contract', draftValid, draft?.record?.id || 'missing draft');

      persistence.clearRecent();
      persistence.addRecent(fixture, 'Copied');
      persistence.addRecent(fixture, 'Downloaded', 'persistence.yml');
      const recent = persistence.loadRecent();
      const recentValid = recent.length === 1
        && recent[0].id === 'persistence-table'
        && recent[0].action === 'Downloaded'
        && recent[0].filename === 'persistence.yml'
        && recent[0].snapshot?.version === 3;
      append('Recent-build persistence contract', recentValid, `${recent.length} entry, ${recent[0]?.action || 'missing'}`);

      const preferencesSaved = persistence.savePreferences({ activeStep: 'pup' });
      const preferences = persistence.loadPreferences();
      append('Workspace preference persistence', preferencesSaved && preferences.activeStep === 'pup', preferences.activeStep || 'missing');

      const controllerValid = typeof persistenceController.start === 'function'
        && typeof persistenceController.stop === 'function'
        && typeof persistenceController.saveDraftNow === 'function'
        && typeof persistenceController.getRecent === 'function'
        && typeof persistenceController.addRecent === 'function';
      append('Persistence controller API', controllerValid);
    } catch (error) {
      append('Draft persistence contract', false, error?.message || 'Persistence verification failed.');
      append('Recent-build persistence contract', false, 'Persistence verification failed.');
      append('Workspace preference persistence', false, 'Persistence verification failed.');
      append('Persistence controller API', false, 'Persistence verification failed.');
    } finally {
      restoreRaw(storage, storage.keys.draft, draftRaw);
      restoreRaw(storage, storage.keys.recent, recentRaw);
      restoreRaw(storage, storage.keys.preferences, preferencesRaw);
      persistenceController.start();
    }

    updateSummary();
  }

  frame.addEventListener('load', () => {
    window.setTimeout(run, 2600);
  }, { once: true });
})();