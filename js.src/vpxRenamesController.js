(() => {
  'use strict';
  const runtime = window.VPS_FEATURE_RUNTIME;
  const fields = window.VPS_YML_FIELDS;
  const utils = window.VPS_UTILS;
  if (!runtime || !fields || !utils) return;

  const { WIZARD_STEPS } = fields;
  const KEY = 'postInstallRename';
  const SIDES = ['source', 'destination'];

  // Post-install Renames (Jason, 2026-10-27): ordered exact-path moves made
  // after the table is installed, written as postInstallRename, a list of
  // { source, destination }. A button in the VPX tab's Advanced Config, beside
  // Passwords, opens a window that edits the whole list; the button shows how
  // many are saved and carries the red dot when a saved one has a problem.
  //
  // The window works like the Passwords one (a working copy: Save commits,
  // Cancel or closing discards, Clear takes two clicks) and checks paths like
  // the Additional ROM editor: no dots until a Save is refused, then each dot
  // clears live as its box is fixed. The path rules themselves are shared with
  // Extract Extra Paths in VPS_UTILS (tidyInstallPath, installPathProblems).
  //
  // Only meaningful while a PUP Pack, Alt Sound or DMD tab is on (the field's
  // activeWithSteps). With none on, the button is disabled, not hidden, so the
  // row does not jump and the tooltip can say why. Turning the last of them
  // off clears anything saved, count and all (main.js inactiveFieldKeys;
  // Jason, 2026-10-28).

  function definition() {
    return WIZARD_STEPS.find(step => step.id === 'vpx')?.fields
      .find(field => field.yml_field === KEY) || { yml_field: KEY };
  }

  // The saved rows, tidied, blank rows dropped.
  function entries() {
    return utils.normalizeInstallRenames
      ? utils.normalizeInstallRenames(runtime.state.values?.[KEY])
      : [];
  }

  function active() {
    const ctx = window.VPS_MAIN?.validationContext?.();
    if (!ctx) return false;
    return (definition().activeWithSteps || []).some(id => {
      const step = WIZARD_STEPS.find(candidate => candidate.id === id);
      return Boolean(step && ctx.isStepEnabled(step));
    });
  }

  // Each problem with one row, on the box that has it. A row with one side
  // filled asks for the other side on the empty box.
  function validateEntryDetailed(entry) {
    const errors = [];
    const source = utils.tidyInstallPath(entry?.source);
    const destination = utils.tidyInstallPath(entry?.destination);
    if (!source && !destination) return errors;
    if (!source) errors.push({ side: 'source', message: 'Add the source path, the file or folder to move.' });
    if (!destination) errors.push({ side: 'destination', message: 'Add the destination path, where it should end up.' });
    [['source', source], ['destination', destination]].forEach(([side, path]) => {
      utils.installPathProblems(path).forEach(message => errors.push({ side, message }));
    });
    return errors;
  }

  function validateEntry(entry) {
    return validateEntryDetailed(entry).map(error => error.message);
  }

  // What the rulebook reports: nothing while the button is disabled, because
  // nothing is written then.
  function issues(isStepEnabled) {
    const live = (definition().activeWithSteps || []).some(id => {
      const step = WIZARD_STEPS.find(candidate => candidate.id === id);
      return Boolean(step && isStepEnabled?.(step));
    });
    if (!live) return [];
    return entries().flatMap((entry, index) => validateEntry(entry).map(message => ({ index, message })));
  }

  function applyList(list) {
    const kept = utils.normalizeInstallRenames(list);
    runtime.state.callbacks?.onChange?.(KEY, kept.length ? kept : undefined, definition());
    render();
    runtime.schedule();
  }

  // The key is a customRenderer field with no DOM control, so ymlImport cannot
  // set it; the import bridge reads the block and hands the rows over here.
  function applyImported(list) {
    applyList(Array.isArray(list) ? list : []);
  }

  // ── the window ───────────────────────────────────────────────────────────
  let draft = [];
  // Quiet until a Save is refused; from then until the window reopens, every
  // edit re-checks, so each dot clears as its box is fixed.
  let liveDots = false;
  // "Add from archive folders" (VPS_UI.createArchiveFolderAdder), built with
  // the window and refreshed on every open.
  let folders = null;

  function dialog() {
    let node = document.getElementById('vpxRenamesDialog');
    if (node) return node;
    node = document.createElement('dialog');
    node.id = 'vpxRenamesDialog';
    node.className = 'app-dialog vpx-magic-dialog vpx-renames-dialog';
    node.setAttribute('aria-labelledby', 'vpxRenamesTitle');
    // The row, remove, add and action styles are the Passwords window's
    // (vpx-magic-*), so the two windows read as one system.
    node.innerHTML = `
      <div class="dialog-header">
        <div><p class="eyebrow">VPX Configuration</p><h2 id="vpxRenamesTitle">Post-install Renames</h2></div>
        <button class="dialog-close" data-vpx-renames-close type="button" aria-label="Close post-install renames">&times;</button>
      </div>
      <div class="dialog-body vpx-magic-body">
        <p class="vpx-magic-note">Moves files or folders after the table is installed, in this order. Paths start at the table folder, like <code>folder1/file.ext</code>. To move a folder and everything in it, name the folder.</p>
        <div class="vpx-renames-head" aria-hidden="true"><span>Source</span><span>Destination</span></div>
        <div class="vpx-magic-list" id="vpxRenamesList"></div>
        <p class="vpx-renames-status" id="vpxRenamesStatus" role="status"></p>
        <button class="text-btn vpx-magic-add-row" id="vpxRenamesAddRow" type="button">+ Add Rename</button>
        <div class="vpx-magic-dialog-actions">
          <button class="text-btn danger-btn" id="vpxRenamesClear" type="button" hidden>Clear</button>
          <button class="text-btn" data-vpx-renames-close type="button">Cancel</button>
          <button class="text-btn preview-primary" id="vpxRenamesSave" type="button">Save</button>
        </div>
      </div>`;
    document.body.appendChild(node);
    folders = window.VPS_UI?.createArchiveFolderAdder?.({ id: 'vpxRenamesFolders', onAdd: addFolders }) || null;
    if (folders) node.querySelector('.vpx-magic-note').after(folders.element);
    node.querySelectorAll('[data-vpx-renames-close]').forEach(button => {
      button.addEventListener('click', () => cancel());
    });
    node.addEventListener('click', event => { if (event.target === node) cancel(); });
    // Escape closes without a click; discard there too.
    node.addEventListener('cancel', () => { draft = []; });
    node.querySelector('#vpxRenamesSave').addEventListener('click', save);
    utils.bindTwoClick(node.querySelector('#vpxRenamesClear'), 'Click Again to Clear All', () => clearAll());
    node.querySelector('#vpxRenamesAddRow').addEventListener('click', () => {
      draft.push({ source: '', destination: '' });
      paint();
      node.querySelector('#vpxRenamesList .vpx-renames-row:last-child input')?.focus();
    });
    return node;
  }

  function inputId(index, side) {
    return `vpxRename${side === 'source' ? 'Source' : 'Destination'}${index}`;
  }

  // One new row per picked folder, source and destination both set to it, for
  // the destination to be edited after (Jason, 2026-10-29). A folder already
  // a row's source is skipped; the empty row a fresh window opens with is
  // filled rather than left above the new ones. Returns how many were added,
  // and puts the keyboard on the first new destination.
  function addFolders(picked) {
    const have = new Set(draft.map(entry => utils.tidyInstallPath(entry.source)).filter(Boolean));
    const fresh = picked.map(path => utils.tidyInstallPath(path)).filter(path => path && !have.has(path));
    if (!fresh.length) return 0;
    const blank = entry => !utils.tidyInstallPath(entry.source) && !utils.tidyInstallPath(entry.destination);
    if (draft.length === 1 && blank(draft[0])) draft = [];
    const first = draft.length;
    fresh.forEach(path => draft.push({ source: path, destination: path }));
    paint();
    revalidate();
    document.getElementById(inputId(first, 'destination'))?.focus();
    return fresh.length;
  }

  function paint() {
    const list = dialog().querySelector('#vpxRenamesList');
    list.replaceChildren();
    draft.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'vpx-renames-row';

      SIDES.forEach(side => {
        // Each box is its own .field, so its error dot sits on its corner.
        const wrapper = document.createElement('div');
        wrapper.className = 'field vpx-renames-cell';
        const input = document.createElement('input');
        input.type = 'text';
        input.id = inputId(index, side);
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.placeholder = side === 'source' ? 'file1.ext' : 'renamed/file.ext';
        input.setAttribute('aria-label', `Rename ${index + 1} ${side}`);
        input.value = entry[side];
        input.addEventListener('input', () => {
          draft[index][side] = input.value;
          revalidate();
        });
        // Tidied on leaving the box: spaces trimmed, outer slashes stripped.
        input.addEventListener('change', () => {
          const tidy = utils.tidyInstallPath(input.value);
          if (tidy !== input.value) input.value = tidy;
          draft[index][side] = tidy;
          revalidate();
        });
        wrapper.appendChild(input);
        row.appendChild(wrapper);
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'vpx-magic-remove';
      remove.textContent = '−';
      remove.setAttribute('aria-label', `Remove rename ${index + 1}`);
      remove.addEventListener('click', () => {
        draft.splice(index, 1);
        if (!draft.length) draft.push({ source: '', destination: '' });
        paint();
        revalidate();
        // paint() rebuilt the list, so put the keyboard on the row that took
        // the removed one's place.
        const next = Math.min(index, draft.length - 1);
        document.getElementById(inputId(next, 'source'))?.focus();
      });
      row.appendChild(remove);
      list.appendChild(row);
    });
  }

  function clearDots() {
    dialog().querySelectorAll('.vpx-renames-cell.has-field-error').forEach(cell => {
      cell.classList.remove('has-field-error');
      cell.querySelector(':scope > .field-error-dot')?.remove();
      cell.querySelector('input')?.removeAttribute('aria-invalid');
      cell.querySelector('input')?.removeAttribute('aria-describedby');
    });
  }

  // Draws the dots for every row with a problem; returns the first bad box.
  function presentDots() {
    clearDots();
    let first = null;
    draft.forEach((entry, index) => {
      const bySide = new Map();
      validateEntryDetailed(entry).forEach(({ side, message }) => {
        bySide.set(side, [...(bySide.get(side) || []), message]);
      });
      bySide.forEach((messages, side) => {
        const input = document.getElementById(inputId(index, side));
        const cell = input?.closest('.vpx-renames-cell');
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
        // The box names its own problem when focused, not just "invalid".
        dot.id = `${input.id}Error`;
        input.setAttribute('aria-describedby', dot.id);
        cell.appendChild(dot);
        first = first || input;
      });
    });
    return first;
  }

  // Announced when a Save is refused, and emptied once every box is fixed.
  function setStatus(text) {
    const status = dialog().querySelector('#vpxRenamesStatus');
    if (status.textContent !== text) status.textContent = text;
  }

  function revalidate() {
    if (!liveDots) return;
    if (!presentDots()) setStatus('');
  }

  function open() {
    if (!active()) return;
    draft = entries().map(entry => ({ ...entry }));
    if (!draft.length) draft.push({ source: '', destination: '' });
    liveDots = false;
    paint();
    setStatus('');
    const node = dialog();
    clearDots();
    folders?.refresh(runtime.state.values);
    const clear = node.querySelector('#vpxRenamesClear');
    clear.hidden = entries().length === 0;
    utils.resetTwoClick(clear);
    if (typeof node.showModal === 'function') node.showModal();
    else node.setAttribute('open', 'open');
    node.querySelector('#vpxRenamesList input')?.focus();
  }

  function cancel() {
    draft = [];
    dialog().close?.();
  }

  function save() {
    // Tidy every box first, so what is checked is what would be saved.
    draft = draft.map(entry => ({
      source: utils.tidyInstallPath(entry.source),
      destination: utils.tidyInstallPath(entry.destination)
    }));
    paint();
    const firstBad = presentDots();
    if (firstBad) {
      liveDots = true;
      setStatus('Fix the marked paths to save.');
      firstBad.focus();
      return;
    }
    const kept = draft.filter(entry => entry.source || entry.destination);
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
  function moveIconSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h11M12 4l3 3-3 3M20 17H9M12 14l-3 3 3 3"/></svg>';
  }

  const DISABLED_TIP = 'Turn on PUP Pack, Alt Sound or DMD to use this';

  // Runs on every render of the app's feature UI (productionUiExtensions),
  // so it builds the button once and otherwise only updates it.
  function render() {
    const grid = document.querySelector('#config-panel-vpx .compact-advanced > .advanced-grid');
    if (!grid || !runtime.state.callbacks) return;
    let row = grid.querySelector(':scope > .advanced-actions');
    if (!row) {
      row = document.createElement('div');
      row.className = 'advanced-actions';
      grid.appendChild(row);
    }

    let button = row.querySelector('#vpxRenamesBtn');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'vpxRenamesBtn';
      button.className = 'advanced-action-btn';
      button.setAttribute('aria-haspopup', 'dialog');
      button.innerHTML = `${moveIconSvg()}<span class="advanced-action-label">Post-install Renames</span><span class="advanced-action-count" aria-hidden="true" hidden></span>`;
      button.addEventListener('click', event => {
        event.preventDefault();
        open();
      });
      row.appendChild(button);
    }

    // aria-disabled, not disabled: a disabled button takes no hover or focus,
    // so the tooltip saying why could never show.
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
      ? `Post-install Renames, ${saved}. Opens the renames window.`
      : `Post-install Renames, ${saved}. Unavailable. ${DISABLED_TIP}.`);
  }

  const api = Object.freeze({ entries, active, issues, validateEntry, open, render, applyImported, applyList });
  window.VPS_INSTALL_RENAMES = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dialog, { once: true });
  else dialog();
})();
