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

    const utilityModuleGlobals = [
      'VPS_FORMATTING',
      'VPS_ASSET_CATALOG',
      'VPS_YAML_SERVICE',
      'VPS_FILE_OUTPUT',
      'VPS_ARCHIVE_PATHS'
    ];
    const missingUtilityModules = utilityModuleGlobals.filter(name => !appWindow[name]);
    record('Utility module namespaces', missingUtilityModules.length === 0, missingUtilityModules.join(', '));

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
      '/refactor/src/utils/formatting.js',
      '/refactor/src/services/assetCatalog.js',
      '/refactor/src/services/yamlService.js',
      '/refactor/src/services/fileOutput.js',
      '/refactor/src/services/archivePaths.js',
      '/refactor/src/core/builderUtilities.js',
      '/refactor/src/services/vpsDatabase.js',
      '/refactor/src/services/tableSearch.js',
      '/refactor/src/controllers/databaseStatusController.js',
      '/refactor/src/controllers/themeController.js',
      '/refactor/src/ui/tooltipController.js'
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
      '/js.src/utilities.js',
      '/js.src/apiHelper.js',
      '/js.src/vpsDbToast.js',
      '/js.src/searchHelper.js',
      '/js.src/secretTheme.js',
      '/js.src/nativeTooltipCleanup.js'
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
    const importDisplayValid = importStyle.display === 'flex' || importStyle.display === 'inline-flex';
    record(
      'YML import control layout',
      importDisplayValid
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
      const tooltipPassed = !tooltipFixture.hasAttribute('title')
        && tooltipFixture.dataset.tooltip === 'First line Second line';
      record('Tooltip migration controller', tooltipPassed, tooltipFixture.dataset.tooltip || 'not migrated');
      tooltipFixture.remove();
    } catch (error) {
      record('Tooltip migration controller', false, error?.message || 'Unknown error');
    }

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
      const expectedUtilityFunctions = [
        'escapeHtml', 'humanize', 'formatDate', 'isItemBroken', 'isExcludedVpxFormat',
        'isVpuPatchItem', 'getParentId', 'getCategoryItems', 'getAssetState', 'getCoverUrl',
        'normalizeArray', 'wrapText', 'buildYaml', 'highlightYaml', 'safeFilename',
        'downloadText', 'copyText', 'getItemLabel', 'formatDateDMY', 'isMd5Hash',
        'normalizeChecksumValue', 'extractArchiveDirectories'
      ];
      const missingUtilityFunctions = expectedUtilityFunctions
        .filter(name => typeof appWindow.VPS_UTILS?.[name] !== 'function');
      record(
        'Builder utility exports',
        missingUtilityFunctions.length === 0,
        missingUtilityFunctions.join(', ')
      );

      const compatibilityBindingsValid = appWindow.VPS_UTILS.escapeHtml === appWindow.VPS_FORMATTING.escapeHtml
        && appWindow.VPS_UTILS.getAssetState === appWindow.VPS_ASSET_CATALOG.getAssetState
        && appWindow.VPS_UTILS.buildYaml === appWindow.VPS_YAML_SERVICE.buildYaml
        && appWindow.VPS_UTILS.downloadText === appWindow.VPS_FILE_OUTPUT.downloadText
        && appWindow.VPS_UTILS.extractArchiveDirectories === appWindow.VPS_ARCHIVE_PATHS.extractArchiveDirectories;
      record('Utility compatibility bindings', compatibilityBindingsValid);

      const primaryChecksum = 'a'.repeat(32);
      const secondaryChecksum = 'b'.repeat(32);
      const fixtureYaml = appWindow.VPS_UTILS.buildYaml({
        tableVPSId: 'fixture-table',
        enabled: false,
        fps: '60',
        testers: 'Alpha, Beta',
        coloredROMPin2DMD: true,
        coloredROMChecksum: primaryChecksum,
        coloredROMChecksumSecondary: secondaryChecksum
      });
      const yamlContractPassed = fixtureYaml.includes('enabled: false')
        && fixtureYaml.includes('fps: 60')
        && fixtureYaml.includes('testers:\n  - "Alpha"\n  - "Beta"')
        && fixtureYaml.includes(`coloredROMChecksum:\n  - "${primaryChecksum}"\n  - "${secondaryChecksum}"`)
        && fixtureYaml.includes('coloredROMPin2DMD: true')
        && !fixtureYaml.includes('coloredROMChecksumSecondary');
      record('YAML utility contract', yamlContractPassed);

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
      record('Utility compatibility bindings', false, 'Utility verification threw an error.');
      record('YAML utility contract', false, 'Utility verification threw an error.');
      record('Asset-state utility contract', false, 'Utility verification threw an error.');
    }

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
