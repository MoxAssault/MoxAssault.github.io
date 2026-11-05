(() => {
  'use strict';

  const UI = window.VPS_UI;
  if (!UI) return;

  // The Wizard README is one fixed line since 2026-11-04 (Jason): no
  // template, no preview image. It links the table's catalog page by its
  // folder name in vpx-standalone-alp4k, which is the Short Table Name.
  const WIZARD_CATALOG_URL = 'https://vpxtablemanager.com/catalog/#table=';
  const SHORT_NAME_KEY = '__shortTableName';
  const SHORT_NAME_PREFIX = 'vpx-';

  const snapshot = { record: null, values: null };
  const baseRenderTableStrip = UI.renderTableStrip.bind(UI);
  const baseRenderAssetMatrix = UI.renderAssetMatrix.bind(UI);

  let toast = null;
  let toastTitle = null;
  let toastMessage = null;
  let toastHideTimer = null;
  let toastRemoveTimer = null;
  let shortNameValues = null;

  UI.renderTableStrip = function renderTableStripWithReadmeSnapshot(container, record, selections, values, ...rest) {
    snapshot.record = record || null;
    snapshot.values = values || null;
    syncShortName(values);
    return baseRenderTableStrip(container, record, selections, values, ...rest);
  };

  UI.renderAssetMatrix = function renderAssetMatrixWithReadmeSnapshot(container, record, selections, values, ...rest) {
    snapshot.record = record || snapshot.record;
    snapshot.values = values || snapshot.values;
    return baseRenderAssetMatrix(container, record, selections, values, ...rest);
  };

  // The folder name, with the prefix added once whatever case it was typed
  // in ("4aces", "vpx-4aces" and "VPX-4aces" all give "vpx-4aces"). An empty
  // box stays empty rather than becoming a bare prefix. The rest keeps its case
  // (two of the repo's folders are not all lowercase), and every folder in the
  // repo is letters, numbers, "-" and "_", so each run of anything else becomes
  // one "-": a space or "#" would break the catalog link without a warning.
  function normalizeShortName(value) {
    const name = String(value ?? '').trim();
    if (!name) return '';
    const rest = name.toLowerCase().startsWith(SHORT_NAME_PREFIX) ? name.slice(SHORT_NAME_PREFIX.length) : name;
    const clean = rest.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return clean ? `${SHORT_NAME_PREFIX}${clean}` : '';
  }

  function shortNameProblem(shortName) {
    if (!shortName) return { title: 'Short Table Name required', message: 'Enter the table\'s folder name (ex. 4aces). Wizard README and Test This YML both use it.' };
    return null;
  }

  function wizardReadmeText(shortName) {
    return `This table is in the Table Manager Wizard. To view its details visit ${WIZARD_CATALOG_URL}${shortName}\n`;
  }

  function downloadTextFile(content, filename) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function shortNameElements() {
    return {
      field: document.getElementById('shortTableNameField'),
      input: document.getElementById('shortTableNameInput')
    };
  }

  // Saved under a `__` key: kept with the draft, never written to the YML,
  // and gone on Clear or a new table, because it names one table's folder.
  function storeShortName(value) {
    window.VPS_MAIN?.setUiValue?.(SHORT_NAME_KEY, value);
  }

  function clearShortNameError() {
    const { field, input } = shortNameElements();
    field?.classList.remove('has-field-error');
    field?.querySelector(':scope > .field-error-dot')?.remove();
    input?.removeAttribute('aria-invalid');
    input?.removeAttribute('aria-describedby');
  }

  // Drawn the same way as every other field's dot (a real element, the
  // shared tooltip), but only when a button that needs the name is pressed:
  // Copy and Download never check it.
  function showShortNameError(entry) {
    const { field, input } = shortNameElements();
    if (!field || !input) return;
    const { message } = entry;
    field.classList.add('has-field-error');
    let dot = field.querySelector(':scope > .field-error-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'field-error-dot';
      dot.id = 'shortTableNameError';
      dot.setAttribute('role', 'img');
      dot.tabIndex = 0;
      field.appendChild(dot);
    }
    dot.dataset.tooltip = `${entry.title}. ${message}`;
    dot.setAttribute('aria-label', dot.dataset.tooltip);
    window.VPS_ERROR_DOTS?.setTip?.(dot, [entry]);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', dot.id);
    input.focus();
  }

  // The box sits outside the tabs, so it is refilled from the build on every
  // table-strip render: a restored draft brings its name back, and a new
  // table or a Clear empties it. Left alone while the user is typing in it.
  function syncShortName(values) {
    const { input } = shortNameElements();
    if (!input) return;
    // main.js replaces the values object only for a different build (a new
    // table, Clear, an import, a restored draft), so a new object means any
    // earlier "required" dot belongs to a build that is gone.
    if (values !== shortNameValues) {
      shortNameValues = values || null;
      clearShortNameError();
    }
    if (document.activeElement === input) return;
    const stored = normalizeShortName(values?.[SHORT_NAME_KEY]);
    if (input.value !== stored) input.value = stored;
  }

  function currentShortName() {
    const { input } = shortNameElements();
    const shortName = normalizeShortName(input ? input.value : snapshot.values?.[SHORT_NAME_KEY]);
    if (input && input.value !== shortName) input.value = shortName;
    if (String(snapshot.values?.[SHORT_NAME_KEY] ?? '') !== shortName) storeShortName(shortName);
    return shortName;
  }

  // The name, or '' after marking the box with what is wrong with it.
  function requireShortName() {
    const shortName = currentShortName();
    const problem = shortNameProblem(shortName);
    if (!problem) return shortName;
    showShortNameError(problem);
    showToast('error', problem.title, problem.message);
    return '';
  }

  function generateWizardReadme() {
    if (!snapshot.record || !snapshot.values) {
      showToast('error', 'No build loaded', 'Load a table before generating a README.');
      return;
    }
    const shortName = requireShortName();
    if (!shortName) return;
    downloadTextFile(wizardReadmeText(shortName), 'README.md');
    showToast('success', 'Wizard README downloaded', `README.md for ${shortName} was sent to your Downloads folder.`);
  }

  function ensureToast() {
    if (toast?.isConnected) return toast;

    toast = document.createElement('div');
    toast.id = 'readmeGeneratorToast';
    toast.className = 'vps-db-toast readme-generator-toast';
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
    close.setAttribute('aria-label', 'Dismiss README generation status');
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

    const activeToasts = [...document.querySelectorAll('.vps-db-toast.is-visible')]
      .filter(candidate => candidate !== toast && !candidate.hidden);
    toast.style.setProperty('--readme-toast-offset', `${activeToasts.length * 58}px`);
    toast.dataset.state = state === 'loading' ? 'checking' : state === 'success' ? 'updated' : state === 'warning' ? 'warning' : 'error';
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    toast.hidden = false;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => toast.classList.add('is-visible'));
    });

    if (state !== 'loading') {
      toastHideTimer = window.setTimeout(hideToast, state === 'error' ? 7000 : 5200);
    }
  }

  function init() {
    const wizardButton = document.getElementById('wizardReadmeBtn');
    if (!wizardButton) return;

    wizardButton.addEventListener('click', generateWizardReadme);

    const { input } = shortNameElements();
    if (!input) return;
    // Saved as typed, so a reload mid-word keeps it; the prefix is added
    // when focus leaves the box.
    input.addEventListener('input', () => {
      storeShortName(input.value);
      if (input.value.trim()) clearShortNameError();
    });
    input.addEventListener('blur', () => {
      const shortName = normalizeShortName(input.value);
      if (input.value !== shortName) input.value = shortName;
      storeShortName(shortName);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  window.VPS_README = Object.freeze({ requireShortName });
})();
