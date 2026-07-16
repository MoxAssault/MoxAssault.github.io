(() => {
  'use strict';

  const store = window.VPS_APP_STORE;
  const UI = window.VPS_UI;
  const fieldConfig = window.VPS_YML_FIELDS?.CATEGORY_CONFIG || {};
  if (!store || !UI) return;

  const wrapped = Symbol.for('vps.refactor.stateBridgeWrapped');
  let latest = {
    record: null,
    selections: {},
    values: {}
  };
  let workspaceObserver = null;

  function openDetailsFrom(options = {}) {
    if (typeof options.isDetailOpen !== 'function') return undefined;
    return Object.keys(fieldConfig).filter(category => {
      try { return options.isDetailOpen(category); } catch (_) { return false; }
    });
  }

  function captureBuild(source, overrides = {}) {
    latest = {
      record: Object.prototype.hasOwnProperty.call(overrides, 'record') ? overrides.record : latest.record,
      selections: Object.prototype.hasOwnProperty.call(overrides, 'selections') ? overrides.selections : latest.selections,
      values: Object.prototype.hasOwnProperty.call(overrides, 'values') ? overrides.values : latest.values
    };
    store.setBuild({
      record: latest.record,
      selections: latest.selections || {},
      values: latest.values || {}
    }, { source });
  }

  function after(callback, source, capture) {
    if (typeof callback !== 'function') return callback;
    return (...args) => {
      const result = callback(...args);
      queueMicrotask(() => captureBuild(source, capture?.() || {}));
      return result;
    };
  }

  function wrapMethod(name, wrapper) {
    const original = UI[name];
    if (typeof original !== 'function' || original[wrapped]) return;
    const replacement = wrapper(original.bind(UI));
    Object.defineProperty(replacement, wrapped, { value: true });
    UI[name] = replacement;
  }

  wrapMethod('renderTableStrip', original => function stateAwareTableStrip(container, record, selections, values, ...rest) {
    captureBuild('ui:renderTableStrip', { record, selections, values });
    return original(container, record, selections, values, ...rest);
  });

  wrapMethod('renderAssetMatrix', original => function stateAwareAssetMatrix(container, record, selections, values, options = {}, ...rest) {
    captureBuild('ui:renderAssetMatrix', { record, selections, values });
    const bridgedOptions = {
      ...options,
      onSelect: after(options.onSelect, 'asset:select', () => ({ record, selections, values })),
      onBundle: after(options.onBundle, 'asset:bundle', () => ({ record, selections, values })),
      onToggleDetail: after(options.onToggleDetail, 'asset:detail', () => ({ record, selections, values }))
    };
    const details = openDetailsFrom(options);
    if (details) store.setUi({ openAssetDetails: details }, { source: 'ui:renderAssetMatrix' });
    return original(container, record, selections, values, bridgedOptions, ...rest);
  });

  wrapMethod('renderAccordions', original => function stateAwareAccordions(container, steps, values, options = {}, ...rest) {
    captureBuild('ui:renderAccordions', { values });
    const activeStep = typeof options.getActiveStep === 'function' ? options.getActiveStep() : undefined;
    if (activeStep) store.setUi({ activeStep }, { source: 'ui:renderAccordions' });
    const bridgedOptions = {
      ...options,
      onActivate: after(options.onActivate, 'config:activate', () => ({ values })),
      onChange: after(options.onChange, 'config:change', () => ({ values })),
      onClear: after(options.onClear, 'config:clear', () => ({ values }))
    };
    return original(container, steps, values, bridgedOptions, ...rest);
  });

  function syncPreview() {
    return window.VPS_PREVIEW_CONTROLLER?.renderNow?.() || null;
  }

  function syncWorkspaceVisibility() {
    const workspace = document.getElementById('workspace');
    if (!workspace?.hidden) return;
    latest = { record: null, selections: {}, values: {} };
    store.clearBuild({ source: 'workspace:cleared' });
  }

  function startObservers() {
    const workspace = document.getElementById('workspace');
    if (workspace && typeof MutationObserver !== 'undefined') {
      workspaceObserver = new MutationObserver(syncWorkspaceVisibility);
      workspaceObserver.observe(workspace, { attributes: true, attributeFilter: ['hidden'] });
      syncWorkspaceVisibility();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObservers, { once: true });
  } else {
    startObservers();
  }

  window.VPS_STATE_BRIDGE = Object.freeze({
    captureBuild,
    syncPreview,
    getLatest: () => ({ ...latest, selections: { ...latest.selections }, values: { ...latest.values } })
  });
})();