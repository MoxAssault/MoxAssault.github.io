(() => {
  'use strict';
  const runtime = window.VPS_FEATURE_RUNTIME;
  const fields = window.VPS_YML_FIELDS;
  const utils = window.VPS_UTILS;
  if (!runtime || !fields || !utils) return;

  const { WIZARD_STEPS } = fields;

  // The VPX passwords. Since 2026-10-27 (Jason) they are not fields on the
  // tab: a Passwords button in Advanced Config opens one window that edits
  // every password, and the button shows how many are saved. They used to be
  // three inline boxes behind a "+" plus an overflow dialog for the fourth on.
  //
  // State still holds them in the same four keys (vpxMagic, vpxMagic2,
  // vpxMagic3, vpxMagicAdditional), so a draft saved before restores as it
  // was, and the YML, the importer and the archive unlocker are untouched.
  // collectVpxMagic and distributeVpxMagic on VPS_UTILS are the only place
  // the list-to-keys mapping lives; this file never spells it out itself.
  const SLOT_KEYS = utils.VPX_MAGIC_INLINE_KEYS || ['vpxMagic', 'vpxMagic2', 'vpxMagic3'];
  const ALL_KEYS = [...SLOT_KEYS, 'vpxMagicAdditional'];

  function definition(key) {
    return WIZARD_STEPS.find(step => step.id === 'vpx')?.fields
      .find(field => field.yml_field === key) || { yml_field: key };
  }

  function values() {
    return runtime.state.values || {};
  }

  // Every saved password in order, blanks dropped.
  function entries() {
    return utils.collectVpxMagic(values());
  }

  function commit(key, value) {
    runtime.state.callbacks?.onChange?.(key, value, definition(key));
  }

  // Writes a whole ordered list back across the four keys.
  function applyList(list) {
    const target = utils.distributeVpxMagic(list, {});
    ALL_KEYS.forEach(key => commit(key, target[key]));
    render();
    runtime.schedule();
  }

  // The keys are customRenderer fields, so they have no DOM control for
  // ymlImport's setField to drive. The importer hands the whole list over
  // here once loadImportedFields has finished.
  function applyImported(list) {
    applyList(Array.isArray(list) ? list : []);
  }

  // ── the window ───────────────────────────────────────────────────────────
  // It edits a working copy and commits only on Save, so a half-typed
  // password never reaches state, and Cancel genuinely discards.
  let draft = [];

  function dialog() {
    let node = document.getElementById('vpxMagicDialog');
    if (node) return node;
    node = document.createElement('dialog');
    node.id = 'vpxMagicDialog';
    node.className = 'app-dialog vpx-magic-dialog';
    node.setAttribute('aria-labelledby', 'vpxMagicTitle');
    node.innerHTML = `
      <div class="dialog-header">
        <div><p class="eyebrow">VPX Configuration</p><h2 id="vpxMagicTitle">Passwords</h2></div>
        <button class="dialog-close" data-vpx-magic-close type="button" aria-label="Close passwords">&times;</button>
      </div>
      <div class="dialog-body vpx-magic-body">
        <p class="vpx-magic-note">Opens password-protected archives dropped on this table. Written to the YML encoded, never as typed.</p>
        <div class="vpx-magic-list" id="vpxMagicList"></div>
        <button class="text-btn vpx-magic-add-row" id="vpxMagicAddRow" type="button">+ Add Password</button>
        <div class="vpx-magic-dialog-actions">
          <button class="text-btn danger-btn" id="vpxMagicClear" type="button" hidden>Clear</button>
          <button class="text-btn" data-vpx-magic-close type="button">Cancel</button>
          <button class="text-btn preview-primary" id="vpxMagicSave" type="button">Save</button>
        </div>
      </div>`;
    document.body.appendChild(node);
    // Every close path discards: only Save writes.
    node.querySelectorAll('[data-vpx-magic-close]').forEach(button => {
      button.addEventListener('click', () => cancel());
    });
    node.addEventListener('click', event => { if (event.target === node) cancel(); });
    node.querySelector('#vpxMagicSave').addEventListener('click', save);
    // Clear deletes every saved password and they can only be re-typed, so it
    // takes a second click: the first only arms it.
    utils.bindTwoClick(node.querySelector('#vpxMagicClear'), 'Click Again to Clear All', () => clearAll());
    node.querySelector('#vpxMagicAddRow').addEventListener('click', () => {
      draft.push('');
      paint();
      node.querySelector('#vpxMagicList .vpx-magic-row:last-child input')?.focus();
    });
    return node;
  }

  function paint() {
    const list = dialog().querySelector('#vpxMagicList');
    list.replaceChildren();
    draft.forEach((value, index) => {
      const controlId = `vpxMagicEntry${index}`;
      const name = `Password ${index + 1}`;
      const wrapper = document.createElement('div');
      wrapper.className = 'field field-wide vpx-magic-row';

      // No stacked <label>: the name lives inside the field as placeholder
      // text. Every row here is the same one-line control, so a column of
      // labels above them is pure vertical noise. aria-label carries the name
      // for anything that cannot see a placeholder.
      const row = document.createElement('div');
      row.className = 'vpx-magic-row-controls';

      const input = document.createElement('input');
      input.type = 'text';
      input.id = controlId;
      input.autocomplete = 'off';
      input.placeholder = name;
      input.setAttribute('aria-label', name);
      input.value = value;
      input.addEventListener('input', () => { draft[index] = input.value; });
      row.appendChild(input);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'vpx-magic-remove';
      remove.textContent = '−';
      remove.dataset.tooltip = 'REMOVE PASSWORD';
      remove.setAttribute('aria-label', `Remove password ${index + 1}`);
      remove.addEventListener('click', () => {
        draft.splice(index, 1);
        if (!draft.length) draft.push('');
        paint();
        // paint() rebuilt the list, so the button that had focus is gone; put
        // the keyboard on the row that took its place.
        dialog().querySelectorAll('#vpxMagicList input')[Math.min(index, draft.length - 1)]?.focus();
      });
      row.appendChild(remove);

      wrapper.appendChild(row);
      list.appendChild(wrapper);
    });
  }

  function open() {
    draft = entries();
    if (!draft.length) draft.push('');
    paint();
    const node = dialog();
    // Clear only makes sense once something has actually been saved, and it
    // always opens unarmed.
    const clear = node.querySelector('#vpxMagicClear');
    clear.hidden = entries().length === 0;
    utils.resetTwoClick(clear);
    if (typeof node.showModal === 'function') node.showModal();
    else node.setAttribute('open', 'open');
    node.querySelector('#vpxMagicList input')?.focus();
  }

  function cancel() {
    draft = [];
    dialog().close?.();
  }

  function save() {
    const kept = draft.map(entry => String(entry ?? '').trim()).filter(Boolean);
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
  function keyIconSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="3.2"/><path d="M11 12h10M18 12v3.5M21 12v2.5"/></svg>';
  }

  // The row every Advanced Config button sits in, created once per render of
  // the tab. It lives inside the section's own grid, which already carries
  // the section's padding and divider.
  function actionRow() {
    const grid = document.querySelector('#config-panel-vpx .compact-advanced > .advanced-grid');
    if (!grid) return null;
    let row = grid.querySelector(':scope > .advanced-actions');
    if (!row) {
      row = document.createElement('div');
      row.className = 'advanced-actions';
      grid.appendChild(row);
    }
    return row;
  }

  // Runs on every input and change in the app (productionUiExtensions), so it
  // only builds the button once and otherwise just updates its count.
  function render() {
    const row = actionRow();
    if (!row || !runtime.state.callbacks) return;

    let button = row.querySelector('#vpxPasswordsBtn');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'vpxPasswordsBtn';
      button.className = 'advanced-action-btn';
      button.setAttribute('aria-haspopup', 'dialog');
      button.innerHTML = `${keyIconSvg()}<span class="advanced-action-label">Passwords</span><span class="advanced-action-count" aria-hidden="true" hidden></span>`;
      button.addEventListener('click', event => {
        event.preventDefault();
        open();
      });
      row.appendChild(button);
    }

    // Never a password itself, only how many: the count renders on the page.
    const count = entries().length;
    const badge = button.querySelector('.advanced-action-count');
    badge.hidden = count === 0;
    badge.textContent = String(count);
    button.setAttribute('aria-label', count
      ? `Passwords, ${count} saved. Opens the passwords window.`
      : 'Passwords, none saved. Opens the passwords window.');
  }

  const api = Object.freeze({ entries, open, render, applyImported, applyList });
  window.VPS_MAGIC_PASSWORDS = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dialog, { once: true });
  else dialog();
})();
