(() => {
  'use strict';
  const runtime = window.VPS_FEATURE_RUNTIME;
  const fields = window.VPS_YML_FIELDS;
  if (!runtime || !fields) return;

  const { CATEGORY_CONFIG, WIZARD_STEPS } = fields;

  // Override's Manual VPSID (Jason, 2026-10-28; the queue note is still named
  // "Override VPX checkbox", the respec that replaced it). With Override
  // ticked, the asset row's dropdown gives way to a text box where the user
  // types the VPS ID of an asset from ANY table. It is checked on leaving the
  // box for its asset type only, not its table. A verified ID makes the asset
  // behave like a normal linked one: Override's required fields stop being
  // required (validationRules.js). Empty, Override works exactly as before.
  //
  // The ID is written in the asset's normal key (romVPSId, ...). The Override
  // flag never is (OMIT_FROM_YAML), so nothing in the YML marks it borrowed.
  //
  // Only these five rows: the DMD row has no VPS ID at all, and a VPU Patch
  // belongs to one VPX file, so a borrowed one would patch another table's.
  const CATEGORIES = ['b2sFiles', 'romFiles', 'altColorFiles', 'pupPackFiles', 'altSoundFiles'];

  // Every VPS asset by ID, built once from the database the app already
  // preloads (apiHelper.js). Asset arrays sit on each table record under the
  // category name, as getCategoryItems reads them.
  let index = null;
  let failed = false;
  let loading = null;

  function buildIndex(db) {
    const map = new Map();
    const records = Array.isArray(db) ? db : (Array.isArray(db?.tables) ? db.tables : []);
    records.forEach(record => {
      Object.keys(CATEGORY_CONFIG).forEach(category => {
        const items = Array.isArray(record?.[category]) ? record[category] : [];
        items.forEach(item => {
          const id = String(item?.id || '').trim();
          if (!id) return;
          if (!map.has(id)) map.set(id, []);
          map.get(id).push({ category, record, item });
        });
      });
    });
    return map;
  }

  function ensureIndex() {
    if (index || failed || loading || typeof window.fetchVPSDB !== 'function') return;
    loading = window.fetchVPSDB()
      .then(db => { index = buildIndex(db); })
      .catch(() => { failed = true; })
      .finally(() => {
        loading = null;
        render();
        // An ID typed while the index loaded was written to the YML as
        // unchecked; now that it can fail, the YML and the counts follow.
        window.VPS_MAIN?.refreshOutput?.();
        window.VPS_PRODUCTION_UI_EXTENSIONS?.scheduleControlCorrections?.();
      });
  }

  function config(category) {
    return CATEGORY_CONFIG[category];
  }

  function tabLabel(category) {
    const stepId = config(category)?.stepId;
    return WIZARD_STEPS.find(step => step.id === stepId)?.label || config(category)?.label || category;
  }

  function typeLabel(category) {
    if (category === 'tableFiles') return 'VPX file';
    return CATEGORIES.includes(category) ? tabLabel(category) : (config(category)?.label || category);
  }

  // The manual ID, while Override is ticked on one of the five rows.
  function manualId(category) {
    const c = config(category);
    const values = runtime.state.values || {};
    if (!CATEGORIES.includes(category) || values[c.overrideField] !== true) return '';
    return String(values[c.idField] ?? '').trim();
  }

  // { state: 'empty' | 'pending' | 'ok' | 'error', message, record, item }
  function check(category) {
    return checkId(category, manualId(category));
  }

  function checkId(category, id) {
    if (!id) return { state: 'empty' };
    ensureIndex();
    if (failed) return { state: 'error', message: 'The VPS database has not loaded, so this ID cannot be checked.' };
    if (!index) return { state: 'pending' };
    const found = index.get(id) || [];
    const match = found.find(entry => entry.category === category);
    if (match) return { state: 'ok', record: match.record, item: match.item };
    if (!found.length) return { state: 'error', message: 'No VPS asset has this ID.' };
    return { state: 'error', message: `This ID is a ${typeLabel(found[0].category)}, not a ${tabLabel(category)}.` };
  }

  function verified(category) {
    return check(category).state === 'ok';
  }

  // For the YML import (Jason, 2026-10-28, decision 2 in the queue note): an
  // ID that is not on the loaded table but is a real VPS asset of this row's
  // type imports as Override with that Manual VPSID. Waits for the index the
  // first time; false for a row without the box, an unknown ID, the wrong
  // type, or a database that would not load.
  async function isAssetOfType(category, id) {
    if (!CATEGORIES.includes(category) || !String(id || '').trim()) return false;
    // A load that failed earlier is tried again, as a commit does: the import
    // has just loaded the database itself, and a stale failure would refuse
    // a good ID and blame the ID for it.
    failed = false;
    ensureIndex();
    if (loading) await loading;
    return checkId(category, String(id).trim()).state === 'ok';
  }

  // Writes the ID as the row's Manual VPSID, as leaving the box does, but
  // leaves the keyboard where it is: nobody tabbed out of this box. Override
  // must already be ticked, or the row has no box to own it.
  function apply(category, id) {
    commit(category, String(id || '').trim(), { quiet: true });
  }

  // For the rulebook: one error per bad ID, on its tab's ID field.
  function issues() {
    return CATEGORIES.flatMap(category => {
      const result = check(category);
      if (result.state !== 'error') return [];
      return [{ stepId: config(category).stepId, fieldName: config(category).idField, message: result.message }];
    });
  }

  function commit(category, value, { refocus = false, quiet = false } = {}) {
    const callbacks = runtime.state.assetCallbacks;
    if (typeof callbacks?.onChange !== 'function') return;
    // A load that failed is tried again on the next commit, so a dropped
    // connection does not block every manual ID until the page is reloaded.
    if (failed) {
      failed = false;
      ensureIndex();
    }
    // The asset row's onChange also redraws the workspace, so the tab's ID
    // field, its required fields and its dots all follow the new ID.
    callbacks.onChange(config(category).idField, value);
    // That redraw rebuilds every asset row, so the box that had focus is gone.
    // Enter keeps the keyboard in the new box; leaving by Tab lands on the
    // row's first checkbox, the next stop, instead of the page body.
    const box = () => document.getElementById(`manualVpsId-${category}`);
    if (quiet) return;
    if (refocus) {
      box()?.focus();
      return;
    }
    window.setTimeout(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      box()?.closest('.asset-row')?.querySelector('.asset-toggle-stack input')?.focus();
    }, 0);
  }

  function presentDot(box, message) {
    let dot = box.querySelector(':scope > .field-error-dot');
    const input = box.querySelector('input');
    if (!message) {
      dot?.remove();
      box.classList.remove('has-field-error');
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      return;
    }
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'field-error-dot';
      dot.setAttribute('role', 'img');
      dot.tabIndex = 0;
      dot.id = `${input.id}Error`;
      box.appendChild(dot);
    }
    if (dot.dataset.tooltip !== message) {
      dot.dataset.tooltip = message;
      window.VPS_ERROR_DOTS?.setTip?.(dot, [{ title: `${tabLabel(box.dataset.category)} ID needs attention`, message }]);
    }
    dot.setAttribute('aria-label', message);
    box.classList.add('has-field-error');
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', dot.id);
  }

  // Runs after every asset-matrix render (productionUiExtensions), which
  // rebuilds the rows from scratch, so it redraws the box each time and only
  // keeps a box the user is typing in.
  function render() {
    CATEGORIES.forEach(category => {
      const row = document.querySelector(`#assetMatrix .asset-row[data-category="${category}"]`);
      const wrap = row?.querySelector('.asset-select-wrap');
      if (!wrap) return;
      const values = runtime.state.values || {};
      const on = values[config(category).overrideField] === true;
      let box = wrap.querySelector(':scope > .manual-vpsid');
      if (!on) {
        box?.remove();
        wrap.classList.remove('has-manual-vpsid');
        return;
      }
      wrap.classList.add('has-manual-vpsid');
      if (!box) {
        box = document.createElement('div');
        box.className = 'manual-vpsid';
        box.dataset.category = category;
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `manualVpsId-${category}`;
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.placeholder = 'Manual VPSID';
        input.setAttribute('aria-label', `Manual VPSID for the ${config(category).singular}. Leave empty to fill in your own links.`);
        // Checked on leaving the box (change), not on every keystroke.
        let enterPressed = false;
        input.addEventListener('keydown', event => { enterPressed = event.key === 'Enter'; });
        input.addEventListener('change', () => {
          const refocus = enterPressed;
          enterPressed = false;
          commit(category, input.value.trim(), { refocus });
        });
        const label = document.createElement('span');
        label.className = 'manual-vpsid-label';
        label.id = `manualVpsIdLabel-${category}`;
        // "Optional", floating on the box's top border (Jason, 2026-10-28).
        // Absolutely placed, so the row keeps its height. Hidden from screen
        // readers: the box's own label already says it may be left empty.
        const field = document.createElement('span');
        field.className = 'manual-vpsid-field';
        const optional = document.createElement('span');
        optional.className = 'manual-vpsid-optional';
        optional.setAttribute('aria-hidden', 'true');
        optional.textContent = 'Optional';
        field.append(input, optional);
        box.append(field, label);
        wrap.appendChild(box);
        // Filled once, here, and never re-synced from state afterwards. This
        // render also runs from productionUiExtensions' capture-phase change
        // listener, which fires BEFORE the box's own change handler: on a real
        // Tab, focus has already left, state still holds the old ID, and a
        // re-sync blanked the box just before it was saved (found 2026-10-28;
        // the race in vault note "VPXS UI Gotchas"). Every change of the saved
        // ID rebuilds the row anyway, so a new box always starts right.
        input.value = manualId(category);
      }
      const input = box.querySelector('input');
      const label = box.querySelector('.manual-vpsid-label');
      const result = check(category);
      // A bad ID's message also shows here, beside the box, so it is seen at
      // once rather than only on the dot's hover (Jason, 2026-10-28).
      const text = result.state === 'ok'
        ? `${result.record?.name || 'Unknown table'} · ${tabLabel(category)}`
        : result.state === 'pending' ? 'Checking…'
          : result.state === 'error' ? result.message : '';
      // No title: nativeTooltipCleanup.js strips any set on a live element.
      // The label wraps instead, so a long table name stays readable.
      if (label.textContent !== text) label.textContent = text;
      label.classList.toggle('is-error', result.state === 'error');
      presentDot(box, result.state === 'error' ? result.message : '');
      // Verified, the box is described by the name beside it, so a screen
      // reader hears which table and asset the ID resolved to.
      if (result.state === 'ok') input.setAttribute('aria-describedby', label.id);
      else if (result.state !== 'error') input.removeAttribute('aria-describedby');
    });
  }

  window.VPS_MANUAL_VPSID = Object.freeze({ CATEGORIES, check, verified, issues, render, isAssetOfType, apply });
})();
