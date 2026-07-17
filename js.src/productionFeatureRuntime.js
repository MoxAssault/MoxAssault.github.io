(() => {
  'use strict';

  const fields = window.VPS_YML_FIELDS;
  const step = id => fields?.WIZARD_STEPS?.find(item => item.id === id);
  const byKey = (list, key) => list?.find(item => item.yml_field === key);
  const order = (list, keys) => keys.map(key => byKey(list, key)).filter(Boolean);

  const main = step('main');
  if (main) {
    const enabled = byKey(main.fields, 'enabled');
    if (enabled) enabled.name = 'Wizard Disabled';
    const tutorial = byKey(main.fields, 'tutorialVPSId');
    if (tutorial) {
      tutorial.advanced = false;
      delete tutorial.conditionalRecordArray;
      tutorial.options = [{ label: 'No tutorials available', value: '' }];
    }
    main.fields = order(main.fields, [
      'tableVPSId', 'fps', 'tutorialVPSId', 'enabled',
      'tagline', 'mainNotes', 'testers',
      'tableNameOverride', 'tableManufacturerOverride', 'tableYearOverride'
    ]);
  }

  const pup = step('pup');
  if (pup) {
    pup.fields = order(pup.fields, [
      'pupVPSId', 'pupChecksum', 'pupNotes',
      'pupVersion', 'pupFileUrl', 'pupArchiveRoot',
      'pupArchiveFormat', 'pupRequired'
    ]);
  }

  const altSound = step('altSound');
  if (altSound) {
    const root = byKey(altSound.fields, 'altSoundArchiveRoot');
    if (root) {
      root.type = 'str';
      root.hideLabel = false;
      root.placeholder = 'Alt Sound Archive Root';
    }
    ['altSoundAuthorsOverride', 'altSoundUrlOverride', 'altSoundVersionOverride'].forEach(key => {
      const field = byKey(altSound.fields, key);
      if (field) field.advanced = true;
    });
    altSound.fields = order(altSound.fields, [
      'altSoundVPSId', 'altSoundChecksum', 'altSoundNotes',
      'altSoundArchiveRoot', 'altSoundArchiveFormat',
      'altSoundAuthorsOverride', 'altSoundUrlOverride', 'altSoundVersionOverride',
      '__altSoundArchiveDirectories'
    ]);
  }
  fields?.PRESET_FIELDS?.delete('altSoundArchiveFormat');

  const state = { record: null, selections: null, values: null, callbacks: null };
  let frame = 0;

  function additionalRomName(entry) {
    const item = (state.record?.romFiles || []).find(candidate => String(candidate?.id || '') === String(entry?.vpsId || ''));
    return String(item?.name || item?.romName || item?.title || item?.version || entry?.vpsId || 'Additional ROM');
  }

  function applyCorrections() {
    frame = 0;

    const tutorial = document.getElementById('field-tutorialVPSId');
    if (tutorial) {
      const available = Array.isArray(state.record?.tutorialFiles) && state.record.tutorialFiles.length > 0;
      tutorial.disabled = !available;
      if (!available && (tutorial.options.length !== 1 || tutorial.options[0]?.textContent !== 'No tutorials available')) {
        tutorial.replaceChildren(new Option('No tutorials available', ''));
      }
    }

    const enabledInput = document.getElementById('field-enabled');
    const enabledLabel = enabledInput?.closest('.checkbox-row')?.querySelector('span:not(.control-tooltip)');
    if (enabledLabel && enabledLabel.textContent !== 'Wizard Disabled') enabledLabel.textContent = 'Wizard Disabled';

    const altId = document.getElementById('field-altSoundVPSId');
    const altIdValue = String(altId?.textContent || state.values?.altSoundVPSId || '').trim();
    if (altIdValue) {
      const wrapper = altId?.closest('.field');
      wrapper?.classList.remove('feature-has-field-error', 'has-field-error');
      wrapper?.removeAttribute('data-feature-error-message');
      wrapper?.querySelectorAll('.field-error-dot').forEach(dot => dot.remove());
    }

    document.querySelector('.additional-rom-empty')?.remove();
    const entries = window.VPS_ADDITIONAL_ROMS?.entries?.() || [];
    const summary = document.querySelector('#config-panel-rom .compact-advanced > summary');
    const add = summary?.querySelector('.additional-rom-add');
    if (summary && add) {
      let icon = summary.querySelector('.additional-rom-info-icon');
      if (!entries.length) {
        icon?.remove();
        add.disabled = false;
      } else {
        const entry = entries[0];
        const info = [additionalRomName(entry), entry.vpsId, entry.checksum, entry.versionOverride, entry.urlOverride]
          .filter(Boolean).join(' · ');
        if (!icon) {
          icon = document.createElement('button');
          icon.type = 'button';
          icon.className = 'additional-rom-info-icon';
          icon.textContent = 'i';
          summary.insertBefore(icon, add);
        }
        icon.dataset.tooltip = info;
        icon.setAttribute('aria-label', info);
        add.disabled = true;
      }
    }
  }

  function schedule() {
    window.VPS_PRODUCTION_UI_EXTENSIONS?.scheduleControlCorrections?.();
    if (frame) return;
    frame = requestAnimationFrame(applyCorrections);
  }

  const api = {
    state,
    update(patch = {}) { Object.assign(state, patch); schedule(); },
    schedule
  };
  window.VPS_FEATURE_RUNTIME = Object.freeze(api);

  document.addEventListener('input', schedule, true);
  document.addEventListener('change', schedule, true);
  document.addEventListener('click', schedule, true);
  if (typeof MutationObserver !== 'undefined') new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
})();