(() => {
  'use strict';

  const runtime = window.VPS_FEATURE_RUNTIME;
  if (!runtime) return;

  const RULES = [
    ['b2s', 'backglassBundled', 'backglassNotes', 'Backglass'],
    ['rom', 'romBundled', 'romNotes', 'ROM'],
    ['coloredRom', 'coloredROMBundled', 'coloredROMNotes', 'Color ROM'],
    ['pup', 'pupBundled', 'pupNotes', 'PUP Pack'],
    ['altSound', 'altSoundBundled', 'altSoundNotes', 'Alt Sound'],
    ['vpuPatch', 'diffBundled', 'diffNotes', 'VPU Patch']
  ];
  let bypass = false;

  function errors() {
    const values = runtime.state.values || {};
    return RULES.filter(([, bundled, notes]) => values[bundled] === true && !String(values[notes] || '').trim())
      .map(([stepId, , fieldName, label]) => ({
        stepId,
        fieldName,
        title: `${label} Notes are required`,
        message: `Add ${label} Notes when the asset is bundled.`
      }));
  }

  function clear() {
    document.querySelectorAll('.bundled-note-error').forEach(wrapper => {
      wrapper.classList.remove('bundled-note-error', 'feature-has-field-error', 'has-field-error');
      wrapper.removeAttribute('data-feature-error-message');
    });
    document.querySelectorAll('.config-tab.bundled-note-tab-error').forEach(tab => {
      tab.classList.remove('bundled-note-tab-error', 'feature-has-error', 'has-error');
    });
  }

  function refresh() {
    clear();
    errors().forEach(error => {
      const wrapper = document.getElementById(`field-${error.fieldName}`)?.closest('.field');
      if (wrapper) {
        wrapper.classList.add('bundled-note-error', 'feature-has-field-error', 'has-field-error');
        wrapper.dataset.featureErrorMessage = error.message;
      }
      document.getElementById(`config-tab-${error.stepId}`)?.classList.add('bundled-note-tab-error', 'feature-has-error', 'has-error');
    });
  }

  function append(current) {
    const dialog = document.getElementById('validationDialog');
    const body = document.getElementById('validationBody');
    if (!dialog || !body) return;
    let list = body.querySelector('.validation-list');
    if (!list) {
      list = document.createElement('ul');
      list.className = 'validation-list';
      body.replaceChildren(list);
    }
    list.querySelector('.validation-item.success')?.remove();
    const existing = new Set([...list.querySelectorAll('.validation-item strong')].map(node => node.textContent));
    current.forEach(error => {
      if (existing.has(error.title)) return;
      const item = document.createElement('li');
      item.className = 'validation-item error bundled-note-validation-item';
      item.innerHTML = `<strong></strong><span></span>`;
      item.querySelector('strong').textContent = error.title;
      item.querySelector('span').textContent = error.message;
      list.appendChild(item);
    });
    if (!dialog.open) dialog.showModal?.();
    refresh();
  }

  function runOriginal(current) {
    bypass = true;
    document.getElementById('validateBtn')?.click();
    bypass = false;
    setTimeout(() => append(current), 0);
  }

  document.addEventListener('click', event => {
    if (bypass) return;
    const action = event.target instanceof Element ? event.target.closest('#validateBtn, #drawerCopyBtn, #downloadNextBtn') : null;
    if (!action) return;
    const current = errors();
    if (!current.length) return;
    if (action.id === 'validateBtn') {
      setTimeout(() => append(current), 0);
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    runOriginal(current);
  }, true);

  document.addEventListener('input', refresh, true);
  document.addEventListener('change', refresh, true);
  window.VPS_BUNDLED_NOTES_VALIDATION = Object.freeze({ errors, refresh });
})();