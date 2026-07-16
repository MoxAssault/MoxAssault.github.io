(() => {
  'use strict';

  const frame = document.getElementById('appFrame');
  const results = document.getElementById('results');
  const checks = [];

  function record(name, passed, detail = '') {
    checks.push({ name, passed, detail });
  }

  function render() {
    results.replaceChildren();
    checks.forEach(check => {
      const item = document.createElement('li');
      item.className = check.passed ? 'pass' : 'fail';
      item.textContent = `${check.passed ? 'PASS' : 'FAIL'} — ${check.name}${check.detail ? `: ${check.detail}` : ''}`;
      results.appendChild(item);
    });

    const summary = document.createElement('li');
    const failed = checks.filter(check => !check.passed).length;
    summary.className = failed ? 'fail' : 'pass';
    summary.textContent = failed
      ? `${failed} smoke test${failed === 1 ? '' : 's'} failed.`
      : `All ${checks.length} smoke tests passed.`;
    results.prepend(summary);
  }

  async function fetchDependency(url) {
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
      'VPS_YML_FIELDS', 'VPS_UTILS', 'VPS_SEARCH', 'VPS_UI'
    ];
    const missingGlobals = requiredGlobals.filter(name => !appWindow[name]);
    record('Core application globals', missingGlobals.length === 0, missingGlobals.join(', '));

    const stylesheetLinks = [...appDocument.querySelectorAll('link[rel="stylesheet"]')]
      .map(link => link.href)
      .filter(url => !url.includes('fonts.googleapis.com'));
    const stylesheetResults = await Promise.all(stylesheetLinks.map(fetchDependency));
    record('Stylesheet dependencies', stylesheetResults.every(Boolean), `${stylesheetResults.filter(Boolean).length}/${stylesheetResults.length} loaded`);

    const scriptSources = [...appDocument.scripts].map(script => script.src).filter(Boolean);
    const scriptResults = await Promise.all(scriptSources.map(fetchDependency));
    record('Script dependencies', scriptResults.every(Boolean), `${scriptResults.filter(Boolean).length}/${scriptResults.length} loaded`);

    const loadedPaths = new Set([...stylesheetLinks, ...scriptSources].map(pathname));
    const expectedRefactorPaths = [
      '/refactor/styles/tokens.css',
      '/refactor/styles/components/app-shell.css',
      '/refactor/styles/components/search.css',
      '/refactor/styles/components/table-card.css',
      '/refactor/styles/components/preview-panel.css',
      '/refactor/styles/components/dialogs.css',
      '/refactor/styles/components/database-status-toast.css',
      '/refactor/styles/components/yml-import.css',
      '/refactor/styles/components/readme-actions.css',
      '/refactor/styles/themes/pink.css',
      '/refactor/src/config/fieldDefinitions.js',
      '/refactor/src/services/vpsDatabase.js',
      '/refactor/src/services/tableSearch.js',
      '/refactor/src/controllers/databaseStatusController.js',
      '/refactor/src/controllers/themeController.js'
    ];
    const replacedLegacyPaths = [
      '/css.src/1variables.css',
      '/css.src/base.css',
      '/css.src/search.css',
      '/css.src/card.css',
      '/css.src/modal.css',
      '/css.src/v0103.css',
      '/css.src/vpsDbToast.css',
      '/css.src/ymlImport.css',
      '/css.src/readmeGenerator.css',
      '/js.src/fields.js',
      '/js.src/apiHelper.js',
      '/js.src/vpsDbToast.js',
      '/js.src/searchHelper.js',
      '/js.src/secretTheme.js'
    ];
    const missingRefactorPaths = expectedRefactorPaths.filter(path => !loadedPaths.has(path));
    const lingeringLegacyPaths = replacedLegacyPaths.filter(path => loadedPaths.has(path));
    record(
      'Refactor-owned module paths',
      missingRefactorPaths.length === 0 && lingeringLegacyPaths.length === 0,
      [
        missingRefactorPaths.length ? `missing ${missingRefactorPaths.join(', ')}` : '',
        lingeringLegacyPaths.length ? `legacy ${lingeringLegacyPaths.join(', ')}` : ''
      ].filter(Boolean).join('; ')
    );

    const previewDrawer = appDocument.getElementById('previewDrawer');
    const previewStyle = appWindow.getComputedStyle(previewDrawer);
    record(
      'Preview panel layout',
      previewStyle.display === 'flex' && previewStyle.flexDirection === 'column',
      `${previewStyle.display}, ${previewStyle.flexDirection}`
    );

    const dialogs = ['helpDialog', 'validationDialog', 'recentDialog']
      .map(id => appDocument.getElementById(id));
    const dialogPositions = dialogs.map(dialog => appWindow.getComputedStyle(dialog));
    const dialogTops = dialogPositions.map(style => Number.parseFloat(style.top));
    const dialogsAligned = dialogPositions.every(style => style.position === 'fixed')
      && dialogTops.every(top => Number.isFinite(top) && top >= 12)
      && dialogTops.every(top => top === dialogTops[0]);
    record('Shared dialog placement', dialogsAligned, dialogTops.map(top => `${top}px`).join(', '));

    const importDrop = appDocument.getElementById('ymlImportDrop');
    const importStyle = appWindow.getComputedStyle(importDrop);
    record(
      'YML import control layout',
      importStyle.display === 'inline-flex' && Number.parseFloat(importStyle.minHeight) >= 34,
      `${importStyle.display}, ${importStyle.minHeight}`
    );

    const readmeActions = appDocument.querySelector('.readme-actions');
    const readmeStyle = appWindow.getComputedStyle(readmeActions);
    record(
      'README action layout',
      readmeStyle.display === 'grid' && readmeActions?.children.length === 2,
      `${readmeStyle.display}, ${readmeActions?.children.length || 0} actions`
    );

    const vendorUrls = [
      '/vendor/libarchive/libarchive.js',
      '/vendor/libarchive/worker-bundle.js',
      '/vendor/libarchive/libarchive.wasm'
    ];
    const vendorResults = await Promise.all(vendorUrls.map(fetchDependency));
    record('Archive runtime dependencies', vendorResults.every(Boolean), `${vendorResults.filter(Boolean).length}/${vendorResults.length} loaded`);

    const fieldConfig = appWindow.VPS_YML_FIELDS;
    const categoryCount = Object.keys(fieldConfig?.CATEGORY_CONFIG || {}).length;
    const stepCount = Array.isArray(fieldConfig?.WIZARD_STEPS) ? fieldConfig.WIZARD_STEPS.length : 0;
    record('Field-definition integrity', categoryCount === 6 && stepCount === 7, `${categoryCount} categories, ${stepCount} steps`);

    try {
      const fixtures = [
        { id: 'abc2', name: 'Beta' },
        { id: 'abc', name: 'Zed' },
        { id: 'x', name: 'abc' }
      ];
      const ranked = appWindow.VPS_SEARCH.filterSuggestions(fixtures, 'abc');
      const rankedIds = ranked.map(record => record.id).join(',');
      record('Table-search ranking', rankedIds === 'abc,x,abc2', rankedIds);
    } catch (error) {
      record('Table-search ranking', false, error?.message || 'Unknown error');
    }

    try {
      const database = await appWindow.fetchVPSDB();
      record('VPS database load', Array.isArray(database) && database.length > 0, Array.isArray(database) ? `${database.length} records` : 'Unexpected response');

      const status = appWindow.getVPSDBStatus();
      const validStatus = status && typeof status === 'object' && status.state && status.state !== 'idle' && status.checkedAt;
      record('VPS database status API', Boolean(validStatus), status?.state || 'missing status');
    } catch (error) {
      record('VPS database load', false, error?.message || 'Unknown error');
      record('VPS database status API', false, 'Database load failed before status verification.');
    }

    const databaseToast = appDocument.getElementById('vpsDbToast');
    const toastClose = databaseToast?.querySelector('.vps-db-toast-close');
    const validToast = databaseToast
      && databaseToast.getAttribute('role') === 'status'
      && databaseToast.getAttribute('aria-live') === 'polite'
      && toastClose?.getAttribute('aria-label') === 'Dismiss database status';
    record('Database status toast DOM', Boolean(validToast));

    const toggle = appDocument.getElementById('themeToggle');
    const originalTheme = appDocument.documentElement.dataset.theme;
    try {
      toggle?.dispatchEvent(new appWindow.MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
      const firstTheme = appDocument.documentElement.dataset.theme;
      const firstTransitionPassed = originalTheme === 'pink'
        ? firstTheme === 'dark' || firstTheme === 'light'
        : firstTheme === 'pink';

      toggle?.dispatchEvent(new appWindow.MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
      const secondTheme = appDocument.documentElement.dataset.theme;
      const returnedToOriginal = secondTheme === originalTheme;

      record(
        'Secret theme activation and return',
        firstTransitionPassed && returnedToOriginal,
        `${originalTheme} → ${firstTheme} → ${secondTheme}`
      );
    } catch (error) {
      record('Secret theme activation and return', false, error?.message || 'Unknown error');
    }

    const yamlPreview = appDocument.getElementById('previewYaml');
    record('Initial YAML preview', Boolean(yamlPreview?.textContent?.includes('---')));

    render();
  }

  frame.addEventListener('load', () => {
    window.setTimeout(run, 1200);
  }, { once: true });
})();
