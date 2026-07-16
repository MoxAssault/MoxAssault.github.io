(() => {
  'use strict';

  const { CATEGORY_CONFIG, WIZARD_STEPS } = window.VPS_YML_FIELDS || {};
  const SEARCH = window.VPS_SEARCH;
  const parser = window.VPS_YML_PARSER;
  const importModel = window.VPS_YML_IMPORT_MODEL;
  const store = window.VPS_APP_STORE;
  if (!CATEGORY_CONFIG || !Array.isArray(WIZARD_STEPS) || !SEARCH || !parser || !importModel) return;

  const MAX_FILE_BYTES = 2 * 1024 * 1024;
  const IMPORT_TIMEOUT_MS = 30000;
  const DROP_ACTIVE_CLASS = 'is-dragover';
  const DROP_LOADING_CLASS = 'is-loading';

  let dropZone = null;
  let fileInput = null;
  let dragDepth = 0;
  let toast = null;
  let toastTitle = null;
  let toastMessage = null;
  let toastHideTimer = null;
  let toastRemoveTimer = null;
  let importing = false;

  function hasCurrentBuild() {
    const storedRecord = store?.getSnapshot?.().build?.record;
    if (storedRecord) return true;
    const workspace = document.getElementById('workspace');
    return Boolean(workspace && !workspace.hidden && document.querySelector('#tableStrip .table-id'));
  }

  function isYmlFile(file) {
    return file instanceof File && /\.yml$/i.test(file.name);
  }

  function ensureToast() {
    if (toast?.isConnected) return toast;

    toast = document.createElement('div');
    toast.id = 'ymlImportToast';
    toast.className = 'vps-db-toast yml-import-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    toast.hidden = true;

    const indicator = document.createElement('span');
    indicator.className = 'vps-db-toast-indicator';
    indicator.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('div');
    copy.className = 'vps-db-toast-copy';
    toastTitle = document.createElement('strong');
    toastTitle.className = 'vps-db-toast-title';
    toastMessage = document.createElement('span');
    toastMessage.className = 'vps-db-toast-message';
    copy.append(toastTitle, toastMessage);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'vps-db-toast-close';
    close.setAttribute('aria-label', 'Dismiss YML import status');
    close.textContent = '×';
    close.addEventListener('click', hideToast);

    toast.append(indicator, copy, close);
    document.body.appendChild(toast);
    return toast;
  }

  function hideToast() {
    window.clearTimeout(toastHideTimer);
    window.clearTimeout(toastRemoveTimer);
    if (!toast || toast.hidden) return;
    toast.classList.remove('is-visible');
    toastRemoveTimer = window.setTimeout(() => {
      if (toast) toast.hidden = true;
    }, 320);
  }

  function showToast(state, title, message) {
    ensureToast();
    window.clearTimeout(toastHideTimer);
    window.clearTimeout(toastRemoveTimer);

    const dbToast = document.getElementById('vpsDbToast');
    toast.classList.toggle('is-stacked', Boolean(dbToast && !dbToast.hidden && dbToast.classList.contains('is-visible')));
    toast.dataset.state = state === 'loading' ? 'checking' : state === 'success' ? 'updated' : 'error';
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    toast.hidden = false;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => toast.classList.add('is-visible'));
    });

    if (state !== 'loading') {
      toastHideTimer = window.setTimeout(hideToast, state === 'error' ? 6500 : 4600);
    }
  }

  function waitFor(predicate, message, timeout = IMPORT_TIMEOUT_MS) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        try {
          const result = predicate();
          if (result) {
            resolve(result);
            return;
          }
        } catch (_) {
          // Keep waiting while the interface rerenders.
        }
        if (Date.now() - started >= timeout) {
          reject(new Error(message));
          return;
        }
        window.setTimeout(check, 40);
      };
      check();
    });
  }

  function nextPaint() {
    return new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
  }

  async function findTableRecord(tableId) {
    const database = await window.fetchVPSDB();
    const record = SEARCH.findExactRecord(database, tableId);
    if (!record || String(record.id || '').trim().toLowerCase() !== String(tableId).trim().toLowerCase()) {
      throw new Error(`Table VPS ID “${tableId}” was not found in the current VPS database.`);
    }
    return record;
  }

  async function clearCurrentBuild() {
    const clearButton = document.getElementById('changeTableBtn');
    if (!clearButton || !hasCurrentBuild()) return;
    clearButton.click();
    await waitFor(
      () => document.getElementById('workspace')?.hidden === true,
      'The current build could not be cleared.'
    );
  }

  async function loadTable(tableId) {
    const input = document.getElementById('idInput');
    const form = document.getElementById('searchForm');
    if (!input || !form) throw new Error('The table search controls are unavailable.');

    input.value = tableId;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (typeof form.requestSubmit === 'function') form.requestSubmit();
    else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      const workspace = document.getElementById('workspace');
      const loadedId = document.querySelector('#tableStrip .table-id')?.textContent?.trim();
      return workspace && !workspace.hidden && loadedId === tableId;
    }, `The table ${tableId} could not be loaded.`);
  }

  async function selectImportedAssets(values) {
    for (const [category, config] of importModel.categoryOrder()) {
      const importedId = String(values[config.idField] ?? '').trim();
      if (!importedId) continue;

      const row = await waitFor(
        () => document.querySelector(`#assetMatrix .asset-row[data-category="${category}"]`),
        `The ${config.label} selector is unavailable.`
      );
      const select = row.querySelector('select');
      const option = [...select.options].find(candidate => candidate.value === importedId && !candidate.disabled);
      if (!option) {
        throw new Error(`${config.label} VPS ID “${importedId}” is not available for this table.`);
      }

      select.value = importedId;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(
        () => document.querySelector(`#assetMatrix .asset-row[data-category="${category}"] select`)?.value === importedId,
        `${config.label} VPS ID “${importedId}” could not be selected.`
      );
      await nextPaint();
    }

    for (const [category, config] of Object.entries(CATEGORY_CONFIG)) {
      if (!config.bundleField || values[config.bundleField] !== true) continue;
      const checkbox = await waitFor(
        () => document.querySelector(`#assetMatrix .asset-row[data-category="${category}"] .bundle-toggle input`),
        `The ${config.label} bundled option is unavailable.`
      );
      if (!checkbox.checked) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        await nextPaint();
      }
    }
  }

  function fieldValueForControl(field, value) {
    if (field.type === 'array' && Array.isArray(value)) return value.map(String).join(', ');
    if (value === null || value === undefined) return '';
    return String(value);
  }

  async function setField(field, value) {
    if (field.readonly || field.disabled || value === undefined) return;
    const control = document.getElementById(`field-${field.yml_field}`);
    if (!control || control.disabled) return;

    if (field.type === 'bool') {
      const checked = value === true || String(value).toLowerCase() === 'true';
      if (control.checked !== checked) {
        control.checked = checked;
        control.dispatchEvent(new Event('change', { bubbles: true }));
        await nextPaint();
      }
      return;
    }

    control.value = fieldValueForControl(field, value);
    const eventName = control.tagName === 'SELECT' ? 'change' : 'input';
    control.dispatchEvent(new Event(eventName, { bubbles: true }));
    await nextPaint();
  }

  async function loadImportedFields(values) {
    const builder = await waitFor(
      () => {
        const section = document.getElementById('builderSection');
        return section && !section.hidden ? section : null;
      },
      'The Configuration Panel did not become available. Confirm the YML includes a valid VPX selection.'
    );

    for (const step of WIZARD_STEPS) {
      const tab = document.getElementById(`config-tab-${step.id}`);
      if (!tab || tab.disabled) continue;

      tab.click();
      await waitFor(
        () => document.querySelector(`#accordionStack .config-tab-panel[data-step="${step.id}"]`),
        `${step.label} configuration could not be opened.`
      );

      const fields = [...(step.fields || [])].sort((left, right) => {
        if (left.yml_field === 'coloredROMPin2DMD') return -1;
        if (right.yml_field === 'coloredROMPin2DMD') return 1;
        return 0;
      });
      for (const field of fields) {
        await setField(field, values[field.yml_field]);
      }
    }

    const mainTab = document.getElementById('config-tab-main');
    if (mainTab && !mainTab.disabled) mainTab.click();
    builder.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function importYmlFile(file) {
    if (importing) return;
    if (!isYmlFile(file)) {
      showToast('error', 'YML file required', 'Only files ending in .yml can be opened.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      showToast('error', 'YML file is too large', 'Select a .yml file smaller than 2 MB.');
      return;
    }

    if (hasCurrentBuild()) {
      const replace = window.confirm('A table build is currently loaded. Clear it and replace it with the dropped YML file?');
      if (!replace) return;
    }

    importing = true;
    dropZone?.classList.add(DROP_LOADING_CLASS);
    showToast('loading', 'Opening YML file', `Parsing ${file.name} and preparing the editor…`);

    try {
      const text = await file.text();
      const parsed = parser.parseFlatYaml(text);
      const { values, ignored } = importModel.normalizeImportedData(parsed);
      const tableId = String(values.tableVPSId ?? '').trim();
      const vpxId = String(values.vpxVPSId ?? '').trim();

      if (!tableId) throw new Error('The YML file does not contain tableVPSId.');
      if (!vpxId) throw new Error('The YML file does not contain vpxVPSId, which is required to open the Configuration Panel.');

      showToast('loading', 'Loading table data', `Finding ${tableId} and matching its selected assets…`);
      const record = await findTableRecord(tableId);
      importModel.validateImportedAssetIds(record, values);
      await clearCurrentBuild();
      await loadTable(tableId);
      await selectImportedAssets(values);
      await loadImportedFields(values);

      const ignoredMessage = ignored.length
        ? ` Loaded successfully; ${ignored.length} unsupported field${ignored.length === 1 ? ' was' : 's were'} skipped.`
        : ' The file is ready to continue editing.';
      showToast('success', 'YML loaded for editing', `${file.name}.${ignoredMessage}`);
    } catch (error) {
      console.error('YML import failed', error);
      showToast('error', 'YML could not be loaded', error?.message || 'The file could not be parsed.');
    } finally {
      importing = false;
      dropZone?.classList.remove(DROP_LOADING_CLASS, DROP_ACTIVE_CLASS);
      dragDepth = 0;
      if (fileInput) fileInput.value = '';
    }
  }

  function bindDropArea() {
    dropZone = document.getElementById('ymlImportDrop');
    fileInput = document.getElementById('ymlImportInput');
    if (!dropZone || !fileInput) return;

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) importYmlFile(file);
    });

    dropZone.addEventListener('dragenter', event => {
      event.preventDefault();
      dragDepth += 1;
      dropZone.classList.add(DROP_ACTIVE_CLASS);
    });

    dropZone.addEventListener('dragover', event => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      dropZone.classList.add(DROP_ACTIVE_CLASS);
    });

    dropZone.addEventListener('dragleave', event => {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) dropZone.classList.remove(DROP_ACTIVE_CLASS);
    });

    dropZone.addEventListener('drop', event => {
      event.preventDefault();
      dragDepth = 0;
      dropZone.classList.remove(DROP_ACTIVE_CLASS);
      const files = [...(event.dataTransfer?.files || [])];
      if (files.length !== 1) {
        showToast('error', 'Choose one YML file', 'Drop exactly one .yml file at a time.');
        return;
      }
      importYmlFile(files[0]);
    });
  }

  window.VPS_YML_IMPORT_CONTROLLER = Object.freeze({
    importFile: importYmlFile,
    isYmlFile,
    hasCurrentBuild
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindDropArea, { once: true });
  } else {
    bindDropArea();
  }
})();