(() => {
  'use strict';

  const frame = document.getElementById('appFrame');
  const results = document.getElementById('results');
  const checks = [];

  function record(name, passed, detail = '') {
    checks.push({ name, passed: Boolean(passed), detail });
  }

  function render() {
    results.replaceChildren();

    const failed = checks.filter(check => !check.passed).length;
    const summary = document.createElement('li');
    summary.className = failed ? 'fail' : 'pass';
    summary.textContent = failed
      ? `${failed} smoke test${failed === 1 ? '' : 's'} failed.`
      : `All ${checks.length} smoke tests passed.`;
    results.appendChild(summary);

    checks.forEach(check => {
      const item = document.createElement('li');
      item.className = check.passed ? 'pass' : 'fail';
      item.textContent = `${check.passed ? 'PASS' : 'FAIL'} — ${check.name}${check.detail ? `: ${check.detail}` : ''}`;
      results.appendChild(item);
    });
  }

  async function dependencyAvailable(url) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  function pathname(url) {
    try {
      return new URL(url, window.location.href).pathname;
    } catch (_) {
      return '';
    }
  }

  async function run() {
    checks.length = 0;

    const appWindow = frame.contentWindow;
    const appDocument = frame.contentDocument;
    if (!appWindow || !appDocument) {
      record('Application iframe access', false, 'Unable to access the same-origin frame.');
      render();
      return;
    }

    const requiredIds = [
      'app', 'searchForm', 'idInput', 'searchBtn', 'suggestions', 'workspace',
      'tableStrip', 'assetMatrix', 'accordionStack', 'previewDrawer', 'previewYaml',
      'validateBtn', 'drawerCopyBtn', 'downloadNextBtn', 'manualReadmeBtn',
      'wizardReadmeBtn', 'helpDialog', 'validationDialog', 'recentDialog',
      'themeToggle', 'themeKnob', 'ymlImportInput', 'ymlImportDrop'
    ];
    const missingIds = requiredIds.filter(id => !appDocument.getElementById(id));
    record('Required DOM structure', missingIds.length === 0, missingIds.join(', '));

    const requiredGlobals = [
      'fetchVPSDB', 'getVPSDBStatus', 'checkVPSDBNow',
      'VPS_YML_FIELDS', 'VPS_UTILS', 'VPS_SEARCH', 'VPS_UI',
      'VPS_APP_STORE', 'VPS_APP_EVENTS', 'VPS_APPLICATION_CONTROLLER',
      'VPS_VALIDATION_DIALOG', 'VPS_OUTPUT_CONTROLLER', 'VPS_README_GENERATOR',
      'VPS_PREVIEW_CONTROLLER', 'VPS_PERSISTENCE_CONTROLLER'
    ];
    const missingGlobals = requiredGlobals.filter(name => !appWindow[name]);
    record('Core application globals', missingGlobals.length === 0, missingGlobals.join(', '));

    const utilityGlobals = [
      'VPS_FORMATTING', 'VPS_ASSET_CATALOG', 'VPS_YAML_SERVICE',
      'VPS_FILE_OUTPUT', 'VPS_ARCHIVE_PATHS'
    ];
    const missingUtilities = utilityGlobals.filter(name => !appWindow[name]);
    record('Utility module namespaces', missingUtilities.length === 0, missingUtilities.join(', '));

    const stylesheetLinks = [...appDocument.querySelectorAll('link[rel="stylesheet"]')]
      .map(link => link.href)
      .filter(url => !url.includes('fonts.googleapis.com'));
    const stylesheetResults = await Promise.all(stylesheetLinks.map(dependencyAvailable));
    record(
      'Stylesheet dependencies',
      stylesheetResults.every(Boolean),
      `${stylesheetResults.filter(Boolean).length}/${stylesheetResults.length} loaded`
    );

    const scriptSources = [...appDocument.scripts].map(script => script.src).filter(Boolean);
    const scriptResults = await Promise.all(scriptSources.map(dependencyAvailable));
    record(
      'Script dependencies',
      scriptResults.every(Boolean),
      `${scriptResults.filter(Boolean).length}/${scriptResults.length} loaded`
    );

    const loadedPaths = new Set([...stylesheetLinks, ...scriptSources].map(pathname));
    const expectedPaths = [
      '/refactor/styles/tokens.css',
      '/refactor/styles/components/app-shell.css',
      '/refactor/styles/components/search.css',
      '/refactor/styles/components/table-card.css',
      '/refactor/styles/components/asset-panel.css',
      '/refactor/styles/components/configuration-panel.css',
      '/refactor/styles/components/form-controls.css',
      '/refactor/styles/components/preview-panel.css',
      '/refactor/styles/components/dialogs.css',
      '/refactor/styles/components/database-status-toast.css',
      '/refactor/styles/components/yml-import.css',
      '/refactor/styles/components/readme-actions.css',
      '/refactor/styles/themes/pink.css',
      '/refactor/src/config/fieldDefinitions.js',
      '/refactor/src/app/appStore.js',
      '/refactor/src/app/applicationController.js',
      '/refactor/src/utils/formatting.js',
      '/refactor/src/services/assetCatalog.js',
      '/refactor/src/services/yamlService.js',
      '/refactor/src/services/previewModel.js',
      '/refactor/src/services/fileOutput.js',
      '/refactor/src/services/archivePaths.js',
      '/refactor/src/services/storageService.js',
      '/refactor/src/services/buildPersistence.js',
      '/refactor/src/services/buildValidator.js',
      '/refactor/src/services/readmeGenerator.js',
      '/refactor/src/services/vpsDatabase.js',
      '/refactor/src/services/tableSearch.js',
      '/refactor/src/controllers/validationStateController.js',
      '/refactor/src/controllers/validationDialogController.js',
      '/refactor/src/controllers/outputController.js',
      '/refactor/src/controllers/persistenceController.js',
      '/refactor/src/controllers/previewController.js',
      '/refactor/src/controllers/databaseStatusController.js',
      '/refactor/src/controllers/themeController.js',
      '/refactor/src/ui/tooltipController.js'
    ];
    const forbiddenPaths = [
      '/css.src/1variables.css',
      '/css.src/base.css',
      '/css.src/search.css',
      '/css.src/card.css',
      '/css.src/category.css',
      '/css.src/modal.css',
      '/css.src/v0103.css',
      '/css.src/vpsDbToast.css',
      '/css.src/ymlImport.css',
      '/css.src/readmeGenerator.css',
      '/js.src/fields.js',
      '/js.src/utilities.js',
      '/js.src/apiHelper.js',
      '/js.src/vpsDbToast.js',
      '/js.src/searchHelper.js',
      '/js.src/readmeGenerator.js',
      '/js.src/secretTheme.js',
      '/js.src/nativeTooltipCleanup.js',
      '/js.src/main.js',
      '/refactor/src/app/legacyStateBridge.js'
    ];
    const missingPaths = expectedPaths.filter(path => !loadedPaths.has(path));
    const forbiddenLoaded = forbiddenPaths.filter(path => loadedPaths.has(path));
    record(
      'Refactor-owned module paths',
      missingPaths.length === 0 && forbiddenLoaded.length === 0,
      [
        missingPaths.length ? `missing ${missingPaths.join(', ')}` : '',
        forbiddenLoaded.length ? `legacy ${forbiddenLoaded.join(', ')}` : ''
      ].filter(Boolean).join('; ')
    );

    try {
      const store = appWindow.VPS_APP_STORE;
      const events = appWindow.VPS_APP_EVENTS;
      const original = store.getSnapshot();
      const methods = [
        'getSnapshot', 'select', 'subscribe', 'setBuild', 'setUi',
        'setValidation', 'replace', 'clearBuild'
      ];
      const missingMethods = methods.filter(name => typeof store?.[name] !== 'function');
      const eventApiValid = events?.types?.STATE_CHANGED === 'state:changed'
        && events?.types?.BUILD_LOADED === 'build:loaded'
        && typeof events?.on === 'function'
        && typeof events?.emit === 'function';
      record('Application store API', missingMethods.length === 0 && eventApiValid, missingMethods.join(', '));

      let subscriptionCalled = false;
      let eventCalled = false;
      const unsubscribe = store.subscribe((nextState, metadata) => {
        if (nextState?.build?.record?.id === 'smoke-store' && metadata?.source === 'smoke:store') {
          subscriptionCalled = true;
        }
      });
      const stopEvent = events.on(events.types.STATE_CHANGED, event => {
        if (event?.detail?.source === 'smoke:store') eventCalled = true;
      });

      store.setBuild({
        record: {
          id: 'smoke-store',
          name: 'Smoke Store',
          tableFiles: [{ id: 'smoke-vpx', urls: [] }]
        },
        selections: { tableFiles: 'smoke-vpx' },
        values: {
          tableVPSId: 'smoke-store',
          vpxVPSId: 'smoke-vpx',
          vpxChecksum: 'a'.repeat(32),
          fps: 60,
          testers: 'Alpha',
          enabled: false
        }
      }, { source: 'smoke:store' });

      const detached = store.getSnapshot();
      detached.build.values.tableVPSId = 'mutated-copy';
      const stable = store.getSnapshot();
      const selectedId = store.select(state => state.build.record?.id);
      record(
        'Application store updates and snapshots',
        subscriptionCalled
          && eventCalled
          && stable.build.values.tableVPSId === 'smoke-store'
          && selectedId === 'smoke-store',
        `${selectedId}, revision ${stable.meta?.revision}`
      );

      unsubscribe();
      stopEvent();
      store.replace(original, { source: 'smoke:restore' });
      const restored = store.getSnapshot();
      const restoredValid = String(restored.build?.record?.id || '') === String(original.build?.record?.id || '')
        && restored.build?.yaml === original.build?.yaml;
      record('Application store restoration', restoredValid, restored.build?.record?.id || 'empty build');

      const application = appWindow.VPS_APPLICATION_CONTROLLER;
      const applicationValid = typeof application?.selectRecord === 'function'
        && typeof application?.clearBuild === 'function'
        && typeof application?.renderNow === 'function'
        && application.getState?.().build?.yaml === restored.build?.yaml;
      record('Authoritative application controller', applicationValid);

      const validationApi = appWindow.VPS_VALIDATION_DIALOG;
      const outputApi = appWindow.VPS_OUTPUT_CONTROLLER;
      record(
        'Validation and output controller APIs',
        typeof validationApi?.validate === 'function'
          && typeof validationApi?.show === 'function'
          && typeof outputApi?.validateForOutput === 'function'
          && typeof outputApi?.copy === 'function'
          && typeof outputApi?.download === 'function'
      );

      const readme = appWindow.VPS_README_GENERATOR;
      const readmeContext = readme?.getContext?.();
      record(
        'README shared-state context',
        typeof readme?.generate === 'function'
          && String(readmeContext?.record?.id || '') === String(restored.build?.record?.id || '')
          && String(readmeContext?.values?.tableVPSId || '') === String(restored.build?.values?.tableVPSId || ''),
        readmeContext?.record?.id || 'empty build'
      );
    } catch (error) {
      record('Application store API', false, error?.message || 'Unknown error');
      record('Application store updates and snapshots', false, 'Store verification failed.');
      record('Application store restoration', false, 'Store verification failed.');
      record('Authoritative application controller', false, 'Controller verification failed.');
      record('Validation and output controller APIs', false, 'Controller verification failed.');
      record('README shared-state context', false, 'Store verification failed.');
    }

    const fixtureHost = appDocument.createElement('div');
    fixtureHost.style.position = 'fixed';
    fixtureHost.style.left = '-10000px';
    fixtureHost.style.top = '0';
    fixtureHost.style.width = '900px';
    fixtureHost.style.pointerEvents = 'none';
    appDocument.body.appendChild(fixtureHost);

    const assetRow = appDocument.createElement('div');
    assetRow.className = 'asset-row';
    fixtureHost.appendChild(assetRow);
    const assetRowStyle = appWindow.getComputedStyle(assetRow);
    record(
      'Asset panel row layout',
      assetRowStyle.display === 'grid' && Number.parseFloat(assetRowStyle.minHeight) >= 52,
      `${assetRowStyle.display}, ${assetRowStyle.minHeight}`
    );

    const configPanel = appDocument.createElement('div');
    configPanel.className = 'config-tab-panel';
    fixtureHost.appendChild(configPanel);
    const configStyle = appWindow.getComputedStyle(configPanel);
    record(
      'Configuration panel layout',
      configStyle.display === 'flex'
        && configStyle.flexDirection === 'column'
        && Number.parseFloat(configStyle.minHeight) >= 430,
      `${configStyle.display}, ${configStyle.flexDirection}, ${configStyle.minHeight}`
    );

    const checkbox = appDocument.createElement('input');
    checkbox.type = 'checkbox';
    fixtureHost.appendChild(checkbox);
    const checkboxStyle = appWindow.getComputedStyle(checkbox);
    const appearance = checkboxStyle.appearance || checkboxStyle.webkitAppearance;
    record(
      'Shared checkbox styling',
      appearance === 'none'
        && Number.parseFloat(checkboxStyle.width) === 16
        && Number.parseFloat(checkboxStyle.height) === 16,
      `${appearance}, ${checkboxStyle.width} × ${checkboxStyle.height}`
    );

    fixtureHost.remove();

    const previewDrawer = appDocument.getElementById('previewDrawer');
    const previewStyle = appWindow.getComputedStyle(previewDrawer);
    record(
      'Preview panel layout',
      previewStyle.display === 'flex' && previewStyle.flexDirection === 'column',
      `${previewStyle.display}, ${previewStyle.flexDirection}`
    );

    const dialogs = ['helpDialog', 'validationDialog', 'recentDialog']
      .map(id => appDocument.getElementById(id));
    const dialogStyles = dialogs.map(dialog => appWindow.getComputedStyle(dialog));
    const dialogTops = dialogStyles.map(style => Number.parseFloat(style.top));
    record(
      'Shared dialog placement',
      dialogStyles.every(style => style.position === 'fixed')
        && dialogTops.every(top => Number.isFinite(top) && top >= 12)
        && dialogTops.every(top => top === dialogTops[0]),
      dialogTops.map(top => `${top}px`).join(', ')
    );

    const importDrop = appDocument.getElementById('ymlImportDrop');
    const importStyle = appWindow.getComputedStyle(importDrop);
    record(
      'YML import control layout',
      (importStyle.display === 'flex' || importStyle.display === 'inline-flex')
        && importStyle.alignItems === 'center'
        && importStyle.justifyContent === 'center'
        && Number.parseFloat(importStyle.minHeight) >= 34,
      `${importStyle.display}, ${importStyle.minHeight}`
    );

    const readmeActions = appDocument.querySelector('.readme-actions');
    const readmeStyle = appWindow.getComputedStyle(readmeActions);
    record(
      'README action layout',
      readmeStyle.display === 'grid' && readmeActions?.children.length === 2,
      `${readmeStyle.display}, ${readmeActions?.children.length || 0} actions`
    );

    try {
      const tooltipFixture = appDocument.createElement('button');
      tooltipFixture.className = 'asset-badge';
      tooltipFixture.title = 'First line\nSecond line';
      appDocument.body.appendChild(tooltipFixture);
      await new Promise(resolve => appWindow.setTimeout(resolve, 0));
      record(
        'Tooltip migration controller',
        !tooltipFixture.hasAttribute('title')
          && tooltipFixture.dataset.tooltip === 'First line Second line',
        tooltipFixture.dataset.tooltip || 'not migrated'
      );
      tooltipFixture.remove();
    } catch (error) {
      record('Tooltip migration controller', false, error?.message || 'Unknown error');
    }

    const vendorUrls = [
      '/vendor/libarchive/libarchive.js',
      '/vendor/libarchive/worker-bundle.js',
      '/vendor/libarchive/libarchive.wasm'
    ];
    const vendorResults = await Promise.all(vendorUrls.map(dependencyAvailable));
    record(
      'Archive runtime dependencies',
      vendorResults.every(Boolean),
      `${vendorResults.filter(Boolean).length}/${vendorResults.length} loaded`
    );

    const fieldConfig = appWindow.VPS_YML_FIELDS;
    const categoryCount = Object.keys(fieldConfig?.CATEGORY_CONFIG || {}).length;
    const stepCount = Array.isArray(fieldConfig?.WIZARD_STEPS)
      ? fieldConfig.WIZARD_STEPS.length
      : 0;
    record(
      'Field-definition integrity',
      categoryCount === 6 && stepCount === 7,
      `${categoryCount} categories, ${stepCount} steps`
    );

    try {
      const expectedFunctions = [
        'escapeHtml', 'humanize', 'formatDate', 'isItemBroken', 'isExcludedVpxFormat',
        'isVpuPatchItem', 'getParentId', 'getCategoryItems', 'getAssetState', 'getCoverUrl',
        'normalizeArray', 'wrapText', 'buildYaml', 'highlightYaml', 'safeFilename',
        'downloadText', 'copyText', 'getItemLabel', 'formatDateDMY', 'isMd5Hash',
        'normalizeChecksumValue', 'extractArchiveDirectories'
      ];
      const missingFunctions = expectedFunctions.filter(
        name => typeof appWindow.VPS_UTILS?.[name] !== 'function'
      );
      record('Builder utility exports', missingFunctions.length === 0, missingFunctions.join(', '));

      const primary = 'a'.repeat(32);
      const secondary = 'b'.repeat(32);
      const yaml = appWindow.VPS_UTILS.buildYaml({
        tableVPSId: 'fixture-table',
        enabled: false,
        fps: '60',
        testers: 'Alpha, Beta',
        coloredROMPin2DMD: true,
        coloredROMChecksum: primary,
        coloredROMChecksumSecondary: secondary
      });
      record(
        'YAML utility contract',
        yaml.includes('enabled: false')
          && yaml.includes('fps: 60')
          && yaml.includes('testers:\n  - "Alpha"\n  - "Beta"')
          && yaml.includes(`coloredROMChecksum:\n  - "${primary}"\n  - "${secondary}"`)
          && !yaml.includes('coloredROMChecksumSecondary')
      );

      const requiredState = appWindow.VPS_UTILS.getAssetState(
        { tableFiles: [{ id: 'vpx-one' }] },
        'tableFiles',
        { required: true },
        {},
        {}
      );
      const selectedState = appWindow.VPS_UTILS.getAssetState(
        { tableFiles: [{ id: 'vpx-one' }] },
        'tableFiles',
        { required: true },
        { tableFiles: 'vpx-one' },
        {}
      );
      record(
        'Asset-state utility contract',
        requiredState.key === 'red' && selectedState.key === 'green',
        `${requiredState.key} → ${selectedState.key}`
      );
    } catch (error) {
      record('Builder utility exports', false, error?.message || 'Unknown error');
      record('YAML utility contract', false, 'Utility verification failed.');
      record('Asset-state utility contract', false, 'Utility verification failed.');
    }

    try {
      const fixtures = [
        { id: 'abc2', name: 'Beta' },
        { id: 'abc', name: 'Zed' },
        { id: 'x', name: 'abc' }
      ];
      const ranked = appWindow.VPS_SEARCH.filterSuggestions(fixtures, 'abc');
      const rankedIds = ranked.map(item => item.id).join(',');
      record('Table-search ranking', rankedIds === 'abc,x,abc2', rankedIds);
    } catch (error) {
      record('Table-search ranking', false, error?.message || 'Unknown error');
    }

    try {
      const database = await appWindow.fetchVPSDB();
      record(
        'VPS database load',
        Array.isArray(database) && database.length > 0,
        Array.isArray(database) ? `${database.length} records` : 'Unexpected response'
      );
      const status = appWindow.getVPSDBStatus();
      record(
        'VPS database status API',
        Boolean(status?.state && status.state !== 'idle' && status.checkedAt),
        status?.state || 'missing status'
      );
    } catch (error) {
      record('VPS database load', false, error?.message || 'Unknown error');
      record('VPS database status API', false, 'Database load failed.');
    }

    const databaseToast = appDocument.getElementById('vpsDbToast');
    const toastClose = databaseToast?.querySelector('.vps-db-toast-close');
    record(
      'Database status toast DOM',
      Boolean(
        databaseToast
        && databaseToast.getAttribute('role') === 'status'
        && databaseToast.getAttribute('aria-live') === 'polite'
        && toastClose?.getAttribute('aria-label') === 'Dismiss database status'
      )
    );

    const toggle = appDocument.getElementById('themeToggle');
    const originalTheme = appDocument.documentElement.dataset.theme;
    try {
      toggle?.dispatchEvent(new appWindow.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true
      }));
      const firstTheme = appDocument.documentElement.dataset.theme;
      const firstValid = originalTheme === 'pink'
        ? firstTheme === 'dark' || firstTheme === 'light'
        : firstTheme === 'pink';

      toggle?.dispatchEvent(new appWindow.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true
      }));
      const secondTheme = appDocument.documentElement.dataset.theme;
      record(
        'Secret theme activation and return',
        firstValid && secondTheme === originalTheme,
        `${originalTheme} → ${firstTheme} → ${secondTheme}`
      );
    } catch (error) {
      record('Secret theme activation and return', false, error?.message || 'Unknown error');
    }

    const preview = appDocument.getElementById('previewYaml');
    const storedYaml = appWindow.VPS_APP_STORE?.getSnapshot()?.build?.yaml || '';
    record('Initial YAML preview', Boolean(preview?.textContent?.includes('---')));
    record(
      'Shared-state preview synchronization',
      storedYaml === preview?.textContent,
      `${storedYaml.trimEnd().split('\n').length} line${storedYaml.trimEnd().split('\n').length === 1 ? '' : 's'}`
    );

    render();
  }

  frame.addEventListener('load', () => {
    window.setTimeout(run, 1200);
  }, { once: true });
})();
