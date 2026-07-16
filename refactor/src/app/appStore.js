(() => {
  'use strict';

  const EVENT_TYPES = Object.freeze({
    STATE_CHANGED: 'state:changed',
    BUILD_LOADED: 'build:loaded',
    BUILD_CHANGED: 'build:changed',
    BUILD_CLEARED: 'build:cleared',
    YAML_CHANGED: 'yaml:changed',
    UI_CHANGED: 'ui:changed',
    VALIDATION_CHANGED: 'validation:changed'
  });

  const listeners = new Map();
  const subscribers = new Set();
  let revision = 0;

  function emptyState() {
    return {
      build: {
        record: null,
        selections: {},
        values: {},
        yaml: '---\n'
      },
      ui: {
        activeStep: 'main',
        openAssetDetails: []
      },
      validation: {
        errors: [],
        warnings: []
      },
      meta: {
        revision: 0,
        source: 'bootstrap',
        changedAt: new Date().toISOString()
      }
    };
  }

  let state = emptyState();

  function clonePlain(value) {
    if (Array.isArray(value)) return value.map(clonePlain);
    if (value instanceof Set) return [...value].map(clonePlain);
    if (!value || typeof value !== 'object') return value;
    const output = {};
    Object.entries(value).forEach(([key, item]) => {
      output[key] = clonePlain(item);
    });
    return output;
  }

  function snapshot() {
    return clonePlain(state);
  }

  function emit(type, detail = {}, options = {}) {
    const event = Object.freeze({
      type,
      detail: clonePlain(detail),
      revision: Number.isInteger(options.revision) ? options.revision : revision,
      timestamp: Number.isFinite(options.timestamp) ? options.timestamp : Date.now()
    });
    (listeners.get(type) || new Set()).forEach(listener => {
      try { listener(event); } catch (error) { console.error(`VPS app event listener failed for ${type}`, error); }
    });
    return event;
  }

  function on(type, listener) {
    if (typeof listener !== 'function') throw new TypeError('Event listener must be a function.');
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(listener);
    return () => listeners.get(type)?.delete(listener);
  }

  function notify(source, changedSections, eventType = EVENT_TYPES.STATE_CHANGED) {
    const notificationRevision = revision + 1;
    const notificationSource = source || 'unknown';
    const notificationTimestamp = Date.now();
    const sections = [...changedSections];

    revision = notificationRevision;
    state.meta = {
      revision: notificationRevision,
      source: notificationSource,
      changedAt: new Date(notificationTimestamp).toISOString()
    };

    const nextSnapshot = snapshot();
    const metadata = Object.freeze({
      source: notificationSource,
      changedSections: sections,
      revision: notificationRevision
    });

    subscribers.forEach(listener => {
      try { listener(nextSnapshot, metadata); }
      catch (error) { console.error('VPS app state subscriber failed', error); }
    });

    const detail = {
      source: notificationSource,
      changedSections: sections,
      state: nextSnapshot
    };
    const eventOptions = {
      revision: notificationRevision,
      timestamp: notificationTimestamp
    };

    emit(EVENT_TYPES.STATE_CHANGED, detail, eventOptions);
    if (eventType !== EVENT_TYPES.STATE_CHANGED) emit(eventType, detail, eventOptions);

    return Object.freeze({
      source: notificationSource,
      revision: notificationRevision,
      timestamp: notificationTimestamp,
      state: nextSnapshot
    });
  }

  function subscribe(listener, options = {}) {
    if (typeof listener !== 'function') throw new TypeError('State subscriber must be a function.');
    subscribers.add(listener);
    if (options.immediate === true) listener(snapshot(), { source: 'subscribe', changedSections: [] });
    return () => subscribers.delete(listener);
  }

  function setBuild(next = {}, options = {}) {
    const previousRecordId = String(state.build.record?.id || '');
    const hasRecordUpdate = Object.prototype.hasOwnProperty.call(next, 'record');
    const hasSelectionsUpdate = Object.prototype.hasOwnProperty.call(next, 'selections');
    const hasValuesUpdate = Object.prototype.hasOwnProperty.call(next, 'values');
    const hasYamlUpdate = Object.prototype.hasOwnProperty.call(next, 'yaml');

    state.build = {
      record: hasRecordUpdate ? clonePlain(next.record) : state.build.record,
      selections: hasSelectionsUpdate ? clonePlain(next.selections || {}) : state.build.selections,
      values: hasValuesUpdate ? clonePlain(next.values || {}) : state.build.values,
      yaml: hasYamlUpdate ? String(next.yaml || '---\n') : state.build.yaml
    };

    const nextRecordId = String(state.build.record?.id || '');
    const changedSections = ['build'];
    if (hasYamlUpdate) changedSections.push('yaml');

    let eventType = EVENT_TYPES.BUILD_CHANGED;
    if (!previousRecordId && nextRecordId) eventType = EVENT_TYPES.BUILD_LOADED;
    else if (previousRecordId && !nextRecordId) eventType = EVENT_TYPES.BUILD_CLEARED;

    const notification = notify(options.source || 'setBuild', changedSections, eventType);
    if (hasYamlUpdate) {
      emit(
        EVENT_TYPES.YAML_CHANGED,
        { source: notification.source, yaml: notification.state.build.yaml },
        { revision: notification.revision, timestamp: notification.timestamp }
      );
    }
    return snapshot();
  }

  function setUi(next = {}, options = {}) {
    state.ui = {
      activeStep: Object.prototype.hasOwnProperty.call(next, 'activeStep')
        ? String(next.activeStep || 'main')
        : state.ui.activeStep,
      openAssetDetails: Object.prototype.hasOwnProperty.call(next, 'openAssetDetails')
        ? [...new Set((next.openAssetDetails || []).map(String))]
        : state.ui.openAssetDetails
    };
    notify(options.source || 'setUi', ['ui'], EVENT_TYPES.UI_CHANGED);
    return snapshot();
  }

  function setValidation(next = {}, options = {}) {
    state.validation = {
      errors: clonePlain(next.errors || []),
      warnings: clonePlain(next.warnings || [])
    };
    notify(options.source || 'setValidation', ['validation'], EVENT_TYPES.VALIDATION_CHANGED);
    return snapshot();
  }

  function replace(nextState = {}, options = {}) {
    const base = emptyState();
    state = {
      build: {
        record: clonePlain(nextState.build?.record ?? base.build.record),
        selections: clonePlain(nextState.build?.selections ?? base.build.selections),
        values: clonePlain(nextState.build?.values ?? base.build.values),
        yaml: String(nextState.build?.yaml ?? base.build.yaml)
      },
      ui: {
        activeStep: String(nextState.ui?.activeStep || base.ui.activeStep),
        openAssetDetails: [...new Set((nextState.ui?.openAssetDetails || []).map(String))]
      },
      validation: {
        errors: clonePlain(nextState.validation?.errors || []),
        warnings: clonePlain(nextState.validation?.warnings || [])
      },
      meta: base.meta
    };
    if (options.silent !== true) notify(options.source || 'replace', ['build', 'ui', 'validation']);
    return snapshot();
  }

  function clearBuild(options = {}) {
    state.build = emptyState().build;
    state.ui = emptyState().ui;
    state.validation = emptyState().validation;
    notify(options.source || 'clearBuild', ['build', 'ui', 'validation'], EVENT_TYPES.BUILD_CLEARED);
    return snapshot();
  }

  function select(selector) {
    if (typeof selector !== 'function') return snapshot();
    return clonePlain(selector(state));
  }

  window.VPS_APP_EVENTS = Object.freeze({
    types: EVENT_TYPES,
    on,
    emit
  });

  window.VPS_APP_STORE = Object.freeze({
    getSnapshot: snapshot,
    select,
    subscribe,
    setBuild,
    setUi,
    setValidation,
    replace,
    clearBuild
  });
})();