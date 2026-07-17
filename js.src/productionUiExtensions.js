(() => {
  'use strict';
  const UI = window.VPS_UI;
  const fields = window.VPS_YML_FIELDS;
  const utils = window.VPS_UTILS;
  const runtime = window.VPS_FEATURE_RUNTIME;
  if (!UI || !fields || !utils || !runtime) return;

  const { CATEGORY_CONFIG, WIZARD_STEPS } = fields;
  const { getCategoryItems, getItemLabel, isItemBroken, normalizeArray } = utils;
  const renderAssets = UI.renderAssetMatrix.bind(UI);
  const renderConfig = UI.renderAccordions.bind(UI);
  let controlFrame = 0;

  function authors(item) {
    const names = normalizeArray(item?.authors ?? item?.author);
    return names.length ? names.join(', ') : 'Unknown author';
  }

  function optionLabel(item, format) {
    const id = String(item?.id || 'Unknown ID');
    if (format === 'id-author') return `${id} · ${authors(item)}`;
    if (format === 'id-version-author') return `${id} · ${String(item?.version || '—')} · ${authors(item)}`;
    return getItemLabel(item);
  }

  function renderableSteps(steps, record) {
    return steps.map(step => ({
      ...step,
      fields: (step.fields || [])
        .filter(field => !field.customRenderer)
        .filter(field => !field.conditionalRecordArray || Boolean(record?.[field.conditionalRecordArray]?.length))
        .map(field => {
          if (!field.dynamicOptionsSource) return field;
          const items = Array.isArray(record?.[field.dynamicOptionsSource]) ? record[field.dynamicOptionsSource] : [];
          return {
            ...field,
            options: [
              { label: `Select ${field.name.replace(/ VPS ID$/i, '')}`, value: '' },
              ...items.map(item => ({
                label: optionLabel(item, field.optionFormat),
                value: String(item?.id || '')
              }))
            ]
          };
        })
    }));
  }

  function relabelAssetOptions(container, record, selections) {
    Object.entries(CATEGORY_CONFIG).forEach(([category, config]) => {
      if (!config.optionFormat) return;
      const select = container.querySelector(`.asset-row[data-category="${CSS.escape(category)}"] select`);
      if (!select) return;
      const items = getCategoryItems(record, category, config, { selections });
      [...select.options].slice(1).forEach(option => {
        const item = items.find(candidate => String(candidate?.id || '') === option.value);
        if (!item) return;
        option.textContent = optionLabel(item, config.optionFormat) + (isItemBroken(item) ? ' · Broken' : '');
      });
    });
  }

  function enabledDefinition() {
    return WIZARD_STEPS.find(step => step.id === 'main')?.fields
      .find(field => field.yml_field === 'enabled') || { yml_field: 'enabled', type: 'bool' };
  }

  function applyDisableControl() {
    const { values, callbacks } = runtime.state;
    const input = document.getElementById('field-enabled');
    if (!input || !values || !callbacks) return;

    input.disabled = false;
    input.removeAttribute('aria-disabled');
    input.checked = values.enabled !== true;
    const row = input.closest('.checkbox-row');
    const label = row?.querySelector('span:not(.control-tooltip)');
    if (label && label.textContent !== 'Disable for Wizard') label.textContent = 'Disable for Wizard';

    const tooltipText = 'Checked keeps this table disabled for Wizard. Uncheck to explicitly enable it.';
    const definition = enabledDefinition();
    definition.name = 'Disable for Wizard';
    definition.tooltip = tooltipText;
    if (row) {
      row.classList.add('has-control-tooltip');
      row.dataset.disableWizardTooltip = tooltipText;
    }

    if (input.dataset.disableWizardBound !== 'true') {
      input.dataset.disableWizardBound = 'true';
      input.addEventListener('change', event => {
        event.stopImmediatePropagation();
        callbacks.onChange('enabled', event.isTrusted ? !input.checked : input.checked, definition);
      }, true);
    }
  }

  function applyControlCorrections() {
    controlFrame = 0;
    applyDisableControl();
    document.getElementById('field-tutorialVPSId')?.closest('.field')?.classList.add('field-main-tutorial');
    window.VPS_FEATURE_VALIDATION?.refresh?.();
  }

  function scheduleControlCorrections() {
    if (controlFrame) return;
    controlFrame = window.requestAnimationFrame(() => {
      controlFrame = window.requestAnimationFrame(applyControlCorrections);
    });
  }

  function refreshFeatureUi() {
    window.VPS_ADDITIONAL_ROMS?.render?.();
    scheduleControlCorrections();
  }

  UI.renderAssetMatrix = function (container, record, selections, values, callbacks) {
    runtime.update({ record, selections, values });
    const result = renderAssets(container, record, selections, values, callbacks);
    relabelAssetOptions(container, record, selections);
    refreshFeatureUi();
    return result;
  };

  UI.renderAccordions = function (container, steps, values, callbacks) {
    runtime.update({ values, callbacks });
    const displayValues = new Proxy(values, {
      get(target, property, receiver) {
        return property === 'enabled' ? false : Reflect.get(target, property, receiver);
      },
      set(target, property, value, receiver) {
        if (property === 'enabled') return true;
        return Reflect.set(target, property, value, receiver);
      }
    });
    const result = renderConfig(container, renderableSteps(steps, runtime.state.record), displayValues, callbacks);
    refreshFeatureUi();
    return result;
  };

  document.addEventListener('input', refreshFeatureUi, true);
  document.addEventListener('change', refreshFeatureUi, true);

  window.VPS_PRODUCTION_UI_EXTENSIONS = Object.freeze({
    refresh: refreshFeatureUi,
    scheduleControlCorrections
  });
})();
