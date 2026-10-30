(() => {
  'use strict';
  const runtime = window.VPS_FEATURE_RUNTIME;
  const fields = window.VPS_YML_FIELDS;
  const utils = window.VPS_UTILS;
  if (!runtime || !fields || !utils) return;

  const { WIZARD_STEPS } = fields;
  const KEY = 'vpxExtractExtra';

  // Extract Extra Paths (Jason, 2026-10-27): extra directories pulled out of
  // the archive after the table is installed, written as vpxExtractExtra, a
  // list of paths relative to the table root. The third button in the VPX
  // tab's Advanced Config, after Passwords and Post-install Renames.
  //
  // Deliberately the Renames window with one box per row instead of two
  // (vpxRenamesController.js explains the shared behaviour): a working copy,
  // two-click Clear, dots only after a refused Save, the same path rules from
  // VPS_UTILS, and disabled (not hidden) until a PUP Pack, Alt Sound or DMD
  // tab is on; turning the last of them off clears anything saved.

  function definition() {
    return WIZARD_STEPS.find(step => step.id === 'vpx')?.fields
      .find(field => field.yml_field === KEY) || { yml_field: KEY };
  }

  // The saved paths, tidied, blanks dropped. A plain string (a hand-written
  // YML with one path) counts as a list of one.
  function entries() {
    return utils.normalizeInstallPaths ? utils.normalizeInstallPaths(runtime.state.values?.[KEY]) : [];
  }

  function liveWith(isStepEnabled) {
    return (definition().activeWithSteps || []).some(id => {
      const step = WIZARD_STEPS.find(candidate => candidate.id === id);
      return Boolean(step && isStepEnabled?.(step));
    });
  }

  function active() {
    const ctx = window.VPS_MAIN?.validationContext?.();
    return Boolean(ctx && liveWith(ctx.isStepEnabled));
  }

  function validateEntry(path) {
    return utils.installPathProblems(utils.tidyInstallPath(path));
  }

  // What the rulebook reports: nothing while the button is disabled, because
  // nothing is written then.
  function issues(isStepEnabled) {
    if (!liveWith(isStepEnabled)) return [];
    return entries().flatMap((path, index) => validateEntry(path).map(message => ({ index, message })));
  }

  function applyList(list) {
    const kept = utils.normalizeInstallPaths(list);
    runtime.state.callbacks?.onChange?.(KEY, kept.length ? kept : undefined, definition());
    render();
    runtime.schedule();
  }

  // A customRenderer field has no DOM control for ymlImport's setField, so
  // the importer hands the parsed value over here once it has finished.
  function applyImported(value) {
    applyList(value);
  }

  // ── the window ───────────────────────────────────────────────────────────
  let draft = [];
  let liveDots = false;
  // "Add from archive folders" (VPS_UI.createArchiveFolderAdder), built with
  // the window and refreshed on every open.
  let folders = null;

  function dialog() {
    let node = document.getElementById('vpxExtractDialog');
    if (node) return node;
    node = document.createElement('dialog');
    node.id = 'vpxExtractDialog';
    node.className = 'app-dialog vpx-magic-dialog vpx-extract-dialog';
    node.setAttribute('aria-labelledby', 'vpxExtractTitle');
    // Row, remove, add and action styles are the Passwords window's
    // (vpx-magic-*), as in the Renames window.
    node.innerHTML = `
      <div class="dialog-header">
        <div><p class="eyebrow">VPX Configuration</p><h2 id="vpxExtractTitle">Extract Extra Paths</h2></div>
        <button class="dialog-close" data-vpx-extract-close type="button" aria-label="Close extract extra paths">&times;</button>
      </div>
      <div class="dialog-body vpx-magic-body">
        <p class="vpx-magic-note">Extra folders to extract from inside the archive after the table is installed. Paths start at the table folder, like <code>DMD/MFDOOMDMD</code>.</p>
        <div class="vpx-magic-list" id="vpxExtractList"></div>
        <p class="vpx-renames-status" id="vpxExtractStatus" role="status"></p>
        <button class="text-btn vpx-magic-add-row" id="vpxExtractAddRow" type="button">+ Add Path</button>
        <div class="vpx-magic-dialog-actions">
          <button class="text-btn danger-btn" id="vpxExtractClear" type="button" hidden>Clear</button>
          <button class="text-btn" data-vpx-extract-close type="button">Cancel</button>
          <button class="text-btn preview-primary" id="vpxExtractSave" type="button">Save</button>
        </div>
      </div>`;
    document.body.appendChild(node);
    folders = window.VPS_UI?.createArchiveFolderAdder?.({ id: 'vpxExtractFolders', onAdd: addFolders }) || null;
    if (folders) node.querySelector('.vpx-magic-note').after(folders.element);
    node.querySelectorAll('[data-vpx-extract-close]').forEach(button => {
      button.addEventListener('click', () => cancel());
    });
    node.addEventListener('click', event => { if (event.target === node) cancel(); });
    node.addEventListener('cancel', () => { draft = []; });
    node.querySelector('#vpxExtractSave').addEventListener('click', save);
    utils.bindTwoClick(node.querySelector('#vpxExtractClear'), 'Click Again to Clear All', () => clearAll());
    node.querySelector('#vpxExtractAddRow').addEventListener('click', () => {
      draft.push('');
      paint();
      node.querySelector('#vpxExtractList .vpx-extract-row:last-child input')?.focus();
    });
    return node;
  }

  function inputId(index) {
    return `vpxExtractPath${index}`;
  }

  // One new row per picked folder (Jason, 2026-10-29), skipping any already
  // in the window. The empty row a fresh window opens with is filled rather
  // than left above the new ones. Returns the paths it added.
  function addFolders(picked) {
    const have = new Set(draft.map(value => utils.tidyInstallPath(value)).filter(Boolean));
    const fresh = picked.map(path => utils.tidyInstallPath(path)).filter(path => path && !have.has(path));
    if (!fresh.length) return [];
    if (draft.length === 1 && !utils.tidyInstallPath(draft[0])) draft = [];
    const first = draft.length;
    draft.push(...fresh);
    paint();
    revalidate();
    document.getElementById(inputId(first))?.focus();
    return fresh;
  }

  function paint() {
    const list = dialog().querySelector('#vpxExtractList');
    list.replaceChildren();
    draft.forEach((value, index) => {
      const row = document.createElement('div');
      row.className = 'vpx-magic-row-controls vpx-extract-row';

      // Its own .field, so its error dot sits on the box's corner.
      const cell = document.createElement('div');
      cell.className = 'field vpx-renames-cell vpx-extract-cell';
      const input = document.createElement('input');
      input.type = 'text';
      input.id = inputId(index);
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = 'folder1/folder2';
      input.setAttribute('aria-label', `Extract path ${index + 1}`);
      input.value = value;
      input.addEventListener('input', () => {
        draft[index] = input.value;
        revalidate();
      });
      // Tidied on leaving the box: spaces trimmed, outer slashes stripped.
      input.addEventListener('change', () => {
        const tidy = utils.tidyInstallPath(input.value);
        if (tidy !== input.value) input.value = tidy;
        draft[index] = tidy;
        revalidate();
      });
      cell.appendChild(input);
      row.appendChild(cell);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'vpx-magic-remove';
      remove.textContent = '−';
      remove.setAttribute('aria-label', `Remove extract path ${index + 1}`);
      remove.addEventListener('click', () => {
        draft.splice(index, 1);
        if (!draft.length) draft.push('');
        paint();
        revalidate();
        document.getElementById(inputId(Math.min(index, draft.length - 1)))?.focus();
      });
      row.appendChild(remove);
      list.appendChild(row);
    });
  }

  function clearDots() {
    dialog().querySelectorAll('.vpx-extract-cell.has-field-error').forEach(cell => {
      cell.classList.remove('has-field-error');
      cell.querySelector(':scope > .field-error-dot')?.remove();
      const input = cell.querySelector('input');
      input?.removeAttribute('aria-invalid');
      input?.removeAttribute('aria-describedby');
    });
  }

  // Draws the dots for every bad box; returns the first one.
  function presentDots() {
    clearDots();
    let first = null;
    draft.forEach((value, index) => {
      const messages = validateEntry(value);
      if (!messages.length) return;
      const input = document.getElementById(inputId(index));
      const cell = input?.closest('.vpx-extract-cell');
      if (!cell) return;
      cell.classList.add('has-field-error');
      input.setAttribute('aria-invalid', 'true');
      const dot = document.createElement('span');
      dot.className = 'field-error-dot';
      dot.dataset.tooltip = messages.join('\n');
      window.VPS_ERROR_DOTS?.setTip?.(dot, messages);
      dot.setAttribute('role', 'img');
      dot.setAttribute('aria-label', messages.join(' '));
      dot.tabIndex = 0;
      dot.id = `${input.id}Error`;
      input.setAttribute('aria-describedby', dot.id);
      cell.appendChild(dot);
      first = first || input;
    });
    return first;
  }

  function setStatus(text) {
    const status = dialog().querySelector('#vpxExtractStatus');
    if (status.textContent !== text) status.textContent = text;
  }

  function revalidate() {
    if (!liveDots) return;
    if (!presentDots()) setStatus('');
  }

  function open() {
    if (!active()) return;
    draft = entries();
    if (!draft.length) draft.push('');
    liveDots = false;
    paint();
    setStatus('');
    const node = dialog();
    clearDots();
    folders?.refresh(runtime.state.values);
    const clear = node.querySelector('#vpxExtractClear');
    clear.hidden = entries().length === 0;
    utils.resetTwoClick(clear);
    if (typeof node.showModal === 'function') node.showModal();
    else node.setAttribute('open', 'open');
    node.querySelector('#vpxExtractList input')?.focus();
  }

  function cancel() {
    draft = [];
    dialog().close?.();
  }

  function save() {
    draft = draft.map(value => utils.tidyInstallPath(value));
    paint();
    const firstBad = presentDots();
    if (firstBad) {
      liveDots = true;
      setStatus('Fix the marked paths to save.');
      firstBad.focus();
      return;
    }
    const kept = draft.filter(Boolean);
    draft = [];
    dialog().close?.();
    applyList(kept);
  }

  function clearAll() {
    draft = [];
    dialog().close?.();
    applyList([]);
  }

  // ── the button in Advanced Config ────────────────────────────────────────
  function folderIconSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/><path d="M12 11v5M9.5 13.5 12 16l2.5-2.5"/></svg>';
  }

  const DISABLED_TIP = 'Turn on PUP Pack, Alt Sound or DMD to use this';

  function render() {
    const grid = document.querySelector('#config-panel-vpx .compact-advanced > .advanced-grid');
    if (!grid || !runtime.state.callbacks) return;
    let row = grid.querySelector(':scope > .advanced-actions');
    if (!row) {
      row = document.createElement('div');
      row.className = 'advanced-actions';
      grid.appendChild(row);
    }

    let button = row.querySelector('#vpxExtractBtn');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'vpxExtractBtn';
      button.className = 'advanced-action-btn';
      button.setAttribute('aria-haspopup', 'dialog');
      button.innerHTML = `${folderIconSvg()}<span class="advanced-action-label">Extract Extra Paths</span><span class="advanced-action-count" aria-hidden="true" hidden></span>`;
      button.addEventListener('click', event => {
        event.preventDefault();
        open();
      });
      row.appendChild(button);
    }

    // aria-disabled, not disabled, so the tooltip saying why can show.
    const on = active();
    const count = entries().length;
    const badge = button.querySelector('.advanced-action-count');
    badge.hidden = count === 0;
    badge.textContent = String(count);
    if (on) {
      button.removeAttribute('aria-disabled');
      delete button.dataset.tooltip;
    } else {
      button.setAttribute('aria-disabled', 'true');
      button.dataset.tooltip = DISABLED_TIP;
    }
    const saved = count ? `${count} saved` : 'none saved';
    button.setAttribute('aria-label', on
      ? `Extract Extra Paths, ${saved}. Opens the extract paths window.`
      : `Extract Extra Paths, ${saved}. Unavailable. ${DISABLED_TIP}.`);
  }

  const api = Object.freeze({ entries, active, issues, validateEntry, open, render, applyImported, applyList });
  window.VPS_EXTRACT_EXTRA = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dialog, { once: true });
  else dialog();
})();
