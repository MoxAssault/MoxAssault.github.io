(() => {
  'use strict';

  const UI = window.VPS_UI;
  const runtime = window.VPS_FEATURE_RUNTIME;
  const fields = window.VPS_YML_FIELDS;
  const utils = window.VPS_UTILS;
  if (!UI || !runtime || !fields || !utils) return;

  const { CATEGORY_CONFIG } = fields;
  const baseRenderAssetMatrix = UI.renderAssetMatrix.bind(UI);
  const baseRenderAccordions = UI.renderAccordions.bind(UI);
  const NEW_FIELD_IDS = [
    'tutorialVPSId', 'altSoundVPSId', 'altSoundChecksum', 'altSoundNotes',
    'altSoundArchiveRoot', 'altSoundArchiveFormat', '__altSoundArchiveDirectorySelect',
    'altSoundAuthorsOverride', 'altSoundUrlOverride', 'altSoundVersionOverride',
    'diffNotes', 'diffAuthorsOverride'
  ];
  const DATE_KEYS = ['updatedAt', 'modifiedAt', 'lastUpdated', 'updated', 'createdAt'];
  let frame = 0;

  function dateValue(item) {
    if (!item || typeof item !== 'object') return 0;
    for (const key of DATE_KEYS) {
      const raw = item[key];
      if (raw === undefined || raw === null || raw === '') continue;
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw < 100000000000 ? raw * 1000 : raw;
      const parsed = Date.parse(String(raw));
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }

  function sortRecentlyUpdated(items) {
    return (Array.isArray(items) ? items : [])
      .map((item, index) => ({ item, index, timestamp: dateValue(item) }))
      .sort((left, right) => right.timestamp - left.timestamp || left.index - right.index)
      .map(entry => entry.item);
  }

  function optionId(item) {
    return String(item?.id ?? item?.vpsId ?? '').trim();
  }

  function reorderSelect(select, items) {
    if (!select || !Array.isArray(items) || items.length < 2) return;
    const options = [...select.options];
    const emptyOptions = options.filter(option => option.value === '');
    const optionMap = new Map(options
      .filter(option => option.value !== '')
      .map(option => [String(option.value), option]));
    const sortedOptions = sortRecentlyUpdated(items)
      .map(item => optionMap.get(optionId(item)))
      .filter(Boolean);
    const sortedSet = new Set(sortedOptions);
    const desired = [
      ...emptyOptions,
      ...sortedOptions,
      ...options.filter(option => option.value !== '' && !sortedSet.has(option))
    ];
    if (desired.length !== options.length || desired.every((option, index) => option === options[index])) return;
    const selectedValue = select.value;
    select.replaceChildren(...desired);
    select.value = selectedValue;
  }

  function assetItems(category) {
    const config = CATEGORY_CONFIG[category];
    return config
      ? utils.getCategoryItems(runtime.state.record, category, config, { selections: runtime.state.selections || {} })
      : [];
  }

  function sortSelects() {
    document.querySelectorAll('#assetMatrix .asset-row[data-category]').forEach(row => {
      reorderSelect(row.querySelector('select'), assetItems(row.dataset.category));
    });
    reorderSelect(document.getElementById('field-tutorialVPSId'), runtime.state.record?.tutorialFiles || []);
    reorderSelect(document.getElementById('additionalRomVpsId'), assetItems('romFiles'));
  }

  function hideLabels() {
    NEW_FIELD_IDS.forEach(id => {
      document.getElementById(`field-${id}`)?.closest('.field')
        ?.querySelector(':scope > label')?.classList.add('visually-hidden');
    });
    document.querySelectorAll('#additionalRomDialog .field > label')
      .forEach(label => label.classList.add('visually-hidden'));
  }

  function moveTutorial() {
    const tutorial = document.getElementById('field-tutorialVPSId')?.closest('.field');
    const mainGrid = document.querySelector('#config-panel-main > .field-grid-main');
    if (!tutorial || !mainGrid) return;
    tutorial.classList.add('field-main-tutorial');
    if (tutorial.parentElement !== mainGrid) {
      const enabled = document.getElementById('field-enabled')?.closest('.field');
      mainGrid.insertBefore(tutorial, enabled || null);
    }
    const available = Array.isArray(runtime.state.record?.tutorialFiles) && runtime.state.record.tutorialFiles.length > 0;
    tutorial.querySelector('select')?.toggleAttribute('disabled', !available);
  }

  function cleanAltIdError() {
    const control = document.getElementById('field-altSoundVPSId');
    if (!control || !String(control.textContent || control.value || '').trim()) return;
    const wrapper = control.closest('.field');
    wrapper?.classList.remove('has-field-error', 'feature-has-field-error');
    wrapper?.querySelectorAll(':scope > .field-error-dot').forEach(dot => dot.remove());
    control.removeAttribute('aria-invalid');
  }

  function decorateAdditionalRomRows() {
    const entries = window.VPS_ADDITIONAL_ROMS?.entries?.() || [];
    const items = assetItems('romFiles');
    const itemMap = new Map(items.map(item => [optionId(item), item]));
    document.querySelectorAll('.additional-rom-list .additional-rom-item').forEach((row, index) => {
      const entry = entries[index] || {};
      const item = itemMap.get(String(entry.vpsId || ''));
      const name = String(
        item?.name || item?.romName || item?.title || item?.version || item?.fileName ||
        entry.vpsId || `Additional ROM ${index + 1}`
      ).trim();
      const title = row.querySelector('strong');
      const details = row.querySelector('small');
      if (title && title.textContent !== name) title.textContent = name;
      const detailText = [entry.vpsId, entry.checksum].filter(Boolean).join(' · ') || 'Checksum missing';
      if (details && details.textContent !== detailText) details.textContent = detailText;
    });
  }

  function apply() {
    frame = 0;
    sortSelects();
    hideLabels();
    moveTutorial();
    cleanAltIdError();
    decorateAdditionalRomRows();
  }

  function schedule() {
    if (!frame) frame = window.requestAnimationFrame(apply);
  }

  UI.renderAssetMatrix = function (...args) {
    const result = baseRenderAssetMatrix(...args);
    schedule();
    return result;
  };

  UI.renderAccordions = function (...args) {
    const result = baseRenderAccordions(...args);
    schedule();
    return result;
  };

  function init() {
    ['click', 'input', 'change'].forEach(type => document.addEventListener(type, schedule, true));
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    }
    schedule();
  }

  window.VPS_PRODUCTION_FIELD_PRESENTATION = Object.freeze({ sortRecentlyUpdated, refresh: schedule });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
